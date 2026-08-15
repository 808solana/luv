"""User authentication for luv13-api: email/password + Google OAuth.

All auth logic lives in this module; main.py only wires the router and CORS.

Sessions are HS256 JWTs whose SHA-256 hash must exist in the `sessions` table,
so deleting the row revokes the token (logout is real, not just expiry).

Env config (injected via docker-compose env_file):
  JWT_SECRET            - HS256 signing secret (own secret, NOT the proxy's)
  COOKIE_DOMAIN         - default ".luv13.ai"; blank for host-only cookies
  FRONTEND_URL          - comma-splittable origin list; first entry is the
                          redirect base for the Google callback
  SESSION_TTL_DAYS      - default 7
  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
                        - Google OAuth; app boots fine without them and
                          /auth/google then answers 503.
"""

import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse

from . import config, db

router = APIRouter()

# ----- configuration -----

JWT_SECRET = os.environ.get("JWT_SECRET", "")
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN", ".luv13.ai") or None
try:
    SESSION_TTL_DAYS = int(os.environ.get("SESSION_TTL_DAYS", "7"))
except ValueError:
    SESSION_TTL_DAYS = 7
SESSION_MAX_AGE = SESSION_TTL_DAYS * 86400  # 604800 at the default

_FRONTEND_RAW = os.environ.get("FRONTEND_URL", "https://luv13.ai")
FRONTEND_ORIGINS = [o.strip().rstrip("/") for o in _FRONTEND_RAW.split(",") if o.strip()]
FRONTEND_BASE = FRONTEND_ORIGINS[0]

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI", "https://api.luv13.ai/auth/google/callback"
)

SESSION_COOKIE = "luv13_session"
OAUTH_STATE_COOKIE = "luv13_oauth_state"

MAX_ACTIVE_KEYS_PER_USER = 5

# Precomputed bcrypt hash burned when the email is unknown or the account has
# no password, so unknown-vs-wrong-password isn't a timing oracle either.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode()


def _auth_configured() -> bool:
    return bool(JWT_SECRET)


def _google_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def _client_ip(request: Request) -> str:
    # NOTE: behind NPM this is the proxy peer address unless uvicorn is run
    # with --proxy-headers; stored as-is for audit purposes.
    return request.client.host if request.client else "unknown"


# ----- passwords -----

def _validate_password(password: str) -> None:
    if len(password) < 10:
        raise HTTPException(400, detail="Password must be at least 10 characters long.")
    if len(password.encode("utf-8")) > 72:
        # bcrypt silently truncates at 72 bytes — reject instead of truncating.
        raise HTTPException(400, detail="Password must be at most 72 bytes (UTF-8).")


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()


def _check_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode())
    except ValueError:
        return False


# ----- sessions -----

def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _issue_session(user_id: int, ip: str | None, user_agent: str | None) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=SESSION_TTL_DAYS)
    payload = {
        "sub": str(user_id),
        "jti": secrets.token_urlsafe(16),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    db.insert_session(user_id, _token_hash(token), now.isoformat(), exp.isoformat(), ip, user_agent)
    return token


def _session_user_from_token(token: str) -> dict | None:
    """A valid signature alone is not enough: the sessions row must exist and
    be unexpired — that is what makes logout actually revoke."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    row = db.get_session(_token_hash(token))
    if row is None:
        return None
    try:
        if datetime.fromisoformat(row["expires_at"]) <= datetime.now(timezone.utc):
            return None
    except (TypeError, ValueError):
        return None
    try:
        user_id = int(payload.get("sub", "0"))
    except (TypeError, ValueError):
        return None
    return db.get_user_by_id(user_id)


def _session_user(request: Request) -> dict | None:
    if not _auth_configured():
        return None
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    return _session_user_from_token(token)


def _set_session_cookie(resp: Response, token: str) -> None:
    resp.set_cookie(
        SESSION_COOKIE, token,
        max_age=SESSION_MAX_AGE, path="/", domain=COOKIE_DOMAIN,
        secure=True, httponly=True, samesite="lax",
    )


def _clear_session_cookie(resp: Response) -> None:
    # Identical name/domain/path or the delete silently no-ops.
    resp.delete_cookie(SESSION_COOKIE, path="/", domain=COOKIE_DOMAIN,
                       secure=True, httponly=True, samesite="lax")


# ----- dependencies -----

async def require_user(request: Request) -> dict:
    user = _session_user(request)
    if user is None:
        raise HTTPException(401, detail="Not authenticated.")
    return user


async def resolve_actor(request: Request, x_admin_secret: str = Header(default="")) -> dict:
    """Dual auth: X-Admin-Secret header -> admin actor (unchanged behavior),
    else a valid luv13_session cookie -> user actor. Neither -> 401."""
    if x_admin_secret:
        if x_admin_secret == config.ADMIN_SECRET:
            return {"type": "admin"}
        raise HTTPException(401, detail="Invalid admin secret.")
    user = _session_user(request)
    if user is not None:
        return {"type": "user", "user": user}
    raise HTTPException(401, detail="Authentication required.")


# ----- brute-force throttle -----
# In-memory: fine for the single uvicorn worker this service runs with.
# Resets on restart and would NOT be shared if worker count ever increased.

_THROTTLE_WINDOW_S = 900   # 15 minutes
_THROTTLE_MAX_FAILS = 5
_failed_logins: dict[tuple[str, str], deque] = defaultdict(deque)
_SIGNUP_WINDOW_S = 3600
_SIGNUP_MAX_ATTEMPTS = 5
_signup_attempts: dict[str, deque] = defaultdict(deque)


def _throttle_wait(request: Request, email: str) -> int:
    """Seconds until the (ip, email) failure window clears; 0 if clear."""
    key = (_client_ip(request), email)
    now = time.monotonic()
    dq = _failed_logins[key]
    while dq and now - dq[0] > _THROTTLE_WINDOW_S:
        dq.popleft()
    if len(dq) >= _THROTTLE_MAX_FAILS:
        return max(1, int(_THROTTLE_WINDOW_S - (now - dq[0])))
    return 0


def _record_failure(request: Request, email: str) -> None:
    _failed_logins[(_client_ip(request), email)].append(time.monotonic())


def _clear_failures(request: Request, email: str) -> None:
    _failed_logins.pop((_client_ip(request), email), None)


def _signup_throttle_wait(request: Request) -> int:
    ip = _client_ip(request)
    now = time.monotonic()
    attempts = _signup_attempts[ip]
    while attempts and now - attempts[0] > _SIGNUP_WINDOW_S:
        attempts.popleft()
    if len(attempts) >= _SIGNUP_MAX_ATTEMPTS:
        return max(1, int(_SIGNUP_WINDOW_S - (now - attempts[0])))
    attempts.append(now)
    return 0


# ----- response shaping -----

def _public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name"),
        "picture_url": u.get("picture_url"),
        "created_at": u["created_at"],
        "has_password": bool(u.get("password_hash")),
        "has_google": bool(u.get("google_sub")),
    }


# ----- email/password endpoints -----

@router.post("/auth/signup")
async def signup(request: Request):
    if not _auth_configured():
        return JSONResponse(status_code=503, content={"error": "Auth not configured"})
    wait = _signup_throttle_wait(request)
    if wait:
        raise HTTPException(
            429,
            detail="Too many signup attempts. Try again later.",
            headers={"Retry-After": str(wait)},
        )
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, detail="Request body must be valid JSON.")
    if not isinstance(body, dict):
        raise HTTPException(400, detail="Request body must be a JSON object.")
    email_raw, pw_raw = body.get("email"), body.get("password")
    if not isinstance(email_raw, str) or not isinstance(pw_raw, str):
        raise HTTPException(400, detail="'email' and 'password' must be strings.")
    email = email_raw.strip().lower()
    name = body.get("name")
    name = name.strip() if isinstance(name, str) and name.strip() else None
    if "@" not in email:
        raise HTTPException(400, detail="A valid 'email' is required.")
    _validate_password(pw_raw)

    user = db.create_user_with_password(email, _hash_password(pw_raw), name)
    if user is None:
        raise HTTPException(409, detail="An account with this email already exists.")

    ip, ua = _client_ip(request), request.headers.get("user-agent")
    token = _issue_session(user["id"], ip, ua)
    db.log_login_event(user["id"], email, "password", "signup", ip, ua)
    resp = JSONResponse({"user": _public_user(user)})
    _set_session_cookie(resp, token)
    return resp


@router.post("/auth/login")
async def login(request: Request):
    if not _auth_configured():
        return JSONResponse(status_code=503, content={"error": "Auth not configured"})
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, detail="Request body must be valid JSON.")
    if not isinstance(body, dict):
        raise HTTPException(400, detail="Request body must be a JSON object.")
    email_raw, pw_raw = body.get("email"), body.get("password")
    if not isinstance(email_raw, str) or not isinstance(pw_raw, str):
        raise HTTPException(400, detail="'email' and 'password' must be strings.")
    email = email_raw.strip().lower()
    if not email or not pw_raw:
        raise HTTPException(400, detail="'email' and 'password' are required.")

    ip, ua = _client_ip(request), request.headers.get("user-agent")
    wait = _throttle_wait(request, email)
    if wait:
        db.log_login_event(None, email, "password", "failed", ip, ua)
        raise HTTPException(
            429,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(wait)},
        )

    user = db.get_user_by_email(email)
    if user is not None and user.get("password_hash"):
        ok = _check_password(pw_raw, user["password_hash"])
    else:
        # Unknown email, Google-only account (password_hash IS NULL), or
        # legacy email-only user: identical generic 401, identical timing burn.
        _check_password(pw_raw, _DUMMY_HASH)
        ok = False
    if not ok:
        _record_failure(request, email)
        db.log_login_event(user["id"] if user else None, email, "password", "failed", ip, ua)
        raise HTTPException(401, detail="Invalid email or password")

    _clear_failures(request, email)
    token = _issue_session(user["id"], ip, ua)
    db.log_login_event(user["id"], email, "password", "login", ip, ua)
    resp = JSONResponse({"user": _public_user(user)})
    _set_session_cookie(resp, token)
    return resp


@router.post("/auth/logout")
async def logout(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    user = _session_user(request) if token else None
    if token:
        db.delete_session(_token_hash(token))
    # Opportunistic cleanup of expired rows on every logout.
    db.delete_expired_sessions(datetime.now(timezone.utc).isoformat())
    if user is not None:
        provider = "google" if (user.get("google_sub") and not user.get("password_hash")) else "password"
        db.log_login_event(user["id"], user["email"], provider, "logout",
                           _client_ip(request), request.headers.get("user-agent"))
    # Idempotent: 200 even with no valid session.
    resp = JSONResponse({"ok": True})
    _clear_session_cookie(resp)
    return resp


@router.get("/auth/me")
async def me(user: dict = Depends(require_user)):
    return {
        "user": _public_user(user),
        "keys": db.list_keys_by_user_id(user["id"]),  # prefix only, never key_hash
        "usage": db.usage_30d(user["id"]),            # last-30d totals from requests.cost_usd
    }


@router.get("/api/usage")
async def api_usage(user: dict = Depends(require_user), limit: int = 50):
    return {"usage": db.recent_usage_by_user_id(user["id"], limit)}


# ----- Google OAuth (manual, httpx — no authlib, no SessionMiddleware) -----

def _valid_next(next_path: str | None) -> str:
    """Open-redirect guard: honor only paths with a single leading '/'."""
    if next_path and next_path.startswith("/") and not next_path.startswith("//"):
        return next_path
    return "/keys"


@router.get("/auth/google")
async def google_start(next: str = ""):
    if not _google_configured():
        return JSONResponse(status_code=503, content={"error": "Google sign-in not configured"})
    if not _auth_configured():
        return JSONResponse(status_code=503, content={"error": "Auth not configured"})
    state = secrets.token_urlsafe(32)
    dest = _valid_next(next or None)
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    resp = RedirectResponse(
        "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params),
        status_code=302,
    )
    resp.set_cookie(
        OAUTH_STATE_COOKIE, f"{state}|{dest}",
        max_age=300, path="/", domain=COOKIE_DOMAIN,
        secure=True, httponly=True, samesite="lax",
    )
    return resp


@router.get("/auth/google/callback")
async def google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    if not _google_configured():
        return JSONResponse(status_code=503, content={"error": "Google sign-in not configured"})
    if not _auth_configured():
        return JSONResponse(status_code=503, content={"error": "Auth not configured"})

    def _fail_redirect(reason: str) -> RedirectResponse:
        r = RedirectResponse(f"{FRONTEND_BASE}/login?error={reason}", status_code=302)
        r.delete_cookie(OAUTH_STATE_COOKIE, path="/", domain=COOKIE_DOMAIN,
                        secure=True, httponly=True, samesite="lax")
        return r

    cookie_val = request.cookies.get(OAUTH_STATE_COOKIE, "")
    cookie_state, _, cookie_next = cookie_val.partition("|")
    if not state or not cookie_state or not hmac.compare_digest(state, cookie_state):
        r = JSONResponse(status_code=400, content={"detail": "Invalid or missing OAuth state."})
        r.delete_cookie(OAUTH_STATE_COOKIE, path="/", domain=COOKIE_DOMAIN,
                        secure=True, httponly=True, samesite="lax")
        return r
    dest = _valid_next(cookie_next or None)
    if error or not code:
        return _fail_redirect("google_access_denied" if error else "google_missing_code")

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            tok = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                },
            )
            tok.raise_for_status()
            access_token = tok.json().get("access_token", "")
            if not access_token:
                return _fail_redirect("google_exchange_failed")
            info = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            info.raise_for_status()
            profile = info.json()
        except (httpx.HTTPError, ValueError, KeyError):
            return _fail_redirect("google_exchange_failed")

    if profile.get("email_verified") is not True:
        return _fail_redirect("email_not_verified")
    email = (profile.get("email") or "").strip().lower()
    sub = profile.get("sub") or ""
    name = profile.get("name")
    picture = profile.get("picture")
    if not email or not sub:
        return _fail_redirect("google_profile_incomplete")

    ip, ua = _client_ip(request), request.headers.get("user-agent")
    # Upsert: google_sub match first, then link by email, else create.
    user = db.get_user_by_google_sub(sub)
    event_type = "login"
    if user is not None:
        db.update_google_profile(user["id"], name, picture)
        user = db.get_user_by_id(user["id"])
    else:
        user = db.get_user_by_email(email)
        if user is not None:
            db.link_google_account(user["id"], sub, name, picture)
            user = db.get_user_by_id(user["id"])
        else:
            wait = _signup_throttle_wait(request)
            if wait:
                raise HTTPException(
                    429,
                    detail="Too many signup attempts. Try again later.",
                    headers={"Retry-After": str(wait)},
                )
            user = db.create_google_user(email, sub, name, picture)
            event_type = "signup"

    token = _issue_session(user["id"], ip, ua)
    db.log_login_event(user["id"], email, "google", event_type, ip, ua)
    r = RedirectResponse(f"{FRONTEND_BASE}{dest}", status_code=302)
    r.delete_cookie(OAUTH_STATE_COOKIE, path="/", domain=COOKIE_DOMAIN,
                    secure=True, httponly=True, samesite="lax")
    _set_session_cookie(r, token)
    return r


# ----- dual-auth key management -----
# /internal/* stays admin-only and untouched; /api/keys is the browser path
# sharing the same db key functions (create_key / list_keys / revoke_key).

@router.post("/api/keys")
async def api_create_key(request: Request, actor: dict = Depends(resolve_actor)):
    try:
        body = await request.json()
        if not isinstance(body, dict):
            body = {}
    except Exception:
        body = {}
    if actor["type"] == "admin":
        email = (body.get("email") or "").strip().lower() if isinstance(body.get("email"), str) else ""
        name = (body.get("name") or "default").strip() if isinstance(body.get("name"), str) else "default"
        if "@" not in email:
            raise HTTPException(400, detail="A valid 'email' is required.")
        return db.create_key(email, name)
    user = actor["user"]
    if db.count_active_keys(user["id"]) >= MAX_ACTIVE_KEYS_PER_USER:
        raise HTTPException(
            409,
            detail=f"Maximum of {MAX_ACTIVE_KEYS_PER_USER} active keys per account. Revoke one first.",
        )
    name = body.get("name")
    name = name.strip() if isinstance(name, str) and name.strip() else "default"
    # user_id/email in the body is ignored — always the session user's key.
    return db.create_key(user["email"], name)


@router.get("/api/keys")
async def api_list_keys(actor: dict = Depends(resolve_actor), email: str = ""):
    if actor["type"] == "admin":
        e = email.strip().lower()
        if "@" not in e:
            raise HTTPException(400, detail="A valid 'email' query parameter is required.")
        return {"email": e, "keys": db.list_keys(e)}
    user = actor["user"]
    # Any email/user_id in the query string is ignored on the cookie path.
    return {"email": user["email"], "keys": db.list_keys_by_user_id(user["id"])}


@router.post("/api/keys/{key_id}/revoke")
async def api_revoke_key(key_id: int, actor: dict = Depends(resolve_actor)):
    if actor["type"] == "admin":
        if not db.revoke_key(key_id):
            raise HTTPException(404, detail=f"Key {key_id} not found or already revoked.")
        return {"id": key_id, "revoked": True}
    if not db.revoke_key_for_user(key_id, actor["user"]["id"]):
        # Same 404 whether the key doesn't exist, is revoked, or is someone
        # else's — no cross-user existence leak.
        raise HTTPException(404, detail=f"Key {key_id} not found or already revoked.")
    return {"id": key_id, "revoked": True}
