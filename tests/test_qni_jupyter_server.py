from unittest.mock import Mock, patch

import pytest

from qni_jupyter.qni import QniJupyterServer


def test_frontend_startup_error_includes_log_tail(tmp_path) -> None:
    server = QniJupyterServer(tmp_path, port=15174)
    server.log_path = tmp_path / "qni_frontend.log"
    server.log_path.write_text("Vite failed to resolve tippy.js\n", encoding="utf-8")
    server.process = Mock()
    server.process.poll.return_value = 1

    with pytest.raises(RuntimeError, match="Vite failed to resolve tippy.js"):
        server._wait_until_ready()


def test_frontend_uses_vendored_yarn_when_available(tmp_path) -> None:
    vendored_yarn = tmp_path / ".yarn" / "releases" / "yarn-4.4.1.cjs"
    vendored_yarn.parent.mkdir(parents=True)
    vendored_yarn.write_text("", encoding="utf-8")
    process = Mock()
    process.poll.return_value = None
    server = QniJupyterServer(tmp_path, port=15173)

    with (
        patch("qni_jupyter.qni.subprocess.Popen", return_value=process) as popen,
        patch.object(server, "_wait_until_ready"),
    ):
        server.start()

    command = popen.call_args.args[0]
    assert command[:3] == ["node", str(vendored_yarn), "dev"]
    server.close()
