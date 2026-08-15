"""
luv13 Proxy Server (multi-tenant)
=================================
Sits between Cursor (or any OpenAI-compatible client) and Neuralwatt, fronting
it as the `api.luv13.com` product.

- Accepts requests using luv13-branded model slugs (luv13-*)
- Rewrites model names to Neuralwatt's actual model IDs
- Authenticates customers via hashed `sk-luv13-...` API keys (multi-tenant)
- Routes across a pool of NAMED upstream Neuralwatt accounts using real-time
  concurrency tracking: each account has a hard cap of 3 in-flight requests
  (Neuralwatt's measured concurrency limit). The router dispatches to the
  least-loaded account with a free slot; if every account is at cap the
  request queues and goes to the first account that frees a slot. A 429 is
  treated as "slots full" (a race), never as a penalty — the request retries
  on another free slot within ~200-500ms. Only genuine auth/budget errors
  (401/402/403) park an account for a longer period. Whichever account
  serves, the response always returns to the original customer.
- Tracks usage (input / output / cached tokens, cost, revenue) in SQLite, including
  which account ACTUALLY served each request (served_upstream_index)
- Exposes customer usage at GET /usage (branded-key auth)
- Exposes admin dashboards at /admin/* (ADMIN_TOKEN auth)
- /keys/generate is called by the luv13 website using a JWT session
- Runs on port 4000

Setup:
    pip install -r requirements.txt

Local run:
    python proxy.py

In Cursor, set:
    Base URL: http://localhost:4000/v1   (or https://api.luv13.com/v1)
    API Key:  a customer's sk-luv13-... key
    Model:    any name from MODEL_MAP below
"""

import os
import re
import json
import time
import hmac
import random
import queue
import hashlib
import secrets
import socket
import sqlite3
import string
import logging
import threading
from datetime import datetime, timedelta, timezone
from functools import wraps

import requests
import jwt as pyjwt
from flask import (Flask, request, jsonify, Response, stream_with_context, g,
                   make_response, redirect)
from flask_cors import CORS

# ── LOGGING ──────────────────────────────────────────────────────────────────
# Never log upstream keys, customer plaintext keys, JWT secrets, or admin tokens.
# This logger is configured to keep those out by construction: we only ever log
# key prefixes, ids, and counts — never the values themselves.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("luv13-proxy")
log.warning("logging initialized — upstream keys / customer keys are NEVER logged")

# ── CONFIG ───────────────────────────────────────────────────────────────────
NEURALWATT_BASE_URL = os.getenv("NEURALWATT_BASE_URL", "https://api.neuralwatt.com/v1")
PORT = int(os.getenv("PORT", "4000"))

# Only a CONNECT timeout (seconds). Streaming READ timeout is set below after
# STREAM_STALL_TIMEOUT is parsed — it must be finite so a dead upstream TCP
# (silent DROP, no FIN/RST) cannot block forever. See UPSTREAM_TIMEOUT.
CONNECT_TIMEOUT = float(os.getenv("PROXY_CONNECT_TIMEOUT", "15"))
# Placeholder; replaced after stall timeout is known.
UPSTREAM_TIMEOUT = (CONNECT_TIMEOUT, None)

# ── UPSTREAM ACCOUNT POOL ────────────────────────────────────────────────────
# Hardcoded, named Neuralwatt accounts (no .env dependency for these — keys live in
# code by request). Each account has a human NAME purely for identification in logs
# and the admin dashboards. The key strings themselves are NEVER logged, never echoed
# in responses/errors — only the account name and 1-based index are surfaced.
# Indexed 1-based in the api_keys table (upstream_key_index).
UPSTREAM_ACCOUNTS = [
    {"name": "TEST1", "key": "sk-REDACTED-PLACEHOLDER"},
    {"name": "TEST2", "key": "sk-REDACTED-PLACEHOLDER"},
    {"name": "TEST3", "key": "sk-REDACTED-PLACEHOLDER"},
    {"name": "TEST4", "key": "sk-REDACTED-PLACEHOLDER"},
    {"name": "TEST5", "key": "sk-REDACTED-PLACEHOLDER"},
    {"name": "TEST6", "key": "sk-REDACTED-PLACEHOLDER"},
    {"name": "TEST7", "key": "sk-REDACTED-PLACEHOLDER"},
    {"name": "TEST8", "key": "sk-REDACTED-PLACEHOLDER"},
    {"name": "TEST9", "key": "sk-REDACTED-PLACEHOLDER"},
    {"name": "TEST10", "key": "sk-REDACTED-PLACEHOLDER"},
]
UPSTREAM_KEYS = [a["key"] for a in UPSTREAM_ACCOUNTS]
# 1-based index -> human name (logs/admin only)
ACCOUNT_NAMES = {i + 1: a["name"] for i, a in enumerate(UPSTREAM_ACCOUNTS)}
NUM_UPSTREAM_KEYS = len(UPSTREAM_KEYS)


def account_name(idx: int) -> str:
    """Human name for a 1-based upstream index (for logs/admin only)."""
    return ACCOUNT_NAMES.get(idx, f"account-{idx}")


def mask_upstream_key(idx: int) -> str:
    """Masked upstream key for general display (e.g. 'sk-…last4').
    Used by the diagnostic capture stream, which never serializes full keys."""
    if not idx or idx < 1 or idx > len(UPSTREAM_KEYS):
        return "—"
    full = UPSTREAM_KEYS[idx - 1]
    return f"{full[:3]}…{full[-4:]}" if len(full) > 7 else "sk-…"


def upstream_key_full(idx: int) -> str:
    """Full upstream key value. Admin-only: callers must be behind @require_admin.
    The live capture stream (proxy.py:~860) must never call this — it must use
    mask_upstream_key() because captures are written to disk as JSONL."""
    if not idx or idx < 1 or idx > len(UPSTREAM_KEYS):
        return ""
    return UPSTREAM_KEYS[idx - 1]


# ── CONCURRENCY-SLOT ROUTER (replaces time-based cooldowns) ──────────────────
# Measured NeuralWatt behavior (confirmed by direct probing):
#   * Each account allows exactly 3 concurrent in-flight requests.
#   * A 429 means "3/3 slots in use" RIGHT NOW — not a penalty period. The
#     server accepts a new request the moment an in-flight request finishes
#     (measured clear-after-idle ~0.001s). There is NO server-side cooldown.
#   * The Retry-After header is always "1" and carries no timing signal — it
#     is deliberately ignored.
# So instead of blacklisting an account for a fixed duration after a 429, the
# proxy tracks in-flight requests per account in real time and only dispatches
# to an account with a free slot (< MAX_CONCURRENCY_PER_ACCOUNT in flight).
# If every account is at cap, the request queues and dispatches to the FIRST
# account that frees a slot.
#
# A 429 can still slip through (a slot the server hasn't released yet, or a
# competing consumer of the same account). When it does: log it, resync the
# local counter (phantom slots that expire after PHANTOM_SLOT_TTL), and retry
# on any account with a free slot after a short 200-500ms jitter. Never
# blacklist.
#
# Only genuine auth/budget errors (401/402/403) park an account, for
# BUDGET_COOLDOWN seconds. Transient 5xx/connection errors pause an account
# for ERROR_PAUSE (~1s) purely to avoid hammering a broken host in a tight
# loop — near-zero, not a cooldown.
#
# NOTE: slot state is in-process memory. The proxy MUST run as a single
# process (gunicorn -w 1; the gevent worker handles concurrency). Multiple
# workers would each think they have 3 slots per account and oversubscribe.
MAX_CONCURRENCY_PER_ACCOUNT = int(os.getenv("PROXY_ACCOUNT_MAX_CONCURRENCY", "3"))
BUDGET_COOLDOWN = float(os.getenv("PROXY_BUDGET_COOLDOWN", "300"))   # after auth/budget err
ERROR_PAUSE = float(os.getenv("PROXY_ERROR_PAUSE", "1.0"))  # 5xx/conn hiccup breather
RETRY_429_WAIT_MIN = float(os.getenv("PROXY_429_RETRY_WAIT_MIN", "0.2"))
RETRY_429_WAIT_MAX = float(os.getenv("PROXY_429_RETRY_WAIT_MAX", "0.5"))
# How long a phantom slot (counter-resync after an unexpected 429) lives.
PHANTOM_SLOT_TTL = float(os.getenv("PROXY_429_SYNC_TTL_MS", "1000")) / 1000.0
# Give up and forward the 429 to the client after this many surprise 429
# retries on one request (safety valve — should never trigger in practice).
MAX_429_RETRIES = int(os.getenv("PROXY_MAX_429_RETRIES", "40"))
RETRY_STATUSES = {429, 500, 502, 503, 504}   # retryable -> failover to another slot
BUDGET_STATUSES = {401, 402, 403}            # auth/budget exhausted -> park account
# How often the background sampler logs per-account in-flight counts.
INFLIGHT_LOG_INTERVAL = float(os.getenv("PROXY_INFLIGHT_LOG_INTERVAL", "5"))


def _env_flag(name: str, default: str = "0") -> bool:
    """True unless value is a common falsey string (0/false/no/off)."""
    return os.getenv(name, default).strip().lower() not in ("0", "false", "no", "off")


# Soft cache affinity: prefer last-served account only as a least-loaded tie-break.
CACHE_AFFINITY = _env_flag("PROXY_CACHE_AFFINITY", "1")
# Delayed hedge (streaming only): second account if primary is slow to first token.
HEDGE_ENABLED = _env_flag("PROXY_HEDGE_ENABLED", "0")
try:
    HEDGE_AFTER_MS = int(os.getenv("PROXY_HEDGE_AFTER_MS", "2500"))
except ValueError:
    log.warning("PROXY_HEDGE_AFTER_MS=%r is not an integer; using 2500",
                os.getenv("PROXY_HEDGE_AFTER_MS"))
    HEDGE_AFTER_MS = 2500
if HEDGE_AFTER_MS < 0:
    log.warning("PROXY_HEDGE_AFTER_MS=%d must be >= 0; using 2500", HEDGE_AFTER_MS)
    HEDGE_AFTER_MS = 2500

# Shared HTTP session so upstream calls reuse warm TCP/TLS connections instead
# of handshaking on every requests.post(). Compatible with gevent (-w 1):
# monkey-patching covers the socket/ssl layer urllib3 uses underneath.
_session = requests.Session()
_adapter = requests.adapters.HTTPAdapter(
    pool_connections=NUM_UPSTREAM_KEYS,
    pool_maxsize=NUM_UPSTREAM_KEYS * MAX_CONCURRENCY_PER_ACCOUNT,  # 30
    max_retries=0,  # retries are handled by the slot router
)
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)

# Single-account isolation for capacity tests. When set, the slot router only
# ever acquires/dispatches on that one account — no failover into the rest of
# the pool. Accepts PROXY_ISOLATE_INDEX=1..N or PROXY_ISOLATE_ACCOUNT=TEST1.
def _resolve_isolate_idx() -> int:
    raw_idx = os.getenv("PROXY_ISOLATE_INDEX", "").strip()
    if raw_idx:
        try:
            idx = int(raw_idx)
        except ValueError as e:
            raise ValueError(
                f"PROXY_ISOLATE_INDEX={raw_idx!r} must be an integer "
                f"1..{NUM_UPSTREAM_KEYS}"
            ) from e
        if idx < 1 or idx > NUM_UPSTREAM_KEYS:
            raise ValueError(
                f"PROXY_ISOLATE_INDEX={idx} out of range 1..{NUM_UPSTREAM_KEYS}"
            )
        return idx
    raw_name = os.getenv("PROXY_ISOLATE_ACCOUNT", "").strip()
    if not raw_name:
        return 0
    for i, acct in enumerate(UPSTREAM_ACCOUNTS, start=1):
        if acct["name"].upper() == raw_name.upper():
            return i
    raise ValueError(
        f"PROXY_ISOLATE_ACCOUNT={raw_name!r} not in "
        + ", ".join(a["name"] for a in UPSTREAM_ACCOUNTS)
    )


ISOLATE_IDX = _resolve_isolate_idx()
if ISOLATE_IDX:
    log.warning(
        "ISOLATE MODE: only account '%s' (idx %d) — no cross-account failover",
        account_name(ISOLATE_IDX), ISOLATE_IDX,
    )

# Queue wait: when ALL accounts are at their concurrency cap, the proxy waits
# for a slot to free instead of failing fast with 503. 0 = wait indefinitely
# (the proxy stays open, sending SSE heartbeats for streaming, until a slot
# frees). Any positive value = max seconds to wait before giving up and
# returning 503.
QUEUE_MAX_WAIT = float(os.getenv("PROXY_QUEUE_MAX_WAIT", "0"))    # 0 = unlimited

# ── STREAMING HEARTBEAT + STALL FAILOVER ─────────────────────────────────────
# Heartbeat: send SSE comment lines (": keepalive\n\n") every N seconds on ANY
# inter-chunk gap — before AND after the first upstream token. GLM-5.2 (and
# similar reasoning models) can emit an early role/metadata chunk then go fully
# silent during a long thinking phase; if we only keepalive pre-first-token,
# Cursor's idle-connection watchdog sees zero bytes and hangs the UI spinner
# even though the upstream slot is still healthy.
HEARTBEAT_INTERVAL = float(os.getenv("PROXY_HEARTBEAT_INTERVAL", "5"))  # seconds

# Stall: if no SSE chunks arrive for N seconds *during* a stream (after the first
# token), the upstream is considered stalled. The connection is closed, the slot
# is released, and the request is retried on another account with a free slot.
#
# Default 900s (15 min): keepalives cover Cursor's idle watchdog during long
# reasoning gaps; STREAM_STALL still bounds how long we hold a slot if
# upstream truly dies mid-stream. This does NOT replace keepalives.
# `STREAM_STALL_TIMEOUT_MS` mirrors the deployment tool used for the queue-wait
# change at PROXY_QUEUE_MAX_WAIT: a *_MS env var with a safe integer parser.
# Validated strictly — any non-integer / non-positive value logs a warning and
# falls back to the default. `PROXY_STREAM_STALL_TIMEOUT` (seconds, float)
# remains as a legacy override; the *_MS var takes precedence if both are set.
def _parse_stall_timeout_ms() -> float:
    """Parse STREAM_STALL_TIMEOUT_MS into seconds (float), with safe fallback.

    Accepts the legacy PROXY_STREAM_STALL_TIMEOUT (seconds, float) as a fallback.
    Returns the effective stall timeout in seconds. Never raises.
    """
    raw_ms = os.getenv("STREAM_STALL_TIMEOUT_MS")
    if raw_ms is not None and raw_ms.strip():
        try:
            ms = int(raw_ms)
        except (TypeError, ValueError):
            log.warning(
                "STREAM_STALL_TIMEOUT_MS=%r is not a valid integer; "
                "falling back to default 900000ms", raw_ms,
            )
            return 900.0
        if ms <= 0:
            log.warning(
                "STREAM_STALL_TIMEOUT_MS=%d must be positive; "
                "falling back to default 900000ms", ms,
            )
            return 900.0
        return ms / 1000.0
    # Legacy seconds-based override (float, tolerated).
    legacy = os.getenv("PROXY_STREAM_STALL_TIMEOUT")
    if legacy is not None and legacy.strip():
        try:
            v = float(legacy)
            if v > 0:
                return v
            log.warning(
                "PROXY_STREAM_STALL_TIMEOUT=%r must be positive; "
                "falling back to default 900.0s", legacy,
            )
        except (TypeError, ValueError):
            log.warning(
                "PROXY_STREAM_STALL_TIMEOUT=%r is not a valid float; "
                "falling back to default 900.0s", legacy,
            )
    return 900.0


STREAM_STALL_TIMEOUT = _parse_stall_timeout_ms()   # seconds
MAX_STREAM_RETRIES = int(os.getenv("PROXY_MAX_STREAM_RETRIES", "50"))        # mid-stream retries — high so a saturated pool grinds through transient errors rather than 503ing the client

# Streaming upstream read timeout (seconds). MUST be finite: under gevent -w 1,
# an unbounded blocking recv on a dead peer can freeze the entire worker
# (admin/health included). Default = STREAM_STALL_TIMEOUT so the stall
# detector and the socket timeout agree; override with PROXY_STREAM_READ_TIMEOUT.
STREAM_READ_TIMEOUT = float(os.getenv(
    "PROXY_STREAM_READ_TIMEOUT",
    str(STREAM_STALL_TIMEOUT),
))
if STREAM_READ_TIMEOUT <= 0:
    log.warning("PROXY_STREAM_READ_TIMEOUT=%r must be positive; using stall timeout %.1fs",
                os.getenv("PROXY_STREAM_READ_TIMEOUT"), STREAM_STALL_TIMEOUT)
    STREAM_READ_TIMEOUT = STREAM_STALL_TIMEOUT
UPSTREAM_TIMEOUT = (CONNECT_TIMEOUT, STREAM_READ_TIMEOUT)
log.info("upstream timeouts: connect=%.1fs stream_read=%.1fs stall=%.1fs heartbeat=%.1fs",
         CONNECT_TIMEOUT, STREAM_READ_TIMEOUT, STREAM_STALL_TIMEOUT, HEARTBEAT_INTERVAL)

# Overload protection: if an active upstream key takes longer than this to emit
# its FIRST token (TTFB), it is treated as overloaded — instantly demoted
# (active-reserve rotation) and the request is retried on the next active key.
# This is faster than waiting the full STREAM_STALL_TIMEOUT, so Cursor stops
# seeing "taking longer than expected" while a saturated key sits on the prompt.
# Set PROXY_FIRST_TOKEN_TIMEOUT_MS=0 to disable (fall back to full stall timeout).
def _parse_first_token_timeout_ms() -> float:
    raw = os.getenv("PROXY_FIRST_TOKEN_TIMEOUT_MS", "10000")
    try:
        ms = int(raw)
    except (TypeError, ValueError):
        log.warning("PROXY_FIRST_TOKEN_TIMEOUT_MS=%r is not a valid integer; "
                    "falling back to default 10000ms", raw)
        return 10.0
    if ms < 0:
        log.warning("PROXY_FIRST_TOKEN_TIMEOUT_MS=%d must be >= 0; "
                    "falling back to default 10000ms", ms)
        return 10.0
    if ms == 0:
        return 0.0  # disabled — full stall timeout governs
    return ms / 1000.0

FIRST_TOKEN_TIMEOUT = _parse_first_token_timeout_ms()

# Post-content idle timeout: if no SSE chunks arrive for N seconds *after* the
# first content/tool_call token has been forwarded, the upstream is considered
# dead mid-stream. Unlike the pre-content stall timeout (900s), this is tighter
# because mid-generation silence is the death signature — healthy models don't
# go silent for 30s+ after they've started streaming arguments. Pre-content
# thinking pauses are still protected by the generous STREAM_STALL_TIMEOUT.
# Set PROXY_POST_CONTENT_IDLE_TIMEOUT_MS=0 to disable.
def _parse_post_content_idle_timeout_ms() -> float:
    raw_ms = os.getenv("PROXY_POST_CONTENT_IDLE_TIMEOUT_MS")
    if raw_ms is not None and raw_ms.strip():
        try:
            ms = int(raw_ms)
        except (TypeError, ValueError):
            log.warning(
                "PROXY_POST_CONTENT_IDLE_TIMEOUT_MS=%r is not a valid integer; "
                "falling back to default 35000ms", raw_ms,
            )
            return 35.0
        if ms <= 0:
            return 0.0  # 0 = disabled
        return ms / 1000.0
    return 35.0

POST_CONTENT_IDLE_TIMEOUT = _parse_post_content_idle_timeout_ms()  # seconds
log.info("post-content idle timeout: %.1fs (0=disabled)", POST_CONTENT_IDLE_TIMEOUT)
# Non-streaming requests get a read timeout so an overloaded upstream can't
# hang the request forever. Streaming uses STREAM_READ_TIMEOUT (finite) plus
# heartbeat + stall detection on the native reader thread.
NONSTREAM_READ_TIMEOUT = float(os.getenv(
    "PROXY_NONSTREAM_READ_TIMEOUT",
    str(int(FIRST_TOKEN_TIMEOUT if FIRST_TOKEN_TIMEOUT > 0 else 30)),
))
UPSTREAM_TIMEOUT_NONSTREAM = (CONNECT_TIMEOUT, NONSTREAM_READ_TIMEOUT)

# ── IN-FLIGHT SLOT STATE ─────────────────────────────────────────────────────
# All slot state lives under one lock + condition. `_inflight[idx]` counts OUR
# live requests on that account. `_phantom_slots[idx]` holds expiry epochs for
# slots the server evidently still considers occupied even though our counter
# said free (detected via an unexpected 429) — each phantom blocks one slot
# until it expires (PHANTOM_SLOT_TTL). `_parked_until[idx]` sidelines an
# account after a genuine auth/budget error; `_paused_until[idx]` is a
# sub-second breather after a 5xx/connection error.
_slot_lock = threading.Lock()
_slot_freed = threading.Condition(_slot_lock)
_inflight = {i: 0 for i in range(1, NUM_UPSTREAM_KEYS + 1)}
_phantom_slots = {i: [] for i in range(1, NUM_UPSTREAM_KEYS + 1)}
_parked_until = {i: 0.0 for i in range(1, NUM_UPSTREAM_KEYS + 1)}
_paused_until = {i: 0.0 for i in range(1, NUM_UPSTREAM_KEYS + 1)}
_queue_waiting = 0              # requests currently blocked waiting for any slot

# Rolling counters for the sampler log + /admin/inflight (guarded by _slot_lock).
_slot_stats = {
    "dispatches": 0,
    "unexpected_429s": 0,
    "queue_waits": 0,
    "queue_wait_total_s": 0.0,
    "queue_wait_max_s": 0.0,
    "peak_inflight": {i: 0 for i in range(1, NUM_UPSTREAM_KEYS + 1)},
    "affinity_hits": 0,
    "affinity_misses": 0,
    "hedges_fired": 0,
    "hedges_won_primary": 0,
    "hedges_won_hedge": 0,
}

# Soft affinity memory: api_key_id -> last successfully served upstream idx.
# Cold start is fine (no DB seed). Failures/disconnects do not clear entries.
_last_served: dict[int, int] = {}

log.info("router: concurrency-slots (%d accounts x %d slots = %d max in-flight); "
         "cache_affinity=%s hedge=%s (after %dms)",
         NUM_UPSTREAM_KEYS, MAX_CONCURRENCY_PER_ACCOUNT,
         NUM_UPSTREAM_KEYS * MAX_CONCURRENCY_PER_ACCOUNT,
         "on" if CACHE_AFFINITY else "off",
         "on" if HEDGE_ENABLED else "off",
         HEDGE_AFTER_MS)


def _remember_served(api_key_id: int, idx: int) -> None:
    """Record that api_key_id was successfully served by upstream idx."""
    if not api_key_id or not idx:
        return
    with _slot_lock:
        _last_served[api_key_id] = idx


def _lookup_prefer_idx(api_key_id: int) -> int | None:
    """Return last-served idx for affinity tie-break, or None if disabled/unknown."""
    if not CACHE_AFFINITY or not api_key_id:
        return None
    with _slot_lock:
        return _last_served.get(api_key_id)


def _prune_phantoms_locked(idx: int, now: float) -> int:
    """Drop expired phantom slots for idx; return the live phantom count."""
    live = [t for t in _phantom_slots[idx] if t > now]
    _phantom_slots[idx] = live
    return len(live)


def _effective_inflight_locked(idx: int, now: float) -> int:
    return _inflight[idx] + _prune_phantoms_locked(idx, now)


def _slot_available_locked(idx: int, now: float) -> bool:
    return (bool(UPSTREAM_KEYS[idx - 1])
            and _parked_until[idx] <= now
            and _paused_until[idx] <= now
            and _effective_inflight_locked(idx, now) < MAX_CONCURRENCY_PER_ACCOUNT)


def _try_acquire_slot_locked(now: float, prefer_idx: int | None = None,
                             exclude_idx: int | None = None) -> int:
    """Pick the least-loaded account with a free slot (ties -> lowest idx).

    Soft cache affinity: if prefer_idx is free AND its effective load equals
    the minimum load among free accounts, prefer it (tie-break only — never
    override a busier sticky account for an emptier one).

    exclude_idx: skip this account (used by delayed hedge to pick a second).
    Increments the chosen in-flight counter and returns the idx, or 0 if every
    eligible account is at cap / parked. In isolate mode, only ISOLATE_IDX
    is eligible.
    """
    best, best_load = 0, None
    prefer_load = None
    candidates = (
        [ISOLATE_IDX] if ISOLATE_IDX
        else range(1, NUM_UPSTREAM_KEYS + 1)
    )
    for i in candidates:
        if exclude_idx is not None and i == exclude_idx:
            continue
        if not _slot_available_locked(i, now):
            continue
        load = _effective_inflight_locked(i, now)
        if prefer_idx is not None and i == prefer_idx:
            prefer_load = load
        if best_load is None or load < best_load:
            best, best_load = i, load
    if best and prefer_idx and CACHE_AFFINITY:
        if prefer_load is not None and prefer_load == best_load:
            best = prefer_idx
            _slot_stats["affinity_hits"] += 1
        else:
            _slot_stats["affinity_misses"] += 1
    if best:
        _inflight[best] += 1
        _slot_stats["dispatches"] += 1
        if _inflight[best] > _slot_stats["peak_inflight"][best]:
            _slot_stats["peak_inflight"][best] = _inflight[best]
    return best


def try_acquire_slot(prefer_idx: int | None = None,
                     exclude_idx: int | None = None) -> int:
    """Non-blocking: acquire a slot on the least-loaded free account, or 0."""
    with _slot_lock:
        return _try_acquire_slot_locked(
            time.time(), prefer_idx=prefer_idx, exclude_idx=exclude_idx)


def wait_for_slot(timeout: float) -> None:
    """Block up to `timeout` seconds for any slot-freed notification. Used by
    the streaming generator between try_acquire_slot() attempts so it can
    yield heartbeats while queued."""
    global _queue_waiting
    with _slot_freed:
        _queue_waiting += 1
        try:
            _slot_freed.wait(timeout)
        finally:
            _queue_waiting -= 1


def acquire_slot(max_wait: float | None, prefer_idx: int | None = None) -> int:
    """Blocking acquire for the non-streaming path. Waits until a slot frees
    (first account to free a slot wins). max_wait=None waits forever;
    otherwise gives up after max_wait seconds and returns 0."""
    global _queue_waiting
    start = time.time()
    deadline = None if max_wait is None else start + max_wait
    with _slot_freed:
        idx = _try_acquire_slot_locked(start, prefer_idx=prefer_idx)
        if idx:
            return idx
        _queue_waiting += 1
        try:
            while True:
                now = time.time()
                if deadline is not None and now >= deadline:
                    return 0
                # Short slices so pause/park/phantom expiry is noticed even
                # without a notify.
                remaining = None if deadline is None else deadline - now
                slice_s = 0.25 if remaining is None else min(0.25, remaining)
                _slot_freed.wait(slice_s)
                idx = _try_acquire_slot_locked(time.time(), prefer_idx=prefer_idx)
                if idx:
                    _note_queue_wait_locked(time.time() - start)
                    return idx
        finally:
            _queue_waiting -= 1


def release_slot(idx: int) -> None:
    """Decrement idx's in-flight counter (request finished — success OR
    failure) and wake anyone queued for a slot."""
    with _slot_freed:
        if _inflight[idx] > 0:
            _inflight[idx] -= 1
        else:  # defensive: never let the counter go negative / drift
            log.error("release_slot(%d) with counter already 0 — counter drift?", idx)
        _slot_freed.notify_all()


def _note_queue_wait_locked(waited_s: float) -> None:
    _slot_stats["queue_waits"] += 1
    _slot_stats["queue_wait_total_s"] += waited_s
    if waited_s > _slot_stats["queue_wait_max_s"]:
        _slot_stats["queue_wait_max_s"] = waited_s


def note_queue_wait(waited_s: float) -> None:
    with _slot_lock:
        _note_queue_wait_locked(waited_s)


def note_unexpected_429(idx: int) -> None:
    """A 429 slipped through even though our counter said a slot was free —
    either the server hadn't released a just-finished request yet, or someone
    else is using this account. Resync: add phantom slots so our effective
    count reads 3/3 for PHANTOM_SLOT_TTL. Do NOT blacklist."""
    with _slot_lock:
        now = time.time()
        _slot_stats["unexpected_429s"] += 1
        # The caller still holds its local slot on idx, but the server
        # REJECTED that request — it occupies no server slot. So once the
        # caller releases, the account should read exactly full (3/3):
        # phantoms needed = cap - (effective - 1).
        deficit = (MAX_CONCURRENCY_PER_ACCOUNT
                   - _effective_inflight_locked(idx, now) + 1)
        for _ in range(max(deficit, 1)):
            _phantom_slots[idx].append(now + PHANTOM_SLOT_TTL)
    record_event(idx, "error_429", http_status=429,
                 message="unexpected 429 (slots full server-side); "
                         f"counter resynced for {PHANTOM_SLOT_TTL * 1000:.0f}ms, no blacklist")


def park_account(idx: int, seconds: float, *, reason: str,
                 http_status: int | None = None) -> None:
    """Sideline an account after a genuine auth/budget error (401/402/403).
    This is the ONLY long-duration removal left — never used for 429s."""
    with _slot_lock:
        _parked_until[idx] = max(_parked_until[idx], time.time() + seconds)
    ev_type = ("error_budget" if http_status in BUDGET_STATUSES else "park_start")
    record_event(idx, ev_type, http_status=http_status,
                 message=f"{reason}; parked {seconds:.0f}s")


def pause_account(idx: int, seconds: float, *, reason: str,
                  http_status: int | None = None,
                  event_type: str | None = None) -> None:
    """Give an account a sub-second/short breather after a 5xx or connection
    error so a broken host isn't hammered in a tight loop. Not a cooldown."""
    with _slot_lock:
        _paused_until[idx] = max(_paused_until[idx], time.time() + seconds)
    if event_type is None:
        event_type = "error_5xx" if http_status else "error_conn"
    record_event(idx, event_type, http_status=http_status,
                 message=f"{reason}; paused {seconds:.1f}s")


def _park_remaining(idx: int) -> float:
    with _slot_lock:
        return max(0.0, _parked_until[idx] - time.time())


def inflight_snapshot() -> dict:
    """Point-in-time view of slot state for logs + /admin/inflight."""
    with _slot_lock:
        now = time.time()
        accounts = []
        for i in range(1, NUM_UPSTREAM_KEYS + 1):
            phantoms = _prune_phantoms_locked(i, now)
            accounts.append({
                "upstream_key_index": i,
                "account_name": account_name(i),
                "in_flight": _inflight[i],
                "phantom_slots": phantoms,
                "max_concurrency": MAX_CONCURRENCY_PER_ACCOUNT,
                "free_slots": max(
                    0, MAX_CONCURRENCY_PER_ACCOUNT - _inflight[i] - phantoms),
                "parked_s": round(max(0.0, _parked_until[i] - now), 1),
                "paused_s": round(max(0.0, _paused_until[i] - now), 2),
                "peak_in_flight": _slot_stats["peak_inflight"][i],
            })
        waits = _slot_stats["queue_waits"]
        return {
            "timestamp": now,
            "accounts": accounts,
            "total_in_flight": sum(_inflight.values()),
            "queue_waiting": _queue_waiting,
            "available_accounts": sum(
                1 for i in range(1, NUM_UPSTREAM_KEYS + 1)
                if _slot_available_locked(i, now)),
            "stats": {
                "dispatches": _slot_stats["dispatches"],
                "unexpected_429s": _slot_stats["unexpected_429s"],
                "queue_waits": waits,
                "queue_wait_avg_s": round(
                    _slot_stats["queue_wait_total_s"] / waits, 3) if waits else 0.0,
                "queue_wait_max_s": round(_slot_stats["queue_wait_max_s"], 3),
                "affinity_hits": _slot_stats["affinity_hits"],
                "affinity_misses": _slot_stats["affinity_misses"],
                "hedges_fired": _slot_stats["hedges_fired"],
                "hedges_won_primary": _slot_stats["hedges_won_primary"],
                "hedges_won_hedge": _slot_stats["hedges_won_hedge"],
                "cache_affinity": CACHE_AFFINITY,
                "hedge_enabled": HEDGE_ENABLED,
                "hedge_after_ms": HEDGE_AFTER_MS,
            },
        }


def _inflight_sampler() -> None:
    """Background thread: log per-account in-flight counts every
    INFLIGHT_LOG_INTERVAL seconds (only while there's activity), so we can
    verify slots never exceed 3 and queue waits stay low."""
    was_active = False
    while True:
        time.sleep(INFLIGHT_LOG_INTERVAL)
        try:
            snap = inflight_snapshot()
            active = snap["total_in_flight"] > 0 or snap["queue_waiting"] > 0
            if not active and not was_active:
                continue  # stay quiet while idle
            was_active = active
            per_acct = " ".join(
                f"{a['account_name']}={a['in_flight']}/{a['max_concurrency']}"
                + (f"+{a['phantom_slots']}ph" if a["phantom_slots"] else "")
                for a in snap["accounts"])
            s = snap["stats"]
            log.info("inflight %s | total=%d queued=%d avail_accts=%d | "
                     "429s=%d qwaits=%d avg=%.2fs max=%.2fs",
                     per_acct, snap["total_in_flight"], snap["queue_waiting"],
                     snap["available_accounts"], s["unexpected_429s"],
                     s["queue_waits"], s["queue_wait_avg_s"], s["queue_wait_max_s"])
        except Exception:
            log.exception("inflight sampler tick failed")


threading.Thread(target=_inflight_sampler, daemon=True,
                 name="inflight-sampler").start()


def record_event(upstream_key_index, event_type: str, *,
                 http_status: int | None = None, message: str = "") -> None:
    """Persist an event row. Safe from any thread — opens its own short-lived
    SQLite connection so it can't collide with the per-request `g.db`.

    event_type is one of: error_429 (unexpected 429, counter resync — NOT a
    blacklist), error_budget, park_start, error_5xx, error_conn, error_stall,
    error_overload, error_timeout, queue_wait, info.
    """
    try:
        name = account_name(upstream_key_index) if upstream_key_index else None
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH, isolation_level=None,
                               check_same_thread=False, timeout=5)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=5000")
            conn.execute(
                """INSERT INTO events
                   (timestamp, upstream_key_index, account_name,
                    event_type, http_status, message)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (datetime.now(timezone.utc).isoformat(),
                 upstream_key_index, name, event_type, http_status, message),
            )
            # Bounded retention.
            conn.execute(
                "DELETE FROM events WHERE id NOT IN "
                "(SELECT id FROM events ORDER BY id DESC LIMIT 5000)"
            )
        finally:
            conn.close()
    except Exception as e:  # never let logging break the request path
        log.warning("record_event failed: %s", e)


def record_stream_outcome(upstream_key_index, outcome: str, *,
                          model: str | None = None,
                          finish_reason: str | None = None,
                          duration_ms: int | None = None,
                          message: str = "") -> None:
    """Persist one stream outcome row. Same pattern as record_event() —
    opens its own short-lived connection so it's safe from any thread.
    One row per completed stream; bounded retention (5000 rows)."""
    try:
        name = account_name(upstream_key_index) if upstream_key_index else None
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH, isolation_level=None,
                               check_same_thread=False, timeout=5)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=5000")
            conn.execute(
                """INSERT INTO stream_outcomes
                   (timestamp, upstream_key_index, account_name, model,
                    outcome, finish_reason, duration_ms, message)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (datetime.now(timezone.utc).isoformat(),
                 upstream_key_index, name, model, outcome,
                 finish_reason, duration_ms, message[:600]),
            )
            # Bounded retention (same policy as events).
            conn.execute(
                "DELETE FROM stream_outcomes WHERE id NOT IN "
                "(SELECT id FROM stream_outcomes ORDER BY id DESC LIMIT 5000)"
            )
        finally:
            conn.close()
    except Exception as e:
        log.warning("record_stream_outcome failed: %s", e)


def post_upstream(body, prefer_idx: int | None = None):
    """Send a NON-STREAMING request to Neuralwatt. Returns
    (response_or_None, used_idx).

    Acquires a concurrency slot on the least-loaded account (queueing until
    one frees if all 10 accounts are at 3/3), sends the request, and releases
    the slot when the response has been fully read — success OR failure.

    prefer_idx: soft cache-affinity tie-break (last-served account).

    Error handling (no time-based cooldowns):
      - unexpected 429  -> resync counter (phantom slots), retry on any free
                           slot after a 200-500ms jitter; never blacklist
      - 5xx/conn error  -> ~1s breather for that account, retry elsewhere
      - 401/402/403     -> park the account for BUDGET_COOLDOWN (real budget
                           problem, not a rate limit)
    """
    queue_deadline = None if QUEUE_MAX_WAIT <= 0 else time.time() + QUEUE_MAX_WAIT
    surprise_429s = 0
    last_resp, last_idx = None, 0
    while True:
        max_wait = None
        if queue_deadline is not None:
            max_wait = queue_deadline - time.time()
            if max_wait <= 0:
                return last_resp, last_idx
        idx = acquire_slot(max_wait, prefer_idx=prefer_idx)
        if idx == 0:
            return last_resp, last_idx        # bounded queue wait exhausted
        headers = {
            "Authorization": f"Bearer {UPSTREAM_KEYS[idx - 1]}",
            "Content-Type": "application/json",
        }
        try:
            try:
                resp = _session.post(
                    f"{NEURALWATT_BASE_URL}/chat/completions",
                    headers=headers, json=body, stream=False,
                    timeout=UPSTREAM_TIMEOUT_NONSTREAM,
                )
            except requests.exceptions.ReadTimeout:
                pause_account(idx, ERROR_PAUSE, reason="read timeout",
                              event_type="error_timeout")
                last_idx = idx
                log.warning("account '%s' (idx %d) read timeout; retrying on another slot",
                            account_name(idx), idx)
                continue
            except requests.exceptions.RequestException as e:
                pause_account(idx, ERROR_PAUSE,
                              reason=f"conn error: {type(e).__name__}")
                last_idx = idx
                log.warning("account '%s' (idx %d) connection error (%s); retrying on another slot",
                            account_name(idx), idx, type(e).__name__)
                continue
            code = resp.status_code
            if code == 429:
                # Slots full server-side (race / external consumer). Resync the
                # local counter, then retry on any free slot — NO blacklist.
                last_resp, last_idx = resp, idx
                surprise_429s += 1
                note_unexpected_429(idx)
                log.warning("account '%s' (idx %d) unexpected 429 (%d this request); "
                            "counter resynced, retrying in %d-%dms",
                            account_name(idx), idx, surprise_429s,
                            int(RETRY_429_WAIT_MIN * 1000), int(RETRY_429_WAIT_MAX * 1000))
                if surprise_429s >= MAX_429_RETRIES:
                    return resp, idx          # safety valve
                time.sleep(random.uniform(RETRY_429_WAIT_MIN, RETRY_429_WAIT_MAX))
                continue
            if code in BUDGET_STATUSES:
                last_resp, last_idx = resp, idx
                park_account(idx, BUDGET_COOLDOWN,
                             reason=f"auth/budget status {code}", http_status=code)
                log.warning("account '%s' (idx %d) auth/budget status %d; parked %ss",
                            account_name(idx), idx, code, BUDGET_COOLDOWN)
                continue
            if code in RETRY_STATUSES:        # 5xx family (429 handled above)
                last_resp, last_idx = resp, idx
                pause_account(idx, ERROR_PAUSE,
                              reason=f"upstream {code}", http_status=code)
                log.warning("account '%s' (idx %d) status %d; paused %.1fs, retrying elsewhere",
                            account_name(idx), idx, code, ERROR_PAUSE)
                continue
            return resp, idx                  # success (or non-retryable 4xx)
        finally:
            # stream=False means the body is fully read by the time
            # _session.post returns — the upstream request is complete, so the
            # slot frees here on every path (success, error, or exception).
            release_slot(idx)


# ── STREAMING EVENT TYPES ─────────────────────────────────────────────────────
# Every value yielded by stream_upstream() is an instance of one of these. The
# caller does `match event:` over them, so adding a new event type is safe —
# type-checkers (and runtime, with a `case _:` arm) will surface any caller that
# forgets to handle the new kind. This replaces the old positional (kind, data)
# tuple convention, which crashed if a yield arity didn't match the unpack.
class StreamEvent:
    """Base. Carries no payload — subclasses add their own fields."""
    __slots__ = ()


class ChunkEvent(StreamEvent):
    """A raw SSE byte chunk from upstream. Forward to the client verbatim."""
    __slots__ = ("data",)

    def __init__(self, data: bytes):
        self.data = data


class AccountEvent(StreamEvent):
    """Which upstream account idx is serving this stream (for usage tracking)."""
    __slots__ = ("idx",)

    def __init__(self, idx: int):
        self.idx = idx


class HeartbeatEvent(StreamEvent):
    """Idle keepalive — emit an SSE comment on any inter-chunk gap."""
    __slots__ = ()


class DoneEvent(StreamEvent):
    """Normal end of stream. Carries the accumulated usage state."""
    __slots__ = ("state",)

    def __init__(self, state: dict):
        self.state = state


class ErrorEvent(StreamEvent):
    """Terminal error. Carries a human-readable message and optional retry hint."""
    __slots__ = ("message", "retry_after")

    def __init__(self, message: str, retry_after: float | None = None):
        self.message = message
        # Seconds until the soonest account recovers, when known. Used to emit
        # an HTTP Retry-After header (non-streaming) or include it in the SSE
        # error payload (streaming) so the client knows when to retry.
        self.retry_after = retry_after


# ── LIVE STREAM CAPTURE (temporary diagnostic) ───────────────────────────────
# Buffer-then-write JSONL of recent streaming requests so we can catch the next
# real Cursor "planning next moves" hang with raw upstream + forwarded evidence.
# TEMPORARY — set PROXY_CAPTURE_ENABLED=0 once the hang is diagnosed. This
# writes full model output (and any tool/content echoed in SSE) to disk.
#
# REDACTION (non-negotiable): never serialize UPSTREAM_KEYS, customer plaintext
# keys, Authorization headers, or any raw `headers` dict. Only account NAME and
# customer key_prefix are allowed identity fields.
PROXY_CAPTURE_ENABLED = os.getenv("PROXY_CAPTURE_ENABLED", "1").strip().lower() not in (
    "0", "false", "no", "off", "",
)
PROXY_CAPTURE_DIR = os.getenv("PROXY_CAPTURE_DIR", "/tmp/luv13-live-captures")
PROXY_CAPTURE_MAX_FILES = int(os.getenv("PROXY_CAPTURE_MAX_FILES", "100"))
PROXY_CAPTURE_GAP_S = 5.0
_FINISH_REASON_RE = re.compile(rb'"finish_reason"\s*:\s*"([^"]+)"')
_capture_io_lock = threading.Lock()

if PROXY_CAPTURE_ENABLED:
    log.warning(
        "LIVE STREAM CAPTURE ENABLED → %s (max %d files). Temporary diagnostic; "
        "disable with PROXY_CAPTURE_ENABLED=0 once the hang is found.",
        PROXY_CAPTURE_DIR, PROXY_CAPTURE_MAX_FILES,
    )


class StreamCapture:
    """In-memory capture for one streaming request; single disk write at end.

    Safe to call from the request greenlet only. All public methods swallow
    exceptions — capture must never affect the real request/response path.
    """

    __slots__ = (
        "t0", "unix_ms", "meta", "upstream", "forwarded",
        "outcome", "finish_reason", "account_name",
        "_last_up_ms", "_last_fwd_ms", "_max_gap_up_s", "_max_gap_fwd_s",
        "_flushed",
    )

    def __init__(
        self,
        *,
        requested_model: str,
        mapped_model: str,
        stream: bool,
        tools_present: bool,
        tools_count: int,
        tool_choice_present: bool,
        key_prefix: str,
    ):
        self.t0 = time.monotonic()
        self.unix_ms = int(time.time() * 1000)
        # Explicit allow-list only — never attach headers / keys / body here.
        self.meta = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "unix_ms": self.unix_ms,
            "requested_model": requested_model,
            "mapped_model": mapped_model,
            "stream": stream,
            "tools_present": tools_present,
            "tools_count": tools_count,
            "tool_choice_present": tool_choice_present,
            "key_prefix": key_prefix,
            "account_name": None,
            "account_idx": None,
        }
        self.upstream: list[tuple[int, str]] = []
        self.forwarded: list[tuple[int, str]] = []
        self.outcome = "unknown"
        self.finish_reason = None
        self.account_name = None
        self._last_up_ms: int | None = None
        self._last_fwd_ms: int | None = None
        self._max_gap_up_s = 0.0
        self._max_gap_fwd_s = 0.0
        self._flushed = False

    def _offset_ms(self) -> int:
        return int((time.monotonic() - self.t0) * 1000)

    def set_account(self, idx: int) -> None:
        try:
            name = account_name(idx)
            self.account_name = name
            self.meta["account_name"] = name
            self.meta["account_idx"] = idx
        except Exception:
            pass

    def _note_finish_reason(self, data: bytes) -> None:
        m = _FINISH_REASON_RE.search(data)
        if m:
            reason = m.group(1).decode("ascii", "replace")
            if reason and reason != "null":
                self.finish_reason = reason

    def record_upstream(self, data: bytes) -> None:
        """Raw chunk exactly as received from Neuralwatt (pre-forward)."""
        try:
            ms = self._offset_ms()
            if self._last_up_ms is not None:
                gap = (ms - self._last_up_ms) / 1000.0
                if gap > self._max_gap_up_s:
                    self._max_gap_up_s = gap
            self._last_up_ms = ms
            self.upstream.append((ms, data.decode("utf-8", "replace")))
            self._note_finish_reason(data)
        except Exception:
            pass

    def record_forwarded(self, data: bytes) -> None:
        """Bytes actually yielded toward the client."""
        try:
            ms = self._offset_ms()
            if self._last_fwd_ms is not None:
                gap = (ms - self._last_fwd_ms) / 1000.0
                if gap > self._max_gap_fwd_s:
                    self._max_gap_fwd_s = gap
            self._last_fwd_ms = ms
            self.forwarded.append((ms, data.decode("utf-8", "replace")))
            self._note_finish_reason(data)
        except Exception:
            pass

    def set_outcome(self, outcome: str) -> None:
        try:
            # Prefer more specific terminal states over a later generic "error".
            priority = {
                "unknown": 0,
                "incomplete": 1,
                "error": 2,
                "upstream_died": 3,
                "stalled": 3,
                "overloaded": 3,
                "normal": 4,
                "client_disconnect": 4,
            }
            if priority.get(outcome, 0) >= priority.get(self.outcome, 0):
                self.outcome = outcome
        except Exception:
            pass

    def note_stall(self) -> None:
        self.set_outcome("stalled")

    def note_overload(self) -> None:
        self.set_outcome("overloaded")

    def flush(self) -> None:
        """Write capture once at stream end. Never raises into the request path."""
        if self._flushed:
            return
        self._flushed = True
        try:
            max_gap = max(self._max_gap_up_s, self._max_gap_fwd_s)
            gap_detected = max_gap >= PROXY_CAPTURE_GAP_S
            duration_ms = self._offset_ms()
            acct = self.account_name or "unknown"
            # Sanitize account name for filesystem (names are TEST1..TEST10).
            acct_safe = re.sub(r"[^A-Za-z0-9_-]", "_", acct)[:32] or "unknown"
            gap_tag = "_GAP" if gap_detected else ""
            short = secrets.token_hex(3)
            fname = f"capture_{self.unix_ms}_{acct_safe}{gap_tag}_{short}.jsonl"
            os.makedirs(PROXY_CAPTURE_DIR, exist_ok=True)
            path = os.path.join(PROXY_CAPTURE_DIR, fname)

            header_bits = []
            if gap_detected:
                header_bits.append(f"GAP_DETECTED_MAX={max_gap:.1f}s")
            header_bits.append(f"outcome={self.outcome}")
            header_bits.append(f"duration_ms={duration_ms}")
            if self.finish_reason:
                header_bits.append(f"finish_reason={self.finish_reason}")

            lines = [
                "# " + " ".join(header_bits),
                json.dumps({
                    "type": "meta",
                    **self.meta,
                    "outcome": self.outcome,
                    "finish_reason": self.finish_reason,
                    "duration_ms": duration_ms,
                    "max_gap_upstream_s": round(self._max_gap_up_s, 3),
                    "max_gap_forwarded_s": round(self._max_gap_fwd_s, 3),
                    "gap_detected": gap_detected,
                    "upstream_chunks": len(self.upstream),
                    "forwarded_chunks": len(self.forwarded),
                }, separators=(",", ":")),
            ]
            for ms, text in self.upstream:
                lines.append(json.dumps(
                    {"type": "upstream", "t_ms": ms, "data": text},
                    separators=(",", ":"),
                ))
            for ms, text in self.forwarded:
                lines.append(json.dumps(
                    {"type": "forwarded", "t_ms": ms, "data": text},
                    separators=(",", ":"),
                ))
            lines.append(json.dumps({
                "type": "outcome",
                "outcome": self.outcome,
                "finish_reason": self.finish_reason,
                "duration_ms": duration_ms,
                "max_gap_upstream_s": round(self._max_gap_up_s, 3),
                "max_gap_forwarded_s": round(self._max_gap_fwd_s, 3),
            }, separators=(",", ":")))

            payload = ("\n".join(lines) + "\n").encode("utf-8")
            with _capture_io_lock:
                with open(path, "wb") as f:
                    f.write(payload)
                _prune_captures(PROXY_CAPTURE_DIR, PROXY_CAPTURE_MAX_FILES)
            log.info(
                "stream capture wrote %s (%d up / %d fwd, outcome=%s, gap=%.1fs)",
                fname, len(self.upstream), len(self.forwarded),
                self.outcome, max_gap,
            )
        except Exception as e:
            log.warning("stream capture flush failed: %s", e)


def _schedule_capture_flush(capture: "StreamCapture") -> None:
    """Flush capture on a native OS thread — never on the gevent hub.

    gunicorn -k gevent -w 1: synchronous disk I/O inside the request greenlet
    freezes the whole worker. After [DONE] the concurrency slot is already
    released (admin looks idle/green) while capture.flush() still writes
    100KB–1MB+ JSONL under `_capture_io_lock`. That stalls heartbeats and
    sibling Multitask streams on the same worker — matching "Cursor hung,
    proxy idle". Native thread keeps HTTP/SSE finalization non-blocking.
    """
    if capture is None:
        return
    try:
        ThreadCls = _native_thread_cls()
        t = ThreadCls(
            target=capture.flush,
            name="nw-capture-flush",
            daemon=True,
        )
        t.start()
    except Exception as e:
        log.warning("schedule capture flush failed (%s); flushing inline", e)
        try:
            capture.flush()
        except Exception as e2:
            log.warning("inline capture flush failed: %s", e2)


def _prune_captures(directory: str, max_files: int) -> None:
    """Ring-buffer the capture directory — same idea as _prune_events()."""
    try:
        entries = []
        for name in os.listdir(directory):
            if not name.startswith("capture_") or not name.endswith(".jsonl"):
                continue
            path = os.path.join(directory, name)
            try:
                mtime = os.path.getmtime(path)
            except OSError:
                continue
            entries.append((mtime, path))
        if len(entries) <= max_files:
            return
        entries.sort()  # oldest first
        for _mtime, path in entries[: len(entries) - max_files]:
            try:
                os.remove(path)
            except OSError:
                pass
    except Exception as e:
        log.warning("capture prune failed: %s", e)


def _capture_admin_snapshot(recent_limit: int = 40) -> dict:
    """Safe summary of live-stream capture state for /admin/summary.

    Lists recent capture files with meta only — never embeds raw SSE bodies
    (those can be huge). Full files are available via /admin/captures/<name>.
    """
    out = {
        "enabled": PROXY_CAPTURE_ENABLED,
        "dir": PROXY_CAPTURE_DIR,
        "max_files": PROXY_CAPTURE_MAX_FILES,
        "gap_threshold_s": PROXY_CAPTURE_GAP_S,
        "file_count": 0,
        "recent": [],
        "error": None,
    }
    try:
        if not os.path.isdir(PROXY_CAPTURE_DIR):
            return out
        entries = []
        for name in os.listdir(PROXY_CAPTURE_DIR):
            if not name.startswith("capture_") or not name.endswith(".jsonl"):
                continue
            # Path-traversal guard: basename only, expected pattern.
            if "/" in name or "\\" in name or ".." in name:
                continue
            path = os.path.join(PROXY_CAPTURE_DIR, name)
            try:
                st = os.stat(path)
            except OSError:
                continue
            entries.append((st.st_mtime, st.st_size, name, path))
        entries.sort(reverse=True)  # newest first
        out["file_count"] = len(entries)
        for mtime, size, name, path in entries[:recent_limit]:
            meta = {
                "filename": name,
                "size_bytes": size,
                "mtime_utc": datetime.fromtimestamp(
                    mtime, tz=timezone.utc).isoformat(),
                "gap_in_name": "_GAP_" in name,
            }
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    header = f.readline().rstrip("\n")
                    second = f.readline().rstrip("\n")
                if header.startswith("#"):
                    meta["header"] = header[2:].strip()
                if second.startswith("{"):
                    obj = json.loads(second)
                    if obj.get("type") == "meta":
                        for k in (
                            "timestamp_utc", "requested_model", "mapped_model",
                            "stream", "tools_present", "tools_count",
                            "tool_choice_present", "key_prefix", "account_name",
                            "account_idx", "outcome", "finish_reason",
                            "duration_ms", "max_gap_upstream_s",
                            "max_gap_forwarded_s", "gap_detected",
                            "upstream_chunks", "forwarded_chunks",
                            "hedge_fired", "hedge_winner",
                        ):
                            if k in obj:
                                meta[k] = obj[k]
            except Exception:
                pass
            out["recent"].append(meta)
    except Exception as e:
        out["error"] = str(e)
    return out


def _new_stream_capture(body: dict, key_prefix: str, requested_model: str,
                        mapped_model: str) -> StreamCapture | None:
    """Build a StreamCapture if enabled. Never raises; never stores secrets."""
    if not PROXY_CAPTURE_ENABLED:
        return None
    try:
        tools = body.get("tools")
        tools_present = isinstance(tools, list) and len(tools) > 0
        return StreamCapture(
            requested_model=requested_model,
            mapped_model=mapped_model,
            stream=bool(body.get("stream", False)),
            tools_present=tools_present,
            tools_count=len(tools) if tools_present else 0,
            tool_choice_present=("tool_choice" in body
                                 and body.get("tool_choice") is not None),
            key_prefix=key_prefix or "",
        )
    except Exception as e:
        log.warning("stream capture init failed: %s", e)
        return None


# ── STREAMING WITH HEARTBEAT + STALL FAILOVER ────────────────────────────────
def _feed_stream_to_queue(resp, stop_event, tag, out_q):
    """Pull chunks from _iter_with_heartbeat into out_q as (tag, item)."""
    try:
        for item in _iter_with_heartbeat(
            resp, HEARTBEAT_INTERVAL, STREAM_STALL_TIMEOUT, stop_event=stop_event
        ):
            out_q.put((tag, item))
            if stop_event.is_set():
                break
    except Exception as e:
        log.info("stream feeder (%s) exit: %s", tag, type(e).__name__)
    finally:
        out_q.put((tag, _STREAM_CLOSED))


def _cancel_stream_side(stop_event, resp, slot_idx, released_flag: dict, key: str):
    """Stop a primary/hedge side: signal reader, close response, release slot once."""
    if stop_event is not None:
        stop_event.set()
    if resp is not None:
        try:
            resp.close()
        except Exception:
            pass
    if slot_idx and not released_flag.get(key):
        release_slot(slot_idx)
        released_flag[key] = True


def _note_hedge_stat(name: str) -> None:
    with _slot_lock:
        _slot_stats[name] += 1


def stream_upstream(body, capture=None, prefer_idx: int | None = None):
    """Generator yielding StreamEvent instances for the streaming path.

    Yields one of:
      ChunkEvent(bytes)     — forward these bytes to the client verbatim
      AccountEvent(int)     — which upstream idx is serving (for usage tracking)
      HeartbeatEvent()      — send a keepalive comment (any idle gap)
      DoneEvent(dict)       — normal end of stream, carries the usage state
      ErrorEvent(str)       — terminal error message

    prefer_idx: soft cache-affinity tie-break (last-served account).

    Handles:
      - Slot acquisition: dispatches to the least-loaded account with a free
        concurrency slot; if all accounts are at 3/3, queues (yielding SSE
        heartbeats) and takes the first slot that frees
      - Unexpected 429s: counter resync + fast retry on any free slot
        (200-500ms), never a blacklist
      - SSE heartbeat comments every HEARTBEAT_INTERVAL on ANY inter-chunk
        gap (before and after first token)
      - Mid-stream stall detection: if no chunks for STREAM_STALL_TIMEOUT
        seconds, release the slot and retry (up to MAX_STREAM_RETRIES)
      - Delayed hedge (optional): if no first token within HEDGE_AFTER_MS,
        start a second stream on another free account; first real chunk wins
      - Usage extraction from SSE text
    The slot is held for the FULL life of the stream and released on every
    exit path (done, stall, overload, exception, client disconnect).
    """
    state = {"buf": "", "prompt_tokens": 0, "completion_tokens": 0,
             "cached_tokens": 0}
    body_copy = json.loads(json.dumps(body))  # deep copy — requests may consume it
    attempt = 0
    surprise_429s = 0
    queue_deadline = None if QUEUE_MAX_WAIT <= 0 else time.time() + QUEUE_MAX_WAIT
    # Hedge is streaming-only, off by default, disabled in isolate mode.
    hedge_ok = HEDGE_ENABLED and not ISOLATE_IDX and HEDGE_AFTER_MS > 0

    while attempt <= MAX_STREAM_RETRIES:
        # ── Acquire a concurrency slot (queue + heartbeat if all are at cap)
        idx = try_acquire_slot(prefer_idx=prefer_idx)
        if idx == 0:
            wait_started = time.time()
            last_hb = 0.0
            log.info("all account slots busy (%d/%d in flight); queueing stream "
                     "until one frees",
                     inflight_snapshot()["total_in_flight"],
                     NUM_UPSTREAM_KEYS * MAX_CONCURRENCY_PER_ACCOUNT)
            while idx == 0:
                if queue_deadline is not None and time.time() >= queue_deadline:
                    yield ErrorEvent(
                        "all upstream accounts at capacity (queue wait exhausted)",
                        retry_after=1,
                    )
                    return
                if time.time() - last_hb >= HEARTBEAT_INTERVAL:
                    last_hb = time.time()
                    yield HeartbeatEvent()
                wait_for_slot(0.25)
                idx = try_acquire_slot(prefer_idx=prefer_idx)
            note_queue_wait(time.time() - wait_started)

        headers = {
            "Authorization": f"Bearer {UPSTREAM_KEYS[idx - 1]}",
            "Content-Type": "application/json",
        }

        try:
            resp = _session.post(
                f"{NEURALWATT_BASE_URL}/chat/completions",
                headers=headers, json=body_copy, stream=True, timeout=UPSTREAM_TIMEOUT,
            )
        except requests.exceptions.RequestException as e:
            release_slot(idx)
            pause_account(idx, ERROR_PAUSE,
                          reason=f"stream conn error: {type(e).__name__}")
            log.warning("account '%s' (idx %d) connect error (%s); retrying on another slot",
                        account_name(idx), idx, type(e).__name__)
            attempt += 1
            continue

        if resp.status_code == 429:
            # Slots full server-side despite our counter (race / external
            # consumer). Resync + fast retry on any free slot — NO blacklist.
            resp.close()
            note_unexpected_429(idx)
            release_slot(idx)
            surprise_429s += 1
            log.warning("account '%s' (idx %d) unexpected 429 (%d this request); "
                        "counter resynced, retrying in %d-%dms",
                        account_name(idx), idx, surprise_429s,
                        int(RETRY_429_WAIT_MIN * 1000), int(RETRY_429_WAIT_MAX * 1000))
            if surprise_429s >= MAX_429_RETRIES:
                yield ErrorEvent(
                    f"upstream rate limited after {surprise_429s} slot retries")
                return
            time.sleep(random.uniform(RETRY_429_WAIT_MIN, RETRY_429_WAIT_MAX))
            continue

        if resp.status_code in BUDGET_STATUSES:
            code = resp.status_code
            resp.close()
            release_slot(idx)
            park_account(idx, BUDGET_COOLDOWN,
                         reason=f"pre-stream auth/budget {code}", http_status=code)
            log.warning("account '%s' (idx %d) pre-stream auth/budget %d; parked %ss",
                        account_name(idx), idx, code, BUDGET_COOLDOWN)
            attempt += 1
            continue

        if resp.status_code in RETRY_STATUSES:   # 5xx family (429 handled above)
            code = resp.status_code
            resp.close()
            release_slot(idx)
            pause_account(idx, ERROR_PAUSE,
                          reason=f"pre-stream {code}", http_status=code)
            log.warning("account '%s' (idx %d) pre-stream %d; paused %.1fs, failing over",
                        account_name(idx), idx, code, ERROR_PAUSE)
            attempt += 1
            continue

        if resp.status_code >= 400:
            detail = resp.content.decode("utf-8", "replace")[:500]
            code = resp.status_code
            resp.close()
            release_slot(idx)
            yield ErrorEvent(f"upstream {code}: {detail}")
            return

        # ── Stream is live — yield chunks with heartbeat + stall detection.
        # The slot stays held until this attempt fully ends; the finally below
        # releases it on EVERY exit (done, stall, overload, exception, and
        # GeneratorExit when the client disconnects mid-stream).
        first_token_received = False
        finish_reason_seen = False
        upstream_died = False
        last_data_time = time.time()
        request_started_at = time.time()
        stalled = False
        overloaded = False
        hb_emitted = 0
        hb_emitted_pre = 0
        hb_emitted_post = 0
        active_idx = idx
        released = {"primary": False, "hedge": False}

        if not hedge_ok:
            # ── Default path (no hedge): identical to pre-hedge behavior ──
            stop_event = threading.Event()
            try:
                if capture is not None:
                    capture.set_account(idx)
                yield AccountEvent(idx)
                try:
                    with resp:
                        for chunk in _iter_with_heartbeat(resp, HEARTBEAT_INTERVAL,
                                                           STREAM_STALL_TIMEOUT,
                                                           stop_event=stop_event):
                            if chunk is None:
                                # Post-content idle check: if content already
                                # flowed and the upstream has been silent too
                                # long, it's dead mid-generation — fail loud.
                                if (first_token_received
                                        and POST_CONTENT_IDLE_TIMEOUT > 0
                                        and time.time() - last_data_time >= POST_CONTENT_IDLE_TIMEOUT):
                                    upstream_died = True
                                    break
                                if (not first_token_received
                                        and FIRST_TOKEN_TIMEOUT > 0
                                        and time.time() - request_started_at >= FIRST_TOKEN_TIMEOUT):
                                    overloaded = True
                                    break
                                hb_emitted += 1
                                if first_token_received:
                                    hb_emitted_post += 1
                                else:
                                    hb_emitted_pre += 1
                                yield HeartbeatEvent()
                                continue
                            if chunk is _STALL_SENTINEL:
                                stalled = True
                                break

                            first_token_received = True
                            last_data_time = time.time()
                            if capture is not None:
                                capture.record_upstream(chunk)
                            try:
                                _extract_usage_from_sse_text(
                                    chunk.decode("utf-8", "replace"), state
                                )
                            except Exception:
                                pass
                            # Track terminal finish_reason (not null).
                            if not finish_reason_seen:
                                _fr_m = _FINISH_REASON_RE.search(chunk)
                                if _fr_m and _fr_m.group(1) != b"null":
                                    finish_reason_seen = True
                            yield ChunkEvent(chunk)
                except Exception as e:
                    log.warning("stream exception on '%s' (idx %d): %s",
                                account_name(idx), idx, type(e).__name__)
            finally:
                stop_event.set()
                if not released["primary"]:
                    release_slot(idx)
                    released["primary"] = True
                try:
                    resp.close()
                except Exception:
                    pass
                log.info(
                    "stream heartbeat stats on '%s' (idx %d): emitted=%d "
                    "(pre_first=%d post_first=%d) first_token=%s stalled=%s "
                    "overloaded=%s upstream_died=%s",
                    account_name(idx), idx, hb_emitted, hb_emitted_pre,
                    hb_emitted_post, first_token_received, stalled, overloaded,
                    upstream_died,
                )
        else:
            # ── Hedge-capable path: race primary vs delayed second stream ──
            race_q: queue.Queue = queue.Queue()
            primary_stop = threading.Event()
            hedge_idx = 0
            hedge_resp = None
            hedge_stop = None
            hedge_attempted = False
            hedge_fired = False
            winner_tag = None
            hedge_deadline = request_started_at + (HEDGE_AFTER_MS / 1000.0)
            last_client_hb = time.time()

            feeder_thread = threading.Thread(
                target=_feed_stream_to_queue,
                args=(resp, primary_stop, "primary", race_q),
                daemon=True,
                name="nw-stream-feed-primary",
            )
            feeder_thread.start()

            try:
                if capture is not None:
                    capture.set_account(idx)
                yield AccountEvent(idx)

                while True:
                    now = time.time()
                    # Fire delayed hedge once if primary is still silent.
                    if (not first_token_received and not hedge_attempted
                            and now >= hedge_deadline):
                        hedge_attempted = True
                        h_idx = try_acquire_slot(exclude_idx=idx)
                        if h_idx:
                            h_headers = {
                                "Authorization": f"Bearer {UPSTREAM_KEYS[h_idx - 1]}",
                                "Content-Type": "application/json",
                            }
                            try:
                                h_resp = _session.post(
                                    f"{NEURALWATT_BASE_URL}/chat/completions",
                                    headers=h_headers, json=body_copy,
                                    stream=True, timeout=UPSTREAM_TIMEOUT,
                                )
                            except requests.exceptions.RequestException as e:
                                release_slot(h_idx)
                                log.info("hedge connect failed on '%s' (%s); "
                                         "continuing primary only",
                                         account_name(h_idx), type(e).__name__)
                            else:
                                if h_resp.status_code == 200:
                                    hedge_idx = h_idx
                                    hedge_resp = h_resp
                                    hedge_stop = threading.Event()
                                    hedge_fired = True
                                    _note_hedge_stat("hedges_fired")
                                    if capture is not None:
                                        try:
                                            capture.meta["hedge_fired"] = True
                                            capture.meta["hedge_idx"] = h_idx
                                        except Exception:
                                            pass
                                    log.info(
                                        "hedge fired: primary='%s' (idx %d) → "
                                        "hedge='%s' (idx %d) after %dms",
                                        account_name(idx), idx,
                                        account_name(h_idx), h_idx,
                                        HEDGE_AFTER_MS,
                                    )
                                    threading.Thread(
                                        target=_feed_stream_to_queue,
                                        args=(h_resp, hedge_stop, "hedge", race_q),
                                        daemon=True,
                                        name="nw-stream-feed-hedge",
                                    ).start()
                                else:
                                    # Non-200: drop hedge quietly; primary continues.
                                    try:
                                        h_resp.close()
                                    except Exception:
                                        pass
                                    release_slot(h_idx)
                                    log.info(
                                        "hedge skipped: '%s' (idx %d) returned %d",
                                        account_name(h_idx), h_idx,
                                        h_resp.status_code,
                                    )

                    try:
                        tag, item = race_q.get(timeout=0.25)
                    except queue.Empty:
                        # Post-content idle check: if content already flowed
                        # and the upstream has been silent too long, it's dead
                        # mid-generation — fail loud.
                        if (first_token_received
                                and POST_CONTENT_IDLE_TIMEOUT > 0
                                and time.time() - last_data_time >= POST_CONTENT_IDLE_TIMEOUT):
                            upstream_died = True
                            break
                        if time.time() - last_client_hb >= HEARTBEAT_INTERVAL:
                            last_client_hb = time.time()
                            hb_emitted += 1
                            if first_token_received:
                                hb_emitted_post += 1
                            else:
                                hb_emitted_pre += 1
                            yield HeartbeatEvent()
                        if (not first_token_received
                                and FIRST_TOKEN_TIMEOUT > 0
                                and time.time() - request_started_at >= FIRST_TOKEN_TIMEOUT):
                            overloaded = True
                            break
                        continue

                    if item is _STREAM_CLOSED:
                        if winner_tag is None:
                            if tag == "primary" and hedge_idx and not released["hedge"]:
                                # Primary died pre-token; release it and wait on hedge.
                                _cancel_stream_side(
                                    primary_stop, resp, idx, released, "primary")
                                continue
                            if tag == "hedge":
                                _cancel_stream_side(
                                    hedge_stop, hedge_resp, hedge_idx, released, "hedge")
                                hedge_idx = 0
                                continue
                            # Primary closed, no hedge — end of attempt.
                            break
                        if tag == winner_tag:
                            break
                        continue

                    if item is None:
                        if winner_tag is not None and tag != winner_tag:
                            continue
                        last_client_hb = time.time()
                        hb_emitted += 1
                        if first_token_received:
                            hb_emitted_post += 1
                        else:
                            hb_emitted_pre += 1
                        yield HeartbeatEvent()
                        continue

                    if item is _STALL_SENTINEL:
                        if winner_tag is None:
                            if tag == "primary":
                                if hedge_idx and not released["hedge"]:
                                    _cancel_stream_side(
                                        primary_stop, resp, idx, released, "primary")
                                    continue
                                stalled = True
                                break
                            # Hedge stalled pre-token — drop it, keep primary.
                            _cancel_stream_side(
                                hedge_stop, hedge_resp, hedge_idx, released, "hedge")
                            hedge_idx = 0
                            continue
                        if tag == winner_tag:
                            stalled = True
                            break
                        continue

                    # Real data chunk
                    if winner_tag is None:
                        winner_tag = tag
                        first_token_received = True
                        if tag == "primary":
                            if hedge_fired:
                                _note_hedge_stat("hedges_won_primary")
                                _cancel_stream_side(
                                    hedge_stop, hedge_resp, hedge_idx, released, "hedge")
                            active_idx = idx
                        else:
                            _note_hedge_stat("hedges_won_hedge")
                            _cancel_stream_side(
                                primary_stop, resp, idx, released, "primary")
                            active_idx = hedge_idx
                            if capture is not None:
                                capture.set_account(hedge_idx)
                                try:
                                    capture.meta["hedge_won"] = True
                                except Exception:
                                    pass
                            yield AccountEvent(hedge_idx)
                    elif tag != winner_tag:
                        continue

                    last_data_time = time.time()
                    if capture is not None:
                        capture.record_upstream(item)
                    try:
                        _extract_usage_from_sse_text(
                            item.decode("utf-8", "replace"), state
                        )
                    except Exception:
                        pass
                    # Track terminal finish_reason (not null).
                    if not finish_reason_seen:
                        _fr_m = _FINISH_REASON_RE.search(item)
                        if _fr_m and _fr_m.group(1) != b"null":
                            finish_reason_seen = True
                    yield ChunkEvent(item)
            except Exception as e:
                log.warning("stream exception on '%s' (idx %d): %s",
                            account_name(active_idx), active_idx, type(e).__name__)
            finally:
                _cancel_stream_side(primary_stop, resp, idx, released, "primary")
                if hedge_idx:
                    _cancel_stream_side(
                        hedge_stop, hedge_resp, hedge_idx, released, "hedge")
                log.info(
                    "stream heartbeat stats on '%s' (idx %d): emitted=%d "
                    "(pre_first=%d post_first=%d) first_token=%s stalled=%s "
                    "overloaded=%s upstream_died=%s hedge_fired=%s winner=%s",
                    account_name(active_idx), active_idx, hb_emitted,
                    hb_emitted_pre, hb_emitted_post, first_token_received,
                    stalled, overloaded, upstream_died, hedge_fired,
                    winner_tag or "-",
                )

        if upstream_died:
            # Post-content idle timeout — upstream went silent after content
            # was already forwarded. This is the mid-stream death signature.
            # FAIL LOUD: tell the client the turn failed so it retries.
            if capture is not None:
                capture.set_outcome("upstream_died")
            pause_account(active_idx, ERROR_PAUSE,
                          reason=f"upstream died mid-stream: no data {POST_CONTENT_IDLE_TIMEOUT:.0f}s after content",
                          event_type="error_upstream_died")
            log.warning("account '%s' (idx %d) UPSTREAM DIED mid-stream "
                        "(no data %.0fs after content); failing loud to client",
                        account_name(active_idx), active_idx,
                        POST_CONTENT_IDLE_TIMEOUT)
            yield ErrorEvent("upstream stream ended without completion "
                             "(no finish_reason received)")
            return

        if overloaded:
            # No first token in FIRST_TOKEN_TIMEOUT — the request itself may
            # be wedged. Slot is already released; brief breather so the next
            # attempt prefers other accounts, then retry.
            if capture is not None:
                capture.note_overload()
            pause_account(active_idx, ERROR_PAUSE,
                          reason=f"overloaded: no first token in {FIRST_TOKEN_TIMEOUT:.1f}s",
                          event_type="error_overload")
            log.warning("account '%s' (idx %d) OVERLOADED (no first token in %.1fs); "
                        "slot released, retrying elsewhere (attempt %d/%d)",
                        account_name(active_idx), active_idx, FIRST_TOKEN_TIMEOUT,
                        attempt + 1, MAX_STREAM_RETRIES)
            attempt += 1
            continue

        if stalled:
            if capture is not None:
                capture.note_stall()
            pause_account(active_idx, ERROR_PAUSE,
                          reason=f"stalled mid-stream: no data {STREAM_STALL_TIMEOUT:.0f}s",
                          event_type="error_stall")
            log.warning("account '%s' (idx %d) stalled mid-stream (no data %ss); "
                        "slot released, retrying (attempt %d/%d)",
                        account_name(active_idx), active_idx, STREAM_STALL_TIMEOUT,
                        attempt + 1, MAX_STREAM_RETRIES)
            attempt += 1
            continue

        # Stream ended (reader returned _STREAM_CLOSED or exception caught).
        # Check whether it was a legitimate completion or a silent death.
        if not finish_reason_seen and first_token_received:
            # Content was forwarded but the stream ended without a terminal
            # finish_reason — the upstream died silently. FAIL LOUD so the
            # client retries instead of hanging on a truncated tool call.
            if capture is not None:
                capture.set_outcome("upstream_died")
            pause_account(active_idx, ERROR_PAUSE,
                          reason="upstream stream ended without finish_reason",
                          event_type="error_upstream_died")
            log.warning("account '%s' (idx %d) stream ended WITHOUT finish_reason "
                        "after content was forwarded; failing loud to client",
                        account_name(active_idx), active_idx)
            yield ErrorEvent("upstream stream ended without completion "
                             "(no finish_reason received)")
            return

        # Normal end of stream (finish_reason seen, or no content forwarded)
        yield DoneEvent(state)
        return

    yield ErrorEvent(f"stream failed after {attempt} attempts (stall failover exhausted)")


_STALL_SENTINEL = object()
_STREAM_CLOSED = object()


def _native_thread_cls():
    """Return a real OS thread class, not gevent's monkey-patched Thread.

    The stream reader must NOT run as a greenlet on the gevent hub: a blocking
    socket recv (dead peer, unpatched path) would freeze the entire -w 1 worker.
    Using the original threading.Thread keeps the block off the hub.
    """
    try:
        from gevent import monkey
        return monkey.get_original("threading", "Thread")
    except Exception:
        return threading.Thread


def _iter_with_heartbeat(resp, heartbeat_interval, stall_timeout, stop_event=None):
    """Yield raw chunks from resp.iter_content, with None for heartbeat gaps
    and _STALL_SENTINEL if no data for stall_timeout seconds.

    Implemented with a background NATIVE (non-gevent) reader thread + a queue,
    because resp.iter_content() reads through urllib3's internal buffer. Calling
    select() on the underlying socket misses bytes already pulled into that
    buffer, which made the proxy think a healthy stream was stalled and
    wrongly fail it over — producing empty/truncated responses in Cursor.

    `stop_event` (threading.Event): set by the caller on client disconnect /
    stall failover so the reader stops instead of orphaning on a blocked read.
    """
    out = queue.Queue()
    if stop_event is None:
        stop_event = threading.Event()
    # Diagnostic only: after N upstream chunks, pause the reader to simulate
    # a silent GLM reasoning gap. Confirms the post-first-token heartbeat gate
    # with real client-side timestamps. Default 0 = disabled (production).
    diag_silence_after = int(os.getenv("PROXY_DIAG_SILENCE_AFTER_CHUNKS", "0") or "0")
    diag_silence_s = float(os.getenv("PROXY_DIAG_SILENCE_S", "20") or "20")
    # Diagnostic: after N chunks, perform a hard OS-level blocking read on a
    # never-written pipe. Under gevent, if the reader runs as a greenlet on the
    # hub thread, this FREEZES the entire worker (admin/health included). If it
    # runs as a real OS thread, only that thread blocks. Default 0 = off.
    diag_os_block_after = int(os.getenv("PROXY_DIAG_OS_BLOCK_AFTER_CHUNKS", "0") or "0")
    # Diagnostic: after N chunks, stop producing data forever (no OS block) to
    # test whether STREAM_STALL_TIMEOUT recovers when upstream goes silent.
    diag_hang_after = int(os.getenv("PROXY_DIAG_HANG_AFTER_CHUNKS", "0") or "0")

    def _reader():
        n = 0
        try:
            for chunk in resp.iter_content(chunk_size=None):
                if stop_event.is_set():
                    break
                if chunk:
                    n += 1
                    if diag_silence_after > 0 and n == diag_silence_after:
                        log.warning(
                            "DIAG: injecting %.1fs upstream silence after %d "
                            "chunks (PROXY_DIAG_SILENCE_*)",
                            diag_silence_s, n,
                        )
                        # Cooperative sleep — interruptible via stop_event.
                        deadline = time.time() + diag_silence_s
                        while time.time() < deadline and not stop_event.is_set():
                            time.sleep(min(0.25, deadline - time.time()))
                        if stop_event.is_set():
                            break
                    if diag_hang_after > 0 and n == diag_hang_after:
                        log.warning(
                            "DIAG: hanging reader after %d chunks "
                            "(no more data; stall detector should fire)",
                            n,
                        )
                        while not stop_event.is_set():
                            time.sleep(0.5)
                        break
                    if diag_os_block_after > 0 and n == diag_os_block_after:
                        log.warning(
                            "DIAG: OS-level blocking read after %d chunks "
                            "(PROXY_DIAG_OS_BLOCK_AFTER_CHUNKS) — if admin "
                            "freezes, gevent hub is wedged",
                            n,
                        )
                        r_fd, _w_fd = os.pipe()
                        # Native thread: this blocks ONLY this OS thread.
                        # Poll stop_event by using a short select on the pipe
                        # with timeout so we can still exit on disconnect.
                        import select as _select
                        while not stop_event.is_set():
                            ready, _, _ = _select.select([r_fd], [], [], 0.5)
                            if ready:
                                os.read(r_fd, 1)
                                break
                        break
                    out.put(chunk)
        except Exception as e:
            log.info("stream reader exiting: %s", type(e).__name__)
        finally:
            out.put(_STREAM_CLOSED)

    t = _native_thread_cls()(target=_reader, daemon=True, name="nw-stream-reader")
    t.start()

    last_data = time.time()
    heartbeat_at = last_data + heartbeat_interval

    try:
        while not stop_event.is_set():
            try:
                item = out.get(timeout=min(heartbeat_interval, stall_timeout))
            except queue.Empty:
                if time.time() - last_data >= stall_timeout:
                    yield _STALL_SENTINEL
                    return
                if time.time() >= heartbeat_at:
                    heartbeat_at = time.time() + heartbeat_interval
                    yield None
                continue

            if item is _STREAM_CLOSED:
                return
            last_data = time.time()
            heartbeat_at = last_data + heartbeat_interval
            yield item
    finally:
        stop_event.set()
        try:
            resp.close()
        except Exception:
            pass


# ── AUTH SECRETS ─────────────────────────────────────────────────────────────
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "").encode("utf-8")
JWT_SECRET = os.getenv("JWT_SECRET", "").encode("utf-8")
JWT_ALG = "HS256"
JWT_TTL_DAYS = 30

# Browser login for /admin/* — username/password in .env (constant-time compare).
# Falls back to no-login if unset (header-based ADMIN_TOKEN still works).
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_SESSION_COOKIE = "luv13_admin"
ADMIN_SESSION_TTL_DAYS = int(os.getenv("ADMIN_SESSION_TTL_DAYS", "7"))

# ── MODEL MAP ────────────────────────────────────────────────────────────────
# Left  = what luv13 customers put in Cursor (branded slugs, luv13- prefix)
# Right = what gets sent to Neuralwatt's API
MODEL_MAP = {
    "luv13-glm-5.2":                  "glm-5.2",
    "luv13-glm-5.2-fast":             "glm-5.2-fast",
    "luv13-kimi-code":                "moonshotai/Kimi-K2.7-Code",
    "luv13-qwen3":                    "Qwen/Qwen3.6-35B-A3B",
    "luv13-gemma-4-31b":              "gemma-4-31b",
    # Pass through real names unchanged (fallback) so bare model names still work
    "glm-5.2":                        "glm-5.2",
    "glm-5.2-fast":                   "glm-5.2-fast",
    "moonshotai/Kimi-K2.7-Code":      "moonshotai/Kimi-K2.7-Code",
    "Qwen/Qwen3.6-35B-A3B":           "Qwen/Qwen3.6-35B-A3B",
    "gemma-4-31b":                    "gemma-4-31b",
}

# ── PRICING ──────────────────────────────────────────────────────────────────
# Flat-rate revenue model: $0.23 per million tokens billed on the FULL token
# count (prompt_tokens + completion_tokens). The OpenAI spec's `prompt_tokens`
# already includes cached tokens as a subset (cached_tokens is a detail of
# prompt_tokens, NOT an addition), so revenue = (input + output) / 1M * $0.23.
# Cached tokens are billed at the same flat rate as part of the prompt count —
# no separate cached price, no free tier in v1. Keeping a single rate on a
# single axis makes the capacity-test math simple and avoids double-counting.
YOUR_INPUT_PRICE_PER_M = float(os.getenv("YOUR_INPUT_PRICE_PER_M", "0.33"))
YOUR_OUTPUT_PRICE_PER_M = float(os.getenv("YOUR_OUTPUT_PRICE_PER_M", "0.33"))
YOUR_CACHED_INPUT_PRICE_PER_M = float(os.getenv("YOUR_CACHED_INPUT_PRICE_PER_M", "0.33"))

# Blended upstream cost fallback ($/M) when the response omits cost.request_cost_usd
# (streamed responses never include a cost field). $0.20/M is a conservative
# blended estimate across glm/kimi/qwen. compute_cost() prefers the upstream's
# reported cost when present, so this only fills in for streamed/edge cases.
BLENDED_COST_PER_M = float(os.getenv("BLENDED_COST_PER_M", "0.20"))

# ── KEY GENERATION ───────────────────────────────────────────────────────────
KEY_PREFIX = "sk-luv13-"
KEY_RANDOM_LEN = 32  # chars after the prefix
KEY_RANDOM_ALPHABET = string.ascii_letters + string.digits
MAX_KEYS_PER_CUSTOMER = int(os.getenv("MAX_KEYS_PER_CUSTOMER", "5"))

# ── DB ───────────────────────────────────────────────────────────────────────
DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "data", "luv13.db"))

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# ── FLASK APP ───────────────────────────────────────────────────────────────
app = Flask(__name__)
# OpenAI-compatible clients (Cursor, etc.) call this from browsers/Electron; allow
# all origins so the CORS preflight passes and "Failed to fetch" goes away.
CORS(app, supports_credentials=False,
     expose_headers=["X-Served-Account", "X-Served-Index"])


# ── DB HELPERS ──────────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    """Per-request SQLite connection. WAL mode + busy_timeout for concurrency."""
    if "db" not in g:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH, isolation_level=None, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute("PRAGMA foreign_keys=ON")
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    """Create tables if missing. Safe to call on every boot."""
    db = get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at    TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS customers (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS api_keys (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            key_hash           TEXT UNIQUE NOT NULL,
            key_prefix         TEXT NOT NULL,
            customer_id        INTEGER NOT NULL REFERENCES customers(id),
            upstream_key_index INTEGER NOT NULL,  -- 1..4
            created_at         TEXT NOT NULL,
            active             INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
        CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON api_keys(customer_id);
        CREATE TABLE IF NOT EXISTS usage (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key_id          INTEGER NOT NULL REFERENCES api_keys(id),
            timestamp           TEXT NOT NULL,
            input_tokens        INTEGER NOT NULL DEFAULT 0,
            output_tokens       INTEGER NOT NULL DEFAULT 0,
            cached_input_tokens INTEGER NOT NULL DEFAULT 0,
            cost_usd            REAL    NOT NULL DEFAULT 0,
            revenue_usd         REAL    NOT NULL DEFAULT 0,
            served_upstream_index INTEGER  -- which account ACTUALLY served (after failover)
        );
        CREATE INDEX IF NOT EXISTS idx_usage_api_key ON usage(api_key_id);
        CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage(timestamp);
        CREATE INDEX IF NOT EXISTS idx_usage_served ON usage(served_upstream_index);
        """
    )
    # Idempotent migration: add served_upstream_index to pre-existing usage tables.
    cols = {r["name"] for r in db.execute("PRAGMA table_info(usage)")}
    if "served_upstream_index" not in cols:
        db.execute("ALTER TABLE usage ADD COLUMN served_upstream_index INTEGER")
        log.info("migrated: added usage.served_upstream_index")
    # Events log: 429 resyncs, parks, errors, retries. Bounded by
    # _prune_events() so a stress test can't grow this unbounded.
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS events (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp           TEXT NOT NULL,
            upstream_key_index  INTEGER,
            account_name        TEXT,
            event_type          TEXT NOT NULL,
            http_status         INTEGER,
            message             TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
        CREATE INDEX IF NOT EXISTS idx_events_acct ON events(upstream_key_index);
        """
    )
    # Stream outcomes: one row per completed stream (normal, upstream_died,
    # client_disconnect, error, etc.). Powers the /admin/outcomes live panel.
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS stream_outcomes (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp           TEXT NOT NULL,
            upstream_key_index  INTEGER,
            account_name        TEXT,
            model               TEXT,
            outcome             TEXT NOT NULL,
            finish_reason       TEXT,
            duration_ms         INTEGER,
            message             TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_stream_outcomes_ts ON stream_outcomes(timestamp);
        CREATE INDEX IF NOT EXISTS idx_stream_outcomes_outcome ON stream_outcomes(outcome);
        """
    )
    log.info("database ready at %s", DB_PATH)


def _prune_events(db, max_rows: int = 5000) -> None:
    """Cap the events table so a long stress test can't grow it unbounded."""
    cur = db.execute(
        "DELETE FROM events WHERE id NOT IN "
        "(SELECT id FROM events ORDER BY id DESC LIMIT ?)",
        (max_rows,),
    )
    del_count = cur.rowcount
    if del_count > 0:
        log.info("pruned %d old event rows", del_count)


# ── AUTH HELPERS ─────────────────────────────────────────────────────────────
def hash_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def key_prefix_for(plaintext: str) -> str:
    """Last 4 chars for display, e.g. sk-luv13-...ab12"""
    return f"{KEY_PREFIX}...{plaintext[-4:]}"


def generate_random_key_suffix() -> str:
    return "".join(secrets.choice(KEY_RANDOM_ALPHABET) for _ in range(KEY_RANDOM_LEN))


def require_admin(f):
    """Admin auth via constant-time comparison.

    Accepts EITHER:
      - X-Admin-Token header (for API/poller clients), OR
      - luv13_admin session cookie (for browsers, set by /admin/login)
    Returns 401 if neither/invalid.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get("X-Admin-Token", "").encode("utf-8")
        if token and ADMIN_TOKEN and hmac.compare_digest(token, ADMIN_TOKEN):
            return f(*args, **kwargs)
        if _check_admin_cookie():
            return f(*args, **kwargs)
        # Browser request: redirect to login instead of bare JSON 401
        if _is_browser_request():
            return redirect("/admin/login", code=302)
        return jsonify({"error": "unauthorized"}), 401
    return wrapper


def _is_browser_request() -> bool:
    """Heuristic: is the caller a browser (HTML) rather than an API client?"""
    accept = request.headers.get("Accept", "").lower()
    return "text/html" in accept and "application/json" not in accept


def _admin_session_secret() -> bytes:
    """Secret used to sign admin session cookies: prefer JWT_SECRET, fall back
    to ADMIN_TOKEN so the browser login works even when only ADMIN_TOKEN is set."""
    return (JWT_SECRET or ADMIN_TOKEN)


def _check_admin_cookie() -> bool:
    """Verify the luv13_admin session cookie. Returns True if valid."""
    cookie = request.cookies.get(ADMIN_SESSION_COOKIE, "")
    secret = _admin_session_secret()
    if not cookie or not secret:
        return False
    try:
        payload = pyjwt.decode(
            cookie, secret, algorithms=[JWT_ALG],
            options={"require": ["exp", "sub"]},
        )
    except Exception:
        return False
    return payload.get("sub") == "admin"


def _make_admin_session() -> str:
    """Sign a short-lived admin session JWT."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "admin",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=ADMIN_SESSION_TTL_DAYS)).timestamp()),
    }
    return pyjwt.encode(payload, _admin_session_secret(), algorithm=JWT_ALG)


ADMIN_LOGIN_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>luv13 Admin Login</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; font-family: -apple-system, BlinkMacSystemFont,
      "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #0b1020; color: #e6e9f0;
  }
  .card {
    width: 100%; max-width: 360px; padding: 32px 28px; border-radius: 14px;
    background: #131a2e; box-shadow: 0 10px 40px rgba(0,0,0,.5);
    border: 1px solid #23304d;
  }
  h1 { font-size: 20px; margin: 0 0 6px; font-weight: 600; }
  p.sub { margin: 0 0 22px; font-size: 13px; color: #8a93a6; }
  label { display: block; font-size: 13px; margin: 0 0 6px; color: #aeb4c4; }
  input[type=text], input[type=password] {
    width: 100%; padding: 11px 12px; border-radius: 8px; border: 1px solid #2a3650;
    background: #0b1020; color: #e6e9f0; font-size: 14px; margin-bottom: 16px;
  }
  input[type=text]:focus, input[type=password]:focus {
    outline: none; border-color: #4a7cff; box-shadow: 0 0 0 3px rgba(74,124,255,.2);
  }
  button {
    width: 100%; padding: 11px; border: 0; border-radius: 8px; cursor: pointer;
    background: #4a7cff; color: #fff; font-size: 14px; font-weight: 600;
  }
  button:hover { background: #3d6ae0; }
  .err { color: #ff6b6b; font-size: 13px; margin: 0 0 14px; min-height: 18px; }
</style>
</head>
<body>
<form class="card" method="POST" action="/admin/login">
  <h1>luv13 Admin</h1>
  <p class="sub">Sign in to access the dashboard</p>
  <div class="err">{{ error }}</div>
  <label for="u">Username</label>
  <input id="u" name="username" type="text" autocomplete="username" autofocus required>
  <label for="p">Password</label>
  <input id="p" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Sign in</button>
</form>
</body>
</html>"""


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    """Browser login for /admin/*. Sets a signed session cookie on success."""
    if request.method == "GET":
        return Response(ADMIN_LOGIN_PAGE.replace("{{ error }}", ""),
                        content_type="text/html")

    username = (request.form.get("username") or "").strip()
    password = request.form.get("password") or ""

    ok_user = bool(ADMIN_USERNAME) and hmac.compare_digest(
        username.encode("utf-8"), ADMIN_USERNAME.encode("utf-8"))
    ok_pass = bool(ADMIN_PASSWORD) and hmac.compare_digest(
        password.encode("utf-8"), ADMIN_PASSWORD.encode("utf-8"))

    if not (ok_user and ok_pass):
        resp = Response(
            ADMIN_LOGIN_PAGE.replace("{{ error }}", "Invalid username or password"),
            content_type="text/html", status=401,
        )
        return resp

    token = _make_admin_session()
    resp = make_response(redirect("/admin/summary", code=302))
    resp.set_cookie(
        ADMIN_SESSION_COOKIE, token,
        max_age=ADMIN_SESSION_TTL_DAYS * 86400,
        httponly=True, secure=request.is_secure, samesite="Lax",
    )
    return resp


@app.route("/admin/logout", methods=["POST", "GET"])
def admin_logout():
    """Clear the admin session cookie."""
    resp = make_response(redirect("/admin/login", code=302))
    resp.delete_cookie(ADMIN_SESSION_COOKIE)
    return resp


def openai_error(message: str, etype: str = "server_error",
                 status: int | None = None, retry_after: int | None = None) -> dict:
    """Build an OpenAI-schema-shaped error dict.

    VS Code and Cursor validate every response against OpenAI's API schema,
    which requires `error` to be an OBJECT (not a string) on the error branch
    of the union. Emiting `{"error": "<string>"}` makes the client reject the
    whole response as "Type validation failed". Wrap the message+type in an
    object so the error branch validates cleanly.
    """
    err = {"message": message, "type": etype}
    if status is not None:
        err["code"] = status
    if retry_after is not None:
        err["retry_after"] = retry_after
    return {"error": err}


def decode_jwt(token: str) -> dict:
    """Verify JWT signature + expiry. Raises jwt.* on failure."""
    return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


def resolve_branded_key() -> tuple:
    """Resolve the customer's sk-luv13-... key from the Authorization header.

    Returns (api_key_row, customer_row) on success, or (None, error_response)
    on failure where error_response is a (dict, status) tuple.
    """
    auth = request.headers.get("Authorization", "")
    plaintext = auth.replace("Bearer ", "").strip()
    if not plaintext.startswith(KEY_PREFIX):
        return None, (openai_error("unauthorized", "invalid_auth", 401), 401)
    kh = hash_key(plaintext)
    db = get_db()
    row = db.execute(
        "SELECT * FROM api_keys WHERE key_hash = ? AND active = 1", (kh,)
    ).fetchone()
    if row is None:
        return None, (openai_error("unauthorized", "invalid_auth", 401), 401)
    cust = db.execute("SELECT * FROM customers WHERE id = ?", (row["customer_id"],)).fetchone()
    if cust is None:
        return None, (openai_error("unauthorized", "invalid_auth", 401), 401)
    return (row, cust), None


def require_branded_key(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        res, err = resolve_branded_key()
        if err is not None:
            return err
        g.api_key_row, g.customer_row = res
        return f(*args, **kwargs)
    return wrapper


# ── ROUND-ROBIN ASSIGNMENT ───────────────────────────────────────────────────
# This is the core mechanism tying customer keys back to the upstream pool.
# For each new customer key we count how many keys are already assigned to each
# upstream_key_index across ALL customers, then pick the index with the lowest
# count. Ties broken by lowest index. This balances load across the pool so no
# single upstream key approaches Neuralwatt's rate limit before the others.
def pick_upstream_key_index(db: sqlite3.Connection) -> int:
    counts = {i: 0 for i in range(1, NUM_UPSTREAM_KEYS + 1)}
    for row in db.execute(
        "SELECT upstream_key_index, COUNT(*) AS c FROM api_keys GROUP BY upstream_key_index"
    ):
        counts[row["upstream_key_index"]] = row["c"]
    # Lowest count; ties → lowest index (min over (count, index) tuple)
    return min(range(1, NUM_UPSTREAM_KEYS + 1), key=lambda i: (counts[i], i))


# ── USAGE TRACKING ──────────────────────────────────────────────────────────
def compute_revenue(input_tokens: int, output_tokens: int, cached_tokens: int) -> float:
    """Customer billing. Flat-rate: $0.23/M on every billable token.

    `input_tokens` is the OpenAI spec's `prompt_tokens`, which ALREADY INCLUDES
    `cached_tokens` as a subset (cached is a component of prompt, not an
    addition). So total billable = prompt_tokens + completion_tokens. Cached
    tokens have no separate price (they're billed at the same flat $0.23/M as
    part of the prompt token count). Earlier versions added `cached_tokens` on
    top of `input_tokens`, which double-counted them and produced ~2x revenue
    on cache-heavy workloads (Cursor) — and the aggregates landed below cost.
    """
    return (
        (input_tokens + output_tokens) / 1_000_000 * YOUR_INPUT_PRICE_PER_M
    )


def compute_cost(prompt_tokens: int, completion_tokens: int, neuralwatt_cost) -> float:
    """Upstream cost. Prefer the upstream's reported cost when present
    (cost.request_cost_usd); fall back to a blended $0.10/M on the total token
    count for streamed responses (which never include a cost field)."""
    if neuralwatt_cost is not None:
        try:
            return float(neuralwatt_cost)
        except (TypeError, ValueError):
            pass
    return (prompt_tokens + completion_tokens) / 1_000_000 * BLENDED_COST_PER_M


def record_usage(api_key_id: int, prompt_tokens: int, completion_tokens: int,
                 cached_tokens: int, neuralwatt_cost, served_upstream_index=None) -> None:
    revenue = compute_revenue(prompt_tokens, completion_tokens, cached_tokens)
    cost = compute_cost(prompt_tokens, completion_tokens, neuralwatt_cost)
    db = get_db()
    db.execute(
        """INSERT INTO usage
           (api_key_id, timestamp, input_tokens, output_tokens,
            cached_input_tokens, cost_usd, revenue_usd, served_upstream_index)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            api_key_id,
            datetime.now(timezone.utc).isoformat(),
            prompt_tokens or 0,
            completion_tokens or 0,
            cached_tokens or 0,
            cost,
            revenue,
            served_upstream_index,
        ),
    )


def _extract_usage_from_sse_text(text: str, state: dict) -> None:
    """Best-effort parse of `usage` from streamed SSE text without altering bytes.

    `state` carries a partial trailing line buffer and running token counts.
    NOTE: Neuralwatt's streamed usage chunk omits cost; cost falls back to blended.
    """
    state["buf"] += text
    while "\n" in state["buf"]:
        line, state["buf"] = state["buf"].split("\n", 1)
        line = line.strip()
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if payload == "[DONE]":
            continue
        try:
            data = json.loads(payload)
        except Exception:
            continue
        usage = data.get("usage")
        if isinstance(usage, dict):
            state["prompt_tokens"] = usage.get("prompt_tokens", state["prompt_tokens"])
            state["completion_tokens"] = usage.get(
                "completion_tokens", state["completion_tokens"]
            )
            details = usage.get("prompt_tokens_details") or {}
            if "cached_tokens" in details:
                state["cached_tokens"] = details.get(
                    "cached_tokens", state["cached_tokens"]
                )


# ── ROUTES: PUBLIC API ──────────────────────────────────────────────────────
@app.route("/v1/models", methods=["GET"])
def list_models():
    """Return luv13-branded model list to Cursor."""
    models = [
        {"id": slug, "object": "model", "created": 1700000000, "owned_by": "luv13"}
        for slug in MODEL_MAP.keys()
    ]
    return jsonify({"object": "list", "data": models})


def _client_disconnected():
    """Best-effort detection of whether the downstream client (Cursor, curl,
    etc.) has closed the connection mid-stream.

    Flask's streaming generator runs inside the request context, so we can
    inspect the WSGI environ for the underlying socket. If the socket's file
    descriptor has been closed (recv returns b''), the client is gone.

    Works across werkzeug dev server (WSGIRequestHandler) and gunicorn/eventlet
    workers — each puts the raw socket somewhere slightly different; we check
    all known locations. Returns False if we can't tell (prefer false negative
    over killing a healthy stream).

    IMPORTANT: peek only (MSG_PEEK). A plain recv() would consume one byte of a
    pipelined/keep-alive follow-up request on the same TCP connection, which can
    make Cursor's next chat/completions look like it "never arrived" at the proxy
    after a successful tool_calls turn.
    """
    env = request.environ
    sock = env.get("werkzeug.socket")
    if sock is None:
        obj = env.get("eventlet.input") or env.get("gunicorn.sock")
        sock = getattr(obj, "sock", None) or getattr(obj, "get_socket", lambda: None)()
    if sock is None:
        return False
    try:
        fd = sock.fileno()
    except (ValueError, OSError):
        return True
    import select as _select
    try:
        r, _, _ = _select.select([fd], [], [], 0)
        if not r:
            return False
        # MSG_PEEK|MSG_DONTWAIT — detect EOF without eating keep-alive bytes.
        flags = (getattr(socket, "MSG_PEEK", 0x02)
                 | getattr(socket, "MSG_DONTWAIT", 0x40))
        return sock.recv(1, flags) == b""
    except (BlockingIOError, InterruptedError):
        return False
    except (OSError, ValueError):
        return True


# ── SSE CLIENT HYGIENE (Cursor / OpenAI schema) ──────────────────────────────
# Optional: strip Neuralwatt extras / inject role on the forward path.
# Default OFF — Multitask stalled worse with mutation; pass-through matches
# upstream. Set PROXY_SSE_SANITIZE=1 to re-enable. Capture.upstream stays raw.
PROXY_SSE_SANITIZE = os.getenv("PROXY_SSE_SANITIZE", "0").strip().lower() not in (
    "0", "false", "no", "off", "",
)

# ── AGENT-STEERING SYSTEM-PROMPT INJECTION ──────────────────────────────────
# GLM-5.2 sometimes ends agentic turns with finish_reason=stop while claiming
# it delegated work to a "background agent" that does not exist — emitting no
# tool_call — which freezes Cursor's agent loop on "Planning next moves"
# forever (confirmed via capture forensics 2026-07-30). Steer the model away
# from that pattern by appending execution rules to the system prompt on
# tool-using requests. Set PROXY_INJECT_AGENT_STEERING=0 to disable instantly
# for A/B testing.
PROXY_INJECT_AGENT_STEERING = os.getenv(
    "PROXY_INJECT_AGENT_STEERING", "1").strip().lower() not in (
    "0", "false", "no", "off", "",
)

_AGENT_STEERING_TEXT = (
    "IMPORTANT — agentic execution rules:\n"
    "- You have NO background agents, background processes, or async tasks. "
    "Nothing runs \"in the background.\" There is no separate exploration agent "
    "working while you wait.\n"
    "- Never claim work is \"running in the background,\" never say \"I'll report "
    "back,\" and never defer a task to a process that will report later. That "
    "process does not exist.\n"
    "- On every turn you must EITHER emit a tool call to make concrete progress "
    "now, OR give your complete final answer to the user. Never end a turn by "
    "promising future work without emitting a tool call.\n"
    "- If a task is large, do the next concrete step yourself via a tool call "
    "rather than delegating it."
)
# Distinctive substring used for idempotency (retried/duplicated requests).
_AGENT_STEERING_MARKER = "agentic execution rules"


def _inject_agent_steering(body: dict) -> bool:
    """Append agent-execution rules to the system prompt on tool-using turns.

    Scope: any request with a non-empty `tools` array (Cursor agentic turn).
    Plain non-tool chat is untouched. Appends to the existing system message
    (never replaces); inserts one at index 0 when none exists. Idempotent —
    skips when the marker is already present. Returns True when applied.
    Never raises: a failure here must not break the request path.
    """
    try:
        tools = body.get("tools")
        if not (isinstance(tools, list) and len(tools) > 0):
            return False
        messages = body.get("messages")
        if not isinstance(messages, list):
            return False
        sys_msg = next(
            (m for m in messages
             if isinstance(m, dict) and m.get("role") == "system"),
            None,
        )
        if sys_msg is None:
            messages.insert(
                0, {"role": "system", "content": _AGENT_STEERING_TEXT})
            return True
        content = sys_msg.get("content")
        if isinstance(content, str):
            if _AGENT_STEERING_MARKER in content:
                return False
            sys_msg["content"] = content + "\n\n" + _AGENT_STEERING_TEXT
            return True
        if isinstance(content, list):
            # Multipart content (OpenAI content-parts shape) — append a part.
            joined = " ".join(
                p.get("text", "") for p in content if isinstance(p, dict))
            if _AGENT_STEERING_MARKER in joined:
                return False
            content.append({"type": "text", "text": _AGENT_STEERING_TEXT})
            return True
        # Unknown content shape — leave the request untouched rather than
        # risk corrupting it.
        return False
    except Exception as e:
        log.warning("agent-steering injection failed: %s", e)
        return False

# Top-level / per-choice keys that are not part of the OpenAI chat.completion.chunk
# schema Cursor validates against.
_SSE_DROP_TOP_KEYS = (
    "prompt_token_ids", "prompt_text", "token_ids",
)
_SSE_DROP_CHOICE_KEYS = (
    "stop_reason", "token_ids",
)


class SseClientSanitizer:
    """Stateful per-response sanitizer for upstream SSE → Cursor.

    Keeps only OpenAI-shaped `data:` events (plus [DONE]). Drops Neuralwatt
    `: energy` / `: cost` comment lines. Injects `role=assistant` once on the
    first substantive delta. Proxy-injected `: keepalive` heartbeats bypass
    this class (HeartbeatEvent path).
    """

    __slots__ = ("_emitted_role",)

    def __init__(self):
        self._emitted_role = False

    def sanitize(self, data: bytes) -> bytes:
        if not data:
            return data
        try:
            text = data.decode("utf-8")
        except Exception:
            return data
        # Preserve original framing: split on SSE event boundaries.
        # Keep trailing empty segment so we don't strip a final \n\n.
        parts = text.split("\n\n")
        out_parts: list[str] = []
        changed = False
        for i, part in enumerate(parts):
            if part == "" and i == len(parts) - 1:
                out_parts.append(part)
                continue
            # Drop upstream SSE comments (`: energy …`, `: cost …`). OpenAI
            # never sends these; a strict client may trip on them.
            if part.startswith(":"):
                changed = True
                continue
            if not part.startswith("data:"):
                out_parts.append(part)
                continue
            payload = part[5:]
            if payload.startswith(" "):
                payload = payload[1:]
            if payload.strip() == "[DONE]":
                out_parts.append(part)
                continue
            try:
                obj = json.loads(payload)
            except Exception:
                out_parts.append(part)
                continue
            new_obj, dropped, mutated = self._sanitize_obj(obj)
            if dropped:
                changed = True
                continue
            if mutated:
                changed = True
                out_parts.append(
                    "data: " + json.dumps(new_obj, separators=(",", ":"))
                )
            else:
                out_parts.append(part)
        if not changed:
            return data
        if not any(p for p in out_parts if p):
            return b""
        return ("\n\n".join(out_parts)).encode("utf-8")

    def _sanitize_obj(self, obj: dict) -> tuple[dict | None, bool, bool]:
        """Return (obj_or_none, dropped, mutated)."""
        if not isinstance(obj, dict):
            return obj, False, False

        choices = obj.get("choices")
        # Drop empty-choices preamble without usage — not a valid OpenAI chunk.
        if choices == [] and "usage" not in obj:
            return None, True, True

        out = dict(obj)
        mutated = False

        for k in _SSE_DROP_TOP_KEYS:
            if k in out:
                out.pop(k, None)
                mutated = True

        if isinstance(choices, list) and choices:
            new_choices = []
            choices_mut = False
            for ch in choices:
                if not isinstance(ch, dict):
                    new_choices.append(ch)
                    continue
                new_ch = dict(ch)
                ch_mut = False
                for k in _SSE_DROP_CHOICE_KEYS:
                    if k in new_ch:
                        new_ch.pop(k, None)
                        ch_mut = True
                delta = new_ch.get("delta")
                if isinstance(delta, dict):
                    null_keys = [k for k, v in delta.items() if v is None]
                    has_substance = (
                        isinstance(delta.get("content"), str)
                        or bool(delta.get("tool_calls"))
                    )
                    need_role = not self._emitted_role and has_substance
                    if null_keys or need_role:
                        new_delta = {
                            k: v for k, v in delta.items() if v is not None
                        }
                        if need_role and "role" not in new_delta:
                            new_delta = {"role": "assistant", **new_delta}
                            self._emitted_role = True
                        elif new_delta.get("role"):
                            self._emitted_role = True
                        new_ch["delta"] = new_delta
                        ch_mut = True
                    elif delta.get("role"):
                        self._emitted_role = True
                if ch_mut:
                    choices_mut = True
                new_choices.append(new_ch if ch_mut else ch)
            if choices_mut:
                out["choices"] = new_choices
                mutated = True

        return (out if mutated else obj), False, mutated


@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    res, err = resolve_branded_key()
    if err is not None:
        return err
    api_key_row, _customer_row = res

    body = request.get_json(silent=True)
    if not body:
        return jsonify(openai_error("Invalid JSON body", "invalid_request_error", 400)), 400

    requested_model = body.get("model", "glm-5.2")
    body["model"] = MODEL_MAP.get(requested_model, requested_model)

    # Agent-steering injection — AFTER slug mapping, BEFORE the upstream call.
    # Fires only on tool-using (agentic) requests; plain chat is untouched.
    steering_injected = False
    if PROXY_INJECT_AGENT_STEERING:
        steering_injected = _inject_agent_steering(body)
        if steering_injected:
            log.info("injected agent-steering system prompt (tools=%d)",
                     len(body.get("tools") or []))

    is_streaming = bool(body.get("stream", False))
    if is_streaming:
        opts = body.get("stream_options") or {}
        opts.setdefault("include_usage", True)
        body["stream_options"] = opts

    try:
        if is_streaming:
            DONE_BYTES = b"data: [DONE]\n\n"
            # key_prefix from DB only — never the plaintext Authorization value.
            capture = _new_stream_capture(
                body,
                key_prefix=api_key_row["key_prefix"],
                requested_model=requested_model,
                mapped_model=body["model"],
            )
            if capture is not None and steering_injected:
                capture.meta["steering_injected"] = True

            def generate():
                served_idx = None
                done_sent = False
                gen_started_at = time.time()
                last_error_message = ""
                state = {"buf": "", "prompt_tokens": 0, "completion_tokens": 0,
                         "cached_tokens": 0}
                prefer_idx = _lookup_prefer_idx(api_key_row["id"])
                upstream_gen = stream_upstream(
                    body, capture=capture, prefer_idx=prefer_idx)
                sanitizer = SseClientSanitizer() if PROXY_SSE_SANITIZE else None
                try:
                    for event in upstream_gen:
                        # After [DONE] the client may already have written the next
                        # keep-alive request onto this socket. Only peek for EOF —
                        # never treat "readable" as disconnect once the stream has
                        # finished (done_sent), or we race the follow-up POST.
                        if not done_sent and _client_disconnected():
                            log.info("client disconnected mid-stream (account idx %s); "
                                     "stopping generator", served_idx)
                            if capture is not None:
                                capture.set_outcome("client_disconnect")
                            return
                        match event:
                            case ChunkEvent(data=data):
                                if sanitizer is not None:
                                    try:
                                        data = sanitizer.sanitize(data)
                                    except Exception as e:
                                        log.warning("SSE sanitize failed: %s", e)
                                    if not data:
                                        continue
                                # If the upstream already sent [DONE], remember so we
                                # don't duplicate it after the done event.
                                if b"[DONE]" in data:
                                    done_sent = True
                                if capture is not None:
                                    capture.record_forwarded(data)
                                yield data
                            case HeartbeatEvent():
                                hb = b": keepalive\n\n"
                                if capture is not None:
                                    capture.record_forwarded(hb)
                                yield hb
                            case AccountEvent(idx=idx):
                                served_idx = idx
                                if capture is not None:
                                    capture.set_account(idx)
                            case DoneEvent(state=state):
                                if capture is not None:
                                    capture.set_outcome("normal")
                                record_usage(
                                    api_key_row["id"],
                                    state["prompt_tokens"],
                                    state["completion_tokens"],
                                    state["cached_tokens"],
                                    neuralwatt_cost=None,
                                    served_upstream_index=served_idx,
                                )
                                if served_idx:
                                    _remember_served(api_key_row["id"], served_idx)
                                if not done_sent:
                                    done_sent = True
                                    if capture is not None:
                                        capture.record_forwarded(DONE_BYTES)
                                    yield DONE_BYTES
                            case ErrorEvent(message=message):
                                last_error_message = message
                                # VS Code / Cursor validate every response against the
                                # OpenAI schema union: success requires `choices: []`,
                                # error requires `error: {message, type, ...}`. Emiting
                                # `{"error": "<string>"}` (string) makes zod reject the
                                # whole response as "Type validation failed". Use the
                                # shared openai_error() helper so the shape stays
                                # consistent with the non-streaming paths.
                                if capture is not None:
                                    # Keep stalled/overloaded if already noted; else error.
                                    if capture.outcome in ("unknown", "incomplete"):
                                        capture.set_outcome("error")
                                retry_after = (int(max(1, round(event.retry_after)))
                                               if event.retry_after is not None else None)
                                err_payload = openai_error(
                                    message, "server_error", 503, retry_after=retry_after,
                                )
                                err_bytes = ("data: " + json.dumps(err_payload) + "\n\n").encode()
                                if capture is not None:
                                    capture.record_forwarded(err_bytes)
                                yield err_bytes
                                if not done_sent:
                                    done_sent = True
                                    if capture is not None:
                                        capture.record_forwarded(DONE_BYTES)
                                    yield DONE_BYTES
                            case _:
                                # Exhaustiveness guard: any new StreamEvent
                                # subclass that isn't handled above lands here.
                                # Production behavior: log + fail closed (don't
                                # forward an unknown event silently).
                                log.error("unhandled StreamEvent from upstream_gen: %r",
                                          type(event).__name__)
                                if not done_sent:
                                    done_sent = True
                                    err_bytes = ("data: " + json.dumps(
                                        openai_error("internal: unhandled stream event",
                                                     "server_error", 500)) + "\n\n").encode()
                                    if capture is not None:
                                        capture.set_outcome("error")
                                        capture.record_forwarded(err_bytes)
                                        capture.record_forwarded(DONE_BYTES)
                                    yield err_bytes
                                    yield DONE_BYTES
                except GeneratorExit:
                    if capture is not None:
                        capture.set_outcome("client_disconnect")
                    raise
                finally:
                    # Do NOT catch GeneratorExit above — catching it and then
                    # calling close() re-injects GeneratorExit and raises
                    # RuntimeError: generator ignored GeneratorExit under gevent.
                    # Cleanup belongs only in finally.
                    try:
                        upstream_gen.close()
                    except (GeneratorExit, StopIteration):
                        pass
                    except RuntimeError as e:
                        if "generator ignored GeneratorExit" not in str(e):
                            raise
                        log.info("suppressed generator-ignored-GeneratorExit on close "
                                 "(account idx %s)", served_idx)
                    if capture is not None:
                        if capture.outcome == "unknown":
                            capture.set_outcome("incomplete")
                        # Off-hub: do not block SSE/HTTP finalization on disk I/O.
                        _schedule_capture_flush(capture)
                    # Record stream outcome for the /admin/outcomes panel.
                    # Uses capture data when available; always runs regardless
                    # of whether captures are enabled.
                    try:
                        _out = (capture.outcome if capture is not None
                                else "unknown")
                        _fin = (capture.finish_reason if capture is not None
                                else None)
                        record_stream_outcome(
                            served_idx,
                            _out,
                            model=requested_model,
                            finish_reason=_fin,
                            duration_ms=int((time.time() - gen_started_at) * 1000),
                            message=last_error_message,
                        )
                    except Exception:
                        pass  # observability must never break the response path

            return Response(
                stream_with_context(generate()),
                content_type="text/event-stream",
                headers={
                    # keep-alive: Cursor Multitask reuses the TCP socket for
                    # follow-up chat/completions after tool_calls. Connection:
                    # close made Multitask stall after one output (2026-07-27).
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                    "Cache-Control": "no-cache",
                },
            )

        # ── NON-STREAMING ──────────────────────────────────────────────────
        # Concurrency-slot dispatch (queues while all accounts are at cap).
        prefer_idx = _lookup_prefer_idx(api_key_row["id"])
        resp, served_idx = post_upstream(body, prefer_idx=prefer_idx)
        if resp is None:
            # Every account at cap and the bounded queue wait elapsed. Slots
            # free as soon as any in-flight request finishes, so the honest
            # retry hint is simply "soon" — 1s. Error must be an OBJECT
            # (OpenAI schema) so VS Code / Cursor don't reject the response
            # as "Type validation failed" (string-vs-object union fail).
            retry_after = 1
            response = jsonify(openai_error(
                "all upstream accounts at capacity", "server_error",
                503, retry_after=retry_after,
            ))
            response.headers["Retry-After"] = str(retry_after)
            return response, 503
        try:
            data = resp.json()
        except ValueError:
            return Response(
                resp.content,
                status=resp.status_code,
                content_type=resp.headers.get("content-type", "text/plain"),
            )

        usage = data.get("usage", {}) or {}
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        cached_tokens = (usage.get("prompt_tokens_details") or {}).get("cached_tokens", 0)

        neuralwatt_cost = None
        cost_data = data.get("cost", {}) or {}
        if cost_data:
            neuralwatt_cost = cost_data.get("request_cost_usd")

        record_usage(
            api_key_row["id"],
            prompt_tokens,
            completion_tokens,
            cached_tokens,
            neuralwatt_cost,
            served_upstream_index=served_idx,
        )
        if served_idx and resp.status_code < 400:
            _remember_served(api_key_row["id"], served_idx)
        return jsonify(data), resp.status_code, {
            "X-Served-Account": account_name(served_idx),
            "X-Served-Index": str(served_idx),
        }

    except requests.exceptions.ConnectTimeout:
        return jsonify(openai_error("Could not connect to Neuralwatt (connect timeout)",
                                    "server_error", 504)), 504
    except Exception as e:
        log.exception("proxy error")
        return jsonify(openai_error(str(e), "server_error", 500)), 500


# ── ROUTES: KEY GENERATION (JWT auth — called by luv13 website) ─────────────
@app.route("/keys/generate", methods=["POST"])
def generate_key():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    if not token:
        return jsonify({"error": "unauthorized"}), 401
    try:
        payload = decode_jwt(token)
    except Exception:
        return jsonify({"error": "unauthorized"}), 401

    token_email = payload.get("email", "").lower()

    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    if not email or not EMAIL_RE.match(email):
        return jsonify({"error": "invalid email"}), 400
    # The body email must match the JWT payload's email — don't let a logged-in
    # user mint keys for a different account.
    if email != token_email:
        return jsonify({"error": "email does not match session"}), 403

    db = get_db()
    # Create or look up the customer by email.
    cust = db.execute("SELECT * FROM customers WHERE email = ?", (email,)).fetchone()
    if cust is None:
        cur = db.execute(
            "INSERT INTO customers (email, created_at) VALUES (?, ?)",
            (email, datetime.now(timezone.utc).isoformat()),
        )
        customer_id = cur.lastrowid
    else:
        customer_id = cust["id"]

    # Abuse control: max N keys per customer.
    existing = db.execute(
        "SELECT COUNT(*) AS c FROM api_keys WHERE customer_id = ?", (customer_id,)
    ).fetchone()["c"]
    if existing >= MAX_KEYS_PER_CUSTOMER:
        return jsonify({
            "error": f"max {MAX_KEYS_PER_CUSTOMER} keys per customer reached"
        }), 403

    # Round-robin assignment across the upstream key pool (see helper comment).
    upstream_idx = pick_upstream_key_index(db)

    plaintext = KEY_PREFIX + generate_random_key_suffix()
    db.execute(
        """INSERT INTO api_keys
           (key_hash, key_prefix, customer_id, upstream_key_index, created_at, active)
           VALUES (?, ?, ?, ?, ?, 1)""",
        (
            hash_key(plaintext),
            key_prefix_for(plaintext),
            customer_id,
            upstream_idx,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    log.info(
        "generated key for customer_id=%s upstream_idx=%d prefix=%s",
        customer_id, upstream_idx, key_prefix_for(plaintext),
    )
    # Plaintext returned ONCE. Never retrievable again — only the hash is stored.
    return jsonify({
        "key": plaintext,
        "customer_id": customer_id,
        "key_prefix": key_prefix_for(plaintext),
        "upstream_key_index": upstream_idx,
    })


# ── ROUTES: CUSTOMER USAGE (branded-key auth) ───────────────────────────────
@app.route("/usage", methods=["GET"])
@require_branded_key
def customer_usage():
    api_key_row = g.api_key_row
    db = get_db()

    agg = db.execute(
        """SELECT
               COUNT(*)              AS request_count,
               COALESCE(SUM(input_tokens), 0)        AS total_input,
               COALESCE(SUM(output_tokens), 0)       AS total_output,
               COALESCE(SUM(cached_input_tokens), 0) AS total_cached,
               COALESCE(SUM(revenue_usd), 0)        AS total_revenue
           FROM usage WHERE api_key_id = ?""",
        (api_key_row["id"],)
    ).fetchone()

    total_input = agg["total_input"]
    total_cached = agg["total_cached"]
    cache_rate = (total_cached / total_input * 100) if total_input > 0 else 0

    # Daily breakdown for last 30 days.
    since = (datetime.now(timezone.utc) - timedelta(days=30)).date()
    daily = []
    for row in db.execute(
        """SELECT
               DATE(timestamp)                  AS date,
               COUNT(*)                         AS requests,
               COALESCE(SUM(input_tokens), 0)   AS input,
               COALESCE(SUM(output_tokens), 0)  AS output,
               COALESCE(SUM(cached_input_tokens), 0) AS cached,
               COALESCE(SUM(revenue_usd), 0)    AS revenue_usd
           FROM usage
           WHERE api_key_id = ? AND DATE(timestamp) >= ?
           GROUP BY DATE(timestamp)
           ORDER BY DATE(timestamp) DESC""",
        (api_key_row["id"], since.isoformat())
    ):
        daily.append({
            "date": row["date"],
            "input": row["input"],
            "output": row["output"],
            "cached": row["cached"],
            "requests": row["requests"],
            "revenue_usd": round(row["revenue_usd"], 6),
        })

    # NOTE: never expose cost_usd, upstream_key_index, or any other customer's
    # data on this endpoint — customer-facing means customer-safe.
    return jsonify({
        "total_input_tokens": total_input,
        "total_output_tokens": agg["total_output"],
        "total_cached_tokens": total_cached,
        "cache_rate_pct": round(cache_rate, 2),
        "total_revenue_usd": round(agg["total_revenue"], 6),
        "request_count": agg["request_count"],
        "daily": daily,
    })


def _admin_summary_data(db: sqlite3.Connection) -> dict:
    """Compute the full admin summary. Shared by the HTML dashboard and the
    JSON endpoint so they can never diverge."""
    totals = db.execute(
        """SELECT
               (SELECT COUNT(*) FROM customers) AS total_customers,
               COUNT(u.id)                      AS total_requests,
               COALESCE(SUM(u.input_tokens + u.output_tokens), 0) AS total_tokens,
               COALESCE(SUM(u.cost_usd), 0)    AS total_cost,
               COALESCE(SUM(u.revenue_usd), 0) AS total_revenue
           FROM usage u"""
    ).fetchone()
    total_revenue = totals["total_revenue"] or 0
    total_cost = totals["total_cost"] or 0

    customers = []
    for row in db.execute(
        """SELECT
               c.id,
               c.email,
               COUNT(DISTINCT k.id)                 AS key_count,
               COUNT(u.id)                         AS requests,
               COALESCE(SUM(u.input_tokens), 0)    AS input_tokens,
               COALESCE(SUM(u.output_tokens), 0)   AS output_tokens,
               COALESCE(SUM(u.cached_input_tokens), 0) AS cached_tokens,
               COALESCE(SUM(u.cost_usd), 0)        AS cost_usd,
               COALESCE(SUM(u.revenue_usd), 0)     AS revenue_usd
           FROM customers c
           LEFT JOIN api_keys k ON k.customer_id = c.id
           LEFT JOIN usage u    ON u.api_key_id = k.id
           GROUP BY c.id
           ORDER BY revenue_usd DESC"""
    ):
        rev = row["revenue_usd"] or 0
        cst = row["cost_usd"] or 0
        customers.append({
            "customer_id": row["id"],
            "email": row["email"],
            "key_count": row["key_count"],
            "requests": row["requests"],
            "input_tokens": row["input_tokens"],
            "output_tokens": row["output_tokens"],
            "cached_tokens": row["cached_tokens"],
            "cost_usd": round(cst, 6),
            "revenue_usd": round(rev, 6),
            "profit_usd": round(rev - cst, 6),
        })

    # Per-key detail for the customer "keys" disclosure panel. ONE grouped
    # query (avoids N+1). Each customer gets a `keys` array with the masked
    # customer key prefix, the masked upstream key it is tied to, status, and a
    # cheap per-key request count.
    keys_by_customer: dict[int, list[dict]] = {}
    for krow in db.execute(
        """SELECT
               k.id,
               k.customer_id,
               k.key_prefix,
               k.upstream_key_index,
               k.active,
               k.created_at,
               COUNT(u.id) AS requests,
               COALESCE(SUM(u.input_tokens + u.output_tokens), 0) AS total_tokens
           FROM api_keys k
           LEFT JOIN usage u ON u.api_key_id = k.id
           GROUP BY k.id
           ORDER BY k.id"""
    ):
        cid = krow["customer_id"]
        up_idx = krow["upstream_key_index"]
        keys_by_customer.setdefault(cid, []).append({
            "id": krow["id"],
            # Customer-facing key: only the masked prefix is stored (plaintext
            # is returned once at creation and never retrievable).
            "key_prefix": krow["key_prefix"],
            "upstream_key_index": up_idx,
            "upstream_account_name": account_name(up_idx),
            # Masked upstream key (used by any code path that writes to disk /
            # logs). The admin HTML panel uses the explicitly admin-only
            # `upstream_key_full` field below so admins can copy the real key.
            "upstream_key_masked": mask_upstream_key(up_idx),
            # Admin-only full upstream key. _admin_summary_data is only ever
            # reached via the @require_admin-gated /admin/summary route, so it
            # is safe to surface the real value here. Never render this in any
            # capture/diagnostic path that writes to disk.
            "upstream_key_full": upstream_key_full(up_idx),
            "active": bool(krow["active"]),
            "created_at": krow["created_at"],
            "requests": krow["requests"],
            "total_tokens": krow["total_tokens"],
        })
    for c in customers:
        # Attach keys for this customer (empty list when none exist).
        c["keys"] = keys_by_customer.get(c["customer_id"], [])

    upstream = []
    slots = inflight_snapshot()
    slot_by_idx = {a["upstream_key_index"]: a for a in slots["accounts"]}
    for i in range(1, NUM_UPSTREAM_KEYS + 1):
        assigned = db.execute(
            """SELECT COUNT(DISTINCT id) AS keys_assigned,
                      COUNT(DISTINCT customer_id) AS customers_assigned
               FROM api_keys WHERE upstream_key_index = ?""",
            (i,)
        ).fetchone()
        served = db.execute(
            """SELECT COUNT(*) AS requests,
                      COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
                      COALESCE(SUM(cost_usd), 0) AS total_cost
               FROM usage WHERE served_upstream_index = ?""",
            (i,)
        ).fetchone()
        # Per-account event counts (429s, parks, errors) for the test
        # harness. "last_event_ts" is the most recent event for this account.
        evstats = db.execute(
            """SELECT
                   COUNT(*) AS total_events,
                   SUM(CASE WHEN event_type IN ('error_budget', 'park_start')
                       THEN 1 ELSE 0 END) AS parks,
                   SUM(CASE WHEN event_type = 'error_429' THEN 1 ELSE 0 END) AS err_429,
                   SUM(CASE WHEN event_type LIKE 'error_%' THEN 1 ELSE 0 END) AS errors,
                   MAX(timestamp) AS last_event_ts
               FROM events WHERE upstream_key_index = ?""",
            (i,)
        ).fetchone()
        slot = slot_by_idx.get(i, {})
        parked_s = slot.get("parked_s", 0.0)
        entry = {
            "upstream_key_index": i,
            "account_name": account_name(i),
            "customers_assigned": assigned["customers_assigned"],
            "keys_assigned": assigned["keys_assigned"],
            "served_requests": served["requests"],
            "served_tokens": served["total_tokens"],
            "served_cost_usd": round(served["total_cost"] or 0, 6),
            # In-flight concurrency slots (the live routing signal).
            "in_flight": slot.get("in_flight", 0),
            "max_concurrency": MAX_CONCURRENCY_PER_ACCOUNT,
            "free_slots": slot.get("free_slots", MAX_CONCURRENCY_PER_ACCOUNT),
            "peak_in_flight": slot.get("peak_in_flight", 0),
            # "cooling_down_s" kept for dashboard/poller compat — now it only
            # reflects a budget/auth park, never a 429.
            "cooling_down_s": parked_s,
            "cooldown_count": evstats["parks"] or 0,
            "error_429_count": evstats["err_429"] or 0,
            "error_count": evstats["errors"] or 0,
            "last_event_ts": evstats["last_event_ts"],
            "pool_role": ("parked" if parked_s > 0
                          else ("busy" if slot.get("free_slots", 1) == 0
                                else "active")),
        }
        upstream.append(entry)

    # Recent error/park events — the "error logs" the test harness needs
    # to correlate 429 timing and parks per account.
    recent_events = []
    for row in db.execute(
        """SELECT timestamp, upstream_key_index, account_name,
                  event_type, http_status, message
           FROM events
           ORDER BY id DESC LIMIT 200"""
    ):
        recent_events.append({
            "timestamp": row["timestamp"],
            "upstream_key_index": row["upstream_key_index"],
            "account_name": row["account_name"],
            "event_type": row["event_type"],
            "http_status": row["http_status"],
            "message": row["message"],
        })

    # Recent requests — "requests per timestamp for each API." Each row is one
    # completed request with its account, tokens, and timestamp. Capped so the
    # dashboard payload stays light; the test harness can query /usage for full.
    recent_requests = []
    for row in db.execute(
        """SELECT u.timestamp, u.served_upstream_index,
                  u.input_tokens, u.output_tokens, u.cached_input_tokens,
                  u.cost_usd, u.revenue_usd, k.key_prefix, c.email
           FROM usage u
           LEFT JOIN api_keys k ON k.id = u.api_key_id
           LEFT JOIN customers c ON c.id = k.customer_id
           ORDER BY u.id DESC LIMIT 200"""
    ):
        recent_requests.append({
            "timestamp": row["timestamp"],
            "upstream_key_index": row["served_upstream_index"],
            "account_name": (account_name(row["served_upstream_index"])
                             if row["served_upstream_index"] else None),
            "input_tokens": row["input_tokens"],
            "output_tokens": row["output_tokens"],
            "cached_tokens": row["cached_input_tokens"],
            "total_tokens": (row["input_tokens"] or 0) + (row["output_tokens"] or 0),
            "cost_usd": round(row["cost_usd"] or 0, 6),
            "revenue_usd": round(row["revenue_usd"] or 0, 6),
            "key_prefix": row["key_prefix"],
            "email": row["email"],
        })

    return {
        "strategy": "concurrency-slots",
        "isolate_account": (account_name(ISOLATE_IDX) if ISOLATE_IDX else None),
        "isolate_index": (ISOLATE_IDX or None),
        "concurrency": {
            "max_per_account": MAX_CONCURRENCY_PER_ACCOUNT,
            "total_in_flight": slots["total_in_flight"],
            "queue_waiting": slots["queue_waiting"],
            "available_accounts": slots["available_accounts"],
            "stats": slots["stats"],
        },
        "pricing": {
            "input_price_per_m": YOUR_INPUT_PRICE_PER_M,
            "output_price_per_m": YOUR_OUTPUT_PRICE_PER_M,
            "cached_input_price_per_m": YOUR_CACHED_INPUT_PRICE_PER_M,
            "blended_cost_per_m": BLENDED_COST_PER_M,
        },
        "total_customers": totals["total_customers"],
        "total_requests": totals["total_requests"],
        "total_tokens": totals["total_tokens"],
        "total_revenue_usd": round(total_revenue, 6),
        "total_cost_usd": round(total_cost, 6),
        "total_profit_usd": round(total_revenue - total_cost, 6),
        "gross_margin_pct": round(
            ((total_revenue - total_cost) / total_revenue * 100)
            if total_revenue > 0 else 0, 2),
        "per_customer": customers,
        "per_upstream_key": upstream,
        "recent_events": recent_events,
        "recent_requests": recent_requests,
        "diagnostics": {
            "cache_affinity": CACHE_AFFINITY,
            "hedge_enabled": HEDGE_ENABLED,
            "hedge_after_ms": HEDGE_AFTER_MS,
            "stream_capture": _capture_admin_snapshot(),
        },
    }


ADMIN_SUMMARY_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>luv13 Admin Summary</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0b1020;
    --surface: #131a2e;
    --surface-2: #1a2238;
    --border: #23304d;
    --text: #e6e9f0;
    --text-dim: #8a93a6;
    --text-faint: #6b7390;
    --accent: #4a7cff;
    --accent-dim: rgba(74,124,255,.18);
    --positive: #34d399;
    --positive-dim: rgba(52,211,153,.14);
    --negative: #f87171;
    --warning: #fbbf24;
    --cooling: #f59e0b;
    --cool: #60a5fa;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Helvetica, Arial, sans-serif;
    background: var(--bg); color: var(--text);
    line-height: 1.5; font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }
  .num, .mono { font-variant-numeric: tabular-nums; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .wrap { max-width: 1180px; margin: 0 auto; padding: 28px 20px 64px; }

  header.top {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap; margin-bottom: 28px;
  }
  header.top h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -.01em; }
  header.top .meta { font-size: 13px; color: var(--text-dim); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  header.top .meta form { margin: 0; }
  header.top .meta a.nav,
  header.top .meta button {
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text-dim);
    padding: 6px 12px; border-radius: 7px; font-size: 12px; cursor: pointer;
    min-height: 32px; text-decoration: none;
    transition: background .15s, color .15s;
  }
  header.top .meta a.nav:hover,
  header.top .meta button:hover { background: var(--border); color: var(--text); }
  header.top .meta .dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--positive);
    box-shadow: 0 0 0 3px var(--positive-dim);
  }

  /* Overview tiles */
  .overview {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px; margin-bottom: 32px;
  }
  .tile {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 16px 18px;
  }
  .tile .label { font-size: 11px; color: var(--text-dim); text-transform: uppercase;
    letter-spacing: .04em; margin-bottom: 6px; }
  .tile .value { font-size: 22px; font-weight: 600; letter-spacing: -.01em; }
  .tile .sub { font-size: 12px; color: var(--text-faint); margin-top: 2px; }
  .tile.pos .value { color: var(--positive); }

  /* Section headings */
  .section { margin-bottom: 32px; }
  .section h2 {
    margin: 0 0 14px; font-size: 15px; font-weight: 600; color: var(--text);
    display: flex; align-items: center; gap: 10px;
  }
  .section h2 .strat {
    font-size: 11px; font-weight: 500; color: var(--accent);
    background: var(--accent-dim); padding: 3px 8px; border-radius: 999px;
    text-transform: uppercase; letter-spacing: .03em;
  }
  .section h2 .count {
    font-size: 12px; color: var(--text-dim); font-weight: 400;
  }
  .section h2 .h2-actions { margin-left: auto; display: flex; gap: 8px; }
  .clear-btn {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 500; padding: 4px 10px; border-radius: 7px;
    cursor: pointer; letter-spacing: .02em;
    background: transparent; border: 1px solid var(--border); color: var(--text-dim);
    transition: background .15s, border-color .15s, color .15s;
  }
  .clear-btn:hover {
    color: var(--negative); border-color: rgba(248,113,113,.45);
    background: rgba(248,113,113,.12);
  }
  .clear-btn:disabled { opacity: .5; cursor: wait; }

  /* Upstream account cards */
  .accounts {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }
  .acc {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 16px; position: relative; overflow: hidden;
    transition: border-color .15s, transform .15s;
  }
  .acc:hover { border-color: var(--accent); }
  .acc::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
    background: var(--hue, var(--accent));
  }
  .acc .head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; margin-bottom: 12px; padding-left: 8px;
  }
  .acc .name { font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px; }
  .acc .idx { font-size: 11px; color: var(--text-faint); }
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 500; padding: 3px 9px; border-radius: 999px;
    letter-spacing: .02em; text-transform: capitalize; white-space: nowrap;
  }
  .pill svg { width: 12px; height: 12px; }
  .pill.active { color: var(--positive); background: var(--positive-dim); }
  .pill.standby, .pill.reserve { color: var(--cool); background: rgba(96,165,250,.14); }
  .pill.cooling, .pill.busy { color: var(--cooling); background: rgba(245,158,11,.14); }
  .pill.parked { color: var(--negative); background: rgba(248,113,113,.14); }

  .acc .cooldown {
    font-size: 12px; color: var(--cooling); margin-left: 8px; padding-left: 8px;
    border-left: 1px solid var(--border); display: inline-flex; align-items: center; gap: 5px;
  }

  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-left: 8px; }
  .stat .k { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .03em; }
  .stat .v { font-size: 15px; font-weight: 500; }

  /* Bar inside card showing relative load */
  .loadbar { height: 4px; background: var(--surface-2); border-radius: 2px; overflow: hidden; margin: 10px 0 0 8px; }
  .loadbar > span {
    display: block; height: 100%; background: var(--hue, var(--accent));
    transition: width .3s ease; border-radius: 2px;
  }

  /* Customers table */
  .tablewrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    text-align: left; padding: 11px 14px; color: var(--text-dim); font-weight: 500;
    font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    background: var(--surface); border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  tbody td { padding: 12px 14px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: var(--surface); }
  tbody td.email { color: var(--text); }
  tbody td.profit.pos { color: var(--positive); }
  tbody td.profit.neg { color: var(--negative); }
  tbody td.ts { color: var(--text-dim); font-size: 12px; }
  tbody td.acct-cell { font-weight: 500; }
  tbody td.acct-cell .swatch {
    display: inline-block; width: 8px; height: 8px; border-radius: 2px;
    margin-right: 6px; vertical-align: middle;
  }
  td.action { text-align: center; }
  .del-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 4px;
    background: transparent; border: 1px solid transparent; color: var(--negative);
    padding: 5px 8px; border-radius: 7px; cursor: pointer; font-size: 12px;
    transition: background .15s, border-color .15s, color .15s;
  }
  .del-btn:hover { background: rgba(248,113,113,.14); border-color: rgba(248,113,113,.35); }
  .del-btn svg { width: 14px; height: 14px; }
  .del-btn.confirm {
    background: var(--negative); color: #fff; border-color: var(--negative);
    font-weight: 500;
  }
  .del-btn.confirm:hover { background: #ef4444; }

  /* Customer keys disclosure panel (chevron row -> expanded sub-panel) */
  tr.cust-row { cursor: default; }
  tr.cust-row.open { background: var(--surface); }
  tr.cust-row .chev-cell { width: 28px; padding-right: 0; }
  tr.cust-row .chev {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 6px; cursor: pointer;
    background: transparent; border: 1px solid transparent; color: var(--text-dim);
    transition: transform .18s ease, background .15s, color .15s;
  }
  tr.cust-row .chev:hover { background: var(--surface-2); color: var(--text); }
  tr.cust-row .chev svg { width: 14px; height: 14px; transition: transform .18s ease; }
  tr.cust-row.open .chev { color: var(--accent); }
  tr.cust-row.open .chev svg { transform: rotate(90deg); }

  tr.keys-row > td { padding: 0; border-bottom: 1px solid var(--border); }
  .keys-panel {
    overflow: hidden; max-height: 0; opacity: 0;
    transition: max-height .25s ease, opacity .2s ease, padding .2s ease;
    padding: 0 14px;
  }
  tr.keys-row.open .keys-panel {
    max-height: 1200px; opacity: 1; padding: 14px;
  }
  .keys-panel-inner {
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 10px; box-shadow: 0 1px 0 rgba(0,0,0,.18);
  }
  .keys-panel-head {
    display: flex; align-items: center; gap: 16px;
    padding: 4px 0; margin-bottom: 6px; flex-wrap: wrap;
  }
  .keys-panel-head .pmeta { font-size: 12px; color: var(--text-dim); display: flex; gap: 16px; flex-wrap: wrap; }
  .keys-panel-head .pmeta .k { color: var(--text-faint); }
  .keys-empty { padding: 14px; text-align: center; color: var(--text-dim); font-size: 13px; }

  .key-card {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px; border-top: 1px solid var(--border);
    flex-wrap: nowrap; min-width: 0;
  }
  .key-card:first-child { border-top: 0; }
  .key-card .chev-spacer { width: 22px; flex: 0 0 auto; }
  .key-card-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .key-card-main .kv {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    font-family: "SF Mono", "JetBrains Mono", "Cascadia Code", "Consolas", monospace;
    font-size: 12.5px;
  }
  .key-card-main .kv .lbl { color: var(--text-faint); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; min-width: 92px; }
  .key-card-main .kv .kval { color: var(--text); word-break: break-all; }
  .key-card-main .kv .kval.up { color: var(--cool); }
  .key-card-main .kv .kval.cust { color: var(--accent); }
  .key-card-main .kv .kval .upstream-key-val { word-break: break-all; }
  .copy-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 6px; cursor: pointer;
    background: transparent; border: 1px solid transparent; color: var(--text-dim);
    transition: background .15s, color .15s, border-color .15s;
  }
  .copy-btn:hover { background: var(--surface-2); border-color: var(--border); color: var(--text); }
  .copy-btn:disabled { opacity: .35; cursor: default; }
  .copy-btn svg { width: 13px; height: 13px; }
  .copy-btn.copied { color: var(--positive); }

  .key-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex: 0 0 auto; }
  .key-side .usage { font-size: 11px; color: var(--text-dim); text-align: right; white-space: nowrap; }
  .key-side .age { font-size: 11px; color: var(--text-faint); white-space: nowrap; }

  .kstatus {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 999px;
    letter-spacing: .03em; text-transform: uppercase; white-space: nowrap;
  }
  .kstatus::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .kstatus.active { color: var(--positive); background: var(--positive-dim); }
  .kstatus.inactive { color: var(--negative); background: rgba(248,113,113,.14); }

  @media (max-width: 540px) {
    .key-card { flex-wrap: wrap; }
    .key-side { align-items: flex-start; flex-direction: row; gap: 12px; }
  }

  /* Event type badges in the activity log */
  .ev {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 999px;
    text-transform: lowercase; letter-spacing: .02em; white-space: nowrap;
  }
  .ev.cooldown_start { color: var(--cooling); background: rgba(245,158,11,.14); }
  .ev.cooldown_recover { color: var(--positive); background: var(--positive-dim); }
  .ev[class*="error_"] { color: var(--negative); background: rgba(248,113,113,.14); }
  .ev.info { color: var(--cool); background: rgba(96,165,250,.14); }
  .ev.warning { color: var(--warning); background: rgba(251,191,36,.14); }
  .ev.cap-ok { color: var(--positive); background: var(--positive-dim); }
  .ev.cap-gap { color: var(--cooling); background: rgba(245,158,11,.14); }
  .ev.cap-bad { color: var(--negative); background: rgba(248,113,113,.14); }

  .empty { padding: 32px; text-align: center; color: var(--text-dim); font-size: 13px; }

  footer { margin-top: 36px; color: var(--text-faint); font-size: 12px; text-align: center; }

  @media (max-width: 540px) {
    .stats { grid-template-columns: 1fr; }
    .acc .head { flex-wrap: wrap; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>luv13 Admin Summary</h1>
    <div class="meta">
      <span class="dot" aria-hidden="true"></span>
      <span id="fresh">loading…</span>
      <a class="nav" href="/admin/inflight">Inflight</a>
      <a class="nav" href="/admin/outcomes">Outcomes</a>
      <form action="/admin/logout" method="get">
        <button type="submit">Sign out</button>
      </form>
    </div>
  </header>

  <div class="overview" id="overview"></div>

  <div class="section">
    <h2>Upstream Accounts <span class="strat" id="strat">—</span> <span class="count" id="acc-count"></span></h2>
    <div class="accounts" id="accounts"><div class="empty">loading…</div></div>
  </div>

  <div class="section">
    <h2>Customers <span class="count" id="cust-count"></span></h2>
    <div class="tablewrap">
      <table id="cust-table">
        <thead>
          <tr>
            <th scope="col" class="chev-cell" aria-label="Expand keys"></th>
            <th scope="col">Email</th>
            <th scope="col">Keys</th>
            <th scope="col">Requests</th>
            <th scope="col">Input tok</th>
            <th scope="col">Output tok</th>
            <th scope="col">Cached</th>
            <th scope="col">Cost</th>
            <th scope="col">Revenue</th>
            <th scope="col">Profit</th>
            <th scope="col">Remove</th>
          </tr>
        </thead>
        <tbody id="cust-tbody"><tr><td colspan="11" class="empty">loading…</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <h2>Recent Requests <span class="count" id="req-count"></span>
      <span class="h2-actions">
        <button type="button" class="clear-btn" id="clear-requests-btn"
          title="Delete all usage rows (recent requests + totals)">Clear</button>
      </span>
    </h2>
    <div class="tablewrap">
      <table id="req-table">
        <thead>
          <tr>
            <th scope="col">Timestamp</th>
            <th scope="col">Account</th>
            <th scope="col">Customer</th>
            <th scope="col">In tok</th>
            <th scope="col">Out tok</th>
            <th scope="col">Cached</th>
            <th scope="col">Total tok</th>
            <th scope="col">Cost</th>
            <th scope="col">Revenue</th>
            <th scope="col">Profit</th>
          </tr>
        </thead>
        <tbody id="req-tbody"><tr><td colspan="10" class="empty">loading…</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <h2>Activity Log <span class="count" id="evt-count"></span>
      <span class="h2-actions">
        <button type="button" class="clear-btn" id="clear-events-btn"
          title="Delete all activity-log events">Clear</button>
      </span>
    </h2>
    <div class="tablewrap">
      <table id="evt-table">
        <thead>
          <tr>
            <th scope="col">Timestamp</th>
            <th scope="col">Account</th>
            <th scope="col">Event</th>
            <th scope="col">HTTP</th>
            <th scope="col">Message</th>
          </tr>
        </thead>
        <tbody id="evt-tbody"><tr><td colspan="5" class="empty">loading…</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <h2>Live Stream Captures <span class="count" id="cap-count"></span></h2>
    <p class="cap-note" id="cap-note" style="color:var(--text-dim);font-size:13px;margin:0 0 12px"></p>
    <div class="tablewrap">
      <table id="cap-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Account</th>
            <th scope="col">Result</th>
            <th scope="col">Took</th>
            <th scope="col">Model</th>
            <th scope="col">Raw log</th>
          </tr>
        </thead>
        <tbody id="cap-tbody"><tr><td colspan="6" class="empty">loading…</td></tr></tbody>
      </table>
    </div>
  </div>

  <footer>Auto-refreshes every 15s. Park timers tick down live.</footer>
</div>

<noscript>
  <p style="text-align:center;color:var(--text-dim);padding:48px;">
    This dashboard needs JavaScript. Raw JSON is available at this URL via
    <code>curl -H "X-Admin-Token: …"</code>.
  </p>
</noscript>

<script id="data" type="application/json">__DATA__</script>
<script>
(function () {
  // Stable hue per account so the same name always gets the same color.
  // Gold-angle spread (~45°) gives visually distinct hues for small N.
  var HUES = [210, 160, 280, 35, 320, 95, 0, 245, 175, 50];
  function hueFor(name, idx) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return HUES[h % HUES.length];
  }

  function fmtNum(n) { return (n || 0).toLocaleString(undefined); }
  function fmtUsd(n) { return "$" + (n || 0).toFixed(4); }
  function fmtUsd6(n) { return "$" + (n || 0).toFixed(6); }

  var ICONS = {
    active: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    reserve: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    standby: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cooling: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/><circle cx="12" cy="12" r="4"/></svg>'
  };
  ICONS.busy = ICONS.cooling;
  ICONS.parked = ICONS.standby;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // Escape user-controlled strings (emails, key labels) before injecting as HTML.
  var _escDiv = document.createElement("div");
  function esc(s) {
    if (s === null || s === undefined) return "";
    _escDiv.textContent = String(s);
    return _escDiv.innerHTML;
  }

  function renderOverview(d) {
    var ov = document.getElementById("overview");
    ov.innerHTML = "";
    var p = d.pricing || {};
    var diag = d.diagnostics || {};
    var cap = diag.stream_capture || {};
    var rateStr = "$" + (p.input_price_per_m || 0).toFixed(2) + "/M";
    if ((p.cached_input_price_per_m || 0) !== (p.input_price_per_m || 0)) {
      rateStr += " · cached $" + (p.cached_input_price_per_m || 0).toFixed(2) + "/M";
    }
    var tiles = [
      { label: "Customers", value: fmtNum(d.total_customers) },
      { label: "Total Requests", value: fmtNum(d.total_requests) },
      { label: "Total Tokens", value: fmtNum(d.total_tokens) },
      { label: "Revenue", value: fmtUsd(d.total_revenue_usd), sub: "cost " + fmtUsd6(d.total_cost_usd) },
      { label: "Profit", value: fmtUsd(d.total_profit_usd), pos: true,
        sub: "margin " + (d.gross_margin_pct || 0).toFixed(1) + "%" },
      { label: "Rate (rev)", value: rateStr,
        sub: "cost $" + (p.blended_cost_per_m || 0).toFixed(2) + "/M blended" },
      { label: "Stream Capture",
        value: cap.enabled ? ("ON · " + fmtNum(cap.file_count || 0)) : "OFF",
        sub: "max " + (cap.max_files || 0) + " · ring buffer" },
      { label: "Cache Affinity",
        value: diag.cache_affinity ? "ON" : "OFF",
        sub: "least-loaded tie-break" },
      { label: "Delayed Hedge",
        value: diag.hedge_enabled ? "ON" : "OFF",
        sub: "after " + (diag.hedge_after_ms || 0) + "ms TTFT" }
    ];
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      var tile = el("div", "tile" + (t.pos ? " pos" : ""));
      tile.appendChild(el("div", "label", t.label));
      tile.appendChild(el("div", "value num", t.value));
      if (t.sub) tile.appendChild(el("div", "sub", t.sub));
      ov.appendChild(tile);
    }
  }

  function renderAccounts(d) {
    var box = document.getElementById("accounts");
    document.getElementById("strat").textContent = d.strategy || "—";
    var ups = d.per_upstream_key || [];
    document.getElementById("acc-count").textContent = ups.length + " accounts";
    if (!ups.length) { box.innerHTML = '<div class="empty">No upstream accounts configured.</div>'; return; }
    var maxTok = Math.max.apply(null, ups.map(function (u) { return u.served_tokens || 0; }).concat([1]));
    box.innerHTML = "";
    for (var i = 0; i < ups.length; i++) {
      var u = ups[i];
      var role = u.pool_role || "active";
      var card = el("div", "acc");
      // Green = free slot(s); amber = all 3 slots busy; red = parked (budget).
      var statusColor = (role === "active") ? "var(--positive)"
        : (role === "busy") ? "var(--cooling)" : "var(--negative)";
      card.style.setProperty("--hue", statusColor);

      var head = el("div", "head");
      var nameDiv = el("div", "name");
      nameDiv.appendChild(el("span", null, u.account_name));
      nameDiv.appendChild(el("span", "idx", "#" + u.upstream_key_index));
      head.appendChild(nameDiv);

      var pillExtra = "";
      if ((u.cooling_down_s || 0) > 0) {
        pillExtra = '<span class="cooldown" data-acct="' + u.upstream_key_index + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
          '<span class="cd-num">' + u.cooling_down_s + '</span>s</span>';
      }
      head.insertAdjacentHTML("beforeend",
        '<span class="pill ' + role + '">' + (ICONS[role] || "") + role + '</span>' + pillExtra);
      card.appendChild(head);

      var stats = el("div", "stats");
      stats.appendChild(pair("In flight",
        (u.in_flight || 0) + "/" + (u.max_concurrency || 3) +
        " (peak " + (u.peak_in_flight || 0) + ")"));
      stats.appendChild(pair("Tokens served", fmtNum(u.served_tokens)));
      stats.appendChild(pair("Requests served", fmtNum(u.served_requests)));
      stats.appendChild(pair("Keys assigned", u.keys_assigned));
      stats.appendChild(pair("Customers", u.customers_assigned));
      // Error counters highlighted for the stress test. 429s no longer
      // blacklist — they're counter-resync events.
      if ((u.cooldown_count || 0) > 0 || (u.error_429_count || 0) > 0) {
        stats.appendChild(pair("429s seen", u.error_429_count || 0));
        stats.appendChild(pair("Parks", u.cooldown_count || 0));
      }
      card.appendChild(stats);

      var pct = Math.round((u.served_tokens || 0) / maxTok * 100);
      card.insertAdjacentHTML("beforeend",
        '<div class="loadbar"><span style="width:' + pct + '%"></span></div>');
      box.appendChild(card);
    }
    // stash base cooldowns for live countdown
    window.__cdBase = {};
    window.__cdStart = Date.now();
    ups.forEach(function (u) { window.__cdBase[u.upstream_key_index] = u.cooling_down_s || 0; });
  }

  function pair(k, v) {
    var d = el("div", "stat");
    d.appendChild(el("div", "k", k));
    d.appendChild(el("div", "v num", String(v)));
    return d;
  }

  function renderCustomers(d) {
    var tb = document.getElementById("cust-tbody");
    var list = d.per_customer || [];
    document.getElementById("cust-count").textContent = list.length + " customers";
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="11" class="empty">No customers yet.</td></tr>';
      return;
    }
    tb.innerHTML = "";

    var MINUS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>';
    var CHEV_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';
    var COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
    var CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    function copyKey(btn, value) {
      if (!value) return;
      var done = function () {
        btn.classList.add("copied");
        btn.innerHTML = CHECK_ICON;
        setTimeout(function () {
          btn.classList.remove("copied");
          btn.innerHTML = COPY_ICON;
        }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, function () { done(); });
      } else {
        done();
      }
    }

    function renderKeysPanel(c) {
      var keys = c.keys || [];
      var panel = el("div", "keys-panel");
      var inner = el("div", "keys-panel-inner");

      var head = el("div", "keys-panel-head");
      var meta = el("div", "pmeta");
      meta.innerHTML =
        '<span><span class="k">customer</span> ' + esc(c.email || "—") + '</span>' +
        '<span><span class="k">keys</span> ' + keys.length + '</span>' +
        '<span><span class="k">requests</span> ' + fmtNum(c.requests) + '</span>';
      head.appendChild(meta);
      inner.appendChild(head);

      if (!keys.length) {
        inner.appendChild(el("div", "keys-empty", "No API keys for this customer."));
        panel.appendChild(inner);
        return panel;
      }

      for (var j = 0; j < keys.length; j++) {
        var k = keys[j];
        var card = el("div", "key-card");

        card.appendChild(el("div", "chev-spacer"));

        var main = el("div", "key-card-main");

        // Customer-facing key (masked prefix only; plaintext never stored).
        var custRow = el("div", "kv");
        custRow.innerHTML =
          '<span class="lbl">customer key</span>' +
          '<span class="kval cust">' + esc(k.key_prefix || "—") + '</span>';
        main.appendChild(custRow);

        // Upstream key the account is tied to (label + full value, admin-only).
        var upVal = k.upstream_key_full || k.upstream_key_masked || "—";
        var upRow = el("div", "kv");
        upRow.innerHTML =
          '<span class="lbl">upstream</span>' +
          '<span class="kval up">' + esc(k.upstream_account_name || "—") +
          ' <span style="color:var(--text-faint)">·</span> ' +
          '<span class="upstream-key-val" data-key="' + esc(upVal) + '">' + esc(upVal) + '</span></span>';
        if (k.upstream_key_full) {
          var upCp = el("button", "copy-btn");
          upCp.type = "button";
          upCp.setAttribute("aria-label", "Copy upstream key for " + (k.upstream_account_name || "account"));
          upCp.title = "Copy upstream key";
          upCp.innerHTML = COPY_ICON;
          (function (btn, v) { btn.onclick = function (e) { e.stopPropagation(); copyKey(btn, v); }; })(upCp, k.upstream_key_full);
          upRow.appendChild(upCp);
        }
        main.appendChild(upRow);

        card.appendChild(main);

        var side = el("div", "key-side");
        var pill = el("span", "kstatus " + (k.active ? "active" : "inactive"),
          k.active ? "Active" : "Inactive");
        side.appendChild(pill);
        var usage = el("div", "usage");
        usage.innerHTML = (k.requests || 0) + " req · " + fmtNum(k.total_tokens) + " tok";
        side.appendChild(usage);
        var age = el("div", "age", "created " + fmtTs(k.created_at));
        side.appendChild(age);
        card.appendChild(side);

        inner.appendChild(card);
      }
      panel.appendChild(inner);
      return panel;
    }

    for (var i = 0; i < list.length; i++) {
      (function (c) {
        var profit = c.profit_usd || 0;
        var tr = document.createElement("tr");
        tr.className = "cust-row";

        var chevCell = el("td", "chev-cell");
        var chev = document.createElement("button");
        chev.className = "chev";
        chev.type = "button";
        chev.setAttribute("aria-expanded", "false");
        chev.setAttribute("aria-label", "Show API keys for " + (c.email || "customer"));
        chev.title = "Show API keys for this customer";
        chev.innerHTML = CHEV_ICON;
        var keysRow = null;
        chev.onclick = function (e) {
          e.stopPropagation();
          var open = tr.classList.toggle("open");
          chev.setAttribute("aria-expanded", open ? "true" : "false");
          if (open && !keysRow) {
            keysRow = document.createElement("tr");
            keysRow.className = "keys-row open";
            var td = el("td");
            td.colSpan = 11;
            td.appendChild(renderKeysPanel(c));
            keysRow.appendChild(td);
            tr.parentNode.insertBefore(keysRow, tr.nextSibling);
          } else if (keysRow) {
            keysRow.classList.toggle("open", open);
          }
        };
        chevCell.appendChild(chev);
        tr.appendChild(chevCell);

        tr.appendChild(el("td", "email", esc(c.email || "—")));
        tr.appendChild(el("td", "num", String(c.key_count)));
        tr.appendChild(el("td", "num", fmtNum(c.requests)));
        tr.appendChild(el("td", "num", fmtNum(c.input_tokens)));
        tr.appendChild(el("td", "num", fmtNum(c.output_tokens)));
        tr.appendChild(el("td", "num", fmtNum(c.cached_tokens)));
        tr.appendChild(el("td", "num", fmtUsd6(c.cost_usd)));
        tr.appendChild(el("td", "num", fmtUsd6(c.revenue_usd)));
        var pc = document.createElement("td");
        pc.className = "num profit " + (profit >= 0 ? "pos" : "neg");
        pc.textContent = fmtUsd6(profit);
        tr.appendChild(pc);

        var actionTd = document.createElement("td");
        actionTd.className = "action";
        var btn = document.createElement("button");
        btn.className = "del-btn";
        btn.innerHTML = MINUS_ICON;
        btn.title = "Remove customer";
        btn.onclick = function (e) {
          e.stopPropagation();
          var b = e.currentTarget;
          if (b.classList.contains("confirm")) {
            b.disabled = true;
            b.textContent = "Deleting…";
            fetch("/admin/customer/" + c.customer_id, { method: "DELETE" })
              .then(function (r) { return r.json(); })
              .then(function (res) {
                if (res.status === "deleted") {
                  window.location.reload();
                } else {
                  alert("Delete failed: " + (res.error || "unknown"));
                  b.disabled = false;
                  b.className = "del-btn";
                  b.innerHTML = MINUS_ICON;
                }
              })
              .catch(function () {
                alert("Delete failed.");
                b.disabled = false;
                b.className = "del-btn";
                b.innerHTML = MINUS_ICON;
              });
            return;
          }
          b.className = "del-btn confirm";
          b.innerHTML = "Delete?";
          b.title = "Click again to confirm deletion";
          setTimeout(function () {
            b.className = "del-btn";
            b.innerHTML = MINUS_ICON;
            b.title = "Remove customer";
          }, 4000);
        };
        actionTd.appendChild(btn);
        tr.appendChild(actionTd);

        tb.appendChild(tr);
      })(list[i]);
    }
  }

  function tickCooldowns() {
    if (!window.__cdBase) return;
    var elapsed = (Date.now() - window.__cdStart) / 1000;
    var nodes = document.querySelectorAll(".cooldown[data-acct]");
    for (var i = 0; i < nodes.length; i++) {
      var idx = nodes[i].getAttribute("data-acct");
      var base = window.__cdBase[idx] || 0;
      var rem = Math.max(0, base - elapsed);
      var num = nodes[i].querySelector(".cd-num");
      if (rem > 0) { if (num) num.textContent = rem.toFixed(0); }
      else { nodes[i].style.display = "none"; }
    }
  }

  function fmtTs(s) {
    if (!s) return "—";
    try {
      var d = new Date(s);
      return d.toLocaleString(undefined, {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
      });
    } catch (e) { return s; }
  }

  function accountCell(name, idx, role) {
    if (!name) return '<td class="acct-cell">—</td>';
    // Green = active, red = anything else (reserve/standby/cooling/timeout).
    var color = (role === "active") ? "var(--positive)" : "var(--negative)";
    return '<td class="acct-cell"><span class="swatch" style="background:' +
      color + '"></span>' + name + '</td>';
  }

  function renderRequests(d) {
    var tb = document.getElementById("req-tbody");
    var list = d.recent_requests || [];
    document.getElementById("req-count").textContent = list.length + " recent";
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="10" class="empty">No requests yet.</td></tr>';
      return;
    }
    tb.innerHTML = "";
    var roleMap = {};
    (d.per_upstream_key || []).forEach(function (u) {
      roleMap[u.upstream_key_index] = u.pool_role || "active";
    });
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var role = roleMap[r.upstream_key_index] || "active";
      var tr = document.createElement("tr");
      tr.appendChild(el("td", "ts", fmtTs(r.timestamp)));
      tr.insertAdjacentHTML("beforeend",
        accountCell(r.account_name, r.upstream_key_index, role));
      tr.appendChild(el("td", null, r.email || "—"));
      tr.appendChild(el("td", "num", fmtNum(r.input_tokens)));
      tr.appendChild(el("td", "num", fmtNum(r.output_tokens)));
      tr.appendChild(el("td", "num", fmtNum(r.cached_tokens)));
      tr.appendChild(el("td", "num", fmtNum(r.total_tokens)));
      tr.appendChild(el("td", "num", fmtUsd6(r.cost_usd)));
      tr.appendChild(el("td", "num", fmtUsd6(r.revenue_usd)));
      var profit = (r.revenue_usd || 0) - (r.cost_usd || 0);
      var pc = document.createElement("td");
      pc.className = "num profit " + (profit >= 0 ? "pos" : "neg");
      pc.textContent = fmtUsd6(profit);
      tr.appendChild(pc);
      tb.appendChild(tr);
    }
  }

  function renderEvents(d) {
    var tb = document.getElementById("evt-tbody");
    var list = d.recent_events || [];
    document.getElementById("evt-count").textContent = list.length + " recent";
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="5" class="empty">No events yet.</td></tr>';
      return;
    }
    tb.innerHTML = "";
    var roleMap = {};
    (d.per_upstream_key || []).forEach(function (u) {
      roleMap[u.upstream_key_index] = u.pool_role || "active";
    });
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var role = roleMap[e.upstream_key_index] || "active";
      var tr = document.createElement("tr");
      tr.appendChild(el("td", "ts", fmtTs(e.timestamp)));
      tr.insertAdjacentHTML("beforeend",
        accountCell(e.account_name, e.upstream_key_index, role));
      var et = e.event_type || "info";
      tr.insertAdjacentHTML("beforeend",
        '<td><span class="ev ' + et + '">' + et.replace(/_/g, " ") + "</span></td>");
      tr.appendChild(el("td", "num", e.http_status ? String(e.http_status) : "—"));
      tr.appendChild(el("td", null, e.message || ""));
      tb.appendChild(tr);
    }
  }

  function renderCaptures(d) {
    var diag = d.diagnostics || {};
    var cap = diag.stream_capture || {};
    var note = document.getElementById("cap-note");
    var tb = document.getElementById("cap-tbody");
    var files = cap.recent || [];
    document.getElementById("cap-count").textContent =
      (cap.file_count || 0) + " saved (max " + (cap.max_files || 0) + ")";
    if (!cap.enabled) {
      note.textContent = "Capture is off. Turn on with PROXY_CAPTURE_ENABLED=1.";
    } else {
      note.textContent = "Hang diagnostics — newest first. Click Open to see the raw stream log.";
    }
    if (cap.error) note.textContent += " Error: " + cap.error;
    if (!files.length) {
      tb.innerHTML = '<tr><td colspan="6" class="empty">' +
        (cap.enabled ? "No captures yet — run a streaming request." : "Capture is disabled.") +
        "</td></tr>";
      return;
    }
    tb.innerHTML = "";
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var tr = el("tr");
      tr.appendChild(el("td", "ts", fmtTs(f.timestamp_utc || f.mtime_utc)));
      tr.appendChild(el("td", "acct-cell", f.account_name || "—"));

      var result = (f.outcome || "unknown").replace(/_/g, " ");
      var pillClass = "cap-ok";
      if (f.gap_detected || f.gap_in_name) {
        result = "gap " + (Math.max(f.max_gap_upstream_s || 0, f.max_gap_forwarded_s || 0).toFixed(1)) + "s";
        pillClass = "cap-gap";
      } else if (f.outcome && f.outcome !== "normal") {
        pillClass = "cap-bad";
      }
      if (f.hedge_fired) result += " · hedged";
      var rtd = el("td");
      rtd.innerHTML = '<span class="ev ' + pillClass + '">' + result + "</span>";
      tr.appendChild(rtd);

      var took = "—";
      if (f.duration_ms != null) {
        var sec = f.duration_ms / 1000;
        took = sec < 10 ? sec.toFixed(1) + "s" : Math.round(sec) + "s";
      }
      tr.appendChild(el("td", "num", took));

      var model = f.requested_model || f.mapped_model || "—";
      // Drop long luv13- prefix noise when mapped name is clearer
      if (model.indexOf("luv13-") === 0) model = model.slice(6);
      tr.appendChild(el("td", null, model));

      var linkTd = el("td");
      var a = document.createElement("a");
      a.href = "/admin/captures/" + encodeURIComponent(f.filename);
      a.textContent = "Open";
      a.style.color = "var(--cool)";
      a.target = "_blank";
      a.rel = "noopener";
      linkTd.appendChild(a);
      tr.appendChild(linkTd);
      tb.appendChild(tr);
    }
  }

  function render(d) {
    renderOverview(d);
    renderAccounts(d);
    renderCustomers(d);
    renderRequests(d);
    renderEvents(d);
    renderCaptures(d);
    document.getElementById("fresh").textContent =
      "updated " + new Date().toLocaleTimeString();
  }

  // Initial render from embedded data (no extra round-trip).
  try {
    var d = JSON.parse(document.getElementById("data").textContent);
    render(d);
  } catch (e) {
    document.getElementById("accounts").innerHTML =
      '<div class="empty">Failed to load data.</div>';
  }

  // Live cooldown countdown every second.
  setInterval(tickCooldowns, 1000);

  // Auto-refresh from server every 15s.
  setInterval(function () {
    fetch(window.location.pathname, { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) render(d); })
      .catch(function () {});
  }, 15000);

  function refreshSummary() {
    return fetch(window.location.pathname, { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) render(d); });
  }

  function clearTable(kind, btn) {
    var msgs = {
      requests: "Delete ALL usage rows? This clears Recent Requests and resets revenue/cost/token totals. Only new requests will appear.",
      events: "Delete ALL activity-log events? Only new events will appear."
    };
    if (!window.confirm(msgs[kind] || "Clear?")) return;
    btn.disabled = true;
    fetch("/admin/clear/" + kind, { method: "POST", credentials: "same-origin",
      headers: { "Accept": "application/json" } })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) {
          throw new Error((j && j.error) || ("HTTP " + r.status));
        });
        return r.json();
      })
      .then(function (j) {
        return refreshSummary().then(function () { return j; });
      })
      .then(function (j) {
        document.getElementById("fresh").textContent =
          "cleared " + kind + " (" + (j.rows_deleted || 0) + ") · " +
          new Date().toLocaleTimeString();
      })
      .catch(function (e) {
        window.alert("Clear failed: " + (e && e.message ? e.message : e));
      })
      .finally(function () { btn.disabled = false; });
  }

  var clearReqBtn = document.getElementById("clear-requests-btn");
  var clearEvtBtn = document.getElementById("clear-events-btn");
  if (clearReqBtn) clearReqBtn.addEventListener("click", function () {
    clearTable("requests", clearReqBtn);
  });
  if (clearEvtBtn) clearEvtBtn.addEventListener("click", function () {
    clearTable("events", clearEvtBtn);
  });
})();
</script>
</body>
</html>"""


ADMIN_INFLIGHT_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>luv13 Inflight</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0b1020;
    --surface: #131a2e;
    --surface-2: #1a2238;
    --border: #23304d;
    --text: #e6e9f0;
    --text-dim: #8a93a6;
    --text-faint: #6b7390;
    --accent: #4a7cff;
    --accent-dim: rgba(74,124,255,.18);
    --positive: #34d399;
    --positive-dim: rgba(52,211,153,.14);
    --negative: #f87171;
    --warning: #fbbf24;
    --cooling: #f59e0b;
    --ease: cubic-bezier(0.2, 0, 0, 1);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    font-family: ui-sans-serif, "Segoe UI", system-ui, -apple-system, sans-serif;
    background: var(--bg); color: var(--text);
    line-height: 1.5; font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }
  .num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  a:focus-visible, button:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px;
  }

  .wrap { max-width: 960px; margin: 0 auto; padding: 28px 20px 64px; }

  header.top {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap; margin-bottom: 24px;
  }
  header.top h1 {
    margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -.02em;
    text-wrap: balance;
  }
  header.top .meta {
    font-size: 13px; color: var(--text-dim);
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  header.top .meta form { margin: 0; }
  header.top .meta a.nav,
  header.top .meta button {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 40px; min-width: 40px;
    background: var(--surface-2); border: 1px solid var(--border);
    color: var(--text-dim); padding: 8px 14px; border-radius: 8px;
    font-size: 12px; cursor: pointer; text-decoration: none;
    transition: background .15s var(--ease), color .15s var(--ease),
      transform .12s var(--ease);
  }
  header.top .meta a.nav:hover,
  header.top .meta button:hover { background: var(--border); color: var(--text); }
  header.top .meta a.nav:active,
  header.top .meta button:active { transform: scale(0.96); }
  header.top .meta .dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--positive);
    box-shadow: 0 0 0 3px var(--positive-dim);
  }
  header.top .meta .dot.stale { background: var(--cooling); box-shadow: 0 0 0 3px rgba(245,158,11,.18); }
  header.top .meta .dot.err { background: var(--negative); box-shadow: 0 0 0 3px rgba(248,113,113,.18); }

  .overview {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 12px; margin-bottom: 28px;
  }
  .tile {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 18px 20px;
  }
  .tile .label {
    font-size: 11px; color: var(--text-dim); text-transform: uppercase;
    letter-spacing: .05em; margin-bottom: 6px;
  }
  .tile .value {
    font-size: 32px; font-weight: 600; letter-spacing: -.03em; line-height: 1.1;
  }
  .tile.warn .value { color: var(--cooling); }
  .tile.hot .value { color: var(--negative); }
  .tile.ok .value { color: var(--positive); }

  .section { margin-bottom: 28px; }
  .section h2 {
    margin: 0 0 12px; font-size: 13px; font-weight: 500;
    color: var(--text-dim); text-transform: uppercase; letter-spacing: .04em;
    display: flex; align-items: baseline; gap: 10px;
  }
  .section h2 .count { color: var(--text-faint); font-weight: 400; text-transform: none; letter-spacing: 0; }

  .accounts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }
  .acc {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px 16px 14px;
    border-left: 3px solid var(--hue, var(--border));
    transition: border-color .2s var(--ease), background .2s var(--ease);
  }
  .acc .name {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 8px; margin-bottom: 12px;
  }
  .acc .name strong {
    font-size: 15px; font-weight: 600; letter-spacing: -.01em;
  }
  .acc .name .idx { font-size: 12px; color: var(--text-faint); }
  .acc .slots {
    display: flex; gap: 6px; margin-bottom: 12px;
  }
  .acc .slot {
    width: 28px; height: 10px; border-radius: 3px;
    background: var(--surface-2); border: 1px solid var(--border);
  }
  .acc .slot.used {
    background: var(--accent); border-color: transparent;
  }
  .acc .slot.phantom {
    background: var(--cooling); border-color: transparent; opacity: .85;
  }
  .acc .row {
    display: flex; justify-content: space-between; gap: 8px;
    font-size: 12px; color: var(--text-dim); margin-top: 4px;
  }
  .acc .row .v { color: var(--text); font-weight: 500; }
  .acc .flags {
    display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;
  }
  .flag {
    font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 999px;
    letter-spacing: .02em;
  }
  .flag.parked { color: var(--negative); background: rgba(248,113,113,.14); }
  .flag.paused { color: var(--cooling); background: rgba(245,158,11,.14); }
  .flag.full { color: var(--cooling); background: rgba(245,158,11,.14); }
  .flag.free { color: var(--positive); background: var(--positive-dim); }

  .stats {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 14px;
  }
  .stat {
    padding: 8px 10px; border-radius: 10px;
  }
  .stat .k {
    font-size: 11px; color: var(--text-dim); text-transform: uppercase;
    letter-spacing: .03em; margin-bottom: 2px;
  }
  .stat .v { font-size: 15px; font-weight: 500; }

  footer {
    margin-top: 28px; color: var(--text-faint); font-size: 12px; text-align: center;
  }
  .empty { padding: 28px; text-align: center; color: var(--text-dim); font-size: 13px; }

  @media (max-width: 560px) {
    .overview { grid-template-columns: 1fr; }
    .tile .value { font-size: 28px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>Inflight</h1>
    <div class="meta">
      <span class="dot" id="live-dot" aria-hidden="true"></span>
      <span id="fresh">loading…</span>
      <a class="nav" href="/admin/summary">Summary</a>
      <a class="nav" href="/admin/outcomes">Outcomes</a>
      <form action="/admin/logout" method="get">
        <button type="submit">Sign out</button>
      </form>
    </div>
  </header>

  <div class="overview" id="overview"></div>

  <div class="section">
    <h2>Accounts <span class="count" id="acc-count"></span></h2>
    <div class="accounts" id="accounts"><div class="empty">loading…</div></div>
  </div>

  <div class="section">
    <h2>Stats</h2>
    <div class="stats" id="stats"></div>
  </div>

  <footer>Auto-refreshes every 1s. Slot bars show used / free concurrency.</footer>
</div>

<noscript>
  <p style="text-align:center;color:var(--text-dim);padding:48px;">
    This dashboard needs JavaScript. Raw JSON is available via
    <code>curl -H "X-Admin-Token: …"</code>.
  </p>
</noscript>

<script id="data" type="application/json">__DATA__</script>
<script>
(function () {
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function fmtTime(ts) {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleTimeString();
  }

  function renderOverview(d) {
    var ov = document.getElementById("overview");
    ov.innerHTML = "";
    var infl = d.total_in_flight || 0;
    var q = d.queue_waiting || 0;
    var avail = d.available_accounts || 0;
    var tiles = [
      { label: "In flight", value: String(infl), cls: infl > 0 ? "warn" : "ok" },
      { label: "Queue waiting", value: String(q), cls: q > 0 ? "hot" : "" },
      { label: "Available", value: String(avail), cls: avail > 0 ? "ok" : "hot" }
    ];
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      var tile = el("div", "tile" + (t.cls ? " " + t.cls : ""));
      tile.appendChild(el("div", "label", t.label));
      tile.appendChild(el("div", "value num", t.value));
      ov.appendChild(tile);
    }
  }

  function accountStatus(a) {
    if ((a.parked_s || 0) > 0) return "parked";
    if ((a.paused_s || 0) > 0) return "paused";
    if ((a.free_slots || 0) === 0) return "full";
    return "free";
  }

  function statusHue(status) {
    if (status === "parked") return "var(--negative)";
    if (status === "paused" || status === "full") return "var(--cooling)";
    return "var(--positive)";
  }

  function renderAccounts(d) {
    var box = document.getElementById("accounts");
    var accounts = d.accounts || [];
    document.getElementById("acc-count").textContent = accounts.length + " accounts";
    if (!accounts.length) {
      box.innerHTML = '<div class="empty">No accounts.</div>';
      return;
    }
    box.innerHTML = "";
    for (var i = 0; i < accounts.length; i++) {
      var a = accounts[i];
      var status = accountStatus(a);
      var card = el("div", "acc");
      card.style.setProperty("--hue", statusHue(status));

      var name = el("div", "name");
      name.appendChild(el("strong", null, a.account_name || ("#" + a.upstream_key_index)));
      name.appendChild(el("span", "idx", "#" + a.upstream_key_index));
      card.appendChild(name);

      var max = a.max_concurrency || 3;
      var used = a.in_flight || 0;
      var phantoms = a.phantom_slots || 0;
      var slots = el("div", "slots");
      slots.setAttribute("aria-label", used + " of " + max + " slots in use");
      for (var s = 0; s < max; s++) {
        var cls = "slot";
        if (s < used) cls += " used";
        else if (s < used + phantoms) cls += " phantom";
        slots.appendChild(el("span", cls));
      }
      card.appendChild(slots);

      var row1 = el("div", "row");
      row1.appendChild(el("span", null, "In flight"));
      row1.appendChild(el("span", "v num", used + " / " + max));
      card.appendChild(row1);

      var row2 = el("div", "row");
      row2.appendChild(el("span", null, "Free"));
      row2.appendChild(el("span", "v num", String(a.free_slots || 0)));
      card.appendChild(row2);

      var row3 = el("div", "row");
      row3.appendChild(el("span", null, "Peak"));
      row3.appendChild(el("span", "v num", String(a.peak_in_flight || 0)));
      card.appendChild(row3);

      if (phantoms > 0) {
        var rowPh = el("div", "row");
        rowPh.appendChild(el("span", null, "Phantom"));
        rowPh.appendChild(el("span", "v num", String(phantoms)));
        card.appendChild(rowPh);
      }

      var flags = el("div", "flags");
      if (status === "parked") {
        flags.appendChild(el("span", "flag parked", "parked " + a.parked_s + "s"));
      } else if (status === "paused") {
        flags.appendChild(el("span", "flag paused", "paused " + a.paused_s + "s"));
      } else if (status === "full") {
        flags.appendChild(el("span", "flag full", "full"));
      } else {
        flags.appendChild(el("span", "flag free", "ready"));
      }
      card.appendChild(flags);

      box.appendChild(card);
    }
  }

  function renderStats(d) {
    var box = document.getElementById("stats");
    var s = d.stats || {};
    var items = [
      { k: "Dispatches", v: String(s.dispatches || 0) },
      { k: "Affinity hits", v: String(s.affinity_hits || 0) },
      { k: "Affinity misses", v: String(s.affinity_misses || 0) },
      { k: "Queue waits", v: String(s.queue_waits || 0) },
      { k: "Queue avg", v: (s.queue_wait_avg_s || 0).toFixed(2) + "s" },
      { k: "Queue max", v: (s.queue_wait_max_s || 0).toFixed(2) + "s" },
      { k: "Unexpected 429s", v: String(s.unexpected_429s || 0) },
      { k: "Cache affinity", v: s.cache_affinity ? "on" : "off" },
      { k: "Hedge", v: s.hedge_enabled
          ? ("on · " + (s.hedge_after_ms || 0) + "ms")
          : "off" },
      { k: "Hedges fired", v: String(s.hedges_fired || 0) }
    ];
    box.innerHTML = "";
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var st = el("div", "stat");
      st.appendChild(el("div", "k", it.k));
      st.appendChild(el("div", "v num", it.v));
      box.appendChild(st);
    }
  }

  function render(d) {
    renderOverview(d);
    renderAccounts(d);
    renderStats(d);
    var fresh = document.getElementById("fresh");
    fresh.textContent = "updated " + fmtTime(d.timestamp);
    var dot = document.getElementById("live-dot");
    dot.className = "dot";
  }

  function setError(msg) {
    document.getElementById("fresh").textContent = msg;
    document.getElementById("live-dot").className = "dot err";
  }

  try {
    var d = JSON.parse(document.getElementById("data").textContent);
    render(d);
  } catch (e) {
    document.getElementById("accounts").innerHTML =
      '<div class="empty">Failed to load data.</div>';
    setError("load failed");
  }

  setInterval(function () {
    fetch(window.location.pathname, {
      headers: { "Accept": "application/json" },
      credentials: "same-origin"
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) { if (d) render(d); })
      .catch(function () { setError("refresh failed"); });
  }, 1000);
})();
</script>
</body>
</html>"""


ADMIN_OUTCOMES_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>luv13 Stream Outcomes</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0b1020;
    --surface: #131a2e;
    --surface-2: #1a2238;
    --border: #23304d;
    --text: #e6e9f0;
    --text-dim: #8a93a6;
    --text-faint: #6b7390;
    --accent: #4a7cff;
    --accent-dim: rgba(74,124,255,.18);
    --positive: #34d399;
    --positive-dim: rgba(52,211,153,.14);
    --negative: #f87171;
    --negative-dim: rgba(248,113,113,.14);
    --warning: #fbbf24;
    --warning-dim: rgba(251,191,36,.14);
    --cooling: #f59e0b;
    --cool: #60a5fa;
    --purple: #a78bfa;
    --purple-dim: rgba(167,139,250,.14);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Helvetica, Arial, sans-serif;
    background: var(--bg); color: var(--text);
    line-height: 1.5; font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }
  .num, .mono { font-variant-numeric: tabular-nums; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .wrap { max-width: 1280px; margin: 0 auto; padding: 28px 20px 64px; }

  header.top {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap; margin-bottom: 24px;
  }
  header.top h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -.01em; }
  header.top .meta { font-size: 13px; color: var(--text-dim); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  header.top .meta form { margin: 0; }
  header.top .meta a.nav,
  header.top .meta button {
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text-dim);
    padding: 6px 12px; border-radius: 7px; font-size: 12px; cursor: pointer;
    min-height: 32px; text-decoration: none;
    transition: background .15s, color .15s;
  }
  header.top .meta a.nav:hover,
  header.top .meta button:hover { background: var(--border); color: var(--text); }
  header.top .meta a.nav.current { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }
  header.top .meta .dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--positive);
    box-shadow: 0 0 0 3px var(--positive-dim);
  }
  header.top .meta .dot.err { background: var(--negative); box-shadow: 0 0 0 3px var(--negative-dim); }

  /* ── Counter strip ── */
  .counters {
    display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px;
  }
  .counter {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 18px; min-width: 120px; flex: 1 1 120px;
  }
  .counter .c-num { font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
  .counter .c-label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .04em; margin-top: 4px; }
  .counter.c-normal .c-num { color: var(--positive); }
  .counter.c-upstream_died .c-num { color: var(--negative); }
  .counter.c-client_disconnect .c-num { color: var(--warning); }
  .counter.c-error .c-num { color: var(--negative); }
  .counter.c-stalled .c-num { color: var(--cooling); }
  .counter.c-overloaded .c-num { color: var(--cooling); }
  .counter.c-incomplete .c-num { color: var(--text-faint); }
  .counter.c-unknown .c-num { color: var(--text-faint); }

  /* ── Outcomes table ── */
  .tablewrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    text-align: left; padding: 10px 12px; color: var(--text-dim); font-weight: 500;
    font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    background: var(--surface); border-bottom: 1px solid var(--border); white-space: nowrap;
    position: sticky; top: 0; z-index: 1;
  }
  tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; vertical-align: top; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: var(--surface); }
  tbody td.ts { color: var(--text-dim); font-size: 12px; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  tbody td.acct { font-weight: 500; }
  tbody td.model { color: var(--cool); font-size: 12px; }
  tbody td.dur { color: var(--text-dim); font-size: 12px; text-align: right; }
  tbody td.msg { color: var(--text-dim); font-size: 12px; max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  tbody td.msg:hover { white-space: normal; word-break: break-all; }

  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
    letter-spacing: .02em; text-transform: uppercase;
  }
  .badge.b-normal { color: var(--positive); background: var(--positive-dim); }
  .badge.b-upstream_died { color: var(--negative); background: var(--negative-dim); }
  .badge.b-client_disconnect { color: var(--warning); background: var(--warning-dim); }
  .badge.b-error { color: var(--negative); background: var(--negative-dim); }
  .badge.b-stalled { color: var(--cooling); background: rgba(245,158,11,.14); }
  .badge.b-overloaded { color: var(--cooling); background: rgba(245,158,11,.14); }
  .badge.b-incomplete { color: var(--text-faint); background: var(--surface-2); }
  .badge.b-unknown { color: var(--text-faint); background: var(--surface-2); }

  .fr { font-size: 11px; color: var(--purple); background: var(--purple-dim); padding: 2px 8px; border-radius: 5px; }
  .fr-none { color: var(--text-faint); }

  .refresh-bar {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 16px; padding: 10px 0; font-size: 12px; color: var(--text-faint);
  }
  .refresh-bar .r-left { display: flex; align-items: center; gap: 8px; }
  .refresh-bar .pulse {
    width: 6px; height: 6px; border-radius: 50%; background: var(--positive);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

  .empty { padding: 40px; text-align: center; color: var(--text-faint); }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>Stream Outcomes</h1>
    <div class="meta">
      <span class="dot" id="live-dot"></span>
      <span id="fresh">loading&hellip;</span>
      <a class="nav" href="/admin/summary">Summary</a>
      <a class="nav" href="/admin/inflight">Inflight</a>
      <form action="/admin/logout" method="get">
        <button type="submit">Sign out</button>
      </form>
    </div>
  </header>

  <div class="counters" id="counters"><div class="empty">loading&hellip;</div></div>

  <div class="tablewrap">
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Account</th>
          <th>Model</th>
          <th>Outcome</th>
          <th>Finish Reason</th>
          <th style="text-align:right">Duration</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody id="outcomes-body">
        <tr><td colspan="7" class="empty">loading&hellip;</td></tr>
      </tbody>
    </table>
  </div>

  <div class="refresh-bar">
    <div class="r-left">
      <span class="pulse"></span>
      <span>Auto-refreshing every <strong id="refresh-ms">5</strong>s</span>
    </div>
    <span id="row-count"></span>
  </div>
</div>

<script>
(function() {
  var REFRESH_MS = 5000;
  document.getElementById("refresh-ms").textContent = REFRESH_MS / 1000;

  var OUTCOME_ORDER = ["normal","upstream_died","client_disconnect","error","stalled","overloaded","incomplete","unknown"];

  function esc(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function fmtTs(iso) {
    if (!iso) return "\\u2014";
    try {
      var d = new Date(iso);
      return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
        + "." + String(d.getMilliseconds()).padStart(3, "0");
    } catch (e) { return iso; }
  }

  function fmtDur(ms) {
    if (ms == null) return "\\u2014";
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  function renderCounters(counters) {
    var box = document.getElementById("counters");
    var keys = OUTCOME_ORDER.filter(function(k) { return counters[k] != null; });
    // Also show any outcome not in the predefined order
    Object.keys(counters).forEach(function(k) {
      if (OUTCOME_ORDER.indexOf(k) === -1) keys.push(k);
    });
    if (!keys.length) {
      box.innerHTML = '<div class="counter"><div class="c-num">0</div><div class="c-label">No data yet</div></div>';
      return;
    }
    var html = "";
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      html += '<div class="counter c-' + esc(k) + '">'
        + '<div class="c-num">' + counters[k] + '</div>'
        + '<div class="c-label">' + esc(k.replace(/_/g, " ")) + '</div>'
        + '</div>';
    }
    box.innerHTML = html;
  }

  function renderTable(outcomes) {
    var tbody = document.getElementById("outcomes-body");
    document.getElementById("row-count").textContent = outcomes.length + " rows";
    if (!outcomes.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No stream outcomes recorded yet. They will appear here after the next stream completes.</td></tr>';
      return;
    }
    var html = "";
    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      var frHtml = o.finish_reason
        ? '<span class="fr">' + esc(o.finish_reason) + '</span>'
        : '<span class="fr-none">\\u2014</span>';
      html += '<tr>'
        + '<td class="ts">' + esc(fmtTs(o.timestamp)) + '</td>'
        + '<td class="acct">' + esc(o.account_name || "\\u2014") + '</td>'
        + '<td class="model">' + esc(o.model || "\\u2014") + '</td>'
        + '<td><span class="badge b-' + esc(o.outcome) + '">' + esc(o.outcome) + '</span></td>'
        + '<td>' + frHtml + '</td>'
        + '<td class="dur num">' + fmtDur(o.duration_ms) + '</td>'
        + '<td class="msg" title="' + esc(o.message || "") + '">' + esc(o.message || "") + '</td>'
        + '</tr>';
    }
    tbody.innerHTML = html;
  }

  function setError(msg) {
    document.getElementById("fresh").textContent = msg;
    document.getElementById("live-dot").className = "dot err";
  }

  function setOk() {
    document.getElementById("fresh").textContent = "updated " + new Date().toLocaleTimeString();
    document.getElementById("live-dot").className = "dot";
  }

  function poll() {
    fetch("/admin/outcomes/data", { credentials: "same-origin" })
      .then(function(r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function(d) {
        renderCounters(d.counters || {});
        renderTable(d.outcomes || []);
        setOk();
      })
      .catch(function(e) {
        console.error("outcomes poll failed:", e);
        setError("refresh failed");
      });
  }

  poll();
  setInterval(poll, REFRESH_MS);
})();
</script>
</body>
</html>"""


# ── ROUTES: ADMIN ───────────────────────────────────────────────────────────
@app.route("/admin/summary", methods=["GET"])
@require_admin
def admin_summary():
    db = get_db()
    data = _admin_summary_data(db)
    # Browsers get a rendered dashboard; API clients (admin_poller.py, curl)
    # keep getting JSON. _is_browser_request already gates the /admin/login
    # redirect in require_admin, so this mirrors that contract.
    if _is_browser_request():
        return Response(
            ADMIN_SUMMARY_PAGE.replace("__DATA__", json.dumps(data)),
            content_type="text/html",
        )
    return jsonify(data)


@app.route("/admin/inflight", methods=["GET"])
@require_admin
def admin_inflight():
    """Point-in-time view of per-account in-flight slots. Browsers get a simple
    HTML dashboard; API clients (partb_load_test.py, curl) keep getting JSON.
    No DB access — safe to poll at 1Hz."""
    data = inflight_snapshot()
    if _is_browser_request():
        return Response(
            ADMIN_INFLIGHT_PAGE.replace("__DATA__", json.dumps(data)),
            content_type="text/html",
        )
    return jsonify(data)


@app.route("/admin/outcomes", methods=["GET"])
@require_admin
def admin_outcomes():
    """Live stream-outcomes dashboard. Browsers get an auto-refreshing HTML
    page; API clients get JSON with the last 50 outcomes + 15-min counters."""
    if _is_browser_request():
        return Response(ADMIN_OUTCOMES_PAGE, content_type="text/html")
    return admin_outcomes_data()


@app.route("/admin/outcomes/data", methods=["GET"])
@require_admin
def admin_outcomes_data():
    """JSON: last 50 stream outcomes + per-outcome counts over last 15 min."""
    db = get_db()
    outcomes = []
    for row in db.execute(
        """SELECT timestamp, upstream_key_index, account_name, model,
                  outcome, finish_reason, duration_ms, message
           FROM stream_outcomes ORDER BY id DESC LIMIT 50"""
    ):
        outcomes.append({
            "timestamp": row["timestamp"],
            "upstream_key_index": row["upstream_key_index"],
            "account_name": row["account_name"],
            "model": row["model"],
            "outcome": row["outcome"],
            "finish_reason": row["finish_reason"],
            "duration_ms": row["duration_ms"],
            "message": row["message"],
        })
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    counters: dict[str, int] = {}
    for row in db.execute(
        """SELECT outcome, COUNT(*) AS cnt
           FROM stream_outcomes WHERE timestamp > ?
           GROUP BY outcome ORDER BY cnt DESC""",
        (cutoff,),
    ):
        counters[row["outcome"]] = row["cnt"]
    return jsonify({"outcomes": outcomes, "counters": counters})


@app.route("/admin/captures/<path:filename>", methods=["GET"])
@require_admin
def admin_capture_file(filename: str):
    """Serve one live-stream capture JSONL (admin only). Filename must be a
    capture_*.jsonl basename under PROXY_CAPTURE_DIR — no path traversal."""
    name = os.path.basename(filename or "")
    if (not name.startswith("capture_") or not name.endswith(".jsonl")
            or "/" in name or "\\" in name or ".." in name):
        return jsonify({"error": "invalid capture filename"}), 400
    path = os.path.join(PROXY_CAPTURE_DIR, name)
    if not os.path.isfile(path):
        return jsonify({"error": "capture not found"}), 404
    # Resolve to block symlink escapes outside the capture dir.
    try:
        real = os.path.realpath(path)
        root = os.path.realpath(PROXY_CAPTURE_DIR)
        if not real.startswith(root + os.sep) and real != root:
            return jsonify({"error": "invalid capture path"}), 400
    except OSError:
        return jsonify({"error": "capture not readable"}), 404
    try:
        with open(path, "rb") as f:
            payload = f.read()
    except OSError:
        return jsonify({"error": "capture not readable"}), 404
    return Response(
        payload,
        content_type="application/x-ndjson; charset=utf-8",
        headers={
            "Content-Disposition": f'inline; filename="{name}"',
            "Cache-Control": "no-store",
        },
    )


@app.route("/admin/clear/<kind>", methods=["POST"])
@require_admin
def admin_clear_table(kind: str):
    """Clear Recent Requests (usage) or Activity Log (events).

    kind=requests -> DELETE FROM usage (wipes request history + revenue/cost totals)
    kind=events   -> DELETE FROM events (wipes activity log only)
    """
    db = get_db()
    if kind == "requests":
        cur = db.execute("DELETE FROM usage")
        deleted = cur.rowcount if cur.rowcount is not None else 0
        log.warning("admin clear: deleted %s usage rows (recent requests)", deleted)
        return jsonify({"status": "cleared", "kind": "requests", "rows_deleted": deleted})
    if kind == "events":
        cur = db.execute("DELETE FROM events")
        deleted = cur.rowcount if cur.rowcount is not None else 0
        log.warning("admin clear: deleted %s event rows (activity log)", deleted)
        return jsonify({"status": "cleared", "kind": "events", "rows_deleted": deleted})
    return jsonify({"error": "kind must be 'requests' or 'events'"}), 400


@app.route("/admin/customer/<int:customer_id>", methods=["DELETE"])
@require_admin
def admin_delete_customer(customer_id: int):
    """Destructive: permanently DELETE a customer and all associated
    API keys plus usage rows from the database."""
    db = get_db()
    exists = db.execute(
        "SELECT 1 FROM customers WHERE id = ?", (customer_id,)
    ).fetchone()
    if not exists:
        return jsonify({"error": "customer not found"}), 404
    db.execute(
        "DELETE FROM usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE customer_id = ?)",
        (customer_id,)
    )
    db.execute("DELETE FROM api_keys WHERE customer_id = ?", (customer_id,))
    db.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    log.warning("admin delete customer_id=%d", customer_id)
    return jsonify({"status": "deleted", "customer_id": customer_id})


@app.route("/admin/reset/<int:api_key_id>", methods=["POST"])
@require_admin
def admin_reset_for_key(api_key_id: int):
    """Destructive: DELETE FROM usage WHERE api_key_id = ?.
    Scoped per-key only — no full-database wipe route in prod.
    AGENTS.md CONFIRM rule applies before the human triggers this."""
    db = get_db()
    exists = db.execute(
        "SELECT 1 FROM api_keys WHERE id = ?", (api_key_id,)
    ).fetchone()
    if not exists:
        return jsonify({"error": "api_key not found"}), 404
    cur = db.execute(
        "DELETE FROM usage WHERE api_key_id = ?", (api_key_id,)
    )
    deleted = cur.rowcount
    log.warning("admin reset: deleted %d usage rows for api_key_id=%d", deleted, api_key_id)
    return jsonify({"status": "reset", "api_key_id": api_key_id, "rows_deleted": deleted})


# ── ROUTES: ADMIN RECOMPUTE (backfill revenue/cost on historical rows) ──────
@app.route("/admin/recompute-usage", methods=["POST"])
@require_admin
def admin_recompute_usage():
    """Recompute revenue_usd (and cost_usd where it's stale) on every usage row
    from the recorded token counts using the CURRENT pricing. Used to backfill
    historical rows written under an older revenue formula that double-counted
    or under-billed tokens.

    Body (JSON, all optional):
      { "apply": false }   # default = dry-run preview only, no writes
      { "apply": true }    # commit the UPDATE

    Revenue is recomputed from token counts (deterministic, always safe).
    Cost is recomputed with the blended fallback ONLY when the stored value is
    zero or clearly broken (negative / None); rows that have a real upstream
    cost are left untouched since we can't recover the original upstream number
    from token counts alone. The dry-run returns the old→new delta for revenue,
    cost, and profit at both the total and per-customer level so the operator
    can review before committing.
    """
    body = request.get_json(silent=True) or {}
    apply = bool(body.get("apply", False))

    db = get_db()

    # Per-customer totals BEFORE, from stored revenue/cost columns.
    before = db.execute(
        """SELECT k.customer_id,
                  COALESCE(SUM(u.cost_usd), 0)    AS cost,
                  COALESCE(SUM(u.revenue_usd), 0)  AS revenue
           FROM usage u
           JOIN api_keys k ON k.id = u.api_key_id
           GROUP BY k.customer_id"""
    ).fetchall()
    before_map = {r["customer_id"]: (r["cost"] or 0, r["revenue"] or 0)
                  for r in before}
    before_total_cost = sum(v[0] for v in before_map.values())
    before_total_revenue = sum(v[1] for v in before_map.values())

    # Walk every usage row, recompute both fields, and (if apply) write them.
    rows = db.execute(
        """SELECT u.id, k.customer_id,
                  u.input_tokens, u.output_tokens, u.cached_input_tokens,
                  u.cost_usd, u.revenue_usd
           FROM usage u
           JOIN api_keys k ON k.id = u.api_key_id"""
    ).fetchall()

    updates = []  # (row_id, new_rev, new_cost)
    per_customer_new = {}  # customer_id -> [new_rev, new_cost]
    for r in rows:
        new_rev = compute_revenue(
            r["input_tokens"], r["output_tokens"], r["cached_input_tokens"]
        )
        stored_cost = r["cost_usd"]
        # Only recompute cost when there's no usable upstream figure. A real
        # upstream cost is small-but-positive; a broken one is 0/negative/None.
        if stored_cost is None or stored_cost <= 0:
            new_cost = compute_cost(
                r["input_tokens"], r["output_tokens"], None
            )
        else:
            new_cost = stored_cost

        if (abs(new_rev - (r["revenue_usd"] or 0)) > 1e-9
                or abs(new_cost - (stored_cost or 0)) > 1e-9):
            updates.append((r["id"], new_rev, new_cost))

        bucket = per_customer_new.setdefault(r["customer_id"], [0.0, 0.0])
        bucket[0] += new_rev
        bucket[1] += new_cost

    if apply and updates:
        # Use individual execute() calls (not executemany) for parity with
        # record_usage()/admin_reset_for_key(), which persist reliably under
        # the connection's autocommit (isolation_level=None) config.
        for row_id, new_rev, new_cost in updates:
            db.execute(
                "UPDATE usage SET revenue_usd = ?, cost_usd = ? WHERE id = ?",
                (new_rev, new_cost, row_id),
            )
        db.commit()

    after_total_revenue = sum(v[0] for v in per_customer_new.values())
    after_total_cost = sum(v[1] for v in per_customer_new.values())

    per_customer = []
    for cust_id, (rev, cost) in sorted(per_customer_new.items()):
        old = before_map.get(cust_id, (0.0, 0.0))
        per_customer.append({
            "customer_id": cust_id,
            "revenue_before": round(old[1], 6),
            "revenue_after": round(rev, 6),
            "cost_before": round(old[0], 6),
            "cost_after": round(cost, 6),
            "profit_before": round(old[1] - old[0], 6),
            "profit_after": round(rev - cost, 6),
        })

    log.warning("admin recompute-usage: apply=%s rows_changed=%d",
                apply, len(updates))
    return jsonify({
        "applied": apply,
        "rows_changed": len(updates),
        "totals_before": {
            "revenue_usd": round(before_total_revenue, 6),
            "cost_usd": round(before_total_cost, 6),
            "profit_usd": round(before_total_revenue - before_total_cost, 6),
        },
        "totals_after": {
            "revenue_usd": round(after_total_revenue, 6),
            "cost_usd": round(after_total_cost, 6),
            "profit_usd": round(after_total_revenue - after_total_cost, 6),
        },
        "per_customer": per_customer,
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()})


# ── MAIN ────────────────────────────────────────────────────────────────────
with app.app_context():
    init_db()

if __name__ == "__main__":
    print(f"""
+==========================================================+
|   luv13 Proxy Server (multi-tenant)                     |
|   Running at:  http://localhost:{PORT}                      |
|   Admin:       http://localhost:{PORT}/admin/summary      |
|   No upstream read-timeout: long generations won't chop. |
+==========================================================+

Upstream account pool (names only — keys never printed):""")
    for i in range(1, NUM_UPSTREAM_KEYS + 1):
        print(f"  [{i}] {account_name(i)}")
    print("\nModel mappings:")
    for k, v in MODEL_MAP.items():
        print(f"  {k:<35} -> {v}")
    print()
    app.run(host="0.0.0.0", port=PORT, threaded=True)