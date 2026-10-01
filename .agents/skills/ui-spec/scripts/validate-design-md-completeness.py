#!/usr/bin/env python3
"""Validate UI Spec shared-authority completeness after official DESIGN.md lint."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import os
import tempfile
import unicodedata
from pathlib import Path
from typing import Any


OFFICIAL_CLI_VERSION = "0.4.0"
OFFICIAL_SPEC_COMMIT = "9bf8eae67128b6cc55ad9bf86665767deb4c11cd"
POLICY_VERSION = "ui-spec-design-completeness/1"
CANONICAL_SECTIONS = (
    "Overview",
    "Colors",
    "Typography",
    "Layout",
    "Elevation & Depth",
    "Shapes",
    "Components",
    "Do's and Don'ts",
)
GROUP_TO_SECTION = {
    "colors": "Colors",
    "typography": "Typography",
    "spacing": "Layout",
    "rounded": "Shapes",
    "components": "Components",
}
REQUIRED_BASE_GROUPS = ("colors", "typography", "spacing", "rounded")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_document_bytes(raw: bytes) -> tuple[list[str], dict[str, str]]:
    text = raw.decode("utf-8")
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        raise ValueError("frontmatter must start on line 1")
    try:
        closing = lines.index("---", 1)
    except ValueError as error:
        raise ValueError("frontmatter closing fence is missing") from error
    headings: list[tuple[str, int]] = []
    in_fence = False
    fence_marker = ""
    for index, line in enumerate(lines[closing + 1 :], start=closing + 1):
        fence = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
        if fence:
            marker = fence.group(1)
            if not in_fence:
                in_fence = True
                fence_marker = marker[0]
            elif marker[0] == fence_marker:
                in_fence = False
                fence_marker = ""
            continue
        if in_fence:
            continue
        match = re.match(r"^##\s+(.+?)\s*#*\s*$", line)
        if match:
            headings.append((match.group(1).strip(), index))
    sections: dict[str, str] = {}
    for offset, (heading, line_index) in enumerate(headings):
        end = headings[offset + 1][1] if offset + 1 < len(headings) else len(lines)
        sections[heading] = "\n".join(lines[line_index + 1 : end]).strip()
    return [heading for heading, _ in headings], sections


def run_official_lint(raw: bytes) -> tuple[dict[str, Any], int, str]:
    temporary = tempfile.TemporaryDirectory()
    root = Path(temporary.name)
    design = root / "DESIGN.md"
    design.write_bytes(raw)
    install = ["npm", "install", "--prefix", str(root), "--ignore-scripts", "--no-audit", "--no-fund", f"@google/design.md@{OFFICIAL_CLI_VERSION}"]
    environment = os.environ.copy()
    environment.setdefault("npm_config_registry", "https://registry.npmjs.org/")
    installed = subprocess.run(install, capture_output=True, text=True, check=False, env=environment)
    if installed.returncode != 0:
        temporary.cleanup()
        raise RuntimeError(f"official parser install failed: {installed.stderr.strip()}")
    runner = root / "parse.mjs"
    runner.write_text("""
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const modulePath = process.argv[2];
const designPath = process.argv[3];
const { lint } = await import(pathToFileURL(modulePath));
const report = lint(fs.readFileSync(designPath, 'utf8'));
const model = report.designSystem;
const keys = value => Object.fromEntries([...value.keys()].map(key => [key, true]));
console.log(JSON.stringify({
  findings: report.findings,
  summary: report.summary,
  parsed: {
    name: model.name,
    description: model.description,
    omitted: model.omitted || [],
    colors: keys(model.colors),
    typography: keys(model.typography),
    spacing: keys(model.spacing),
    rounded: keys(model.rounded),
    components: keys(model.components)
  }
}));
""", encoding="utf-8")
    module_path = root / "node_modules" / "@google" / "design.md" / "dist" / "linter" / "index.js"
    command = ["node", str(runner), str(module_path), str(design)]
    completed = subprocess.run(command, capture_output=True, text=True, check=False, env=environment)
    temporary.cleanup()
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        detail = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"official lint output was not JSON: {detail}") from error
    errors = payload.get("summary", {}).get("errors")
    status = 0 if completed.returncode == 0 and errors == 0 else 1
    return payload, status, f"@google/design.md@{OFFICIAL_CLI_VERSION} lint(bytes snapshot)"


def omission_map(frontmatter: dict[str, Any], errors: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    omitted = frontmatter.get("omitted", [])
    if not isinstance(omitted, list):
        errors.append("omitted must be a list")
        return result
    for index, entry in enumerate(omitted):
        if isinstance(entry, str):
            errors.append(f"omitted[{index}] must be an object with section and reason")
            continue
        if not isinstance(entry, dict):
            errors.append(f"omitted[{index}] must be an object")
            continue
        section = entry.get("section")
        reason = entry.get("reason")
        if section not in GROUP_TO_SECTION:
            errors.append(f"omitted[{index}].section is not a governed token group")
            continue
        if not isinstance(reason, str) or len(reason.strip()) < 12:
            errors.append(f"omitted.{section} requires a concrete non-empty reason")
            continue
        if section in result:
            errors.append(f"omitted.{section} is duplicated")
            continue
        result[section] = reason.strip()
    return result


def meaningful_prose(content: str) -> bool:
    without_fences = narrative_content(content)
    without_markup = re.sub(r"`[^`]*`|[*_#>|\-]", " ", without_fences)
    words = re.findall(r"[\w\u3400-\u9fff]+", without_markup, flags=re.UNICODE)
    return len("".join(words)) >= 40 and len(words) >= 8 and len({word.casefold() for word in words}) >= 4


def narrative_content(content: str) -> str:
    return re.sub(r"```.*?```|~~~.*?~~~", " ", content, flags=re.DOTALL)


def normalized_identity(value: str | None) -> str:
    return unicodedata.normalize("NFKC", value or "").strip().casefold()


def evaluate_document(
    path: Path,
    *,
    stage: str,
    shared_components: str,
    source_ref: str,
    source_artifact: Path,
    source_sha256: str,
    source_status: str,
    approval_design_sha256: str | None,
    approved_by: str | None,
    proposer: str | None,
    implementer: str | None,
    official_lint: dict[str, Any],
    official_status: int,
    lint_command: str,
    design_bytes: bytes | None = None,
    approval_record: Path | None = None,
    approval_record_sha256: str | None = None,
    source_bytes: bytes | None = None,
    approval_record_bytes: bytes | None = None,
) -> dict[str, Any]:
    raw = design_bytes if design_bytes is not None else path.read_bytes()
    design_hash = hashlib.sha256(raw).hexdigest()
    summary = official_lint.get("summary", {}) if isinstance(official_lint, dict) else {}
    lint_errors = summary.get("errors") if isinstance(summary, dict) else None
    format_valid = official_status == 0 and lint_errors == 0
    errors: list[str] = []
    token_groups: list[str] = []
    omissions: dict[str, str] = {}

    if not format_valid:
        errors.append("official DESIGN.md format lint did not pass")
    try:
        headings, sections = parse_document_bytes(raw)
        frontmatter = official_lint.get("parsed", {})
        if not isinstance(frontmatter, dict):
            raise ValueError("official parser did not return structured DESIGN data")
    except (OSError, UnicodeError, ValueError) as error:
        frontmatter, headings, sections = {}, [], {}
        errors.append(str(error))

    if headings != list(CANONICAL_SECTIONS):
        errors.append("H2 sections must be the eight canonical headings in canonical order")

    omissions = omission_map(frontmatter, errors)
    for field in ("name", "description"):
        value = frontmatter.get(field)
        if not isinstance(value, str) or not value.strip() or "replace with" in value.lower():
            errors.append(f"frontmatter {field} must replace the starter placeholder")
    for section_name in CANONICAL_SECTIONS:
        if not meaningful_prose(sections.get(section_name, "")):
            errors.append(f"{section_name} requires non-placeholder application semantics")

    governed_groups = list(REQUIRED_BASE_GROUPS) + ["components"]
    for group in governed_groups:
        value = frontmatter.get(group)
        has_tokens = isinstance(value, dict) and bool(value)
        is_omitted = group in omissions
        if has_tokens and is_omitted:
            errors.append(f"{group} cannot contain tokens and be omitted")
        elif not has_tokens and not is_omitted:
            errors.append(f"{group} requires machine tokens or omitted+reason")
        elif has_tokens:
            token_groups.append(group)

        section_name = GROUP_TO_SECTION[group]
        content = sections.get(section_name, "")
        if has_tokens:
            keys = [str(key) for key in value.keys()]
            prose = narrative_content(content)
            missing_keys = [key for key in keys if f"`{key}`" not in prose]
            if missing_keys:
                errors.append(f"{section_name} must bind prose to every `{group}` token name: {', '.join(missing_keys)}")
        elif is_omitted and omissions[group] not in content:
            errors.append(f"{section_name} must repeat the reviewed omitted reason verbatim")

    if shared_components == "present" and "components" not in token_groups:
        errors.append("shared component consumers exist, so component token entries are required")
    if shared_components == "unknown" and "components" in omissions:
        errors.append("component omission requires proving that no shared component consumer exists")

    if not source_ref.strip():
        errors.append("approved visual/source evidence ref is required")
    if not SHA256_RE.fullmatch(source_sha256):
        errors.append("approved visual/source evidence SHA-256 is required")
    try:
        artifact = source_bytes if source_bytes is not None else source_artifact.read_bytes()
        artifact_hash = hashlib.sha256(artifact).hexdigest()
    except OSError as error:
        artifact_hash = None
        errors.append(f"approved visual/source evidence artifact is unreadable: {error}")
    if artifact_hash is not None and artifact_hash != source_sha256:
        errors.append("approved visual/source evidence SHA-256 must match source artifact bytes")
    if source_status not in {"approved", "verified-authority"}:
        errors.append("exact token values require an approved source or verified authority")
    if stage == "adopted":
        record: dict[str, Any] = {}
        try:
            if approval_record is None:
                raise ValueError("approval record is required")
            record_bytes = approval_record_bytes if approval_record_bytes is not None else approval_record.read_bytes()
            if hashlib.sha256(record_bytes).hexdigest() != approval_record_sha256:
                raise ValueError("approval record SHA-256 must match record bytes")
            record = json.loads(record_bytes)
            if not isinstance(record, dict):
                raise ValueError("approval record must be an object")
        except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
            errors.append(f"verifiable approval record is required: {error}")
        approval_design_sha256 = record.get("design_sha256")
        approved_by = record.get("approved_by_id")
        proposer = record.get("proposer_id")
        implementer = record.get("implementer_id")
        if record.get("status") != "approved" or approval_design_sha256 != design_hash:
            errors.append("human approval record must bind the exact current DESIGN.md SHA-256")
        identities = tuple(normalized_identity(value) for value in (approved_by, proposer, implementer))
        if not all(identities):
            errors.append("approval record requires stable approver, proposer, and implementer identities")
        elif len(set(identities)) != 3:
            errors.append("human approver, proposer, and implementer identities must be distinct")

    ready = not errors
    completeness_status = (
        "awaiting-trusted-approval-verification" if ready and stage == "adopted" else
        "ready-for-human-approval" if ready else
        "not-ready"
    )
    return {
        "design_path": str(path),
        "design_sha256": design_hash,
        "official_format": {
            "status": "valid" if format_valid else "invalid",
            "spec_commit": OFFICIAL_SPEC_COMMIT,
            "cli_version": OFFICIAL_CLI_VERSION,
            "command": lint_command,
            "result": summary,
        },
        "shared_authority_completeness": {
            "policy_version": POLICY_VERSION,
            "stage": stage,
            "status": completeness_status,
            "token_groups": sorted(token_groups),
            "omitted_reasons": omissions,
            "shared_components": shared_components,
            "source_ref": source_ref,
            "source_artifact": str(source_artifact),
            "source_sha256": source_sha256,
            "source_status": source_status,
            "approval_design_sha256": approval_design_sha256,
            "approval_record": str(approval_record) if approval_record else None,
            "approval_record_sha256": approval_record_sha256,
            "approved_by": approved_by,
            "proposer": proposer,
            "implementer": implementer,
            "errors": errors,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("design", type=Path)
    parser.add_argument("--stage", choices=("candidate", "adopted"), required=True)
    parser.add_argument(
        "--shared-components", choices=("present", "absent", "unknown"), required=True
    )
    parser.add_argument("--source-ref", required=True)
    parser.add_argument("--source-artifact", type=Path, required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument(
        "--source-status", choices=("approved", "verified-authority"), required=True
    )
    parser.add_argument("--approval-record", type=Path)
    parser.add_argument("--approval-record-sha256")
    args = parser.parse_args()
    try:
        design_bytes = args.design.read_bytes()
        source_bytes = args.source_artifact.read_bytes()
        approval_bytes = args.approval_record.read_bytes() if args.approval_record else None
        lint, lint_status, command = run_official_lint(design_bytes)
        result = evaluate_document(
            args.design,
            stage=args.stage,
            shared_components=args.shared_components,
            source_ref=args.source_ref,
            source_artifact=args.source_artifact,
            source_sha256=args.source_sha256,
            source_status=args.source_status,
            approval_design_sha256=None,
            approved_by=None,
            proposer=None,
            implementer=None,
            official_lint=lint,
            official_status=lint_status,
            lint_command=command,
            design_bytes=design_bytes,
            approval_record=args.approval_record,
            approval_record_sha256=args.approval_record_sha256,
            source_bytes=source_bytes,
            approval_record_bytes=approval_bytes,
        )
        if args.design.read_bytes() != design_bytes:
            raise RuntimeError("DESIGN.md changed during validation; result is stale")
        if args.source_artifact.read_bytes() != source_bytes:
            raise RuntimeError("source artifact changed during validation; result is stale")
        if args.approval_record and args.approval_record.read_bytes() != approval_bytes:
            raise RuntimeError("approval record changed during validation; result is stale")
    except (OSError, RuntimeError) as error:
        print(json.dumps({"status": "not-verified", "error": str(error)}))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if result["shared_authority_completeness"]["status"] == "ready-for-human-approval" else 1


if __name__ == "__main__":
    raise SystemExit(main())
