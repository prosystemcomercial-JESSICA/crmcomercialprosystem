# Multi-Surface UI Contracts

Use this reference only when one task covers multiple pages, flows, or business domains.

## Scope Gate

- A **surface** is a separate reachable page, modal, panel, or embedded UI region.
- A **flow** is one connected user job whose states and acceptance can be evaluated together.
- A **domain** owns distinct behavior, data, permissions, failure semantics, or acceptance.

Several requested pages stay in one slice only when they share the same flow, state model,
implementer, and acceptance. Home, tasks, contacts, and profile are independent domains by
default unless facts prove they are one domain.

## Shared Index Scope

| Scope | Required artifact |
| --- | --- |
| One page/flow | One Feature Spec contract |
| Multiple connected surfaces in one domain | One domain-level Feature Spec contract |
| Multiple independent domains with shared visual rules | One short shared index + one independently loadable Feature Spec per domain |
| Shared token/component semantic change across slices | Design System Spec update to resolved `<design-root>/DESIGN.md` |

The shared index contains only source identity, the resolved `DESIGN.md` link and accepted
revision, inventory, per-slice links, per-slice status, exclusions, and dependencies.
Do not copy shared visual rules into the index.

Each slice contract must include:

1. selected source identity and boundaries (`use`/`ignore`)
2. hierarchy, regions, and responsive behavior
3. states, transitions, feedback ownership, overflow, and loading/error/empty/success paths
4. keyboard/focus, reduced-motion, localization, and accessibility rules
5. component mapping and acceptance checks with per-slice blockers

## Consumer Read Order

Read only this order when implementing one slice:

1. effective repository guidance and declared authority paths or exceptions
2. applicable product foundation/index facts and target product slice
3. resolved `<design-root>/DESIGN.md`
4. shared UI index (for multi-slice tasks only)
5. target UI slice contract

Do not require sibling slice contracts for implementation.

## Readiness and Partial Results

Evaluate every requested slice independently.

- Emit `Ready for dev-frontend <slice>` only when that slice passes all gates.
- Unconfirmed slices remain listed in the shared index with blockers.
- One incomplete slice does not block unrelated ready slices.
- Mark overall result `Partial` when any requested slice is unready or missing required gates.
- Mark overall result `Complete` only when all requested slices are ready.

## Design System Change Gate for Multi-Slice

When a request requires shared token/component change:

- Update resolved `<design-root>/DESIGN.md` content.
- Before handoff, run official lint and diff gates against the resolved design root:
  - `npx -p @google/design.md@0.4.0 designmd lint --format json <design-root>/DESIGN.md`
  - `npx -p @google/design.md@0.4.0 designmd diff <before-DESIGN.md> <design-root>/DESIGN.md --format json`

No additional machine artifact is required for this gate.
