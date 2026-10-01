# Project Grounding Protocol

Use this protocol when a task changes or judges behavior across a runtime,
configuration, artifact, data, integration, compatibility, delivery, or authority
boundary, within or across repositories. It closes the gap between navigation and
implementation/review evidence. It does not replace live source discovery, a
repository map, product specification, domain audit, or runtime verification.

## Contents

- [Activation](#activation)
- [Grounding Record](#grounding-record)
- [Signal To Evidence Closure](#signal-to-evidence-closure)
- [Evidence And Status](#evidence-and-status)
- [Owner Responsibilities](#owner-responsibilities)
- [Boundaries](#boundaries)

## Activation

Activate grounding when the requested change or review touches one or more of:

- a Git/build/runtime owner boundary or coordinated consumer in another repository;
- startup, profiles, environment variables, feature flags, service discovery,
  deployment manifests, packaging/resource filtering, or external configuration;
- a public API, route, DTO/wire format, authentication/authorization boundary,
  gateway/proxy, event, generated client, or external service;
- schema, migration, entity/mapping, repository/query, cache/source-of-truth, or
  compatibility with existing durable data;
- replacement, rewrite, removal, migration, parallel old/new paths, rollout, or
  rollback of reachable behavior;
- a completion/readiness claim that depends on runtime, deployment, CI, data,
  external services, or another repository.

Do not activate it merely because a repository contains Java/frontend/config files.
Comment-only, documentation-only, styling-only, test-fixture-only, or isolated
internal refactors may mark unrelated risk classes `Not applicable` when their
reachable behavior and delivery contracts are unchanged.

## Grounding Record

Build the smallest task-scoped record that can answer the activated risks:

1. **Basis and boundary:** working directory, owning Git root, relevant status or
   immutable SHA/range, build/package owner, deploy/runtime unit, and coordinated
   repositories or consumers. A non-Git container is not a child repository.
2. **Authority:** effective instructions, approved requirement/decision owner,
   native API/schema/config authority, compatibility owner, and deployment owner when
   evidenced. A document added in the same change proves intent, not independent
   approval or compatibility.
3. **Runtime resolution:** executable entry point, active profiles and precedence,
   environment/config injection, packaging/resource transforms, registrations,
   external dependencies, and the difference between local and target runtime.
4. **Behavior and data contracts:** callers/consumers, identity and permission source,
   validation/error states, persistent source of truth, existing data semantics,
   migrations, generated artifacts, and legacy paths that must coexist or retire.
5. **Verification seams:** repository commands plus risk-specific static, automated,
   artifact, integration, runtime, rollout, and rollback evidence that is available.
6. **Freshness and gaps:** source path and basis for decisive facts, evidence collected
   now, stale historical signals requiring revalidation, exclusions, and unresolved
   `Not found` or `Not verified` items.

Keep this record in working notes or the requested artifact. Do not persist secrets,
credential values, private endpoints, transient dirty state, or a configuration dump.

## Signal To Evidence Closure

For each activated signal, record `signal -> affected invariant -> owner/authority ->
evidence category and evidence -> verification state -> disposition -> required next
action and action owner`.

| Signal | Questions and minimum evidence |
| --- | --- |
| Root/build boundary | Prove the command root, owning manifest/module, pinned toolchain, package output, and affected consumers. |
| Runtime/config | Resolve precedence from source through packaged artifact and target injection; distinguish local startup from target-runtime behavior. |
| Dependency/packaging | Inspect manifest/lock or BOM, resource/generation rules, artifact contents when needed, and runtime use; declaration alone is not resolution. |
| API/integration | Trace native controller/handler, DTO/wire contract, context/gateway/proxy, auth/data scope, client adapter, states, and representative consumers. |
| Schema/persistence | Identify durable owner, existing schema/data meaning, forward migration, compatibility/dual-path need, recovery or rollback, and target-dialect evidence. |
| Legacy/replacement | Inventory reachable old behavior and data; require an evidenced decision owner, coexistence/cutover, observability, rollback, and consumer migration before destructive replacement. |
| Auth/security | Trace trust boundary, identity source, authorization/data scope, secret injection, negative paths, and logs; a UI guard or config key is not enforcement. |
| Cross-repository delivery | Name providers/consumers, version or compatibility rule, release order, deployment dependency, integration seam, and independently verified gaps. |

File names, annotations, framework presence, line count, and scanner matches are
signals only. They do not determine applicability, severity, or verdict without a
reachable invariant and impact.

## Evidence And Status

Keep evidence categories distinct:

- **Declared:** instructions, docs, configuration keys, or source comments state an
  intent. This does not prove effective or approved behavior.
- **Source-resolved:** current code/config/build chain establishes reachable static
  behavior at the recorded basis.
- **Automated:** a named check exercises the stated seam with recorded inputs and
  environment. It proves only that coverage.
- **Artifact-resolved:** the built/generated/package output was inspected or exercised.
- **Runtime-resolved:** an authorized executable path was exercised. Qualify it as
  `local`, `target-like`, or `deployed:<environment>` and record the environment and
  limitations; none of these qualifiers implies another.

Record verification independently from whether work may continue:

- **Verified within scope:** name the evidence category, basis, command/path,
  environment qualifier when applicable, and limit.
- **Not verified:** evidence required for a claim was unavailable or outside authority.
  It means unknown, not failed or safe.
- **Not found within searched scope:** a bounded current search found no authority,
  owner, path, or artifact. Record searched roots/paths, basis, and limits; never imply
  global absence.
- **Not applicable:** the risk class is outside the reachable change/review scope;
  record the short reason when it would otherwise be expected.

Then record one action disposition:

- **Block:** continuing or claiming completion would perform an unauthorized or
  destructive action, cross an unresolved owner/contract boundary, replace durable
  behavior without a decision/migration path, expose a likely secret, or rely on a
  decisive authority conflict whose outcome is not established. Stop the affected
  action, cite the invariant and minimum resolution; continue safe independent work.
- **Warn:** evidence shows a concrete risk but bounded work may continue without
  making the unsupported claim. State impact, owner, and required check.
- **Continue:** the selected action is authorized within the stated verified scope;
  preserve every narrower or unresolved claim and its next action.

Apply claim-specific evidence floors:

- packaged/generated completion requires `Artifact-resolved` evidence for the named
  output;
- deployed or production behavior requires `Runtime-resolved(deployed:<environment>)`
  evidence from that named environment;
- migration compatibility requires the applicable dialect/data basis, migration path,
  and compatibility evidence; a clean-schema test alone is insufficient for existing
  data;
- cross-repository integration requires evidence from the affected provider-consumer
  seam at compatible revisions;
- rollout and rollback readiness require their own exercised evidence or remain
  separately `Not verified`.

A completion claim must be narrowed to the strongest supported evidence level. Listing
a stronger unresolved check beside a broad completion claim does not make that claim
valid.

Never upgrade static or local evidence into production readiness. Revalidate historical
findings against the current basis; history explains decisions but does not prove
current behavior.

## Owner Responsibilities

- `repo-map` may persist stable routing, authorities, contract edges, and verification
  entry points. It must not persist transient grounding state or issue review verdicts.
- `dev-*` builds the task-scoped grounding record before edits, implements only after
  decisive authorities and compatibility constraints are sufficient, and reports
  evidence gaps without calling the change complete.
- `audit-*` selects risk profiles from semantic signals, reads enough adjacent owners
  to close the contract, and reports only reachable evidence-backed findings.
- `repo-review` binds grounding to its fixed Worktree/SHA/package basis, treats
  same-change specifications as intent unless independently authoritative, attributes
  legacy/runtime/cross-repository risk to the basis, and owns the integrated verdict.
- `repo-delivery` remains the only Git-mutation owner and does not turn a grounding
  record into review or delivery authority.

## Boundaries

- Prefer bounded live discovery; do not scan every repository or run every profile by
  default. Expand only across an activated provider/consumer or runtime edge.
- Do not invent CODEOWNERS, a release order, production topology, migration decision,
  or spec authority. Mark absent evidence `Not found within searched scope` or `Not
  verified` as applicable.
- Do not require a framework-specific tool, OpenAPI, container, browser, deployment,
  or secret scanner unless the project/risk needs it. Use repository-native seams.
- Credential-shaped content is a signal. Avoid displaying or externalizing values;
  verify tracked status, secret owner, indirection, and exposure before a verdict.
- A large diff increases sampling and decomposition needs but size alone never blocks.
  Split review by independent contracts when one basis changes specification, schema,
  runtime, API, and consumers together.
