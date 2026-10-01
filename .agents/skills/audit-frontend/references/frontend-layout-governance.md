# Frontend Layout Governance

## Contents

- [Scope and Ownership](#scope-and-ownership)
- [Layout Responsibility Model](#layout-responsibility-model)
- [Nested Inset Contract](#nested-inset-contract)
- [Evidence and Findings](#evidence-and-findings)
- [Task-Completion Seam](#task-completion-seam)
- [Validation Proportionality](#validation-proportionality)

## Scope and Ownership

Use this protocol only when layout geometry, spacing, sizing, overflow, scrolling,
layering, or responsive behavior is material to the requested implementation or
audit. It provides shared vocabulary and evidence rules; it is not a CSS guide,
design-token table, breakpoint catalog, or framework recipe.

- Product requirements own user tasks, behavior, permissions, and acceptance.
- Resolved `<design-root>/DESIGN.md` owns adopted shared visual semantics.
- The target UI slice owns observable layout, interaction, responsive, and
  accessibility acceptance for that surface.
- Repository source owns the current shell, component, styling, and runtime model;
  it is implementation evidence, not silent approval for a conflicting decision.
- `ui-spec` records accepted layout ownership, `dev-frontend` owns source changes,
  and `audit-frontend` stays read-only.

## Layout Responsibility Model

Name the relevant owners before judging or changing geometry:

1. app or window shell: global chrome, viewport bounds, modal/overlay host;
2. content container: shared page inset and broad content bounds;
3. page root: page-level grid/flex composition and primary task region;
4. panel or component: local bounds, internal spacing, and local overflow;
5. overlay or floating layer: anchor, stacking, collision, focus, and dismissal;
6. scroll region: the element that intentionally owns each scroll axis.

One responsibility should have one effective owner. Parent layout owns relationships
between children; reusable components own their internal spacing. Intentional nested
scrolling, overlays, sticky regions, and fixed geometry are valid when their owner,
boundary, and user benefit are explicit.

## Nested Inset Contract

Trace horizontal and vertical insets through the whole rendered chain before changing
one `padding`, `margin`, `gap`, or utility class:

`shell -> content container -> page root -> section/panel -> reusable component -> control`

- Give each boundary one purpose. The shell may own viewport/chrome clearance, the
  content container may own the shared page inset, the page root may own composition,
  and a reusable component may own only its internal content spacing.
- Do not stack equal outer and inner padding by default. When the parent already owns
  the page inset, a child component should normally use its internal token only; use
  `padding: 0` or a documented edge-to-edge variant where another owner supplies the
  same boundary.
- Compare the effective sum on each axis, not isolated declarations. Record left,
  top, right, and bottom separately because a flush scrollbar, title baseline,
  sticky header, safe area, or command strip can require asymmetric ownership.
- Align sibling headings, controls, panels, empty states, and scroll content to one
  named left/top boundary or intentionally documented offset. Mathematical equality
  is not enough when borders, icons, optical alignment, or collapsed states change the
  visible edge.
- Keep the scroll owner padding-free when the scrollbar must remain flush to the
  viewport or panel edge; move readable-content inset to its inner content owner.
- A shared-shell change must not leak into pages with a different inset model. Verify
  the target page and at least one affected sibling/analogue when the owner is shared.

For specification, record the owner and expected effective inset rather than
prescribing incidental DOM. For implementation, remove competing declarations instead
of adding a late override. For audit, report double inset or misalignment only with
contract/source/runtime evidence and the exact competing owners.

## Evidence and Findings

Classify evidence as:

- **Contract:** approved requirement, resolved `<design-root>/DESIGN.md`, or target UI slice.
- **Source:** reachable DOM/component/style declarations and their cascade or
  composition path.
- **Runtime:** rendered geometry, computed styles, viewport/window behavior,
  interaction, focus, clipping, overlap, or scroll behavior.
- **Measurement:** dimensions, offsets, scroll extents, target size, zoom, or
  performance data captured from the relevant runtime.

Do not call spacing "too large" or "too small" from taste alone. Require at least one
of: a contract violation; duplicate or competing ownership; measured inconsistency
with the adopted system or nearest analogue; or concrete user impact such as hidden
actions, clipping, overlap, unreadable density, accidental scrolling, or loss of
task continuity. Record unresolved visual judgments as `Not verified`.

## Task-Completion Seam

For affected surfaces, trace the smallest applicable set:

- primary task and critical actions remain visible, reachable, and ordered;
- loading, empty, error, populated, validation, and permission states preserve the
  intended geometry and feedback ownership;
- long content and localization can wrap, shrink, truncate, or scroll without
  overlap or concealed controls;
- intermediate widths are checked when layout can change before a named breakpoint;
- overlay, sticky, and scroll owners do not compete for clipping or input;
- keyboard focus, zoom/reflow, and touch targets are checked when applicable;
- desktop-webview claims use a real application window when native chrome, window
  size, zoom, or platform behavior can affect the result.

## Validation Proportionality

Use static source evidence for deterministic ownership and declaration claims. Add
browser runtime evidence when wrapping, computed geometry, responsive reflow,
overlay placement, focus, or scroll behavior can change. Use real-client evidence
for desktop-window behavior that a browser preview cannot prove.

Validation is proportional to reachable impact. A copy-only change needs runtime
layout proof only when text length or state geometry can change; a layout-owner,
overflow, breakpoint, overlay, or fixed-size change normally does. Mark every
unexercised applicable runtime surface `Not verified` rather than imposing one
mandatory matrix on all frontend changes.
