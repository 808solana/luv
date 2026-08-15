#!/bin/bash
# End-to-end verification of luv13-api on kor (port 4100) against the real
# old proxy (port 4000). Exits non-zero on any failure.
set -euo pipefail

BASE="http://127.0.0.1:4100"
ADMIN='0a43622fce11aa126bebab4007d922f655e3c11f7b3bce5dc8c676ebc7d64a1b'

fail() { echo "FAIL: $1"; exit 1; }

echo "=== 1. health ==="
curl -fsS "$BASE/health" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["status"]=="ok" and d["service"]=="luv13-api";print("  ok:",d)'

echo "=== 2. create key ==="
KEYRESP=$(curl -fsS -X POST "$BASE/internal/keys" \
  -H "X-Admin-Secret: $ADMIN" -H 'Content-Type: application/json' \
  -d '{"email":"verify@luv13.com","name":"verify key"}')
echo "  $KEYRESP"
KEY=$(echo "$KEYRESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["key"])')
case "$KEY" in sk-luv13-*) echo "  key format ok";; *) fail "bad key format: $KEY";; esac

echo "=== 3. list models (new key, branded list) ==="
curl -fsS "$BASE/v1/models" -H "Authorization: Bearer $KEY" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["data"][0]["id"]=="luv-1";print("  models:",[m["id"] for m in d["data"]])'

echo "=== 4. real chat completion via luv-1 -> upward -> glm-5.2 ==="
CHATRESP=$(curl -fsS -X POST "$BASE/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"luv-1","messages":[{"role":"user","content":"Say hello in exactly 3 words."}]}')
echo "  $CHATRESP" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  model:",d.get("model"));assert d.get("model")=="luv-1";assert d["choices"][0]["finish_reason"]'

echo "=== 5. usage log ==="
curl -fsS "$BASE/internal/usage?email=verify@luv13.com" -H "X-Admin-Secret: $ADMIN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);rows=[r for r in d["requests"] if r["status"]==200];assert rows;print("  rows:",len(d["requests"]));r=rows[0];print("  sample:",{k:r[k] for k in ("model","tokens_in","tokens_out","tokens_cached","cost_usd")})'

echo "=== 6. summary ==="
curl -fsS "$BASE/internal/summary?email=verify@luv13.com" -H "X-Admin-Secret: $ADMIN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["total_requests"]>=1;print("  summary:",{k:d[k] for k in ("total_requests","total_tokens","total_cost_usd")})'

echo "=== 7. old-proxy passthrough (/v1/models via old key path) ==="
OLDMODELS=$(curl -fsS "$BASE/v1/models" -H "Authorization: Bearer REDACTED_PLACEHOLDER")
echo "  old models count: $(echo "$OLDMODELS" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["data"]))')"

echo
echo "ALL VERIFICATION CHECKS PASSED"
