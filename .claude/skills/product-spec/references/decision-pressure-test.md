# Product Decision Pressure Test

Use this internal phase to turn unresolved, implementation-changing product choices
into confirmed decisions. It is not a public mode or a separate artifact.

## Activation Gate

Activate only when repository evidence leaves a decision that can change at least one
target slice's user behavior, business rules, permission or security boundary, failure
semantics, acceptance result, or slice boundary. Also activate when the user explicitly
asks to stress-test product decisions within the selected scope.

Do not activate for discoverable facts, internal naming, technical planning, selected-
source visual details, harmless preferences, or a slice that already passes its Ready
gate. Resolve facts from authoritative repository sources and route another owner's
decision instead of interviewing the user about it.

## Decision Tree Loop

1. Inventory only material unresolved decisions for the target slices. Connect a
   decision to the later decisions that depend on it; omit hypothetical branches that
   cannot change the requested outcome.
2. Resolve environmental facts before questioning. Surface contradictions between
   current evidence and the proposed behavior, but leave product decisions to the user.
3. Compute the current frontier: unresolved material decisions whose prerequisites are
   settled. Select the decision with the greatest downstream effect; prefer boundaries,
   permissions, failure semantics, and acceptance over local preferences.
4. Ask one bounded question and wait for its answer. Include:
   - why the decision is material now;
   - the user need and verified product constraints or evidence that bound it;
   - the recommended answer and reason;
   - the principal trade-off;
   - the materially different alternative being rejected, when one exists;
   - the affected product slices.
5. Record the answer using the workflow's Confirmed, Assumption, Open Question,
   Rejected, or Deferred state. For a confirmed material choice, retain its context,
   evidence or constraints, reason, principal trade-off, rejected alternative when
   applicable, and affected slice or acceptance result. Link visual authority when
   relevant; do not define visual style, tokens, layout, or motion here. Recompute only
   the affected branches, then select the next frontier decision.
6. Checkpoint a coherent decision group before synthesizing or updating an artifact;
   do not rewrite the specification after every answer.

## Completion And Stop Rules

- Stop for a slice as soon as no unresolved material decision can change its Ready
  result. Do not traverse every conceivable product branch.
- Keep unrelated slices independently Ready. A decision shared by several slices may
  block those slices only; it does not create a package-wide verdict.
- If the user stops or declines a decision, preserve it as Open, Assumption, or
  Deferred as appropriate. Do not invent confirmation or claim shared understanding.
- Do not authorize implementation or a Ready handoff for a slice whose material
  decision remains Open. An explicitly accepted non-material assumption may proceed.
- Stop and route deep shared language or lifecycle ambiguity to `domain-modeling`,
  selected-source visual decisions to `ui-spec`, and technical choices to host
  planning.
