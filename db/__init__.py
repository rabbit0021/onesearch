import os
from db.sqlite import SQLiteDatabase

def get_database():
    DB_TYPE = os.getenv("DB_TYPE")
    DB_PATH = os.getenv("DB_PATH")
    
    if DB_TYPE == "sqlite":
        return SQLiteDatabase.get_instance(DB_PATH)
    # elif DB_TYPE == "postgres":
    #     from db.postgres_db import PostgresDatabase
    #     return PostgresDatabase.get_instance(POSTGRES_CONFIG)
    else:
        raise ValueError(f"Unsupported DB engine: {DB_TYPE}")