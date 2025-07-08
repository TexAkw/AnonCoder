from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import requests
import os
import logging
import sys
from dotenv import load_dotenv

from schemas import (
    ChatRequest,
    AnonymizeRequest,
    AnonymizeResponse,
)
from services import DLP
from data_manager.stats_storer import PGStatsStorer
from generation.worker_generation import WorkerGeneration

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(dotenv_path="custom_proxy/.proxy.env")


data_dlp = {}


def validate_environment_variables():
    """
    Validate that all required environment variables are set.
    Returns a list of missing variables.
    """
    required_vars = [
        "POSTGRES_CONNECTION_STRING",
        "OPENAI_API_KEY",
        "NER_API_KEY",
        "NER_API_BASE",
    ]

    missing_vars = []
    for var in required_vars:
        value = os.getenv(var)
        if not value or value.strip() == "":
            missing_vars.append(var)

    return missing_vars


def print_environment_setup_guide(missing_vars):
    """
    Print a comprehensive guide for setting up missing environment variables.
    """
    print("\n" + "="*80)
    print("🚨 APPLICATION STARTUP FAILED - ENVIRONMENT CONFIGURATION ERROR")
    print("="*80)
    print("\nThe following required environment variables are missing or empty:")
    print()

    for var in missing_vars:
        print(f"  ❌ {var}")

    print("\n" + "-"*80)
    print("📋 SETUP INSTRUCTIONS")
    print("-"*80)
    print()
    print("1. Create the environment file:")
    print("   cp custom_proxy/.proxy.env.example custom_proxy/.proxy.env")
    print()
    print("2. Edit the .proxy.env file and provide values for:")
    print()

    var_descriptions = {
        "POSTGRES_CONNECTION_STRING": "PostgreSQL database connection string\n    Example: postgresql://user:password@localhost:5432/dbname",
        "OPENAI_API_KEY": "Your OpenAI API key for chat completions\n   Example: sk-abc123...",
        "NER_API_KEY": "API key for Named Entity Recognition service\n    Example: your-ner-api-key",
        "NER_API_BASE": "Base URL for NER service\n    Example: https://api.ner-service.com/v1",
        "OPENAI_API_BASE": "OpenAI API base URL (optional)\n    Example: https://api.openai.com/v1"
    }

    for var in missing_vars:
        description = var_descriptions.get(var, "Required environment variable")
        print(f"   • {var}")
        print(f"     {description}")
        print()

    print("3. Ensure your PostgreSQL database is running and accessible")
    print()
    print("4. Restart the application after setting up the environment file")
    print()
    print("-"*80)
    print("💡 TIP: You can also set these variables directly in your shell:")
    print("   export POSTGRES_CONNECTION_STRING='your-connection-string'")
    print("   export OPENAI_API_KEY='your-api-key'")
    print("   # ... etc")
    print()
    print("="*80)
    print()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate environment variables before attempting to initialize services
    missing_vars = validate_environment_variables()

    if missing_vars:
        print_environment_setup_guide(missing_vars)
        logger.error("Application startup failed due to missing environment variables")
        # Exit gracefully instead of crashing with a stack trace
        sys.exit(1)

    try:
        logger.info("Initializing application services...")
        stats_storer = PGStatsStorer(os.getenv("POSTGRES_CONNECTION_STRING"))
        data_dlp["stats_storer"] = stats_storer
        data_dlp["dlp"] = DLP(stats_storer)
        logger.info("Application services initialized successfully")
        yield
    except Exception as e:
        logger.error(f"Failed to initialize application services: {str(e)}")
        print("\n" + "="*80)
        print("🚨 SERVICE INITIALIZATION ERROR")
        print("="*80)
        print(f"\nError details: {str(e)}")
        print("\nThis usually indicates:")
        print("  • Database connection issues")
        print("  • Invalid connection string format")
        print("  • Database server not running")
        print("  • Network connectivity problems")
        print("\nPlease check your POSTGRES_CONNECTION_STRING and ensure the database is accessible.")
        print("="*80)
        print()
        sys.exit(1)
    finally:
        logger.info("Clearing DLP")
        data_dlp.clear()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    anonymized_text, anonymization_map = data_dlp["dlp"].anonymize(
        request.text)

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

    logger.info("=================== LAST USER MESSAGE ===================")
    logger.info(last_user_message)

    try:
        worker_generation = WorkerGeneration(
            data_dlp["stats_storer"], data_dlp["dlp"])
        response = worker_generation.generate_response(
            request.messages, request.model, request.stream)
        return response
    except requests.RequestException as e:
        raise HTTPException(
            status_code=500, detail=f"Error from OpenAI API: {str(e)}")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error from API: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app="proxy:app", host="0.0.0.0", port=7002, reload=True)
