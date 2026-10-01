# Frontend Visual Evidence Protocol

Use this protocol when a selected visual source materially controls frontend
appearance or when a review claims visual completion. It joins specification,
implementation, browser evidence, audit, and fixed-basis review without changing
their owners or mutation boundaries.

This reusable protocol, its schema, validator, and committed examples are
project-neutral: they contain no project, brand, page, domain-field,
design-platform, or business defaults. Real source identities, paths, component
names, URLs, copy, data roles, measurements, and approval facts belong only in a
task artifact. A validating example demonstrates structure and evidence semantics;
it never supplies a reusable target contract for a project.

## Contents

- [Owner Gates](#owner-gates)
- [Evidence Levels](#evidence-levels)
- [Selected-Source Freeze](#selected-source-freeze)
- [Delta And Implementation Mapping](#delta-and-implementation-mapping)
- [Two-Pass Runtime Gate](#two-pass-runtime-gate)
- [Required Runtime Coverage](#required-runtime-coverage)
- [Degraded Evidence](#degraded-evidence)
- [Handoff Artifact](#handoff-artifact)
- [Capture Closure And Restoration](#capture-closure-and-restoration)
- [Completion Rule](#completion-rule)

## Owner Gates

- `ui-spec` fixes the selected source, evidence limits, target viewport/state,
  traceable deltas, local-versus-shared ownership, acceptance, and readiness.
- `dev-frontend` maps every applicable acceptance item to source ownership and a
  verification method before editing, preserves correct structure, implements P1
  structure/assets/typography/alignment before P2 polish, and closes two runtime
  comparison passes.
- `ops-browser` captures source/runtime evidence and computed DOM/CSS facts at the
  requested viewport and state. It does not approve a source, change a spec, edit
  code, or decide the final verdict.
- `audit-frontend` uses this evidence for a bounded current-surface visual audit and
  leads with P0-P3 findings. It remains read-only and does not attribute findings to
  a change basis.
- `repo-review` checks the handoff and reachable implementation on its selected
  Worktree or immutable basis, attributes findings to that basis, and decides
  whether a visual-completion claim is supported.

## Evidence Levels

Use exactly these labels:

| Level | Meaning | Allowed claim |
| --- | --- | --- |
| `source-extracted` | Value comes from inspectable design metadata, annotation, local export, or accepted source file. | Exact only with source identifier and location. |
| `browser-computed` | Value comes from rendered DOM geometry, computed style, accessibility tree, or final color calculation at a recorded viewport/state. | Exact for that captured runtime only. |
| `visually-inferred` | Value is estimated from a visible image or side-by-side observation. | Directional comparison, never an exact verified token. |
| `proposed` | Value is a target adaptation not proven by the selected source or current runtime. | Contract candidate requiring named owner approval before implementation. |
| `Not verified` | Required fact or state was not observed with fit evidence. | Gap only; never completion proof. |

Every exact value must cite one or more evidence IDs. A screenshot alone cannot prove
exact CSS, font fallback, contrast, hidden state, responsive behavior, or component
ownership. A source file or SCSS declaration cannot prove the final rendered value.
For design targets, prefer a design tool's selected-element inspect/style panel or an
equivalent source annotation over visual measurement. Current runtime computed styles
prove only the current runtime and must never be copied into the selected-source or
target-contract column merely because the page looks close.

## Selected-Source Freeze

Before a visual contract or implementation starts, record:

- stable source identity, revision or image/frame ID, approval state and approver;
- rights/use boundary, redistribution status, explicit `use` and `ignore` scopes;
- target viewport dimensions, page/component state, locale, theme, zoom, and any
  scroll position that changes the visible comparison;
- available design evidence and its limitations;
- current runtime URL/surface and matching state when a runtime already exists.

Capture the selected source and current runtime in the same evidence round whenever
both exist. They must use the same target viewport and state for comparison. A crop
or scaled browser screenshot must record its transform and cannot silently become a
same-viewport artifact.

If the source cannot be viewed, approval is absent, a material state/viewport is
uncertain, or rights are insufficient, stop the affected visual slice. Do not
implement from a prose summary alone.

When a design element cannot be selected or inspected, a 200% visual check may help
compare alignment and hierarchy. Record it as `visually-inferred`; keep exact values
`proposed` or `Not verified`. Zooming a screenshot does not promote it to
`source-extracted` evidence.

## Delta And Implementation Mapping

The UI contract must include a delta table with one row per material difference:

| Field | Requirement |
| --- | --- |
| `acceptance_id` | Stable ID shared by spec, implementation, evidence, and review. |
| selected source | Value plus traceable evidence IDs. |
| current runtime | Value plus traceable evidence IDs or `Not verified`. |
| target contract | Exact accepted value or explicitly `proposed` value with approval. |
| priority | P0-P3 from user impact and blocking order. |
| owner | Shared `DESIGN.md` owner or page/component-local owner. |
| validation | Observable comparison, computed check, state, and viewport. |

Keep selected-source target and current-runtime values in separate columns even when
they happen to match. Never summarize current dimensions as an "already aligned" or
"safe to preserve" design target until independent selected-source evidence supports
the same value.

Do not change shared `DESIGN.md` tokens for a single-page adaptation. Use shared
authority only when shared semantics, reusable component contracts, or cross-surface
rules actually change.

Before editing, `dev-frontend` must map each applicable `acceptance_id` to:

- owner file and component/symbol;
- `reuse`, `extend`, `wrap`, or justified `new`;
- affected asset/data owner;
- focused static check and runtime verification method.

Pause implementation when the selected source is unavailable, the slice verdict is
`Partial` or `Not Ready`, a P1 asset is missing without an accepted per-item fallback,
or target viewport/state is unresolved. Preserve already-correct layout and ownership;
do not replace a working page wholesale to close local visual deltas.

## Two-Pass Runtime Gate

After implementation, perform at least two closed comparison passes:

1. capture selected source and implementation at the same viewport/state; create a
   reviewable side-by-side, overlay, or deterministic diff; read applicable computed
   styles and DOM geometry; record findings;
2. fix confirmed findings; repeat the same capture and computed checks; record the
   post-fix verdict.

Additional passes are allowed, but pass 2 cannot be replaced by a static re-read. Keep
the design capture and implementation capture independently inspectable even when an
overlay/diff is produced. Record tool, viewport, state, zoom, scroll position, artifact
path/ID, and evidence limitations for every capture.

Whole-image RMSE, pixel similarity, perceptual distance, or another aggregate image
metric is diagnostic only. It may help locate drift but cannot independently pass or
fail the visual gate; critical states, assets, accessibility, computed styles, and
geometry require their own contract-bound checks. A numeric tolerance comes from the
accepted slice contract or baseline and is never inferred as a universal pixel rule.

## Required Runtime Coverage

Record each category as `verified`, `failed`, `Not verified`, or `not-applicable`, with
evidence IDs and a reason:

- real per-item assets and isolated fallback behavior;
- actual font inheritance and fallback, including native controls;
- truncation/wrapping/localization behavior;
- final composited foreground/background contrast;
- cross-section and main/sidebar alignment;
- card/control dimensions and hit areas;
- hover and visible keyboard focus;
- applicable loading, empty, error, permission, and disabled states;
- responsive behavior at the desktop target and every key breakpoint named by the
  slice contract.

Freeze those required viewport/state pairs in `required_runtime_matrix` before runtime
acceptance. Each target has a stable ID and a canonical fingerprint of its viewport and
state. `responsive_breakpoints: verified` requires distinct browser-computed evidence
for every frozen target; repeating one viewport does not cover another breakpoint.
Matrix evidence must bind its target ID, viewport/state/fingerprint, and task-owned
artifact bytes. The ordinary two-pass selected-source comparison may satisfy one matrix
target; additional breakpoints use separately artifact-bound matrix evidence.

Generic placeholders are not normal product assets. A fallback may cover one missing
or failed item only when the contract permits it; it must not replace all product
logos, thumbnails, covers, or QR codes.

Build, lint, typecheck, tests, source scans, or DESIGN.md lint do not satisfy the
runtime visual gate. They remain independent evidence.

## Degraded Evidence

When design collaboration tools block original export, local-network access, CORS, or
resource download:

1. retain the failed capability and exact limitation as evidence;
2. use only authorized visible screenshots, local exports, annotations, or supplied
   assets that remain available;
3. downgrade unsupported claims to `visually-inferred` or `Not verified`;
4. never switch silently to another visual source or call the unavailable original
   asset verified.

Browser work must preserve user state. Record initial tab, viewport, zoom, scroll, and
target identity; restore user-owned tabs to their prior viewport/scroll where possible,
close task-only tabs, and leave one explicitly identified delivery tab/artifact in an
inspectable state when requested.

## Handoff Artifact

Use `frontend-visual-evidence/v1`. The package-local
`assets/frontend-visual-evidence.schema.json` is the machine-checkable contract. The
artifact is task evidence and defaults to a verified ignored
`.codex/artifacts/ui-<slice-id>/` location. Do not link it from durable UI indexes or
commit it under formal docs merely because it validates. Durable publication needs a
named team consumer, accessible source artifacts, schema/validator, drift policy,
revalidation owner, and retirement condition. Capture timestamps remain valid inside
the evidence artifact; they do not require dates or date-based versions in the UI
spec. The
artifact has a required `stage` and advances without inventing future evidence:

| Stage | Producer and allowed closure |
| --- | --- |
| `spec-ready` | `ui-spec`: selected source, evidence, deltas, and readiness only. No implementation/runtime/final fields. |
| `mapped` | `dev-frontend` before editing: adds complete implementation mapping. No visual-review/final fields. |
| `pass-1` | `dev-frontend` plus `ops-browser`: adds exactly one qualifying comparison pass. No runtime-coverage/final verdict. |
| `final` | `dev-frontend` after pass 2: adds two or more passes, runtime coverage, and final verdict for review. |

`Ready` requires an approved selected source and an empty blocker list. `Partial`
or `Not Ready` requires at least one explicit blocker and may exist only at
`spec-ready`; `mapped`, `pass-1`, and `final` require `Ready`. A producer must not
self-declare readiness to bypass pending, rejected, or unverified source approval.

Across its stages the artifact contains:

- selected-source freeze and evidence inventory;
- traceable delta rows;
- acceptance-to-owner implementation mapping;
- two or more runtime review passes;
- required runtime coverage;
- findings, fixed items, remaining gaps, `Not verified`, and final verdict.

Validate from an installed package without network or third-party Python modules:

```bash
python3 scripts/validate-frontend-visual-evidence.py <artifact.json>
```

The package-local validator applies the JSON Schema plus cross-reference, stage,
viewport/state, evidence-level, and completion semantics. Validity does not prove the
truth of evidence or UI quality. Reviewers must still inspect cited artifacts and
reachable source.

Every delta comparison value must cite evidence matching its declared evidence level;
selected-source and target-contract columns cannot cite `browser-computed` evidence as
their authority. Each computed check and each `verified` runtime coverage record must
cite final-pass browser evidence tagged with the same runtime category, viewport, and
state. One geometry observation cannot satisfy assets, font, contrast, focus, states,
or responsive coverage.

## Capture Closure And Restoration

`Complete` additionally requires `capture_closure`. It is a generic evidence
closure, not a product, page, or design-platform schema. For every design and
runtime capture in every comparison pass, it records the capture ID, pass, role,
artifact locator, manifest SHA-256, content-summary SHA-256, viewport, state, and
target fingerprint. The capture fields in the review and every browser-computed
evidence item for that runtime pass MUST match that closure record exactly.

Each closure record carries an embedded canonical `capture_manifest` and
`content_summary`; their SHA-256 values are computed from UTF-8 JSON with sorted
keys and compact separators, not accepted as caller-supplied labels. The manifest
must restate the capture ID/pass/role/artifact/artifact SHA-256/byte length/
viewport/state/target fingerprint; the summary must restate the capture ID,
artifact, artifact SHA-256, and byte length. The same hash and length MUST appear
in the visual-review capture, its browser-computed evidence, and the canonical
final restoration receipt. Artifact locators MUST use
the task-owned `artifact://task/<task_id>/...` namespace. This protocol does not
read arbitrary local paths: a missing or unparsable embedded record fails closed.
The target fingerprint is the same canonical SHA-256 computation over exactly
`viewport` and `state`, so a changed target with an old fingerprint is invalid.

For `Complete`, `artifact_contents` is the validator's only controlled resolver:
each task-owned locator maps to embedded base64 bytes. Every closed capture records
the SHA-256 and byte length of those resolved bytes; replacing bytes while retaining
the locator fails validation. Updating only a local capture record's hash/length
without regenerating its manifest, summary, browser evidence, and receipt also
fails. The validator never resolves filesystem paths, URLs, or a locator outside
that task namespace.

The closure target viewport, state, and fingerprint MUST match every closed
capture. A stale or substituted screenshot, structured evidence record, document,
or content summary therefore cannot be combined with another pass to claim
completion. A target viewport/state/fingerprint mismatch is a closure failure, not
a visual exception.

`restoration_receipts` preserves prior restoration records as `superseded` when
needed, but exactly one receipt may have status `final`. Its ID MUST equal
`canonical_final_receipt_id` and it MUST bind the final runtime capture's pass,
target fingerprint, manifest SHA-256, and content-summary SHA-256. Old or
conflicting final receipts cannot jointly establish a final state.
The canonical final receipt also binds a non-empty operation ID, the raw
pre-capture browser state (`tab_id`, URL, viewport, and scroll), explicitly
authorized restoration actions, and a post-operation readback in that same
structure. The post-operation browser state MUST equal `before_state` exactly;
the capture target viewport/state is evidence context, not the restoration target.
Its canonical SHA-256 is recomputed after excluding the hash field itself; a
receipt cannot establish finality by merely repeating a pass number.

## Completion Rule

Visual completion requires all of:

1. accepted source identity and traceable target contract;
2. complete implementation mapping for applicable acceptance items;
3. two same-viewport/state runtime comparison passes;
4. computed geometry/style evidence for applicable exact claims;
5. desktop target plus every specified key breakpoint exercised;
6. no unresolved P0/P1 finding and no required category marked `failed` or
   `Not verified`.

A `Complete` artifact additionally requires an approved source, `Ready` readiness,
final-pass `browser-computed` evidence matching the pass viewport/state for every
verified runtime category, a passing final review, empty remaining-gap and
`not_verified` lists, closure of every P0/P1 finding, a consistent capture closure,
and one canonical final restoration receipt.

Otherwise report `Partial` or `Not Ready`. Final reporting lists fixed items, remaining
deltas, `Not verified`, changed files, evidence artifacts, validation, branch/commit,
and Worktree state.
