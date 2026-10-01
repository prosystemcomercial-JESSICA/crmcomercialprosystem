# DESIGN.md Consistency

Use only inside a selected Component/Layout audit with an applicable resolved `<design-root>`
`DESIGN.md`. This is a bounded evidence chain, not a new audit entry point or a
replacement for `repo-review`.

For each material claim, trace:

```text
DESIGN.md token/component/layout/pattern
  -> implementation adapter or config
  -> live component and representative consumer
  -> static evidence, then runtime/browser evidence when required
```

Inspect only the selected surface for shared token/semantic-component reuse and
spacing, density, scroll, responsive, and accessibility behavior. Check whether a
library/theme adapter actually binds the contract, rather than assuming it does.
Do not derive exact token values from screenshots or pixels. Static source can prove
an implementation path, but not rendered geometry, focus traversal, scroll behavior,
breakpoints, or assistive-technology output: mark those `Not verified` without direct
runtime evidence.

Report the contract anchor, adapter/config source, component and consumer, evidence
type, observed drift or absence, and the smallest remediation direction. Keep the
audit read-only and leave change-basis coordination with `repo-review`.
