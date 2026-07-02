"""
Agroberries Europe BV — Quality Report Parser v1

Handles the standard Agroberries inspection report layout:
  Page 1  : Report header (reference, date, client, grower, GGN, variety, packaging, origin)
  Page 1+ : Pallet measurement table (pallet#, Q-score, CS-score, Brix, Mold%, Decay%, ...)
  Last page: Load summary / averages

The parser uses pdfplumber for text + table extraction with a positional text fallback.
All field mappings are table-driven so they can be updated without touching the logic.
"""
from __future__ import annotations

import io
import re
from decimal import Decimal, InvalidOperation
from typing import Any

import pdfplumber

from .base import BaseParser, PalletData, ParseResult

# ── Fingerprint: lines that identify an Agroberries report ──────────────────
_FINGERPRINTS = [
    re.compile(r"agroberries", re.I),
    re.compile(r"agro\s*berries", re.I),
    re.compile(r"\bGGN\b"),
    re.compile(r"MAGOPCO", re.I),
]

# ── Header field patterns ────────────────────────────────────────────────────
_NUM = r"(\d+(?:[.,]\d+)?)"
_DATE_ISO = re.compile(r"(\d{4})[.\-/](\d{2})[.\-/](\d{2})")
_DATE_EU  = re.compile(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})")
_DATE_COMPACT = re.compile(r"(\d{4})(\d{2})(\d{2})")   # 20260207

_HEADER_PATTERNS: dict[str, re.Pattern[str]] = {
    "report_number":    re.compile(r"(?:report|inspection|rapport)\s+(?:no|nr|number|#)[:\s.]*([A-Z0-9\-]{4,30})", re.I),
    "load_reference":   re.compile(r"(?:load|ref(?:erence)?|shipment|order|CMR|BL|B/L|AWB)[:\s#.]*([A-Z0-9\-/]{3,30})", re.I),
    "vessel_name":      re.compile(r"vessel\s+name[:\s.]*([A-Za-z0-9\-]+)", re.I),
    "container_number": re.compile(r"container\s+(?:number|no|nr)[:\s#.]*([A-Za-z0-9\-]{2,20})", re.I),
    "inspection_place": re.compile(r"(?:place|location|site|warehouse|inspection\s+at)[:\s.]*([A-Za-z0-9 ,.\-]{3,60})", re.I),
    "client_name":      re.compile(r"(?:client|buyer|consignee|importer|customer)[:\s.]*([A-Za-z0-9 &,.\-]{3,80})", re.I),
    "origin_country":   re.compile(r"(?:origin|country\s+of\s+origin|COO)[:\s.]*([A-Za-z ]{3,40})", re.I),
    "product_name":     re.compile(r"(?:product|commodity|article)[:\s.]*([A-Za-z ]{3,40})", re.I),
    "variety_name":     re.compile(r"(?:variety|cultivar|var\.?)[:\s.]*([A-Za-z0-9 \-]{2,40})", re.I),
    "packaging_name":   re.compile(r"(?:packaging|pack(?:age)?|presentation)[:\s.]*([A-Za-z0-9 \.\-]{2,60})", re.I),
    "grower_code":      re.compile(r"(?:grower|producer|farm)\s*(?:code|no|#|id)?[:\s.]*([A-Z0-9\-]{2,30})", re.I),
    "ggn":              re.compile(r"GGN[:\s.]*([0-9]{13})", re.I),
    "total_pallets":    re.compile(r"(?:total\s+pallets?|nb\s+pallets?|number\s+of\s+pallets?)[:\s.]*(\d+)", re.I),
    "total_cases":      re.compile(r"(?:total\s+(?:cases?|boxes?|cartons?|units?))[:\s.]*(\d+)", re.I),
    "total_weight":     re.compile(rf"(?:total\s+(?:gross\s+)?weight|nett?\s+weight)[:\s.]*{_NUM}\s*(?:kg)?", re.I),
    "temperature":      re.compile(rf"(?:temp(?:erature)?|pulp\s+temp)[:\s.]*{_NUM}\s*(?:°C|C)", re.I),
}

# ── Measurement column name → parameter code + name ─────────────────────────
_COL_MAP: list[tuple[re.Pattern[str], str, str, str]] = [
    (re.compile(r"brix", re.I),              "brix",                   "Brix",                      "°Brix"),
    (re.compile(r"mold|mould",re.I),         "mold",                   "Mold",                      "%"),
    (re.compile(r"decay|rot\b",re.I),        "decay",                  "Decay",                     "%"),
    (re.compile(r"leaker",re.I),             "leakers",                "Leakers",                   "%"),
    (re.compile(r"bloom",re.I),              "bloom",                  "Bloom",                     "%"),
    (re.compile(r"shrivel",re.I),            "shrivel",                "Shrivel",                   "%"),
    (re.compile(r"\bred\b",re.I),            "red_color",              "Red Color",                 "%"),
    (re.compile(r"undersize",re.I),          "undersize",              "Undersize",                 "%"),
    (re.compile(r"<\s*60",re.I),             "internal_lt60",          "Internal Colour <60mm",     "%"),
    (re.compile(r"60.?70",re.I),             "internal_60_70",         "Internal Colour 60-70mm",   "%"),
    (re.compile(r"70\s*<|>\s*70",re.I),      "internal_gt70",          "Internal Colour >70mm",     "%"),
    (re.compile(r"\bp1\b",re.I),             "major_p1",               "Major Defect P1",           "%"),
    (re.compile(r"\bp2\b",re.I),             "major_p2",               "Major Defect P2",           "%"),
    (re.compile(r"\bp3\b",re.I),             "major_p3",               "Major Defect P3",           "%"),
    (re.compile(r"\bp4\b",re.I),             "major_p4",               "Major Defect P4",           "%"),
    (re.compile(r"\bs1\b",re.I),             "sample_w_s1",            "Sample NetWeight S1",       "g"),
    (re.compile(r"\bs2\b",re.I),             "sample_w_s2",            "Sample NetWeight S2",       "g"),
    (re.compile(r"\bs3\b",re.I),             "sample_w_s3",            "Sample NetWeight S3",       "g"),
    (re.compile(r"\bs4\b",re.I),             "sample_w_s4",            "Sample NetWeight S4",       "g"),
    (re.compile(r"\bmin\b",re.I),            "size_min",               "Size Min",                  "mm"),
    (re.compile(r"\bmax\b",re.I),            "size_max",               "Size Max",                  "mm"),
    (re.compile(r"defect\s+%|defect.*pct",re.I),"defect_pct",          "Defect %",                  "%"),
    (re.compile(r"defect",re.I),             "defect_text",            "Defect",                    ""),
    (re.compile(r"botrytis",re.I),           "botrytis",               "Botrytis",                  "%"),
    (re.compile(r"mech.*dam|dam.*mech",re.I),"mechanical_damage",      "Mechanical Damage",         "%"),
    (re.compile(r"soft|overripe",re.I),      "soft_overripe",          "Soft / Overripe",           "%"),
    (re.compile(r"q.?score|quality.?grade",re.I),"q_score",            "Q Score",                   ""),
    (re.compile(r"cs.?score|cond.*score",re.I),"cs_score",             "CS Score",                  ""),
    (re.compile(r"firmness",re.I),           "firmness",               "Firmness",                  "kg"),
    (re.compile(r"temp",re.I),               "temperature",            "Temperature",               "°C"),
    (re.compile(r"weight",re.I),             "weight",                 "Weight",                    "kg"),
    (re.compile(r"cases?|boxes?|cartons?",re.I),"cases_count",         "Cases",                     ""),
    (re.compile(r"packing.?date|pack.*date",re.I),"packing_date",      "Packing Date",              ""),
    (re.compile(r"grower",re.I),             "grower_code",            "Grower",                    ""),
    (re.compile(r"\bggn\b",re.I),            "ggn",                    "GGN",                       ""),
    (re.compile(r"variety|cultivar",re.I),   "variety",                "Variety",                   ""),
    (re.compile(r"remarks?|comment",re.I),   "comments",               "Comments",                  ""),
]


def _match_col(header_text: str) -> tuple[str, str, str] | None:
    for pat, code, name, unit in _COL_MAP:
        if pat.search(header_text):
            return code, name, unit
    return None


def _parse_num(s: str) -> Decimal | None:
    s = s.strip().replace(",", ".").replace("%", "").replace("°C", "").strip()
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _parse_date(text: str) -> str | None:
    m = _DATE_ISO.search(text)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    m = _DATE_EU.search(text)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    m = _DATE_COMPACT.search(text)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def _extract_header_fields(lines: list[str]) -> dict[str, Any]:
    result: dict[str, Any] = {}

    # Only search lines before the pallet table header to avoid column-label
    # rows contaminating the field regex patterns (e.g. "Grower GGN Variety
    # Organic Packaging" would otherwise match variety="Organic Packaging").
    header_boundary = min(30, len(lines))
    for i, line in enumerate(lines[:40]):
        low = line.lower()
        if ("pallet" in low or "pal" in low) and any(
            kw in low for kw in ["brix", "mold", "mould", "decay", "bloom", "leaker"]
        ):
            header_boundary = i
            break
    full_text = "\n".join(lines[:header_boundary])

    # Date — look for the first recognisable date
    for line in lines[:header_boundary]:
        d = _parse_date(line)
        if d:
            result.setdefault("inspection_date", d)
            break

    for field_name, pat in _HEADER_PATTERNS.items():
        if field_name in result:
            continue
        m = pat.search(full_text)
        if m:
            val = m.group(1).strip().rstrip(".")
            # origin_country: keep only the first word or two (stops trailing labels like "Inspector Beekers")
            if field_name == "origin_country":
                words = val.split()
                # Known multi-word countries; otherwise use first word only
                _TWO_WORD_COUNTRIES = {"south", "new", "saudi", "united", "ivory", "sierra", "burkina", "costa"}
                if len(words) >= 2 and words[0].lower() in _TWO_WORD_COUNTRIES:
                    val = " ".join(words[:2])
                else:
                    val = words[0] if words else val
            result[field_name] = val

    # Numeric coercions
    for f in ("total_pallets", "total_cases"):
        if f in result:
            try:
                result[f] = int(result[f])
            except ValueError:
                del result[f]
    for f in ("total_weight", "temperature"):
        if f in result:
            d = _parse_num(str(result[f]))
            result[f] = float(d) if d is not None else None

    return result


def _is_pallet_table_header(row: list[str | None]) -> bool:
    """Heuristic: a table header row contains 'pallet' and at least one measurement keyword."""
    if not row:
        return False
    text = " ".join(str(c or "") for c in row).lower()
    has_pallet = "pallet" in text or "pal" in text
    has_measure = any(kw in text for kw in ["brix", "mold", "mould", "decay", "q score", "cs", "leaker", "temp"])
    return has_pallet and has_measure


def _parse_tables(pdf: pdfplumber.PDF) -> list[PalletData]:
    """Extract pallet rows from tables in the PDF."""
    pallets: list[PalletData] = []

    for page in pdf.pages:
        tables = page.extract_tables({
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
            "snap_tolerance": 5,
        })
        if not tables:
            tables = page.extract_tables()

        for table in tables:
            if not table or len(table) < 2:
                continue

            # Find header row
            header_idx = None
            for i, row in enumerate(table):
                if _is_pallet_table_header(row):
                    header_idx = i
                    break
            if header_idx is None:
                continue

            header = [str(c or "").strip() for c in table[header_idx]]
            col_map: dict[int, tuple[str, str, str]] = {}
            pallet_col: int | None = None

            for ci, h in enumerate(header):
                if re.search(r"pallet\s*(no|#|num|id)?", h, re.I):
                    pallet_col = ci
                else:
                    hit = _match_col(h)
                    if hit:
                        col_map[ci] = hit

            if pallet_col is None:
                continue  # can't identify pallet column

            # Detect merged rows: when the PDF has no horizontal rules pdfplumber
            # collapses all pallet rows into one cell (separated by \n).
            # Skip this table so the positional text parser handles it instead.
            first_data_row = next(
                (r for r in table[header_idx + 1:] if r and not all(c in (None, "") for c in r)),
                None,
            )
            if first_data_row is not None and pallet_col < len(first_data_row):
                raw_pallet_cell = str(first_data_row[pallet_col] or "")
                if "\n" in raw_pallet_cell:
                    continue  # merged — text parser handles this layout better

            for row in table[header_idx + 1:]:
                if not row or all(c in (None, "") for c in row):
                    continue
                cells = [str(c or "").strip().splitlines()[0].strip() if c else "" for c in row]
                pallet_num = cells[pallet_col] if pallet_col < len(cells) else ""
                if not pallet_num:
                    continue
                # Filter summary/average rows by keyword AND by format — pallet
                # numbers are alphanumeric codes, not descriptive phrases.
                if pallet_num.lower() in ("total", "average", "avg", "gemiddelde", "totaal"):
                    continue
                if not _PALLET_NUM_RE.match(pallet_num):
                    continue

                pallet = PalletData(pallet_number=pallet_num)
                for ci, (code, name, unit) in col_map.items():
                    if ci >= len(cells):
                        continue
                    raw = cells[ci]
                    if not raw:
                        continue

                    if code in ("grower_code",):
                        pallet.grower_code = raw
                    elif code == "ggn":
                        pallet.ggn = raw
                    elif code == "variety":
                        pallet.variety_name = raw
                    elif code in ("q_score", "cs_score", "defect_text"):
                        pallet.measurements.append({
                            "parameter_code": code,
                            "parameter_name": name,
                            "value_numeric": None,
                            "value_text": raw,
                            "unit": unit,
                            "source_column": header[ci],
                        })
                    elif code == "packing_date":
                        pallet.packing_date = _parse_date(raw) or raw
                    elif code == "cases_count":
                        n = _parse_num(raw)
                        pallet.cases_count = int(n) if n else None
                    elif code == "weight":
                        pallet.weight = _parse_num(raw)
                    elif code == "comments":
                        pass
                    else:
                        n = _parse_num(raw)
                        pallet.measurements.append({
                            "parameter_code": code,
                            "parameter_name": name,
                            "value_numeric": float(n) if n is not None else None,
                            "value_text": raw if n is None else None,
                            "unit": unit,
                            "source_column": header[ci],
                        })

                pallets.append(pallet)

    # Quality gate: if fewer than half the pallets have ≥3 measurements,
    # table extraction is unreliable (e.g. only the CS column was picked up) — fall back to text.
    if pallets:
        with_enough = sum(1 for p in pallets if len(p.measurements) >= 3)
        if with_enough / len(pallets) < 0.5:
            return []

    return pallets


# ── Compiled regexes for text parser ─────────────────────────────────────────
_GGN_RE = re.compile(r"^\d{13}$")
_DATE_ROW_RE = re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$")
_PALLET_NUM_RE = re.compile(r"^[A-Z]{0,3}\d{2,6}$", re.I)
_DECIMAL_PCT = re.compile(r"^\d+[.,]\d+%$")   # "3,1%" or "0.0%"
_SIMPLE_PCT = re.compile(r"^\d+%$")            # "75%" or "1%"
_ANY_PCT = re.compile(r"^\d+[.,]?\d*%$")       # any % token


def _parse_pallets_from_text(lines: list[str]) -> list[PalletData]:
    """
    Positional text parser for the Agroberries column layout.

    Fixed left columns:
        Pallet | Date | Grower | GGN | Variety (multi-word, ends before 'No'/'Yes') |
        Organic | Packaging (multi-word, ends at first 2-4 digit integer) |
        Cases | Weight | S1 | S2 | S3 | S4 | Min | Max

    Fixed right columns (anchored from Q/CS):
        ... | Undersize% | Brix% | Bloom% | Shrivel% | Red% |
        <60% | 60-70% | 70<% | P1% | P2% | P3% | P4% |
        Mold% | Decay% | Leakers% | Defect-text | Defect% | Q | CS | [COMMENTS]
    """
    pallets: list[PalletData] = []

    # Find the detail header line (contains "Pallet"/"Pal" + measurement keywords)
    header_idx = None
    for i, line in enumerate(lines):
        low = line.lower()
        if ("pallet" in low or "pal" in low) and any(kw in low for kw in ["mold", "mould", "brix", "decay", "bloom"]):
            header_idx = i
            break

    if header_idx is None:
        return pallets

    for line in lines[header_idx + 1:]:
        tokens = line.strip().split()
        if len(tokens) < 10:
            continue
        if not _PALLET_NUM_RE.match(tokens[0]):
            continue
        if any(kw in line.lower() for kw in ["average", "total", "avg", "gemiddelde"]):
            continue

        pallet = PalletData(pallet_number=tokens[0])

        # ── Left-side fixed positions ─────────────────────────────────────────
        if len(tokens) > 1 and _DATE_ROW_RE.match(tokens[1]):
            pallet.packing_date = _parse_date(tokens[1])

        if len(tokens) > 2 and re.match(r"^\d{1,6}$", tokens[2]):
            pallet.grower_code = tokens[2]

        if len(tokens) > 3 and _GGN_RE.match(tokens[3]):
            pallet.ggn = tokens[3]

        # Variety: tokens[4..] up to first "No"/"Yes" (organic marker)
        organic_idx: int | None = None
        for i in range(4, min(len(tokens), 14)):
            if tokens[i].lower() in ("no", "yes"):
                organic_idx = i
                break

        if organic_idx is not None and organic_idx > 4:
            pallet.variety_name = " ".join(tokens[4:organic_idx])

        # Packaging: tokens after organic marker, up to first 2-4 digit integer
        if organic_idx is not None:
            pkg_start = organic_idx + 1
            pkg_end = pkg_start
            for i in range(pkg_start, min(len(tokens), pkg_start + 8)):
                if re.match(r"^\d{2,4}$", tokens[i]) and i > pkg_start:
                    pkg_end = i
                    break
            if pkg_end > pkg_start:
                pallet.packaging_name = " ".join(tokens[pkg_start:pkg_end])

        # ── Right-side anchor: find CS (single A/B/C/D letter preceded by Q digit) ──
        cs_idx: int | None = None
        q_idx: int | None = None

        for i in range(len(tokens) - 1, 0, -1):
            if tokens[i].upper() in ("A", "B", "C", "D", "O") and len(tokens[i]) == 1:
                # Search backward (up to 3 positions) for a single digit Q
                for j in range(i - 1, max(i - 4, -1), -1):
                    if tokens[j].isdigit() and len(tokens[j]) == 1:
                        cs_idx = i
                        q_idx = j
                        break
                if cs_idx is not None:
                    break

        if cs_idx is not None:
            pallet.measurements.append({
                "parameter_code": "cs_score", "parameter_name": "CS Score",
                "value_numeric": None, "value_text": tokens[cs_idx],
                "unit": "", "source_column": "CS",
            })
        if q_idx is not None:
            pallet.measurements.append({
                "parameter_code": "q_score", "parameter_name": "Q Score",
                "value_numeric": None, "value_text": tokens[q_idx],
                "unit": "", "source_column": "Q",
            })

        if q_idx is None:
            pallets.append(pallet)
            continue

        cursor = q_idx - 1

        # Defect % (simple integer %, immediately before Q)
        defect_pct: str | None = None
        if cursor >= 0 and _ANY_PCT.match(tokens[cursor]):
            defect_pct = tokens[cursor]
            cursor -= 1

        # Defect text: scan backward until hitting a comma-decimal % (Leakers anchor)
        defect_parts: list[str] = []
        while cursor >= 0 and not _DECIMAL_PCT.match(tokens[cursor]):
            defect_parts.insert(0, tokens[cursor])
            cursor -= 1
        defect_text = " ".join(defect_parts) if defect_parts else None

        if defect_pct:
            n = _parse_num(defect_pct)
            pallet.measurements.append({
                "parameter_code": "defect_pct", "parameter_name": "Defect %",
                "value_numeric": float(n) if n is not None else None,
                "value_text": defect_pct if n is None else None,
                "unit": "%", "source_column": "Defect %",
            })
        if defect_text:
            pallet.measurements.append({
                "parameter_code": "defect_text", "parameter_name": "Defect",
                "value_numeric": None, "value_text": defect_text,
                "unit": "", "source_column": "Defect",
            })

        # Mold / Decay / Leakers — 3 comma-decimal % tokens (left-to-right order in PDF)
        rdm_vals: list[str] = []
        while cursor >= 0 and _DECIMAL_PCT.match(tokens[cursor]):
            rdm_vals.insert(0, tokens[cursor])
            cursor -= 1

        for (code, name), raw in zip(
            [("mold", "Mold"), ("decay", "Decay"), ("leakers", "Leakers")],
            rdm_vals
        ):
            n = _parse_num(raw)
            pallet.measurements.append({
                "parameter_code": code, "parameter_name": name,
                "value_numeric": float(n) if n is not None else None,
                "value_text": raw if n is None else None,
                "unit": "%", "source_column": name,
            })

        # 12 simple-% values (left-to-right in PDF):
        # Undersize | Brix | Bloom | Shrivel | Red | <60 | 60-70 | >70 | P1 | P2 | P3 | P4
        pct_stack: list[str] = []
        while cursor >= 0 and _SIMPLE_PCT.match(tokens[cursor]):
            pct_stack.insert(0, tokens[cursor])
            cursor -= 1

        _PCT_CODES = [
            ("undersize",       "Undersize",               "%"),
            ("brix",            "Brix",                    "°Brix"),
            ("bloom",           "Bloom",                   "%"),
            ("shrivel",         "Shrivel",                 "%"),
            ("red_color",       "Red Color",               "%"),
            ("internal_lt60",   "Internal Colour <60mm",   "%"),
            ("internal_60_70",  "Internal Colour 60-70mm", "%"),
            ("internal_gt70",   "Internal Colour >70mm",   "%"),
            ("major_p1",        "Major Defect P1",         "%"),
            ("major_p2",        "Major Defect P2",         "%"),
            ("major_p3",        "Major Defect P3",         "%"),
            ("major_p4",        "Major Defect P4",         "%"),
        ]
        for (code, name, unit), raw in zip(_PCT_CODES, pct_stack):
            n = _parse_num(raw)
            pallet.measurements.append({
                "parameter_code": code, "parameter_name": name,
                "value_numeric": float(n) if n is not None else None,
                "value_text": raw if n is None else None,
                "unit": unit, "source_column": name,
            })

        # Integer columns (left-to-right in PDF):
        # Cases | Weight | S1 | S2 | S3 | S4 | Min | Max
        int_stack: list[str] = []
        while cursor >= 0 and re.match(r"^\d+$", tokens[cursor]):
            int_stack.insert(0, tokens[cursor])
            cursor -= 1

        _INT_CODES: list[tuple[str, str | None, str]] = [
            ("cases_count", None,               ""),
            ("weight_kg",   None,               "kg"),
            ("sample_w_s1", "Sample NetWeight S1", "g"),
            ("sample_w_s2", "Sample NetWeight S2", "g"),
            ("sample_w_s3", "Sample NetWeight S3", "g"),
            ("sample_w_s4", "Sample NetWeight S4", "g"),
            ("size_min",    "Size Min",         "mm"),
            ("size_max",    "Size Max",         "mm"),
        ]
        for (code, name, unit), raw in zip(_INT_CODES, int_stack):
            try:
                val = int(raw)
            except ValueError:
                continue
            if code == "cases_count":
                pallet.cases_count = val
            elif code == "weight_kg":
                pallet.weight = Decimal(str(val))
            elif name:
                pallet.measurements.append({
                    "parameter_code": code, "parameter_name": name,
                    "value_numeric": float(val), "value_text": None,
                    "unit": unit, "source_column": name,
                })

        pallets.append(pallet)

    return pallets


class AgroberriesV1Parser(BaseParser):
    NAME = "agroberries_v1"
    VERSION = "1.1"

    def can_parse(self, text_sample: str) -> bool:
        score = sum(1 for fp in _FINGERPRINTS if fp.search(text_sample))
        return score >= 1

    def parse(self, pdf_bytes: bytes) -> ParseResult:
        result = ParseResult(parser_name=self.NAME, parser_version=self.VERSION)

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            result.confidence = 0.5

            # Full text extraction
            all_lines: list[str] = []
            for page in pdf.pages:
                text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                all_lines.extend(text.splitlines())

            result.raw_text_excerpt = "\n".join(all_lines)[:2000]

            # Header parsing
            header = _extract_header_fields(all_lines)
            result.report_number    = header.get("report_number")
            result.load_reference   = header.get("load_reference")
            result.vessel_name      = header.get("vessel_name")
            result.container_number = header.get("container_number")
            result.inspection_date  = header.get("inspection_date")
            result.inspection_place = header.get("inspection_place")
            result.client_name      = header.get("client_name")
            result.origin_country   = header.get("origin_country")
            result.product_name     = header.get("product_name")
            result.variety_name     = header.get("variety_name")
            result.packaging_name   = header.get("packaging_name")
            result.grower_code      = header.get("grower_code")
            result.ggn              = header.get("ggn")
            result.total_pallets    = header.get("total_pallets")
            result.total_cases      = header.get("total_cases")
            result.total_weight     = header.get("total_weight")
            result.temperature      = header.get("temperature")

            # Table extraction (primary method)
            pallets = _parse_tables(pdf)

            # Fallback: positional text parser
            if not pallets:
                pallets = _parse_pallets_from_text(all_lines)

            result.pallets = pallets

            # Use the most common per-pallet variety as the report-level variety
            # (Agroberries PDFs often don't list variety in the document header;
            # the column header row "Variety" fools the regex into wrong values).
            if pallets:
                from collections import Counter
                pallet_varieties = [p.variety_name for p in pallets if p.variety_name]
                if pallet_varieties:
                    result.variety_name = Counter(pallet_varieties).most_common(1)[0][0]
                # Grower code: prefer per-pallet value when header matched a label word
                pallet_growers = [p.grower_code for p in pallets if p.grower_code]
                if pallet_growers and (
                    not result.grower_code
                    or result.grower_code.upper() in ("GGN", "CODE", "NO", "ID")
                ):
                    result.grower_code = Counter(pallet_growers).most_common(1)[0][0]
                # GGN: prefer per-pallet value
                pallet_ggns = [p.ggn for p in pallets if p.ggn]
                if pallet_ggns and not result.ggn:
                    result.ggn = Counter(pallet_ggns).most_common(1)[0][0]
                # Total pallets: if not found in header, use extracted count
                if not result.total_pallets:
                    result.total_pallets = len(pallets)

            # Confidence boost
            if result.inspection_date:
                result.confidence += 0.1
            if result.grower_code or result.ggn:
                result.confidence += 0.1
            if pallets:
                result.confidence += 0.2
            if result.total_pallets and len(pallets) > 0:
                result.confidence += 0.1

            result.confidence = min(result.confidence, 1.0)

        return result
