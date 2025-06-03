from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time
import uuid
from fastapi.responses import StreamingResponse
import json
import uvicorn
import requests

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

@app.post("/v1/chat/completions")
async def chat_completion(request: ChatRequest):
    """
    OpenAI-compatible chat completion endpoint that forwards requests to the BoSL AI API.
    """
    # Extract the last user message to send to BoSL AI
    last_user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            last_user_message = msg.content
            break
    
    if not last_user_message:
        raise HTTPException(status_code=400, detail="No user message found in the request")
    
    # Count token estimates for logging
    prompt_tokens = sum(len(msg.content.split()) for msg in request.messages)
    
    # Send the message to BoSL AI
    try:
        print(last_user_message)
        # Call the send_message function from api_boslai4
        #request_api = requests.post("http://localhost:7001/send-to-websocket/", params={"message": last_user_message})
        #response_api = request_api.json()
        #status = response_api["status"]
        #assistant_response = response_api["response_clean"]
        #print(assistant_response)
        #assistant_response_anonymized = response_api["response_anonymized"]
        #print(assistant_response_anonymized)
        #final_response = f"**Réponse anonymisée**\n\n{assistant_response_anonymized}\n\n**Réponse non anonymisée**\n\n{assistant_response}"

        final_response = "test" #assistant_response if 1 == 0 else assistant_response_anonymized
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
        raise HTTPException(status_code=500, detail=f"Error from API: {str(e)}")
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7002)
