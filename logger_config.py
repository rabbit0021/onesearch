# logger_config.py
import logging
import os

# Detect environment
env = os.getenv('FLASK_ENV', 'development')

# Log directory based on environment
if env == "production":
    log_dir = os.path.join(os.path.dirname(__file__), 'logs', 'prod')
else:
    log_dir = os.path.join(os.path.dirname(__file__), 'logs', 'dev')

os.makedirs(log_dir, exist_ok=True)

# Main log files
LOG_FILE = os.path.join(log_dir, "server.log")
DEBUG_LOG_FILE = os.path.join(log_dir, "debug.log")
ERROR_LOG_FILE = os.path.join(log_dir, "error.log")

# --- Formatters ---
formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

# --- Handlers ---
# Main log handler (INFO and above)
info_handler = logging.FileHandler(LOG_FILE)
info_handler.setLevel(logging.INFO)
info_handler.setFormatter(formatter)

# Debug-only handler
debug_handler = logging.FileHandler(DEBUG_LOG_FILE)
debug_handler.setLevel(logging.DEBUG)
debug_handler.setFormatter(formatter)

error_handler = logging.FileHandler(ERROR_LOG_FILE)
error_handler.setLevel(logging.DEBUG)
error_handler.setFormatter(formatter)

class OnlyDebugFilter(logging.Filter):
    def filter(self, record):
        return record.levelno == logging.DEBUG

class OnlyErrorFilter(logging.Filter):
    def filter(self, record):
        return record.levelno == logging.ERROR


debug_handler.addFilter(OnlyDebugFilter())
error_handler.addFilter(OnlyErrorFilter())

# Console handler (INFO and above)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

# --- Root logger setup ---
root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)
root_logger.handlers.clear()  # prevent duplicate handlers if re-imported
root_logger.addHandler(info_handler)
root_logger.addHandler(debug_handler)
root_logger.addHandler(console_handler)
root_logger.addHandler(error_handler)

# --- Helper function ---
def get_logger(name):
    return logging.getLogger(name)
