#!/usr/bin/env bash
set -euo pipefail
cd /home/kor/neuralwatt-proxy
mkdir -p backups
cp -a proxy.py "backups/proxy.py.clear-btns.$(date +%Y%m%d-%H%M%S).bak"
docker compose build proxy
docker compose up -d --force-recreate
sleep 4
curl -sS -m 5 http://127.0.0.1:4000/health
echo
# Confirm routes exist in the running image
docker exec luv13-proxy grep -n 'admin/clear\|clear-requests-btn\|clear-events-btn' /app/proxy.py | head -10
echo DEPLOY_CLEAR_BTNS_DONE
