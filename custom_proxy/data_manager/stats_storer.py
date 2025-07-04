from abc import abstractmethod
from data_manager.db_session import PgDbSession

class StatsStorer:
    def __init__(self):
        self.create_table()

    @abstractmethod
    def store_stats(self, stats: dict):
        raise NotImplementedError("Subclasses must implement this method")

class PGStatsStorer(StatsStorer):
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.collection_table = 'stats_info'
    
    def create_table(self):
        query = f"""
        CREATE TABLE IF NOT EXISTS {self.collection_table} (
            id SERIAL PRIMARY KEY,
            input_prompt TEXT NOT NULL,
            anonymized_response TEXT NOT NULL,
            anonymized_prompt TEXT NOT NULL,
            response_tokens INTEGER NOT NULL,
            anonymized_tokens INTEGER NOT NULL,
            input_prompt_tokens INTEGER NOT NULL,
            anonymized_input_time INTEGER NOT NULL,
            response_time INTEGER NOT NULL,
        );
        """
        with PgDbSession(self.connection_string) as session:
            try:
                session.execute_write(query)
                session.commit()
            except Exception as e:
                session.rollback()
                raise e

    def store_stats(self, stats: dict):
        query = f"""
        INSERT INTO {self.collection_table} (input_prompt, anonymized_response, anonymized_prompt, response_tokens, anonymized_tokens, input_prompt_tokens, anonymized_input_time, response_time)
        VALUES (%(input_prompt)s, %(anonymized_response)s, %(anonymized_prompt)s, %(response_tokens)s, %(anonymized_tokens)s, %(input_prompt_tokens)s, %(anonymized_input_time)s, %(response_time)s)
        """
        with PgDbSession(self.connection_string) as session:
            try:
                session.execute_write(query, stats)
                session.commit()
            except Exception as e:
                session.rollback()
                raise e