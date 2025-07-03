"""
NER (Named Entity Recognition) configuration classes and data structures.

This module contains all the configuration for the NER system including
labels with thresholds and recognition patterns.
"""

from dataclasses import dataclass
from typing import List


@dataclass
class Label:
    """Data class for NER labels with thresholds."""
    label: str
    threshold: float


@dataclass
class RecognitionDef:
    """Data class for NER recognition definitions with patterns."""
    label: str
    pattern: str


class NERConfig:
    """Configuration class containing all NER labels and recognition definitions."""

    LABELS: List[Label] = [
        Label("ORGANIZATION", 0.9),
        Label("LOCATION", 0.8),
        Label("url", 0.5),
        Label("secret", 0.8),
        Label("ip adress", 0.9),
        Label("api key", 0.5),
        Label("api token", 0.5),
        Label("oauth token", 0.5),
        Label("bearer token", 0.5),
        Label("jwt token", 0.5),
        Label("authentication token", 0.5),
        Label("secret key", 0.5),
        Label("private key", 0.5),
        Label("encryption key", 0.5),
        Label("git token", 0.5),
        Label("username", 0.5),
        Label("password", 0.5),
        Label("uuid", 0.5),
        Label("cookie id", 0.5),
        Label("ip address", 0.5),
        Label("port number", 0.5),
        Label("mac address", 0.5),
        Label("wallet address", 0.3),
        Label("bitcoin", 0.3),
    ]

    RECOGNITION_DEFS: List[RecognitionDef] = [
        RecognitionDef("date", r"\d{4}-\d{2}-\d{2}"),
        RecognitionDef(
            "github token", r"\b(gh[psouru]_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b"),
        RecognitionDef(
            "ip address", r"\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b"),
        RecognitionDef("bitcoin", r"\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b"),
    ]
