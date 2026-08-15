#!/usr/bin/env bash
set -euo pipefail
cd /home/kor/neuralwatt-proxy
mkdir -p backups
cp -a proxy.py "backups/proxy.py.cap-ui.$(date +%Y%m%d-%H%M%S).bak"
docker compose build proxy
docker compose up -d --force-recreate
sleep 4
curl -sS -m 5 http://127.0.0.1:4000/health
echo
docker exec luv13-proxy grep -n 'fmtTs(f.timestamp\|clear-requests-btn\|Took\|Hang diagnostics' /app/proxy.py | head -15
echo DEPLOY_CAP_UI_DONE
