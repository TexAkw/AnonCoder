from openai import OpenAI
import os
from dotenv import load_dotenv
import logging


logger = logging.getLogger(__name__)

load_dotenv()

class LLMServices:
    def __init__(self):
        pass

    def get_llm_service(self, model: str):
        if model in ["gpt-4o", "gpt-4o-mini"]:
            return OpenAIService(model)
        else:
            raise ValueError(f"Model {model} not supported")



class OpenAIService:
    def __init__(self, model: str):
        self.model = model
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        logger.info(f"[LLM] OPENAI SERVICE INITIALIZED FOR {self.model}")

    def call_llm(self, prompt: str):
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                stream=False
                )
            return {"content": response.choices[0].message.content, "prompt_tokens": response.usage.prompt_tokens, "completion_tokens": response.usage.completion_tokens}
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            raise e

