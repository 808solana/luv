"""Fake old luv13-proxy for local testing. Run: uvicorn tests.mock_upstream:app --port 4999

Emulates the relevant behavior of the real proxy on kor:4000:
- /v1/chat/completions requires a Bearer key (401 without)
- accepts the internal key "sk-REDACTED-PLACEHOLDER" and the "old customer" key
  "sk-REDACTED-PLACEHOLDER" (to prove passthrough keeps old keys working)
- /usage is an old-proxy-only endpoint (proves the catch-all passthrough)
"""
import json

from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI()

VALID_KEYS = {"sk-REDACTED-PLACEHOLDER", "REDACTED_PLACEHOLDER"}

USAGE = {
    "prompt_tokens": 120,
    "completion_tokens": 45,
    "total_tokens": 165,
    "prompt_tokens_details": {"cached_tokens": 30},
}


def _key(authorization: str) -> str | None:
    key = authorization.removeprefix("Bearer ").strip()
    return key if key in VALID_KEYS else None


@app.post("/v1/chat/completions")
async def chat(request: Request, authorization: str = Header(default="")):
    if _key(authorization) is None:
        return JSONResponse(status_code=401, content={"error": {"message": "invalid key", "type": "authentication_error"}})
    body = await request.json()
    if body.get("stream"):
        async def gen():
            chunk = {"id": "mock-1", "object": "chat.completion.chunk", "model": body["model"],
                     "choices": [{"index": 0, "delta": {"content": "hello from mock"}}]}
            yield "data: " + json.dumps(chunk) + "\n\n"
            final = {"id": "mock-1", "object": "chat.completion.chunk", "model": body["model"],
                     "choices": [], "usage": USAGE}
            yield "data: " + json.dumps(final) + "\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(gen(), media_type="text/event-stream")
    return {
        "id": "mock-1",
        "object": "chat.completion",
        "model": body["model"],
        "choices": [{"index": 0, "message": {"role": "assistant", "content": "hello from mock"}, "finish_reason": "stop"}],
        "usage": USAGE,
    }


@app.get("/usage")
async def old_usage(authorization: str = Header(default="")):
    if _key(authorization) is None:
        return JSONResponse(status_code=401, content={"error": "unauthorized"})
    return {"source": "old-proxy", "usage": "old customer usage"}
