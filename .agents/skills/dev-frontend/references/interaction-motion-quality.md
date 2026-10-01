# Interaction And Motion Quality

Load this reference only when the authorized frontend change adds or changes motion,
gesture behavior, transition ownership, or user-visible interaction feedback. Do not
load it for every frontend edit or use it to redesign an approved surface.

## Authority And Purpose

1. Read the applicable product behavior, UI contract, resolved `<design-root>/DESIGN.md`, and existing
   component or motion tokens before choosing an implementation.
2. State the communication purpose: state indication, action feedback, spatial
   relationship, change explanation, or prevention of a jarring transition. Remove or
   omit motion with no purpose unless an approved contract explicitly requires it.
3. Match motion cost to interaction frequency and familiarity. Keep keyboard-driven
   and high-frequency actions immediate; do not add decorative delay to routine work.
4. Preserve the repository's established motion vocabulary. Do not introduce a new
   library, timing scale, easing system, or visual style for one local change.

## Implementation Checks

- Provide immediate, unambiguous feedback for loading, success, failure, selection,
  expansion, dismissal, and disabled actions that the changed flow materially uses.
- Specify transitioned properties; do not introduce `transition: all`. Do not expand
  the task merely to remove unchanged occurrences outside the authorized scope.
- Prefer the shortest duration and least movement that communicate the change. Exact
  timing, easing, spring, scale, and displacement values come from repository contracts
  or task evidence, not a universal personal preference.
- Prefer transform or opacity when they preserve the required layout and semantics;
  do not rewrite necessary layout behavior merely to satisfy that preference.
- Keep rapid, reversible, or gesture-driven interactions interruptible so a new input
  can take control without waiting for a stale sequence to finish.
- Respect reduced-motion preferences when movement is material, preserve focus and
  keyboard behavior, and gate hover-only effects on devices that support hover.
- Avoid animation-only wrappers when an existing semantic or state-owning element can
  own the same effect without changing layout, accessibility, or reuse boundaries.

## Validation

Source inspection proves declarations and ownership only. Exercise the affected states
and rapid repeated input at the relevant viewport when timing, interruption, spatial
continuity, hover capability, or perceived feedback is part of acceptance. Record
reduced-motion behavior when applicable. If runtime evidence is unavailable, report
the affected behavior `Not verified`; do not claim interaction or motion quality from
build, lint, typecheck, or static CSS alone.
