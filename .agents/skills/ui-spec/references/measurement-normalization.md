# Selected-Source Measurement Normalization

Load this reference when a design-tool handoff contains exact selected-element
measurements and repeated spacing values, including `lanhu-ui-evidence/v1`.

## Evidence Preservation

Keep every raw measurement, source element/layer ID, property, axis, artboard/state,
revision, and evidence ID. Inspect/style/code-panel metadata may be
`source-extracted`; canvas or screenshot estimates remain `visually-inferred`.
Never rewrite raw source evidence to match the target contract.

Build a spacing cluster only for the same semantic relationship, component/variant,
state, viewport/artboard, axis, and property. Margin, padding, gap, alignment offset,
element size, position, typography, border, radius, icon size, and asset dimensions
are different properties and must not be pooled.

## Default Even-Grid Rule

When no stricter accepted source or repository spacing contract conflicts, normalize
one repeated spacing cluster to its majority value only when:

1. at least three integer-pixel samples exist;
2. one value has a strict majority;
3. that majority value is divisible by `2`;
4. every outlier is within `1px` of it;
5. no annotation or variant evidence makes the difference intentional.

Example: `[16, 16, 16, 17]` preserves four `source-extracted` observations and yields
an accepted target candidate of `16px`. Record the candidate as `proposed` until the
applicable user/design-system policy is confirmed; once confirmed, retain its raw
evidence and approval in the target-contract row.

Do not auto-normalize a tie, an odd majority, a spread greater than `1px`, mixed
semantics, or any non-spacing property. Resolve an odd majority against the accepted
resolved `<design-root>/DESIGN.md` spacing scale or ask the owning decision; do not arbitrarily choose
the lower or upper even value.

## Contract Record

For every normalized cluster, record:

| Field | Requirement |
| --- | --- |
| cluster | semantic relationship, scope, axis, and property |
| raw source | all values and evidence IDs |
| rule result | qualifying majority/tolerance or reason normalization was rejected |
| target contract | accepted value or `proposed` candidate |
| authority | user decision or exact `<design-root>/DESIGN.md` anchor |
| verification | implementation/runtime assertion without relabeling it as source evidence |

Use page-local normalization in the Feature Spec. Change `<design-root>/DESIGN.md` only when
the accepted even-grid rule changes shared spacing semantics across surfaces.
