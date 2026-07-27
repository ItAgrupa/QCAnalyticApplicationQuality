"""
BWQCINReport — Winterwood Quality Inspection Report Parser v1

Template used by: WINTERWOOD packhouse (buyer-side QC report received by MAGOPCO)
Format:  BWQCINReport PDF (multi-page)

Page layout:
  Page 1  : Consignment header, Waste RAG Summary table, Sort Code Summary (partial)
  Page 2  : Eating Quality table, Admin/Packaging/Foreign Body issues, Sort Code cont.
  Page 3  : Pallet Break Down table + Defect Break Down table
  Page 4+ : Images (skipped)
  Last    : Grower Sort Code Summary, Sugars

Key differences vs Agroberries v1:
  - RAG scale: BLUE/GREEN/AMBER/RED/GREY/BLACK (not PASS/HOLD/FAIL)
  - Sort codes: SC0-SC5 + Reject
  - Pallet rows carry Waste RAG + Sort Code + Main Defect, not Brix/Mold/% columns
  - Eating Quality section per variety (Taste 1-5, Texture 1-5, Berry weights)
  - Defect breakdown by defect type with punnets out-of-spec %
"""
from __future__ import annotations

import io
import re
from decimal import Decimal, InvalidOperation

import pdfplumber

from .base import BaseParser, PalletData, ParseResult

# ── Fingerprint ───────────────────────────────────────────────────────────────
_FINGERPRINT = re.compile(r"BWQCINReport")

# ── Date helpers ──────────────────────────────────────────────────────────────
_DATE_FULL  = re.compile(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})")   # 07/06/2026
_DATE_SHORT = re.compile(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})\b") # 08/06/26


def _parse_date(text: str) -> str | None:
    m = _DATE_FULL.search(text)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    m = _DATE_SHORT.search(text)
    if m:
        yr = int(m.group(3))
        return f"{2000 + yr}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    return None


def _parse_num(s: str) -> Decimal | None:
    s = re.sub(r"[°'°Cc]", "", s).strip().replace(",", ".")
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _re_first(text: str, *patterns: str) -> str | None:
    for pat in patterns:
        m = re.search(pat, text, re.I | re.MULTILINE)
        if m:
            return m.group(1).strip()
    return None


# ── Pallet row patterns ───────────────────────────────────────────────────────
# Both row types start with: {pallet_no}  {RAG_color}  ...
_RAG_COLORS = r"(Black|Red|Green|Amber|Blue|Grey)"
_PALLET_ROW = re.compile(
    r"^(\d{1,2})\s+" + _RAG_COLORS + r"\s+(.+)",
    re.I,
)

# SC map: digit → label
_SC_MAP = {"0": "SC0", "1": "SC1", "2": "SC2", "3": "SC3", "4": "SC4", "5": "SC5"}


class BWQCINParser(BaseParser):
    NAME    = "bwqcin_v1"
    VERSION = "1.0"

    def can_parse(self, text_sample: str) -> bool:
        return bool(_FINGERPRINT.search(text_sample))

    def parse(self, pdf_bytes: bytes) -> ParseResult:
        result = ParseResult(parser_name=self.NAME, parser_version=self.VERSION)
        result.confidence = 0.5

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            all_lines: list[str] = []
            for page in pdf.pages:
                text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                all_lines.extend(text.splitlines())

        full_text = "\n".join(all_lines)
        result.raw_text_excerpt = full_text[:2000]

        # ── Header fields ─────────────────────────────────────────────────────
        result.report_number    = _re_first(full_text, r"Consignment:\s*(\d+)")
        result.load_reference   = _re_first(full_text, r"Supplier\s+Ref:\s*([\w ]+?)(?=\n|Packhouse|$)")
        result.inspection_place = _re_first(full_text, r"Packhouse:\s*([\w]+)")
        result.product_name     = _re_first(full_text, r"Product:\s*(.+?)(?=\n)")
        result.client_name      = _re_first(full_text, r"Supplier:\s*(.+?)(?=\n)")
        result.grower_code      = _re_first(full_text, r"Grower:\s*(.+?)(?=\n)")
        result.origin_country   = _re_first(full_text, r"Origin:\s*\w+\s*\(\s*(.+?)\s*\)")
        result.container_number = _re_first(full_text, r"Lorry\s+Reg:\s*(.+?)(?=\n)")

        arr_raw = _re_first(full_text, r"Arrival\s+Date:\s*(.+?)(?=\n)")
        if arr_raw:
            result.inspection_date = _parse_date(arr_raw)

        temp_raw = _re_first(full_text, r"Arrivals?\s+Temperature:\s*([\d.]+)")
        if temp_raw:
            t = _parse_num(temp_raw)
            result.temperature = float(t) if t is not None else None

        # Total trays — last "Total: NNN" wins (avoids page-number matches)
        for m in re.finditer(r"Total:\s*(\d+)", full_text, re.I):
            try:
                result.total_cases = int(m.group(1))
            except ValueError:
                pass

        # ── Pallet data ───────────────────────────────────────────────────────
        pallets = _parse_pallet_breakdown(full_text)
        result.pallets = pallets

        if pallets:
            result.total_pallets = len({p.pallet_number for p in pallets})

        # ── Eating quality — enrich pallet measurements by variety ────────────
        eating = _parse_eating_quality(full_text)
        if eating and pallets:
            for pallet in pallets:
                for eq in eating:
                    v = eq.get("variety", "")
                    if v and pallet.variety_name and v.lower() in pallet.variety_name.lower():
                        for code, val in eq.items():
                            if code == "variety" or val is None:
                                continue
                            n = _parse_num(str(val)) if not isinstance(val, str) else None
                            pallet.measurements.append({
                                "parameter_code": code,
                                "parameter_name": code.replace("_", " ").title(),
                                "value_numeric": float(n) if n is not None else None,
                                "value_text": val if isinstance(val, str) else None,
                                "unit": "",
                                "source_column": code,
                            })

        # ── Confidence ────────────────────────────────────────────────────────
        if result.report_number:    result.confidence += 0.1
        if result.inspection_date:  result.confidence += 0.1
        if result.grower_code:      result.confidence += 0.05
        if pallets:                 result.confidence += 0.2
        result.confidence = min(result.confidence, 1.0)

        return result


# ── Pallet parsing ─────────────────────────────────────────────────────────────

def _parse_pallet_breakdown(full_text: str) -> list[PalletData]:
    """
    Parse the 'Pallet Break Down' section from raw extracted text.

    Black RAG rows (full rejection):
      "1 Black Reject Overmature 1, 2, 5, 7 120 RAS 20X150 [CP] [Diamond Jubilee] 120 Overmature 1,4,5,6"
       ↑ pal  ↑ rag  ↑ sc     ↑ defect   ↑ defect_nos        ↑ qty ↑ variety         ↑ rej  ↑ reason ↑ plot

    Red/non-Black RAG rows (downgrade, no rejection columns):
      "1 Red 5 Bleeding 2, 3 120 RAS 20X150 [CP] [Diamond Jubilee] 1,4,,5,6"
       ↑ pal ↑ ↑ sc    ↑ defect ↑ def_nos      ↑ qty ↑ variety              ↑ plot
    """
    pallets: list[PalletData] = []

    # Isolate just the Pallet Break Down section
    section_m = re.search(
        r"Pallet\s+Break\s+Down[^\n]*\n(.*?)"
        r"(?=\nGrower\s+Sort\s+Code|\nImages:|Defect\s+Break\s+Down[^\n]+\n\s*Waste\s+RAG\s+\(|$)",
        full_text, re.I | re.DOTALL,
    )
    if not section_m:
        return pallets

    section = section_m.group(1)

    for line in section.splitlines():
        line = line.strip()
        row_m = _PALLET_ROW.match(line)
        if not row_m:
            continue

        pallet_no = row_m.group(1)
        rag_color = row_m.group(2).capitalize()
        rest      = row_m.group(3).strip()

        # ── Variety: last [bracketed] token in the line ───────────────────────
        variety_m = re.search(r"\[([^\[\]]+)\](?!.*\[)", rest)
        variety   = variety_m.group(1).strip() if variety_m else None

        # ── Qty: integer immediately before "RAS" ─────────────────────────────
        qty_m = re.search(r"(\d+)\s+RAS\s+\S+", rest)
        qty   = int(qty_m.group(1)) if qty_m else None

        # ── Sort code ─────────────────────────────────────────────────────────
        if rag_color == "Black":
            sort_code = "Reject"
        else:
            sc_m      = re.match(r"(\d)\s+", rest)
            sort_code = _SC_MAP.get(sc_m.group(1), sc_m.group(1)) if sc_m else rag_color

        # ── Main defect: first word-sequence after the sort code token ────────
        if rag_color == "Black":
            defect_m = re.match(r"Reject\s+([A-Za-z][A-Za-z\s]+?)\s+[\d,]", rest, re.I)
        else:
            defect_m = re.match(r"\d\s+([A-Za-z][A-Za-z\s]+?)\s+[\d,]", rest)
        main_defect = defect_m.group(1).strip() if defect_m else None

        # ── Trailing fields after last ']' ────────────────────────────────────
        after_bracket = rest[rest.rfind("]") + 1:].strip() if "]" in rest else ""
        parts         = after_bracket.split()

        rejected_qty : int | None  = None
        reject_reason: str | None  = None
        plot_no      : str | None  = None

        if rag_color == "Black":
            # "120 Overmature 1,4,5,6"
            if parts and parts[0].isdigit():
                rejected_qty = int(parts[0])
            if len(parts) > 1 and re.match(r"^[A-Za-z]", parts[1]):
                reject_reason = parts[1]
            if len(parts) > 2:
                plot_no = parts[2]
        else:
            # "1,4,,5,6"  (plot no only)
            plot_no = after_bracket.strip() or None

        # ── Build PalletData ──────────────────────────────────────────────────
        pallet = PalletData(
            pallet_number=pallet_no,
            variety_name=variety,
            cases_count=qty,
            measurements=[
                {
                    "parameter_code": "waste_rag",
                    "parameter_name": "Waste RAG",
                    "value_numeric": None,
                    "value_text": rag_color,
                    "unit": "",
                    "source_column": "Waste RAG",
                },
                {
                    "parameter_code": "sort_code",
                    "parameter_name": "Sort Code",
                    "value_numeric": None,
                    "value_text": sort_code,
                    "unit": "",
                    "source_column": "Sort Code",
                },
            ],
        )

        if main_defect:
            pallet.measurements.append({
                "parameter_code": "main_defect",
                "parameter_name": "Main Defect",
                "value_numeric": None,
                "value_text": main_defect,
                "unit": "",
                "source_column": "Main Defect",
            })
        if rejected_qty is not None:
            pallet.measurements.append({
                "parameter_code": "rejected_qty",
                "parameter_name": "Rejected Qty",
                "value_numeric": float(rejected_qty),
                "value_text": None,
                "unit": "trays",
                "source_column": "Rejected",
            })
        if reject_reason:
            pallet.measurements.append({
                "parameter_code": "reject_reason",
                "parameter_name": "Reject Reason",
                "value_numeric": None,
                "value_text": reject_reason,
                "unit": "",
                "source_column": "Reject Reason",
            })
        if plot_no:
            pallet.measurements.append({
                "parameter_code": "plot_no",
                "parameter_name": "Plot No",
                "value_numeric": None,
                "value_text": plot_no,
                "unit": "",
                "source_column": "PlotNo",
            })

        pallets.append(pallet)

    return pallets


# ── Eating quality parsing ─────────────────────────────────────────────────────

def _parse_eating_quality(full_text: str) -> list[dict]:
    """
    Parse the Eating Quality section.
    Row format: "RAS 20X150  Amalia Rossa  5  5  42;60;48;49;40  33.04"
    Columns:    StockCode   Variety         Taste Texture Weight10   AvgBerries [DFAvg] [DFSD]
    """
    results: list[dict] = []

    eq_m = re.search(
        r"Eating\s+Quality[:\s]*(.*?)"
        r"(?=Foreign\s+Body|Packaging\s+and|Admin\s+Issues|Sort\s+Code\s+Summary|$)",
        full_text, re.I | re.DOTALL,
    )
    if not eq_m:
        return results

    for line in eq_m.group(1).splitlines():
        line = line.strip()
        # Skip header row
        if re.search(r"Taste|Texture|Weight|DF\s+Avg", line, re.I):
            continue
        # Must start with RAS (stock code)
        m = re.match(
            r"RAS\s+\S+\s+"           # stock code
            r"(.+?)\s+"               # variety (greedy up to first digit sequence)
            r"(\d)\s+(\d)\s+"         # taste  texture
            r"([\d;]+)\s+"            # weight_of_10 (semicolon-separated)
            r"([\d.]+)"               # avg_berries
            r"(?:\s+([\d.]+))?",      # df_avg (optional)
            line,
        )
        if not m:
            continue

        variety    = m.group(1).strip()
        taste      = int(m.group(2))
        texture    = int(m.group(3))
        w10_raw    = m.group(4)
        avg_weight = float(m.group(5))
        df_avg     = float(m.group(6)) if m.group(6) else None

        weights = [float(w) for w in w10_raw.split(";") if w.isdigit()]

        results.append({
            "variety":          variety,
            "taste_score":      taste,
            "texture_score":    texture,
            "avg_berry_weight": avg_weight,
            "df_avg":           df_avg,
            "weight_10_raw":    w10_raw,
        })

    return results
