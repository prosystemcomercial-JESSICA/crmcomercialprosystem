# Evidence-Gated Code Quality

Use this reference when a review, audit, or implementation task materially
involves duplication, dead or unused code, abstraction quality, dependency
direction, hidden coupling, or maintainability. Repository rules and actual
language/framework semantics remain authoritative.

## Contents

- [Stage Semantics](#stage-semantics)
- [Finding Gate](#finding-gate)
- [Quality Decisions](#quality-decisions)
- [Signals That Need More Evidence](#signals-that-need-more-evidence)
- [Scope And Reporting](#scope-and-reporting)

## Stage Semantics

Apply the same quality principle with the owner-specific meaning:

- **Fixed-basis review:** determine whether the selected Worktree, index, SHA,
  range, or package introduces, expands, exposes, or directly depends on the
  issue. Do not attribute unchanged repository debt to the basis.
- **Bounded audit:** determine what currently exists inside the declared audit
  scope. Do not claim that an unexamined change introduced it or that the whole
  repository is clean.
- **Implementation:** avoid introducing the issue and remove only obsolete or
  redundant code made unnecessary by the authorized change. Existing cleanup
  outside the affected surface requires explicit scope.

## Finding Gate

Treat a smell, tool warning, metric, or external recommendation as an
investigation signal. Report a finding only when all applicable evidence is
present:

1. **Reachability or material relevance:** identify the build, runtime,
   maintenance, public-contract, test, or deployment path that makes it matter.
2. **Concrete impact:** state the correctness, divergence, security,
   performance, ownership, debugging, compatibility, or verification cost.
3. **Precise owner and location:** name the files, symbols, declarations,
   configuration keys, or producer/consumer edge.
4. **Attribution:** distinguish newly introduced, expanded, exposed,
   pre-existing-but-blocking, and merely pre-existing issues.
5. **Verification:** provide a lint/type/build/test/runtime command, reference
   search, generated-artifact comparison, or other falsifiable check.

Style-only preference, visual similarity, or a request to make code resemble an
external repository does not satisfy this gate.

## Quality Decisions

### Duplication And Competing Authorities

Report duplication when at least one of these is demonstrated:

- one fact, rule, schema, state transition, configuration value, or error mapping
  must be updated in multiple owners;
- copies have already diverged or can take different reachable paths;
- the duplication bypasses an established source of truth or generated contract;
- the same fix must be repeated across real consumers with material omission
  risk.

Do not require extraction for two short similar blocks, intentionally independent
deployment units, generated code, or code whose shared abstraction would couple
unrelated change reasons. Prefer the existing authority; create a shared owner
only after proving stable responsibility and real consumers.

### Unused And Dead Code

Use repository-defined compiler, linter, type, tree-shaking, coverage, or
reference evidence, then account for language and framework reachability. Check
public exports, conditional compilation, features, targets, macros, reflection,
code generation, dynamic imports, file-system routes, framework registration,
tests, examples, migrations, and external consumers before declaring code dead.

Remove items made obsolete by the authorized change. Do not delete uncertain
compatibility paths or public surfaces from text-search absence alone.

### Abstractions And Layers

An abstraction earns its cost when it enforces an invariant, stabilizes a public
or third-party boundary, isolates platform variation, owns policy or lifecycle,
reduces demonstrated coordinated change, or creates a necessary verification,
authorization, or observability seam.

Report speculative abstraction or over-design only when the extra interface,
genericity, configuration, indirection, or future capability lacks a current
requirement and creates concrete navigation, modification, testing, runtime, or
compatibility cost. A single implementation is not sufficient proof that a
trait/interface is unnecessary.

Report a pass-through layer only when it adds no validation, transformation,
policy, error mapping, lifecycle, caching, instrumentation, compatibility,
platform isolation, or stable boundary and measurably increases change or debug
cost.

### Hidden Coupling

Name both sides of the coupling, the implicit ordering/configuration/state or
data-shape contract, how it propagates, and the reachable failure when it drifts.
Do not report generic "high coupling" without an owner pair and violated
boundary.

## Signals That Need More Evidence

Do not turn these into findings by themselves:

- file, function, component, parameter, or dependency counts;
- a single wrapper, helper, trait, interface, hook, watcher, context, store,
  `clone`, `Arc`, `Mutex`, memoization call, or dynamic import;
- a linter's optional, pedantic, nursery, or restriction-class suggestion;
- bundle/chunk size without a target, workload, route, or user-impact baseline;
- difference from a popular repository, Skill, style guide, or architecture
  template that the target repository has not adopted.

Load the applicable language or framework profile before deciding whether the
signal is reachable, correct, redundant, or intentionally owned.

## Scope And Reporting

- Match conclusions to inspected paths, feature/target combinations, runtime
  surfaces, and commands.
- Consolidate symptoms that share one root cause; do not inflate finding counts.
- Use severity from concrete impact and urgency, not aesthetic dislike or code
  size.
- Mark unavailable dynamic registration, external consumers, runtime behavior,
  performance measurements, or feature combinations `Not verified`.
