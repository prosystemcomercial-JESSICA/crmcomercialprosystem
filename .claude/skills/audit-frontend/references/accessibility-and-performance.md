# Accessibility And Performance

Evidence basis: shadcn/Radix compound primitives, Outline and Appwrite
accessibility patterns, WAI-ARIA Authoring Practices, React's official
`useMemo` guidance, Tauri's async/channel guidance, and reference-repository
virtualized/paginated lists.

## Accessibility

Check:

- native interactive elements and complete keyboard operation;
- visible focus and logical focus order;
- one page-purpose `h1`, a logical heading sequence, and landmarks that make
  the main content and repeated navigation discoverable;
- Dialog/Popover/Menu initial focus, containment, Escape behavior, close
  control, and focus restoration;
- labels, descriptions, validation errors, required state, and submitting state;
- accessible names for icon-only buttons and controls whose visible text is
  removed at a selected responsive viewport;
- expanded/selected/pressed state where semantics require it;
- `aria-current="page"` (or the applicable current state) on active navigation;
- status not communicated by color alone;
- loading, async completion, progress, and errors announced without excessive
  live-region noise;
- table headers/captions and row-action reachability;
- desktop shortcuts do not conflict with text inputs, editors, browser/webview
  defaults, or assistive technology.

Prefer tested accessible primitives over rebuilding focus management locally.
ARIA does not repair the wrong native element.

## Runtime Evidence Boundaries

Use the user- or Feature-Spec-defined viewport matrix: verify every `required`
viewport, include `optional` viewports only when useful, and do not invent
coverage for `excluded` viewports. A screenshot can support visual review, but
does not prove DOM semantics, the accessibility tree, keyboard behavior, or
resource success.

For rendered accessibility claims, capture DOM or accessibility-tree evidence
for headings, landmarks, active navigation, and accessible names after
responsive visibility changes. Separately inspect the selected route's Network
or route-resource evidence for failed resources that affect the UI (for
example, a missing favicon). Report such failures under runtime/resource
evidence, not as accessibility findings unless they directly cause an
accessibility impact. If browser evidence is unavailable, state the exact gap
instead of approving from a screenshot.

## Performance Review Order

1. Trace the interaction, framework render/reactivity boundary, request path,
   cache updates, context/store/composable subscribers, native calls, and loaded
   bundles.
2. Identify unbounded lists, repeated requests, large global objects, broad
   context/store updates, duplicated derived state, synchronous blocking work,
   duplicate dependencies, or high-frequency IPC.
3. Measure in a production-like build or provide explicit complexity evidence.
4. Apply the smallest correction and measure again.

Do not optimize from component line count alone. Do not add `memo`, `useMemo`,
or `useCallback` as decoration; React documents them as performance tools whose
value depends on an actual expensive calculation or render boundary.

For Vue 3, do not recommend `computed`, `shallowRef`, `markRaw`, store splitting,
or watcher replacement as generic optimization. Trace which refs/reactive
properties, computed values, watchers/watchEffects, Pinia subscriptions, and
template regions update for the interaction. Check broad deep watchers,
accidental dependencies in `watchEffect`, unstable object replacement, duplicated
derived state, store-wide subscriptions, repeated guard/listener registration,
and requests restarted on every activation. Require profiling, request counts,
or explicit fan-out/complexity evidence before claiming a performance defect.

## Common Corrections

- paginate or virtualize unbounded collections;
- for React, narrow subscriptions/selectors and context providers;
- narrow Vue watcher sources, Pinia subscriptions, and reactive ownership when
  traced fan-out is broader than the feature needs;
- remove duplicated derived state and effect-driven update chains;
- deduplicate requests and use established cache invalidation;
- split bundles at existing route/feature boundaries when measurement supports it;
- move blocking native work off the UI thread and stream progress;
- batch or subscribe instead of issuing high-frequency IPC calls.
