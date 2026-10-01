# Frontend Audit Usage

## Summary

Use `audit-frontend` as one read-only frontend audit entrypoint. Detect the actual framework and local API style, then select only the profiles required by the request. React, Vue, UI/`ui-spec`, accessibility, performance, build/tooling, and Tauri concerns are internal profiles rather than separate public skills because they share the same evidence basis, ownership model, mutation boundary, and final report contract.

## Profiles

- **Architecture/Reuse:** routes, features, shared layers, dependency direction, abstractions, lifecycle, and docs.
- **State/Data/Contracts:** server/cache, URL, forms, business/local state, React/Vue reactivity, stores, schemas, requests, errors, cancellation, and IPC contracts.
- **Component/Layout/Design System:** primitives, variants, tokens, DOM/CSS, density, responsive layout, spacing, scrolling, and duplicate systems.
- **Accessibility:** semantics, keyboard, focus, accessible names, dialogs/popovers, forms, errors, and async status.
- **Performance:** render/reactivity/data paths, fan-out, request duplication, bundle/runtime/IPC cost, long tasks, and measurement quality.
- **Build/Tooling:** package/runtime pins, scripts, effective bundler, plugins,
  resolution, environment, proxy/base, output, SSR/library, compatibility, and
  deployment contracts.
- **Desktop Boundary:** frontend adapters, Tauri/native commands, DTO/errors, progress, cancellation, menus, shortcuts, windows, and real-client evidence.

Always state selected profiles and mark all other profiles `Out of scope`.

## Framework Profiles

- **React:** hooks/effects, context/store subscriptions, render boundaries, Router/Next/TanStack contracts.
- **Vue Composition:** refs/reactive/computed/watch/watchEffect, composables, Pinia, Router, provide/inject, keep-alive, scopes, and cancellation.
- **Vue Options:** data/computed/watch/`this.$watch`, methods, provide/inject, component guards, lifecycle, keep-alive, and cancellation without Composition conversion.
- **Other:** repository-native concepts; unsupported assumptions remain `Not verified`.

## Styling Profiles

- **Tailwind:** configured scale, tokens, variants, class composition, responsive utilities, and arbitrary-value ownership.
- **CSS Modules:** local selector ownership, imports, tokens, unused rules, and global leakage.
- **Sass/Less:** variables, mixins, module/import pipeline, nesting, specificity, and theme ownership.
- **CSS-in-JS:** installed runtime or extraction model, theme ownership, dynamic props, injection order, and bundle/runtime evidence.
- **Ant Design or shadcn/ui:** local wrappers/primitives, tokens, composition, accessibility contracts, and override boundaries.

Select only styling profiles present in the audited boundary. A styling technology is not a separate public skill because it shares the same audit owner, read-only boundary, and report contract.

## Trigger Examples

- `Audit this Console for architecture/reuse and state/data only; leave accessibility and performance out of scope.`
- `Audit this Vue 3 feature for reactivity, watcher dependencies, Pinia ownership, Router teardown, and request cancellation.`
- `Audit this frontend design system for duplicated primitives, variants, tokens, spacing, and scroll ownership.`
- `Audit this React and Tailwind table for scale drift, class conflicts, responsive behavior, and duplicated spacing ownership.`
- `Audit this Vue Options and Ant Design form without converting its API style or replacing its component system.`
- `Review accessibility and performance for this React table using browser evidence where static inspection is insufficient.`
- `Audit this Tauri frontend boundary for adapters, progress, cancellation, errors, menus, and shortcuts.`
- `Audit whether this Vite app needs Rolldown configuration and verify its production-output contract.`
- `Under repo-review, inspect only the changed frontend paths for selected state/data and layout profiles.`

## Non-Triggers

- `Change this button label in the known component.` — use `dev-frontend`.
- `Find why this page crashes.` — use the host's built-in diagnosis under effective instructions until the cause is confirmed.
- `Verify the page in a browser.` — use `ops-browser`.
- `Review all local dirty files, split commits, and prepare staging.` — use `repo-review`.
- `Review the whole repository or a commit range and coordinate all domains.` — use `repo-review`, which may delegate a bounded frontend surface here.
- `Stage, commit, or push the accepted changes.` — use `repo-delivery`.

## Why Not Separate `audit-react`, `audit-vue`, and `audit-ui`

Do not split solely by framework or checklist category. These concerns share:

- the same repository guidance and target inventory;
- the same route/feature/component/state ownership map;
- the same read-only boundary and fix owner;
- the same need to combine state, layout, accessibility, and performance evidence;
- the same final severity and validation contract.

A new public skill is justified only when it has a distinct user intent, authorization boundary, workflow, output contract, and non-trigger set. A future screenshot/Figma-first product-experience audit may qualify as `audit-ux`; ordinary source-backed UI review remains a profile here.

## Expected Report

Lead with inspection snapshot, product/framework profile, selected profiles, excluded profiles, coordinating owner when delegated, and severity-ranked findings. Then report inspected evidence, reuse candidates, ownership map, selected state/data/layout/accessibility/performance/build/desktop evidence, component/injection/router/lifetime contracts, structural/documentation lifecycle, validation, and residual `Not verified` risks.
