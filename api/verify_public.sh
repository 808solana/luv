#!/bin/bash
# Verifies luv13-api over the PUBLIC url api.luv13.com after cutover.
set -euo pipefail

BASE="https://api.luv13.com"
ADMIN='0a43622fce11aa126bebab4007d922f655e3c11f7b3bce5dc8c676ebc7d64a1b'

echo "=== 1. public health ==="
curl -fsS -m 15 "$BASE/health"; echo

echo "=== 2. create key over public URL ==="
KEYRESP=$(curl -fsS -m 15 -X POST "$BASE/internal/keys" \
  -H "X-Admin-Secret: $ADMIN" -H 'Content-Type: application/json' \
  -d '{"email":"pubtest@luv13.com","name":"pub verify"}')
echo "  $KEYRESP"
KEY=$(echo "$KEYRESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["key"])')

echo "=== 3. list models (new key) ==="
curl -fsS -m 15 "$BASE/v1/models" -H "Authorization: Bearer $KEY"; echo

echo "=== 4. real chat completion over public URL ==="
curl -fsS -m 60 -X POST "$BASE/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"luv-1","messages":[{"role":"user","content":"Say hello in exactly 3 words."}]}' \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  model:",d.get("model"));print("  finish:",d["choices"][0]["finish_reason"]);print("  usage:",d.get("usage"))'

echo "=== 5. old-proxy passthrough still works (old key -> old /v1/models list) ==="
curl -fsS -m 15 "$BASE/v1/models" -H "Authorization: Bearer REDACTED_PLACEHOLDER" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  old models count:",len(d["data"]))'

echo
echo "PUBLIC CUTOVER VERIFIED"
