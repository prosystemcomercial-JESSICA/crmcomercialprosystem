# Product Specification Usage

## Triggers

- `Define the user behavior, states, business rules, and acceptance for this cross-stack feature before implementation.`
- `We are starting a new product line; create the minimum foundation specification.`
- `Update only docs/prd/PRODUCT.md with these confirmed product decisions.`
- `The team disagrees about permission and failure behavior; resolve the product decisions needed for the next implementation slice.`

## Public Modes

| Mode | Select when | Primary result |
| --- | --- | --- |
| Feature Spec | One feature needs product behavior and acceptance defined | One progressive feature document |
| Foundation Spec | A new product/product line or product-boundary reset is explicit | One foundation document |
| Artifact Update | A named existing fact source and confirmed changes are supplied | A bounded update to that artifact |

Clarification is an internal phase in every mode. Search repository evidence first.
Load the [product decision pressure test](decision-pressure-test.md) only when a
material product choice remains or the user explicitly requests a product stress
test. Stop per slice at its Ready gate. Do not advertise Discovery, grill, Brief, or
Standard as additional modes.

## Nearest Boundaries

| Request | Owner |
| --- | --- |
| Product behavior and acceptance are unresolved | `product-spec` |
| Technical tasks for already-decided behavior | Host planning |
| Multiple contexts, shared lifecycle, invariants, or domain language | `domain-modeling` |
| Selected-source UI contract, shared visual tokens, component semantics, or visual system | `ui-spec` |
| Durable repository/component reuse map | `repo-map` |
| Current implementation-interface ownership, topology, or consumers | `repo-map` |
| Approved source change | matching `dev-*` |
| Existing diff, commit, range, PR, release, or review package | `repo-review` |

## Minimal Output

Return one main spec with only applicable detail. A backend-only rule change does
not need invented UI sections; a UI-only display state does not need invented
data structures or implementation details. Add conditional artifacts only when their separate
ownership and long-lived value are explicit.

For several independent features, return a short index plus independently readable
slice specs. A consumer developing one slice reads shared index facts and that slice,
not every sibling. Link selected-source visual details to `ui-spec`; do not copy color,
type, component, token, or geometry decisions into product facts.
