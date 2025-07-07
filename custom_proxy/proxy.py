from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import requests
import os
import logging
from dotenv import load_dotenv

from schemas import (
    ChatRequest,
    AnonymizeRequest,
    AnonymizeResponse,
)
from services import (
    NERService,
    TokenService,
    AnonymizationService,
    DLP,
)
from data_manager.stats_storer import PGStatsStorer
from generation.worker_generation import WorkerGeneration

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(dotenv_path=".proxy.env")


data_dlp = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    data_dlp["stats_storer"] = PGStatsStorer(os.getenv("POSTGRES_CONNECTION_STRING"))
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
dlp = DLP()


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
    anonymized_text, anonymization_map = dlp.anonymize(request.text)

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
    try:
        worker_generation = WorkerGeneration(data_dlp["stats_storer"], dlp)
        response = worker_generation.generate_response(request.messages, request.model, request.stream)
        return response
    except requests.RequestException as e:
        raise HTTPException(
            status_code=500, detail=f"Error from OpenAI: {str(e)}")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error from API: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app="proxy:app", host="0.0.0.0", port=7002, reload=True)
