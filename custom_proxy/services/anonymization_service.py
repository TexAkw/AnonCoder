"""
Basic anonymization service for text processing using regex patterns.

This service provides simple, rule-based anonymization capabilities for common
PII patterns. It's a lightweight alternative to NER-based anonymization.
"""

import re
import logging
from typing import Dict, Tuple, List

logger = logging.getLogger(__name__)


class AnonymizationService:
    """Service for basic regex-based text anonymization."""

    # Common location names to exclude from name detection
    COMMON_LOCATIONS = {
        "United States", "New York", "Los Angeles", "San Francisco",
        "Washington", "Chicago", "Boston", "Seattle", "Miami",
        "Las Vegas", "San Diego", "Phoenix", "Denver", "Atlanta"
    }

    @classmethod
    def anonymize_text(cls, text: str) -> Tuple[str, Dict[str, str]]:
        """
        Simple anonymization function that replaces common PII patterns with placeholders.

        Args:
            text: The input text to anonymize

        Returns:
            Tuple containing:
            - anonymized_text: Text with PII replaced by placeholders
            - anonymization_map: Mapping of placeholders to original values

        Note:
            This is a basic implementation using regex patterns. For production use,
            consider using the NER-based anonymization for better accuracy.
        """
        anonymization_map = {}
        anonymized = text

        # Process different types of PII in order
        anonymized, anonymization_map = cls._replace_emails(
            anonymized, anonymization_map)
        anonymized, anonymization_map = cls._replace_phone_numbers(
            anonymized, anonymization_map)
        anonymized, anonymization_map = cls._replace_ip_addresses(
            anonymized, anonymization_map)
        anonymized, anonymization_map = cls._replace_urls(
            anonymized, anonymization_map)
        anonymized, anonymization_map = cls._replace_potential_names(
            anonymized, anonymization_map)
        anonymized, anonymization_map = cls._replace_secrets(
            anonymized, anonymization_map)

        return anonymized, anonymization_map

    @classmethod
    def _replace_emails(cls, text: str, anonymization_map: Dict[str, str]) -> Tuple[str, Dict[str, str]]:
        """Replace email addresses with placeholders."""
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)

        for i, email in enumerate(emails):
            placeholder = f"[EMAIL_{len([k for k in anonymization_map.keys() if k.startswith('[EMAIL_')]) + 1}]"
            anonymization_map[placeholder] = email
            # Replace only first occurrence
            text = text.replace(email, placeholder, 1)

        return text, anonymization_map

    @classmethod
    def _replace_phone_numbers(cls, text: str, anonymization_map: Dict[str, str]) -> Tuple[str, Dict[str, str]]:
        """Replace phone numbers with placeholders."""
        phone_pattern = r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'
        phones = re.findall(phone_pattern, text)

        for phone in phones:
            placeholder = f"[PHONE_{len([k for k in anonymization_map.keys() if k.startswith('[PHONE_')]) + 1}]"
            anonymization_map[placeholder] = phone
            text = text.replace(phone, placeholder, 1)

        return text, anonymization_map

    @classmethod
    def _replace_ip_addresses(cls, text: str, anonymization_map: Dict[str, str]) -> Tuple[str, Dict[str, str]]:
        """Replace IP addresses with placeholders."""
        ip_pattern = r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'
        ips = re.findall(ip_pattern, text)

        for ip in ips:
            placeholder = f"[IP_{len([k for k in anonymization_map.keys() if k.startswith('[IP_')]) + 1}]"
            anonymization_map[placeholder] = ip
            text = text.replace(ip, placeholder, 1)

        return text, anonymization_map

    @classmethod
    def _replace_urls(cls, text: str, anonymization_map: Dict[str, str]) -> Tuple[str, Dict[str, str]]:
        """Replace URLs with placeholders."""
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]*'
        urls = re.findall(url_pattern, text)

        for url in urls:
            placeholder = f"[URL_{len([k for k in anonymization_map.keys() if k.startswith('[URL_')]) + 1}]"
            anonymization_map[placeholder] = url
            text = text.replace(url, placeholder, 1)

        return text, anonymization_map

    @classmethod
    def _replace_potential_names(cls, text: str, anonymization_map: Dict[str, str]) -> Tuple[str, Dict[str, str]]:
        """
        Replace potential names with placeholders.

        Note: This is a very basic heuristic and should be improved for production.
        It looks for capitalized words that might be names but excludes common locations.
        """
        name_pattern = r'\b[A-Z][a-z]+ [A-Z][a-z]+\b'
        potential_names = re.findall(name_pattern, text)

        for name in potential_names:
            # Skip common location names that might be false positives
            if name not in cls.COMMON_LOCATIONS:
                placeholder = f"[NAME_{len([k for k in anonymization_map.keys() if k.startswith('[NAME_')]) + 1}]"
                anonymization_map[placeholder] = name
                text = text.replace(name, placeholder, 1)

        return text, anonymization_map

    @classmethod
    def _replace_secrets(cls, text: str, anonymization_map: Dict[str, str]) -> Tuple[str, Dict[str, str]]:
        """Replace hardcoded sensitive keys/secrets with placeholders."""
        secrets = ["SuperSecretKey"]  # Add more known secrets as needed

        for secret in secrets:
            if secret in text:
                placeholder = f"[SECRET_{len([k for k in anonymization_map.keys() if k.startswith('[SECRET_')]) + 1}]"
                anonymization_map[placeholder] = secret
                text = text.replace(secret, placeholder)

        return text, anonymization_map

    @classmethod
    def get_pattern_info(cls) -> Dict[str, str]:
        """
        Get information about the patterns used for anonymization.

        Returns:
            Dictionary mapping pattern types to their descriptions
        """
        return {
            "email": "Email addresses (user@domain.com)",
            "phone": "Phone numbers (xxx-xxx-xxxx format)",
            "ip": "IP addresses (xxx.xxx.xxx.xxx)",
            "url": "HTTP/HTTPS URLs",
            "name": "Potential names (two capitalized words, excluding common locations)",
            "secret": "Known hardcoded secrets/keys"
        }
