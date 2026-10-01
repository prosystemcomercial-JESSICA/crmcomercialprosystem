# Product Documentation Boundaries

## Location Order

`PRD` names the product-fact authority in this catalog. It does not require a
repository-root `PRD.md` and is not presented as a universal Markdown schema.

1. Use the repository's existing authoritative product fact source.
2. Use the repository's established feature/spec convention.
3. Only when neither exists and the user explicitly authorizes a new fallback,
   use `docs/prd/` directly:
   - `docs/prd/PRODUCT.md` for a foundation;
   - `docs/prd/<slice-id>/spec.md` for one feature slice;
   - `docs/prd/index.md` only for several independent feature slices.

Do not create an index for one slice or add a `docs/specs/` wrapper. Do not add a new
`docs/prd/` tree when an equivalent ADR, RFC, feature, requirements, or product
directory already owns the fact.

Use the same stable `<slice-id>` as the related `docs/ui/<slice-id>/spec.md` contract
when both exist. Cross-link the two artifacts and keep their authorities separate:
product behavior stays in PRD, while selected-source layout, components, interaction,
responsive/accessibility rules, and UI acceptance stay in UI.

For one product slice, a consumer reads only its authoritative foundation facts when
applicable and `docs/prd/<slice-id>/spec.md`. For several slices, add
`docs/prd/index.md`; a consumer reads that index and the target slice, not every
sibling specification.

## Conditional Artifacts

- Glossary: only when shared terminology needs a separate durable source; deep
  domain work belongs to `domain-modeling`.
- ADR: only for a long-lived technical or product decision when the repository
  uses ADRs and the decision owner authorizes it.
- UI evidence/prompt: only when the feature needs visual or state evidence; shared
  selected-source and visual-system specification ownership belongs to `ui-spec`.
- Handoff: only for unfinished cross-session continuation. Follow repository
  convention, such as `.codex/handoffs/product-<YYYYMMDD-HHmmss>.md` for local task/worktree state
  or a repository-approved docs location for explicitly requested team-shared
  continuation. Before writing a local handoff, verify that its directory is ignored;
  use an existing ignored workspace or request authorization to add the ignore rule
  instead of silently changing tracked policy. A handoff is not automatically loaded
  and is not a substitute for durable product facts.

## Terminal Documents And Evidence

Durable product documents describe the latest accepted product contract. Git stores
their formal history; do not keep edit dates, approval timestamps, superseded
decisions, migration narratives, or task validation logs in the current spec. A
business-effective date remains only when the date itself changes user eligibility,
behavior, rollout, or acceptance.

Use a verified ignored `.codex/` workspace for local reviews, captures, handoffs,
comparison reports, and environment snapshots. Publish a time-bound status document
only when a named team consumer needs it and the document declares its fixed basis,
revalidation owner, and refresh or expiry condition.

Do not add YAML, JSON, Schema, or another sidecar merely to make a spec easier for an
AI to parse. A durable structured artifact requires all of: named owner, producer,
non-LLM consumer, semantic version, executable validator, drift policy, and retirement rule. When
any item is absent, keep Markdown as the single authority.

## Authority

`product-spec` may update product documents only after explicit authorization. It
does not own source, Git, technical interface definitions, `ui-spec` artifacts,
domain models, or runtime evidence. Route current implementation mapping to
`repo-map`; link other authoritative artifacts rather than copying them.
