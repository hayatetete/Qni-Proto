from unittest.mock import Mock

import pytest

from qni_jupyter.qni import QniJupyterServer


def test_frontend_startup_error_includes_log_tail(tmp_path) -> None:
    server = QniJupyterServer(tmp_path)
    server.log_path = tmp_path / "qni_frontend.log"
    server.log_path.write_text("Vite failed to resolve tippy.js\n", encoding="utf-8")
    server.process = Mock()
    server.process.poll.return_value = 1

    with pytest.raises(RuntimeError, match="Vite failed to resolve tippy.js"):
        server._wait_until_ready()
