import asyncio
import json
import time
from collections import defaultdict, deque

import httpx
from fastapi import Depends, FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from starlette.background import BackgroundTask

from . import auth, billing, config, db
from .money import OUTPUT_BUDGET_TOKENS, charge_umicro

app = FastAPI(title="luv13 API", docs_url=None, redoc_url=None)

# Browser auth (/auth/*) and dual-auth key management (/api/keys) live in
# app/auth.py. Included BEFORE the catch-all passthrough at the bottom of this
# module so these routes win over /{path:path}.
app.include_router(auth.router)
app.include_router(billing.router)

# CORS for the browser frontend only. Explicit origins, credentials allowed —
# never combined with "*". Non-browser clients (curl, scripts hitting /v1/*)
# are unaffected.
app.add_middleware(
    CORSMiddleware,
    allow_origins=auth.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_http: httpx.AsyncClient | None = None

# In-memory sliding-window rate limiter: key_id -> deque of request timestamps
_rate_windows: dict[int, deque] = defaultdict(deque)

OUT_OF_CREDITS_MESSAGE = "You're out of credits. Top up here: https://luv13.ai/top-up"

_HOP_HEADERS = {"host", "content-length", "connection", "keep-alive", "transfer-encoding",
                "te", "trailers", "upgrade", "proxy-authenticate", "proxy-authorization"}


@app.on_event("startup")
async def startup() -> None:
    global _http
    db.init_db()
    db.recover_active_reservations()
    _http = httpx.AsyncClient(base_url=config.UPSTREAM_ROOT, timeout=3600)


@app.on_event("shutdown")
async def shutdown() -> None:
    if _http:
        await _http.aclose()


def _openai_error(status: int, message: str, err_type: str = "invalid_request_error") -> HTTPException:
    return HTTPException(status_code=status, detail={"error": {"message": message, "type": err_type}})


def _upstream_auth() -> dict:
    return {"Authorization": f"Bearer {config.UPSTREAM_API_KEY}"} if config.UPSTREAM_API_KEY else {}


# ---------- auth ----------

def _lookup_new_key(authorization: str) -> dict | None:
    """Returns the key record if the bearer token is one of OUR keys, else None.
    None means the request belongs to the old proxy and should be passed through."""
    if not authorization.startswith("Bearer "):
        return None
    return db.lookup_key(authorization.removeprefix("Bearer ").strip())


async def require_admin(x_admin_secret: str = Header(default="")) -> None:
    if x_admin_secret != config.ADMIN_SECRET:
        raise _openai_error(401, "Invalid admin secret.", "authentication_error")


def _check_rate_limit(key_id: int) -> None:
    limit = config.RATE_LIMIT_PER_KEY_PER_MINUTE
    if limit <= 0:
        return
    now = time.monotonic()
    window = _rate_windows[key_id]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= limit:
        raise _openai_error(429, f"Rate limit exceeded: {limit} requests per minute per key.", "rate_limit_error")
    window.append(now)


def _check_monthly_cap(user_id: int) -> None:
    cap = config.MONTHLY_TOKEN_CAP_PER_USER
    if cap > 0 and db.monthly_tokens(user_id) >= cap:
        raise _openai_error(429, f"Monthly token cap of {cap} tokens reached for this account.", "rate_limit_error")


# ---------- usage extraction ----------

def _extract_usage(usage: dict | None) -> tuple[int, int, int]:
    """Returns (tokens_in, tokens_out, tokens_cached) from an OpenAI-style usage object."""
    if not usage:
        return 0, 0, 0
    tokens_in = usage.get("prompt_tokens", 0) or 0
    tokens_out = usage.get("completion_tokens", 0) or 0
    details = usage.get("prompt_tokens_details") or {}
    tokens_cached = details.get("cached_tokens", 0) or usage.get("cached_tokens", 0) or 0
    return tokens_in, tokens_out, tokens_cached


def _trusted_usage(usage: object) -> tuple[int, int, int] | None:
    if not isinstance(usage, dict):
        return None
    try:
        values = _extract_usage(usage)
    except (AttributeError, TypeError, ValueError):
        return None
    if any(isinstance(value, bool) or not isinstance(value, int) or value < 0 for value in values):
        return None
    if values[0] + values[1] <= 0:
        return None
    return values


def _serialized_messages(body: dict) -> str:
    messages = body.get("messages")
    return json.dumps(messages, ensure_ascii=False)


def _estimate_reservation_input_tokens(body: dict) -> int:
    """Conservative UTF-8 upper bound used only to reserve, never to bill."""
    return max(1, len(_serialized_messages(body).encode("utf-8")))


def _estimate_fallback_input_tokens(body: dict) -> int:
    """Tokenizer-free billing fallback, separate from the conservative reserve."""
    return max(1, (len(_serialized_messages(body)) + 3) // 4)


def _fallback_charge_umicro(
    reservation: dict,
    content_chars: int = 0,
    retain_reserved_output: bool = False,
) -> int:
    if retain_reserved_output:
        return reservation["reserved_umicro"]
    estimated_output_tokens = (content_chars + 3) // 4
    route = config.MODELS[reservation["model"]]
    return max(
        1,
        charge_umicro(
            reservation["fallback_input_tokens"] + estimated_output_tokens,
            route.rate_umicro_per_million,
        ),
    )


class _SettlementGuard:
    """Own one reservation and funnel every terminal path through settle_once."""

    def __init__(self, reservation: dict, start: float):
        self.reservation = reservation
        self.start = start
        self.charge = _fallback_charge_umicro(reservation)
        self.tokens = (0, 0, 0)
        self.status = 500
        self._settled = False

    def observed(self, usage: tuple[int, int, int], status: int) -> None:
        self.tokens = usage
        self.charge = config.model_charge_umicro(
            self.reservation["model"],
            usage[0],
            usage[1],
        )
        self.status = status

    def fallback(
        self,
        status: int,
        content_chars: int = 0,
        retain_reserved_output: bool = False,
    ) -> None:
        self.tokens = (0, 0, 0)
        self.charge = _fallback_charge_umicro(
            self.reservation,
            content_chars,
            retain_reserved_output,
        )
        self.status = status

    def settle_once(self) -> dict | None:
        if self._settled:
            return None
        self._settled = True
        return db.settle_reservation(
            self.reservation["id"],
            self.charge,
            self.tokens[0],
            self.tokens[1],
            self.tokens[2],
            self.status,
            int((time.monotonic() - self.start) * 1000),
        )


def _reserve(key: dict, model: str, upstream_model: str, body: dict) -> dict:
    estimated_input_tokens = _estimate_reservation_input_tokens(body)
    fallback_input_tokens = _estimate_fallback_input_tokens(body)
    route = config.MODELS[model]
    reservation = db.reserve_credit(
        key["id"],
        key["user_id"],
        model,
        upstream_model,
        estimated_input_tokens,
        fallback_input_tokens,
        route.rate_umicro_per_million,
        OUTPUT_BUDGET_TOKENS,
        config.OUTPUT_FLOOR_TOKENS,
    )
    if reservation is None:
        raise _openai_error(402, OUT_OF_CREDITS_MESSAGE, "insufficient_funds_error")
    return reservation


def _validate_chat_body(body: object) -> tuple[dict, str, bool]:
    if not isinstance(body, dict):
        raise _openai_error(400, "Request body must be a JSON object.")
    model = body.get("model")
    if not isinstance(model, str) or not model:
        raise _openai_error(400, "'model' must be a non-empty string.")
    messages = body.get("messages")
    if not isinstance(messages, list):
        raise _openai_error(400, "'messages' must be an array.")
    stream = body.get("stream", False)
    if not isinstance(stream, bool):
        raise _openai_error(400, "'stream' must be a boolean.")
    stream_options = body.get("stream_options")
    if stream_options is not None and not isinstance(stream_options, dict):
        raise _openai_error(400, "'stream_options' must be an object.")
    n = body.get("n", 1)
    if isinstance(n, bool) or not isinstance(n, int) or n != 1:
        raise _openai_error(400, "Only n=1 is supported.")
    for field in ("max_tokens", "max_completion_tokens"):
        value = body.get(field)
        if value is not None and (
            isinstance(value, bool) or not isinstance(value, int) or value <= 0
        ):
            raise _openai_error(400, f"'{field}' must be a positive integer.")
    return body, model, stream


def _cap_output_budget(body: dict, reservation: dict) -> None:
    route = config.MODELS[reservation["model"]]
    affordable_total_tokens = (
        ((reservation["reserved_umicro"] + 1) * 1_000_000 - 1)
        // route.rate_umicro_per_million
    )
    affordable_output_tokens = max(
        1,
        affordable_total_tokens - reservation["estimated_input_tokens"],
    )
    output_cap = min(OUTPUT_BUDGET_TOKENS, affordable_output_tokens)
    fields = ("max_tokens", "max_completion_tokens")
    present = False
    for field in fields:
        value = body.get(field)
        if isinstance(value, int) and not isinstance(value, bool) and value > 0:
            body[field] = min(value, output_cap)
            present = True
    if not present:
        body["max_tokens"] = output_cap


# ---------- generic passthrough to the old luv13-proxy ----------

async def _passthrough(request: Request, path: str | None = None) -> Response:
    """Forward a request untouched to the old proxy and stream the answer back.
    Keeps old customer keys, /keys/generate, /usage and /admin/* fully working."""
    url = path if path is not None else request.url.path
    headers = {k: v for k, v in request.headers.items() if k.lower() not in _HOP_HEADERS}
    upstream_req = _http.build_request(
        request.method, url, params=request.query_params,
        headers=headers, content=await request.body(),
    )
    try:
        upstream = await _http.send(upstream_req, stream=True)
    except httpx.HTTPError as e:
        raise _openai_error(502, f"Upstream request failed: {e}", "upstream_error")
    resp_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in _HOP_HEADERS}
    return StreamingResponse(
        upstream.aiter_raw(),
        status_code=upstream.status_code,
        headers=resp_headers,
        background=BackgroundTask(upstream.aclose),
    )


# ---------- public API ----------

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "luv13-api"}


@app.get("/v1/models")
async def list_models(request: Request, authorization: str = Header(default="")):
    if _lookup_new_key(authorization) is None:
        return await _passthrough(request)
    return {
        "object": "list",
        "data": [
            {"id": name, "object": "model", "owned_by": "luv13"} for name in config.MODELS
        ],
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: Request, authorization: str = Header(default="")):
    key = _lookup_new_key(authorization)
    if key is None:
        # Not one of our keys: old proxy handles auth/metering with its own DB.
        return await _passthrough(request)

    _check_rate_limit(key["id"])
    _check_monthly_cap(key["user_id"])

    try:
        raw_body = await request.json()
    except Exception:
        raise _openai_error(400, "Request body must be valid JSON.")
    body, model, stream = _validate_chat_body(raw_body)
    model_route = config.MODELS.get(model)
    if model_route is None:
        available = ", ".join(config.MODELS)
        raise _openai_error(404, f"Model '{model}' not found. Available models: {available}.", "model_not_found")
    upstream_model = model_route.upstream
    reservation = _reserve(key, model, upstream_model, body)
    start = time.monotonic()
    settlement = _SettlementGuard(reservation, start)
    stream_handoff = False
    try:
        # Every operation after reserve is inside this cleanup scope.
        _cap_output_budget(body, reservation)
        body["model"] = upstream_model
        db.touch_key(key["id"])

        if stream:
            opts = dict(body.get("stream_options") or {})
            opts["include_usage"] = True
            body["stream_options"] = opts
            response = await _stream_chat(body, settlement, model)
            stream_handoff = isinstance(response, StreamingResponse)
            return response

        resp = await _http.post(
            "/v1/chat/completions",
            json=body,
            headers=_upstream_auth(),
        )
        try:
            data = resp.json()
        except Exception:
            settlement.fallback(resp.status_code)
            return JSONResponse(
                status_code=resp.status_code,
                content={
                    "error": {
                        "message": "Upstream returned a non-JSON response.",
                        "type": "upstream_error",
                    }
                },
            )

        usage = _trusted_usage(data.get("usage") if isinstance(data, dict) else None)
        if usage is not None and resp.status_code == 200:
            settlement.observed(usage, resp.status_code)
        else:
            settlement.fallback(
                resp.status_code,
                retain_reserved_output=_has_tool_call_output(data),
            )
        if isinstance(data, dict) and resp.status_code == 200:
            data["model"] = model
        return JSONResponse(status_code=resp.status_code, content=data)
    except asyncio.CancelledError:
        settlement.fallback(499)
        raise
    except HTTPException as exc:
        settlement.fallback(exc.status_code)
        raise
    except Exception as e:
        settlement.fallback(502)
        raise _openai_error(502, f"Upstream request failed: {e}", "upstream_error")
    finally:
        if not stream_handoff:
            settlement.settle_once()


def _has_tool_call_output(data: object) -> bool:
    if not isinstance(data, dict):
        return False
    choices = data.get("choices")
    if not isinstance(choices, list):
        return False
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        message = choice.get("message")
        delta = choice.get("delta")
        for container in (message, delta):
            if isinstance(container, dict) and container.get("tool_calls") is not None:
                return True
    return False


async def _stream_chat(
    body: dict,
    settlement: _SettlementGuard,
    model: str,
):
    upstream_req = _http.build_request("POST", "/v1/chat/completions", json=body, headers=_upstream_auth())
    upstream = await _http.send(upstream_req, stream=True)

    if upstream.status_code != 200:
        try:
            content = await upstream.aread()
        finally:
            await upstream.aclose()
        settlement.fallback(upstream.status_code)
        try:
            return JSONResponse(status_code=upstream.status_code, content=json.loads(content))
        except Exception:
            return JSONResponse(status_code=upstream.status_code,
                                content={"error": {"message": content.decode(errors="replace"), "type": "upstream_error"}})

    async def relay():
        usage = None
        content_chars = 0
        forced_cut = False
        tool_call_output = False
        terminal_status = 200
        last_chunk: dict = {}
        reservation = settlement.reservation

        def credit_exhausted_events() -> tuple[str, str, str]:
            common = {
                "id": last_chunk.get("id", "chatcmpl-luv13-credit"),
                "object": "chat.completion.chunk",
                "created": last_chunk.get("created", int(time.time())),
                "model": model,
            }
            message = {
                **common,
                "choices": [{
                    "index": 0,
                    "delta": {"role": "assistant", "content": OUT_OF_CREDITS_MESSAGE},
                    "finish_reason": None,
                }],
            }
            finish = {
                **common,
                "choices": [{
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop",
                }],
            }
            return (
                "data: " + json.dumps(message, separators=(",", ":")) + "\n\n",
                "data: " + json.dumps(finish, separators=(",", ":")) + "\n\n",
                "data: [DONE]\n\n",
            )

        try:
            async for line in upstream.aiter_lines():
                out = line
                cut_after_line = False
                if line.startswith("data: ") and line != "data: [DONE]":
                    try:
                        chunk = json.loads(line[len("data: "):])
                    except (json.JSONDecodeError, TypeError, ValueError):
                        chunk = None
                    if isinstance(chunk, dict):
                        last_chunk = chunk
                    if isinstance(chunk, dict) and chunk.get("usage"):
                        usage = chunk["usage"]
                    delta_content = None
                    if isinstance(chunk, dict):
                        choices = chunk.get("choices")
                        if (
                            isinstance(choices, list)
                            and choices
                            and isinstance(choices[0], dict)
                        ):
                            delta = choices[0].get("delta")
                            if isinstance(delta, dict):
                                if delta.get("tool_calls") is not None:
                                    tool_call_output = True
                                candidate = delta.get("content")
                                if isinstance(candidate, str):
                                    delta_content = candidate
                    if delta_content:
                        projected_chars = content_chars + len(delta_content)
                        projected_charge = _fallback_charge_umicro(
                            reservation,
                            projected_chars,
                        )
                        if projected_charge > reservation["reserved_umicro"]:
                            forced_cut = True
                            terminal_status = 402
                            for event in credit_exhausted_events():
                                yield event
                            break
                        content_chars = projected_chars
                        cut_after_line = (
                            projected_charge >= reservation["reserved_umicro"]
                        )
                    if isinstance(chunk, dict) and chunk.get("model") is not None:
                        chunk["model"] = model
                        out = "data: " + json.dumps(chunk)
                yield out + "\n"
                if cut_after_line:
                    forced_cut = True
                    terminal_status = 402
                    yield "\n"
                    for event in credit_exhausted_events():
                        yield event
                    break
        except asyncio.CancelledError:
            terminal_status = 499
            raise
        except Exception:
            terminal_status = 502
            raise
        finally:
            try:
                await upstream.aclose()
            except asyncio.CancelledError:
                terminal_status = 499
            except Exception:
                if terminal_status == 200:
                    terminal_status = 502
            trusted = _trusted_usage(usage)
            if trusted is not None and not forced_cut:
                settlement.observed(trusted, terminal_status)
            else:
                settlement.fallback(
                    terminal_status,
                    content_chars,
                    retain_reserved_output=tool_call_output,
                )
            settlement.settle_once()

    try:
        return StreamingResponse(relay(), media_type="text/event-stream")
    except BaseException:
        await upstream.aclose()
        raise


# ---------- internal API (called by the luv13 website, server-to-server) ----------
# Lives under /internal/* so it can never collide with the old proxy's /admin/* UI.

@app.post("/internal/keys", dependencies=[Depends(require_admin)])
async def internal_create_key(payload: dict):
    email = (payload.get("email") or "").strip().lower()
    name = (payload.get("name") or "default").strip()
    if "@" not in email:
        raise _openai_error(400, "A valid 'email' is required.")
    return db.create_key(email, name)


@app.get("/internal/keys", dependencies=[Depends(require_admin)])
async def internal_list_keys(email: str):
    return {"email": email, "keys": db.list_keys(email.strip().lower())}


@app.post("/internal/keys/{key_id}/revoke", dependencies=[Depends(require_admin)])
async def internal_revoke_key(key_id: int):
    if not db.revoke_key(key_id):
        raise _openai_error(404, f"Key {key_id} not found or already revoked.")
    return {"id": key_id, "revoked": True}


@app.get("/internal/usage", dependencies=[Depends(require_admin)])
async def internal_usage(email: str, limit: int = 100, offset: int = 0):
    email = email.strip().lower()
    return {
        "email": email,
        "requests": db.usage_log(email, limit=min(limit, 1000), offset=offset),
    }


@app.get("/internal/summary", dependencies=[Depends(require_admin)])
async def internal_summary(email: str):
    return db.usage_summary(email.strip().lower())


@app.get("/internal/users", dependencies=[Depends(require_admin)])
async def internal_users():
    return {"users": db.list_users()}


# ---------- catch-all: everything else belongs to the old proxy ----------

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
async def passthrough_rest(path: str, request: Request):
    return await _passthrough(request)
