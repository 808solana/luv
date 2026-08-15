#!/usr/bin/env bash
# Mints the internal sk-luv13- key that the new luv13-api layer uses for all
# upstream traffic to the old proxy. Run on kor.
set -euo pipefail

JWT=$(docker exec -i luv13-proxy python - < /home/kor/luv13-api/tests/mint_jwt.py)
curl -s -X POST http://127.0.0.1:4000/keys/generate \
  -H "Authorization: Bearer ${JWT}" \
  -H 'Content-Type: application/json' \
  -d '{"email":"internal@luv13.com"}'
echo
