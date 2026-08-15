import ast
import inspect
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("LUV13_CONFIG", str(API_ROOT / "tests" / "test-config.json"))

from app import config, db  # noqa: E402
from app.money import (  # noqa: E402
    RATE_UMICRO_PER_MILLION,
    cents_to_umicro,
    charge_umicro,
    umicro_to_usd_display,
)


LEGACY_SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL
);
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    last_used_at TEXT
);
CREATE TABLE requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id INTEGER NOT NULL REFERENCES api_keys(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    ts TEXT NOT NULL,
    model TEXT NOT NULL,
    upstream_model TEXT NOT NULL,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    tokens_cached INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0,
    status INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT
);
CREATE TABLE topups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


class Phase4MigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.original_db_path = config.DATABASE_PATH
        config.DATABASE_PATH = str(Path(self.tempdir.name) / "legacy.db")
        self.addCleanup(setattr, config, "DATABASE_PATH", self.original_db_path)

        with closing(sqlite3.connect(config.DATABASE_PATH)) as conn, conn:
            conn.executescript(LEGACY_SCHEMA)
            conn.execute(
                "INSERT INTO users (id, email, created_at) VALUES (7, 'kept@example.com', 'before')"
            )
            conn.execute(
                """INSERT INTO api_keys
                   (id, user_id, name, key_hash, key_prefix, created_at)
                   VALUES (11, 7, 'kept-key', 'hash', 'sk-luv13-kept...', 'before')"""
            )
            conn.execute(
                """INSERT INTO requests
                   (id, key_id, user_id, ts, model, upstream_model, tokens_in,
                    tokens_out, tokens_cached, cost_usd, status, latency_ms)
                   VALUES (13, 11, 7, 'before', 'luv-1', 'glm-5.2', 3000,
                           0, 0, 0.00099, 200, 12)"""
            )
            conn.execute(
                """INSERT INTO sessions
                   (id, user_id, token_hash, created_at, expires_at)
                   VALUES (17, 7, 'session-hash', 'before', 'after')"""
            )

    def test_migration_is_rerunnable_and_preserves_existing_data(self) -> None:
        db.migrate()
        db.migrate()

        with closing(sqlite3.connect(config.DATABASE_PATH)) as conn, conn:
            conn.row_factory = sqlite3.Row
            user_columns = {
                row["name"]: row for row in conn.execute("PRAGMA table_info(users)")
            }
            request_columns = {
                row["name"]: row for row in conn.execute("PRAGMA table_info(requests)")
            }
            user = conn.execute("SELECT * FROM users WHERE id = 7").fetchone()
            key = conn.execute("SELECT * FROM api_keys WHERE id = 11").fetchone()
            request = conn.execute("SELECT * FROM requests WHERE id = 13").fetchone()
            session = conn.execute("SELECT * FROM sessions WHERE id = 17").fetchone()

            self.assertEqual(user_columns["balance_umicro"]["type"], "INTEGER")
            self.assertEqual(user_columns["balance_umicro"]["notnull"], 1)
            self.assertEqual(user_columns["balance_umicro"]["dflt_value"], "0")
            self.assertEqual(request_columns["charge_umicro"]["type"], "INTEGER")
            self.assertEqual(user["email"], "kept@example.com")
            self.assertEqual(user["balance_umicro"], 0)
            self.assertEqual(key["name"], "kept-key")
            self.assertEqual(request["tokens_in"], 3000)
            self.assertAlmostEqual(request["cost_usd"], 0.00099)
            self.assertIsNone(request["charge_umicro"])
            self.assertEqual(session["token_hash"], "session-hash")

            topup_columns = {
                row["name"]: row["type"]
                for row in conn.execute("PRAGMA table_info(topups)")
            }
            self.assertEqual(topup_columns["amount_cents"], "INTEGER")
            self.assertEqual(topup_columns["status"], "TEXT")
            self.assertEqual(topup_columns["stripe_customer_id"], "TEXT")
            self.assertEqual(topup_columns["stripe_event_id"], "TEXT")

    def test_stripe_session_unique_index_is_rerunnable(self) -> None:
        db.migrate()
        with closing(sqlite3.connect(config.DATABASE_PATH)) as conn, conn:
            values = (7, 500, "cs_test_durable", "pending", "now", "now")
            conn.execute(
                """INSERT INTO topups
                   (user_id, amount_cents, stripe_session_id, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                values,
            )
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute(
                    """INSERT INTO topups
                       (user_id, amount_cents, stripe_session_id, status, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    values,
                )

    def test_wal_is_configured_by_migration_not_each_connection(self) -> None:
        db.migrate()
        conn = sqlite3.connect(config.DATABASE_PATH)
        try:
            self.assertEqual(conn.execute("PRAGMA journal_mode").fetchone()[0], "wal")
        finally:
            conn.close()
        self.assertNotIn("journal_mode", inspect.getsource(db._connect))


class IntegerMoneyTests(unittest.TestCase):
    def test_exact_floor_charges(self) -> None:
        self.assertEqual(RATE_UMICRO_PER_MILLION, 330_000)
        self.assertEqual(charge_umicro(3000), 990)
        self.assertEqual(charge_umicro(100), 33)
        self.assertEqual(charge_umicro(10), 3)

    def test_stripe_cents_conversion_and_display_boundary(self) -> None:
        self.assertEqual(cents_to_umicro(500), 5_000_000)
        self.assertEqual(umicro_to_usd_display(5_000_000), 5.0)

    def test_wallet_calculations_contain_no_float_math(self) -> None:
        tree = ast.parse((API_ROOT / "app" / "money.py").read_text(encoding="utf-8"))
        wallet_functions = {
            node.name: node
            for node in tree.body
            if isinstance(node, ast.FunctionDef)
            and node.name in {"charge_umicro", "cents_to_umicro"}
        }
        for name, function in wallet_functions.items():
            has_float_literal = any(
                isinstance(node, ast.Constant) and isinstance(node.value, float)
                for node in ast.walk(function)
            )
            self.assertFalse(
                has_float_literal
                or any(isinstance(node, ast.Div) for node in ast.walk(function)),
                f"{name} must use integer-only wallet math",
            )


class ModelConfigTests(unittest.TestCase):
    def test_dual_aliases_route_to_glm_with_integer_rates(self) -> None:
        self.assertEqual(set(config.MODELS), {"luv13-glm-5.2", "luv-1"})
        for alias in ("luv13-glm-5.2", "luv-1"):
            route = config.MODELS[alias]
            self.assertEqual(route.upstream, "glm-5.2")
            self.assertIs(type(route.rate_umicro_per_million), int)
            self.assertEqual(route.rate_umicro_per_million, 330_000)

    def test_float_sell_rate_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "positive integer"):
            config._load_models(
                {"luv13-glm-5.2": {"upstream": "glm-5.2", "rate_umicro_per_million": 0.33}}
            )

    def test_zero_sell_rate_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "positive integer"):
            config._load_models(
                {"luv13-glm-5.2": {"upstream": "glm-5.2", "rate_umicro_per_million": 0}}
            )

    def test_legacy_config_migration_preserves_root_secrets(self) -> None:
        legacy = {
            "admin_secret": "admin-placeholder",
            "upstream_api_key": "upstream-placeholder",
            "upstream_root": "http://proxy:4000",
            "rate_per_million_usd": 0.33,
            "models": {"luv-1": "glm-5.2"},
        }
        migrated = config.migrate_config_dict(legacy)
        self.assertEqual(migrated["admin_secret"], legacy["admin_secret"])
        self.assertEqual(migrated["upstream_api_key"], legacy["upstream_api_key"])
        self.assertEqual(migrated["upstream_root"], legacy["upstream_root"])
        self.assertEqual(legacy["models"], {"luv-1": "glm-5.2"})
        self.assertEqual(
            migrated["models"]["luv-1"],
            {"upstream": "glm-5.2", "rate_umicro_per_million": 330_000},
        )
        self.assertEqual(
            migrated["models"]["luv13-glm-5.2"],
            migrated["models"]["luv-1"],
        )


if __name__ == "__main__":
    unittest.main()
