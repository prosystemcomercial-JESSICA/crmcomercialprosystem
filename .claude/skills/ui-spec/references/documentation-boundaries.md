# UI Documentation Boundaries

## Location Order

1. Determine from effective guidance, shared-system ownership, and actual consumers
   whether the boundary has adopted `DESIGN.md`. If adopted, resolve `<design-root>`
   and use `<design-root>/DESIGN.md` as that boundary's sole shared visual authority.
   If not adopted and the slice preserves shared semantics, record that disposition
   and use the accepted current surface plus repository-native visual owners without
   creating a new shared authority.
2. Use the project's established UI-spec location for one page domain or connected
   flow contract; only as a fallback use `docs/ui/<slice-id>/spec.md`.
3. Use the project-declared UI index for several independent slices; only as a
   fallback use `docs/ui/index.md` or `docs/ui/README.md`.

Do not infer `<design-root>` from the Git root alone, mechanically create one
`DESIGN.md` per application, or create a parallel shared design contract. Monorepo
inheritance exists only when current guidance and consumers prove it.

`DESIGN.md` is the human-readable and machine-readable semantic authority for shared visual decisions: YAML frontmatter owns normative token values, while Markdown owns their application guidance.

## PRD Relationship

Use the same stable `<slice-id>` as the related project product-spec location when
both artifacts exist; `docs/prd/<slice-id>/spec.md` is a fallback example, not a hard
path. Cross-link them instead of copying facts. PRD owns user behavior,
business rules, permissions, failure semantics, and product acceptance. UI owns the
selected source, layout, component/token mapping, states and interaction,
responsive/accessibility rules, and UI acceptance.

## Consumer Read Contract

To implement one UI slice, read in order:

1. effective repository guidance and its declared authority paths or exceptions;
2. applicable project-declared product foundation/index and target product slice;
3. `<design-root>/DESIGN.md` when adopted or when first adoption is explicitly in scope;
4. the project-declared UI index when the request has several UI slices;
5. the project-declared target UI slice.
6. the component guidance and project-map entries referenced by that slice, followed
   by live source owners when implementation work begins.

Do not require sibling PRD or UI contracts. Keep unfinished task-local work and
visual-evidence JSON under the repository's verified ignored task workspace, such as
`.codex/artifacts/ui-<slice-id>/`, until durable publication is explicitly approved.
Keep an unapproved candidate UI specification and its complete generation prompt
under the repository's verified ignored `.codex/reviews/` convention. They are one
candidate pair, not a second shared visual authority, and they never update
`DESIGN.md` before explicit promotion approval.

Durable UI indexes, Feature Specs, and `DESIGN.md` describe only the current accepted
contract. Git stores their history. Candidate directions, comparison passes,
implementation logs, captured timestamps, and superseded specs remain task evidence.
A durable evidence artifact additionally requires a named team consumer, accessible
source artifacts, schema and validator, drift policy, revalidation owner, and
retirement condition.

## Page And Component Binding

A page contract should answer which reusable or page-defining component roles compose
the surface and which page states and interactions apply. Human-readable component
guidance owns cross-page usage semantics; the project map points to high-value source
owners, and implementation revalidates symbols, registration, consumers, and current
states in live source. Keep props, slots, events, types, token values, and API schemas
in their source owners. Do not create a component registry solely to make the page
contract machine-readable.
