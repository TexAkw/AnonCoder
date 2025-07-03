from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time
import uuid
import json
import uvicorn
import requests
import os
import logging
from dotenv import load_dotenv

from dlp import DLP
from schemas import (
    Message,
    ChatRequest,
    AnonymizeRequest,
    AnonymizeResponse,
    ChatChoice,
    Usage,
    ChatResponse,
)
from services import (
    NERService,
    TokenService,
    AnonymizationService,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(dotenv_path=".proxy.env")


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


# Initialize services
ner_service = NERService()
token_service = TokenService()
anonymization_service = AnonymizationService()


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
    Anonymize text by replacing PII with placeholders using NER service.
    """
    ner_response = ner_service.apply_ner(request.text)
    logger.info("=================== NER RESPONSE ===================")
    logger.info(ner_response)

    if ner_response is None:
        raise HTTPException(
            status_code=500, detail="Error from NER API")

    anonymized_text, anonymization_map = data_dlp["dlp"].apply_dlp(
        request.text, ner_response)

    return AnonymizeResponse(
        original_text=request.text,
        anonymized_text=anonymized_text,
        anonymization_map=anonymization_map
    )


@app.post("/v1/chat/completions")
async def chat_completion(request: ChatRequest):
    """
    OpenAI-compatible chat completion endpoint that forwards requests to the OpenAI API.
    """
    last_user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            last_user_message = msg.content
            break

    if not last_user_message:
        raise HTTPException(
            status_code=400, detail="No user message found in the request")

    try:
        url = os.getenv("OPENAI_API_BASE")
        api_key = os.getenv("OPENAI_API_KEY")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        chat_response = requests.post(
            url=url,
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
        logger.info("=================== FINAL RESPONSE ===================")
        logger.info(final_response)

        prompt_tokens = token_service.count_messages_tokens(
            request.messages, request.model)
        completion_tokens = token_service.count_tokens(
            final_response, request.model)

        logger.info(f"PROMPT TOKENS: {prompt_tokens}")
        logger.info(f"COMPLETION TOKENS: {completion_tokens}")
        logger.info(f"TOTAL TOKENS: {prompt_tokens + completion_tokens}")

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
    except requests.RequestException as e:
        raise HTTPException(
            status_code=500, detail=f"Error from OpenAI: {str(e)}")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error from API: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app="proxy:app", host="0.0.0.0", port=7002, reload=True)
