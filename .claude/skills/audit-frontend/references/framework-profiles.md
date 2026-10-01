# Framework Profiles

Select exactly one framework profile per audited boundary from manifests, file extensions, imports, and nearby code. Use these rules only inside selected audit profiles.

## React

- Verify render purity, immutable props/state, Rules of Hooks, and the
  repository's official React lint configuration before applying stylistic
  preferences.
- Trace component, hook, context/store, route/data, error-boundary, suspense/loading, and subscription ownership.
- Verify effect dependencies and cleanup against the actual lifecycle; distinguish event logic from synchronization effects.
- Check context/store subscription scope and render boundaries before recommending memoization or store splitting.
- Preserve React Router, Next.js, or TanStack Router paths, params, search, loaders/actions, layouts, cache, and navigation contracts.
- Require render, calculation, bundle, or request evidence before recommending memoization, virtualization, or cache changes.
- Before declaring code unused, trace JSX use, exports, lazy/dynamic imports,
  file-system routes, framework registration, server/client boundaries, tests,
  stories, and CSS/module references.
- Do not require one component per file, named exports, shallow prop-drilling
  limits, or default `memo`/`useMemo`; those are repository or evidence-based
  decisions, not React correctness rules.

## Vue Composition

- Confirm SFC and `<script setup>` or Composition conventions before applying rules.
- Trace `ref`, `reactive`, `computed`, destructuring/spread, `toRef`, `toRefs`, Pinia extraction, `storeToRefs`, shallow/raw values, and third-party objects at real reactivity boundaries.
- Require explicit `watch` sources. For `watchEffect`, inspect synchronous dependency collection, invalidation, stale-response handling, feedback loops, and flush timing.
- Check composable instance/shared/effect-scope lifetime, provider/store ownership, Router guards, keep-alive activation, teardown, and cancellation.

## Vue Options

- Audit native `data`, `computed`, watch keys/getters/handlers, deep/immediate/timing behavior, dynamic `this.$watch` cleanup, methods, provide/inject, component Router guards, and lifecycle.
- Check `mounted`, `unmounted`, `activated`, and `deactivated` ownership plus stale-request cancellation.
- Do not require Composition imports or recommend incidental conversion.

## Shared Vue Contracts

- Verify read-only props, explicit emits, event payloads, `v-model`, slots, fallthrough attributes, and component names.
- Verify provider/store ownership, typed injection keys, defaults, reactive mutation authority, and local versus shared lifetime.
- Preserve Router params, query, meta, redirects, guards, scroll behavior, and keep-alive contracts.

## Repository-Native Other

- Audit using the repository's native component, state, lifecycle, routing, and performance concepts.
- Do not map React or Vue terminology onto another framework without direct evidence.
- Mark unsupported assumptions `Not verified`.
