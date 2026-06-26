"""Logging configuration for the Qni quantum circuit simulator.

Configures file and console logging handlers with custom formatting.
"""

import logging

LOG_FORMAT = "[%(asctime)s] [%(levelname)s] %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S %z"
LOG_FILE = "backend.log"


def _add_logger_handler(
    handler: logging.Handler,
    formatter: logging.Formatter,
) -> None:
    handler.setLevel(logging.INFO)
    handler.setFormatter(formatter)
    logging.getLogger().addHandler(handler)


def setup_custom_logger() -> None:
    """Configure and initialize the application's logging system.

    Sets up both console and file logging handlers with custom formatting:
        - Console handler: Outputs logs to stdout
        - File handler: Writes logs to 'backend.log'

    Both handlers are configured with:
    - Log level: INFO for handlers, DEBUG for root logger
    - Format: "[timestamp] [level] message"
    - Timestamp format: "YYYY-MM-DD HH:MM:SS TZ"

    """
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)

    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    _add_logger_handler(logging.StreamHandler(), formatter)
    _add_logger_handler(logging.FileHandler(LOG_FILE), formatter)
