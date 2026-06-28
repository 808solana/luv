---
name: multi-agent-chain
description: Use when building a sequential multi-agent system (MAS) that streams step-by-step output to the UI. Supports both fixed default chain and user-customized chains with per-step model overrides.
created: 2026-06-22
updated: 2026-06-22
tags: [agent, streaming, sse, openrouter, nextjs, agent-builder]
---

# Multi-Agent System (MAS) — Sequential Streaming Chain

## When to Use
- Building a role-based agent chain (e.g. Research → Analysis → Reasoning → Writer)
- Need step-by-step UI rendering with per-step streaming
- One OpenRouter call per step, each step using the previous step's output as context

Don't use when:
- You need parallel agent execution (use Fusion instead)
- Single-step answer is sufficient (use `/api/chat`)

## Architecture

**Single SSE stream, typed events.** One `/api/agent` POST returns one `text/event-stream`. Inside, the server runs each step sequentially, forwarding deltas as typed JSON events:

```
data: {"type":"step_start","stepId":"research","name":"Research"}\n\n
data: {"type":"delta","stepId":"research","content":"..."}\n\n
data: {"type":"step_end","stepId":"research"}\n\n
... (repeat per step)
data: {"type":"done"}\n\n
```

**Per-step prompt pattern:** Each step gets:
- System message = step's role prompt (e.g. "You are the Research agent...")
- User message = original user query + previous step's full output as context

The previous step's output is accumulated server-side (not re-sent by client).

## Two Modes: Fixed vs Custom

**Fixed mode** (`agentMode: "fixed"`): Uses `DEFAULT_AGENT_CHAIN` from `src/lib/agentChain.ts`. The default 4-step chain: Research → Analysis → Reasoning → Writer. All steps share the model from the Model Picker.

**Custom mode** (`agentMode: "custom"`): User builds their own chain via the AgentBuilder modal. Steps are stored in `customChain: AgentStepDefinition[]` in the Zustand store. Each step can optionally override the shared model with a `modelOverride` field.

The API route (`/api/agent`) accepts an optional `steps: AgentStepDefinition[]` in the request body. If present, it's used instead of `DEFAULT_AGENT_CHAIN`. Per-step `modelOverride` is applied server-side.

## Key Files

- `src/lib/agentChain.ts` — `DEFAULT_AGENT_CHAIN` and `AgentStepDefinition` import
- `src/app/api/agent/route.ts` — server-side chain execution, accepts `steps` body param
- `src/lib/streamAgent.ts` — client SSE parser, accepts `chain` option for custom chains
- `src/store/chat.ts` — `agentMode`, `customChain`, `setAgentMode`, `setCustomChain`, `resetCustomChain`
- `src/components/AgentBuilder/index.tsx` — modal UI for building custom chains
- `src/components/AgentBuilder/StepCard.tsx` — editable step card (name, prompt, model override)
- `src/types/chat.ts` — `AgentMode`, `AgentStepDefinition`, `AgentStepOutput`
- `src/app/page.tsx` — passes `chain: agentMode === "custom" ? customChain : undefined` to streamAgent

## AgentBuilder Modal Behavior

- **Activation**: "Customize" button appears in QueryBar only when Agent mode is active
- **Modal**: switches between Fixed/Custom tabs; Fixed shows read-only preview of default chain; Custom shows editable step cards
- **Step editing**: name input, prompt textarea, model override dropdown
- **Reordering**: up/down arrow buttons per step
- **Add/Remove**: minimum 2 steps enforced; "Add step" appends; trash icon removes
- **Reset**: restores draft to default chain
- **Save**: commits draft to store (agentMode + customChain) and closes modal
- **Key remount**: the modal uses a `key` counter in QueryBar to force fresh mount each open, so drafts always start from store state (avoids useEffect setState lint violation)

## Steps

1. Define chain in `src/lib/agentChain.ts` — array of `{ id, name, prompt }`
2. API route (`src/app/api/agent/route.ts`):
   - `ReadableStream` with `start(controller)` — use `controller.enqueue(encoder.encode("data: ...\n\n"))`
   - Accept optional `steps` array in body; fall back to `DEFAULT_AGENT_CHAIN`
   - For each step: use `step.modelOverride ?? model` for model selection
   - For each step: send `step_start`, fetch OpenRouter streaming, parse upstream SSE, forward `delta` events, send `step_end`
   - Carry step's accumulated output forward as next step's context
   - Send `done` at end, `controller.close()`
   - Log per step: `[HH:MM:SS] [agent:StepName] model=X chars=Y duration=Zms`
   - Log chain complete with `chain=custom` or `chain=default`
3. Client parser (`src/lib/streamAgent.ts`):
   - Pre-initialize all step cards empty (gives "chain working" feel immediately)
   - Accept optional `chain` parameter; falls back to `DEFAULT_AGENT_CHAIN`
   - Parse typed events, call store actions per event type
4. Store: `agentMode`, `customChain`, `setAgentSteps`, `appendToAgentStep`, `setAgentStepStreaming` — operates on a single assistant message's `agentSteps: AgentStepOutput[]`
5. UI: render each step as a labeled card with streaming cursor

## Model Override Wire-Up Detail

When a step has `modelOverride` set:
- **Store**: `customChain[i].modelOverride` is set via the step card's model dropdown
- **page.tsx**: passes `customChain` to `streamAgent()` → includes `steps` in POST body
- **route.ts**: `const stepModel = step.modelOverride ?? model` — uses override for that step's OpenRouter call
- **Logging**: step model logged as `model (override)` when different from shared model
- **Client**: `OpenRouterMessage` objects sent by `streamChat`/`streamFusion`/`streamAgent` from server-side only (not affected by modelOverride)

## Pitfalls

- **Don't try to parallelize steps** — each step needs the prior step's output as context. Sequential is required.
- **Don't send the full chain to the client and let it orchestrate** — server must own the chain so the Love AI key stays server-side and prompts aren't exposed.
- **API route changes need a server restart** — Next.js hot reload is unreliable for `src/app/api/**`. Kill node + restart `npm run dev` after editing the route.
- **Don't forget to close the controller** — both on `done` and on error paths, or the client hangs.
- **Tolerate non-`data:` lines** in upstream SSE — OpenRouter sends `: OPENROUTER PROCESSING` keep-alive comments. Filter by `startsWith("data: ")`.
- **`data: [DONE]`** from upstream is not the end of the chain — it's the end of one step. Only close after all steps complete and you've sent your own `done` event.
- **AgentBuilder remounting**: don't sync drafts via useEffect with setState — use a key prop to force remount (fresh useState initializers) each time the modal opens.

## Verification

- [ ] Server log shows one line per step with model/chars/duration
- [ ] Server log shows final `chain complete` line with total duration
- [ ] UI shows step cards filling in one at a time (not all at once)
- [ ] Switching the Model Picker changes the model logged for all steps
- [ ] Reloading the page preserves prior agent step cards (steps are part of the persisted message)
- [ ] Custom chain: toggle to Custom mode, edit steps, save, submit — confirm custom step names appear
- [ ] Custom chain: add a model override, submit — confirm server log shows override model for that step
- [ ] Custom chain: delete a step, reorder — confirm chain runs in new order
