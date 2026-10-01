# Project-Owned UI Components And Tokens

Load this reference only when the authorized change affects a shared UI component,
third-party UI adapter boundary, structured Design Token source or generated output,
Component Registry, or the project's adoption record. Do not require these assets in a
project that has not adopted them.

## Authority Chain

- The resolved `DESIGN.md` owns shared visual semantics and governance decisions.
- Feature UI specs own page composition, states, interaction, responsive behavior, and
  acceptance.
- Real component source and types own props, slots, events, DOM, accessibility, and
  runtime behavior.
- A structured token source owns serializable values and references only when the
  project declares its builder, generated consumers, validator, drift policy, and
  retirement rule.
- A Component Registry is a maintained projection, not the component API authority.

## Implementation Gate

1. Read the current adoption record, human component contract, token source paths, and
   live component/consumer source. If the record is missing, stale, or conflicts with
   source for this change, stop for the UI/Design System owner instead of creating a
   second component layer or token authority.
2. Reuse the declared public import. A wrapper is justified only when it owns stable
   semantics, token mapping, state policy, accessibility, behavior, reuse, or a real
   replacement boundary; a rename-only pass-through is not a component contract.
3. Keep direct restricted third-party imports inside declared adapter roots. A bounded
   exception records the exact consumer/import, owner, reason, review condition, and
   expiry or retirement decision; do not add a broad lint disable.
4. Preserve `Component -> Semantic -> Primitive`. Business code consumes Semantic
   tokens; Component tokens stay inside their declared component owner. Reject unknown
   or cyclic references, Component-to-Primitive bypass, authored CSS custom-property
   self-reference, and generated output drift through the project-native gate.
5. Update the human contract, Registry, generated outputs, lint boundary, tests, and
   adoption record only when their owned facts changed. Do not copy complete props or
   token values into Markdown.

## Validation

Run the narrow project commands named by the adoption record: Registry/boundary,
restricted-import, token graph/generation/usage, and the affected component tests.
Expand to type/lint/build only when the shared or generated boundary requires it.
Static gates do not prove keyboard, focus, responsive, theme, or visual equivalence;
route required runtime evidence to the browser/client owner or report `Not verified`.
