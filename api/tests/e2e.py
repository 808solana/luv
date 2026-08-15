"""End-to-end test against a running luv13-api (test config) + mock old proxy.

Usage: python tests/e2e.py [base_url] [admin_secret]
"""
import json
import os
import sqlite3
import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4100"
ADMIN = {"X-Admin-Secret": sys.argv[2] if len(sys.argv) > 2 else "test-secret"}

failures = []


def check(name: str, cond: bool, detail: str = ""):
    print(("PASS  " if cond else "FAIL  ") + name + (f"  ({detail})" if detail else ""))
    if not cond:
        failures.append(name)


c = httpx.Client(timeout=30)

# health
r = c.get(f"{BASE}/health")
check("health", r.status_code == 200 and r.json()["service"] == "luv13-api")

# internal auth required
r = c.get(f"{BASE}/internal/users")
check("internal rejects missing secret", r.status_code == 401)

# create key
r = c.post(f"{BASE}/internal/keys", headers=ADMIN, json={"email": "Alice@Test.com", "name": "my first key"})
check("create key", r.status_code == 200, r.text[:120])
key = r.json()["key"]
key_id = r.json()["id"]
check("key format", key.startswith("sk-luv13-") and len(key) > 40, key[:17] + "...")

# Local-only Phase 5 funding hook. Never expose a runtime credit endpoint:
# production credit can move only through signed billing paths.
e2e_db_path = os.environ.get("LUV13_E2E_DB_PATH")
if e2e_db_path:
    conn = sqlite3.connect(e2e_db_path)
    try:
        conn.execute(
            """UPDATE users SET balance_umicro = 1000000
               WHERE email = ?""",
            ("alice@test.com",),
        )
        conn.commit()
    finally:
        conn.close()

auth = {"Authorization": f"Bearer {key}"}

# models (new key -> our branded list)
r = c.get(f"{BASE}/v1/models", headers=auth)
model_ids = {item["id"] for item in r.json().get("data", [])}
check("list models", r.status_code == 200
      and model_ids == {"luv13-glm-5.2", "luv-1"}, str(model_ids))

# unknown model
r = c.post(f"{BASE}/v1/chat/completions", headers=auth, json={"model": "gpt-9", "messages": []})
check("unknown model 404", r.status_code == 404)

# non-streaming chat
r = c.post(f"{BASE}/v1/chat/completions", headers=auth,
           json={"model": "luv-1", "messages": [{"role": "user", "content": "hi"}]})
d = r.json()
check("chat completion", r.status_code == 200 and d["choices"][0]["message"]["content"] == "hello from mock")
check("model rebranded in response", d.get("model") == "luv-1", str(d.get("model")))

# streaming chat
usage_seen = None
model_in_chunks = set()
with c.stream("POST", f"{BASE}/v1/chat/completions", headers=auth,
              json={"model": "luv-1", "stream": True, "messages": [{"role": "user", "content": "hi"}]}) as r:
    check("stream status", r.status_code == 200)
    for line in r.iter_lines():
        if line.startswith("data: ") and line != "data: [DONE]":
            chunk = json.loads(line[6:])
            model_in_chunks.add(chunk.get("model"))
            if chunk.get("usage"):
                usage_seen = chunk["usage"]
check("stream chunks rebranded", model_in_chunks == {"luv-1"}, str(model_in_chunks))
check("stream usage included", usage_seen is not None and usage_seen["prompt_tokens"] == 120)

# rate limit (test config: 3/min; we've used 3 chat-completion calls incl. the 404)
r = c.post(f"{BASE}/v1/chat/completions", headers=auth,
           json={"model": "luv-1", "messages": [{"role": "user", "content": "hi"}]})
check("rate limit kicks in", r.status_code == 429, f"status={r.status_code}")

# --- passthrough behavior: old-proxy customers keep working ---
old_auth = {"Authorization": "Bearer REDACTED_PLACEHOLDER"}
r = c.post(f"{BASE}/v1/chat/completions", headers=old_auth,
           json={"model": "glm-5.2", "messages": [{"role": "user", "content": "hi"}]})
check("old customer key passes through", r.status_code == 200
      and r.json()["choices"][0]["message"]["content"] == "hello from mock")
r = c.post(f"{BASE}/v1/chat/completions", headers={"Authorization": "Bearer BOGUS_REDACTED_PLACEHOLDER"},
           json={"model": "glm-5.2", "messages": []})
check("bogus key rejected by old proxy", r.status_code == 401)
r = c.get(f"{BASE}/usage", headers=old_auth)
check("catch-all passthrough (/usage)", r.status_code == 200 and r.json().get("source") == "old-proxy", r.text[:80])

# usage log
r = c.get(f"{BASE}/internal/usage", headers=ADMIN, params={"email": "alice@test.com"})
rows = r.json()["requests"]
ok_rows = [x for x in rows if x["status"] == 200]
check("usage rows logged", len(ok_rows) == 2, f"{len(rows)} rows total")
row = ok_rows[0]
check("tokens logged", row["tokens_in"] == 120 and row["tokens_out"] == 45 and row["tokens_cached"] == 30,
      json.dumps({k: row[k] for k in ("tokens_in", "tokens_out", "tokens_cached")}))
expected_charge_umicro = ((120 + 45) * 330_000) // 1_000_000
expected_cost = expected_charge_umicro / 1_000_000
check("integer charge logged", row["charge_umicro"] == expected_charge_umicro,
      f"{row['charge_umicro']} vs {expected_charge_umicro}")
check("cost math", abs(row["cost_usd"] - expected_cost) < 1e-12, f"{row['cost_usd']} vs {expected_cost}")

# summary
r = c.get(f"{BASE}/internal/summary", headers=ADMIN, params={"email": "alice@test.com"})
s = r.json()
check("summary totals", s["tokens_in"] == 240 and s["tokens_out"] == 90 and s["total_tokens"] == 330
      and abs(s["total_cost_usd"] - 2 * expected_cost) < 1e-12, json.dumps(s))

# key listing + revoke
r = c.get(f"{BASE}/internal/keys", headers=ADMIN, params={"email": "alice@test.com"})
check("list keys", r.status_code == 200 and r.json()["keys"][0]["name"] == "my first key")
r = c.post(f"{BASE}/internal/keys/{key_id}/revoke", headers=ADMIN)
check("revoke key", r.status_code == 200)
r = c.post(f"{BASE}/v1/chat/completions", headers=auth, json={"model": "luv-1", "messages": []})
check("revoked key falls through to old proxy 401", r.status_code == 401)

# users overview
r = c.get(f"{BASE}/internal/users", headers=ADMIN)
check("users overview", r.status_code == 200 and r.json()["users"][0]["email"] == "alice@test.com")

print()
if failures:
    print(f"{len(failures)} FAILURES: {failures}")
    sys.exit(1)
print("ALL TESTS PASSED")
