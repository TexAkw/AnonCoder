"""
Schemas package for the anonymization proxy service.

This package contains all data models, configuration classes, and schemas
used throughout the application.
"""

# Import all API models
from .api_models import (
    Message,
    ChatRequest,
    AnonymizeRequest,
    AnonymizeResponse,
    ChatChoice,
    Usage,
    ChatResponse,
)

# Import all NER configuration classes
from .ner_config import (
    Label,
    RecognitionDef,
    NERConfig,
)

__all__ = [
    # API Models
    "Message",
    "ChatRequest",
    "AnonymizeRequest",
    "AnonymizeResponse",
    "ChatChoice",
    "Usage",
    "ChatResponse",
    # NER Configuration
    "Label",
    "RecognitionDef",
    "NERConfig",
]
