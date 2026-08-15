# PLAN.md — Addendum & Corrections (read after the plan above; these OVERRIDE where they conflict)

> Appended 2026-08-13. The plan above is approved in shape. This section corrects three concrete issues, assigns phases to the actual agents available, and lists the human prerequisites that must be done before autonomous execution begins. Where this addendum conflicts with the plan, **this addendum wins.**

---

## A. Agent routing — who executes which phase

Two execution agents are available with **different reach**:

- **Hermes** — runs **on the Debian server**. Can read live files, enter containers, read the DB and captures, run deploys. This is ground truth. Acts autonomously; for risky changes instruct "plan only, wait for approval."
- **Cursor** — excellent at web/API code, but **cannot assume it can SSH into the server** (prior cloud-agent attempts failed: no Tailscale identity, SSH key not present, LAN unreachable).

**Routing:**
- **Phases 0, 1, 2 (SSH restore, source import, PATH-0 proxy key) → Hermes.** Do not have Cursor attempt SSH or proxy-DB work. If Cursor is running locally with verified server reach, it may assist, but Hermes owns anything touching the server or the proxy DB.
- **Phase 3 (TLS/DNS) → Hermes + human** (registrar/cert steps need host + DNS access).
- **Phases 4, 5, 6 (migration, enforcement, Stripe) → API code by Cursor; execution/deploy on server by Hermes.**
- **Phase 7 (web flow) → Cursor.**
- **Phases 8, 9 (deploy + smoke) → Hermes drives; Cursor verifies web.**

Never hand an SSH-gated phase to an agent that cannot reach the server.

---

## B. Metering unit — OVERRIDE the "integer cents" instruction

**Integer cents is correct for Stripe amounts, WRONG for token metering.** At $0.33 / 1,000,000 tokens, a 3,000-token request costs $0.00099 → **rounds to 0 cents**. Every request under ~15,000 tokens would round to zero and never decrement the balance — a silent free-usage leak.

**Rule:**
- **Wallet balance and per-request charges are stored and computed in integer MICRO-DOLLARS (µ$ = 1e-6 USD).** 1 cent = 10,000 µ$. $5.00 = 5,000,000 µ$. A 3,000-token GLM request = 3000 × 0.33 = **990 µ$** (representable, accumulates correctly).
- **Stripe amounts stay in integer cents** (Stripe's native unit). The `topups` table stores cents (matching Stripe); crediting the wallet converts cents → µ$ exactly (`cents × 10,000`).
- Rate lives as µ$ per token, or as µ$ per million with integer division defined explicitly. Never use floating-point for balance, charge, reservation, or settlement. Display layer converts µ$ → `$X.XX` for the UI only.
- Rounding policy: define once (round half-up or floor) and apply the SAME policy to reservation and settlement so they can't disagree by a unit. Test the boundary at tiny requests (10–100 tokens) and confirm they charge a non-zero µ$ amount.

Supersedes the plan's "integer cents" lines in Phase 4, Phase 5, and Technical Cautions **for metering only**. Stripe crediting remains in cents.

---

## C. Reservation & cut semantics — CLARIFY Phase 5 (prevents false 402s)

The proxy sets **no `max_tokens`**, so there is no natural output cap to reserve against. A naive worst-case reservation will 402 low-balance users for requests they could actually afford. Fix:

1. **Reserve** = `(estimated_input_tokens + OUTPUT_BUDGET_TOKENS) × rate`, in µ$, via one atomic conditional decrement of available balance (concurrent requests cannot reserve the same µ$).
   - `OUTPUT_BUDGET_TOKENS` is a **modest configurable default (start ~4,000)**, not worst-case.
2. **Best-effort reservation for low balance:** if the user cannot cover the full budget but CAN cover `estimated_input + a small output floor` (e.g. a few hundred tokens), **reserve what they can afford and proceed** — do not 402. Only return **402** when balance cannot even cover input + the floor. This keeps a $0.03 user able to buy a $0.02 answer.
3. **Mid-stream guard:** track output with `chars / 4` as a guard **inside the reserved budget**. This is a guard, not the concurrency control — the atomic reservation in step 1 is the concurrency control.
4. **Hard cut fires against ACTUAL affordable balance, not the arbitrary budget.** When reserved credit is exhausted AND no further balance can be reserved, close upstream, emit the insufficient-credit message (see §D), preserve tool-call framing, end cleanly.
5. **Settle** at every terminal path (normal / error / cancel / cut) exactly once: charge observed usage in µ$ (from the real usage chunk on normal completion; from the `chars/4` estimate on a forced cut where no usage chunk arrives), release the remainder atomically. Idempotent — retries cannot double-debit or double-release.

**Tonight-minimum vs tomorrow:** steps 1–5 are tonight. **Incremental re-reservation** (extending the hold mid-stream so a *legitimate* long response from a well-funded user is never cut at the 4k budget) is **tomorrow** — tonight, set `OUTPUT_BUDGET_TOKENS` generous enough (~8,000) that normal responses fit, and accept that a genuinely long response from a well-funded user could cut early in the rare case. Do NOT sacrifice the low-balance best-effort path (step 2) to achieve this.

---

## D. The insufficient-credit message is a growth mechanism — keep it sharp

When blocked (402 pre-gate) or cut (mid-stream), the client must see, right in the output, a **dead-simple two-click path to more credit**:

> `You're out of credits. Top up here: https://luv13.com/topup`

- Use the real top-up URL. The 402 body carries the same text so non-chat clients surface it too.
- This link is the conversion loop — a tourist who hits zero should be one tap from paying, not hunting through a dashboard. Do not bury it behind generic "insufficient balance" copy.

---

## E. Verify the customer model slug — do not break the working client

The live config maps a customer slug to `glm-5.2`. The plan standardizes on `luv13-glm-5.2`, but AGENT_MEMORY referenced `luv-1`, and prefixed slugs (`luv13-glm-5.2-fast`, `luv13-kimi-code`, etc.) reportedly already exist internally. A client **already works today** against some slug.

**Before changing anything:** confirm from the live system exactly which customer slug(s) currently resolve to GLM, and ensure the already-working client keeps working. If standardizing on `luv13-glm-5.2`, add it as an accepted alias rather than removing whatever currently works. Breaking an existing working key path is a No-Go.

---

## F. TLS/DNS is real but should NOT gate the core product tonight

Apex TLS repair and `www` DNS (Phase 3) can eat the night and depend on propagation. The core product (Phases 2, 4, 5, 6 + a reachable dashboard) does not strictly require the apex vanity domain.

**Fallback if apex TLS can't be fixed fast:** the session cookie is scoped `Domain=.luv13.com`, so serve the dashboard from a **working subdomain** tonight (e.g. `app.luv13.com`, or co-locate on `api.luv13.com`) — the cookie and CORS already span subdomains. Fix the apex properly tomorrow. This keeps "a customer can pay and make a call tonight" achievable even if the apex cert lags. Treat Phase 3 as **parallel/non-blocking**, not a hard gate on the customer journey.

---

## G. Human prerequisites — DO THESE BEFORE autonomous execution starts

An autonomous run will silently stall on any of these. Clear them first:

- [ ] **SSH restored** to the server (or confirmed that Hermes drives all on-server phases).
- [ ] **Stripe webhook registered** in the Stripe dashboard → endpoint `https://api.luv13.com/billing/webhook`; **signing secret copied into the API secret store.** (Cursor cannot do this dashboard step.)
- [ ] **Stripe confirmed in LIVE mode**; live keys (not test) in the secret store.
- [ ] **`www` DNS record** added (or redirect decided) at the registrar — start early for propagation.
- [ ] **DB backup rehearsed and proven restorable** before any migration runs (already in the plan's go/no-go — verify it's actually done, not assumed).

---

## H. Minor notes (not blockers)

- **Legacy users start at 0 balance** and will 402 until topped up. Expected (they're test accounts: `verify@`, `debug@`, `pubtest@`). Don't be surprised by it.
- **New-user empty state:** a $0 signup who creates a key and immediately gets 402 may think it's broken. Make the dashboard empty state and the 402 message explicitly say "top up to activate your key," so a tourist doesn't bounce.
- **Zero-token dead-stream leak** (a dead stream with no usage chunk metering nothing) is closed by §C step 5 — confirm every terminal path debits something sane.
