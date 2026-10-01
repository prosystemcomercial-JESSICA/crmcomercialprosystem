# DESIGN.md Contract for UI Spec

## Contents

- [Scope and Source](#scope-and-source)
- [CLI and Version Policy](#cli-and-version-policy)
- [Core Semantics](#core-semantics)
- [Two Independent Results](#two-independent-results)
- [First Creation](#first-creation)
- [Validation Boundary](#validation-boundary)
- [Forgeway Machine Handoff](#forgeway-machine-handoff)

## Scope and Source

- `<design-root>/DESIGN.md` is the canonical shared visual authority for the proven
  shared visual boundary.
- This document defines how this Skill uses the official Google `DESIGN.md` spec and
  the CLI for shared-system changes only.
- Canonical spec snapshot:
  `https://github.com/google-labs-code/design.md/blob/9bf8eae67128b6cc55ad9bf86665767deb4c11cd/docs/spec.md`

## CLI and Version Policy

- Use Node.js + npm CLI package `@google/design.md@0.4.0` only.
- Use one cross-platform command form for all platforms:
  - `npx -p @google/design.md@0.4.0 designmd lint --format json <file>`
  - `npx -p @google/design.md@0.4.0 designmd diff <before> <after>`
  - `npx -p @google/design.md@0.4.0 designmd export --format <format> <file>`
- Do not use the unpinned package name or different versions.
- Review and update the pinned spec snapshot and CLI version together; do not advance one silently.

## Core Semantics

- YAML frontmatter tokens are normative contract values.
- Markdown prose is the application guidance for how those tokens are used.
- Only the resolved `<design-root>/DESIGN.md` can carry long-lived token and component semantics for that boundary.
- Frontmatter `version` is optional. Do not use an edit or approval date as its
  default value; omit it when the project has no semantic version policy.
- Preserve the content of legacy unknown Markdown sections when editing, but move it
  under the matching canonical H2 as H3/body before completeness can pass; do not
  silently delete valid token names or component properties.
- Duplicate section headings fail validation. Keep the package regression guard because
  prior CLI behavior could return zero while reporting the duplicate as a warning.
- Diff compares token-level changes and is the regression gate for shared visual updates.
- For the first accepted DESIGN.md creation, record diff as `Not applicable`; do not invent a before file.
- Lint returns exit code `0` when no errors remain; warnings may exist and still be
  accepted except for duplicate H2, which is always a blocker in this repository.
- Export is only a derived output for approved downstream consumers.

## Two Independent Results

Official lint proves only `official-format-valid`: YAML and Markdown can be parsed and
the official structural rules pass. It never proves that a project has supplied a
complete adopted shared visual authority.

Run `python3 scripts/validate-design-md-completeness.py` after official lint. Its
`ui-spec-design-completeness/1` result is the project policy consumer, not another
token schema. It returns `ready-for-human-approval` for a complete first-adoption
candidate. A local adopted-stage record that binds the exact current DESIGN.md hash
returns `awaiting-trusted-approval-verification`, never `complete`: a local record and
caller-supplied hash cannot prove human identity. A downstream host-trusted approval
receipt bound into the exact Result Package may satisfy `gate:ui-design-complete`;
it does not mutate the producer result. Any policy error is `not-ready`, even when
official lint reports zero. All consumers require that same exact Result Package; a
receipt bound to different bytes or basis is stale and cannot clear the gate.

## First Creation

1. Copy `assets/DESIGN.md` to the resolved `<design-root>`.
2. Replace its name, description, and prose only from verified sources.
3. Fill `colors`, `typography`, `spacing`, and `rounded` with exact approved machine
   tokens, or use official `omitted` objects with a concrete reason for each group.
   When shared component consumers exist, `components` must contain entries; omission
   is allowed only after proving that the boundary has no shared component consumer.
   When shared SVG iconography exists, bind its approved family, canonical geometry,
   rendering/state, coloring strategy, accessibility, owner/rights, and fallback under
   `## Components` as `### Iconography`; do not add a ninth H2 authority section.
4. Keep exactly the eight canonical H2 headings in canonical order. Put project-local
   detail under their H3/body, and bind every token group to application semantics in
   the corresponding section.
5. Treat CSS, theme, and component source only as implementation/source evidence.
   Exact target values require an approved visual or other verifiable source.
6. Run official lint, then the completeness checker with `--source-ref`, the readable
   `--source-artifact`, its exact `--source-sha256`, required `--source-status`, and the
   shared-component fact. A first-adoption candidate may request approval only
   after `ready-for-human-approval`.
7. Obtain a verifiable JSON approval record from someone other than the
   proposer/implementer. It must contain `status: approved`, the exact current
   `design_sha256`, and stable `approved_by_id`, `proposer_id`, and `implementer_id`.
   Rerun adopted stage with `--approval-record` and its exact
   `--approval-record-sha256` to validate the local binding. This stops at
   `awaiting-trusted-approval-verification`; self-reported CLI actor strings and
   applicant-created JSON are not trusted approval evidence.
8. Record diff as `Not applicable` because no accepted before file exists.

## Validation Boundary

- Obtain authorization before any CLI step that downloads a package or uses the network.
- Treat a blocked required CLI step as `Not verified`; do not mark the affected slice `Ready`.
- The checker does not redefine Google token types. It only enforces this Skill's
  adoption completeness, section semantics, source binding, and approval binding.
- Handoff evidence must include design hash, official spec commit, CLI version, format
  lint result, completeness policy version/result, token groups or omitted reasons,
  source/approval binding, and the exact result PackageManifest when integration is
  active. A PackageManifest binds bytes and basis; it does not prove completeness.

## Forgeway Machine Handoff

Use this only when the active delivery consumer declares the compatible contract;
do not create a parallel token schema or copy Forgeway storage/traversal internals.

- Producer capability: `ui.contract.specify@1.1.0`.
- Consumer policy: `forgeway-ui-design-completeness/1` consuming
  `ui-spec-design-completeness/1` and producing claim
  `gate:ui-design-complete`.
- Hand off the exact Result PackageManifest plus package-relative paths for
  `DESIGN.md`, completeness JSON, selected-source artifact, and approval record.
  Record the SHA-256 and byte length of every artifact; all paths must resolve inside
  that package and close against its manifest.
- The trusted approval adapter input binds `design_sha256`, `result_package_id`,
  `completeness_result_sha256`, `approval_record_sha256`, `approved_by_id`,
  `proposer_id`, and `implementer_id`. Its receipt must bind the same design,
  package, completeness result, approval record, and three distinct canonical
  principal IDs.
- The consumer may satisfy the claim only from producer status
  `awaiting-trusted-approval-verification`, exact official spec/CLI/lint evidence,
  the exact completeness policy, token-group or official-omission closure, source
  closure, local approval-record closure, and the host-trusted receipt.
- Fail closed for a candidate `ready-for-human-approval`, format-only or `not-ready`
  result, missing adapter, stale/new package, applicant/local record alone, or any
  hash, length, package, or principal mismatch. Preserve the consumer failure code
  rather than translating it into producer `complete`.
- Real host identity/receipt-adapter execution and a real target DESIGN runtime remain
  `Not verified` until separately exercised.
