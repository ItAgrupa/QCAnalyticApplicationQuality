"""Abstract base class for all PDF report parsers."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


@dataclass
class PalletData:
    pallet_number: str
    grower_code: str | None = None
    ggn: str | None = None
    packing_date: str | None = None          # ISO date string YYYY-MM-DD
    variety_name: str | None = None
    packaging_name: str | None = None
    cases_count: int | None = None
    weight: Decimal | None = None
    measurements: list[dict[str, Any]] = field(default_factory=list)
    # Each measurement: {parameter_code, parameter_name, value_numeric, value_text, unit, source_column}


@dataclass
class ParseResult:
    """Normalised output from any parser. Stored verbatim in import_raw_payloads.payload_json."""

    parser_name: str
    parser_version: str
    ocr_used: bool = False
    confidence: float = 1.0         # 0.0–1.0

    # Header / load-level fields
    report_number: str | None = None
    load_reference: str | None = None
    inspection_date: str | None = None      # ISO date YYYY-MM-DD
    inspection_place: str | None = None
    client_name: str | None = None
    origin_country: str | None = None
    product_name: str | None = None
    variety_name: str | None = None
    packaging_name: str | None = None
    total_cases: int | None = None
    total_pallets: int | None = None
    total_weight: Decimal | None = None
    container_number: str | None = None
    vessel_name: str | None = None
    grower_code: str | None = None
    ggn: str | None = None
    temperature: float | None = None

    pallets: list[PalletData] = field(default_factory=list)
    raw_text_excerpt: str = ""          # First 2000 chars of extracted text (for debugging)

    def to_dict(self) -> dict[str, Any]:
        import dataclasses, decimal
        def _clean(obj: Any) -> Any:
            if isinstance(obj, decimal.Decimal):
                return float(obj)
            if isinstance(obj, dict):
                return {k: _clean(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_clean(i) for i in obj]
            if dataclasses.is_dataclass(obj):
                return {k: _clean(v) for k, v in dataclasses.asdict(obj).items()}
            return obj
        return _clean(dataclasses.asdict(self))


class BaseParser(ABC):
    NAME: str = "base"
    VERSION: str = "0.0"

    @abstractmethod
    def can_parse(self, text_sample: str) -> bool:
        """Return True if this parser recognises the document format."""

    @abstractmethod
    def parse(self, pdf_bytes: bytes) -> ParseResult:
        """Parse the full PDF and return a ParseResult."""
