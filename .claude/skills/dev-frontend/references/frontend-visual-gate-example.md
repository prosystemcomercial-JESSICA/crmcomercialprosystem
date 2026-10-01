# Generic Frontend Visual Gate Example

This fully synthetic example demonstrates the evidence shape and verdict discipline
for a failed selected-source-to-runtime workflow. Names, paths, copy, identifiers,
dates, and measurements are fictional and do not identify a person, organization,
repository, product, or external design.

## Failure Cause

The first implementation reused an existing component and placeholder data, treated
visual similarity as sufficient, and marked the slice `Ready` before source targets,
asset roles, and runtime acceptance values were traceable. It also omitted an
immediate same-viewport comparison and computed-style review after implementation.

The corrective rule is general: exact source targets come from inspectable source
metadata. Screenshot observations remain `visually-inferred`, and browser-computed
values describe only the captured runtime. A runtime value must never be promoted to
a source target merely because it looks plausible.

## Synthetic Delta Table

| Acceptance | Selected-source target | Current runtime | Target contract | Priority | Evidence |
| --- | --- | --- | --- | --- | --- |
| `ACCEPTANCE-001` | synthetic inspected layout geometry | synthetic runtime uses different geometry | reproduce inspected geometry at the target viewport | P1 | source-extracted plus browser-computed |
| `ACCEPTANCE-002` | synthetic inspected element geometry | synthetic runtime differs | match inspected geometry; one detail remains `Not verified` | P1 | source-extracted plus browser-computed |
| `ACCEPTANCE-003` | distinct visual roles | one generic placeholder role | preserve inspected roles and geometry | P1 | source-extracted and visually-inferred |
| `ACCEPTANCE-004` | distinct approved assets | one placeholder for every role | approved asset; fallback only for one failed role | P1 | visual observation plus runtime asset inspection |
| `ACCEPTANCE-005` | readable local typography | unintended fallback font and insufficient contrast | inherit the local font and meet the accepted contrast threshold | P1 | visually-inferred, browser-computed, proposed |
| `ACCEPTANCE-006` | paired regions align | synthetic vertical mismatch | accepted offset tolerance | P1 | visual observation plus runtime rectangles |

The values are intentionally synthetic. Their purpose is to show that the source
target and current runtime occupy separate columns with separate evidence IDs.

## Implementation Mapping

| Acceptance | Generic owner | Decision | Verification |
| --- | --- | --- | --- |
| `ACCEPTANCE-001` | `components/neutral-layout.component` | extend | bounding rectangles plus overlay |
| `ACCEPTANCE-002` | `components/neutral-element.style` | extend | size, radius, font, asset fallback, hover, and focus |
| `ACCEPTANCE-003` | local secondary element | extend | rendered semantics, geometry, and keyboard action |
| `ACCEPTANCE-004` | local asset adapter | wrap | normal asset plus one intentionally failed role |
| `ACCEPTANCE-005` | local typography | extend | computed font chain and composited contrast |
| `ACCEPTANCE-006` | paired regions | extend | populated and empty heading offsets |

The mapping preserves an established local owner and avoids changing shared design
tokens for local geometry.

## Two-Pass Review

Pass 1 captures the selected source and runtime at the same viewport and state,
creates a side-by-side artifact, reads computed geometry, font, contrast, assets, and
alignment, and records P1 findings. Implementation changes only confirmed rows.

Pass 2 repeats the same capture and computed checks after fixes. It is not a source
code reread. The `fixture://` artifacts are synthetic protocol-test records and do not
prove any real interface was implemented or accepted.

## Final Verdict

The example verdict remains `Partial` because responsive behavior, long-text
truncation, complete keyboard order, and loading, empty, and error states remain
`Not verified`. Build or lint success cannot change that verdict.

## Machine-Checkable Fixture

Validate [the sanitized JSON fixture](../assets/frontend-visual-evidence.example.json)
against [the package schema](../assets/frontend-visual-evidence.schema.json) without
network or third-party modules:

```bash
python3 scripts/validate-frontend-visual-evidence.py \
  assets/frontend-visual-evidence.example.json
```

The artifact exercises `spec-ready`, `mapped`, `pass-1`, and `final` structure,
cross-evidence references, implementation mapping, pass-scoped runtime evidence,
coverage, and final reporting. It does not authenticate screenshots or claims.
