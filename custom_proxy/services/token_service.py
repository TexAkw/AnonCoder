"""
Token counting service for calculating tokens in text and messages.

This service provides utilities for accurate token counting using tiktoken,
which is essential for API usage tracking and billing calculations.
"""

import tiktoken
import logging
from typing import List

from schemas import Message

logger = logging.getLogger(__name__)


class TokenService:
    """Service for handling token counting operations."""

    @staticmethod
    def count_tokens(text: str, model: str = "gpt-4o") -> int:
        """
        Count tokens in text using tiktoken for accurate token counting.

        Args:
            text: The text to count tokens for
            model: The model name to use for encoding (defaults to gpt-4o)

        Returns:
            Number of tokens in the text

        Note:
            Uses gpt-4o encoding which is appropriate for GPT-4o mini and most modern models.
        """
        try:
            # Handle gpt-4o specifically since tiktoken doesn't recognize it yet
            if model in ["gpt-4o", "gpt-4o-mini"]:
                encoding = tiktoken.encoding_for_model(
                    "gpt-4")  # Same encoding
            else:
                encoding = tiktoken.encoding_for_model(model)
            return len(encoding.encode(text))
        except KeyError:
            # Fallback to gpt-4 encoding (same as gpt-4o)
            logger.warning(
                f"Model '{model}' not found in tiktoken, falling back to gpt-4 encoding")
            try:
                encoding = tiktoken.encoding_for_model("gpt-4")
                return len(encoding.encode(text))
            except Exception:
                logger.error(
                    "Could not load gpt-4 encoding, using character approximation")
                return len(text) // 4
        except Exception as e:
            logger.error(f"Error counting tokens: {str(e)}")
            # Rough approximation as fallback (1 token ≈ 4 characters)
            return len(text) // 4

    @staticmethod
    def count_messages_tokens(messages: List[Message], model: str = "gpt-4o") -> int:
        """
        Count tokens for a list of messages, accounting for message formatting.

        Based on OpenAI's token counting methodology which includes formatting overhead
        for the chat completion format.

        Args:
            messages: List of Message objects to count tokens for
            model: The model name to use for encoding (defaults to gpt-4o)

        Returns:
            Total number of tokens including formatting overhead

        Note:
            Every message follows <|im_start|>{role/name}\n{content}<|im_end|>\n format
            and every reply is primed with <|im_start|>assistant
        """
        try:
            # Handle gpt-4o specifically since tiktoken doesn't recognize it yet
            if model in ["gpt-4o", "gpt-4o-mini"]:
                encoding = tiktoken.encoding_for_model(
                    "gpt-4")  # Same encoding
            else:
                encoding = tiktoken.encoding_for_model(model)
        except KeyError:
            logger.warning(
                f"Model '{model}' not found in tiktoken, falling back to gpt-4 encoding")
            try:
                encoding = tiktoken.encoding_for_model("gpt-4")
            except Exception:
                logger.error("Could not load gpt-4 encoding")
                # Rough approximation as fallback
                total_chars = sum(len(msg.role) + len(msg.content)
                                  for msg in messages)
                return total_chars // 4
        except Exception as e:
            logger.error(
                f"Error getting encoding for token counting: {str(e)}")
            # Rough approximation as fallback
            total_chars = sum(len(msg.role) + len(msg.content)
                              for msg in messages)
            return total_chars // 4

        num_tokens = 0

        try:
            for message in messages:
                # Every message follows <|im_start|>{role/name}\n{content}<|im_end|>\n
                num_tokens += 4  # Base tokens for message formatting
                num_tokens += len(encoding.encode(message.role))
                num_tokens += len(encoding.encode(message.content))

            # Every reply is primed with <|im_start|>assistant
            num_tokens += 2

        except Exception as e:
            logger.error(f"Error counting message tokens: {str(e)}")
            # Rough approximation as fallback
            total_chars = sum(len(msg.role) + len(msg.content)
                              for msg in messages)
            return total_chars // 4

        return num_tokens

    @classmethod
    def get_supported_models(cls) -> List[str]:
        """
        Get list of models supported by tiktoken.

        Returns:
            List of supported model names
        """
        try:
            # This returns the models that tiktoken has encodings for
            return list(tiktoken.model.MODEL_TO_ENCODING.keys())
        except Exception as e:
            logger.error(f"Error getting supported models: {str(e)}")
            # Common fallback models
            return ["gpt-4o", "gpt-4", "gpt-3.5-turbo"]
