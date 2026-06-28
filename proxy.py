"""
Neuralwatt Proxy Server
=======================
Sits between Cursor (or any OpenAI-compatible client) and Neuralwatt.
- Accepts requests using YOUR custom model names
- Rewrites model names to Neuralwatt's actual model IDs
- Forwards requests to Neuralwatt with your API key
- Tracks usage and cost per API key
- Runs on port 4000 (so it doesn't conflict with your tester on 3000)

Setup:
    pip install flask requests

Usage:
    1. Set NEURALWATT_API_KEY below
    2. Run: python proxy.py
    3. In Cursor, set:
       - Base URL: http://localhost:4000/v1
       - API Key:  any string you want (e.g. "customer-key-123")
       - Model:    any name from MODEL_MAP below

Customer-facing model names map to Neuralwatt model IDs transparently.
"""

import os
import json
import time
import requests
from flask import Flask, request, jsonify, Response, stream_with_context
from datetime import datetime

# ── CONFIG ────────────────────────────────────────────────────────────────────

NEURALWATT_API_KEY = os.getenv("sk-3cc59661cd4a84270dfbbd49783e4c440e97e16384826c3b85b191d5cb5d780c", "YOUR_API_KEY_HERE")
NEURALWATT_BASE_URL = "https://api.neuralwatt.com/v1"
PORT = 4000

# ── MODEL MAP ─────────────────────────────────────────────────────────────────
# Left  = what YOUR customers use (the slug they put in Cursor)
# Right = what gets sent to Neuralwatt's API
MODEL_MAP = {
    # Your branded names → Neuralwatt model IDs
    "daglm-5.2":            "glm-5.2",
    "my-glm-5.2-fast":       "glm-5.2-fast",
    "my-kimi-code":          "moonshotai/Kimi-K2.7-Code",
    "my-qwen3":              "Qwen/Qwen3.6-35B-A3B",

    # Also pass through real names unchanged (fallback)
    "glm-5.2":               "glm-5.2",
    "glm-5.2-fast":          "glm-5.2-fast",
    "moonshotai/Kimi-K2.7-Code": "moonshotai/Kimi-K2.7-Code",
    "Qwen/Qwen3.6-35B-A3B":  "Qwen/Qwen3.6-35B-A3B",
}

# ── YOUR PRICING (what you charge customers per million tokens) ───────────────
YOUR_INPUT_PRICE_PER_M  = 0.13   # $0.13 per million input tokens
YOUR_OUTPUT_PRICE_PER_M = 0.23   # $0.23 per million output tokens

# ── FLASK APP ─────────────────────────────────────────────────────────────────
app = Flask(__name__)

# In-memory usage tracker per customer API key
usage_tracker = {}

def track_usage(api_key, model, prompt_tokens, completion_tokens, neuralwatt_cost):
    """Track usage and calculate your revenue vs cost."""
    if api_key not in usage_tracker:
        usage_tracker[api_key] = {
            "total_requests": 0,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "total_tokens": 0,
            "neuralwatt_cost_usd": 0.0,
            "your_revenue_usd": 0.0,
            "your_profit_usd": 0.0,
            "models_used": {}
        }

    entry = usage_tracker[api_key]
    entry["total_requests"] += 1
    entry["total_prompt_tokens"] += prompt_tokens
    entry["total_completion_tokens"] += completion_tokens
    entry["total_tokens"] += prompt_tokens + completion_tokens

    # What Neuralwatt charged you
    entry["neuralwatt_cost_usd"] += neuralwatt_cost or 0.0

    # What you charge the customer
    your_revenue = (
        (prompt_tokens / 1_000_000 * YOUR_INPUT_PRICE_PER_M) +
        (completion_tokens / 1_000_000 * YOUR_OUTPUT_PRICE_PER_M)
    )
    entry["your_revenue_usd"] += your_revenue
    entry["your_profit_usd"] = entry["your_revenue_usd"] - entry["neuralwatt_cost_usd"]

    # Per-model breakdown
    if model not in entry["models_used"]:
        entry["models_used"][model] = {"requests": 0, "tokens": 0}
    entry["models_used"][model]["requests"] += 1
    entry["models_used"][model]["tokens"] += prompt_tokens + completion_tokens

# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.route("/v1/models", methods=["GET"])
def list_models():
    """Return your branded model list to Cursor."""
    models = []
    for slug in MODEL_MAP.keys():
        models.append({
            "id": slug,
            "object": "model",
            "created": 1700000000,
            "owned_by": "neuralwatt-proxy"
        })
    return jsonify({"object": "list", "data": models})


@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    """
    Main proxy endpoint.
    1. Read the customer's request
    2. Remap the model name
    3. Forward to Neuralwatt
    4. Track usage
    5. Return response to customer
    """
    # Get customer's API key (for tracking)
    customer_api_key = request.headers.get("Authorization", "unknown").replace("Bearer ", "")

    body = request.get_json()
    if not body:
        return jsonify({"error": "Invalid JSON body"}), 400

    # Remap model name
    requested_model = body.get("model", "glm-5.2")
    neuralwatt_model = MODEL_MAP.get(requested_model, requested_model)
    body["model"] = neuralwatt_model

    # Forward to Neuralwatt
    headers = {
        "Authorization": f"Bearer {NEURALWATT_API_KEY}",
        "Content-Type": "application/json",
    }

    is_streaming = body.get("stream", False)

    try:
        if is_streaming:
            # ── STREAMING RESPONSE ─────────────────────────────────────────
            def generate():
                with requests.post(
                    f"{NEURALWATT_BASE_URL}/chat/completions",
                    headers=headers,
                    json=body,
                    stream=True,
                    timeout=120
                ) as r:
                    prompt_tokens = 0
                    completion_tokens = 0
                    for chunk in r.iter_lines():
                        if chunk:
                            line = chunk.decode("utf-8")
                            yield line + "\n\n"
                            # Try to extract token counts from final chunk
                            if line.startswith("data:") and "[DONE]" not in line:
                                try:
                                    data = json.loads(line[5:].strip())
                                    usage = data.get("usage", {})
                                    if usage:
                                        prompt_tokens = usage.get("prompt_tokens", 0)
                                        completion_tokens = usage.get("completion_tokens", 0)
                                except:
                                    pass
                    # Track after stream completes
                    track_usage(
                        customer_api_key,
                        requested_model,
                        prompt_tokens,
                        completion_tokens,
                        neuralwatt_cost=None  # Energy cost not available in streaming
                    )

            return Response(
                stream_with_context(generate()),
                content_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no"
                }
            )

        else:
            # ── NON-STREAMING RESPONSE ─────────────────────────────────────
            resp = requests.post(
                f"{NEURALWATT_BASE_URL}/chat/completions",
                headers=headers,
                json=body,
                timeout=120
            )

            data = resp.json()

            # Extract usage for tracking
            usage = data.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)

            # Extract Neuralwatt energy cost if available
            neuralwatt_cost = None
            cost_data = data.get("cost", {})
            if cost_data:
                neuralwatt_cost = cost_data.get("request_cost_usd")

            track_usage(
                customer_api_key,
                requested_model,
                prompt_tokens,
                completion_tokens,
                neuralwatt_cost
            )

            return jsonify(data), resp.status_code

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request to Neuralwatt timed out"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── ADMIN ROUTES ──────────────────────────────────────────────────────────────

@app.route("/admin/usage", methods=["GET"])
def get_all_usage():
    """See usage across all customer API keys."""
    return jsonify(usage_tracker)


@app.route("/admin/usage/<api_key>", methods=["GET"])
def get_usage_by_key(api_key):
    """See usage for a specific customer API key."""
    return jsonify(usage_tracker.get(api_key, {"error": "Key not found"}))


@app.route("/admin/summary", methods=["GET"])
def get_summary():
    """High-level profit summary across all customers."""
    total_revenue = sum(v["your_revenue_usd"] for v in usage_tracker.values())
    total_cost = sum(v["neuralwatt_cost_usd"] for v in usage_tracker.values())
    total_requests = sum(v["total_requests"] for v in usage_tracker.values())
    total_tokens = sum(v["total_tokens"] for v in usage_tracker.values())

    return jsonify({
        "total_customers": len(usage_tracker),
        "total_requests": total_requests,
        "total_tokens": total_tokens,
        "total_revenue_usd": round(total_revenue, 6),
        "total_cost_usd": round(total_cost, 6),
        "total_profit_usd": round(total_revenue - total_cost, 6),
        "gross_margin_pct": round(((total_revenue - total_cost) / total_revenue * 100) if total_revenue > 0 else 0, 2)
    })


@app.route("/admin/reset", methods=["POST"])
def reset_usage():
    """Reset all usage tracking."""
    usage_tracker.clear()
    return jsonify({"status": "reset"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})


# ── MAIN ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"""
╔══════════════════════════════════════════════════════════╗
║   Neuralwatt Proxy Server                                ║
║   Running at:  http://localhost:{PORT}                      ║
║   Admin UI:    http://localhost:{PORT}/admin/summary        ║
║                                                          ║
║   In Cursor, set:                                        ║
║     Base URL:  http://localhost:{PORT}/v1                   ║
║     API Key:   any-string-you-want                       ║
║     Model:     my-glm-5.2  (or any name in MODEL_MAP)   ║
╚══════════════════════════════════════════════════════════╝

Model mappings:
""")
    for k, v in MODEL_MAP.items():
        print(f"  {k:<35} → {v}")
    print()
    app.run(port=PORT, debug=True)
