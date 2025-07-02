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
import os
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import logging
from dlp import DLP
from contextlib import asynccontextmanager
import tiktoken

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

data_dlp = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    data_dlp["dlp"] = DLP()
    yield
    logging.info("Clearing DLP")
    data_dlp.clear()

app = FastAPI(lifespan=lifespan)

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

    # Replace URLs
    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]*'
    urls = re.findall(url_pattern, text)
    for i, url in enumerate(urls):
        placeholder = f"[URL_{i+1}]"
        anonymization_map[placeholder] = url
        anonymized = anonymized.replace(url, placeholder)

    # Replace hardcoded sensitive key
    if "SuperSecretKey" in anonymized:
        placeholder = "[SECRET_1]"
        anonymization_map[placeholder] = "SuperSecretKey"
        anonymized = anonymized.replace("SuperSecretKey", placeholder)

    return anonymized, anonymization_map


def apply_ner(text: str) -> tuple[str, Dict[str, str]]:
    """
    Anonymize text by replacing PII with placeholders.
    """
    url = os.getenv("NER_API_BASE")
    api_key = os.getenv("NER_API_KEY")
    print("================ NER REQUEST ==================")
    print(text)

    headers = {
        "apiKey": f"{api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "flat_ner": True,
        "text": text,
        "labels": [
            {
                "label": "ORGANIZATION",
                "threshold": 0.9
            },
            {
                "label": "LOCATION",
                "threshold": 0.8
            },
            {
                "label": "url",
                "threshold": 0.5
            },
            {
                "label": "secret",
                "threshold": 0.8
            },
            {
                "label": "ip adress",
                "threshold": 0.9
            },
            {
                "label": "api key",
                "threshold": 0.5
            },
            {
                "label": "api token",
                "threshold": 0.5
            },
            {
                "label": "oauth token",
                "threshold": 0.5
            },
            {
                "label": "bearer token",
                "threshold": 0.5
            },
            {
                "label": "jwt token",
                "threshold": 0.5
            },
            {
                "label": "authentication token",
                "threshold": 0.5
            },
            {
                "label": "secret key",
                "threshold": 0.5
            },
            {
                "label": "private key",
                "threshold": 0.5
            },
            {
                "label": "encryption key",
                "threshold": 0.5
            },
            {
                "label": "git token",
                "threshold": 0.5
            },
            {
                "label": "username",
                "threshold": 0.5
            },
            {
                "label": "password",
                "threshold": 0.5
            },
            {
                "label": "uuid",
                "threshold": 0.5
            },
            {
                "label": "cookie id",
                "threshold": 0.5
            },
            {
                "label": "ip address",
                "threshold": 0.5
            },
            {
                "label": "port number",
                "threshold": 0.5
            },
            {
                "label": "mac address",
                "threshold": 0.5
            },
            {
                "label": "wallet address",
                "threshold": 0.3
            },
            {
                "label": "bitcoin",
                "threshold": 0.3
            }
        ],
        "multi_label": False,
        "recognitions_defs": [
            {
                "label": "DATE",
                "pattern": "\\d{4}-\\d{2}-\\d{2}"
            },
            {
                "label": "github token",
                "pattern": "\\b(gh[psouru]_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\\b"
            },
            {
                "label": "ip address",
                "pattern": "\\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b"
            },
            {
                "label": "bitcoin",
                "pattern": "\\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\\b"
            },
            {
                "label": "url",
                "pattern": "\\b(?:https?|ftp|ssh|file):\\/\\/[-a-zA-Z0-9+&@#\\/%?=~_!:,.;]*[-a-zA-Z0-9+&@#\\/%=~_]"
            }
        ]
    }
    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Error from API: {response.status_code}")
            return None
    except Exception as e:
        logger.error(f"Error from API: {str(e)}")
        return None


def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """
    Count tokens in text using tiktoken for accurate token counting.
    Uses gpt-4o encoding which is appropriate for GPT-4o mini.
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except KeyError:
        # Fallback to gpt-4o encoding if specific model not found
        encoding = tiktoken.encoding_for_model("gpt-4o")
        return len(encoding.encode(text))


def count_messages_tokens(messages: List[Message], model: str = "gpt-4o") -> int:
    """
    Count tokens for a list of messages, accounting for message formatting.
    Based on OpenAI's token counting methodology.
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.encoding_for_model("gpt-4o")

    num_tokens = 0
    for message in messages:
        # Every message follows <|im_start|>{role/name}\n{content}<|im_end|>\n
        num_tokens += 4  # Base tokens for message formatting
        num_tokens += len(encoding.encode(message.role))
        num_tokens += len(encoding.encode(message.content))

    num_tokens += 2  # Every reply is primed with <|im_start|>assistant
    return num_tokens


@app.post("/v1/clear-dlp")
async def clear_dlp():
    """
    Clear all DLP data and reset counters for fresh start.
    """
    try:
        data_dlp["dlp"].clear_data()
        logger.info("DLP data cleared successfully")
        return {"message": "DLP data cleared successfully"}
    except Exception as e:
        logger.error(f"Error clearing DLP data: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error clearing DLP data: {str(e)}")


@app.post("/v1/anonymize", response_model=AnonymizeResponse)
async def anonymize(request: AnonymizeRequest):
    """
    Anonymize text by replacing PII with placeholders.
    """
    response = apply_ner(request.text)
    print("================ NER RESPONSE ==================")
    print(response)
    if response is None:
        raise HTTPException(
            status_code=500, detail="Error from API")
    anonymized_text, anonymization_map = data_dlp["dlp"].apply_dlp(
        request.text, response)

    return AnonymizeResponse(
        original_text=request.text,
        anonymized_text=anonymized_text,
        anonymization_map=anonymization_map
    )


@app.post("/v1/chat/completions")
async def chat_completion(request: ChatRequest):
    """
    OpenAI-compatible chat completion endpoint that forwards requests to the OpenAI API.

    System Prompt: You are an advanced AI language model specialized in answering user questions clearly, accurately, and helpfully. Your primary responsibility is to provide relevant, concise, and grammatically correct answers.\n Always reply in the same language as the user's input. Do not generate random characters, gibberish, emojis, or irrelevant content. Stay on topic, be factual, and avoid repetition.\n If a question is unclear or cannot be answered truthfully, respond honestly and do not make up information.\n <[ and ]> are used to anonymize sensitive information. When you see these tags, you must keep the information unchanged, including all characters, spacing, and formatting. If these tags are not present, no specific action is required.")
    """
    # Extract the last user message to send to the model
    last_user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            last_user_message = msg.content
            break

    if not last_user_message:
        raise HTTPException(
            status_code=400, detail="No user message found in the request")

    # Count tokens accurately using tiktoken
    prompt_tokens = count_messages_tokens(request.messages, request.model)

    try:
        # Get API key from environment
        api_key = os.getenv("OPENAI_API_KEY")

        # Set up headers with API key
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        # Make chat completion request
        chat_response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an advanced AI language model specialized in answering user questions clearly, accurately, and helpfully. Your primary responsibility is to provide relevant, concise, and grammatically correct answers.\n Always reply in the same language as the user's input. Do not generate random characters, gibberish, emojis, or irrelevant content. Stay on topic, be factual, and avoid repetition.\n If a question is unclear or cannot be answered truthfully, respond honestly and do not make up information.\n <[ and ]> are used to anonymize sensitive information. When you see these tags, you must keep the information unchanged, including all characters, spacing, and formatting. If these tags are not present, no specific action is required."
                    },
                    {
                        "role": "user",
                        "content": last_user_message
                    }
                ]
            }
        )

        chat_response.raise_for_status()

        if chat_response.status_code != 200:
            raise HTTPException(
                status_code=chat_response.status_code,
                detail=f"Error from OpenAI API: {chat_response.text}"
            )

        response_data = chat_response.json()
        anonymized_response = response_data["choices"][0]["message"]["content"]

        dlp = data_dlp["dlp"]
        final_response = dlp.deanonymize(anonymized_response)
        print("================ FINAL RESPONSE ==================")
        print(final_response)
        completion_tokens = count_tokens(final_response, request.model)

        print(
            f"================ PROMPT TOKENS: {prompt_tokens} ==================")
        print(
            f"================ COMPLETION TOKENS: {completion_tokens} ==================")
        print(
            f"================ TOTAL TOKENS: {prompt_tokens + completion_tokens} ==================")

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
                            "delta": {"role": "assistant", "content": anonymized_response},
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
    except requests.RequestException as e:
        raise HTTPException(
            status_code=500, detail=f"Error from OpenAI: {str(e)}")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error from API: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7002)
