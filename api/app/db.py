import hashlib
import os
import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from . import config
from .money import cents_to_umicro
from .money import charge_umicro as calculate_charge_umicro
from .money import umicro_to_usd_display

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL,
    balance_umicro INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    last_used_at TEXT
);
CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id INTEGER NOT NULL REFERENCES api_keys(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    ts TEXT NOT NULL,
    model TEXT NOT NULL,
    upstream_model TEXT NOT NULL,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    tokens_cached INTEGER NOT NULL DEFAULT 0,
    reservation_id TEXT,
    charge_umicro INTEGER,
    cost_usd REAL NOT NULL DEFAULT 0,
    status INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_requests_user_ts ON requests(user_id, ts);
CREATE INDEX IF NOT EXISTS idx_requests_key ON requests(key_id);
"""


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(config.DATABASE_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


def _configure_journal_mode() -> None:
    conn = sqlite3.connect(config.DATABASE_PATH, timeout=15)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
    finally:
        conn.close()


def init_db() -> None:
    os.makedirs(os.path.dirname(config.DATABASE_PATH) or ".", exist_ok=True)
    _configure_journal_mode()
    with _connect() as conn:
        conn.executescript(_SCHEMA)
    migrate()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def get_or_create_user(email: str) -> int:
    with _connect() as conn:
        row = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            return row["id"]
        cur = conn.execute("INSERT INTO users (email, created_at) VALUES (?, ?)", (email, _now()))
        return cur.lastrowid


def create_key(email: str, name: str) -> dict:
    user_id = get_or_create_user(email)
    key = "sk-luv13-" + secrets.token_hex(24)
    prefix = key[:17] + "..."
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO api_keys (user_id, name, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, name, _hash_key(key), prefix, _now()),
        )
        return {
            "id": cur.lastrowid,
            "email": email,
            "name": name,
            "key": key,  # full key returned only at creation time
            "key_prefix": prefix,
            "created_at": _now(),
        }


def lookup_key(key: str) -> dict | None:
    """Returns key record with user email if the key is valid and not revoked."""
    with _connect() as conn:
        row = conn.execute(
            """SELECT k.id, k.user_id, k.name, k.revoked_at, u.email
               FROM api_keys k JOIN users u ON u.id = k.user_id
               WHERE k.key_hash = ?""",
            (_hash_key(key),),
        ).fetchone()
        if row is None or row["revoked_at"] is not None:
            return None
        return dict(row)


def touch_key(key_id: int) -> None:
    with _connect() as conn:
        conn.execute("UPDATE api_keys SET last_used_at = ? WHERE id = ?", (_now(), key_id))


def list_keys(email: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT k.id, k.name, k.key_prefix, k.created_at, k.revoked_at, k.last_used_at
               FROM api_keys k JOIN users u ON u.id = k.user_id
               WHERE u.email = ? ORDER BY k.created_at DESC""",
            (email,),
        ).fetchall()
        return [dict(r) for r in rows]


def revoke_key(key_id: int) -> bool:
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
            (_now(), key_id),
        )
        return cur.rowcount > 0


def log_request(
    key_id: int,
    user_id: int,
    model: str,
    upstream_model: str,
    tokens_in: int,
    tokens_out: int,
    tokens_cached: int,
    charge_umicro: int,
    status: int,
    latency_ms: int,
) -> None:
    # cost_usd remains a display/history mirror. Integer charge_umicro is the
    # only value suitable for wallet reconciliation.
    cost_usd = umicro_to_usd_display(charge_umicro)
    with _connect() as conn:
        conn.execute(
            """INSERT INTO requests
               (key_id, user_id, ts, model, upstream_model, tokens_in, tokens_out,
                tokens_cached, charge_umicro, cost_usd, status, latency_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                key_id,
                user_id,
                _now(),
                model,
                upstream_model,
                tokens_in,
                tokens_out,
                tokens_cached,
                charge_umicro,
                cost_usd,
                status,
                latency_ms,
            ),
        )


def usage_log(email: str, limit: int = 100, offset: int = 0) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT r.id, r.ts, r.model, r.tokens_in, r.tokens_out, r.tokens_cached,
                      r.charge_umicro, r.cost_usd, r.status, r.latency_ms,
                      k.name AS key_name, k.key_prefix
               FROM requests r
               JOIN users u ON u.id = r.user_id
               JOIN api_keys k ON k.id = r.key_id
               WHERE u.email = ?
               ORDER BY r.ts DESC LIMIT ? OFFSET ?""",
            (email, limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def usage_summary(email: str) -> dict:
    with _connect() as conn:
        row = conn.execute(
            """SELECT COUNT(*) AS total_requests,
                      COALESCE(SUM(r.tokens_in), 0) AS tokens_in,
                      COALESCE(SUM(r.tokens_out), 0) AS tokens_out,
                      COALESCE(SUM(r.tokens_cached), 0) AS tokens_cached,
                      COALESCE(SUM(r.cost_usd), 0) AS total_cost_usd
               FROM requests r JOIN users u ON u.id = r.user_id
               WHERE u.email = ?""",
            (email,),
        ).fetchone()
        d = dict(row)
        d["total_tokens"] = d["tokens_in"] + d["tokens_out"]
        d["email"] = email
        return d


def monthly_tokens(user_id: int) -> int:
    """Total tokens (in+out) used by a user in the current UTC month."""
    month_start = datetime.now(timezone.utc).strftime("%Y-%m-01")
    with _connect() as conn:
        row = conn.execute(
            "SELECT COALESCE(SUM(tokens_in + tokens_out), 0) AS t FROM requests WHERE user_id = ? AND ts >= ?",
            (user_id, month_start),
        ).fetchone()
        return row["t"]


def list_users() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT u.email, u.created_at,
                      COUNT(r.id) AS total_requests,
                      COALESCE(SUM(r.tokens_in + r.tokens_out), 0) AS total_tokens,
                      COALESCE(SUM(r.cost_usd), 0) AS total_cost_usd
               FROM users u LEFT JOIN requests r ON r.user_id = u.id
               GROUP BY u.id ORDER BY u.created_at""",
        ).fetchall()
        return [dict(r) for r in rows]


# ---------- auth migration (idempotent — runs on every boot) ----------

_AUTH_USER_COLUMNS = {
    "password_hash": "TEXT",
    "google_sub": "TEXT",
    "name": "TEXT",
    "picture_url": "TEXT",
    "updated_at": "TEXT",
}

_AUTH_SCHEMA = """
-- SQLite cannot ADD COLUMN ... UNIQUE; google_sub uniqueness is a partial index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
  ON users(google_sub) WHERE google_sub IS NOT NULL;
-- users.email is already UNIQUE COLLATE NOCASE, so this cannot collide;
-- kept as an explicit case-insensitive guard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email));
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events(user_id, created_at);
"""

_WALLET_SCHEMA = """
CREATE TABLE IF NOT EXISTS topups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    stripe_customer_id TEXT,
    stripe_event_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed', 'expired')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
-- SQLite cannot add a UNIQUE column with ALTER TABLE. A separate partial
-- unique index is rerunnable and permits multiple pre-Stripe NULL rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_topups_stripe_session_id
  ON topups(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_topups_user_created
  ON topups(user_id, created_at);
CREATE TABLE IF NOT EXISTS credit_reservations (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    key_id INTEGER NOT NULL REFERENCES api_keys(id),
    model TEXT NOT NULL,
    upstream_model TEXT NOT NULL,
    estimated_input_tokens INTEGER NOT NULL,
    fallback_input_tokens INTEGER NOT NULL,
    reserved_umicro INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'settled')),
    final_charge_umicro INTEGER,
    terminal_status INTEGER,
    created_at TEXT NOT NULL,
    settled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_status
  ON credit_reservations(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_reservation_id
  ON requests(reservation_id) WHERE reservation_id IS NOT NULL;
"""


def migrate() -> None:
    """Idempotent auth/wallet migration — safe to run on every restart."""
    _configure_journal_mode()
    with _connect() as conn:
        existing = {r["name"] for r in conn.execute("PRAGMA table_info(users)")}
        for col, col_type in _AUTH_USER_COLUMNS.items():
            if col not in existing:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} {col_type}")
        if "balance_umicro" not in existing:
            conn.execute(
                "ALTER TABLE users ADD COLUMN balance_umicro INTEGER NOT NULL DEFAULT 0"
            )

        request_columns = {
            r["name"] for r in conn.execute("PRAGMA table_info(requests)")
        }
        if "charge_umicro" not in request_columns:
            conn.execute("ALTER TABLE requests ADD COLUMN charge_umicro INTEGER")
        if "reservation_id" not in request_columns:
            conn.execute("ALTER TABLE requests ADD COLUMN reservation_id TEXT")

        conn.executescript(_AUTH_SCHEMA)
        conn.executescript(_WALLET_SCHEMA)
        reservation_columns = {
            r["name"] for r in conn.execute("PRAGMA table_info(credit_reservations)")
        }
        if "fallback_input_tokens" not in reservation_columns:
            conn.execute(
                """ALTER TABLE credit_reservations
                   ADD COLUMN fallback_input_tokens INTEGER NOT NULL DEFAULT 1"""
            )
        topup_columns = {
            r["name"] for r in conn.execute("PRAGMA table_info(topups)")
        }
        for column in (
            "stripe_payment_intent_id",
            "stripe_customer_id",
            "stripe_event_id",
        ):
            if column not in topup_columns:
                conn.execute(f"ALTER TABLE topups ADD COLUMN {column} TEXT")
        conn.execute(
            """CREATE UNIQUE INDEX IF NOT EXISTS idx_topups_stripe_event_id
               ON topups(stripe_event_id) WHERE stripe_event_id IS NOT NULL"""
        )


# ---------- Stripe top-ups ----------

def create_pending_topup(user_id: int, amount_cents: int) -> int:
    if isinstance(amount_cents, bool) or not isinstance(amount_cents, int) or amount_cents <= 0:
        raise ValueError("amount_cents must be a positive integer")
    now = _now()
    with _connect() as conn:
        cur = conn.execute(
            """INSERT INTO topups
               (user_id, amount_cents, status, created_at, updated_at)
               VALUES (?, ?, 'pending', ?, ?)""",
            (user_id, amount_cents, now, now),
        )
        return cur.lastrowid


def attach_checkout_session(
    topup_id: int,
    user_id: int,
    stripe_session_id: str,
    stripe_payment_intent_id: str | None,
    stripe_customer_id: str | None,
) -> bool:
    with _connect() as conn:
        cur = conn.execute(
            """UPDATE topups
               SET stripe_session_id = COALESCE(stripe_session_id, ?),
                   stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?),
                   stripe_customer_id = COALESCE(stripe_customer_id, ?),
                   updated_at = ?
               WHERE id = ? AND user_id = ? AND status = 'pending'
                 AND (stripe_session_id IS NULL OR stripe_session_id = ?)""",
            (
                stripe_session_id,
                stripe_payment_intent_id,
                stripe_customer_id,
                _now(),
                topup_id,
                user_id,
                stripe_session_id,
            ),
        )
        return cur.rowcount == 1


def get_pending_topup_for_retry(
    topup_id: int,
    user_id: int,
    amount_cents: int,
) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            """SELECT * FROM topups
               WHERE id = ? AND user_id = ? AND amount_cents = ?
                 AND status = 'pending'""",
            (topup_id, user_id, amount_cents),
        ).fetchone()
        return dict(row) if row else None


def fail_pending_topup(topup_id: int, user_id: int) -> None:
    with _connect() as conn:
        conn.execute(
            """UPDATE topups SET status = 'failed', updated_at = ?
               WHERE id = ? AND user_id = ? AND status = 'pending'""",
            (_now(), topup_id, user_id),
        )


def complete_checkout_topup(
    *,
    event_id: str,
    stripe_session_id: str,
    amount_total: int,
    currency: str,
    payment_status: str,
    stripe_payment_intent_id: str | None,
    stripe_customer_id: str | None,
    client_reference_id: str | None,
    metadata_topup_id: str | None,
    metadata_user_id: str | None,
) -> dict:
    """Validate persisted checkout facts and credit a pending top-up once."""
    if not event_id or not stripe_session_id:
        return {"result": "mismatch", "credited": False}
    if isinstance(amount_total, bool) or not isinstance(amount_total, int):
        return {"result": "mismatch", "credited": False}

    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        topup = conn.execute(
            "SELECT * FROM topups WHERE stripe_session_id = ?",
            (stripe_session_id,),
        ).fetchone()
        if topup is None:
            try:
                recovery_topup_id = int(metadata_topup_id or "")
            except (TypeError, ValueError):
                return {"result": "not_found", "credited": False}
            topup = conn.execute(
                "SELECT * FROM topups WHERE id = ?",
                (recovery_topup_id,),
            ).fetchone()
            if topup is None:
                return {"result": "not_found", "credited": False}

        expected_topup = str(topup["id"])
        expected_user = str(topup["user_id"])
        event_owner = conn.execute(
            "SELECT id FROM topups WHERE stripe_event_id = ?",
            (event_id,),
        ).fetchone()
        session_owner = conn.execute(
            "SELECT id FROM topups WHERE stripe_session_id = ?",
            (stripe_session_id,),
        ).fetchone()
        mismatch = (
            amount_total != topup["amount_cents"]
            or currency.lower() != "usd"
            or payment_status != "paid"
            or client_reference_id != expected_topup
            or metadata_topup_id != expected_topup
            or metadata_user_id != expected_user
            or (
                topup["stripe_session_id"] is not None
                and topup["stripe_session_id"] != stripe_session_id
            )
            or (
                topup["stripe_payment_intent_id"] is not None
                and stripe_payment_intent_id != topup["stripe_payment_intent_id"]
            )
            or (
                topup["stripe_customer_id"] is not None
                and stripe_customer_id != topup["stripe_customer_id"]
            )
            or (event_owner is not None and event_owner["id"] != topup["id"])
            or (session_owner is not None and session_owner["id"] != topup["id"])
        )
        if mismatch:
            return {"result": "mismatch", "credited": False}
        if topup["status"] == "completed":
            return {"result": "replay", "credited": False}
        if topup["status"] != "pending":
            return {"result": "ignored_status", "credited": False}

        credited_umicro = cents_to_umicro(topup["amount_cents"])
        transitioned = conn.execute(
            """UPDATE topups
               SET status = 'completed', stripe_event_id = ?,
                   stripe_session_id = COALESCE(stripe_session_id, ?),
                   stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?),
                   stripe_customer_id = COALESCE(stripe_customer_id, ?),
                   updated_at = ?
               WHERE id = ? AND status = 'pending'""",
            (
                event_id,
                stripe_session_id,
                stripe_payment_intent_id,
                stripe_customer_id,
                _now(),
                topup["id"],
            ),
        )
        if transitioned.rowcount != 1:
            return {"result": "replay", "credited": False}
        conn.execute(
            "UPDATE users SET balance_umicro = balance_umicro + ? WHERE id = ?",
            (credited_umicro, topup["user_id"]),
        )
        return {
            "result": "credited",
            "credited": True,
            "credited_umicro": credited_umicro,
        }


def list_topups_for_user(user_id: int, limit: int = 100) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT id, amount_cents, status, created_at, updated_at
               FROM topups WHERE user_id = ?
               ORDER BY created_at DESC, id DESC LIMIT ?""",
            (user_id, min(max(limit, 1), 100)),
        ).fetchall()
        return [dict(row) for row in rows]


# ---------- transactional wallet reservations ----------

def reserve_credit(
    key_id: int,
    user_id: int,
    model: str,
    upstream_model: str,
    estimated_input_tokens: int,
    fallback_input_tokens: int,
    rate_umicro_per_million: int,
    output_budget_tokens: int,
    output_floor_tokens: int,
) -> dict | None:
    """Atomically reserve the full budget, or all affordable credit above the floor."""
    full_umicro = calculate_charge_umicro(
        estimated_input_tokens + output_budget_tokens,
        rate_umicro_per_million,
    )
    minimum_umicro = calculate_charge_umicro(
        estimated_input_tokens + output_floor_tokens,
        rate_umicro_per_million,
    )
    minimum_umicro = max(1, minimum_umicro)
    reservation_id = "rsv_" + secrets.token_hex(16)

    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT balance_umicro FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None or row["balance_umicro"] < minimum_umicro:
            return None

        reserved_umicro = min(row["balance_umicro"], full_umicro)
        updated = conn.execute(
            """UPDATE users
               SET balance_umicro = balance_umicro - ?
               WHERE id = ? AND balance_umicro >= ?""",
            (reserved_umicro, user_id, reserved_umicro),
        )
        if updated.rowcount != 1:
            return None
        conn.execute(
            """INSERT INTO credit_reservations
               (id, user_id, key_id, model, upstream_model, estimated_input_tokens,
                fallback_input_tokens, reserved_umicro, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)""",
            (
                reservation_id,
                user_id,
                key_id,
                model,
                upstream_model,
                estimated_input_tokens,
                fallback_input_tokens,
                reserved_umicro,
                _now(),
            ),
        )
        return {
            "id": reservation_id,
            "user_id": user_id,
            "key_id": key_id,
            "model": model,
            "upstream_model": upstream_model,
            "estimated_input_tokens": estimated_input_tokens,
            "fallback_input_tokens": fallback_input_tokens,
            "reserved_umicro": reserved_umicro,
        }


def settle_reservation(
    reservation_id: str,
    charge_umicro: int,
    tokens_in: int,
    tokens_out: int,
    tokens_cached: int,
    status: int,
    latency_ms: int,
) -> dict:
    """Settle once, refund the unused reserve, and write one usage row atomically."""
    if isinstance(charge_umicro, bool) or not isinstance(charge_umicro, int) or charge_umicro < 0:
        raise ValueError("charge_umicro must be a non-negative integer")

    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        reservation = conn.execute(
            "SELECT * FROM credit_reservations WHERE id = ?",
            (reservation_id,),
        ).fetchone()
        if reservation is None:
            raise ValueError("unknown credit reservation")
        if reservation["status"] == "settled":
            return {
                "charge_umicro": reservation["final_charge_umicro"],
                "settled": False,
            }

        final_charge = min(charge_umicro, reservation["reserved_umicro"])
        refund = reservation["reserved_umicro"] - final_charge
        updated = conn.execute(
            """UPDATE credit_reservations
               SET status = 'settled', final_charge_umicro = ?,
                   terminal_status = ?, settled_at = ?
               WHERE id = ? AND status = 'active'""",
            (final_charge, status, _now(), reservation_id),
        )
        if updated.rowcount != 1:
            current = conn.execute(
                "SELECT final_charge_umicro FROM credit_reservations WHERE id = ?",
                (reservation_id,),
            ).fetchone()
            return {"charge_umicro": current["final_charge_umicro"], "settled": False}

        conn.execute(
            "UPDATE users SET balance_umicro = balance_umicro + ? WHERE id = ?",
            (refund, reservation["user_id"]),
        )
        conn.execute(
            """INSERT INTO requests
               (key_id, user_id, ts, model, upstream_model, tokens_in, tokens_out,
                tokens_cached, reservation_id, charge_umicro, cost_usd, status, latency_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                reservation["key_id"],
                reservation["user_id"],
                _now(),
                reservation["model"],
                reservation["upstream_model"],
                tokens_in,
                tokens_out,
                tokens_cached,
                reservation_id,
                final_charge,
                umicro_to_usd_display(final_charge),
                status,
                latency_ms,
            ),
        )
        return {"charge_umicro": final_charge, "settled": True}


def get_balance_umicro(user_id: int) -> int:
    with _connect() as conn:
        row = conn.execute(
            "SELECT balance_umicro FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            raise ValueError("unknown user")
        return row["balance_umicro"]


def recover_active_reservations() -> int:
    """Settle reservations left by a prior single-worker process crash."""
    with _connect() as conn:
        active = [
            dict(row)
            for row in conn.execute(
                """SELECT id, model, fallback_input_tokens
                   FROM credit_reservations WHERE status = 'active'"""
            )
        ]

    recovered = 0
    for reservation in active:
        route = config.MODELS.get(reservation["model"])
        estimated_charge = 1
        if route is not None:
            estimated_charge = max(
                1,
                calculate_charge_umicro(
                    reservation["fallback_input_tokens"],
                    route.rate_umicro_per_million,
                ),
            )
        result = settle_reservation(
            reservation["id"],
            estimated_charge,
            0,
            0,
            0,
            503,
            0,
        )
        recovered += int(result["settled"])
    return recovered


# ---------- users / auth ----------

def get_user_by_id(user_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


def get_user_by_google_sub(google_sub: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE google_sub = ?", (google_sub,)).fetchone()
        return dict(row) if row else None


def create_user_with_password(email: str, password_hash: str, name: str | None = None) -> dict | None:
    """Returns the new user row, or None if the email is already taken."""
    with _connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (email, created_at, password_hash, name, updated_at)"
                " VALUES (?, ?, ?, ?, ?)",
                (email, _now(), password_hash, name, _now()),
            )
        except sqlite3.IntegrityError:
            return None
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def create_google_user(email: str, google_sub: str, name: str | None, picture_url: str | None) -> dict:
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO users (email, created_at, google_sub, name, picture_url, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (email, _now(), google_sub, name, picture_url, _now()),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def link_google_account(user_id: int, google_sub: str, name: str | None, picture_url: str | None) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE users SET google_sub = ?, name = COALESCE(?, name), picture_url = ?,"
            " updated_at = ? WHERE id = ?",
            (google_sub, name, picture_url, _now(), user_id),
        )


def update_google_profile(user_id: int, name: str | None, picture_url: str | None) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE users SET name = COALESCE(?, name), picture_url = ?, updated_at = ? WHERE id = ?",
            (name, picture_url, _now(), user_id),
        )


# ---------- sessions ----------

def insert_session(user_id: int, token_hash: str, created_at: str, expires_at: str,
                   ip_address: str | None, user_agent: str | None) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sessions (user_id, token_hash, created_at, expires_at, ip_address, user_agent)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, token_hash, created_at, expires_at, ip_address, user_agent),
        )


def get_session(token_hash: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE token_hash = ?", (token_hash,)).fetchone()
        return dict(row) if row else None


def delete_session(token_hash: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        return cur.rowcount > 0


def delete_expired_sessions(now_iso: str) -> int:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now_iso,))
        return cur.rowcount


# ---------- login events ----------

def log_login_event(user_id: int | None, email: str | None, provider: str, event_type: str,
                    ip_address: str | None, user_agent: str | None) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO login_events (user_id, email, provider, event_type, ip_address, user_agent,"
            " created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, email, provider, event_type, ip_address, user_agent, _now()),
        )


# ---------- per-user key helpers (cookie path) ----------

def count_active_keys(user_id: int) -> int:
    with _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM api_keys WHERE user_id = ? AND revoked_at IS NULL",
            (user_id,),
        ).fetchone()
        return row["c"]


def list_keys_by_user_id(user_id: int) -> list[dict]:
    # Prefix-only fields: key_hash is never selected here.
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, name, key_prefix, created_at, revoked_at, last_used_at"
            " FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def revoke_key_for_user(key_id: int, user_id: int) -> bool:
    """Revoke only if the key belongs to this user (no cross-user access)."""
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
            (_now(), key_id, user_id),
        )
        return cur.rowcount > 0


def usage_30d(user_id: int) -> dict:
    """Last-30-day totals straight from the requests table's existing cost_usd."""
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    with _connect() as conn:
        row = conn.execute(
            """SELECT COUNT(*) AS requests,
                      COALESCE(SUM(tokens_in), 0) AS tokens_in,
                      COALESCE(SUM(tokens_out), 0) AS tokens_out,
                      COALESCE(SUM(tokens_cached), 0) AS tokens_cached,
                      COALESCE(SUM(cost_usd), 0) AS cost_usd
               FROM requests WHERE user_id = ? AND ts >= ?""",
            (user_id, since),
        ).fetchone()
        return dict(row)


def recent_usage_by_user_id(user_id: int, limit: int = 50) -> list[dict]:
    """Recent customer-visible usage, scoped exclusively by the session user."""
    with _connect() as conn:
        rows = conn.execute(
            """SELECT id, ts, model, tokens_in, tokens_out, charge_umicro,
                      cost_usd, status
               FROM requests
               WHERE user_id = ?
               ORDER BY ts DESC, id DESC
               LIMIT ?""",
            (user_id, min(max(limit, 1), 100)),
        ).fetchall()
        return [dict(row) for row in rows]
