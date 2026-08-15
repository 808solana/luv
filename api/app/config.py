import json
import os
from copy import deepcopy
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from .money import OUTPUT_BUDGET_TOKENS, charge_umicro

_CONFIG_PATH = os.environ.get("LUV13_CONFIG", os.path.join(os.path.dirname(__file__), "..", "config.json"))

@dataclass(frozen=True)
class ModelRoute:
    upstream: str
    rate_umicro_per_million: int


def _usd_rate_to_umicro(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError("rate_per_million_usd must be an exact decimal number")
    try:
        umicro = Decimal(str(value)) * 1_000_000
    except InvalidOperation as exc:
        raise ValueError("rate_per_million_usd must be an exact decimal number") from exc
    if not umicro.is_finite() or umicro != umicro.to_integral_value():
        raise ValueError("rate_per_million_usd must convert exactly to integer micro-dollars")
    return int(umicro)


def migrate_config_dict(raw_config: object) -> dict:
    """Return the current config shape without mutating or dropping root fields."""
    if not isinstance(raw_config, dict):
        raise ValueError("config root must be an object")
    migrated = deepcopy(raw_config)
    raw_models = migrated.get("models")
    if not isinstance(raw_models, dict) or not raw_models:
        raise ValueError("config.models must be a non-empty object")

    global_rate = migrated.get("rate_umicro_per_million")
    if global_rate is None and "rate_per_million_usd" in migrated:
        global_rate = _usd_rate_to_umicro(migrated["rate_per_million_usd"])

    normalized: dict[str, dict] = {}
    for public_id, raw_route in raw_models.items():
        if isinstance(raw_route, str):
            if global_rate is None:
                raise ValueError(f"legacy model {public_id} requires a global sell rate")
            normalized[public_id] = {
                "upstream": raw_route,
                "rate_umicro_per_million": global_rate,
            }
            continue
        if not isinstance(raw_route, dict):
            raise ValueError(f"config.models.{public_id} must be an object or upstream string")
        route = deepcopy(raw_route)
        if "rate_umicro_per_million" not in route:
            if "rate_per_million_usd" in route:
                route["rate_umicro_per_million"] = _usd_rate_to_umicro(
                    route["rate_per_million_usd"]
                )
            elif global_rate is not None:
                route["rate_umicro_per_million"] = global_rate
        normalized[public_id] = route

    if "luv-1" in normalized and "luv13-glm-5.2" not in normalized:
        legacy = normalized["luv-1"]
        if legacy.get("upstream") == "glm-5.2":
            normalized["luv13-glm-5.2"] = deepcopy(legacy)
    migrated["models"] = normalized
    return migrated


def _load_models(raw_models: object) -> dict[str, ModelRoute]:
    if not isinstance(raw_models, dict) or not raw_models:
        raise ValueError("config.models must be a non-empty object")

    models: dict[str, ModelRoute] = {}
    for public_id, raw_route in raw_models.items():
        if not isinstance(public_id, str) or not public_id:
            raise ValueError("every model ID must be a non-empty string")
        if public_id not in {"luv-1", "luv13-glm-5.2"}:
            raise ValueError(f"unsupported customer model ID: {public_id}")
        if not isinstance(raw_route, dict):
            raise ValueError(f"config.models.{public_id} must be an object")

        upstream = raw_route.get("upstream")
        rate = raw_route.get("rate_umicro_per_million")
        if not isinstance(upstream, str) or not upstream:
            raise ValueError(f"config.models.{public_id}.upstream must be a non-empty string")
        if isinstance(rate, bool) or not isinstance(rate, int) or rate <= 0:
            raise ValueError(
                f"config.models.{public_id}.rate_umicro_per_million must be a positive integer"
            )
        models[public_id] = ModelRoute(upstream=upstream, rate_umicro_per_million=rate)
    return models


with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
    _cfg = migrate_config_dict(json.load(f))


ADMIN_SECRET: str = _cfg["admin_secret"]
# Root URL of the old luv13-proxy (no /v1 suffix) — both the metered forward
# target and the passthrough target for everything this layer doesn't own.
UPSTREAM_ROOT: str = _cfg["upstream_root"].rstrip("/")
# Internal sk-luv13- key minted on the old proxy; used for all metered traffic.
UPSTREAM_API_KEY: str = _cfg.get("upstream_api_key", "")
MODELS: dict[str, ModelRoute] = _load_models(_cfg["models"])
RATE_LIMIT_PER_KEY_PER_MINUTE: int = _cfg.get("rate_limit_per_key_per_minute", 60)
MONTHLY_TOKEN_CAP_PER_USER: int = _cfg.get("monthly_token_cap_per_user", 0)
DATABASE_PATH: str = _cfg.get("database_path", "data/luv13.db")
LISTEN_PORT: int = _cfg.get("listen_port", 4100)
OUTPUT_FLOOR_TOKENS: int = _cfg.get("output_floor_tokens", 100)
if (
    isinstance(OUTPUT_FLOOR_TOKENS, bool)
    or not isinstance(OUTPUT_FLOOR_TOKENS, int)
    or not 0 < OUTPUT_FLOOR_TOKENS <= OUTPUT_BUDGET_TOKENS
):
    raise ValueError(
        f"output_floor_tokens must be an integer from 1 to {OUTPUT_BUDGET_TOKENS}"
    )

def model_charge_umicro(model: str, tokens_in: int, tokens_out: int) -> int:
    """Charge total tokens at the configured integer sell rate."""
    route = MODELS[model]
    return charge_umicro(tokens_in + tokens_out, route.rate_umicro_per_million)
