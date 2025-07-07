from typing import Dict
from data_manager.stats_storer import PGStatsStorer
import os
from dotenv import load_dotenv
import time
import uuid
from services import NERService
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)
load_dotenv()


class DLP:
    def __init__(self):
        self.data = {}  # Store mapping of anonymized tokens to original values
        self.counter = {}  # Counter for each entity type
        self.stats = PGStatsStorer(os.getenv("POSTGRES_CONNECTION_STRING"))
        self.ner_service = NERService()
    
    def anonymize(self, text: str) -> str:
        """
        Anonymize text by replacing PII with placeholders using NER service.
        """
        start_time = time.time()
        ner_response = self.ner_service.apply_ner(text)
        end_time = time.time()
        ner_time = (end_time - start_time) * 1000

        logger.info("=================== NER RESPONSE ===================")
        logger.info(ner_response)

        if ner_response is None:
            raise HTTPException(
                status_code=500, detail="Error from NER API")

        start_time = time.time()
        anonymized_text, anonymization_map = self.apply_dlp(
            text, ner_response)
        end_time = time.time()
        dlp_time = (end_time - start_time) * 1000

        stats = {
            "id": str(uuid.uuid4()),
            "raw_prompt": text,
            "category": ner_response,
            "anonymized_prompt": anonymized_text,
            "ner_time": ner_time,
            "dlp_anonymization_time": dlp_time
        }

        self.stats.store_stats_dlp(stats)
        return anonymized_text, anonymization_map

    def apply_dlp(self, text: str, entities_dict: Dict) -> tuple[str, Dict[str, str]]:
        """
        Anonymize text based on entities dictionary and return anonymized text with mapping.

        Args:
            text: The original text to anonymize
            entities_dict: Dictionary containing 'entities' list with label, score, value, start, end

        Returns:
            Tuple of (anonymized_text, mapping_dict)
        """
        if 'entities' not in entities_dict:
            return text, {}

        entities = entities_dict['entities']

        # Sort entities by start position in reverse order to avoid position shifts
        entities_sorted = sorted(
            entities, key=lambda x: x['start'], reverse=True)

        anonymized_text = text
        current_mapping = {}

        for entity in entities_sorted:
            label = entity['label']
            value = entity['text'].strip()  # Remove leading/trailing spaces
            start = entity['start']
            end = entity['end']

            # Generate anonymized token
            if label not in self.counter:
                self.counter[label] = 0

            self.counter[label] += 1
            anonymized_token = f"[{label}_{self.counter[label]}]"

            # Store the mapping
            self.data[anonymized_token] = value
            current_mapping[anonymized_token] = value

            # Replace in text
            anonymized_text = anonymized_text[:start] + \
                anonymized_token + anonymized_text[end:]

        return anonymized_text, current_mapping

    def get_original_value(self, anonymized_token: str) -> str:
        """Get the original value for an anonymized token."""
        return self.data.get(anonymized_token, anonymized_token)

    def get_all_mappings(self) -> Dict[str, str]:
        """Get all stored mappings."""
        return self.data.copy()

    def update_mappings(self, new_mappings: Dict[str, str]):
        """Update the stored mappings with new values."""
        self.data.update(new_mappings)

    def deanonymize(self, anonymized_text: str) -> str:
        """Convert anonymized text back to original text."""
        result = anonymized_text
        for token, original in self.data.items():
            result = result.replace(token, original)
        return result

    def clear_data(self):
        """Clear all stored data and reset counters."""
        self.data.clear()
        self.counter.clear()
