---
name: ui-spec
description: "Use when a source-grounded candidate visual direction needs a local review spec and complete generation prompt, or a selected visual source or accepted UI surface must become a traceable Feature Spec or adopted Google DESIGN.md contract; route external-AI sending to ask-ai, visual generation to the host design capability, unresolved product behavior to product-spec, and source edits to dev-frontend."
---

# UI Specification

## Overview

Ground a candidate direction in current source truth, or turn an approved source into
an implementation-ready UI contract for `dev-frontend`. It may serialize a candidate
into a complete generation prompt, but never operates external AI, generates images,
builds prototypes, or edits product source.

Consume `urn:skills:ui-request:v1`; the portable typed handoff is
`urn:skills:ui-contract:v1`, with
`urn:frontend-visual-evidence:v1` retained as a typed attachment when applicable.
Product behavior, shared `DESIGN.md`, and Feature UI Markdown keep separate native
authority; the handoff references them and never copies shared token semantics.

## Workflow

1. Read effective repository guidance and run `git status --short` before planning an authorized artifact write.
2. Before trusting a concept, inspect current product/source truth for real scope,
   data/actions/states, components, shared owners, and library mappings. Record
   conflicts and exclude every concept-only capability.
3. Choose one lifecycle stage:
   - **Candidate direction:** when the user has directed exploration but has not
     approved a visual result, load
     [references/candidate-visual-direction.md](references/candidate-visual-direction.md).
     Keep its spec and complete synchronized prompt under verified ignored
     `.codex/reviews/`; leave formal docs unchanged and remain `Not Ready`.
   - **Accepted contract:** fix the selected visual source: a user-selected Product
     Design result, supplied screenshot/mockup/frame, accepted current surface, or
     accepted shared visual baseline. Record identity, revision/image ID, approval,
     rights status, `use` and `ignore` boundaries, target viewport/state, and source
     limitations. When a current runtime exists, load
     [references/frontend-visual-evidence.md](references/frontend-visual-evidence.md)
     and request same-round, same-viewport/state source and runtime captures from
     `ops-browser` without operating the browser here. If neither a source-grounded
     candidate brief nor a selected/accepted source exists, stop as
     `evidence-incomplete` instead of fabricating one.
4. For an accepted contract, resolve `DESIGN.md` adoption from effective guidance,
   build ownership, and shared consumers. An adopted boundary uses its approved
   `<design-root>/DESIGN.md` as the sole shared visual-semantic authority; monorepo
   nesting implies neither inheritance nor one file per app. A local slice that
   preserves shared semantics may instead record
   `DESIGN.md: Not adopted (not required for this slice)`. Require first adoption only
   when requested or when shared semantics change. Then load
   [references/design-md-contract.md](references/design-md-contract.md), use
   [assets/DESIGN.md](assets/DESIGN.md) as the verified-source starter, and follow its
   completeness and trusted-approval gates. Format lint alone is insufficient;
   changed content makes approval stale and the slice `Not Ready`.
5. Define implementation slices: one Feature Spec per confirmed page/flow/domain; for multiple independent domains, create one shared index plus one independently loadable contract per slice and load [references/multi-surface.md](references/multi-surface.md).
6. Select one profile:
   - **Feature Spec (default):** reuse current shared systems unless shared semantics truly change.
   - **Design System Spec (conditional):** only when shared tokens, reusable component meaning/variants, state vocabulary, or cross-surface visual rules must change.
7. In Design System Spec, keep `<design-root>/DESIGN.md` as the only durable shared visual output; Feature Specs reference it instead of copying shared semantics.
8. Translate the selected source into concrete layout, state, interaction, and accessibility specifications for each slice. Name reusable and page-defining components only after checking current source and the project map when one exists; keep props, slots, events, types, SVG path data, source paths, and copied token values out of the page contract. Use the exact evidence levels `source-extracted`, `browser-computed`, `visually-inferred`, `proposed`, and `Not verified`. Load the visual-direction, layout-governance, measurement-normalization, and viewport workflow references only when their named conditions apply. When standardizing a scene layout archetype, load [references/scene-archetypes.md](references/scene-archetypes.md). When icons must be SVG or shared iconography changes, load [references/svg-icon-system.md](references/svg-icon-system.md), resolve the actual icon owner/library and rights, and specify semantic role, family, rendering, state, accessibility, and fallback without generating SVG source.
9. Add a traceable delta table for every material visual difference: acceptance ID, selected-source target, current runtime, target contract, priority, shared-or-local owner, evidence IDs, verification, and applicable asset owner/fallback.
10. For every slice and multi-slice task, add one `Ready for dev-frontend <slice>`, `Partial`, or `Not Ready` verdict. Do not issue `Ready` when the selected source is unavailable or unapproved, rights/use are insufficient, target viewport/state is uncertain, a P1 asset has no accepted owner/fallback, or an exact proposed value lacks owner approval.
    This verdict is the UI visual/interaction readiness axis only. It neither proves
    nor upgrades Product readiness. When Product behavior applies, `dev-frontend`
    may start the slice only after the matching Product and UI axes are both ready;
    a conflict stays with its semantic owner and no model may select a winner.
11. For a shared `DESIGN.md` change, follow [references/design-md-contract.md](references/design-md-contract.md) for lint, diff, duplicate-heading, and explicit derived-export gates. Missing required evidence remains `Not verified` and keeps the affected slice `Not Ready`.
12. Keep the page UI contract and component guidance human-readable and authoritative
    for their own meanings. Markdown is the default durable UI artifact. A YAML/JSON
    projection is conditional: use it only when a named owner, producer, non-LLM
    consumer, semantic version, executable validator, drift policy, and retirement
    rule already exist. Never copy
    tokens, API/DTO schemas, props, slots, events, or source paths into a projection;
    otherwise omit it and let current source plus Markdown remain authoritative.
13. Hand the spec, delta rows, evidence limits, and a validated
    `frontend-visual-evidence/v1` `spec-ready` artifact to `dev-frontend`. Store that
    task evidence under a verified ignored `.codex/artifacts/` location by default;
    publish it with durable docs only when a named team consumer, accessible
    artifacts, schema/validator, drift policy, and revalidation owner justify it.
    Do not add implementation mapping, visual reviews, runtime coverage, final
    verdict, or claim runtime behavior in this Skill.
14. When a compatible Repository Asset Graph is available, resolve shared-design,
    feature-UI, route, component, and consumer refs and reject duplicate active
    authority claims. Never invent graph IDs or turn the graph into visual authority.
15. When Forgeway integration is active, bind the immutable Run input and
    PackageManifest/basis, fingerprint authorized outputs, and attach typed UI-contract
    and visual-evidence Observations to that exact result package. For adopted DESIGN
    authority, follow [references/design-md-contract.md](references/design-md-contract.md)
    for package-relative artifacts, hashes, byte lengths, compatible consumer, and
    claim. `Ready` or a satisfied gate is not review, delivery, deployment, or
    production proof.

## Profiles

- **Feature Spec (default):** one selected page or flow contract; a multi-surface
  request may use a shared index plus independently loadable Feature Spec contracts,
  each with its own layout, mapping, states, interaction, responsive/accessibility
  rules, assets, acceptance, and readiness verdict.
- **Design System Spec (conditional):** accepted shared tokens, semantic components, variants, state vocabulary, or visual rules; may create, extract, maintain, or evaluate the repository-owned contract.

## Do Not Use For

- Generating images, inventing redesign alternatives, UX research/critique, or shareable prototypes; use the host's Product Design or image capability. Preparing a source-grounded candidate specification and complete prompt remains in scope.
- Sending prompts, assets, or follow-up instructions to a named external model; use `ask-ai` with the frozen local artifacts.
- Unresolved product behavior, permissions, failure semantics, or acceptance; use `product-spec`.
- Frontend source changes or refactors; use `dev-frontend` with the accepted specification.
- Read-only frontend implementation audits; use `audit-frontend`.
- Browser screenshots, console/network evidence, or desktop-window operation; use `ops-browser` or `ops-client`.
- Git staging, commits, pushes, or branch cleanup; use `repo-delivery` after review.

## Hard Rules

- Require a selected visual source or accepted existing UI/design-system baseline before authoring a visual implementation contract.
- Treat the local candidate UI specification as the only candidate-direction source.
  Update it first, then rewrite the complete generation prompt from that revision.
  Never treat external-chat-only corrections as part of the candidate contract.
- Verify both candidate paths, ignore status, and hashes after edits and before
  handoff; any change makes the prior handoff stale.
- Do not generate or edit images, build prototype code, or edit product source.
- Do not generate or edit SVG source. Define its visual, ownership, safety,
  accessibility, and acceptance contract, then route implementation to `dev-frontend`.
- Do not invent metrics, features, routes, permissions, states, backend behavior, or runtime evidence.
- Do not treat pixels as proof of exact tokens, component ownership, behavior, accessibility, or implementation feasibility.
- Do not activate Design System Spec merely because a feature reuses existing tokens or components.
- Do not create a parallel component library or token system when the project already has an owner.
- Do not make page specs redefine reusable component interfaces. Record page composition and page-local state/interaction; route current component ownership through a validated project map when one exists, then recheck live source before implementation.
- Do not require a `ui-page/v1` or `ui-components/v1` Schema, project-local validator,
  or YAML/JSON companion for ordinary UI work. Admit a projection only when its named
  non-LLM consumer and complete lifecycle are already real and maintained.
- Treat `<design-root>/DESIGN.md` as the single human-readable visual-semantic authority for a proven boundary that has adopted it; do not force first adoption for a local slice that preserves shared semantics.
- Keep durable `DESIGN.md`, UI indexes, and Feature Specs current-only. Git retains
  formal history; task captures, comparison passes, superseded candidates, and
  validation timestamps belong in `.codex/` unless durable-evidence gates are met.
- Require named non-implementer human approval bound to the exact content hash before
  treating a newly created or changed `DESIGN.md` as accepted; never let the executor
  self-approve extracted current CSS as the target design.
- Require applicable loading, empty, error, populated, permission, focus, responsive, overflow, localization, and reduced-motion rules; justify exclusions.
- Give every applicable slice its own viewport matrix and readiness verdict; keep independent incomplete slices visible as `Partial` without turning one surface's viewport requirements into a catalog default.
- Do not stage, commit, push, publish, or approve a shared baseline.
- Keep default and interaction states distinct. Overlays are closed and absent from
  default acceptance unless explicitly defined as default; specify open state,
  trigger, focus, close, and layout separately.

## Output Contract

Report capability `ui.contract.specify@1.1.0`, typed result/attachment refs, Run and
input/result PackageManifest refs when integration is active, the lifecycle stage and selected profile,
source identity/approval and rights/use boundary, target viewport/state and slices,
evidence levels, layout/state contract, delta table, component/token mappings,
responsive/accessibility rules, assets/copy, shared-system changes or `None`,
evaluation gates, per-slice and overall readiness, and every `Not found` or `Not
verified` gap. Include at least:

- shared visual-authority disposition: adopted, first-adoption requested, or not adopted/not required for this slice
- resolved `<design-root>` and `DESIGN.md` revision or stable identity when adopted
- lint command and result when `DESIGN.md` is created or changed; otherwise `Not applicable`
- diff command and regression verdict, or `Not applicable` when a Feature Spec leaves `DESIGN.md` unchanged, the authority is created for the first time, or the boundary has not adopted it
- per-slice spec IDs and readiness
- for candidate direction: both paths/hashes, ignore status, generation owner,
  handoff status, and `DESIGN.md unchanged`
- raw selected-source measurement evidence and the normalization record for every
  applicable repeated spacing cluster
- per-slice viewport acceptance matrix or a justified `Not applicable` verdict,
  including required/optional/excluded entries, size, environment, state, and
  acceptance-evidence source; hand the same matrix to `dev-frontend`,
  `audit-frontend`, and `ops-browser`/`ops-client` without redefining its schema
- when SVG icons apply: shared-or-local disposition, semantic role-to-owner mapping,
  approved family/render/state and coloring rules, rights, accessibility, accepted
  isolated fallback or evidenced `None`, and focused gallery/runtime acceptance

## References

- Core: [usage](references/usage.md), [workflow](references/workflow.md),
  [candidate direction](references/candidate-visual-direction.md),
  [DESIGN.md](references/design-md-contract.md), [visual source](references/visual-source.md).
- Visual detail: [direction](references/visual-direction-and-anti-slop.md),
  [layout](references/frontend-layout-governance.md),
  [SVG icons](references/svg-icon-system.md),
  [measurement](references/measurement-normalization.md),
  [evidence](references/frontend-visual-evidence.md).
- Scope/output: [multi-surface](references/multi-surface.md),
  [documentation](references/documentation-boundaries.md),
  [rubric](references/evaluation-rubric.md), [evals](references/eval-cases.md).
