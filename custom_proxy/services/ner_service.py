"""
NER (Named Entity Recognition) service for communicating with external NER API.

This service handles all interactions with the NER API including request formatting,
error handling, and response processing.
"""

import os
import requests
import logging
from typing import Dict, Optional

from schemas import NERConfig

logger = logging.getLogger(__name__)


class NERService:
    """Service for handling Named Entity Recognition API calls."""

    def __init__(self):
        """Initialize the NER service with API configuration."""
        self.api_base_url = os.getenv("NER_API_BASE")
        self.api_key = os.getenv("NER_API_KEY")

        if not self.api_base_url or not self.api_key:
            logger.warning(
                "NER API configuration is missing. Service may not function properly.")

    def apply_ner(self, text: str) -> Optional[Dict]:
        """
        Apply Named Entity Recognition to the provided text.

        Args:
            text: The text to analyze for named entities

        Returns:
            Dict containing NER results, or None if the request failed

        Raises:
            None - Errors are logged and None is returned for graceful degradation
        """
        if not self.api_base_url or not self.api_key:
            logger.error("NER API configuration is missing")
            return None

        logger.info("=================== NER REQUEST ===================")
        logger.info(
            f"Processing text: {text[:100]}{'...' if len(text) > 100 else ''}")

        headers = {
            "apiKey": self.api_key,
            "Content-Type": "application/json"
        }

        data = {
            "flat_ner": True,
            "text": text,
            "labels": [
                {"label": label.label, "threshold": label.threshold}
                for label in NERConfig.LABELS
            ],
            "multi_label": False,
            "recognitions_defs": [
                {"label": rd.label, "pattern": rd.pattern}
                for rd in NERConfig.RECOGNITION_DEFS
            ]
        }

        try:
            response = requests.post(
                self.api_base_url,
                headers=headers,
                json=data,
                timeout=30  # Add timeout for robustness
            )

            if response.status_code == 200:
                result = response.json()
                logger.info("NER request completed successfully")
                return result
            else:
                logger.error(
                    f"NER API error: Status {response.status_code} - {response.text}")
                return None

        except requests.exceptions.Timeout:
            logger.error("NER API request timed out")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"NER API request failed: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in NER service: {str(e)}")
            return None
