# Frontend Implementation Usage

## Summary

Use `dev-frontend` as the first frontend coding skill after repository context is known. It covers UI changes, forms, tables, dashboards, responsive fixes, component organization, desktop-webview UI, and structural DOM/CSS cleanup while preserving the current app's stack and contracts.

## Best For

- Implementing a UI fix without changing unrelated layout.
- Adding or changing forms, tables, modals, drawers, settings pages, or dashboards.
- Cleaning confused imports, duplicate component paths, oversized page files, or unclear component boundaries.
- Simplifying nested markup, animation-only wrappers, repeated utilities, duplicated CSS, or over-specified styles without redesigning the page.
- Converging shell/content/page/panel/scroll structure after repeated layout patches.
- Flattening nested `div`s, choosing the shortest Flex/Grid path, and keeping children adaptive.
- Removing repeated CSS declarations and duplicate outer/page-edge spacing.
- Moving logic into existing hooks, services, helpers, features, commands, or types.
- Self-checking the edited frontend surface for layout ownership, component-system drift, stack mixing, or contract changes.
- Choosing between utility classes, design tokens, CSS modules, local components, Ant Design, or shadcn/ui based on the current app.
- Improving Tauri/Electron webview UI code while leaving real-window proof to `ops-client`.
- Aligning frontend scripts, naming, directories, and add/reuse/move/delete documentation to an explicit repository standard.
- Reusing or adapting an existing page/component pattern before creating a new implementation.
- Implementing Vue 3 SFCs without changing the repository's `<script setup>`, Composition API, or Options API convention.
- Correcting Vue reactivity, composable/Pinia ownership, Router guard lifetime, provide/inject contracts, keep-alive behavior, or stale-request cleanup in a known surface.

## Trigger Examples

- `Fix this React page without changing the layout.`
- `Add this Vue 3 settings form using the existing script setup, Pinia, Router, and component patterns.`
- `Fix this Vue composable: keep watch sources explicit, bound watchEffect dependencies, preserve provide/inject ownership, and cancel stale requests on deactivation.`
- `Add this form to the existing AntD page using current patterns.`
- `Build this admin table page using the existing filters, table, and empty/error patterns.`
- `This Vite page has messy imports and component organization; clean only what is needed.`
- `Simplify this component: too many nested divs and repeated CSS rules.`
- `Clean up this page structure: shell, content container, animation wrapper, and page root are all fighting overflow.`
- `Merge this animation wrapper into the semantic page root and keep one scroll owner.`
- `Flatten these nested divs, use one flex owner for alignment, and keep the children adaptive.`
- `Remove duplicated CSS and stop the component from repeating the page container's outer padding.`
- `Move these scattered width utilities into one layout class or CSS variable.`
- `Replace h-[22px] and w-[88px] with project scale utilities or named CSS owners.`
- `Use the existing Tailwind style conventions; do not redesign the page.`
- `Implement this React and Tailwind table using the existing variants, spacing scale, query state, and responsive conventions.`
- `Add this Vue Composition and Pinia settings flow while preserving store, Router, cancellation, and keep-alive ownership.`
- `Fix this Vue Options and Ant Design form without introducing Composition helpers or replacing the component system.`
- `Add a table action but preserve the current route and permission behavior.`
- `Fix this Tauri settings UI, but keep native commands behind the existing IPC layer.`
- `Align this React app to its documented routes/components/stores naming and update manifests, tests, and project-map entries.`
- `Before creating this page, inspect the existing routes and components and reuse the closest implementation.`
- `If nothing is reusable, follow the nearest reference component and explain why a new file is necessary.`
- `Migrate this React consumer to the generated OpenAPI client, preserve auth and
error states, remove the touched duplicate DTO, and verify loading/success/error.`

## Non-Triggers

- Repository onboarding or command discovery; use `repo-map`.
- Large future planning before implementation; use the host's built-in planning.
- Diagnosis-only work before any frontend source change is requested; use the host's built-in diagnosis under effective instructions.
- Git diff ownership, staging plans, or commit readiness; use `repo-review`. Use `repo-delivery` for actual staging, commit, push, or delivery.
- Systematic read-only frontend architecture, reuse, state/data, layout, accessibility, performance, or Tauri-boundary review; use `audit-frontend`.
- Browser screenshots, console, network, uploads, downloads, account state, or runtime checks; use `ops-browser`.
- Real desktop-client launch, process, CGWindowID, or native runtime evidence; use `ops-client`.
- Product behavior, permissions, compatibility, or failure semantics are unresolved;
  use `product-spec` before frontend implementation.

## Output

Follow `SKILL.md`'s common implementation report: scope, detected project/stack and
ownership boundaries, applicable authorities and existing owners, selected frontend
risks, reuse or new-surface decision, changed files/contracts, validation, Worktree
drift, excluded work, and `Not verified` gaps. Add layout, state/lifecycle, desktop,
selected-source mapping, visual passes, and browser/client evidence only when those
risks materially apply.
