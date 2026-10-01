---
name: audit-frontend
description: "Use when a known frontend surface needs a scoped, read-only audit of selected architecture, reuse, data/UI contract, build/tooling, accessibility, performance, selected-source visual fidelity, or desktop-boundary profiles; use repo-review when a Worktree or immutable change basis needs coordination."
---

# Frontend Audit

## Overview

Audit frontend engineering from repository evidence rather than a universal framework or folder template. Detect the real framework and local API style, then select only the profiles required by the request. This skill is read-only: use it directly for frontend domain audits or as a bounded specialist under `repo-review`; use `dev-frontend` for requested changes.

Consume `urn:skills:audit-request:v1`; the portable output is
`urn:skills:audit-findings:v1`. When supplied, consume an
exact PackageManifest/basis plus compatible graph asset/consumer/impact results. The
audit produces findings and validation Observations, not Task/Requirement status or a
delivery Receipt.

## Rule Priority

Resolve conflicts in this order:

1. The user's current explicit request.
2. Effective repository guidance, including `AGENTS.md`, `CLAUDE.md`, and host-provided instructions when present.
3. Declared and applicable product/UI contracts: product requirements or product
   Feature Specs define behavior and acceptance; selected-source UI Feature Specs
   and resolved `<design-root>/DESIGN.md` define applicable UI and shared visual semantics.
4. Live code, config, components, and the repository-declared visual system define
   current implementation facts. They do not override an applicable contract; report
   a conflict as implementation drift.
5. This skill.
6. External reference repositories.

Never rewrite a working local structure merely to match this skill or an external repository.
When a proven visual boundary has not adopted `DESIGN.md`, follow its declared visual-system
owner; do not invent one.

## Workflow

1. Read repository guidance, record the inspected revision plus relevant Worktree
   state for reproducibility, run `git status --short`, and identify the target
   app, project class, framework, package manager, scripts, documented
   architecture, and coordinating review owner when delegated. This inspection
   snapshot does not turn the audit into change attribution.
2. Consume a compatible graph asset/consumer/impact query or perform a targeted live inventory of route/page entry, owning feature, analogous screens, UI primitives, layout/tokens, data/cache, forms/schema, state/store, tests, docs, and desktop adapter. Reject stale or mismatched graph results; a query miss never proves absence, and a derived Markdown view is not review evidence. Load `references/specification-authorities.md` when a selected profile depends on Product/UI contracts; resolve them by meaning rather than filename, consume Product Markdown, UI Markdown, and resolved `DESIGN.md` before comparing current source, and hand off only unresolved decisions required by the audit outcome. If a structured non-LLM projection is in scope, verify its named owner, producer, non-LLM consumer, semantic version, executable validator, drift policy, and retirement rule. Inspect current validator evidence, consumer read path, and Markdown/source parity without regenerating or repairing the projection. Missing lifecycle evidence, duplicate authority facts, stale routes/components, or source drift become findings only when concrete impact is established; otherwise report `Not verified`. When no real projection exists, do not require project YAML/JSON, schema, or validator files.
   When the user supplies a new or replacement external contract, freeze that artifact
   and the stated replacement relation as part of the inspection basis before reading
   the older local copy. Audit against the selected incoming authority and report local
   drift; because this Skill is read-only, never land or overwrite the document. Stop
   on ambiguous owner or competing versions instead of reviewing a knowingly
   superseded basis.
3. Classify the product surface as Web, high-density Console, or Tauri Desktop. Select exactly one framework profile per audited boundary: **React**, **Vue Composition**, **Vue Options**, or **Repository-native Other**. Select only styling profiles present in scope: **Tailwind**, **CSS Modules**, **Sass/Less**, **CSS-in-JS**, **Ant Design**, **shadcn/ui**, or a documented local system.
4. Select one or more audit profiles; explicitly mark the rest `Out of scope`:
   - **Architecture/reuse:** routes, features, shared layers, dependency direction, reuse, abstractions, structural lifecycle, and docs.
   - **State/data/contracts:** server/cache, URL, form, shared business, local UI, reactivity, stores, schemas, requests, errors, cancellation, and native IPC contracts.
   - **Component/layout/design system:** primitives, variants, tokens, density, DOM/CSS, spacing/scroll ownership, responsive behavior, and duplicated systems.
   - **Selected-source visual fidelity:** source identity/evidence, traceable targets versus current runtime, assets, typography, final contrast, geometry, section alignment, states, breakpoints, and comparison evidence.
   - **Accessibility:** semantics, keyboard, focus, labels, dialogs/popovers, errors, status communication, and async feedback.
   - **Performance:** render/reactivity/data paths, request duplication, fan-out, bundle/runtime/IPC cost, long tasks, and measurement quality.
   - **Build/tooling:** package/runtime pins, scripts, Vite/Rolldown, Webpack,
     Rspack, Next/Turbopack, plugins, resolution, environment, proxy, base,
     output, SSR/library, and deployment contracts.
   - **Desktop boundary:** frontend adapter, Tauri/native commands, DTO/errors, progress, cancellation, window/menu/shortcut behavior, and real-client evidence.
   When a selected profile reaches API/gateway/auth, environment/build/deploy,
   durable state, replacement compatibility, desktop/native integration, or another
   repository, load [project grounding](references/project-grounding.md) and bound
   the audit through its signal-to-evidence chain. Do not activate it from frontend
   directories, framework presence, or literals alone.
5. Map each selected responsibility to its page, feature, primitive, hook/composable, service, store, schema, local type, or desktop adapter owner.
6. Compare the target with direct reuse candidates, the nearest analogous feature, documented contracts, and the existing component/layout system. When Architecture/Reuse or Component/Layout examines component APIs, variants, or composition, load `references/component-system.md`. For a selected Component/Layout profile, load `references/frontend-layout-governance.md`, name the relevant geometry/scroll/layer owners, trace nested effective padding by axis, and cover only the applicable task-completion seam. When the audit explicitly covers visual direction, an existing-surface redesign, theme/accent consistency, density, or anti-slop drift, load [references/visual-direction-and-anti-slop.md](references/visual-direction-and-anti-slop.md); require an accepted direction, analogue, measurement, or user impact rather than treating taste as a finding. When a resolved `<design-root>/DESIGN.md` contract is relevant, also load `references/design-md-compliance.md` for the bounded contract-to-runtime chain. For Selected-source visual fidelity, load [references/frontend-visual-evidence.md](references/frontend-visual-evidence.md), keep source targets distinct from browser-computed runtime, and require reviewable source/runtime comparison plus computed evidence for exact runtime claims.
   When adoption/completeness is in scope, verify official-format evidence separately
   from the `ui-spec-design-completeness/1` result and exact design-hash approval. A
   local `awaiting-trusted-approval-verification` result without a satisfied consumer
   claim is blocking; only a host-trusted approval receipt bound to the same Result
   Package clears it, without rewriting the producer result.
   Do not use lint zero, current theme/CSS, or PackageManifest integrity to clear a
   missing, untrusted, or `not-ready` shared authority.
7. Trace only selected profiles without changing the repository. Do not perform shallow checks for excluded profiles merely to imply coverage. When code-quality concerns materially apply, load the shared code-quality reference with audit semantics and the selected framework/build reachability rules.
8. Audit applicable loading, empty, error, partial, retry, optimistic, stale, cancellation, keyboard, focus, and long-task behavior within the selected profiles.
9. Use non-mutating repository checks and request browser or real-client evidence only when a selected claim cannot be proven statically.
10. Report severity-ranked findings with exact location, framework-specific evidence, impact, remediation direction, validation gap, selected profiles, and excluded profiles.
11. When Forgeway delivery integration is active, bind the audit to an immutable Run,
    exact input/result PackageManifest, and typed input refs. Attach each finding or
    validation result as an Observation against that exact package. Do not hand-edit a
    Gate, rewrite prior Observations after a retry, or infer reviewed/delivered state.

## Modes

- **Focused profile audit:** one or two selected frontend profiles with bounded evidence.
- **Combined frontend audit:** interacting profiles such as state/data plus performance or layout plus accessibility, with explicit integration risk.
- **Baseline architecture audit:** architecture/reuse plus structural lifecycle and docs against real repository conventions.
- **Scoped specialist subreview:** inspect only the frontend paths or diff delegated by `repo-review`; return domain findings without taking review coordination or Git ownership.

## Hard Rules

- Select profiles before applying detailed checklists. Do not imply architecture, state, layout, accessibility, performance, and desktop were all reviewed when only some were evidenced.
- Load and apply only the selected framework, styling, architecture, state/data,
  build/tooling, accessibility/performance, desktop, or conditional
  code-quality reference. Do not cross-apply an unselected profile or imply its
  coverage.
- Require reachable source evidence for ownership and reuse, and direct runtime or
  measurement evidence when the selected claim cannot be established statically.
- Separate source/config evidence from production and rendered-runtime proof; report
  unsupported claims as `Not verified`, not generic defects. For layout or visual
  findings, require a contract, competing ownership, measurement, or concrete impact
  through the selected visual references rather than taste or pixel inference.
- Apply reuse, dead-code, abstraction, and framework recommendations only through
  reachable evidence in the selected references; file shape or text search alone is
  not a finding.
- Do not edit, stage, commit, post review comments, or deliver code in audit mode. `repo-review` owns Worktree and immutable review coordination; `repo-delivery` alone owns Git mutation. Route accepted remediation to `dev-frontend`.
- Do not treat build/lint success or one screenshot as selected-source visual
  acceptance; lead with P0-P3 findings and mark missing runtime coverage `Not verified`.
- When a selected frontend profile exposes a security-relevant condition, return
  the browser/build/IPC evidence, authoritative control boundary,
  counterevidence, and proof gap without claiming exploit validation or fix
  completion. Route an explicit vulnerability scan, attack-path, or PoC-validation
  request to an available host security workflow.

## Do Not Use For

- Repository orientation, commands, reuse inventory, or docs/code alignment without an audit request; use `repo-map`.
- Frontend implementation, modification, or refactoring; use `dev-frontend`.
- Creating a resolved `<design-root>/DESIGN.md` or selected-source Feature Specs; use `ui-spec`.
- Root-cause diagnosis of a concrete failure; use the host's built-in diagnosis under effective instructions.
- Owning Worktree readiness or immutable repository/range/PR/release coordination; use `repo-review`, which may delegate a bounded frontend surface here.
- Actual staging, commit, rebase/squash, push, or delivery; use `repo-delivery`.
- Browser or real desktop runtime operation; use `ops-browser` or `ops-client`.
- A backend-only implementation or audit; use the matching backend implementation or
  audit owner.
- A general repository/path vulnerability scan or explicit exploit validation;
  use an available host security workflow. Keep bounded frontend env, browser
  storage, redirect/DOM, permission-UX, and desktop-adapter evidence here.

## Output Contract

Start with capability `frontend.surface.audit`, typed audit-findings/Observation refs,
Run and PackageManifest refs when integration is active, the inspection snapshot,
selected product, framework, styling, and audit profiles; explicitly excluded audit
profiles; coordinating owner when delegated; and severity-ranked findings. For
Selected-source visual fidelity, state the source/revision/approval, evidence levels,
target viewport/state, comparison passes available, and whether the
`frontend-visual-evidence/v1` artifact validates. For each finding, report impact,
exact location, profile-specific evidence, recommended remediation owner/direction,
and validation gap. Then summarize inspected rules/files, existing candidates,
ownership map, selected state/data/layout/accessibility/performance/build/desktop
evidence, component/injection/router/lifetime contracts, Google `DESIGN.md` token/prose
consistency, official lint evidence, implementation drift from source,
commands/runtime evidence, and all `Not found` or `Not verified` residual risks.

## References

- Ownership and authority: [architecture](references/architecture-and-ownership.md),
  [specs](references/specification-authorities.md), [layout](references/frontend-layout-governance.md),
  [visual direction](references/visual-direction-and-anti-slop.md),
  [DESIGN.md](references/design-md-compliance.md), [visual evidence](references/frontend-visual-evidence.md).
- Stack profiles: [framework](references/framework-profiles.md),
  [components](references/component-system.md), [state/data/forms](references/state-data-and-forms.md),
  [layout/style](references/styling-and-layout.md), [styling systems](references/styling-systems.md),
  [Tauri](references/desktop-tauri.md), [accessibility/performance](references/accessibility-and-performance.md),
  [build](references/build-tooling.md).
- Review depth: [code quality](references/code-quality.md),
  [codebase design](references/codebase-design.md), [grounding](references/project-grounding.md),
  [checklist](references/review-checklist.md), [anti-patterns](references/anti-patterns.md),
  [sources](references/reference-corpus.md), [usage](references/usage.md),
  [evals](references/eval-cases.md).
