"""
Parser registry — maps parser names to parser instances.
To add a new client parser: instantiate it here and add to PARSER_REGISTRY.
"""
from __future__ import annotations

from .base import BaseParser, ParseResult
from .agroberries_v1 import AgroberriesV1Parser
from .bwqcin_v1 import BWQCINParser

PARSER_REGISTRY: dict[str, BaseParser] = {
    AgroberriesV1Parser.NAME: AgroberriesV1Parser(),
    BWQCINParser.NAME:        BWQCINParser(),
}

_ORDERED: list[BaseParser] = list(PARSER_REGISTRY.values())


def get_parser(name: str) -> BaseParser | None:
    return PARSER_REGISTRY.get(name)


def detect_parser(text_sample: str) -> BaseParser | None:
    """Return the first parser that recognises the document, or None."""
    for parser in _ORDERED:
        if parser.can_parse(text_sample):
            return parser
    return None
