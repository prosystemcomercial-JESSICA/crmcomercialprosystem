# Visual Direction And Anti-Slop

## Activation And Authority

Use this protocol only when a selected source, accepted redesign direction, or explicit
visual-quality request makes visual direction material. Do not load it for copy-only,
data-only, invisible behavior, or contract-neutral refactors.

- Product requirements own audience, tasks, behavior, and acceptance.
- Resolved `<design-root>/DESIGN.md` owns adopted shared visual semantics.
- A selected-source UI Feature Spec owns page/flow visual acceptance.
- Product Design or another user-selected source owns visual exploration; these
  frontend Skills do not silently invent or replace that direction.

## Design Read And Optional Dials

Record one compact Design Read from verified inputs: surface/page kind, audience,
brand language, selected source or aesthetic family, and overriding constraints such
as regulation, accessibility, platform, or existing product conventions. Do not add a
user-facing ceremony when those facts are already explicit; preserve them in the
specification, implementation handoff, or audit basis.

Use `DESIGN_VARIANCE`, `MOTION_INTENSITY`, and `VISUAL_DENSITY` on a 1-10 scale only
when they make a material visual choice clearer. Every value needs a source or short
rationale, may be `Not applicable`, and cannot override an accepted source, the
resolved `<design-root>/DESIGN.md`, reduced-motion requirement, or product constraint. Do not install a
catalog-wide default such as `8/6/4`.

## Theme And Color Contract

Keep one primary accent semantic role for one accepted visual system. That role may
have interaction, tonal, and contrast variants; semantic success, warning, danger,
information, data-series, and accessibility colors remain independently owned. Do not
flatten those roles into the accent or introduce competing decorative accent systems.

Dark mode is conditional, not mandatory. Specify, implement, or audit it only when the
user, selected source, resolved `<design-root>/DESIGN.md`, existing product contract, or target
platform requires it. When selected, map the same semantic roles into dark tokens and
verify contrast, elevation/surface separation, imagery, focus, hover, disabled, and
system-preference/manual-toggle behavior that is actually in scope. Do not add a dark
theme merely because the surface is consumer-facing.

## Existing-Surface Mode

Classify an existing surface before changing visual direction:

- **Preserve:** default when no approved overhaul exists. Preserve brand identity,
  information architecture, routes, product semantics, SEO-sensitive structure,
  analytics identifiers, accessibility wins, and established component ownership.
- **Overhaul:** require an approved new visual direction. Preserve product behavior,
  content/IA, routes, analytics, legal text, and accessibility unless each change is
  separately authorized and accepted.

Apply the smallest visual lever that satisfies the accepted direction. Do not turn a
page-level correction into a new shared design system.

## Contextual Anti-Slop Check

Inspect only applicable items and tie every rejection to the accepted direction,
existing system, nearest analogue, measured inconsistency, or user impact:

1. Design Read matches the actual surface and audience.
2. Hierarchy makes the primary task/action evident without decorative competition.
3. Typography follows adopted roles and real content rather than a generic AI stack.
4. One primary accent role remains consistent; semantic colors keep their meaning.
5. Dark mode is selected and verified only when contractually applicable.
6. Density matches the task instead of forcing marketing airiness or dashboard packing.
7. Layout families vary only when content/interaction benefits; deliberate repetition
   for consistency is valid, while accidental copy-paste rhythm is not.
8. Shell, container, page, and component insets have explicit owners; no double inset
   or visually shifted left/top boundary survives.
9. Existing primitives/tokens are reused or deliberately extended before new ones.
10. Cards, pills, gradients, glass, shadows, bento grids, and centered heroes appear
    only when they communicate hierarchy or brand intent, not as defaults.
11. Real content and asset ownership replace generic names, fake metrics, and one
    universal placeholder where fidelity matters.
12. Loading, empty, error, populated, permission, focus, hover, disabled, and long
    content states preserve the visual and interaction contract when applicable.
13. Responsive behavior preserves reading order, task priority, alignment, and overflow.
14. Motion communicates hierarchy, feedback, or state change; reduced motion and
    interruption remain valid.
15. Static declarations, screenshots, builds, and runtime measurements retain their
    separate evidence levels; unchecked visual quality remains `Not verified`.

`ui-spec` records accepted decisions and evidence. `dev-frontend` implements the
smallest aligned source change. `audit-frontend` reports only evidence-backed drift and
routes remediation without editing.
