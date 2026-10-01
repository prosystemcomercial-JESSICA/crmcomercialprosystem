---
name: dev-frontend
description: "Use when an authorized frontend change must be implemented or refactored; owns frontend source edits and risk-matched validation, not audit-only work, UI specification, browser/client operation, or Git delivery."
---

# Frontend Implementation

## Overview

Implement the requested frontend behavior in the repository's existing stack. Reuse
the nearest proven component, hook, service, style, and page structure by default;
extend before creating, and create only when current owners cannot satisfy the task.

Consume `urn:skills:frontend-change-request:v1` and produce
`urn:skills:source-change-result:v1`. Typed Task, authority, graph, or package inputs
are used when supplied; they do not replace current source and repository contracts.

## Workflow

1. Read effective repository guidance, identify the real frontend root, package
   manager, runtime, target route/component, and current Worktree state.
2. Read only the authorities and source needed for the target slice. Start with the
   user requirement and current implementation; use Product/UI specs and the resolved
   `<design-root>/DESIGN.md` only when they apply. A missing optional artifact or graph
   does not create a prerequisite ceremony. Treat declared Product behavior readiness
   and UI visual/interaction readiness as independent axes: when both lanes apply,
   require both matching slice verdicts to be ready before editing. One `Ready` verdict
   never upgrades the other; route a conflict or blocker to its semantic owner rather
   than choosing between authorities.
3. Complete a bounded search for the current owner, analogous consumer, and reusable
   component before choosing an implementation owner. If the supplied context already
   identifies the same maintained file, owner, and function for this feature, use that
   record directly and verify the target in current source; do not call `repo-map`.
   Only when a cross-owner reuse or impact edge remains unresolved may an existing
   compatible `repo-map` snapshot serve one bounded navigation query. Never scan,
   refresh, or render a map for task-local implementation. Collect only the contract facts
   changed by, depended on by, or decisive to acceptance for the target slice. Load
   [project grounding](references/project-grounding.md) only when the change crosses a
   real API/auth, environment/build, durable-data, desktop/native, compatibility,
   deployment, or cross-repository boundary. Keep unrelated risk classes out of scope.
4. Use the [reuse and page-ownership checklist](references/checklist.md) to freeze one
   task-local contract revision before editing: observable acceptance, non-goals,
   affected owners/contracts, reuse decision, and smallest credible validation seam.
   For API-backed behavior, resolve every decisive field from the governing contract
   and current call chain; unchanged non-decisive fields inherit their current verified
   owner. Stop rather than infer an unresolved decisive field. A correction creates a
   new revision: reject delayed work for the old revision and reconcile any landed old
   hunks before implementation resumes. Keep route/tab shells declarative; independent
   stateful sections belong in feature components rather than a large conditional page.
5. Make the smallest coherent source change. Preserve established framework, routing,
   state/data, component, styling, and test owners; do not introduce a parallel stack
   or speculative shared layer.
6. Batch a coherent development slice before validating it. Treat a running dev server,
   compiler, type checker, or repository diagnostic stream as the first feedback loop;
   do not run a check after every edit while that signal remains clean. At slice
   completion, before handoff, or after a real error, run one nearest focused check.
   Expand only for a changed shared contract, generated/build chain, runtime boundary,
   or affected consumer. Do not run a full build or full suite during implementation.
   For a confirmation, keep, or no-op request, select the focused check for the current
   accepted baseline; do not run a post-change check that only applies after an authorized
   change. If that focused check fails, do not report `completed`: report the failure or
   `Not verified`, preserve its evidence, then diagnose or stop.
   A full gate belongs to an explicitly authorized merge/release/deployment/final-basis
   workflow or an explicit user request, and its reason, command, and scope must be
   stated first. If no narrower credible check exists, use current dev diagnostics plus
   a targeted static or diff check and report tests `Not verified`; do not escalate.
7. Report changed owners, reuse decisions, validation, remaining Worktree content, and
   every applicable runtime or external gap as `Not verified`. Source implementation
   does not authorize browser/client operation or Git delivery.

## Small Change Fast Path

Use this path for one known owner and a local style, template, icon, copy, or similarly
bounded component change with no API, state/data, public/shared contract, generation,
build, deployment, or production-behavior change.

1. Perform one targeted lookup and one minimal patch. Batch adjacent edits before one
   completion checkpoint; never validate after each edit.
2. If an already running dev/compiler diagnostic remains clean, finish with a local
   diff inspection and `git diff --check`. A new test run is optional and should occur
   only for changed observable behavior, an existing focused regression, a real dev
   error, or an explicit request. Report tests `Not verified` when they were not run.
3. Never run bare aggregate test commands or a full build/suite. Do not add a red test
   for pure style/template/icon/copy changes.
4. Stop after the checkpoint. Do not add memory/history lookup, repeated source search,
   browser acceptance, delegation, independent review, or another identical check.

## Conditional Profiles

- **Selected visual source:** load [authorities](references/specification-authorities.md)
  and [visual evidence](references/frontend-visual-evidence.md) only when an accepted
  source and implementation-ready UI contract actually govern the task. Map applicable
  acceptance IDs before editing; use `ops-browser` or `ops-client` for required runtime
  evidence. Two-pass same-state comparison is a visual-completion gate, not a default
  requirement for ordinary frontend changes.
- **Layout or responsive behavior:** load
  [layout governance](references/frontend-layout-governance.md) when geometry,
  overflow, scrolling, layering, or breakpoints materially change.
- **Project-owned UI governance:** load
  [UI components and tokens](references/ui-components-and-tokens.md) only when the
  change adds or modifies a shared UI component, direct third-party UI dependency,
  structured token source/generated output, Component Registry, or adoption record.
  Use the project's native validator and stop on stale or conflicting ownership;
  ordinary feature composition does not activate this profile.
- **Protocol or generated client:** load [protocol contracts](references/protocol-contracts.md)
  only for an existing or explicitly introduced contract chain.
- **Behavior-first implementation:** load [behavior first](references/behavior-first.md)
  when a stable public seam can support one red-capable check per behavior.
- **Framework, styling, state, desktop, tooling, quality:** load only the matching
  [framework](references/framework-profiles.md), [styling](references/styling-systems.md),
  [stack](references/stack-guidelines.md), or [code-quality](references/code-quality.md)
  profile required by the current change.
- **Forgeway integration:** when an immutable Run and input PackageManifest are
  supplied, bind the changed result and observations to that basis. Do not require a
  Forgeway Run for normal repository development.

For a maintained non-LLM UI projection: Require a named owner, producer, non-LLM
consumer, semantic version, executable validator, drift policy, and retirement rule.
Run the repository-defined non-mutating validator before relying on it, then verify
referenced routes and components in current source. Otherwise ignore the projection
rather than creating or repairing one for ordinary implementation.

## Hard Rules

- Follow repository-pinned versions, lockfiles, scripts, directories, and dependency
  policy; do not normalize unrelated tooling.
- Existing components, adapters, stores, utilities, tokens, and interaction patterns
  are the default. A new owner needs a targeted search and a concrete behavior or
  ownership reason.
- An API filename, legacy prose example, frontend wrapper default, or screenshot is not
  sufficient authority for method/path, parameter placement, trigger timing, or
  success semantics. Resolve decisive contract fields before implementation and keep
  unavailable runtime proof `Not verified` rather than compensating with fallback code.
- Keep page/tab shells responsible for navigation and composition, not section-specific
  APIs, forms, tables, drawers, validation, and lifecycle branches.
- Prefer non-mutating validation. Compare Worktree state around tools that may generate
  or rewrite files and never absorb unexplained drift.
- A build, lint pass, source inspection, or browser preview proves only its own layer.
  Mark unexercised visual, responsive, accessibility, network, desktop, deployment, and
  production behavior `Not verified`.
- Stop on missing source-edit authorization, an unresolved governing contract, or a
  second failure of the same frozen runtime acceptance; preserve evidence and return to
  diagnosis instead of adding speculative patches.
- Do not stage, commit, push, deploy, or open a pull request from this Skill.

## Output

Return capability `frontend.source.implement` with scope, project/stack, authority and
reuse decisions, changed files/contracts, focused and expanded validation, Worktree
drift, exclusions, and `Not verified` gaps. Include visual mapping and runtime passes
only when the selected-source profile was active. Keep successful command output to a
result summary; include relevant log tails only for failures.

## References

- Core: [usage](references/usage.md), [checklist](references/checklist.md),
  [authorities](references/specification-authorities.md),
  [grounding](references/project-grounding.md), [evals](references/eval-cases.md).
- Conditional: [layout](references/frontend-layout-governance.md),
  [UI components and tokens](references/ui-components-and-tokens.md),
  [visual direction](references/visual-direction-and-anti-slop.md),
  [motion](references/interaction-motion-quality.md),
  [visual evidence](references/frontend-visual-evidence.md),
  [visual example](references/frontend-visual-gate-example.md),
  [protocols](references/protocol-contracts.md),
  [behavior first](references/behavior-first.md),
  [codebase design](references/codebase-design.md),
  [frameworks](references/framework-profiles.md), [styling](references/styling-systems.md),
  [stack](references/stack-guidelines.md), [quality](references/code-quality.md).
