"""Abstract base class for all PDF report parsers.

Each client/template combination implements this contract.
The parse() method must return a ParseResult regardless of parser strategy.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ParseResult:
    """Normalized parser output contract — shared across all parsers."""

    # Shipment header
    header: dict[str, Any] = field(default_factory=dict)

    # Pallet-level rows (list of dicts, one dict per pallet)
    pallet_rows: list[dict[str, Any]] = field(default_factory=list)

    # Average container / summary row(s)
    summary_rows: list[dict[str, Any]] = field(default_factory=list)

    # Free-text notes from the report
    notes: list[str] = field(default_factory=list)

    # Confidence per field: {"field_name": 0.0-1.0}
    confidence: dict[str, float] = field(default_factory=dict)

    # Extraction warnings / errors (non-fatal)
    issues: list[dict[str, str]] = field(default_factory=list)

    # Source map for audit: {"field_name": {"page": 1, "bbox": [x0,y0,x1,y1]}}
    source_map: dict[str, Any] = field(default_factory=dict)

    # Overall parser confidence (0-100)
    overall_confidence: float = 0.0

    # Whether OCR was used
    ocr_used: bool = False

    # Number of pages processed
    page_count: int = 0

    # Parser identifier
    parser_key: str = ""
    parser_version: str = ""

    def add_issue(self, level: str, field: str, message: str) -> None:
        self.issues.append({"level": level, "field": field, "message": message})

    def to_json_payload(self) -> dict:
        """Serialize to the format stored in import_raw_payloads.payload_json."""
        return {
            "header": self.header,
            "pallet_rows": self.pallet_rows,
            "summary_rows": self.summary_rows,
            "notes": self.notes,
            "confidence": self.confidence,
            "overall_confidence": self.overall_confidence,
            "issues": self.issues,
            "source_map": self.source_map,
            "ocr_used": self.ocr_used,
            "page_count": self.page_count,
            "parser_key": self.parser_key,
            "parser_version": self.parser_version,
        }


class BaseParser(ABC):
    PARSER_KEY: str = "base"
    PARSER_VERSION: str = "1.0"

    def __init__(self, file_path: str):
        self.file_path = file_path

    @abstractmethod
    def parse(self) -> ParseResult:
        """Parse the file and return a ParseResult. Must not raise on recoverable errors;
        use result.add_issue() instead."""
        ...

    def _compute_confidence(self, result: ParseResult, expected_fields: list[str]) -> float:
        """Compute overall confidence as ratio of successfully extracted expected fields."""
        if not expected_fields:
            return 0.0
        found = sum(1 for f in expected_fields if result.header.get(f) or result.confidence.get(f, 0) > 0)
        return round((found / len(expected_fields)) * 100, 2)
