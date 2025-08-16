import pytest
import smtplib
from db.sqlite import SQLiteDatabase

@pytest.fixture(scope="function")
def db():
    # use in-memory DB for testing
    db_instance = SQLiteDatabase.get_instance(":memory:")
    conn = db_instance.get_connection()
    yield db_instance, conn
    conn.close()

class DummySMTP:
    def __init__(self):
        self.sent = []

    # Make it work with "with ... as ..."
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False  # don’t suppress exceptions

    # Fake methods to match real smtplib.SMTP
    def starttls(self):
        return True

    def login(self, username, password):
        return True

    def sendmail(self, from_addr, to_addrs, msg):
        self.sent.append((from_addr, to_addrs, msg))  # store instead of sending

    def quit(self):
        return True

@pytest.fixture
def dummy_smtp(monkeypatch):
    smtp = DummySMTP()
    monkeypatch.setattr(smtplib, "SMTP", lambda *a, **kw: smtp)
    return smtp
