from typing import List
from schemas import Message
from fastapi import HTTPException
import time
import uuid
import json
from fastapi.responses import StreamingResponse
from schemas import ChatResponse, ChatChoice, Usage
from services import DLP, LLMServices
from data_manager.stats_storer import PGStatsStorer
import logging

logger = logging.getLogger(__name__)


class WorkerGeneration:
    def __init__(self, stats_storer: PGStatsStorer, dlp: DLP):
        self.stats_storer = stats_storer
        self.dlp = dlp

    def get_last_user_message(self, messages: List[Message]):
        for msg in reversed(messages):
            if msg.role == "user":
                return msg.content
        return None

    def call_llm_service(self, messages: List[Message], model: str):
        try:
            start_time = time.time()
            last_user_message = self.get_last_user_message(messages)

        except Exception as e:
            logger.error(f"ERROR: {e}")
            raise HTTPException(status_code=500, detail=str(e))

        finally:
            if not last_user_message:
                raise HTTPException(
                    status_code=400, detail="No user message found in the request")

        try:
            llm_service = LLMServices().get_llm_service(model)
        except ValueError as e:
            logger.error(f"ERROR: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"ERROR: {e}")
            raise HTTPException(status_code=500, detail=str(e))

        try:
            response = llm_service.call_llm(last_user_message)
        except Exception as e:
            logger.error(f"ERROR: {e}")
            raise HTTPException(status_code=500, detail=str(e))

        end_time = time.time()
        llm_time = (end_time - start_time) * 1000
        anonymized_response = response["content"]
        prompt_tokens = response["prompt_tokens"]
        completion_tokens = response["completion_tokens"]
        info = {
            "anonymized_prompt": last_user_message,
            "anonymized_response": anonymized_response,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "llm_time": llm_time
        }
        return info

    def deanonymize(self, anonymized_response: str):
        start_deanonymization_time = time.time()
        deanonymized_response = self.dlp.deanonymize(anonymized_response)
        end_deanonymization_time = time.time()
        dlp_deanonymization_time = (
            end_deanonymization_time - start_deanonymization_time) * 1000
        return deanonymized_response, dlp_deanonymization_time

    def generate_response(self, messages: List[Message], model: str, stream: bool = False):

        try:
            llm_info = self.call_llm_service(messages, model)
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        anonymized_response = llm_info["anonymized_response"]
        prompt_tokens = llm_info["prompt_tokens"]
        completion_tokens = llm_info["completion_tokens"]
        llm_time = llm_info["llm_time"]

        try:
            deanonymized_response, dlp_deanonymization_time = self.deanonymize(
                anonymized_response)
        except HTTPException as e:
            logger.error(f"ERROR: {e}")
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            logger.error(f"ERROR: {e}")
            raise HTTPException(status_code=500, detail=str(e))

        logger.info("=================== FINAL RESPONSE ===================")
        logger.info(f"DEANONYMIZED RESPONSE: {deanonymized_response}")
        logger.info(f"PROMPT TOKENS: {prompt_tokens}")
        logger.info(f"COMPLETION TOKENS: {completion_tokens}")
        logger.info(f"TOTAL TOKENS: {prompt_tokens + completion_tokens}")

        stats = {
            "id": uuid.uuid4(),
            "anonymized_prompt": llm_info["anonymized_prompt"],
            "anonymized_response": anonymized_response,
            "clean_response": deanonymized_response,
            "response_tokens": completion_tokens,
            "anonymized_tokens": prompt_tokens,
            "llm_time": llm_time,
            "dlp_deanonymization_time": dlp_deanonymization_time
        }

        self.stats_storer.store_stats_llm(stats)

        # Handle streaming if requested
        if stream:
            return StreamingResponse(self.generate_stream(deanonymized_response, model), media_type="text/event-stream")

        # Return regular response
        return self.make_response(deanonymized_response, model, prompt_tokens, completion_tokens)

    def generate_stream(self, response: str, model: str):
        data = {
            "id": f"chatcmpl-{uuid.uuid4().hex}",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "delta": {"role": "assistant", "content": response},
                    "index": 0,
                    "finish_reason": None
                }
            ]
        }
        # Send one chunk
        yield f"data: {json.dumps(data)}\n\n"

        # End of stream
        yield "data: [DONE]\n\n"

    def make_response(self, response: str, model: str, prompt_tokens: int, completion_tokens: int):
        return ChatResponse(
            id=f"chatcmpl-{uuid.uuid4().hex}",
            object="chat.completion",
            created=int(time.time()),
            model=model,
            choices=[
                ChatChoice(
                    index=0,
                    message=Message(role="assistant", content=response),
                    finish_reason="stop"
                )
            ],
            usage=Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens
            )
        )
