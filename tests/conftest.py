import os

os.environ["FLASK_ENV"] = "test"   # must be first

import pytest
import smtplib
from db.sqlite import SQLiteDatabase
from logger_config import get_logger
from _pytest.terminal import TerminalWriter

tw = TerminalWriter()

logger = get_logger("TEST_LOGGER")

logger.debug("=================== Test Session Starts =================== ")

@pytest.fixture(scope="session")
def db():
    db_path = "data/tests.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    # use in-memory DB for testing
    db_instance = SQLiteDatabase.get_instance(db_path)
    logger.debug("Test Database Initialised")
    yield db_instance
    
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

@pytest.hookimpl
def pytest_runtest_logstart(nodeid, location):
    logger.debug(f"➡️  START: {nodeid}")
    tw.line(f"➡️  START: {nodeid}", cyan=True, bold=True)

@pytest.hookimpl
def pytest_runtest_logreport(report):
    if report.when == "call":  # only after actual test call
        if report.failed:
            tw.line(f"❌ END (FAILED): {report.nodeid}", red=True, bold=True)
            logger.debug(f"❌ END (FAILED): {report.nodeid}")
        elif report.skipped:
            tw.line(f"⚠️  END (SKIPPED): {report.nodeid}", yellow=True)
            logger.debug(f"⚠️  END (SKIPPED): {report.nodeid}")
        else:
            tw.line(f"✅ END (PASSED): {report.nodeid}", green=True)
            logger.debug(f"✅ END (PASSED): {report.nodeid}")

# --- Enhanced Summary at end ---
@pytest.hookimpl
def pytest_terminal_summary(terminalreporter, exitstatus, config):
    passed = len(terminalreporter.stats.get("passed", []))
    failed = len(terminalreporter.stats.get("failed", []))
    skipped = len(terminalreporter.stats.get("skipped", []))
    xfailed = len(terminalreporter.stats.get("xfailed", []))
    xpassed = len(terminalreporter.stats.get("xpassed", []))
    total = terminalreporter._numcollected

    tw.line("\n" + "="*40, bold=True)
    tw.line("📊 TEST RUN SUMMARY", bold=True, cyan=True)
    tw.line("="*40 + "\n", bold=True)

    tw.line(f"  ✅ Passed : {passed}", green=True)
    tw.line(f"  ❌ Failed : {failed}", red=True)
    tw.line(f"  ⚠️  Skipped: {skipped}", yellow=True)
    if xfailed:
        tw.line(f"  ❎ XFailed: {xfailed}", magenta=True)
    if xpassed:
        tw.line(f"  🤔 XPassed: {xpassed}", magenta=True)

    tw.line(f"\n  Total: {total}", bold=True)
    tw.line("="*40 + "\n", bold=True)