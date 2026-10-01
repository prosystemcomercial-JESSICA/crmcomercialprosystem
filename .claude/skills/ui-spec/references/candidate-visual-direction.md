# Candidate Visual Direction

Load this reference only before a visual direction has human approval and the user
wants local artifacts to drive image-based exploration.

## Source Grounding Gate

Read effective guidance, product authorities, current routes/pages, state/data owners,
shared components, styling/theme owners, and the actual UI-library imports or wrappers.
Record:

- real product purpose, page/flow scope, data, actions, states, and exclusions;
- current reusable and page-defining components plus their source owners;
- current icon library/wrapper and asset owners, semantic roles, rights, family/style,
  SVG requirement, and any approved fallback;
- verified framework/library mappings, such as an existing wrapper to its Ant Design
  primitive, and every mapping that remains `proposed` or `Not verified`;
- accepted current shared semantics and implementation constraints;
- visual references with rights, `use`, `ignore`, viewport, theme, locale, and state.

A concept image may suggest hierarchy or composition. It cannot add a route, feature,
metric, action, state, dependency, or component that current product/source evidence
does not support. Put unsupported visible ideas in `ignore`, not the product contract.

## Local Candidate Pair

Use the repository's established ignored reviews convention under `.codex/reviews/`.
Before writing, verify the parent with `git check-ignore -q <path>` or the repository's
equivalent; stop before placing unfinished work in a tracked formal-doc location.
Maintain exactly one current pair for the candidate revision:

1. a candidate UI specification owning all current design decisions;
2. a complete, self-contained image-generation prompt derived from that specification.

The candidate specification records status/revision, human owner, source basis,
product boundaries, `use`/`ignore`, design direction, source-backed component/library
mapping, foundations, surface composition, default state, separate interaction states,
responsive/accessibility rules, applicable SVG icon role/style constraints, generation
acceptance, and `Not Ready` gaps. Use
project-native filenames; do not require a schema or a universal template.

The prompt repeats the whole current generation request in one artifact: output count
and format, exact viewport/theme/locale/default state, real product content and
exclusions, layout, current component/library mapping, visual semantics, applicable
interaction-state constraints, icon semantics and visual family without inventing
SVG paths, accessibility/craft requirements, and strong negative
constraints. It must be usable without reading prior external conversation.

## Revision Order And Identity

For every visual adjustment:

1. edit the candidate specification first;
2. replace the prompt with a complete representation of that exact revision;
3. verify both resolved paths remain inside the repository and are ignored;
4. compute and record both content hashes after the edits;
5. hand the full current prompt and frozen input identities to the next owner once.

Do not append a correction only in an external conversation. Do not send a delta
prompt, rely on chat history, or reuse an older hash. If either local artifact changes,
the previous handoff is stale and must not be represented as the current revision.

`ui-spec` stops after preparing and fingerprinting the pair. Route image generation or
visual exploration to the host Product Design/image capability. When the user names an
external provider/model or authorizes an external send, route transport, provider
identity, operation idempotency, and output attribution to `ask-ai`; never send from
this Skill.

## Result And Promotion Gate

An external output is exploratory evidence only. Record its provider attribution,
output identity/hash when available, prompt hash, observed viewport/state, and local
review findings. It is not a product fact, accepted specification, implementation
proof, browser verification, or approval.

Only explicit named human approval bound to the selected output and candidate hashes
promotes the direction. After approval:

- reconcile only approved shared visual semantics into the resolved adopted
  `<design-root>/DESIGN.md` and run its required approval/lint/diff gates;
- keep page-local composition, behavior, and interaction in the independent Feature
  Spec rather than expanding `DESIGN.md`;
- hand the accepted source and Feature Spec to `dev-frontend`;
- require same-viewport, same-state real-browser acceptance through the runtime owner.

Until promotion completes, report `Candidate direction: Not Ready for dev-frontend`
and `DESIGN.md unchanged`.
