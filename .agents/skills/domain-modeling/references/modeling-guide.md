# Domain Modeling Guide

## Contents

- [Evidence](#evidence)
- [Default Terminology And Rules Pass](#default-terminology-and-rules-pass)
- [Lifecycle Profile](#lifecycle-profile)
- [Bounded Context Profile](#bounded-context-profile)
- [Artifact Gate](#artifact-gate)
- [Output Template](#output-template)

## Evidence

Prefer explicit user decisions, accepted requirements, current business contracts, established domain documentation, representative tests, and then current code behavior. Code proves current behavior, not automatically business intent. Label each material statement `Confirmed`, `Inferred`, `Conflict`, or `Not verified`.

## Default Terminology And Rules Pass

- Give one canonical business term one meaning inside the relevant scope.
- Resolve synonyms and overloaded words that can change behavior or acceptance.
- Separate actors, resources, observations, decisions, and actions only when business evidence needs the distinction.
- Write rules as observable statements independent of framework, storage, transport, or UI.
- Test the rules against only relevant normal, edge, failure, retry, cancellation, permission, or historical-data scenarios.
- Stop when the shared ambiguity is resolved; do not expand into a complete domain catalog.

## Lifecycle Profile

Load only when state or transition order changes business meaning. Record applicable initial/active/terminal states, allowed and forbidden transitions, guards, retry/idempotency, cancellation/expiry, and relevant concurrency or historical-rule behavior. Do not load this profile for a terminology-only question.

## Bounded Context Profile

Load only when canonical language, business owner, consistency rule, permission authority, source of truth, or external contract differs materially. Use repository-native boundary terms where available; do not impose technical DDD patterns or split contexts by folder/team names.

## Artifact Gate

An artifact update requires all three:

1. an existing authoritative fact-source location;
2. a confirmed decision intended for durable cross-functional reuse;
3. explicit user authorization for the named write scope.

Otherwise return the decision in chat and leave repository files unchanged.

## Output Template

```markdown
# Domain Decision

## Scope and Evidence
## Resolved Language
## Business Rules
## Relevant Scenarios
## Lifecycle (only when selected)
## Bounded Contexts (only when selected)
## Contradictions and Decisions
## Open Questions
## Not Verified
```
