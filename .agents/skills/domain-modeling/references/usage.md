# Domain Modeling Usage

## Summary

Use `domain-modeling` when shared business vocabulary, meaning, rules, lifecycle, or real business boundaries are ambiguous across product work. Default to the smallest terminology/rules decision; load lifecycle or bounded contexts only when needed.

## Triggers

- `Our docs use account, tenant, member, and user inconsistently; resolve the shared vocabulary.`
- `These two features disagree on whether a paused subscription may renew; clarify the durable business rule.`
- `Map the order lifecycle because retry, cancellation, and terminal outcomes change the requirements.`
- `Billing and entitlement use the same term with different owners and consistency rules; clarify the boundary.`

## Non-Triggers

- Map roots, commands, source ownership, or reusable code: use `repo-map`.
- Specify one feature whose shared language and rules are already clear: use `product-spec`.
- Define APIs, schemas, database tables, frontend/backend structure, or technical tasks: use the appropriate technical owner or host planning.
- Diagnose a concrete failure: use the host's built-in diagnosis under effective instructions.

## Composition

```text
domain-modeling (only when shared meaning/rules are unresolved)
  -> product-spec or host planning
  -> dev-* -> repo-review -> repo-delivery
```

Do not invoke `repo-map` or every lifecycle step ceremonially. A clear feature or technical change may start at its direct owner.

## Output

Return concise confirmed facts, inference, contradictions, decisions, open questions, and unverified gaps. Include a state diagram or bounded-context view only when the selected profile makes it useful. Do not write a repository artifact without the explicit three-part artifact gate.
