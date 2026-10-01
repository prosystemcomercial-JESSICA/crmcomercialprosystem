# Frontend Anti-Patterns

Treat these as investigation signals, not automatic rewrite instructions.

| Signal | Evidence to inspect | Preferred correction |
| --- | --- | --- |
| Giant route file | registration, guards, data, workflows, and rendering mixed together | keep route contract visible; move owned behavior to existing feature boundaries |
| Giant page component | unrelated responsibilities and change reasons | split by ownership, not an arbitrary line count |
| Page calls several low-level APIs | request/error/cache logic repeated in presentation | use the existing service/loader/query boundary |
| Every page rebuilds table, pagination, dialog, or empty state | duplicate interaction and inconsistent feedback | reuse Console primitives or stable composition/variants |
| Business component in global `components` | domain imports, permissions, entity copy | move to owning feature unless stable shared consumers exist |
| Wrapper layers for simple logic | pass-through props/classes and one child | flatten or merge responsibility into semantic owner |
| Deep directories with unclear ownership | vague `common/shared/utils` names and cross-feature imports | choose a named feature or real platform boundary |
| Multiple spacing, form, toast, or request systems | similar pages import different mechanisms | follow nearest established system; migrate only as a scoped task |
| Local dialog state in global store | no durable cross-tree consumer | return it to component/feature state |
| React Context used only to avoid props | broad provider updates and hidden dependencies | use composition/props or a narrower established store |
| Vue watcher mirrors computed state or fetches from a broad watchEffect | explicit versus automatic dependencies, flush timing, invalidation, stale responses | use `computed` for derivation; narrow the effect and cancel stale async work |
| Vue composable or injection hides shared mutable ownership | module scope, provider key/default, store consumers, mutation and disposal owner | keep instance state local or expose a typed provider/store contract with explicit commands |
| Vue guard/listener duplicates after navigation or keep-alive activation | registration site, unregister callback, activated/deactivated/unmounted paths | register at the real router/component owner and tear down at the matching lifetime |
| Copied component variants drift | same interaction with minor class changes | compose, add a stable variant, or keep one owner |
| UI/API/Rust validation differs | contradictory constraints and error shapes | choose authoritative backend validation and align/generated client schema |
| High-frequency Tauri invoke | call per row, keypress, or render | batch, debounce, cache, or stream through an adapter |
| SQLite/native work blocks UI | frozen window and no lifecycle feedback | async task with real progress, cancellation, error, and cleanup |
| Page spacing differs | duplicated hard-coded gaps and margin patches | use one page layout/token owner |
| Unrelated cleanup in feature diff | no requirement or dependency | exclude it and record separately |
| Project rule conflicts with skill | local code/docs intentionally differ | follow priority order and report the local decision |
| Code and architecture docs disagree | moved owner or stale diagram/index | update both in the same structural task |

Do not create a new abstraction merely to eliminate two similar snippets.
Stability, ownership, behavior, and real consumers matter more than occurrence
count.
