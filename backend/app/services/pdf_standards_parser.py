"""
Rule-based PDF parser for quality standards documents.

Strategy:
  1. Extract all text via pdfplumber (preserves table layout better than PyMuPDF).
  2. Run three passes:
       a) Table pass  – scan rows that look like: parameter | value | unit | severity
       b) Inline pass – scan prose lines like "Mold: max 2%  CRITICAL"
       c) Range pass  – scan lines like "Temperature: 1 – 6 °C"
  3. Normalise every hit into a ParsedStandard dict.
  4. De-duplicate by parameter_code.
"""

from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber

# ── severity keyword mapping ────────────────────────────────────────────────
_SEVERITY_MAP: dict[str, str] = {
    "critical": "CRITICAL",
    "reject": "CRITICAL",
    "rejection": "CRITICAL",
    "major": "MAJOR",
    "important": "MAJOR",
    "minor": "MINOR",
    "informational": "MINOR",
    "info": "MINOR",
}

# ── parameter keyword → code + group ────────────────────────────────────────
_PARAM_PATTERNS: list[tuple[re.Pattern[str], str, str, str]] = [
    # (regex, code, group, default_unit)
    (re.compile(r"\bmold\b|\bmould\b", re.I), "mold", "condition_defects", "%"),
    (re.compile(r"\bdecay\b|\brot\b", re.I), "decay", "condition_defects", "%"),
    (re.compile(r"\bleaker", re.I), "leakers", "condition_defects", "%"),
    (re.compile(r"\bshrivell", re.I), "shrivelling", "condition_defects", "%"),
    (re.compile(r"\bmechanical\b.*\bdamage\b|\bdamage\b.*\bmechanical\b", re.I), "mechanical_damage", "condition_defects", "%"),
    (re.compile(r"\btotal\b.*\bcondition\b|\bcondition\b.*\bdefect", re.I), "total_condition_defects", "condition_defects", "%"),
    (re.compile(r"\bbrix\b|\bsugar\b.*\bcontent\b|\bsoluble\b.*\bsolid", re.I), "brix", "quality", "°Brix"),
    (re.compile(r"\bfirmness\b", re.I), "firmness", "quality", "kg"),
    (re.compile(r"\bcolou?r\b.*\bindex\b|\bci\b", re.I), "color_index", "quality", ""),
    (re.compile(r"\btemp", re.I), "temperature", "transport", "°C"),
    (re.compile(r"\bweight\b.*\bloss\b|\bweight\b.*\bshort", re.I), "weight_loss", "condition_defects", "%"),
    (re.compile(r"\bbotrytis\b", re.I), "botrytis", "condition_defects", "%"),
    (re.compile(r"\bsize\b|\bcalibre\b|\bcaliber\b", re.I), "size", "quality", "mm"),
    (re.compile(r"\bpH\b", re.I), "ph", "quality", ""),
    (re.compile(r"\bstem\b.*\bdetach|\bstem\b.*\bbreak", re.I), "stem_detachment", "condition_defects", "%"),
    (re.compile(r"\bpest\b|\binsect\b", re.I), "pest_damage", "condition_defects", "%"),
    (re.compile(r"\bsunburn\b|\bsun\b.*\bscald\b", re.I), "sunburn", "condition_defects", "%"),
]

# ── numeric / operator patterns ──────────────────────────────────────────────
_NUM = r"(\d+(?:[.,]\d+)?)"
_OP_MAX = re.compile(rf"(?:max(?:imum)?|≤|<=|<|no\s+more\s+than)\s*{_NUM}", re.I)
_OP_MIN = re.compile(rf"(?:min(?:imum)?|≥|>=|>|at\s+least|not\s+less\s+than)\s*{_NUM}", re.I)
_RANGE = re.compile(rf"{_NUM}\s*[-–—]\s*{_NUM}")
_UNIT = re.compile(r"(%|°C|°Brix|brix|kg|mm|g)\b", re.I)
_SEVERITY_RE = re.compile(
    r"\b(critical|reject(?:ion)?|major|important|minor|info(?:rmational)?)\b", re.I
)


def _normalise_num(s: str) -> str:
    return s.replace(",", ".")


def _match_severity(text: str) -> str:
    m = _SEVERITY_RE.search(text)
    if m:
        return _SEVERITY_MAP.get(m.group(1).lower(), "MAJOR")
    return "MAJOR"


def _match_param(text: str) -> tuple[str, str, str] | None:
    """Return (code, group, default_unit) or None."""
    for pattern, code, group, unit in _PARAM_PATTERNS:
        if pattern.search(text):
            return code, group, unit
    return None


def _extract_values(text: str) -> dict[str, Any]:
    result: dict[str, Any] = {"min_value": None, "max_value": None, "unit": None}

    # Range first (e.g. 1 – 6 °C)
    rm = _RANGE.search(text)
    if rm:
        result["min_value"] = _normalise_num(rm.group(1))
        result["max_value"] = _normalise_num(rm.group(2))
    else:
        mm = _OP_MAX.search(text)
        if mm:
            result["max_value"] = _normalise_num(mm.group(1))
        mn = _OP_MIN.search(text)
        if mn:
            result["min_value"] = _normalise_num(mn.group(1))

    um = _UNIT.search(text)
    if um:
        u = um.group(1)
        result["unit"] = "%" if u == "%" else ("°C" if "c" in u.lower() and "°" in u else u)

    return result


def _build_standard(param_code: str, param_group: str, default_unit: str,
                    line: str, name_hint: str = "") -> dict[str, Any]:
    vals = _extract_values(line)
    if vals["unit"] is None:
        vals["unit"] = default_unit
    severity = _match_severity(line)
    name = name_hint.strip() if name_hint else param_code.replace("_", " ").title()
    return {
        "parameter_code": param_code,
        "parameter_name": name,
        "parameter_group": param_group,
        "severity": severity,
        "min_value": vals["min_value"],
        "max_value": vals["max_value"],
        "unit": vals["unit"],
        "category": "transport" if param_code == "temperature" else (
            "quality" if param_group == "quality" else "condition"),
        "score_system": "CS",
        "source_line": line.strip()[:200],
    }


# ── main entry point ─────────────────────────────────────────────────────────

def parse_standards_from_pdf(pdf_bytes: bytes) -> list[dict[str, Any]]:
    """
    Extract quality standard candidates from a PDF's text.
    Returns a list of dicts shaped like QualityStandardCreate (without client/product ids).
    """
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            lines: list[str] = []
            for page in pdf.pages:
                text = page.extract_text(x_tolerance=3, y_tolerance=3)
                if text:
                    lines.extend(text.splitlines())
    except Exception as exc:
        raise ValueError(f"Could not read PDF: {exc}") from exc

    seen_codes: set[str] = set()
    results: list[dict[str, Any]] = []

    for line in lines:
        line_stripped = line.strip()
        if len(line_stripped) < 4:
            continue

        hit = _match_param(line_stripped)
        if not hit:
            continue

        code, group, default_unit = hit

        # Try to extract at least one numeric value
        vals = _extract_values(line_stripped)
        has_value = vals["min_value"] is not None or vals["max_value"] is not None
        if not has_value:
            continue

        # Deduplicate: keep first occurrence of each code
        # (unless severity differs — CRITICAL variant wins)
        entry = _build_standard(code, group, default_unit, line_stripped)

        if code not in seen_codes:
            seen_codes.add(code)
            results.append(entry)
        else:
            # Replace with CRITICAL version if new match is more severe
            existing_idx = next((i for i, r in enumerate(results) if r["parameter_code"] == code), None)
            if existing_idx is not None:
                if entry["severity"] == "CRITICAL" and results[existing_idx]["severity"] != "CRITICAL":
                    results[existing_idx] = entry

    return results
