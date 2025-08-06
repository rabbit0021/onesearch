# db/sqlite.py
import sqlite3
from threading import Lock

class SQLiteDatabase:
    _instance = None
    _lock = Lock()

    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None
        self._connect()

    def _connect(self):
        if self.conn:
            try:
                self.conn.execute("SELECT 1")
                return  # connection is still alive
            except Exception:
                self.close()

        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row

    def get_connection(self):
        self._connect()
        return self.conn

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass
            self.conn = None

    @classmethod
    def get_instance(cls, db_path):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(db_path)
            elif cls._instance.db_path != db_path:
                raise ValueError("SQLiteDatabase already initialized with a different path")
            return cls._instance    
