#!/usr/bin/env python3
"""Quick real-chat debug against luv13-api on kor."""
import json
import urllib.request

BASE = "http://127.0.0.1:4100"
ADMIN = "0a43622fce11aa126bebab4007d922f655e3c11f7b3bce5dc8c676ebc7d64a1b"

# create key
req = urllib.request.Request(f"{BASE}/internal/keys", method="POST",
    data=json.dumps({"email": "debug@luv13.com", "name": "dbg"}).encode(),
    headers={"X-Admin-Secret": ADMIN, "Content-Type": "application/json"})
key = json.loads(urllib.request.urlopen(req).read())["key"]
print("key:", key[:20] + "...")

# chat completion
req = urllib.request.Request(f"{BASE}/v1/chat/completions", method="POST",
    data=json.dumps({"model": "luv-1", "messages": [{"role": "user", "content": "Say hello in exactly 3 words."}]}).encode(),
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
try:
    resp = urllib.request.urlopen(req, timeout=60)
    data = json.loads(resp.read())
    print("status:", resp.status)
    print("model:", data.get("model"))
    print("usage:", data.get("usage"))
    choice = data.get("choices", [{}])[0]
    print("message:", choice.get("message"))
    print("finish_reason:", choice.get("finish_reason"))
except urllib.error.HTTPError as e:
    print("HTTP error:", e.code)
    print(e.read().decode()[:500])

# streaming chat
import http.client
conn = http.client.HTTPConnection("127.0.0.1", 4100)
body = json.dumps({"model": "luv-1", "stream": True, "messages": [{"role": "user", "content": "Say hi in 2 words."}]})
conn.request("POST", "/v1/chat/completions", body, {"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
r = conn.getresponse()
print("\nstream status:", r.status)
usage = None
model_lines = set()
for line in r:
    s = line.decode()
    if s.startswith("data: ") and s.strip() != "data: [DONE]":
        try:
            c = json.loads(s[6:])
            if c.get("model"): model_lines.add(c["model"])
            if c.get("usage"): usage = c["usage"]
        except Exception:
            pass
print("stream models:", model_lines)
print("stream usage:", usage)

# usage log
req = urllib.request.Request(f"{BASE}/internal/usage?email=debug@luv13.com",
    headers={"X-Admin-Secret": ADMIN})
d = json.loads(urllib.request.urlopen(req).read())
print("\nusage rows:", len(d["requests"]))
for row in d["requests"][:2]:
    print(" ", {k: row[k] for k in ("model","tokens_in","tokens_out","tokens_cached","cost_usd","status")})

# summary
req = urllib.request.Request(f"{BASE}/internal/summary?email=debug@luv13.com",
    headers={"X-Admin-Secret": ADMIN})
s = json.loads(urllib.request.urlopen(req).read())
print("summary:", {k: s[k] for k in ("total_requests","total_tokens","total_cost_usd")})
