#!/usr/bin/env python3
"""Validate a frontend-visual-evidence/v1 JSON artifact offline."""

from __future__ import annotations

import argparse
import base64
import binascii
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


def default_schema() -> Path:
    script = Path(__file__).resolve()
    package_schema = script.parent.parent / "assets" / "frontend-visual-evidence.schema.json"
    if package_schema.is_file():
        return package_schema
    return script.parents[1] / "protocols" / "frontend-visual-evidence-v1.schema.json"


def _resolve_ref(root: dict[str, Any], ref: str) -> dict[str, Any]:
    if not ref.startswith("#/"):
        raise ValueError(f"unsupported non-local schema reference: {ref}")
    value: Any = root
    for part in ref[2:].split("/"):
        key = part.replace("~1", "/").replace("~0", "~")
        if not isinstance(value, dict) or key not in value:
            raise ValueError(f"unresolved schema reference: {ref}")
        value = value[key]
    if not isinstance(value, dict):
        raise ValueError(f"schema reference is not an object: {ref}")
    return value


def _type_matches(value: Any, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "null":
        return value is None
    raise ValueError(f"unsupported schema type: {expected}")


def schema_errors(
    value: Any,
    schema: dict[str, Any],
    root: dict[str, Any] | None = None,
    path: str = "$",
) -> list[str]:
    root = schema if root is None else root
    if "$ref" in schema:
        return schema_errors(value, _resolve_ref(root, schema["$ref"]), root, path)

    errors: list[str] = []
    if "allOf" in schema:
        for index, item in enumerate(schema["allOf"]):
            errors.extend(schema_errors(value, item, root, f"{path}.allOf[{index}]"))
    if "anyOf" in schema:
        variants = [schema_errors(value, item, root, path) for item in schema["anyOf"]]
        if all(variant for variant in variants):
            errors.append(f"{path}: must match at least one anyOf branch")
    if "oneOf" in schema:
        matches = sum(not schema_errors(value, item, root, path) for item in schema["oneOf"])
        if matches != 1:
            errors.append(f"{path}: must match exactly one oneOf branch")
    if "not" in schema and not schema_errors(value, schema["not"], root, path):
        errors.append(f"{path}: matches forbidden schema")
    if "if" in schema and not schema_errors(value, schema["if"], root, path):
        errors.extend(schema_errors(value, schema.get("then", {}), root, path))

    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: must equal {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: value is not in enum {schema['enum']!r}")

    expected_type = schema.get("type")
    if expected_type is not None and not _type_matches(value, expected_type):
        errors.append(f"{path}: expected {expected_type}")
        return errors

    if isinstance(value, dict):
        required = schema.get("required", [])
        for name in required:
            if name not in value:
                errors.append(f"{path}: missing required property {name!r}")
        properties = schema.get("properties", {})
        for name, child in properties.items():
            if name in value:
                errors.extend(schema_errors(value[name], child, root, f"{path}.{name}"))
        if schema.get("additionalProperties") is False:
            for name in sorted(set(value) - set(properties)):
                errors.append(f"{path}: unexpected property {name!r}")

    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path}: needs at least {schema['minItems']} items")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: allows at most {schema['maxItems']} items")
        if schema.get("uniqueItems"):
            normalized = [json.dumps(item, sort_keys=True, ensure_ascii=False) for item in value]
            if len(normalized) != len(set(normalized)):
                errors.append(f"{path}: items must be unique")
        prefixes = schema.get("prefixItems", [])
        for index, child in enumerate(prefixes):
            if index < len(value):
                errors.extend(schema_errors(value[index], child, root, f"{path}[{index}]"))
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index in range(len(prefixes), len(value)):
                errors.extend(schema_errors(value[index], item_schema, root, f"{path}[{index}]"))

    if isinstance(value, str) and len(value) < schema.get("minLength", 0):
        errors.append(f"{path}: string is shorter than {schema['minLength']}")
    if isinstance(value, str) and "pattern" in schema and re.search(schema["pattern"], value) is None:
        errors.append(f"{path}: does not match pattern {schema['pattern']!r}")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: must be >= {schema['minimum']}")
        if "exclusiveMinimum" in schema and value <= schema["exclusiveMinimum"]:
            errors.append(f"{path}: must be > {schema['exclusiveMinimum']}")
    return errors


def semantic_errors(payload: dict[str, object]) -> list[str]:
    errors: list[str] = []
    stage = payload.get("stage")
    source = payload.get("selected_source", {})
    approval = source.get("approval", {}) if isinstance(source, dict) else {}
    approval_status = approval.get("status") if isinstance(approval, dict) else None
    readiness = payload.get("readiness", {})
    readiness_status = readiness.get("status") if isinstance(readiness, dict) else None
    blockers = readiness.get("blockers", []) if isinstance(readiness, dict) else []
    if readiness_status == "Ready":
        if approval_status != "approved":
            errors.append("Ready readiness requires an approved selected source")
        if blockers:
            errors.append("Ready readiness requires an empty blockers list")
    elif readiness_status in {"Partial", "Not Ready"} and not blockers:
        errors.append(f"{readiness_status} readiness requires at least one blocker")
    if stage in {"mapped", "pass-1", "final"} and readiness_status != "Ready":
        errors.append(f"stage {stage} requires Ready implementation readiness")
    evidence = payload.get("evidence", [])
    evidence_ids = [item.get("id") for item in evidence if isinstance(item, dict)]
    known_evidence = {item for item in evidence_ids if isinstance(item, str)}
    evidence_by_id = {
        item["id"]: item
        for item in evidence
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    if len(evidence_ids) != len(known_evidence):
        errors.append("evidence IDs must be unique")

    runtime_matrix = payload.get("required_runtime_matrix", [])
    matrix_by_id: dict[str, dict[str, object]] = {}
    matrix_targets: set[str] = set()
    for target in runtime_matrix if isinstance(runtime_matrix, list) else []:
        if not isinstance(target, dict) or not isinstance(target.get("id"), str):
            continue
        target_id = target["id"]
        target_key = json.dumps(
            {"viewport": target.get("viewport"), "state": target.get("state")},
            sort_keys=True,
            separators=(",", ":"),
        )
        if target_id in matrix_by_id:
            errors.append("required runtime matrix IDs must be unique")
        if target_key in matrix_targets:
            errors.append("required runtime matrix viewport/state targets must be unique")
        matrix_by_id[target_id] = target
        matrix_targets.add(target_key)
        if target.get("target_fingerprint") != _canonical_sha256(
            {"viewport": target.get("viewport"), "state": target.get("state")}
        ):
            errors.append(f"required runtime matrix target {target_id} has a stale fingerprint")

    deltas = payload.get("delta_table", [])
    delta_ids = [item.get("acceptance_id") for item in deltas if isinstance(item, dict)]
    mappings = payload.get("implementation_mapping", [])
    mapping_ids = [item.get("acceptance_id") for item in mappings if isinstance(item, dict)]
    if len(delta_ids) != len(set(delta_ids)):
        errors.append("delta acceptance IDs must be unique")
    if len(mapping_ids) != len(set(mapping_ids)):
        errors.append("implementation mapping acceptance IDs must be unique")
    if stage in {"mapped", "pass-1", "final"} and set(delta_ids) != set(mapping_ids):
        errors.append("implementation mapping must cover exactly the delta acceptance IDs")

    referenced: set[str] = set()
    for delta in deltas:
        if not isinstance(delta, dict):
            continue
        for column in ("selected_source", "current_runtime", "target_contract"):
            value = delta.get(column)
            if isinstance(value, dict):
                ids = value.get("evidence_ids", [])
                referenced.update(ids)
                declared_level = value.get("evidence_level")
                actual_levels = {
                    evidence_by_id[evidence_id].get("level")
                    for evidence_id in ids
                    if isinstance(evidence_id, str) and evidence_id in evidence_by_id
                }
                if declared_level not in actual_levels:
                    errors.append(
                        f"delta {delta.get('acceptance_id')} {column} declares "
                        f"{declared_level} without matching evidence"
                    )
                forbidden_levels = {
                    "selected_source": {"browser-computed", "proposed"},
                    "current_runtime": {"source-extracted", "proposed"},
                    "target_contract": {"browser-computed"},
                }[column]
                conflicting = sorted(actual_levels & forbidden_levels)
                if conflicting:
                    errors.append(
                        f"delta {delta.get('acceptance_id')} {column} references "
                        f"forbidden evidence levels: {conflicting}"
                    )

    reviews = payload.get("visual_reviews", [])
    for index, review in enumerate(reviews, start=1):
        if not isinstance(review, dict):
            continue
        if review.get("pass") != index:
            errors.append("visual review pass numbers must be contiguous from 1")
        design = review.get("design_capture")
        runtime = review.get("runtime_capture")
        if isinstance(design, dict) and isinstance(runtime, dict):
            if design.get("viewport") != runtime.get("viewport"):
                errors.append(f"visual review pass {index} capture viewports must match")
            if design.get("state") != runtime.get("state"):
                errors.append(f"visual review pass {index} capture states must match")
        check_ids: set[str] = set()
        for check in review.get("computed_checks", []):
            if isinstance(check, dict):
                ids = check.get("evidence_ids", [])
                referenced.update(ids)
                check_ids.update(ids)
                if not _has_matching_runtime_evidence(ids, evidence_by_id, index, runtime):
                    errors.append(
                        f"visual review pass {index} computed check lacks matching browser-computed evidence"
                    )
                elif not _has_matching_runtime_evidence(
                    ids, evidence_by_id, index, runtime, check.get("category")
                ):
                    errors.append(
                        f"visual review pass {index} computed check {check.get('category')} "
                        "lacks matching category evidence"
                    )
        for finding in review.get("findings", []):
            if isinstance(finding, dict):
                ids = finding.get("evidence_ids", [])
                referenced.update(ids)
                if not _has_matching_runtime_evidence(ids, evidence_by_id, index, runtime):
                    errors.append(
                        f"visual review pass {index} finding {finding.get('acceptance_id')} lacks matching browser-computed evidence"
                    )

    coverage = payload.get("runtime_coverage", {})
    if isinstance(coverage, dict):
        for record in coverage.values():
            if isinstance(record, dict):
                referenced.update(record.get("evidence_ids", []))

    responsive = coverage.get("responsive_breakpoints") if isinstance(coverage, dict) else None
    if isinstance(responsive, dict) and responsive.get("status") == "verified":
        responsive_ids = responsive.get("evidence_ids", [])
        for target_id, target in matrix_by_id.items():
            if not any(
                isinstance(evidence_id, str)
                and isinstance((item := evidence_by_id.get(evidence_id)), dict)
                and item.get("level") == "browser-computed"
                and item.get("matrix_target_id") == target_id
                and item.get("viewport") == target.get("viewport")
                and item.get("state") == target.get("state")
                and item.get("target_fingerprint") == target.get("target_fingerprint")
                and "responsive_breakpoints" in item.get("categories", [])
                for evidence_id in responsive_ids
            ):
                errors.append(
                    f"verified responsive coverage lacks matrix evidence for {target_id}"
                )

    dangling = sorted(referenced - known_evidence)
    if dangling:
        errors.append(f"unknown evidence IDs referenced: {dangling}")

    verdict = payload.get("final_verdict", {})
    if stage == "final" and reviews and isinstance(coverage, dict):
        last_review = reviews[-1] if isinstance(reviews[-1], dict) else {}
        runtime = last_review.get("runtime_capture", {})
        last_pass = last_review.get("pass")
        for name, record in coverage.items():
            if not isinstance(record, dict) or record.get("status") != "verified":
                continue
            ids = record.get("evidence_ids", [])
            if not ids or not _has_matching_runtime_evidence(
                ids, evidence_by_id, last_pass, runtime, name
            ):
                errors.append(
                    f"verified runtime coverage {name} lacks matching final-pass browser-computed evidence"
                )

    if isinstance(verdict, dict) and verdict.get("status") == "Complete":
        if not isinstance(approval, dict) or approval.get("status") != "approved":
            errors.append("Complete verdict requires an approved selected source")
        if not isinstance(readiness, dict) or readiness.get("status") != "Ready":
            errors.append("Complete verdict requires Ready implementation readiness")
        incomplete = [
            name
            for name, record in coverage.items()
            if isinstance(record, dict)
            and record.get("status") in {"failed", "Not verified"}
        ]
        if incomplete:
            errors.append(f"Complete verdict has incomplete runtime coverage: {incomplete}")
        if verdict.get("not_verified"):
            errors.append("Complete verdict cannot retain Not verified items")
        if verdict.get("remaining_gaps"):
            errors.append("Complete verdict cannot retain remaining gaps")
        if reviews and isinstance(reviews[-1], dict):
            if reviews[-1].get("verdict") != "pass":
                errors.append("Complete verdict requires the final visual review to pass")
            latest_status: dict[tuple[object, object], object] = {}
            for review in reviews:
                if not isinstance(review, dict):
                    continue
                for finding in review.get("findings", []):
                    if isinstance(finding, dict):
                        latest_status[(finding.get("severity"), finding.get("acceptance_id"))] = finding.get("status")
            open_blockers = [
                acceptance_id
                for (severity, acceptance_id), status in latest_status.items()
                if severity in {"P0", "P1"} and status == "open"
            ]
            if open_blockers:
                errors.append(f"Complete verdict has open P0/P1 findings: {open_blockers}")
        errors.extend(_complete_capture_closure_errors(payload, evidence_by_id))
    return errors


def _complete_capture_closure_errors(
    payload: dict[str, object], evidence_by_id: dict[str, dict[str, object]]
) -> list[str]:
    errors: list[str] = []
    closure = payload.get("capture_closure")
    reviews = payload.get("visual_reviews", [])
    if not isinstance(closure, dict):
        return ["Complete verdict requires capture_closure"]
    target = closure.get("target")
    captures = closure.get("captures")
    artifact_contents = closure.get("artifact_contents")
    receipts = closure.get("restoration_receipts")
    if not isinstance(target, dict) or not isinstance(artifact_contents, list) or not isinstance(captures, list) or not isinstance(receipts, list):
        return ["Complete capture_closure is structurally incomplete"]
    artifact_bytes, artifact_errors = _task_artifact_bytes(artifact_contents, payload.get("task_id"))
    errors.extend(artifact_errors)
    records: dict[tuple[object, object], dict[str, object]] = {}
    capture_ids: set[object] = set()
    for record in captures:
        if not isinstance(record, dict):
            continue
        key = (record.get("pass"), record.get("role"))
        if key in records:
            errors.append("capture_closure cannot contain conflicting records for one pass and role")
        records[key] = record
        capture_id = record.get("capture_id")
        if capture_id in capture_ids:
            errors.append("capture_closure capture IDs must be unique")
        capture_ids.add(capture_id)
        if not _task_owned_locator(record.get("artifact"), payload.get("task_id")):
            errors.append("capture closure artifact locator must remain under the task-owned artifact root")
        actual_bytes = artifact_bytes.get(record.get("artifact"))
        if actual_bytes is None:
            errors.append("capture closure artifact bytes are unavailable from the task-owned resolver")
        elif record.get("artifact_sha256") != _bytes_sha256(actual_bytes) or record.get("artifact_bytes") != len(actual_bytes):
            errors.append("capture closure artifact SHA-256 or byte length does not match resolved artifact bytes")
        manifest = record.get("capture_manifest")
        summary = record.get("content_summary")
        manifest_fields = ("capture_id", "pass", "role", "artifact", "artifact_sha256", "artifact_bytes", "viewport", "state", "target_fingerprint")
        expected_manifest = {field: record.get(field) for field in manifest_fields}
        if not isinstance(manifest, dict) or manifest != expected_manifest:
            errors.append("capture manifest must canonically describe its closure record")
        elif record.get("capture_manifest_sha256") != _canonical_sha256(manifest):
            errors.append("capture manifest SHA-256 does not match canonical manifest bytes")
        if not isinstance(summary, dict) or any(
            summary.get(field) != record.get(field)
            for field in ("capture_id", "artifact", "artifact_sha256", "artifact_bytes")
        ):
            errors.append("content summary must bind its capture ID and artifact locator")
        elif record.get("content_summary_sha256") != _canonical_sha256(summary):
            errors.append("content summary SHA-256 does not match canonical summary bytes")
        if (
            record.get("viewport") != target.get("viewport")
            or record.get("state") != target.get("state")
            or record.get("target_fingerprint") != target.get("target_fingerprint")
        ):
            errors.append("capture_closure target viewport, state, and fingerprint must agree")
    expected_target_fingerprint = _canonical_sha256({"viewport": target.get("viewport"), "state": target.get("state")})
    if target.get("target_fingerprint") != expected_target_fingerprint:
        errors.append("capture_closure target fingerprint must match canonical viewport and state")
    final_runtime: dict[str, object] | None = None
    final_runtime_pass: object = None
    for review in reviews:
        if not isinstance(review, dict):
            continue
        review_pass = review.get("pass")
        for role, capture_name in (("design", "design_capture"), ("runtime", "runtime_capture")):
            capture = review.get(capture_name)
            record = records.get((review_pass, role))
            if not isinstance(capture, dict) or not isinstance(record, dict):
                errors.append(f"Complete verdict lacks closed {role} capture for pass {review_pass}")
                continue
            for field in ("capture_id", "artifact", "artifact_sha256", "artifact_bytes", "capture_manifest_sha256", "content_summary_sha256", "viewport", "state", "target_fingerprint"):
                if capture.get(field) != record.get(field):
                    errors.append(f"capture closure drift for pass {review_pass} {role}: {field}")
            if role == "runtime":
                final_runtime = record
                final_runtime_pass = review_pass
    matrix_records: dict[object, dict[str, object]] = {}
    for item in evidence_by_id.values():
        target_id = item.get("matrix_target_id")
        if item.get("level") != "browser-computed" or not isinstance(target_id, str):
            continue
        if target_id in matrix_records:
            errors.append(
                f"runtime matrix target {target_id} has duplicate browser evidence"
            )
            continue
        matrix_records[target_id] = item
    for target_id, target in {
        item.get("id"): item
        for item in payload.get("required_runtime_matrix", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }.items():
        item = matrix_records.get(target_id)
        if not isinstance(item, dict):
            continue
        artifact = item.get("source")
        actual_bytes = artifact_bytes.get(artifact)
        if (
            not _task_owned_locator(artifact, payload.get("task_id"))
            or actual_bytes is None
            or item.get("artifact_sha256") != _bytes_sha256(actual_bytes)
            or item.get("artifact_bytes") != len(actual_bytes)
            or item.get("viewport") != target.get("viewport")
            or item.get("state") != target.get("state")
            or item.get("target_fingerprint") != target.get("target_fingerprint")
        ):
            errors.append(f"runtime matrix evidence for {target_id} is not artifact-bound")
    for item in evidence_by_id.values():
        if item.get("level") != "browser-computed":
            continue
        if isinstance(item.get("matrix_target_id"), str):
            continue
        record = records.get((item.get("review_pass"), "runtime"))
        if not isinstance(record, dict) or any(
            item.get(field) != record.get(field)
            for field in ("capture_id", "artifact_sha256", "artifact_bytes", "capture_manifest_sha256", "content_summary_sha256", "viewport", "state", "target_fingerprint")
        ):
            errors.append("browser-computed evidence must close exactly to its runtime capture record")
    final_receipts = [receipt for receipt in receipts if isinstance(receipt, dict) and receipt.get("status") == "final"]
    receipt_ids = [receipt.get("receipt_id") for receipt in receipts if isinstance(receipt, dict)]
    if len(receipt_ids) != len(set(receipt_ids)):
        errors.append("restoration receipt IDs must be unique")
    if len(final_receipts) != 1 or final_receipts[0].get("receipt_id") != closure.get("canonical_final_receipt_id"):
        errors.append("Complete verdict requires exactly one canonical final restoration receipt")
    elif not isinstance(final_runtime, dict) or any(
        final_receipts[0].get(field) != final_runtime.get(field)
        for field in ("target_fingerprint", "artifact_sha256", "artifact_bytes", "capture_manifest_sha256", "content_summary_sha256")
    ) or final_receipts[0].get("final_pass") != final_runtime_pass:
        errors.append("canonical final restoration receipt must bind the final runtime capture exactly")
    else:
        receipt = final_receipts[0]
        receipt_core = {key: value for key, value in receipt.items() if key != "receipt_canonical_sha256"}
        if receipt.get("receipt_canonical_sha256") != _canonical_sha256(receipt_core):
            errors.append("canonical final restoration receipt hash does not match its canonical fields")
        if receipt.get("post_readback", {}).get("operation_id") != receipt.get("operation_id"):
            errors.append("canonical final restoration receipt post-readback must bind its operation")
        if receipt.get("post_readback", {}).get("browser_state") != receipt.get("before_state"):
            errors.append("canonical final restoration receipt must restore the raw pre-capture browser state")
    return errors


def _canonical_sha256(value: object) -> str:
    contents = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"sha256:{hashlib.sha256(contents).hexdigest()}"


def _bytes_sha256(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def _task_artifact_bytes(
    entries: list[object], task_id: object
) -> tuple[dict[object, bytes], list[str]]:
    resolved: dict[object, bytes] = {}
    errors: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        locator = entry.get("artifact")
        if not _task_owned_locator(locator, task_id):
            errors.append("task artifact resolver rejects a locator outside the task-owned artifact root")
            continue
        if locator in resolved:
            errors.append("task artifact resolver rejects duplicate artifact locators")
            continue
        try:
            resolved[locator] = base64.b64decode(entry.get("bytes_base64", ""), validate=True)
        except (binascii.Error, ValueError, TypeError):
            errors.append("task artifact resolver cannot parse base64 artifact bytes")
    return resolved, errors


def _task_owned_locator(locator: object, task_id: object) -> bool:
    if not isinstance(locator, str) or not isinstance(task_id, str) or not task_id:
        return False
    prefix = f"artifact://task/{task_id}/"
    relative = locator.removeprefix(prefix)
    return locator.startswith(prefix) and bool(relative) and "/../" not in f"/{relative}" and not relative.startswith("/")


def _has_matching_runtime_evidence(
    evidence_ids: list[object],
    evidence_by_id: dict[str, dict[str, object]],
    review_pass: object,
    runtime_capture: object,
    required_category: object = None,
) -> bool:
    if not isinstance(runtime_capture, dict):
        return False
    for evidence_id in evidence_ids:
        item = evidence_by_id.get(evidence_id) if isinstance(evidence_id, str) else None
        if not item or item.get("level") != "browser-computed":
            continue
        if item.get("review_pass") != review_pass:
            continue
        if item.get("viewport") != runtime_capture.get("viewport"):
            continue
        if item.get("state") != runtime_capture.get("state"):
            continue
        if required_category is not None and required_category not in item.get(
            "categories", []
        ):
            continue
        return True
    return False


def validate_artifact(artifact: Path, schema: Path) -> None:
    payload = json.loads(artifact.read_text(encoding="utf-8"))
    contract = json.loads(schema.read_text(encoding="utf-8"))
    errors = schema_errors(payload, contract)
    if errors:
        raise ValueError("; ".join(errors))
    errors = semantic_errors(payload)
    if errors:
        raise ValueError("; ".join(errors))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate frontend-visual-evidence/v1 JSON without network access."
    )
    parser.add_argument("artifact", type=Path)
    parser.add_argument(
        "--schema",
        type=Path,
        default=default_schema(),
    )
    args = parser.parse_args()
    try:
        validate_artifact(args.artifact.resolve(), args.schema.resolve())
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"validated frontend visual evidence: {args.artifact}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
