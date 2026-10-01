# State, Data, And Forms

Evidence basis: Twenty's local hooks/Jotai/Apollo separation, Outline's MobX
stores with fetch logic, Appwrite's route stores/SDK/dependency invalidation,
and GitButler's loadable query/services. The rule is ownership separation, not
adoption of those libraries.

## State Classification

| State | Preferred owner | Review questions |
| --- | --- | --- |
| Server/cache | existing query/cache/loader layer | key, freshness, invalidation, retry, cancellation, optimistic rollback |
| URL/route | typed params/search | shareability, back/forward, reload, validation |
| Form | form library/component plus schema | dirty/submitting/errors/reset, server errors |
| Shared business | feature/global store only when cross-tree and durable | owner, consumers, lifecycle, persistence |
| Local UI | component or feature hook | why would another screen need it? |

Avoid mirrored derived state. Compute from the owning source unless caching is
measured and invalidation is explicit.

## Framework State And Reactivity

Select the detected framework rules from `framework-profiles.md`. Under State/Data/Contracts, trace only the relevant component, hook/composable, context/store, provider/injection, route, cache, effect/watcher, lifecycle, cancellation, and stale-work boundaries. Do not apply another framework's terminology or recommend API-style conversion without explicit scope.

## Request And Cache Contract

Trace page → hook/composable/loader → service/client → endpoint/command → cache update.
Verify:

- request identity, deduplication, stale response handling, and abort/cancel;
- loading for initial and incremental work;
- empty versus filtered-empty;
- typed error with retry or recovery;
- partial data and per-region failure where applicable;
- optimistic update, rollback, invalidation, and reconciliation;
- pagination/virtualization for unbounded collections;
- permission and feature-gate behavior;
- cleanup when route, component, project, or window changes.

Do not add a second request wrapper or cache because one call is inconvenient.
Extend the established boundary or document why it cannot represent the case.

## Services

Services/adapters own SDK, fetch, browser, and native integration. They map
transport DTOs/errors to feature concepts and expose cancellation when the
transport supports it. Pages should not coordinate several low-level APIs
directly.

## Forms And Schemas

- Use the established form and schema stack.
- Keep client validation for immediate UX and backend validation authoritative.
- Share or generate stable transport schemas when the repository supports it;
  otherwise test that frontend constraints and backend contract agree.
- Do not copy validation into field components, submit handlers, API helpers,
  and Rust commands with different messages or constraints.
- Associate labels, descriptions, errors, required state, and submission state
  with their controls.
- Disable or guard duplicate submission, surface server field/general errors,
  and define reset/close behavior after success and failure.
