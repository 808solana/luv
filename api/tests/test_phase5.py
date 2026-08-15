import asyncio
import json
import os
import sqlite3
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

import httpx
from starlette.requests import Request

API_ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("LUV13_CONFIG", str(API_ROOT / "tests" / "test-config.json"))

from app import auth, config, db, main  # noqa: E402
from app.money import OUTPUT_BUDGET_TOKENS, charge_umicro  # noqa: E402


class FakeResponse:
    def __init__(self, status_code=200, data=None):
        self.status_code = status_code
        self._data = data

    def json(self):
        return self._data


class FakeUpstream:
    def __init__(self, lines=None, status_code=200, error=None):
        self.lines = lines or []
        self.status_code = status_code
        self.error = error
        self.closed = False

    async def aiter_lines(self):
        for line in self.lines:
            yield line
        if self.error:
            raise self.error

    async def aread(self):
        return b'{"error":"upstream"}'

    async def aclose(self):
        self.closed = True


class FakeHTTP:
    def __init__(self, response=None, upstream=None, error=None):
        self.response = response
        self.upstream = upstream
        self.error = error
        self.calls = 0
        self.last_json = None

    async def post(self, path, json=None, headers=None):
        self.calls += 1
        self.last_json = json
        if self.error:
            raise self.error
        return self.response

    def build_request(self, method, path, json=None, headers=None, **kwargs):
        self.last_json = json
        return {"method": method, "path": path}

    async def send(self, request, stream=False):
        self.calls += 1
        if self.error:
            raise self.error
        return self.upstream


class WalletDatabaseCase(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.original_db_path = config.DATABASE_PATH
        config.DATABASE_PATH = str(Path(self.tempdir.name) / "phase5.db")
        self.addCleanup(setattr, config, "DATABASE_PATH", self.original_db_path)
        db.init_db()
        created = db.create_key("wallet@example.com", "test")
        self.key = db.lookup_key(created["key"])
        self.secret = created["key"]

    def set_balance(self, amount):
        conn = sqlite3.connect(config.DATABASE_PATH)
        try:
            conn.execute(
                "UPDATE users SET balance_umicro = ? WHERE id = ?",
                (amount, self.key["user_id"]),
            )
            conn.commit()
        finally:
            conn.close()

    def rows(self, query, params=()):
        conn = sqlite3.connect(config.DATABASE_PATH)
        try:
            conn.row_factory = sqlite3.Row
            return [dict(row) for row in conn.execute(query, params)]
        finally:
            conn.close()

    def reserve(self, estimated_input=100):
        route = config.MODELS["luv13-glm-5.2"]
        return db.reserve_credit(
            self.key["id"],
            self.key["user_id"],
            "luv13-glm-5.2",
            route.upstream,
            estimated_input,
            max(1, (estimated_input + 3) // 4),
            route.rate_umicro_per_million,
            OUTPUT_BUDGET_TOKENS,
            config.OUTPUT_FLOOR_TOKENS,
        )


class ReservationTests(WalletDatabaseCase):
    def test_zero_balance_returns_no_reservation(self):
        self.set_balance(0)
        self.assertIsNone(self.reserve())
        self.assertEqual(self.rows("SELECT * FROM credit_reservations"), [])

    def test_low_balance_gets_best_effort_reservation(self):
        self.set_balance(100)
        reservation = self.reserve(10)
        self.assertIsNotNone(reservation)
        self.assertEqual(reservation["reserved_umicro"], 100)
        self.assertEqual(db.get_balance_umicro(self.key["user_id"]), 0)

    def test_normal_settlement_refunds_remainder(self):
        self.set_balance(10_000)
        reservation = self.reserve()
        self.assertEqual(
            reservation["reserved_umicro"],
            charge_umicro(100 + 8000),
        )
        result = db.settle_reservation(
            reservation["id"], 990, 3000, 0, 0, 200, 12
        )
        self.assertTrue(result["settled"])
        self.assertEqual(db.get_balance_umicro(self.key["user_id"]), 9_010)
        request = self.rows("SELECT * FROM requests")[0]
        self.assertEqual(request["charge_umicro"], 990)
        self.assertEqual(request["cost_usd"], 0.00099)

    def test_settlement_is_idempotent(self):
        self.set_balance(10_000)
        reservation = self.reserve()
        first = db.settle_reservation(
            reservation["id"], 990, 3000, 0, 0, 200, 12
        )
        second = db.settle_reservation(
            reservation["id"], 2000, 9000, 0, 0, 500, 20
        )
        self.assertTrue(first["settled"])
        self.assertFalse(second["settled"])
        self.assertEqual(second["charge_umicro"], 990)
        self.assertEqual(len(self.rows("SELECT * FROM requests")), 1)
        self.assertEqual(db.get_balance_umicro(self.key["user_id"]), 9_010)

    def test_concurrent_reservations_cannot_double_spend(self):
        full = charge_umicro(100 + OUTPUT_BUDGET_TOKENS)
        self.set_balance(full)
        barrier = threading.Barrier(2)

        def attempt():
            barrier.wait()
            return self.reserve()

        with ThreadPoolExecutor(max_workers=2) as pool:
            reservations = list(pool.map(lambda _: attempt(), range(2)))
        self.assertEqual(sum(item is not None for item in reservations), 1)
        self.assertEqual(db.get_balance_umicro(self.key["user_id"]), 0)

    def test_startup_recovery_releases_crash_stranded_reservation_once(self):
        self.set_balance(10_000)
        reservation = self.reserve(100)
        self.assertEqual(db.recover_active_reservations(), 1)
        self.assertEqual(db.recover_active_reservations(), 0)
        recovered = self.rows(
            "SELECT * FROM credit_reservations WHERE id = ?",
            (reservation["id"],),
        )[0]
        self.assertEqual(recovered["status"], "settled")
        self.assertEqual(recovered["terminal_status"], 503)
        self.assertGreater(recovered["final_charge_umicro"], 0)
        self.assertEqual(len(self.rows("SELECT * FROM requests")), 1)


class APIEnforcementTests(WalletDatabaseCase, unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        super().setUp()
        self.original_http = main._http
        self.addCleanup(setattr, main, "_http", self.original_http)
        main._rate_windows.clear()

    async def post_chat(self, payload):
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.post(
                "/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.secret}"},
                json=payload,
            )

    async def test_zero_balance_is_exact_402_without_upstream(self):
        self.set_balance(0)
        fake = FakeHTTP()
        main._http = fake
        response = await self.post_chat(
            {"model": "luv13-glm-5.2", "messages": [{"role": "user", "content": "hi"}]}
        )
        self.assertEqual(response.status_code, 402)
        self.assertEqual(
            response.json()["detail"]["error"]["message"],
            main.OUT_OF_CREDITS_MESSAGE,
        )
        self.assertEqual(
            main.OUT_OF_CREDITS_MESSAGE,
            "You're out of credits. Top up here: https://luv13.ai/top-up",
        )
        self.assertEqual(fake.calls, 0)

    async def test_malformed_fields_and_n_reject_before_reservation(self):
        self.set_balance(10_000)
        main._http = FakeHTTP()
        invalid_payloads = [
            {"model": "luv13-glm-5.2", "messages": [], "stream": True, "stream_options": []},
            {"model": "luv13-glm-5.2", "messages": [], "n": 2},
            {"model": "luv13-glm-5.2", "messages": [], "stream": True, "n": 2},
            {"model": "luv13-glm-5.2", "messages": [], "max_tokens": "8000"},
            {"model": "luv13-glm-5.2", "messages": "not-an-array"},
        ]
        for payload in invalid_payloads:
            main._rate_windows.clear()
            with self.subTest(payload=payload):
                response = await self.post_chat(payload)
                self.assertEqual(response.status_code, 400)
        self.assertEqual(self.rows("SELECT * FROM credit_reservations"), [])
        self.assertEqual(db.get_balance_umicro(self.key["user_id"]), 10_000)
        self.assertEqual(main._http.calls, 0)

    async def test_key_touch_failure_settles_once(self):
        self.set_balance(10_000)
        main._http = FakeHTTP()
        with patch("app.main.db.touch_key", side_effect=RuntimeError("touch failed")):
            response = await self.post_chat(
                {"model": "luv13-glm-5.2", "messages": [{"role": "user", "content": "hi"}]}
            )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(len(self.rows("SELECT * FROM requests")), 1)
        reservation = self.rows("SELECT * FROM credit_reservations")[0]
        self.assertEqual(reservation["status"], "settled")

    async def test_output_cap_failure_settles_once(self):
        self.set_balance(10_000)
        main._http = FakeHTTP()
        with patch("app.main._cap_output_budget", side_effect=RuntimeError("cap failed")):
            response = await self.post_chat(
                {"model": "luv13-glm-5.2", "messages": [{"role": "user", "content": "hi"}]}
            )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(len(self.rows("SELECT * FROM requests")), 1)

    async def test_stream_request_construction_failure_settles_once(self):
        self.set_balance(10_000)
        fake = FakeHTTP()
        fake.build_request = lambda *args, **kwargs: (_ for _ in ()).throw(
            RuntimeError("build failed")
        )
        main._http = fake
        response = await self.post_chat(
            {
                "model": "luv13-glm-5.2",
                "stream": True,
                "messages": [{"role": "user", "content": "hi"}],
            }
        )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(len(self.rows("SELECT * FROM requests")), 1)

    async def test_normal_response_settles_observed_usage_and_caps_output(self):
        self.set_balance(10_000)
        fake = FakeHTTP(
            response=FakeResponse(
                data={
                    "model": "glm-5.2",
                    "choices": [{"message": {"content": "ok"}}],
                    "usage": {"prompt_tokens": 3000, "completion_tokens": 0},
                }
            )
        )
        main._http = fake
        response = await self.post_chat(
            {"model": "luv-1", "messages": [{"role": "user", "content": "hi"}]}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(fake.last_json["max_tokens"], 8000)
        self.assertEqual(db.get_balance_umicro(self.key["user_id"]), 9_010)

    async def test_forced_cut_closes_upstream_and_emits_exact_message(self):
        self.set_balance(100)
        first = {
            "id": "chatcmpl-test",
            "object": "chat.completion.chunk",
            "created": 1,
            "model": "glm-5.2",
            "choices": [{"index": 0, "delta": {"content": "a" * 100}}],
        }
        second = {
            **first,
            "choices": [{"index": 0, "delta": {"content": "b" * 2000}}],
        }
        upstream = FakeUpstream(
            lines=[
                "data: " + json.dumps(first),
                "",
                "data: " + json.dumps(second),
                "",
                "data: [DONE]",
                "",
            ]
        )
        fake = FakeHTTP(upstream=upstream)
        main._http = fake
        response = await self.post_chat(
            {
                "model": "luv13-glm-5.2",
                "stream": True,
                "messages": [{"role": "user", "content": "hi"}],
            }
        )
        self.assertEqual(response.status_code, 200)
        self.assertLess(fake.last_json["max_tokens"], OUTPUT_BUDGET_TOKENS)
        self.assertEqual(response.text.count(main.OUT_OF_CREDITS_MESSAGE), 1)
        self.assertTrue(response.text.rstrip().endswith("data: [DONE]"))
        self.assertTrue(upstream.closed)
        reservation = self.rows("SELECT * FROM credit_reservations")[0]
        self.assertEqual(reservation["status"], "settled")
        self.assertEqual(reservation["terminal_status"], 402)
        self.assertGreater(reservation["final_charge_umicro"], 0)

    async def test_tool_call_delta_is_untouched(self):
        self.set_balance(10_000)
        tool_delta = {
            "tool_calls": [{
                "index": 0,
                "id": "call_1",
                "type": "function",
                "function": {"name": "lookup", "arguments": '{"q":"x"}'},
            }]
        }
        tool_chunk = {
            "id": "chatcmpl-tools",
            "model": "glm-5.2",
            "choices": [{"index": 0, "delta": tool_delta}],
        }
        usage_chunk = {
            "id": "chatcmpl-tools",
            "model": "glm-5.2",
            "choices": [],
            "usage": {"prompt_tokens": 120, "completion_tokens": 45},
        }
        upstream = FakeUpstream(
            lines=[
                "data: " + json.dumps(tool_chunk),
                "",
                "data: " + json.dumps(usage_chunk),
                "",
                "data: [DONE]",
                "",
            ]
        )
        main._http = FakeHTTP(upstream=upstream)
        response = await self.post_chat(
            {
                "model": "luv13-glm-5.2",
                "stream": True,
                "messages": [{"role": "user", "content": "use a tool"}],
            }
        )
        chunks = [
            json.loads(line[6:])
            for line in response.text.splitlines()
            if line.startswith("data: ") and line != "data: [DONE]"
        ]
        self.assertEqual(chunks[0]["choices"][0]["delta"], tool_delta)

    async def test_tool_call_without_usage_retains_bounded_reserve(self):
        self.set_balance(10_000)
        reservation = self.reserve()
        tool_chunk = {
            "id": "chatcmpl-tools-fallback",
            "model": "glm-5.2",
            "choices": [{"index": 0, "delta": {"tool_calls": [{"index": 0}]}}],
        }
        upstream = FakeUpstream(
            lines=["data: " + json.dumps(tool_chunk), ""],
            error=RuntimeError("relay failed"),
        )
        main._http = FakeHTTP(upstream=upstream)
        settlement = main._SettlementGuard(reservation, 0.0)
        response = await main._stream_chat(
            {"model": "glm-5.2", "stream": True, "messages": []},
            settlement,
            "luv13-glm-5.2",
        )
        with self.assertRaises(RuntimeError):
            async for _ in response.body_iterator:
                pass
        row = self.rows(
            "SELECT * FROM credit_reservations WHERE id = ?",
            (reservation["id"],),
        )[0]
        self.assertEqual(row["final_charge_umicro"], reservation["reserved_umicro"])

    async def test_nonstream_tool_call_without_usage_retains_reserve(self):
        self.set_balance(10_000)
        main._http = FakeHTTP(
            response=FakeResponse(
                data={
                    "model": "glm-5.2",
                    "choices": [{"message": {"tool_calls": [{"id": "call_1"}]}}],
                }
            )
        )
        response = await self.post_chat(
            {"model": "luv13-glm-5.2", "messages": [{"role": "user", "content": "tool"}]}
        )
        self.assertEqual(response.status_code, 200)
        reservation = self.rows("SELECT * FROM credit_reservations")[0]
        self.assertEqual(
            reservation["final_charge_umicro"],
            reservation["reserved_umicro"],
        )

    async def test_stream_error_and_cancellation_settle_without_zero_leak(self):
        for error, expected_status in (
            (RuntimeError("relay failed"), 502),
            (asyncio.CancelledError(), 499),
        ):
            self.set_balance(10_000)
            reservation = self.reserve()
            upstream = FakeUpstream(error=error)
            main._http = FakeHTTP(upstream=upstream)
            settlement = main._SettlementGuard(reservation, 0.0)
            response = await main._stream_chat(
                {
                    "model": "glm-5.2",
                    "stream": True,
                    "messages": [],
                },
                settlement,
                "luv13-glm-5.2",
            )
            with self.assertRaises(type(error)):
                async for _ in response.body_iterator:
                    pass
            row = self.rows(
                "SELECT * FROM credit_reservations WHERE id = ?",
                (reservation["id"],),
            )[0]
            self.assertEqual(row["status"], "settled")
            self.assertEqual(row["terminal_status"], expected_status)
            self.assertGreater(row["final_charge_umicro"], 0)

    async def test_missing_usage_cannot_create_zero_token_leak(self):
        self.set_balance(10_000)
        upstream = FakeUpstream(lines=["data: [DONE]", ""])
        main._http = FakeHTTP(upstream=upstream)
        response = await self.post_chat(
            {
                "model": "luv13-glm-5.2",
                "stream": True,
                "messages": [{"role": "user", "content": "hi"}],
            }
        )
        self.assertEqual(response.status_code, 200)
        request = self.rows("SELECT * FROM requests")[0]
        self.assertGreater(request["charge_umicro"], 0)

    async def test_upstream_exception_settles_reservation(self):
        self.set_balance(10_000)
        main._http = FakeHTTP(error=RuntimeError("connect failed"))
        response = await self.post_chat(
            {
                "model": "luv13-glm-5.2",
                "messages": [{"role": "user", "content": "hi"}],
            }
        )
        self.assertEqual(response.status_code, 502)
        reservation = self.rows("SELECT * FROM credit_reservations")[0]
        self.assertEqual(reservation["status"], "settled")
        self.assertEqual(reservation["terminal_status"], 502)
        self.assertGreater(reservation["final_charge_umicro"], 0)

    async def test_failure_bills_chars_not_utf8_reservation_bytes(self):
        self.set_balance(10_000)
        payload = {
            "model": "luv13-glm-5.2",
            "messages": [{"role": "user", "content": "😀" * 40}],
        }
        expected_tokens = main._estimate_fallback_input_tokens(payload)
        conservative_tokens = main._estimate_reservation_input_tokens(payload)
        self.assertGreater(conservative_tokens, expected_tokens)
        main._http = FakeHTTP(error=RuntimeError("connect failed"))
        response = await self.post_chat(payload)
        self.assertEqual(response.status_code, 502)
        request = self.rows("SELECT * FROM requests")[0]
        self.assertEqual(
            request["charge_umicro"],
            max(1, charge_umicro(expected_tokens)),
        )


class SignupThrottleTests(unittest.TestCase):
    def test_signup_throttle_is_per_ip_and_leaves_login_throttle_intact(self):
        auth._signup_attempts.clear()
        auth._failed_logins.clear()
        request = Request({"type": "http", "client": ("203.0.113.9", 1234)})
        waits = [auth._signup_throttle_wait(request) for _ in range(6)]
        self.assertEqual(waits[:5], [0, 0, 0, 0, 0])
        self.assertGreater(waits[5], 0)
        self.assertEqual(auth._failed_logins, {})


if __name__ == "__main__":
    unittest.main()
