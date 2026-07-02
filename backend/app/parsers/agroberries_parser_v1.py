"""Agroberries Quality Report Parser v1.

Targets machine-generated PDFs from the Agroberries inspection system.
Extraction strategy:
  1. pdfplumber for text and table extraction
  2. PyMuPDF for structural/layout analysis
  3. Column matching by header name (not position)

Phase 1: skeleton only.
Phase 4: full extraction implementation.
"""
import logging
from pathlib import Path

from app.parsers.base_parser import BaseParser, ParseResult

logger = logging.getLogger(__name__)

PARSER_KEY = "agroberries_quality_report_v1"
PARSER_VERSION = "1.0.0"

# Expected header fields — used for confidence calculation
EXPECTED_HEADER_FIELDS = [
    "consignee",
    "inspection_place",
    "inspection_date",
    "origin",
    "total_cases",
    "shipper",
    "load_reference",
    "container_number",
]

# Expected pallet table column headers (Agroberries naming)
PALLET_COLUMN_ALIASES: dict[str, list[str]] = {
    "pallet_number": ["Pal.", "Pallet", "P."],
    "grower_code": ["Grower", "Prod.", "Producer"],
    "ggn": ["GGN"],
    "variety": ["Variety", "Var."],
    "packaging": ["Packaging", "Pack.", "Type"],
    "cases_count": ["Cases", "Boxes", "Cs."],
    "weight": ["Weight", "Wt.", "Kg"],
    "sample_net_weight": ["Sample", "Net wt."],
    "size_min": ["Size min", "Size\nmin"],
    "size_max": ["Size max", "Size\nmax"],
    "brix": ["Brix", "°Brix"],
    "bloom": ["Bloom", "Bloom %"],
    "shrivel": ["Shrivel", "Shri."],
    "red": ["Red", "Red %"],
    "firmness_lt60": ["<60", "Firm <60"],
    "firmness_60_70": ["60-70", "Firm 60-70"],
    "firmness_gt70": [">70", "Firm >70"],
    "mold": ["Mold", "Mould"],
    "decay": ["Decay", "Dec."],
    "leakers": ["Leakers", "Leak."],
    "other_defect_name": ["Other", "Defect"],
    "other_defect_pct": ["Other %", "Def. %"],
    "q_score": ["Q"],
    "cs_score": ["CS", "C.S."],
    "comments": ["Comments", "Remarks"],
}


class AgroberriesParserV1(BaseParser):
    PARSER_KEY = PARSER_KEY
    PARSER_VERSION = PARSER_VERSION

    def parse(self) -> ParseResult:
        result = ParseResult(
            parser_key=self.PARSER_KEY,
            parser_version=self.PARSER_VERSION,
        )

        path = Path(self.file_path)
        if not path.exists():
            result.add_issue("error", "file", f"File not found: {self.file_path}")
            return result

        try:
            import pdfplumber
            with pdfplumber.open(self.file_path) as pdf:
                result.page_count = len(pdf.pages)

                # Minimum text check — if very little text, flag for OCR
                all_text = "".join(p.extract_text() or "" for p in pdf.pages)
                if len(all_text.strip()) < 100:
                    result.add_issue("error", "file", "OCR_REQUIRED: insufficient text in PDF")
                    result.ocr_used = False
                    return result

                self._extract_header(pdf, result)
                self._extract_pallet_table(pdf, result)
                self._extract_summary(pdf, result)

        except ImportError:
            result.add_issue("error", "file", "pdfplumber not installed")
        except Exception as exc:
            logger.exception(f"Agroberries parser error: {exc}")
            result.add_issue("error", "file", f"Parser exception: {exc}")

        # Compute confidence
        result.overall_confidence = self._compute_confidence(result, EXPECTED_HEADER_FIELDS)
        return result

    def _extract_header(self, pdf, result: ParseResult) -> None:
        """Extract shipment header from page 1.
        Phase 4 will implement full regex-based extraction.
        """
        first_page_text = pdf.pages[0].extract_text() or ""
        result.header["_raw_page1_text"] = first_page_text[:2000]
        result.add_issue("warning", "header", "Header extraction not yet implemented (Phase 4)")

    def _extract_pallet_table(self, pdf, result: ParseResult) -> None:
        """Extract pallet rows from the main quality table.
        Phase 4 will implement column-mapping based extraction.
        """
        result.add_issue("warning", "pallet_table", "Pallet table extraction not yet implemented (Phase 4)")

    def _extract_summary(self, pdf, result: ParseResult) -> None:
        """Extract Average Container summary row and temperature/condition notes.
        Phase 4 will implement full extraction.
        """
        result.add_issue("warning", "summary", "Summary extraction not yet implemented (Phase 4)")
