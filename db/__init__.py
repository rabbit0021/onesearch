import os
from db.sqlite import SQLiteDatabase

def get_database():    
    env = os.getenv('FLASK_ENV', 'development')
    DB_TYPE = os.getenv("DB_TYPE") if env == 'production' else 'sqlite'
    DB_PATH = os.getenv("DB_PATH") if env == 'production' else './data/notifications_dev.db'

    if DB_TYPE == "sqlite":
        return SQLiteDatabase.get_instance(DB_PATH)
    # elif DB_TYPE == "postgres":
    #     from db.postgres_db import PostgresDatabase
    #     return PostgresDatabase.get_instance(POSTGRES_CONFIG)
    else:
        raise ValueError(f"Unsupported DB engine: {DB_TYPE}")