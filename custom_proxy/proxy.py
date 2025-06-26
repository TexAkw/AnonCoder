from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time
import uuid
from fastapi.responses import StreamingResponse
import json
import uvicorn
import requests
import re

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model for OpenAI-compatible API


class Message(BaseModel):
    role: str  # "user", "assistant", or "system"
    content: str


class ChatRequest(BaseModel):
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

# New models for anonymization endpoint


class AnonymizeRequest(BaseModel):
    text: str


class AnonymizeResponse(BaseModel):
    original_text: str
    anonymized_text: str
    anonymization_map: Dict[str, str]

# Response model for OpenAI-compatible API


class ChatChoice(BaseModel):
    index: int
    message: Message
    finish_reason: str


class Usage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatResponse(BaseModel):
    id: str
    object: str
    created: int
    model: str
    choices: List[ChatChoice]
    usage: Usage


def anonymize_text(text: str) -> tuple[str, Dict[str, str]]:
    """
    Simple anonymization function that replaces common PII patterns.
    Returns anonymized text and a mapping of replacements.
    """
    anonymization_map = {}
    anonymized = text

    # Replace email addresses
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    emails = re.findall(email_pattern, text)
    for i, email in enumerate(emails):
        placeholder = f"[EMAIL_{i+1}]"
        anonymization_map[placeholder] = email
        anonymized = anonymized.replace(email, placeholder)

    # Replace phone numbers (simple pattern)
    phone_pattern = r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'
    phones = re.findall(phone_pattern, text)
    for i, phone in enumerate(phones):
        placeholder = f"[PHONE_{i+1}]"
        anonymization_map[placeholder] = phone
        anonymized = anonymized.replace(phone, placeholder)

    # Replace names (very basic - looks for capitalized words that might be names)
    # This is a simple heuristic and should be improved for production
    name_pattern = r'\b[A-Z][a-z]+ [A-Z][a-z]+\b'
    potential_names = re.findall(name_pattern, text)
    for i, name in enumerate(potential_names):
        # Skip common words that might be false positives
        if name not in ["United States", "New York", "Los Angeles", "San Francisco"]:
            placeholder = f"[NAME_{i+1}]"
            anonymization_map[placeholder] = name
            anonymized = anonymized.replace(name, placeholder)

    # Replace IP addresses
    ip_pattern = r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'
    ips = re.findall(ip_pattern, text)
    for i, ip in enumerate(ips):
        placeholder = f"[IP_{i+1}]"
        anonymization_map[placeholder] = ip
        anonymized = anonymized.replace(ip, placeholder)

    return anonymized, anonymization_map


@app.post("/v1/anonymize", response_model=AnonymizeResponse)
async def anonymize(request: AnonymizeRequest):
    """
    Anonymize text by replacing PII with placeholders.
    """
    anonymized_text, anonymization_map = anonymize_text(request.text)

    return AnonymizeResponse(
        original_text=request.text,
        anonymized_text=anonymized_text,
        anonymization_map=anonymization_map
    )


@app.post("/v1/chat/completions")
async def chat_completion(request: ChatRequest):
    """
    OpenAI-compatible chat completion endpoint that forwards requests to the BoSL AI API.
    """
    # Extract the last user message to send to Bosl.ai
    last_user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            last_user_message = msg.content
            break

    if not last_user_message:
        raise HTTPException(
            status_code=400, detail="No user message found in the request")

    # Count token estimates for logging
    prompt_tokens = sum(len(msg.content.split()) for msg in request.messages)

    try:
        print(last_user_message)

        final_response = "test"
        completion_tokens = len(final_response.split()) // 4

        # Handle streaming if requested
        if request.stream:
            def generate():
                data = {
                    "id": f"chatcmpl-{uuid.uuid4().hex}",
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": request.model,
                    "choices": [
                        {
                            "delta": {"role": "assistant", "content": final_response},
                            "index": 0,
                            "finish_reason": None
                        }
                    ]
                }
                # Send one chunk
                yield f"data: {json.dumps(data)}\n\n"

                # End of stream
                yield "data: [DONE]\n\n"

            return StreamingResponse(generate(), media_type="text/event-stream")

        # Return regular response
        return ChatResponse(
            id=f"chatcmpl-{uuid.uuid4().hex}",
            object="chat.completion",
            created=int(time.time()),
            model=request.model,
            choices=[
                ChatChoice(
                    index=0,
                    message=Message(role="assistant", content=final_response),
                    finish_reason="stop"
                )
            ],
            usage=Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens
            )
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error from API: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7002)
