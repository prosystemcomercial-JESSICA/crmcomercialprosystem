# Framework Profiles

Select exactly one profile from repository evidence before applying framework-specific rules. If the target mixes frameworks, classify each edited boundary separately.

## React

- Follow the existing component, export, file-naming, hook-placement, and render-boundary conventions.
- Keep state close to its owner unless an established context, store, route loader, query, or feature hook owns it.
- Preserve hook ordering, effect dependencies, subscription cleanup, error boundaries, suspense/loading behavior, and repository lint rules.
- Preserve React Router, Next.js, or TanStack Router paths, params, search, loaders/actions, layouts, and navigation contracts.
- When several boolean props encode mutually exclusive modes or create invalid
  combinations, replace the mode axis with an established variant, explicit component,
  slot, or compound composition. Keep genuinely independent booleans as booleans.
- Use compound components or context only when related consumers share a stable owner
  and coordinated state or structure; preserve a simple prop API when composition would
  add indirection without removing a real invalid state or repeated assembly.
- Add memoization only for an evidenced render or calculation boundary; do not use it as decoration.

## Vue Composition

- Preserve the repository's SFC structure and `<script setup>` or Composition API convention.
- Keep `ref` and `reactive` ownership intentional and pure derivation in `computed`.
- Treat destructuring, spreads, Pinia extraction, class instances, and third-party objects as possible reactivity escapes; use local `toRef`, `toRefs`, `storeToRefs`, shallow, or raw patterns only when needed.
- Give `watch` an explicit source and intentional deep, immediate, and flush behavior. Use `watchEffect` only for bounded automatic dependencies; reads after an `await` are not collected as synchronous dependencies.
- Make composable instance, shared, and effect-scope lifetime explicit. Clean watchers, listeners, timers, subscriptions, guards, and requests through invalidation, scope, component, route, or keep-alive ownership.

## Vue Options

- Preserve native `data`, `computed`, watch options or owned `this.$watch`, `methods`, `provide`/`inject`, component Router guards, and lifecycle.
- Keep dynamic watcher teardown, request cancellation, and `mounted`/`unmounted`/`activated`/`deactivated` ownership visible.
- Do not add Composition imports, translate lifecycle mechanically, or convert the component merely to apply a rule.

## Shared Vue Contracts

- Keep props read-only and emits explicit; preserve event payloads, `v-model` arguments/modifiers, slots, fallthrough attributes, and component names.
- Keep provider/store ownership and mutation authority explicit. Use the established typed injection key and missing/default behavior.
- Use Pinia only for established cross-tree or durable ownership; keep component-only state local and avoid hidden module-level singleton state in composables.
- Preserve Router params, query, meta, redirects, lazy routes, guards, scroll behavior, and keep-alive contracts.

## Repository-Native Other

- Follow the target repository's native component, state, lifecycle, routing, and validation concepts.
- Do not translate React or Vue rules into another framework by analogy.
- Mark unsupported framework assumptions `Not verified`.
