---
name: domain-modeling
description: "Use when shared business terms, meanings, rules, lifecycle conflicts, or domain boundaries are ambiguous across product work and must be resolved before specification or implementation; route feature-local behavior and acceptance to product-spec."
---

# Domain Modeling

## Overview

Resolve shared business language and rules from authoritative evidence. Default to terminology, ambiguity, rules, and boundary scenarios. Load lifecycle or bounded-context depth only when the business complexity actually requires it; do not turn the result into technical DDD, API, database, frontend, or backend design.

Consume `urn:skills:task-request:v1`; the portable typed handoff is
`urn:skills:domain-contract:v1`. A durable domain
document remains the business-language authority; the handoff references confirmed
terms, rules, conflicts, decisions, and authority assets without copying product,
interface, or delivery state.

## Workflow

1. Read effective repository and host guidance, then inspect only the supplied requirements, existing business facts, representative behavior, and tests needed for the named ambiguity.
2. Fix the scope, affected actors or capabilities, authoritative facts, conflicting terms or rules, excluded questions, and the decision that downstream work needs.
3. Run the default terminology/rules pass: resolve synonyms, overloaded words, shared meanings, business constraints, and relevant normal or edge scenarios.
4. Load the **Lifecycle** profile only when states, transition order, retry, cancellation, expiry, or terminal outcomes change business meaning.
5. Load the **Bounded Context** profile only when the same term or rule has materially different meanings, owners, consistency needs, or sources of truth across boundaries.
6. Label material statements `Confirmed`, `Inferred`, `Conflict`, or `Not verified`; request a decision when a conflict changes identity, permissions, money, lifecycle, compatibility, or irreversible behavior.
7. Return only the model depth needed to unblock the request. Write or update a named domain artifact only when the user explicitly authorizes it, the repository already has a fact-source location, and the decision is durable across functions.
8. When a compatible Repository Asset Graph exists, resolve or produce domain-
   authority asset refs through its declared producer and check duplicate authority
   claims. Do not hand-author IDs; unresolved ownership remains `Conflict` or `Not
   verified`.
9. When Forgeway delivery integration is active, bind input refs and the input
   PackageManifest/basis to an immutable Run. After an authorized artifact update,
   let the package producer create the result PackageManifest and attach the domain
   contract as an Observation. Domain resolution does not create a review or Receipt.

## Profiles

- **Terminology and rules (default):** shared vocabulary, ambiguity, business rules, contradictions, and boundary scenarios.
- **Lifecycle (conditional):** states, transitions, guards, retries, cancellation, expiry, and terminal outcomes.
- **Bounded Context (conditional):** different business meanings, owners, consistency rules, or sources of truth across real boundaries.
- **Artifact update (authorized only):** update an existing durable domain fact source.

## Do Not Use For

- Repository roots, commands, runtime boundaries, or reuse inventory; use `repo-map`.
- One feature's product behavior and acceptance when shared language/rules are already clear; use `product-spec`.
- APIs, schemas, database design, frontend/backend architecture, technical tasks, dependencies, or validation gates; use the appropriate technical owner or host planning.
- Source implementation, review findings, or Git delivery; use `dev-*`, `repo-review`, or `repo-delivery`.

## Hard Rules

- Do not invent facts to complete a tidy model.
- Do not default to entities, value objects, aggregates, repositories, domain events, or other technical DDD structures.
- Do not use tables, endpoints, classes, pages, folders, or service names as business concepts without business evidence.
- Keep business rules independent of framework, storage, transport, deployment, and UI structure.
- Do not write a domain artifact unless an existing fact source, durable cross-functional need, and explicit user authorization are all present.
- Never edit product source, define technical interfaces, stage, commit, or push.

## Output Contract

Return capability `domain.model.define`, `urn:skills:domain-contract:v1` result ref,
Run and input/result PackageManifest refs when integration is active, scope and
evidence, resolved glossary, business rules, relevant scenarios, contradictions,
decisions, open questions, authority asset refs, and `Not verified` gaps. Include
lifecycle or bounded contexts only when the selected conditional profile requires
them. If an artifact update was authorized, report its exact path, why it is a durable
shared fact source, and the preserved Git state. An explicitly requested independent
external challenge/research may hand one fixed question to `ask-ai`; it never implies
sending.

## References

- See [references/usage.md](references/usage.md) for triggers and routing examples.
- See [references/modeling-guide.md](references/modeling-guide.md) for the default pass and conditional profile checklists.
- See [references/eval-cases.md](references/eval-cases.md) for trigger, non-trigger, and quality evals.
