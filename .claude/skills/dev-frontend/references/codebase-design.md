# Conditional Codebase Design

Load this reference only when a change or review materially affects a public module/interface, seam placement, cross-caller abstraction, or testability. Repository-native `service`, `API`, `component`, `boundary`, and other established terms remain authoritative; the terms below are reasoning aids, not a mandatory vocabulary migration.

## Evidence Questions

- **Deep module:** does a small public interface hide meaningful behavior, invariants, error modes, ordering, configuration, and lifecycle complexity?
- **Seam:** is this the existing public point where behavior can vary and callers/tests observe it, or is a new seam merely hypothetical?
- **Locality:** does the design keep change, knowledge, failure handling, and verification near one owner instead of scattering them across callers?
- **Leverage:** do several real callers or tests receive useful capability from one stable interface?
- **Deletion test:** if the abstraction disappeared, would its complexity vanish, or would it reappear across real callers? Vanishing complexity usually signals a pass-through layer.
- **Public-interface test:** can behavior be verified through the same interface callers use, without private-state inspection or implementation-coupled mocks?

## Decision Rules

- Prefer the existing repository seam and terminology when they already provide locality and testability.
- Introduce a new shared seam only for real variation, repeated callers, or a proven ownership boundary; one hypothetical alternate implementation is insufficient.
- Deepen or replace a shallow pass-through when evidence shows scattered knowledge; do not add another wrapper layer around it.
- Keep implementation detail private and make required invariants, errors, ordering, and lifecycle visible at the public interface.
- Apply the deletion test before preserving an abstraction and the public-interface test before approving its verification strategy.
