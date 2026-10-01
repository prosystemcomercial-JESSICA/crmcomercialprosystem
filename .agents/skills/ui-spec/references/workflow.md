# UI Specification Workflow

## Contents

1. Candidate or visual source gate
2. Evidence boundary
3. UI contract challenge
4. Profile gate
5. Specification pass
6. Viewport acceptance matrix
7. Artifact pass
8. Evaluation and handoff

## Candidate Or Visual Source Gate

Require either a source-grounded user-directed candidate or one selected source: a
user-selected Product Design result, supplied screenshot/mockup/frame, accepted
current surface, or accepted shared-system revision. For an unapproved candidate,
load `candidate-visual-direction.md`, create only the ignored candidate pair, and stop
`Not Ready` before formal specification or implementation handoff. Route actual
alternatives, generation, redesign, critique, or prototype work to the matching host
capability; route a named external-model send to `ask-ai`.

For a selected source, record its stable identity, revision, selection/approval
status, rights status, `use`, and `ignore` rules, then continue below.

A visual source proves appearance only. It does not prove exact tokens, component ownership, product behavior, API data, accessibility, responsive behavior, or runtime state. Resolve conflicts in favor of verified product facts and accepted live owners; do not silently repair the source by invention.

## Evidence Boundary

Record confirmed product facts, available data/actions/states, current component and token owners, explicit exclusions, unresolved questions, and the source revision. Mark each specification decision `source-extracted`, `browser-computed`, `visually-inferred`, `proposed`, or `Not verified`. Keep the selected-source target, current runtime, and accepted target contract in separate fields.

Resolve component and design-library mappings from live imports, wrappers, and
consumers before naming them. Never promote a concept-only component or feature into
the candidate, selected-source target, or product scope.

## UI Contract Challenge

After product facts and the selected visual source are fixed, resolve repository and
source evidence before asking a question. Challenge only a remaining decision that can
change layout or ownership, component/token mapping, required states or interaction,
responsive/accessibility behavior, or an executable UI acceptance result.

Ask one bounded question at a time. Include the recommended answer, reason, principal
trade-off, and affected slice. Stop when the slice passes its UI contract gates; do not
traverse its product decision tree or reopen accepted visual direction. Route behavior,
permission, failure semantics, or product acceptance to `product-spec`, and route
visual alternatives or an unselected direction to Product Design.

## Profile Gate

Choose **Feature Spec** unless at least one answer is yes:

- Must a shared semantic token be added, removed, or redefined?
- Must a reusable component's meaning, public variant contract, or state vocabulary change?
- Must several surfaces adopt a changed shared rule?
- Is an accepted shared-system owner being created, extracted, maintained, or evaluated?

If not, reference existing owners and keep the specification local. A boundary that
has not adopted `DESIGN.md` does not need to create it for this local path. If yes,
resolve the shared `<design-root>` and either open its adopted `DESIGN.md` or begin the
independently approved first-adoption path, then change only the shared closure.
Artifact presence does not prove acceptance: pending, rejected, or stale candidates
are not proof; verify live owners before reuse and require approval before promotion.

## Specification Pass

Translate the selected source into implementable decisions:

- page regions, hierarchy, layout/scroll/focus ownership, dimensions, density, overflow, and target sizes;
- semantic colors, typography roles, spacing, geometry, surfaces, assets, copy, and localization behavior;
- stable page-shell regions such as header, navigation, content, and overlays, including
  their ownership and responsive/scroll behavior without imposing universal dimensions;
- current components/tokens to `reuse`, bounded adaptations, and justified new declarations;
- loading, empty, error, populated, permission, validation, success, disabled, hover, focus, and reduced-motion behavior where applicable;
- state transitions, action ownership, feedback placement, and precedence between independent async domains;
- responsive reflow, touch/keyboard targets, contrast, semantic structure, and acceptance assertions.

When SVG icons apply, load `svg-icon-system.md`. Keep shared icon-family semantics in
the adopted `DESIGN.md` and page-local role/placement/state mapping in the Feature
Spec. Exact viewBox, stroke, size, and color values require accepted evidence; the
implementation owner, not `ui-spec`, produces the SVG source.

For the primary task, specify only applicable task-completion geometry: critical
actions, scroll and overlay ownership, intermediate-width behavior, state geometry,
long content/localization, and focus/zoom/touch behavior. Treat exact measurements as
verified only when an accepted authority provides them; otherwise mark them proposed
or `Not verified`.

Do not infer exact CSS values or behavior from pixels alone. Trace exact values to live source or an accepted contract; otherwise label them proposed and require acceptance before implementation.

## Viewport Acceptance Matrix

When a slice has responsive behavior or an explicitly bounded visual acceptance
scope, define one matrix in that slice's Feature Spec. A viewport entry is not
coverage by size alone: it pairs a size with the environment, UI state, assertions,
and source that authorizes the acceptance requirement. If viewport-specific
acceptance does not apply, record `Not applicable` and why.

| Tier | Size and orientation | Environment | State or fixture | Acceptance assertions | Evidence source and status |
| --- | --- | --- | --- | --- | --- |
| `required` | exact CSS viewport, orientation when material | browser/client, platform, zoom, theme, locale, or other material condition | named route plus loading/error/populated/permission or interaction state | observable layout, overflow, focus, interaction, and visual assertions | user requirement, accepted product/UI contract, or verified source; mark `verified`, `extracted`, `proposed`, or `Not verified` |
| `optional` | same fields as required | same fields as required | same fields as required | useful additional confidence, not a readiness gate | same evidence requirement as required |
| `excluded` | size/range and orientation if material | relevant known environment | state if exclusion is state-specific | why this is outside the acceptance scope | authority that excludes it and status; never write this as an unsupported-device claim |

Rules:

- Current explicit user viewport requirements override older specifications. Record
  conflicts instead of silently broadening or narrowing them.
- `required` entries are acceptance gates: implementation must preserve their
  contract, and `ops-browser` or `ops-client` must exercise them when runtime
  verification is authorized. A missing required run remains `Not verified`; it is
  not silently satisfied by a screenshot at another size.
- `optional` entries are exercised only when the task's agreed budget permits. State
  whether each was run, skipped, or not authorized; skipping does not block readiness
  unless another accepted contract makes it required.
- `excluded` means only that this Feature Spec does not accept or reject the viewport.
  It does not permit a deliberate regression and does not claim the product lacks
  support there.
- Keep the matrix local to the affected slice. Do not hard-code a project's desktop
  sizes as a universal rule or duplicate this schema in `dev-frontend`,
  `audit-frontend`, `ops-browser`, or `ops-client`; those consumers receive this
  matrix in the handoff and apply their own stage responsibilities.

For example, an Admin surface may require `1920x1080`, make `1440x900` optional, and
exclude mobile from this acceptance slice when the current user request says so. That
is an Admin-specific contract example, not a default for other products or slices.

For every material visual difference, add an acceptance-ID delta row with
selected-source value/evidence, current-runtime value/evidence, target contract,
priority, shared-or-local owner, and runtime verification. An inspect-panel design
value outranks screenshot estimation; a browser-computed runtime value never becomes
the source target. Define product-asset ownership and isolated fallback behavior.

## Artifact Pass

| Profile | Primary artifact | Optional dependencies |
| --- | --- | --- |
| Feature Spec, one slice | the repository's existing UI-spec location; otherwise `docs/ui/<slice-id>/spec.md` as a fallback | source annotations, component/token mapping, state matrix, acceptance checklist |
| Feature Spec, multiple domains | one short shared UI index plus one independently loadable contract per confirmed domain | only shared facts and per-slice links/status in the index |
| Design System Spec | `<design-root>/DESIGN.md` (the only shared visual artifact for that boundary) | feature-spec references and relevant owner approvals |

For multiple surfaces, apply [the multi-surface scope gate](multi-surface.md). Produce
only what removes a real implementation ambiguity. The shared System update should be
single-sourced in `<design-root>/DESIGN.md`; do not create or maintain a separate Design System
manifest in this path.

## Lint And Diff Gates

The official lint and diff gates require external tool access and network authorization.
Run lint for every changed `<design-root>/DESIGN.md`. Run diff against the previous accepted file for an
update; record diff as `Not applicable` for the first accepted creation instead of
inventing a baseline. If a required tool cannot run, mark the gate `Not verified` and
keep the readiness result `Not Ready`.

Official lint success is only `official-format-valid`. For first adoption and every
Design System Spec, next run the package completeness checker from
`design-md-contract.md`. It requires the eight canonical H2 sections in order, machine
tokens or reviewed official omissions, prose-to-token application semantics, source
binding, shared-component truth, and (for adopted stage) exact-hash approval binding.
Only `ready-for-human-approval` may enter the approval request. The local adopted check
stops at `awaiting-trusted-approval-verification`; only a host-trusted approval
receipt bound to the exact Result Package may satisfy the downstream completeness
gate. It does not rewrite the producer result. A PackageManifest alone binds bytes
and basis but never upgrades either result.

## Evaluation And Handoff

Run source identity, product truth, rights, required-state, mapping, responsive,
viewport-matrix, accessibility, overflow, approval, and implementation-budget gates
per slice. When SVG icons apply, also run icon owner, rights, family consistency,
render/state, safety, accessibility, fallback, and gallery-acceptance gates. Then
compare source fidelity, task completion, information structure,
interaction completeness, engineering fit, and evidence completeness. Emit one
readiness verdict per slice and mark an incomplete multi-surface result `Partial`.
Hand the unchanged per-slice viewport matrix, accepted artifacts, and unresolved gaps
to `dev-frontend`, `audit-frontend`, and `ops-browser`/`ops-client`; include traceability
and asset gates, and request runtime evidence from the operations owner after
implementation.
