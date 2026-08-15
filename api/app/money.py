"""Integer money primitives for wallet accounting.

One ``umicro`` is one millionth of a US dollar. Wallet balances, charges, and
credits must stay in these integer units; display conversion belongs at the
API/UI boundary only.
"""

UMICRO_PER_USD = 1_000_000
UMICRO_PER_CENT = 10_000
TOKENS_PER_MILLION = 1_000_000

RATE_UMICRO_PER_MILLION = 330_000
OUTPUT_BUDGET_TOKENS = 8_000


def charge_umicro(tokens: int, rate_umicro_per_million: int = RATE_UMICRO_PER_MILLION) -> int:
    """Return the customer-favorable floor charge using integer arithmetic."""
    if isinstance(tokens, bool) or not isinstance(tokens, int) or tokens < 0:
        raise ValueError("tokens must be a non-negative integer")
    if (
        isinstance(rate_umicro_per_million, bool)
        or not isinstance(rate_umicro_per_million, int)
        or rate_umicro_per_million < 0
    ):
        raise ValueError("rate_umicro_per_million must be a non-negative integer")
    return (tokens * rate_umicro_per_million) // TOKENS_PER_MILLION


def cents_to_umicro(cents: int) -> int:
    """Convert Stripe's integer cents to wallet units exactly."""
    if isinstance(cents, bool) or not isinstance(cents, int) or cents < 0:
        raise ValueError("cents must be a non-negative integer")
    return cents * UMICRO_PER_CENT


def umicro_to_usd_display(umicro: int) -> float:
    """Convert wallet units to a display-only USD float.

    Never feed this result back into balance, reservation, or settlement math.
    """
    if isinstance(umicro, bool) or not isinstance(umicro, int):
        raise ValueError("umicro must be an integer")
    return umicro / UMICRO_PER_USD
