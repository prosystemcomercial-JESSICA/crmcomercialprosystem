---
target: login page (frontend/app/page.tsx + LoginForm.tsx)
total_score: 23
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 1
timestamp: 2026-08-17T23-00-54Z
slug: frontend-app-page-tsx
---
⚠️ DEGRADED: single-context detector (Assessment B's browser-automation sub-agent did not complete after ~25 minutes — no agent-browser tool was available in this environment, matching what Assessment A already reported for itself. Proceeded with Assessment A's full LLM design review plus a manually-run CLI detector pass instead of the full dual-agent protocol.)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Loading spinner + "Entrando..." is good, but a 400ms artificial `setTimeout` after successful login adds latency with no visible benefit |
| 2 | Match Between System and Real World | 3/4 | Plain, correct Portuguese throughout; no jargon |
| 3 | User Control and Freedom | 3/4 | Forgot-password flow has clean cancel path and closes on backdrop click |
| 4 | Consistency and Standards | 3/4 | Internally consistent visually, but hardcodes raw hex everywhere instead of `var(--t-*)` tokens — violates DESIGN.md's own "No Loose Hex Rule" |
| 5 | Error Prevention | 2/4 | Password validation only checks non-empty; no rate-limit/lockout messaging surfaced |
| 6 | Recognition Rather Than Recall | 4/4 | Icons, labels, visible password toggle — no memory burden |
| 7 | Flexibility and Efficiency | n/a | Not applicable to a login screen |
| 8 | Aesthetic and Minimalist Design | 3/4 | Right-panel form is well restrained; left brand panel has more ornamentation (circles, stat grid) than strictly needed |
| 9 | Error Recovery | 2/4 | Generic "Credenciais inválidas" doesn't distinguish failure causes |
| 10 | Help and Documentation | n/a | Absence is standard/acceptable for a login page |

**Total: 23/32 applicable → 71.9% → Good, with one systemic violation and one clarity gap**

## Design Specificity Verdict

**LLM assessment**: Not a generic template — the brand panel uses real, sourced numbers (16+ anos, 98% satisfação, 5x produtividade, 24/7 suporte, all confirmed real in PRODUCT.md, not fabricated) and the fixed institutional navy rather than stock SaaS illustration tropes. But the composition itself (decorative circles, diagonal divider, 2×2 stat grid) is borrowed from generic premium-SaaS visual vocabulary — nothing on the screen signals *pharmacy, compounding, bakery, retail*, the exact domain depth PRODUCT.md's own Positioning section names as the product's real moat. A CRM for dental clinics could ship this same screen by swapping four numbers.

**Deterministic scan**: `detect.mjs --json` against both files returned `[]` (exit code 0, clean) — the bundled mechanical detector catches visual anti-patterns (gradient text, emoji abuse, generic-default palettes) that don't apply here; it does not catch the token-hygiene violation Assessment A found, because hardcoded-hex-vs-token-variable is a project-specific semantic rule (DESIGN.md's own "No Loose Hex Rule"), not a universal pattern the generic detector knows to look for. No contradiction between the two — they're checking different things.

**Visual overlays**: Not available this run — see degraded banner above.

## Overall Impression

This is a calm, professionally restrained login form let down by two things: it silently defies the design system that was written specifically to prevent this project's costliest visual bug (hardcoded hex breaking the other themes/dark mode), and it says nothing about the one thing that makes Prosystem defensible against a generic competitor — deep knowledge of pharmacy/manipulação/padaria/varejo. Neither is a "the form is bad" problem; the interaction itself is genuinely well-built (keyboard flow, password toggle, forgot-password copy).

## What's Working

1. **The right-panel form's restraint is well-calibrated** — exactly two fields, one button, and the password-visibility toggle correctly uses `tabIndex={-1}` so keyboard users aren't interrupted mid-form. This is real craft, not just visual tidiness.
2. **The forgot-password success copy is honestly one of the better-written moments in the whole flow**: "Se o e-mail estiver cadastrado, você receberá a nova senha em instantes. Verifique sua caixa de entrada e spam." — correct security pattern (doesn't confirm/deny account existence) *and* gives a concrete next step, which most login flows get only half right.
3. **No fabricated social proof.** PRODUCT.md explicitly marks 16+/98%/5x/24-7 as real and warns against inventing more — the panel doesn't manufacture numbers it doesn't have, a real restraint most B2B login screens fail at.

## Priority Issues

**[P0] Hardcoded hex colors throughout `LoginForm.tsx` violate the project's own "No Loose Hex Rule"**
- **Why it matters:** DESIGN.md calls this "o erro mais caro que este sistema pode cometer" — it silently breaks the Laranja/Verde themes and dark mode. This is the one screen every user, of all ~40 in the system, sees unthemed and first.
- **Fix:** Replace every literal (`#0D2238`, `#4B8EC8`, `#C3DCFC`, `#7AAACB`, `#BE123C`, `#F43F5E`, `#FFF1F2`, `#FECDD3`, etc.) with the matching `var(--t-*)` token.
- **Suggested command:** `/impeccable harden`

**[P1] Zero vertical/domain specificity on the one screen everyone sees first**
- **Why it matters:** PRODUCT.md's own Positioning names domain depth (farmácia/manipulação/padaria/varejo) as the moat a generic competitor can't copy. This screen doesn't reflect it at all.
- **Fix:** Even a modest copy change — naming the four verticals instead of the fully abstract "Gerencie leads, funil de vendas, retenção e performance" — grounds the screen in the real product without new assets.
- **Suggested command:** `/impeccable adapt`

**[P2] Generic, non-diagnostic login error message**
- **Why it matters:** `'Credenciais inválidas. Tente novamente.'` funnels every failure mode into one vague string, at the single most likely negative-emotion moment in the flow.
- **Fix:** Distinguish network/connection failures from credential failures (the forgot-password handler already does this correctly; the main submit handler doesn't).
- **Suggested command:** `/impeccable clarify`

**[P3] Unexplained artificial 400ms delay after successful login**
- **Why it matters:** Taxes the fastest, highest-frequency path (successful login, used "várias vezes ao dia") for no visible benefit.
- **Fix:** Remove, or replace with a real minimum-loading-state tied to actual redirect readiness.
- **Suggested command:** `/impeccable optimize`

## Persona Red Flags

**Sam (accessibility-dependent user):**
- Password-visibility toggle button has no `aria-label` — a screen reader announces only "button," not "mostrar senha."
- Error banner has no `role="alert"`/`aria-live` — a screen-reader user gets no auditory signal an error appeared.
- Focus/blur border-color is set via inline JS style mutation rather than CSS `:focus-visible`, bypassing high-contrast/forced-colors OS overrides.

**Jordan (confused first-timer):**
- First-login flow silently redirects to `/alterar-senha?trocar=1` with zero forward warning on the login screen itself.
- The generic error doesn't help a brand-new user triage "wrong password" vs. "account not provisioned yet" vs. "should use forgot-password."

## Minor Observations

- Decorative brand-panel circles use 5% opacity — against navy this reads as functionally invisible; unclear if they're pulling any visual weight.
- Email/password inputs lack explicit `autoComplete="email"` / `autoComplete="current-password"` hints, which would meaningfully speed up a "várias vezes ao dia" interaction.
- The forgot-password flow emails a brand-new password rather than a reset link — a legitimate but slightly dated pattern, flagged only as a design/security tradeoff nobody has editorially acknowledged.

## Questions to Consider

1. If domain specialization is the core moat, why does the first screen every employee/prospect sees carry zero trace of it?
2. Was `LoginForm.tsx` written before the token system existed, or is DESIGN.md currently aspirational rather than enforced across the ~40-screen system?
