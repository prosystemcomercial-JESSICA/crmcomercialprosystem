# Frontend Implementation Checklist

Use this checklist when implementing or reviewing frontend changes.

## Contents

- [Required Context](#required-context)
- [Contract Freeze Gate](#contract-freeze-gate)
- [Reuse-First Gate](#reuse-first-gate)
- [Stack And Structure](#stack-and-structure)
- [Page And Feature Ownership](#page-and-feature-ownership)
- [Framework Profile](#framework-profile)
- [DOM And Layout Ownership](#dom-and-layout-ownership)
- [Styling](#styling)
- [Behavior And Contracts](#behavior-and-contracts)
- [Validation](#validation)
- [Review](#review)

## Required Context

- Read relevant repo guidance first.
- Run `git status --short` before edits.
- Identify actual package manager, scripts, frontend app boundary, target screen, route, component, framework, UI type, visual source, style system, and runtime proof requirement.
- Identify the frontend project class, pinned runtime/package manager, lockfile, dependency policy, script contract, directory/naming standard, and documented exceptions.
- Inspect only target page, component, route, service, hook or composable, store, type, style, shared UI, and layout owner files needed for the request.
- When the current record already matches the exact file, owner, and function, verify
  that target directly and do not invoke `repo-map`. For a cross-owner reuse/impact
  question, consume at most one bounded query from an existing compatible snapshot.
  If none exists, use bounded current-source discovery rather than scanning/rendering.
- Check existing imports and nearby patterns before adding libraries, aliases, icons, helpers, or components.
- For selected-source work, read the current product/UI slice, resolved `<design-root>/DESIGN.md`,
  selected-source evidence, delta rows, and readiness. Stop on unavailable source,
  `Partial`/`Not Ready`, unresolved target viewport/state, or missing P1 asset owner.
- Map every applicable acceptance ID to owner file/component,
  reuse/extend/wrap/new, asset/data owner, and static/runtime verification before
  editing. Do not copy browser-computed current values into the source target.

## Contract Freeze Gate

- Before the final freeze, run a bounded search of the target owner, analogous
  consumers, reusable component/service/store owners, and nearest focused check. Then
  record the smallest executable contract for the target slice: a task-local revision,
  observable acceptance, explicit non-goals, governing authority, affected
  owner/consumer, reuse decision, and the focused check that can fail before the change.
- Freeze the navigation path after verifying the owner and decisive chain. Do not repeat
  map queries or broad source discovery after freeze unless current source contradicts
  the basis or a real check failure exposes an ownership error.
- For API-backed behavior, resolve from the native contract and current call chain only
  the fields changed by, depended on by, or decisive to acceptance: applicable method
  and path, request placement and omission/default rules, trigger/cache timing, success
  and business-error semantics, permission/data scope, representative caller, and the
  owner of required runtime proof. Unchanged non-decisive fields inherit the current
  verified owner; a local UI-state fix does not require an unrelated backend survey.
- Treat documents, backend handlers/DTOs, generated clients, current adapters, and
  screenshots as different evidence layers. Use the repository-declared authority;
  when they conflict, stop the affected implementation and name the field and owner
  that must resolve it.
- Do not preserve a guessed or obsolete contract through a safety fallback. A fallback
  is allowed only when an existing reachable consumer, durable compatibility rule, or
  explicit product contract requires it and its activation is testable.
- A user correction that changes scope, acceptance, or an interface field creates a new
  task-local freeze revision. Reject in-flight or delayed delegated results that target
  the old revision. Inventory and reconcile any old-revision hunks already landed in
  the Worktree before new implementation starts; do not turn the revision into a
  repository schema, durable authority, or migration mechanism.

## Reuse-First Gate

- Start from a current `repo-map` directory/file inventory, or reproduce the same targeted search when it is unavailable or stale.
- Search relevant routes, pages, layouts, components, hooks/composables, services, stores, shared UI, tests, exports, and symbols before creating anything.
- Classify candidates as:
  - direct reuse: behavior and ownership already match
  - reference-only: adapt the nearest structure, naming, props, state, styling, and tests
  - unrelated: similar name but different ownership or behavior
  - `Not found`: no relevant implementation exists
- Prefer direct reuse, then adaptation. Create new only when both are insufficient, and record the ownership/behavior reason.
- Place new files in the existing directory and naming convention; do not create parallel `components`, `shared`, `common`, `ui`, `hooks`, or service layers.
- After implementation, search again for accidental duplicates, obsolete predecessors, competing exports, and stale references.

## Stack And Structure

- Confirm whether the project uses React, Vue, Next.js, Vite, TanStack Router, TypeScript, Tailwind, Ant Design, shadcn/ui, CSS modules, Less/Sass, desktop webviews, project-local components, or a deliberate mix.
- Keep page files consistent with existing thickness. Move logic only when the local pattern already uses hooks, services, helpers, or feature components.
- Put new files in the established layer. Use framework-native and repository-defined names such as React Router `routes`, Next.js `app`, Astro `pages`, or project-specific equivalents; do not mix `pages`, `views`, and `routes` casually.
- When repository standards define canonical names, use their plural directories and file-case rules for new work. Do not mass-rename existing paths during an unrelated feature.
- Reuse existing request helpers, response unwrap helpers, route builders, permission checks, form wrappers, table wrappers, modal/drawer patterns, icons, and interaction helpers.
- Extract a shared component or package only after identifying real consumers, named ownership, stable props/API, shared tests, and consumer validation.
- Preserve path aliases and import ordering conventions.
- Keep local UI state local unless the app already uses a global store or route/query layer for the same responsibility.

## Page And Feature Ownership

- Treat the route/page file as a shell when it coordinates multiple independently
  stateful business tabs or sections. The shell may own route context, page-level
  navigation, component selection, and genuinely shared data or locks.
- Give a tab or section its own feature component when it owns an independent API
  flow, form, table, drawer/dialog, validation rules, action lifecycle, or loading and
  error state. Do not implement those sections as large conditional branches in the
  page shell.
- Keep shared orchestration at the nearest common parent and pass the smallest stable
  props/events or repository-native context. Do not duplicate shared loading, user
  selection, permission, or lookup owners inside every section.
- Split by business ownership and change reason, not by arbitrary line count, one
  component per file dogma, or visual fragments with no independent behavior.
- Before extracting a cross-feature shared component, prove real consumers and a
  stable common contract. Otherwise keep the component inside its feature directory.
- When a credible test seam exists, add a focused invariant that the shell composes
  the intended feature components and does not own their API/form/table/drawer logic.
  Prefer import/consumer or public-behavior evidence over full-markup snapshots.

## Framework Profile

- Select React, Vue Composition, Vue Options, or Repository-native Other from manifests, file extensions, imports, and nearby code.
- Apply only the selected rules in `framework-profiles.md`; do not cross-apply lifecycle, state, routing, or component semantics.
- Preserve async component, error-boundary, suspense/loading, and cache/keep-alive contracts already used by the target feature. Mark runtime behavior `Not verified` when it is not exercised.

## DOM And Layout Ownership

- Identify the owners before editing nested layouts:
  - app/window shell: global chrome, toolbar, app background, global clipping, modal host
  - content container: shared page inset and broad viewport bounds
  - page root: page-level grid/flex layout and transition root
  - panels/regions: local bounds and spacing
  - inner content: the one intended scroll or overflow owner
- Choose the shortest valid DOM path before adding a wrapper. Each element must own semantics, layout, state, accessibility, animation, or reuse.
- Remove wrappers that only forward classes, group a single child, repeat page-stage or layout boundaries, or duplicate a local component boundary.
- Merge animation-only wrappers into semantic roots when possible; prefer an animated `main`, `section`, or existing component root over a separate animation wrapper plus an identical inner container.
- Prefer Flexbox for one-dimensional row or column composition. Use the owning parent for `justify-*` and `items-*` alignment; do not add a child wrapper only to center content.
- Use Grid only when rows and columns form a real two-dimensional relationship.
- Keep children adaptive with the project's grow, shrink, basis, wrapping, `min-w-0`, and `min-h-0` conventions. Avoid fixed widths/heights when the available space should determine size.
- Assign page-edge margin, padding, and inset to one owner. If the shell or content container already owns outer spacing, page roots and reusable components must not repeat it; components own internal spacing only.
- Do not stack repeated `h-full`, `min-h-0`, `overflow-*`, padding, inset, or width rules across shell, content, page, and panel layers.
- Keep one main scroll owner where practical. Fixed headers, sidebars, inspectors, and footers should not compete with the list or content region for overflow control.
- Avoid broad `overflow-visible` patches that hide unclear ownership. If overflow must be visible, name the owning region and keep scrolling somewhere else explicit.

## Styling

- Preserve existing layout, spacing, breakpoints, typography, palette, copy, navigation, component hierarchy, table density, and form density unless requested.
- Prefer existing tokens, class utilities, component props, variants, and style files over one-off inline styles.
- Prefer browser inheritance and cascade for font, color, line-height, and spacing context when the parent or design system already defines them.
- Consolidate repeated CSS declarations into the nearest owning class, component prop, token, variant, or shared style only when that does not broaden side effects.
- Keep one declaration source for each visual responsibility. Do not repeat the same spacing, sizing, alignment, typography, color, border, or overflow declaration in base styles, component styles, utilities, and late overrides.
- Remove duplicate class definitions and late CSS overrides after moving responsibility to the correct owner; do not leave stale patch rules that shadow `ui-spec` declarations.
- Apply only detected rules from `styling-systems.md`, including Tailwind, CSS Modules, Sass/Less, CSS-in-JS, Ant Design, or shadcn/ui when present.
- Use one named layout class, token, or CSS variable for business-specific geometry such as split-pane widths, toolbar offsets, or complex loader anatomy.
- Do not introduce a new UI kit, theme provider, global reset, styling configuration, token system, icon library, or visual scale for a local change.
- Avoid decorative UI, landing-page patterns, or marketing-style composition on operational/admin pages unless requested.

## Behavior And Contracts

- Preserve routes, query params, hash behavior, permission-hidden entries, payload fields, response shapes, loading states, and error handling unless the task targets them.
- Trace API changes through request helper, service, type, caller, and page state.
- For HTTP REST, trace the repository-native client/types -> representative caller
  -> UI states. Trace normalized OpenAPI and generated TypeScript client/types only
  when the repository already owns that pipeline or the task explicitly introduces
  it; otherwise mark those checks `Not applicable`.
- When generated contracts are active, verify one code-first or contract-first
  upstream authority; frontend declarations never become a second authority.
- Preserve nullability, optionality, enums, IDs, date/money representation,
  pagination, auth, success, validation/business errors, and compatibility intent.
- Remove touched hand-maintained DTOs only when the generated client owns the same
  contract and all consumers are migrated; do not leave competing type families.
- Keep form validation, controlled state, table pagination, sorting, filtering, modal lifecycle, and drawer lifecycle aligned with existing local patterns.
- For a page-level modal, Drawer, portal/Teleport, or overlay-host change, freeze the
  exact host/container, route, entrypoint, and open state. Verify the outer mask blocks
  background interaction, each affected entrypoint opens the same owned surface,
  nested selectors/popovers remain usable above the parent layer without clipping,
  dismissal restores the intended state, and keyboard focus returns to the owner.
- Distinguish pending, failed, successful-empty, populated, and background-refresh
  states before defaulting async data to an empty collection. When cached successful
  data remains valid during a refresh failure, keep it visible and report the refresh
  problem without replacing it with a false initial-error or empty state.
- Use semantic controls: buttons for actions, links for navigation, labels for fields, and visible focus states.
- Inside a form, give retry, cancel, reveal, menu, and other non-submit buttons an
  explicit `type="button"` (or the framework-native equivalent).
- Keep unrelated async owners in separate state and feedback regions. Do not
  conditionally replace a primary task's status with updater, telemetry, account,
  or other secondary-domain errors unless an approved precedence contract requires it.
- Do not silently change date, currency, locale, enum, or status-display semantics.
- For Tauri/Electron UI, keep shell, file, platform, and native API access behind existing IPC/command wrappers and surface command errors in the UI.

## Validation

- For a one-owner local style, template, icon, copy, or similarly bounded component
  change with no API/state/public/shared/build/runtime impact, batch the edits and use
  the running dev/compiler diagnostics as the first signal. If they remain clean,
  finish with local diff inspection and `git diff --check`; tests remain `Not verified`.
  Do not add a red test, repeat checks, run a full build/suite, or add browser/review
  ceremony by default.
- During bounded iteration, never run bare aggregate test commands such as `npm test`,
  `npm run test`, `pnpm test`, `yarn test`, `bun test`, or equivalents. Explicitly name
  the affected test file/package/project or a repository-owned focused script.
- If no credible focused test exists, keep tests `Not verified`; do not use that gap as
  permission for a full suite.
- Do not run a full build or full suite during implementation. Leave it for an
  authorized merge/release/deployment/final-basis gate or an explicit user request,
  stating the trigger, exact command, and scope before execution.

- For selected-source visual work, run two same-viewport/state comparison passes:
  capture and compare, read computed geometry/style, fix confirmed findings, then
  recapture and reinspect.
- Independently inspect real assets and per-item fallback, font fallback including
  native controls, truncation, final contrast, section alignment, card dimensions,
  hover/focus, applicable loading/empty/error states, desktop target, and every key
  breakpoint named by the spec.
- Keep build/lint/typecheck and visual acceptance separate. Missing runtime coverage
  remains `Not verified` and prevents a visual-complete verdict.
- Keep the target acceptance surface fixed across implementation and runtime checks.
  A standalone preview or sibling route is separate evidence. For one unchanged
  observable acceptance, run the initial check and at most one correction recheck; if
  the same target acceptance fails again, stop patching, preserve the diff and direct
  evidence, and return to diagnosis or one accountable handoff.

- Run project-defined type, lint, test, build, formatter, or route checks only at a
  logical slice boundary, before handoff, or after a real error; keep them focused.
- Prefer non-mutating validation and use explicit fix/write commands only when rewrites are in scope.
- Snapshot branch-aware Worktree state before a validation command that may generate or rewrite files, then compare status and diff afterward. Classify new changes as requested source, expected task-owned generated output, validation side effect, or unrelated/user-owned work.
- Do not assume `build`, `check`, `dev`, or another read-like command preserved the checkout. Run a known writer in an isolated copy when practical. Never stage or retain validation drift merely because the command exited successfully; restore it only when the exact pre-state is known and the complete current diff is proven task-owned with no concurrent or mixed hunk. Otherwise preserve the diff and stop for `repo-review` ownership reconciliation.
- Use `ops-browser` when visual layout, interaction, responsive behavior, console errors, network payloads, or route behavior need web evidence.
- Use `ops-client` when the task requires proof from a real Tauri, Electron, or native desktop window.
- Mark unchecked runtime, visual, responsive, console, network, accessibility, or permission behavior as `Not verified`.
- Clean-regenerate the project-owned client, verify no unexplained generated drift,
  and run affected typecheck/build/tests. Static typecheck alone does not prove
  backend conformance or runtime loading/success/error behavior.

## Review

- Check for duplicate imports, unused imports, dead components, parallel helper layers, inconsistent aliases, uncontrolled layout changes, stale override rules, and accidental global style impact.
- Check that every new page/component/helper has an explicit reuse/reference search result and new-file justification.
- Check wrapper necessity, Flex/Grid choice, parent-owned alignment, adaptive child sizing, and single-owner page-edge spacing.
- For added, reused, moved, renamed, or deleted routes, components, features, packages, or shared directories, verify manifests, exports, route generation, scripts, tests, CI/build/deploy paths, architecture/project-map docs, indexes, and stale references.
- Compare before/after DOM and CSS ownership: if a wrapper or rule disappeared, confirm its old responsibility moved to the correct owner or was truly unnecessary.
- Check that every changed line belongs to the requested frontend change.
- Check that post-validation status matches the reviewed task scope and that every validation side effect is safely restored only after exclusive attribution, or preserved and reported unresolved when concurrent or mixed ownership cannot be ruled out.
- Route final dirty-tree review, staging plan, specialist coordination, and commit readiness to `repo-review`; route actual staging, commit, rebase/squash, push, and delivery to `repo-delivery`.
