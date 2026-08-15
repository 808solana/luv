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

API_ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("LUV13_CONFIG", str(API_ROOT / "tests" / "test-config.json"))

from app import auth, billing, config, db, main  # noqa: E402


class BillingCase(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.original_db_path = config.DATABASE_PATH
        config.DATABASE_PATH = str(Path(self.tempdir.name) / "billing.db")
        self.addCleanup(setattr, config, "DATABASE_PATH", self.original_db_path)
        db.init_db()
        user_id = db.get_or_create_user("billing@example.com")
        self.user = db.get_user_by_id(user_id)

        self.billing_values = {
            "STRIPE_SECRET_KEY": billing.STRIPE_SECRET_KEY,
            "STRIPE_WEBHOOK_SECRET": billing.STRIPE_WEBHOOK_SECRET,
            "STRIPE_SUCCESS_URL": billing.STRIPE_SUCCESS_URL,
            "STRIPE_CANCEL_URL": billing.STRIPE_CANCEL_URL,
            "STRIPE_MAX_TOPUP_CENTS": billing.STRIPE_MAX_TOPUP_CENTS,
        }
        billing.STRIPE_SECRET_KEY = "sk_test_placeholder"
        billing.STRIPE_WEBHOOK_SECRET = "whsec_test_placeholder"
        billing.STRIPE_SUCCESS_URL = (
            "https://luv13.ai/top-up/success?session_id={CHECKOUT_SESSION_ID}"
        )
        billing.STRIPE_CANCEL_URL = "https://luv13.ai/top-up"
        billing.STRIPE_MAX_TOPUP_CENTS = 100_000
        self.addCleanup(self.restore_billing_values)
        main.app.dependency_overrides.clear()
        self.addCleanup(main.app.dependency_overrides.clear)

    def restore_billing_values(self):
        for name, value in self.billing_values.items():
            setattr(billing, name, value)

    async def request(self, method, path, **kwargs):
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            return await client.request(method, path, **kwargs)

    def authenticate(self):
        main.app.dependency_overrides[auth.require_user] = lambda: self.user

    def rows(self, query, params=()):
        conn = sqlite3.connect(config.DATABASE_PATH)
        try:
            conn.row_factory = sqlite3.Row
            return [dict(row) for row in conn.execute(query, params)]
        finally:
            conn.close()

    def pending_topup(self, amount_cents=500):
        topup_id = db.create_pending_topup(self.user["id"], amount_cents)
        self.assertTrue(
            db.attach_checkout_session(
                topup_id,
                self.user["id"],
                f"cs_test_{topup_id}",
                f"pi_test_{topup_id}",
                f"cus_test_{topup_id}",
            )
        )
        return topup_id

    def completed_event(self, topup_id, *, event_id="evt_test_1", amount=500):
        return {
            "id": event_id,
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": f"cs_test_{topup_id}",
                    "amount_total": amount,
                    "currency": "usd",
                    "payment_status": "paid",
                    "payment_intent": f"pi_test_{topup_id}",
                    "customer": f"cus_test_{topup_id}",
                    "client_reference_id": str(topup_id),
                    "metadata": {
                        "luv13_topup_id": str(topup_id),
                        "luv13_user_id": str(self.user["id"]),
                    },
                }
            },
        }


class CheckoutTests(BillingCase):
    async def test_checkout_requires_cookie_auth(self):
        response = await self.request(
            "POST",
            "/billing/checkout",
            json={"amount_cents": 500},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.rows("SELECT * FROM topups"), [])

    async def test_amount_bounds_and_decimal_precision(self):
        self.authenticate()
        invalid = [
            {"amount_cents": 499},
            {"amount_cents": 100_001},
            {"amount_usd": "5.001"},
            {"amount_cents": 500, "amount_usd": "6.00"},
        ]
        with patch("app.billing.stripe.checkout.Session.create") as create:
            for payload in invalid:
                response = await self.request(
                    "POST",
                    "/billing/checkout",
                    json=payload,
                )
                self.assertEqual(response.status_code, 400, payload)
            create.assert_not_called()

    async def test_checkout_normalizes_cents_and_persists_pending_identifiers(self):
        self.authenticate()
        stripe_session = {
            "id": "cs_test_checkout",
            "url": "https://checkout.stripe.com/c/pay/test",
            "payment_intent": "pi_test_checkout",
            "customer": "cus_test_checkout",
        }
        with patch(
            "app.billing.stripe.checkout.Session.create",
            return_value=stripe_session,
        ) as create:
            response = await self.request(
                "POST",
                "/billing/checkout",
                json={"amount_usd": "5.01"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["url"], stripe_session["url"])
        topup = self.rows("SELECT * FROM topups")[0]
        self.assertEqual(topup["amount_cents"], 501)
        self.assertEqual(topup["status"], "pending")
        self.assertEqual(topup["stripe_session_id"], "cs_test_checkout")
        self.assertEqual(topup["stripe_payment_intent_id"], "pi_test_checkout")
        self.assertEqual(topup["stripe_customer_id"], "cus_test_checkout")
        self.assertEqual(db.get_balance_umicro(self.user["id"]), 0)

        params = create.call_args.kwargs
        self.assertEqual(params["line_items"][0]["price_data"]["unit_amount"], 501)
        self.assertEqual(params["client_reference_id"], str(topup["id"]))
        self.assertEqual(params["metadata"]["luv13_user_id"], str(self.user["id"]))
        self.assertEqual(params["idempotency_key"], f"luv13-topup-{topup['id']}")
        self.assertNotIn("amount_usd", params)

    async def test_attachment_failure_stays_pending_and_retry_is_idempotent(self):
        self.authenticate()
        stripe_session = {
            "id": "cs_test_retry",
            "url": "https://checkout.stripe.com/c/pay/retry",
        }
        with patch(
            "app.billing.stripe.checkout.Session.create",
            return_value=stripe_session,
        ) as create, patch(
            "app.billing.db.attach_checkout_session",
            return_value=False,
        ):
            failed = await self.request(
                "POST",
                "/billing/checkout",
                json={"amount_cents": 500},
            )
        self.assertEqual(failed.status_code, 502)
        topup_id = failed.json()["detail"]["topup_id"]
        pending = self.rows("SELECT * FROM topups WHERE id = ?", (topup_id,))[0]
        self.assertEqual(pending["status"], "pending")
        self.assertIsNone(pending["stripe_session_id"])

        with patch(
            "app.billing.stripe.checkout.Session.create",
            return_value=stripe_session,
        ) as retry_create:
            retried = await self.request(
                "POST",
                "/billing/checkout",
                json={"amount_cents": 500, "topup_id": topup_id},
            )
        self.assertEqual(retried.status_code, 200)
        self.assertEqual(
            create.call_args.kwargs["idempotency_key"],
            retry_create.call_args.kwargs["idempotency_key"],
        )
        attached = self.rows("SELECT * FROM topups WHERE id = ?", (topup_id,))[0]
        self.assertEqual(attached["stripe_session_id"], "cs_test_retry")

    async def test_checkout_redirect_never_credits(self):
        self.authenticate()
        with patch(
            "app.billing.stripe.checkout.Session.create",
            return_value={
                "id": "cs_test_redirect",
                "url": "https://checkout.stripe.com/c/pay/redirect",
            },
        ):
            response = await self.request(
                "POST",
                "/billing/checkout",
                json={"amount_cents": 500},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(db.get_balance_umicro(self.user["id"]), 0)
        self.assertEqual(self.rows("SELECT status FROM topups")[0]["status"], "pending")


class WebhookTests(BillingCase):
    async def post_signed(self, raw, event):
        with patch(
            "app.billing.stripe.Webhook.construct_event",
            return_value=event,
        ) as construct:
            response = await self.request(
                "POST",
                "/billing/webhook",
                content=raw,
                headers={"stripe-signature": "t=1,v1=test"},
            )
        self.assertEqual(construct.call_args.args[0], raw)
        return response

    async def test_raw_signature_failure_happens_before_event_trust(self):
        raw = b'{"type":"checkout.session.completed","data":{"object":{"amount_total":999999}}}'
        with patch(
            "app.billing.stripe.Webhook.construct_event",
            side_effect=ValueError("bad signature"),
        ) as construct:
            response = await self.request(
                "POST",
                "/billing/webhook",
                content=raw,
                headers={"stripe-signature": "invalid"},
            )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(construct.call_args.args[0], raw)
        self.assertEqual(db.get_balance_umicro(self.user["id"]), 0)

    async def test_unrelated_event_type_is_ignored(self):
        topup_id = self.pending_topup()
        event = self.completed_event(topup_id)
        event["type"] = "checkout.session.async_payment_succeeded"
        response = await self.post_signed(b"raw-event", event)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ignored"])
        self.assertEqual(db.get_balance_umicro(self.user["id"]), 0)

    async def test_amount_and_session_mismatch_never_credit(self):
        topup_id = self.pending_topup()
        wrong_amount = await self.post_signed(
            b"wrong-amount",
            self.completed_event(topup_id, amount=600),
        )
        self.assertEqual(wrong_amount.status_code, 400)

        wrong_session_event = self.completed_event(topup_id)
        wrong_session_event["data"]["object"]["id"] = "cs_unknown"
        wrong_session = await self.post_signed(
            b"wrong-session",
            wrong_session_event,
        )
        self.assertEqual(wrong_session.status_code, 400)

        wrong_user_event = self.completed_event(topup_id)
        wrong_user_event["data"]["object"]["metadata"]["luv13_user_id"] = "999"
        wrong_user = await self.post_signed(
            b"wrong-user",
            wrong_user_event,
        )
        self.assertEqual(wrong_user.status_code, 400)
        self.assertEqual(db.get_balance_umicro(self.user["id"]), 0)
        self.assertEqual(self.rows("SELECT status FROM topups")[0]["status"], "pending")

    async def test_one_exact_credit_and_replay_noop(self):
        topup_id = self.pending_topup()
        event = self.completed_event(topup_id)
        first = await self.post_signed(b"first", event)
        replay = await self.post_signed(b"replay", event)

        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.json()["credited"])
        self.assertEqual(replay.status_code, 200)
        self.assertFalse(replay.json()["credited"])
        self.assertEqual(db.get_balance_umicro(self.user["id"]), 5_000_000)
        topup = self.rows("SELECT * FROM topups")[0]
        self.assertEqual(topup["status"], "completed")
        self.assertEqual(topup["stripe_event_id"], "evt_test_1")

    async def test_webhook_recovers_missing_session_attachment(self):
        topup_id = db.create_pending_topup(self.user["id"], 500)
        event = self.completed_event(topup_id)
        response = await self.post_signed(b"recover", event)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["credited"])
        topup = self.rows("SELECT * FROM topups WHERE id = ?", (topup_id,))[0]
        self.assertEqual(topup["stripe_session_id"], f"cs_test_{topup_id}")
        self.assertEqual(topup["status"], "completed")
        self.assertEqual(db.get_balance_umicro(self.user["id"]), 5_000_000)

    async def test_balance_and_history_are_cookie_scoped(self):
        self.authenticate()
        self.pending_topup(750)
        balance = await self.request("GET", "/billing/balance")
        history = await self.request("GET", "/billing/topups")
        self.assertEqual(balance.status_code, 200)
        self.assertEqual(balance.json()["balance_umicro"], 0)
        self.assertEqual(history.json()["topups"][0]["amount_cents"], 750)


class CustomerUsageTests(BillingCase):
    async def test_recent_usage_is_cookie_scoped_and_customer_shaped(self):
        own_key = db.create_key(self.user["email"], "own")
        other_key = db.create_key("other@example.com", "other")
        other_user = db.get_user_by_email("other@example.com")
        db.log_request(
            own_key["id"], self.user["id"], "luv13-glm-5.2", "glm-5.2",
            12, 7, 0, 6, 200, 25,
        )
        db.log_request(
            other_key["id"], other_user["id"], "luv13-glm-5.2", "glm-5.2",
            999, 999, 0, 659, 200, 30,
        )

        self.authenticate()
        response = await self.request("GET", "/api/usage?limit=10")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["usage"]), 1)
        item = response.json()["usage"][0]
        self.assertEqual(item["model"], "luv13-glm-5.2")
        self.assertEqual(item["tokens_in"], 12)
        self.assertEqual(item["tokens_out"], 7)
        self.assertEqual(item["charge_umicro"], 6)
        self.assertNotIn("upstream_model", item)
        self.assertNotIn("key_hash", item)


class ConcurrentWebhookTests(BillingCase):
    async def test_concurrent_replay_credits_once(self):
        topup_id = self.pending_topup()
        event = self.completed_event(topup_id)
        session = event["data"]["object"]
        barrier = threading.Barrier(2)

        def complete():
            barrier.wait()
            return db.complete_checkout_topup(
                event_id=event["id"],
                stripe_session_id=session["id"],
                amount_total=session["amount_total"],
                currency=session["currency"],
                payment_status=session["payment_status"],
                stripe_payment_intent_id=session["payment_intent"],
                stripe_customer_id=session["customer"],
                client_reference_id=session["client_reference_id"],
                metadata_topup_id=session["metadata"]["luv13_topup_id"],
                metadata_user_id=session["metadata"]["luv13_user_id"],
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: complete(), range(2)))
        self.assertEqual(sum(result["credited"] for result in results), 1)
        self.assertEqual(db.get_balance_umicro(self.user["id"]), 5_000_000)


if __name__ == "__main__":
    unittest.main()
