# Prototype Product Evidence

Load this reference when Axure is a named product fact source. `product-spec` does
not operate the prototype; request a bounded
`axure-product-evidence/v1` handoff from `ops-browser` and classify its observations.

## Intake Gate

Require source identity and revision, declared scope, page and requirement-source
ledgers, interaction/flow evidence, conflicts, access/capability gaps, and coverage
totals. A list of screenshots or visited page titles is not complete product evidence.
Keep live-browser observations, static-export metadata, and visual inference distinct.

Treat prototype wording or observed behavior as Confirmed only when it is traceable to
the fixed source and not contradicted by a stronger current product authority or user
decision. Record conflicts as Open Questions. Do not turn visible layout, colors,
spacing, component appearance, or geometry into product facts; link the applicable
`ui-spec` contract or request a separate visual handoff.

## Synthesis

Map the evidence into product ownership rather than page-by-page transcription:

- group pages that serve one connected user job and acceptance boundary into one
  Feature Spec;
- split independent user jobs into separate slices plus a short shared index;
- translate observed interactions into main/failure/recovery flows and user-visible
  state transitions;
- trace requirements, roles, permissions, validation, business rules, data effects,
  and acceptance to stable page/interaction evidence IDs;
- preserve unreachable branches, missing notes, ambiguous copy, contradictory
  versions, and unenumerated hotspots as Open Questions or `Not verified` gaps.

## Coverage Verdict

Report `Prototype coverage: Complete` only when the fixed declared source has every
in-scope page and requirement source accounted for, every required flow/state has
direct evidence, the discovered interaction queue is exhausted, and no required item
is blocked or `Not verified`. Otherwise report `Partial` or `Not Ready`, identify the
affected slices, and do not let one blocked slice invalidate unrelated ready slices.

Product readiness remains a separate decision: complete prototype coverage may still
leave a material product choice open, while partial prototype coverage may leave an
unaffected slice ready when its behavior and acceptance are independently proven.
