---
name: openrouter-integration
description: Use when calling OpenRouter APIs — chat completions, Fusion, or model list. Covers both Love AI key and BYOK flows.
created: 2026-06-22
updated: 2026-06-22
tags: [api, openrouter, fusion, streaming]
---

# OpenRouter Integration

## When to Use
- Implementing any OpenRouter API call
- Setting up Fusion (panel + judge)
- Wiring up the model list endpoint
- Don't use when: building mock/test responses

## Key Endpoints
- Chat: `POST https://openrouter.ai/api/v1/chat/completions`
- Models: `GET https://openrouter.ai/api/v1/models`
- Fusion: `POST https://openrouter.ai/api/v1/chat/completions` with `models` array + `route: "fusion"`

## Auth Patterns

**Love AI key (default):** Key lives in `.env.local` as `OPENROUTER_API_KEY`. All calls go through Next.js API routes — key never touches the client.

**BYOK:** User's key is stored in localStorage. Client sends it directly to OpenRouter, bypassing Love AI's server entirely. Pass as `Authorization: Bearer <user-key>`.

## Fusion Call Shape (CONFIRMED 2026-06-22)
The old `route: "fusion"` field is WRONG. The actual API:

```json
{
  "model": "openrouter/fusion",
  "messages": [...],
  "stream": true,
  "plugins": [{
    "id": "fusion",
    "analysis_models": ["model-a-id", "model-b-id"],
    "model": "optional-judge-model-id"
  }]
}
```

- `model: "openrouter/fusion"` — the Fusion model slug
- `plugins[0].analysis_models` — the panel models (1–8 allowed)
- `plugins[0].model` — **THE judge model override**. When omitted, defaults to Claude Opus. This is how you control "what model to fuse with" — the judge model writes the final answer.
- Love AI UI: dynamic panel list (up to 4) via "+ Add model" button + "Fuse with" picker for the judge

## Model List Caching
- Cache `/api/v1/models` response for 1 hour using Next.js `fetch` with `next: { revalidate: 3600 }`
- Pin `openrouter/auto` at the top of the list — it is NOT returned by the models API, must be added as a synthetic entry
- Models API response shape: `{ data: Model[] }` — access via `.data`
- As of 2026-06-22: ~339 real models + 1 synthetic = 340 total

## Streaming
- Use `stream: true` for chat + agent steps; stream each step's response as it arrives
- Use SSE (`text/event-stream`) on the Next.js API route side

## Pitfalls
- Never put `OPENROUTER_API_KEY` in client-side code or the client bundle
- Fusion `route: "fusion"` field — confirm exact field name against OpenRouter docs before shipping
- Model IDs change; always fetch from `/api/v1/models` rather than hardcoding

## Verification
- [ ] `/api/health` returns 200
- [ ] Simple chat call returns a streamed response
- [ ] Fusion call returns a response that cites contributing models
- [ ] Model list loads and `openrouter/auto` is pinned first
