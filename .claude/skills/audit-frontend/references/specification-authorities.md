# Product and UI Specification Authorities

## Classify Authority by Meaning

- **Product facts:** user behavior, scope, business rules, permissions, failure
  semantics, compatibility, and product acceptance. Use the repository's declared
  requirement authority or established convention. `PRD` is an authority role, not
  a required root filename or a universal Markdown schema.
- **Shared visual semantics:** the resolved `<design-root>/DESIGN.md` when effective
  guidance, shared-system ownership, and actual consumers prove that boundary and it
  adopts the Google DESIGN.md contract. It owns shared tokens, component semantics,
  variants, and cross-surface visual rules. Official format lint alone is insufficient:
  consumers require the applicable UI Spec completeness result and exact-hash approval
  before treating it as adopted authority.
- **Slice UI contract:** the accepted selected-source contract for one page, flow, or
  domain. It owns layout, component/token mapping, interaction, responsive and
  accessibility rules, and UI acceptance.
- **Technical plan or ADR:** implementation approach and architecture decisions. It
  never becomes product or visual authority merely because it is Markdown.

Do not classify a document from `design`, `prd`, `requirements`, or `spec` in its
filename alone. Confirm its declared owner, path convention, content, links, and
approval state.

## Resolve and Read

1. Read effective repository guidance and any declared authority paths or exceptions.
   Project guidance such as `AGENTS.md` may declare adoption, actual locations, and
   exceptions; it does not redefine or duplicate the product/UI contract schema and
   owner workflow carried by the applicable Skill.
2. Read the repository's existing product foundation or shared index only when the
   target slice depends on it, then read the target product slice. Do not load sibling
   slices by default.
3. When UI contracts are relevant, resolve and read `<design-root>/DESIGN.md`, then
   the project-declared UI index when applicable and the target UI slice. Do not infer
   the design root from the Git root or treat generated metadata as shared authority.
   When the boundary claims adoption, verify the official spec commit/CLI lint and
   `ui-spec-design-completeness/1` result. A missing, `not-ready`, stale-hash,
   format-only, or local `awaiting-trusted-approval-verification` result is blocking
   and handed to `ui-spec`, not repaired from implementation source. Only a satisfied
   consumer completeness claim produced from a host-trusted approval receipt bound to
   the same exact Result Package clears adoption; the producer result remains
   `awaiting-trusted-approval-verification`.
4. Cross-check implementation and runtime evidence against those contracts without
   silently treating current code as approval for an unresolved product or visual
   decision.

Repository-declared locations win. Only an owner Skill creating an explicitly
authorized artifact may apply its fallback paths; consumer Skills do not create a
parallel `docs/prd/`, `docs/ui/`, root `PRD.md`, or visual authority.

## Consume or Hand Off

- Consume an existing usable contract directly. Do not invoke `product-spec` or
  `ui-spec` merely to recognize or read a file.
- Hand unresolved behavior, business rules, permissions, failure semantics, or
  product acceptance to `product-spec` only when those decisions are required for
  the requested outcome.
- Hand missing, conflicting, unapproved, or changed selected-source/shared visual
  contracts to `ui-spec` only when the requested outcome requires that UI decision.
- A missing optional artifact does not create mandatory ceremony for a known scoped
  implementation or audit. Report it as `Not found` or `Not applicable`; block only
  when the missing decision can change the requested behavior or acceptance.
- Preserve authorization boundaries: a handoff transfers context, not permission to
  write product facts, UI specifications, source, or Git state.

## Report

Name the authorities read, target slice, applicable revision or approval state,
conflicts, handoffs, and every `Not found` or `Not verified` contract gap.
