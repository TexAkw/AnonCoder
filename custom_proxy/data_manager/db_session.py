import psycopg


class PgDbSession:
    def __init__(self, db_connection_string: str):
        self.db_connection_string = db_connection_string

    def __enter__(self):
        self.connection = psycopg.connect(self.db_connection_string)
        return self

    def execute_query(self, query, params=None)->list[dict]:
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)
            column_names = [desc[0] for desc in cursor.description]
            if cursor.description:
                rows = cursor.fetchall()
                results = [dict(zip(column_names, row)) for row in rows]
                return results


    def execute_write(self, query, params=None):
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)


    def execute_multiple_write(self, queries, params=None):
        with self.connection.cursor() as cursor:
            cursor.executemany(queries, params)

    def drop_table(self, table_name):
        query = f"""DROP TABLE IF EXISTS {table_name} CASCADE;"""
        self.execute_write(query)

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()


    def __exit__(self, exc_type, exc_val, exc_tb):
        self.connection.close()
        del self.connection