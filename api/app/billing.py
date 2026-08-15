"""Stripe Checkout billing endpoints.

Checkout creates only pending rows. The signature-verified webhook is the sole
path that can transition a top-up and credit a wallet.
"""

import os
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from . import auth, db

router = APIRouter()

MIN_TOPUP_CENTS = 500


def _positive_env_int(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be positive")
    return value


STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_SUCCESS_URL = os.environ.get("STRIPE_SUCCESS_URL", "")
STRIPE_CANCEL_URL = os.environ.get("STRIPE_CANCEL_URL", "")
STRIPE_MAX_TOPUP_CENTS = _positive_env_int("STRIPE_MAX_TOPUP_CENTS", 100_000)
if STRIPE_MAX_TOPUP_CENTS < MIN_TOPUP_CENTS:
    raise RuntimeError(f"STRIPE_MAX_TOPUP_CENTS must be at least {MIN_TOPUP_CENTS}")


def _require_checkout_config() -> None:
    success = urlparse(STRIPE_SUCCESS_URL)
    cancel = urlparse(STRIPE_CANCEL_URL)
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, detail="Billing is not configured.")
    if success.scheme != "https" or success.hostname != "luv13.ai":
        raise HTTPException(503, detail="Billing success URL is not configured.")
    if (
        cancel.scheme != "https"
        or cancel.hostname != "luv13.ai"
        or not (
            cancel.path == "/top-up"
            or cancel.path.startswith("/top-up/")
        )
    ):
        raise HTTPException(503, detail="Billing cancel URL is not configured.")


def _amount_cents(payload: dict) -> int:
    cents_raw = payload.get("amount_cents")
    usd_raw = payload.get("amount_usd")
    cents: int | None = None

    if cents_raw is not None:
        if isinstance(cents_raw, bool) or not isinstance(cents_raw, int):
            raise HTTPException(400, detail="amount_cents must be an integer.")
        cents = cents_raw

    if usd_raw is not None:
        if isinstance(usd_raw, bool) or not isinstance(usd_raw, (str, int, float)):
            raise HTTPException(400, detail="amount_usd must be a decimal dollar amount.")
        try:
            dollars = Decimal(str(usd_raw))
        except InvalidOperation as exc:
            raise HTTPException(400, detail="amount_usd must be a decimal dollar amount.") from exc
        exact_cents = dollars * 100
        if not exact_cents.is_finite() or exact_cents != exact_cents.to_integral_value():
            raise HTTPException(400, detail="amount_usd must have at most two decimal places.")
        normalized = int(exact_cents)
        if cents is not None and cents != normalized:
            raise HTTPException(400, detail="amount_cents and amount_usd disagree.")
        cents = normalized

    if cents is None:
        raise HTTPException(400, detail="amount_cents is required.")
    if cents < MIN_TOPUP_CENTS or cents > STRIPE_MAX_TOPUP_CENTS:
        raise HTTPException(
            400,
            detail=f"Top-up must be between {MIN_TOPUP_CENTS} and {STRIPE_MAX_TOPUP_CENTS} cents.",
        )
    return cents


def _retry_topup_id(payload: dict) -> int | None:
    value = payload.get("topup_id")
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise HTTPException(400, detail="topup_id must be a positive integer.")
    return value


def _value(obj, key: str):
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def _identifier(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, dict):
        value = value.get("id")
    elif not isinstance(value, str):
        value = getattr(value, "id", value)
    return str(value) if value else None


@router.post("/billing/checkout")
async def create_checkout(
    request: Request,
    user: dict = Depends(auth.require_user),
):
    _require_checkout_config()
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, detail="Request body must be valid JSON.") from exc
    if not isinstance(payload, dict):
        raise HTTPException(400, detail="Request body must be a JSON object.")
    amount_cents = _amount_cents(payload)
    retry_topup_id = _retry_topup_id(payload)
    if retry_topup_id is None:
        topup_id = db.create_pending_topup(user["id"], amount_cents)
    else:
        pending = db.get_pending_topup_for_retry(
            retry_topup_id,
            user["id"],
            amount_cents,
        )
        if pending is None:
            raise HTTPException(400, detail="Pending top-up retry does not match.")
        topup_id = pending["id"]
    metadata = {
        "luv13_topup_id": str(topup_id),
        "luv13_user_id": str(user["id"]),
    }

    try:
        session = await run_in_threadpool(
            lambda: stripe.checkout.Session.create(
                api_key=STRIPE_SECRET_KEY,
                idempotency_key=f"luv13-topup-{topup_id}",
                mode="payment",
                success_url=STRIPE_SUCCESS_URL,
                cancel_url=STRIPE_CANCEL_URL,
                client_reference_id=str(topup_id),
                customer_email=user["email"],
                customer_creation="always",
                metadata=metadata,
                payment_intent_data={"metadata": metadata},
                line_items=[{
                    "quantity": 1,
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": amount_cents,
                        "product_data": {"name": "LUV13 API credits"},
                    },
                }],
            )
        )
    except Exception as exc:
        raise HTTPException(
            502,
            detail={
                "message": "Unable to create checkout session.",
                "topup_id": topup_id,
            },
        ) from exc

    session_id = _identifier(_value(session, "id"))
    checkout_url = _value(session, "url")
    if not session_id or not isinstance(checkout_url, str) or not checkout_url:
        raise HTTPException(
            502,
            detail={
                "message": "Stripe returned an invalid checkout session.",
                "topup_id": topup_id,
            },
        )

    try:
        attached = db.attach_checkout_session(
            topup_id,
            user["id"],
            session_id,
            _identifier(_value(session, "payment_intent")),
            _identifier(_value(session, "customer")),
        )
    except Exception as exc:
        raise HTTPException(
            502,
            detail={
                "message": "Unable to persist checkout session.",
                "topup_id": topup_id,
            },
        ) from exc
    if not attached:
        raise HTTPException(
            502,
            detail={
                "message": "Unable to persist checkout session.",
                "topup_id": topup_id,
            },
        )
    return {"url": checkout_url, "session_id": session_id, "topup_id": topup_id}


@router.post("/billing/webhook")
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, detail="Billing webhook is not configured.")
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(
            payload,
            signature,
            STRIPE_WEBHOOK_SECRET,
        )
    except Exception as exc:
        raise HTTPException(400, detail="Invalid Stripe signature.") from exc

    event_type = _value(event, "type")
    if event_type != "checkout.session.completed":
        return {"received": True, "ignored": True}

    event_data = _value(event, "data")
    session = _value(event_data, "object")
    metadata = _value(session, "metadata") or {}
    result = db.complete_checkout_topup(
        event_id=str(_value(event, "id") or ""),
        stripe_session_id=str(_value(session, "id") or ""),
        amount_total=_value(session, "amount_total"),
        currency=str(_value(session, "currency") or ""),
        payment_status=str(_value(session, "payment_status") or ""),
        stripe_payment_intent_id=_identifier(_value(session, "payment_intent")),
        stripe_customer_id=_identifier(_value(session, "customer")),
        client_reference_id=_identifier(_value(session, "client_reference_id")),
        metadata_topup_id=_identifier(_value(metadata, "luv13_topup_id")),
        metadata_user_id=_identifier(_value(metadata, "luv13_user_id")),
    )
    if result["result"] in {"mismatch", "not_found"}:
        raise HTTPException(400, detail="Stripe checkout does not match a pending top-up.")
    return {"received": True, "credited": result["credited"]}


@router.get("/billing/balance")
async def billing_balance(user: dict = Depends(auth.require_user)):
    return {"balance_umicro": db.get_balance_umicro(user["id"]), "currency": "usd"}


@router.get("/billing/topups")
async def billing_topups(user: dict = Depends(auth.require_user), limit: int = 100):
    return {"topups": db.list_topups_for_user(user["id"], limit)}
