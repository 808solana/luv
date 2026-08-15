#!/usr/bin/env bash
set -euo pipefail
cd /home/kor/neuralwatt-proxy

python3 - <<'PY'
import json
from collections import Counter
d = json.load(open("partb_capture_on_results.json"))
print("requests_completed", d.get("requests_completed"))
print("requests_errored", d.get("requests_errored"))
print("tok_per_min_steady_state_total", d.get("tok_per_min_steady_state_total"))
print("tok_per_min_steady_state_output", d.get("tok_per_min_steady_state_output"))
print("slot_cap", d.get("slot_cap"))
print("latency_s", d.get("latency_s"))
c = Counter()
for e in d.get("error_sample") or []:
    c[e[1]] += 1
print("error_sample_kinds", dict(c))
# Heuristic: how many error_sample entries mention sampler vs stream
sampler = sum(1 for e in (d.get("error_sample") or []) if e[1] == "sampler_error")
streamish = sum(1 for e in (d.get("error_sample") or []) if e[1] != "sampler_error")
print("error_sample_sampler", sampler, "error_sample_other", streamish)
PY

cp -a .env "backups/env.crlffix.$(date +%Y%m%d-%H%M%S).bak"
sed -i 's/\r$//' .env
docker compose up -d
sleep 3
curl -sS -m 5 http://127.0.0.1:4000/health
echo
docker logs luv13-proxy --tail 8 2>&1 | grep -E 'CAPTURE|ready|router' || true
echo "capture_count=$(ls data/captures/capture_*.jsonl | wc -l)"
echo "POSTFIX_DONE"
