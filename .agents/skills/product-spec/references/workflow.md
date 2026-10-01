# Product Specification Workflow

## Evidence First

1. Read effective guidance and product-document conventions.
2. Search named requirements, current product facts, UI states, and representative
   consumers only as far as needed to resolve product choices.
3. Separate confirmed current behavior from proposals and assumptions.
4. For a fact that materially changes scope, user outcome, data risk, or acceptance,
   trace its state and evidence to the affected slice and observable acceptance
   consequence. Do not add technical design or interface definitions.
5. Ask only questions whose answers can change the selected slice.

If an existing Foundation Spec already establishes the product boundary, treat it
as an input rather than a template to rewrite. A source-proven behavior gap may
become one Feature Spec when the user requested downstream implementation and no
material product choice is missing. Keep contradictory or unsupported behavior as
an Open Question instead of silently resolving it from code.

Product positioning may be split across an existing vision, README, product map,
and current policy manifest. Use the smallest consistent verified set as evidence;
do not create or rewrite a Foundation Spec merely to consolidate those sources.

## Decision States

When a material product decision remains after the evidence pass, apply the
[product decision pressure test](decision-pressure-test.md). Keep the pressure-test
loop there as the single authority and use the states below in its decision record.

Use these statement states:

- **Confirmed**: supported by user decision or current authoritative evidence.
- **Assumption**: proposed to keep progress possible but not yet authoritative.
- **Open Question**: unresolved and potentially material.
- **Rejected**: considered and explicitly excluded.
- **Deferred**: intentionally outside the current slice.

## Product Scope Gate

Inventory user jobs, behavior/rule ownership, dependencies, and acceptance boundaries
before choosing artifact shape.

- Several pages belong to one Feature Spec when they form one connected job and share
  the same behavioral decisions and acceptance boundary.
- Several independent jobs or feature owners require one short product index plus one
  fact slice per confirmed feature. Home, tasks, contacts, and profile are independent
  by default; a common navigation shell does not make them one feature.
- Put only genuinely shared product facts, slice links, statuses, dependencies, and
  blockers in the index. Keep slice-local flows, rules, failures, and acceptance in
  the target slice.

Developing one slice requires reading the shared index and that slice only. Do not make
a consumer load sibling slices. An open question blocks only the slice whose behavior
or acceptance it can change.

## Ready for an Implementation Slice

Name each slice, then verify only applicable gates:

- user and problem outcome;
- scope and non-goals;
- main, empty/loading, permission, validation, business-error, and recovery flows
  that can affect the slice;
- business rules and user-visible semantics;
- user-visible UI and data effects only where the slice touches them;
- dependency edges and executable acceptance results.

Block only when a missing decision can change user behavior, business rules,
permission/security boundaries, failure semantics, or
acceptance results. Otherwise record the question as Assumption or Deferred and
declare `Ready for <slice>`. Report readiness per slice; do not replace it with one
package-wide verdict.

## Stop Conditions

- Stop decision pressure testing when the slice passes the Ready gate.
- Stop Artifact Update if the requested source is absent or write authorization is
  missing; return a preview or `Not found` instead of creating a replacement.
- Stop and route deep domain or `ui-spec` ownership to the proper Skill.
- Stop before implementation, Git mutation, runtime verification, or technical
  interface definition. Route current interface mapping separately to `repo-map`.

## Documentation Rebuild Closure

When a full rebuild is explicitly authorized, finish only after the product index,
foundation, all affected slices, cross-links, and deleted paths agree. Remove
superseded decisions, task-time verification, and duplicate authorities from durable
docs; verify the ignored location for any retained local evidence. Scan tracked and
untracked files because ordinary diffs do not expose the full documentation tree.
