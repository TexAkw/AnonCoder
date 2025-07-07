from abc import abstractmethod
from data_manager.db_session import PgDbSession
import json
import logging

logger = logging.getLogger(__name__)

class StatsStorer:
    def __init__(self):
        self.create_table()

    @abstractmethod
    def store_stats(self, stats: dict):
        raise NotImplementedError("Subclasses must implement this method")

class PGStatsStorer(StatsStorer):
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.dlp_table = 'stats_dlp'
        self.llm_table = 'stats_llm'
        self.general_table = 'stats_general'
        super().__init__()
        logger.info(f"[STATS INFO] successfully initialized")
    
    def create_table(self):
        query = f"""
        CREATE TABLE IF NOT EXISTS {self.dlp_table} (
            id UUID PRIMARY KEY,
            raw_prompt TEXT NOT NULL,
            anonymized_prompt TEXT,
            category JSONB,
            ner_time FLOAT,
            dlp_anonymization_time FLOAT
        );
        """
        with PgDbSession(self.connection_string) as session:
            try:
                session.execute_write(query)
                session.commit()
            except Exception as e:
                session.rollback()
                raise e
        

        query = f"""
        CREATE TABLE IF NOT EXISTS {self.llm_table} (
            id UUID PRIMARY KEY,
            anonymized_prompt TEXT NOT NULL,
            anonymized_response TEXT,
            clean_response TEXT,
            response_tokens INTEGER,
            anonymized_tokens INTEGER,
            llm_time FLOAT,
            dlp_deanonymization_time FLOAT
        );
        """
        with PgDbSession(self.connection_string) as session:
            try:
                session.execute_write(query)
                session.commit()
            except Exception as e:
                session.rollback()
                raise e

        query = f"""
        CREATE TABLE IF NOT EXISTS {self.general_table} (
            id UUID PRIMARY KEY,
            raw_prompt TEXT NOT NULL,
            general_time FLOAT
        );
        """
        with PgDbSession(self.connection_string) as session:
            try:
                session.execute_write(query)
                session.commit()
            except Exception as e:
                session.rollback()
                raise e

    def store_stats_dlp(self, stats: dict):
        query = f"""
        INSERT INTO {self.dlp_table} (id, raw_prompt, anonymized_prompt, category, ner_time, dlp_anonymization_time)
        VALUES (%(id)s, %(raw_prompt)s, %(anonymized_prompt)s, %(category)s::jsonb, %(ner_time)s, %(dlp_anonymization_time)s)
        """
        stats_copy = stats.copy()
        if 'category' in stats_copy and isinstance(stats_copy['category'], dict):
            stats_copy['category'] = json.dumps(stats_copy['category'])
        
        with PgDbSession(self.connection_string) as session:
            try:
                session.execute_write(query, stats_copy)
                session.commit()
            except Exception as e:
                session.rollback()
                raise e

    def store_stats_llm(self, stats: dict):
        query = f"""
        INSERT INTO {self.llm_table} (id, anonymized_prompt, anonymized_response, clean_response, response_tokens, anonymized_tokens, llm_time, dlp_deanonymization_time)
        VALUES (%(id)s, %(anonymized_prompt)s, %(anonymized_response)s, %(clean_response)s, %(response_tokens)s, %(anonymized_tokens)s, %(llm_time)s, %(dlp_deanonymization_time)s)
        """
            
        with PgDbSession(self.connection_string) as session:
            try:
                session.execute_write(query, stats)
                session.commit()
            except Exception as e:
                session.rollback()
                raise e
    
    def store_general_stats(self, stats: dict):
        query = f"""
        INSERT INTO {self.general_table} (id, raw_prompt, general_time)
        VALUES (%(id)s, %(raw_prompt)s, %(general_time)s)
        """
            
        with PgDbSession(self.connection_string) as session:
            try:
                session.execute_write(query, stats)
                session.commit()
            except Exception as e:
                session.rollback()
                raise e