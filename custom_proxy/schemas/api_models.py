"""
API request and response models for the anonymization proxy service.

This module contains all Pydantic models used for API endpoints including
chat completions, anonymization, and their corresponding response models.
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal


class Message(BaseModel):
    """Message model for chat conversations."""
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    """Request model for chat completion endpoint."""
    model: str
    messages: List[Message]
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 1.0
    top_p: Optional[float] = 1.0
    n: Optional[int] = 1
    stop: Optional[List[str]] = None
    stream: Optional[bool] = False
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[Any] = None


class AnonymizeRequest(BaseModel):
    """Request model for text anonymization endpoint."""
    text: str


class AnonymizeResponse(BaseModel):
    """Response model for text anonymization endpoint."""
    original_text: str
    anonymized_text: str
    anonymization_map: Dict[str, str]


class ChatChoice(BaseModel):
    """Choice model for chat completion responses."""
    index: int
    message: Message
    finish_reason: str


class Usage(BaseModel):
    """Token usage information for API responses."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatResponse(BaseModel):
    """Response model for chat completion endpoint."""
    id: str
    object: str
    created: int
    model: str
    choices: List[ChatChoice]
    usage: Usage
