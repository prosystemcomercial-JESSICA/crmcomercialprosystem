# Eval Cases

## Trigger Eval

| User prompt | Expected result | Why |
| --- | --- | --- |
| `Our docs use account, tenant, member, and user inconsistently; resolve the shared vocabulary.` | Trigger the default terminology/rules profile. | Cross-feature terminology conflict. |
| `Two product areas disagree on whether a paused subscription may renew; resolve the durable rule and edge cases.` | Trigger the default profile. | Shared business-rule contradiction. |
| `Map the order states, invalid transitions, retries, cancellation, and terminal outcomes because requirements conflict.` | Trigger the Lifecycle profile. | Transition meaning is materially complex. |
| `Billing and entitlement use the same term with different owners and consistency rules; clarify the boundary.` | Trigger the Bounded Context profile. | Real business meanings and owners differ. |
| `Update the existing domain glossary with these confirmed cross-functional decisions.` | Trigger Artifact Update only after explicit path/scope authorization is verified. | Durable fact-source write may be appropriate. |

## Non-Trigger Eval

| User prompt | Expected result | Why |
| --- | --- | --- |
| `Map the real repository roots, startup commands, and reusable modules.` | Prefer `repo-map`. | Repository semantics. |
| `Specify this settings feature's users, flows, failure behavior, and acceptance; shared terms are already clear.` | Prefer `product-spec`. | Slice-level product behavior. |
| `Design the REST API, database tables, frontend stores, and backend services.` | Do not trigger this Skill; use technical planning/owners. | Technical architecture. |
| `Implement the approved order transition in Rust.` | Prefer `dev-rust`. | Source mutation. |
| `Review this branch for missing requirements and regressions.` | Prefer `repo-review`. | Change review. |
| `Create aggregates, repositories, entities, value objects, and domain events for this codebase.` | Do not trigger by default; clarify the business ambiguity or route technical design to host planning. | Technical DDD vocabulary alone is not the owner boundary. |

## Independent Review Outlet Eval

| User prompt | Expected result |
| --- | --- |
| `Resolve the shared rule, then explicitly prepare one independent ChatGPT primary-source domain challenge.` | Keep `domain-modeling` as owner and emit one lightweight `ask-ai` handoff. |
| `Resolve the shared rule from the supplied evidence only; no external review was requested.` | Emit no `ask-ai` handoff. |

## Quality Eval

| Case | Expected evidence | Reject if |
| --- | --- | --- |
| Evidence discipline | labels confirmed, inferred, conflicting, and unverified statements | presents guesses as truth |
| Default economy | resolves only shared terms, rules, contradictions, and relevant scenarios | expands into a complete domain catalog |
| Conditional depth | loads lifecycle or bounded contexts only when material complexity is evidenced | emits both profiles for every request |
| Business boundary | keeps rules independent of API, database, frontend/backend, framework, and deployment | produces technical architecture |
| DDD restraint | uses business-native language and avoids default aggregates/repositories/domain events | imposes technical DDD structures |
| Scenario testing | probes only relevant normal, edge, failure, retry, cancellation, permission, or historical cases | creates a tidy model without stress-testing material rules |
| Artifact authority | requires existing fact source, durable cross-functional need, and explicit authorization | writes docs automatically |
| Product-spec boundary | hands one-feature behavior to `product-spec` when shared meaning is already clear | absorbs all product specification |
| Repository-map boundary | uses source as evidence but routes repository mapping to `repo-map` | turns modeling into onboarding |

## Scoring

Score each quality case 0–10. Minimum pass: routing is correct, every quality case scores at least 8, and artifact or technical-authority violations are hard failures.
