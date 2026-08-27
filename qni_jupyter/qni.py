"""Notebook helpers for opening the QniGPU frontend."""

from __future__ import annotations

import atexit
import ast
import html
import json
import os
import socket
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, Protocol, Sequence, overload
from urllib.parse import parse_qs, quote, unquote, urlparse
from urllib.request import urlopen

_SERVER: "QniJupyterServer | None" = None
_BACKEND_SERVER: "QniJupyterBackendServer | None" = None
_CIRCUIT_STEP_LAYOUTS: dict[
    int,
    tuple[Any, tuple[Any, ...], list[list[dict[str, Any]]], int],
] = {}
DEFAULT_VIEWER_HEIGHT = 480
DEFAULT_VIEWER_WIDTH = "100%"
DEFAULT_BACKEND_PORT = 8000
DEFAULT_FRONTEND_PORT = 5173
MAX_DEMO_QUBITS = 8
NOTEBOOK_TOOLBAR_HEIGHT = 45
NOTEBOOK_STATE_HEADER_HEIGHT = 44
QniView = Literal["notebook", "state", "circuit"]
QniInteractionMode = Literal["edit", "inspect"]
QniStep = int | Literal["last"]


class QuriLikeCircuit(Protocol):
    """Minimum shape of a QURI Parts circuit object accepted by qni.open()."""

    qubit_count: int
    gates: Sequence[Any]


@dataclass(frozen=True)
class QniViewer:
    """A handle for the QniGPU iframe shown in a notebook cell."""

    url: str
    height: int
    width: str | int
    warnings: tuple[str, ...] = ()

    def _repr_html_(self) -> str:
        """Render the viewer iframe and wheel bridge inside a notebook cell."""
        element_id = f"qni-viewer-{uuid.uuid4().hex}"
        escaped_url = html.escape(self.url, quote=True)
        rendered_height = _compact_height_from_viewer_url(self.url, self.height)
        rendered_width = _compact_width_from_viewer_url(self.url, self.width)
        escaped_width = html.escape(str(rendered_width), quote=True)
        escaped_height = html.escape(str(rendered_height), quote=True)
        requested_width = (
            f"{escaped_width}px" if isinstance(self.width, int) else escaped_width
        )
        if isinstance(rendered_width, int):
            requested_width = f"{rendered_width}px"
            css_width = f"min({rendered_width}px, 100%)"
            iframe_width = "100%"
        else:
            requested_width = str(rendered_width)
            css_width = requested_width
            iframe_width = requested_width
        css_max_width = "100%"
        escaped_iframe_width = html.escape(iframe_width, quote=True)
        warning_html = _render_warnings(self.warnings)

        return (
            f'<div id="{element_id}" data-qni-viewer-root="true" '
            f'style="height:{escaped_height}px; max-height:{escaped_height}px; '
            f'width:{css_width}; max-width:{css_max_width}; overflow:hidden; '
            'display:block; box-sizing:border-box; position:relative; background:#ffffff;">'
            f"{warning_html}"
            f'<iframe src="{escaped_url}" width="{escaped_iframe_width}" height="{escaped_height}" '
            f'style="border: 0; width: {css_width}; background:#ffffff; '
            f'height: {escaped_height}px; max-height: {escaped_height}px; '
            f'max-width: {css_max_width}; display: block; box-sizing:border-box;" '
            'allow="clipboard-read; clipboard-write"></iframe>'
            '<div data-qni-resize-handle="true" title="Drag to resize Qni output; double-click to restore auto height" '
            'style="position:absolute; left:0; right:0; bottom:0; height:12px; cursor:ns-resize; '
            'z-index:5; touch-action:none; display:flex; align-items:center; justify-content:center;">'
            '<span style="width:48px; height:4px; border-radius:999px; background:#9ca3af; opacity:.75;"></span>'
            "</div>"
            "</div>"
            "<script>"
            "(function(){"
            f"const root=document.getElementById({json.dumps(element_id)});"
            "if(!root||root.dataset.qniBridgeInstalled==='true')return;"
            f"const viewerHeight={json.dumps(f'{rendered_height}px')};"
            f"const viewerWidth={json.dumps(css_width)};"
            f"const viewerMaxWidth={json.dumps(css_max_width)};"
            "document.documentElement.style.height=viewerHeight;"
            "document.documentElement.style.maxHeight=viewerHeight;"
            "document.documentElement.style.width=viewerWidth;"
            "document.documentElement.style.maxWidth=viewerMaxWidth;"
            "document.documentElement.style.overflow='hidden';"
            "document.body.style.height=viewerHeight;"
            "document.body.style.maxHeight=viewerHeight;"
            "document.body.style.width=viewerWidth;"
            "document.body.style.maxWidth=viewerMaxWidth;"
            "document.body.style.margin='0';"
            "document.body.style.overflow='hidden';"
            "root.style.height=viewerHeight;"
            "root.style.maxHeight=viewerHeight;"
            "root.style.width=viewerWidth;"
            "root.style.maxWidth=viewerMaxWidth;"
            "const iframe=root.querySelector('iframe');"
            "const resizeHandle=root.querySelector('[data-qni-resize-handle]');"
            "let manualHeight=false;"
            f"let lastAutoHeight={json.dumps(rendered_height)};"
            "if(iframe){"
            "iframe.style.width=viewerWidth;"
            "iframe.style.maxWidth=viewerMaxWidth;"
            "}"
            "function resizeViewer(height){"
            "const nextHeight=Math.max(120,Math.ceil(Number(height)||0));"
            "const nextHeightPx=nextHeight+'px';"
            "root.style.height=nextHeightPx;"
            "root.style.maxHeight=nextHeightPx;"
            "document.documentElement.style.height=nextHeightPx;"
            "document.documentElement.style.maxHeight=nextHeightPx;"
            "document.body.style.height=nextHeightPx;"
            "document.body.style.maxHeight=nextHeightPx;"
            "if(iframe){"
            "iframe.height=String(nextHeight);"
            "iframe.style.height=nextHeightPx;"
            "iframe.style.maxHeight=nextHeightPx;"
            "}"
            "function notifyViewerHeight(height){"
            "if(!iframe||!iframe.contentWindow)return;"
            "iframe.contentWindow.postMessage({source:'qni-notebook',type:'qni:set-height',height:height},'*');"
            "}"
            "if(resizeHandle){"
            "resizeHandle.addEventListener('pointerdown',function(event){"
            "event.preventDefault();"
            "manualHeight=true;"
            "const startY=event.clientY;"
            "const startHeight=root.getBoundingClientRect().height;"
            "resizeHandle.setPointerCapture?.(event.pointerId);"
            "function move(moveEvent){"
            "const nextHeight=Math.min(1200,Math.max(160,startHeight+moveEvent.clientY-startY));"
            "resizeViewer(nextHeight);"
            "notifyViewerHeight(nextHeight);"
            "}"
            "function end(){"
            "document.removeEventListener('pointermove',move);"
            "document.removeEventListener('pointerup',end);"
            "}"
            "document.addEventListener('pointermove',move);"
            "document.addEventListener('pointerup',end);"
            "});"
            "resizeHandle.addEventListener('dblclick',function(){"
            "manualHeight=false;"
            "resizeViewer(lastAutoHeight);"
            "notifyViewerHeight(lastAutoHeight);"
            "});"
            "}"
            "}"
            "function resizeViewerWidth(width,allowOverflowWidth){"
            "if(width===undefined||width===null)return;"
            "const nextWidth=Math.max(120,Math.ceil(Number(width)||0));"
            "const nextWidthCss=allowOverflowWidth?'max(100%, '+nextWidth+'px)':'min('+nextWidth+'px, 100%)';"
            "const nextMaxWidth=allowOverflowWidth?'none':'100%';"
            "root.style.width=nextWidthCss;"
            "root.style.maxWidth=nextMaxWidth;"
            "document.documentElement.style.width=nextWidthCss;"
            "document.documentElement.style.maxWidth=nextMaxWidth;"
            "document.body.style.width=nextWidthCss;"
            "document.body.style.maxWidth=nextMaxWidth;"
            "if(iframe){iframe.style.width=nextWidthCss;iframe.style.maxWidth=nextMaxWidth;}"
            "}"
            "root.dataset.qniBridgeInstalled='true';"
            "window.addEventListener('message',function(event){"
            "if(iframe&&event.source!==iframe.contentWindow)return;"
            "const data=event.data||{};"
            "if(data.source==='qni-gl'&&data.type==='qni:wheel'){"
            "window.scrollBy({top:data.deltaY||0,left:data.deltaX||0,behavior:'auto'});"
            "}"
            "if(data.source==='qni-gl'&&data.type==='qni:resize'){"
            "lastAutoHeight=Math.max(120,Math.ceil(Number(data.height)||0));"
            "if(!manualHeight)resizeViewer(lastAutoHeight);"
            "resizeViewerWidth(data.width,data.allowOverflowWidth===true);"
            "}"
            "});"
            "})();"
            "</script>"
        )


@dataclass(frozen=True)
class QniEditor(QniViewer):
    """Handle for committing the latest browser-side editor draft to Python."""

    draft_id: str = ""
    backend_url: str = ""
    _displayed: bool = field(default=False, init=False, repr=False, compare=False)

    def _repr_html_(self) -> str:
        if self._displayed:
            return ""
        object.__setattr__(self, "_displayed", True)
        return super()._repr_html_()

    def latest_code(self) -> str:
        """Return QURI Parts code generated from the latest Qni edit."""
        payload = self._draft_payload()
        code = payload.get("code")
        if not isinstance(code, str):
            raise RuntimeError("The Qni editor draft does not contain QURI code.")
        return code

    def commit(self) -> Any:
        """Build and return a new QURI circuit from the latest Qni edit."""
        payload = self._draft_payload()
        warnings = payload.get("warnings", [])
        if warnings:
            details = "\n".join(f"- {warning}" for warning in warnings)
            raise RuntimeError(
                "Qni cannot commit this draft without losing operations:\n"
                f"{details}",
            )
        code = payload.get("code")
        if not isinstance(code, str):
            raise RuntimeError("The Qni editor draft does not contain QURI code.")
        namespace: dict[str, Any] = {}
        exec(code, namespace)
        circuit = namespace.get("circuit")
        if circuit is None:
            raise RuntimeError("Generated QURI code did not create 'circuit'.")
        steps = payload.get("steps")
        qubit_count = payload.get("qubit_count")
        if isinstance(steps, list) and isinstance(qubit_count, int):
            _remember_circuit_step_layout(circuit, steps, qubit_count)
        return circuit

    def _draft_payload(self) -> dict[str, Any]:
        endpoint = f"{self.backend_url.rstrip('/')}/editor-drafts/{self.draft_id}"
        try:
            with urlopen(endpoint, timeout=5) as response:
                payload = json.load(response)
        except Exception as exc:
            raise RuntimeError(
                "Could not load the Qni editor draft. Keep the editor open "
                "and wait briefly before committing.",
            ) from exc
        if not isinstance(payload, dict):
            raise RuntimeError("The Qni editor draft response is invalid.")
        return payload


class QniJupyterServer:
    """Owns a Vite dev server process used by notebook iframes."""

    def __init__(self, frontend_dir: Path, port: int | None = None, backend_url: str | None = None) -> None:
        self.frontend_dir = frontend_dir
        self.port = port or _find_free_port()
        self.backend_url = backend_url
        self.process: subprocess.Popen[str] | None = None
        self.log_path: Path | None = None
        self._log_file: Any | None = None

    def start(self) -> None:
        """Start the frontend server once and wait until it accepts HTTP traffic."""
        if self.process and self.process.poll() is None:
            return

        env = os.environ.copy()
        if self.backend_url is not None:
            env["VITE_BACKEND_URL"] = self.backend_url

        self.log_path = self.frontend_dir / "qni_frontend.log"
        self._log_file = self.log_path.open("a", encoding="utf-8")
        self._log_file.write("\n=== Starting Qni frontend ===\n")
        self._log_file.write(f"frontend_dir: {self.frontend_dir}\n")
        self._log_file.write(f"port: {self.port}\n")
        self._log_file.flush()

        vendored_yarn = self.frontend_dir / ".yarn" / "releases" / "yarn-4.4.1.cjs"
        package_manager = (
            ["node", str(vendored_yarn)] if vendored_yarn.is_file() else ["yarn"]
        )
        self.process = subprocess.Popen(
            [
                *package_manager,
                "dev",
                "--host",
                os.environ.get("QNI_BIND_HOST", "127.0.0.1"),
                "--port",
                str(self.port),
            ],
            cwd=self.frontend_dir,
            env=env,
            stdout=self._log_file,
            stderr=self._log_file,
            text=True,
        )
        self._wait_until_ready()

    def close(self) -> None:
        """Terminate the frontend server started for notebook display."""
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)

        self.process = None

        if self._log_file is not None:
            try:
                self._log_file.close()
            finally:
                self._log_file = None

    def _wait_until_ready(self) -> None:
        """Poll the chosen localhost port until Vite is ready or fails."""
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if self.process and self.process.poll() is not None:
                log_tail = self._read_log_tail()
                raise RuntimeError(
                    "QniGPU frontend server exited before startup.\n"
                    f"log: {self.log_path}\n\n"
                    f"{log_tail}"
                )
            if _is_port_open(self.port):
                return
            time.sleep(0.1)

        log_tail = self._read_log_tail()
        raise TimeoutError(
            "Timed out waiting for QniGPU frontend server.\n"
            f"log: {self.log_path}\n\n"
            f"{log_tail}"
        )

    def _read_log_tail(self) -> str:
        """Read the tail of the frontend log for startup diagnostics."""
        if self._log_file is not None:
            self._log_file.flush()

        if self.log_path is None or not self.log_path.exists():
            return "(frontend log was not created)"

        try:
            text = self.log_path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            return f"(failed to read frontend log: {exc})"

        lines = text.splitlines()
        tail = "\n".join(lines[-80:])
        return tail or "(frontend log is empty)"


class QniJupyterBackendServer:
    """Owns a backend server process used by notebook iframes."""

    def __init__(self, port: int | None = None) -> None:
        self.port = port or _find_free_port()
        self.process: subprocess.Popen[str] | None = None
        self.log_path: Path | None = None
        self._log_file: Any | None = None

    def start(self) -> None:
        """Start the backend process and wait until it accepts HTTP traffic."""
        if self.process and self.process.poll() is None:
            return

        project_root = next(
            (
                parent
                for parent in Path(__file__).resolve().parents
                if (parent / "backend" / "src").is_dir()
                and (parent / "frontend").is_dir()
            ),
            None,
        )
        if project_root is None:
            raise FileNotFoundError("Could not find the Qni project root.")
        backend_dir = project_root / "backend"
        backend_src = backend_dir / "src"

        env = os.environ.copy()
        existing_pythonpath = env.get("PYTHONPATH")
        env["PYTHONPATH"] = (
            str(backend_src)
            if not existing_pythonpath
            else f"{backend_src}{os.pathsep}{existing_pythonpath}"
        )
        env["PYTHONUNBUFFERED"] = "1"

        self.log_path = backend_dir / "qni_backend.log"
        self._log_file = self.log_path.open("a", encoding="utf-8")

        self._log_file.write("\n=== Starting Qni backend ===\n")
        self._log_file.write(f"python: {sys.executable}\n")
        self._log_file.write(f"backend_dir: {backend_dir}\n")
        self._log_file.write(f"backend_src: {backend_src}\n")
        self._log_file.write(f"port: {self.port}\n")
        self._log_file.flush()

        self.process = subprocess.Popen(
            [
                sys.executable,
                "-u",
                "-c",
                (
                    "import sys; "
                    "sys.path.insert(0, %r); "
                    "print('before import qni.backend', flush=True); "
                    "from qni.backend import app; "
                    "print('after import qni.backend', flush=True); "
                    "app.run(host=%r, port=%d, debug=False, use_reloader=False)"
                )
                % (
                    str(backend_src),
                    os.environ.get("QNI_BIND_HOST", "127.0.0.1"),
                    self.port,
                ),
            ],
            cwd=backend_dir,
            env=env,
            stdout=self._log_file,
            stderr=self._log_file,
            text=True,
        )
        self._wait_until_ready()

    def close(self) -> None:
        """Terminate the backend server started for notebook display."""
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)

        self.process = None

        if self._log_file is not None:
            try:
                self._log_file.close()
            finally:
                self._log_file = None

    def _wait_until_ready(self) -> None:
        """Poll the chosen localhost port until the backend is ready or fails."""
        deadline = time.monotonic() + 60

        while time.monotonic() < deadline:
            if self.process and self.process.poll() is not None:
                log_tail = self._read_log_tail()
                raise RuntimeError(
                    "Qni backend server exited before startup.\n"
                    f"port: {self.port}\n"
                    f"log: {self.log_path}\n\n"
                    f"{log_tail}"
                )

            if _is_port_open(self.port):
                return

            time.sleep(0.1)

        log_tail = self._read_log_tail()

        if self.process and self.process.poll() is None:
            self.process.terminate()

        raise TimeoutError(
            "Timed out waiting for Qni backend server.\n"
            f"port: {self.port}\n"
            f"log: {self.log_path}\n\n"
            f"{log_tail}"
        )

    def _read_log_tail(self) -> str:
        """Read the tail of the backend log for error reporting."""
        if self._log_file is not None:
            self._log_file.flush()

        if self.log_path is None or not self.log_path.exists():
            return "(backend log was not created)"

        try:
            text = self.log_path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            return f"(failed to read backend log: {exc})"

        lines = text.splitlines()
        tail = "\n".join(lines[-80:])
        return tail or "(backend log is empty)"


@overload
def open(
    *,
    steps: list[list[dict[str, Any]]] | None = None,
    circuit: QuriLikeCircuit | None = None,
    quri_code: str | None = None,
    qubit_count: int | None = None,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    view: QniView = "notebook",
    active_step: QniStep | None = None,
    mode: QniInteractionMode = "edit",
    display: Literal[True] = True,
) -> QniEditor | None: ...


@overload
def open(
    *,
    steps: list[list[dict[str, Any]]] | None = None,
    circuit: QuriLikeCircuit | None = None,
    quri_code: str | None = None,
    qubit_count: int | None = None,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    view: QniView = "notebook",
    active_step: QniStep | None = None,
    mode: QniInteractionMode = "edit",
    display: Literal[False] = False,
) -> QniViewer: ...


def open(
    *,
    steps: list[list[dict[str, Any]]] | None = None,
    circuit: QuriLikeCircuit | None = None,
    quri_code: str | None = None,
    qubit_count: int | None = None,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    view: QniView = "notebook",
    active_step: QniStep | None = None,
    mode: QniInteractionMode = "edit",
    display: bool = True,
) -> QniViewer | None:
    """Open Qni and return an editor handle when ``mode="edit"``."""
    if view not in {"notebook", "state", "circuit"}:
        raise ValueError('view must be one of "notebook", "state", or "circuit".')

    input_count = sum(value is not None for value in (steps, circuit, quri_code))
    if input_count > 1:
        raise ValueError("Pass only one of steps, circuit, or quri_code.")

    warnings: tuple[str, ...] = ()
    if circuit is not None:
        steps, inferred_qubit_count, warnings = quri_circuit_to_steps(circuit)
        qubit_count = qubit_count if qubit_count is not None else inferred_qubit_count
    if quri_code is not None:
        steps, inferred_qubit_count, warnings = quri_code_to_steps(quri_code)
        qubit_count = qubit_count if qubit_count is not None else inferred_qubit_count
    if qubit_count is not None and not 1 <= qubit_count <= MAX_DEMO_QUBITS:
        raise ValueError(
            f"QniNotebook's initial demo supports 1-{MAX_DEMO_QUBITS} qubits; "
            f"got {qubit_count}."
        )
    if view != "notebook" and height == DEFAULT_VIEWER_HEIGHT:
        height = _preferred_viewer_height(view, steps or [], qubit_count)
    if view != "notebook" and width == DEFAULT_VIEWER_WIDTH:
        width = _preferred_viewer_width(view, steps or [], qubit_count)
    active_step_index = _resolve_active_step_index(active_step, steps or [])

    backend_port = int(os.environ.get("QNI_BACKEND_PORT", DEFAULT_BACKEND_PORT))
    frontend_port = (
        port
        if port is not None
        else int(os.environ.get("QNI_FRONTEND_PORT", 0)) or None
    )
    public_host = os.environ.get("QNI_PUBLIC_HOST", "127.0.0.1")
    backend_server = _backend_server(backend_port)
    backend_server.start()

    backend_base_url = f"http://{public_host}:{backend_server.port}"
    server = _server(
        frontend_port,
        backend_url=f"{backend_base_url}/backend.json",
    )
    server.start()

    editable = mode == "edit"
    draft_id = uuid.uuid4().hex if editable else None
    state = {
        "steps": steps or [],
        "view": view,
        "editable": editable,
        "simulation_seed": uuid.uuid4().int & 0xFFFFFFFF,
        **(
            {"active_step_index": active_step_index}
            if active_step_index is not None
            else {}
        ),
        **({"qubit_count": qubit_count} if qubit_count is not None else {}),
        "backendUrl": f"{backend_base_url}/backend.json",
        **({"draft_id": draft_id} if draft_id is not None else {}),
    }
    encoded_state = quote(json.dumps(state, separators=(",", ":")))
    cache_bust = str(int(time.time() * 1000))
    viewer_class = QniEditor if editable else QniViewer
    viewer = viewer_class(
        url=(
            f"http://{public_host}:{server.port}/jupyter.html"
            f"?state={encoded_state}&height={height}&qniCacheBust={cache_bust}"
        ),
        height=height,
        width=width,
        warnings=warnings,
        **(
            {"draft_id": draft_id, "backend_url": backend_base_url}
            if editable and draft_id is not None
            else {}
        ),
    )

    if display:
        _display_viewer(viewer)
        return viewer if isinstance(viewer, QniEditor) else None

    return viewer


@overload
def state(
    circuit: QuriLikeCircuit,
    *,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    step: QniStep = "last",
    mode: QniInteractionMode = "inspect",
    display: Literal[True] = True,
) -> None: ...


@overload
def state(
    circuit: QuriLikeCircuit,
    *,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    step: QniStep = "last",
    mode: QniInteractionMode = "inspect",
    display: Literal[False] = False,
) -> QniViewer: ...


def state(
    circuit: QuriLikeCircuit,
    *,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    step: QniStep = "last",
    mode: QniInteractionMode = "inspect",
    display: bool = True,
) -> QniViewer | None:
    """Open a QURI Parts circuit with the Qni state-vector view selected."""
    return open(
        circuit=circuit,
        height=height,
        width=width,
        port=port,
        view="state",
        active_step=step,
        mode=mode,
        display=display,
    )


@overload
def circuit(
    circuit: QuriLikeCircuit,
    *,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    mode: QniInteractionMode = "inspect",
    display: Literal[True] = True,
) -> None: ...


@overload
def circuit(
    circuit: QuriLikeCircuit,
    *,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    mode: QniInteractionMode = "inspect",
    display: Literal[False] = False,
) -> QniViewer: ...


def circuit(
    circuit: QuriLikeCircuit,
    *,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    mode: QniInteractionMode = "inspect",
    display: bool = True,
) -> QniViewer | None:
    """Open a QURI Parts circuit with notebook side panels hidden initially."""
    return open(
        circuit=circuit,
        height=height,
        width=width,
        port=port,
        view="circuit",
        active_step="last",
        mode=mode,
        display=display,
    )


def show_circuit_and_state(
    circuit: QuriLikeCircuit,
    *,
    height: int | Literal["auto"] | None = None,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    step: QniStep = "last",
    display: bool = True,
) -> QniViewer | None:
    """Show the circuit and its state vector side by side.

    The circuit remains visible so selecting a circuit step has an explicit
    relationship to the state vector shown beside it.
    """
    if height is None or height == "auto":
        steps, qubit_count, _ = quri_circuit_to_steps(circuit)
        height = _preferred_inspect_height(steps, qubit_count)

    return open(
        circuit=circuit,
        height=height,
        width=width,
        port=port,
        view="notebook",
        active_step=step,
        mode="inspect",
        display=display,
    )


def inspect(
    circuit: QuriLikeCircuit,
    *,
    height: int | Literal["auto"] | None = None,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    step: QniStep = "last",
    display: bool = True,
) -> QniViewer | None:
    """Compatibility alias for show_circuit_and_state()."""
    return show_circuit_and_state(
        circuit,
        height=height,
        width=width,
        port=port,
        step=step,
        display=display,
    )


def _preferred_inspect_height(
    steps: list[list[dict[str, Any]]],
    qubit_count: int | None,
) -> int:
    """Fit both panes vertically, including the notebook-only chrome."""
    natural_height = max(
        NOTEBOOK_TOOLBAR_HEIGHT + _preferred_circuit_height(steps, qubit_count),
        NOTEBOOK_TOOLBAR_HEIGHT
        + NOTEBOOK_STATE_HEADER_HEIGHT
        + _preferred_state_height(qubit_count),
    )
    return max(240, min(720, natural_height))


def show_circuit(
    circuit: QuriLikeCircuit,
    *,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    display: bool = True,
) -> QniViewer | None:
    """Show the circuit and any final measurement, without the state panel."""
    return open(
        circuit=circuit,
        height=height,
        width=width,
        port=port,
        view="circuit",
        active_step="last",
        mode="inspect",
        display=display,
    )


def review(
    circuit: QuriLikeCircuit,
    *,
    height: int = DEFAULT_VIEWER_HEIGHT,
    width: str | int = DEFAULT_VIEWER_WIDTH,
    port: int | None = None,
    display: bool = True,
) -> QniViewer | None:
    """Compatibility alias for show_circuit()."""
    return show_circuit(
        circuit,
        height=height,
        width=width,
        port=port,
        display=display,
    )


def close() -> None:
    """Stop the notebook frontend and backend servers if this module started them."""
    global _SERVER, _BACKEND_SERVER
    _CIRCUIT_STEP_LAYOUTS.clear()
    if _SERVER is not None:
        _SERVER.close()
        _SERVER = None
    if _BACKEND_SERVER is not None:
        _BACKEND_SERVER.close()
        _BACKEND_SERVER = None


def _preferred_viewer_height(
    view: QniView,
    steps: list[list[dict[str, Any]]],
    qubit_count: int | None,
) -> int:
    """Return a compact initial iframe height for purpose-specific views."""
    if view == "state":
        return _preferred_state_height(qubit_count)
    if view == "circuit":
        return _preferred_circuit_height(steps, qubit_count)
    return DEFAULT_VIEWER_HEIGHT


def _resolve_active_step_index(
    active_step: QniStep | None,
    steps: list[list[dict[str, Any]]],
) -> int | None:
    if active_step is None:
        return None
    if not steps:
        return 0
    if active_step == "last":
        return len(steps) - 1
    if not isinstance(active_step, int):
        raise ValueError('active_step must be an integer, "last", or None.')
    if active_step < 0:
        active_step = len(steps) + active_step
    if active_step < 0 or active_step >= len(steps):
        raise ValueError(
            f"active_step {active_step} is out of range for {len(steps)} steps."
        )
    return active_step


def _preferred_viewer_width(
    view: QniView,
    steps: list[list[dict[str, Any]]],
    qubit_count: int | None,
) -> int:
    """Return a compact initial iframe width for purpose-specific views."""
    if view == "state":
        return _preferred_state_width(qubit_count)
    if view == "circuit":
        return _preferred_circuit_width(steps)
    return 960


def _preferred_state_height(qubit_count: int | None) -> int:
    count = max(1, min(12, int(qubit_count or 1)))
    circle_sizes = {
        1: 64,
        2: 64,
        3: 64,
        4: 48,
        5: 32,
        6: 32,
        7: 32,
        8: 24,
        9: 24,
        10: 16,
        11: 16,
        12: 16,
    }
    circle_size = circle_sizes.get(count, 48)
    margin = 4 if count <= 8 else 1
    rows = (2**count + 2 ** ((count + 1) // 2) - 1) // (2 ** ((count + 1) // 2))
    return max(140, circle_size * 2 + rows * (circle_size + margin) + 16)


def _preferred_state_width(qubit_count: int | None) -> int:
    count = max(1, min(12, int(qubit_count or 1)))
    circle_sizes = {
        1: 64,
        2: 64,
        3: 64,
        4: 48,
        5: 32,
        6: 32,
        7: 32,
        8: 24,
        9: 24,
        10: 16,
        11: 16,
        12: 16,
    }
    circle_size = circle_sizes.get(count, 16)
    margin = 4 if count <= 8 else 1
    cols = 2 ** ((count + 1) // 2)
    return max(160, circle_size * 2 + cols * (circle_size + margin) + 16)


def _preferred_circuit_height(
    steps: list[list[dict[str, Any]]],
    qubit_count: int | None,
) -> int:
    inferred_qubits = qubit_count or _required_qubit_count_from_steps(steps)
    wire_count = max(1, int(inferred_qubits))
    # Qni dropzones are 32px gates with a 1.5x vertical cell and compact padding.
    return max(120, 16 + wire_count * 48 + 32)


def _preferred_circuit_width(steps: list[list[dict[str, Any]]]) -> int:
    occupied_step_count = sum(1 for step in steps if step)
    step_count = max(1, occupied_step_count)
    return max(160, 16 + step_count * 96 + 32)


def _required_qubit_count_from_steps(steps: list[list[dict[str, Any]]]) -> int:
    max_index = -1
    for step in steps:
        for operation in step:
            indices = [
                *(operation.get("targets") or []),
                *(operation.get("controls") or []),
                *(operation.get("antiControls") or []),
            ]
            if indices:
                max_index = max(max_index, *(int(index) for index in indices))
    return max_index + 1 if max_index >= 0 else 1


def _compact_height_from_viewer_url(url: str, fallback: int) -> int:
    """Recover compact display height from an existing viewer URL if possible."""
    try:
        raw_state = parse_qs(urlparse(url).query).get("state", [None])[0]
        if raw_state is None:
            return fallback
        state = json.loads(unquote(raw_state))
    except (ValueError, TypeError, json.JSONDecodeError):
        return fallback

    view = state.get("view")
    if view not in {"state", "circuit"}:
        return fallback

    steps = state.get("steps")
    qubit_count = state.get("qubit_count")
    if not isinstance(steps, list):
        steps = []
    if not isinstance(qubit_count, int):
        qubit_count = None

    return min(fallback, _preferred_viewer_height(view, steps, qubit_count))


def _compact_width_from_viewer_url(url: str, fallback: str | int) -> str | int:
    """Recover compact display width from an existing viewer URL if possible."""
    try:
        raw_state = parse_qs(urlparse(url).query).get("state", [None])[0]
        if raw_state is None:
            return fallback
        state = json.loads(unquote(raw_state))
    except (ValueError, TypeError, json.JSONDecodeError):
        return fallback

    view = state.get("view")
    if view not in {"state", "circuit"}:
        return fallback

    steps = state.get("steps")
    qubit_count = state.get("qubit_count")
    if not isinstance(steps, list):
        steps = []
    if not isinstance(qubit_count, int):
        qubit_count = None

    preferred = _preferred_viewer_width(view, steps, qubit_count)
    return min(fallback, preferred) if isinstance(fallback, int) else preferred


def quri_circuit_to_steps(
    circuit: QuriLikeCircuit,
) -> tuple[list[list[dict[str, Any]]], int, tuple[str, ...]]:
    """Convert a QURI Parts circuit object into Qni steps for visual inspection."""
    if not hasattr(circuit, "gates") or not hasattr(circuit, "qubit_count"):
        raise TypeError("circuit must provide qubit_count and gates attributes.")

    remembered = _remembered_circuit_step_layout(circuit)
    if remembered is not None:
        steps, qubit_count = remembered
        return steps, qubit_count, ()

    steps: list[list[dict[str, Any]]] = []
    unsupported: list[str] = []
    for index, gate in enumerate(circuit.gates):
        gate_name = getattr(gate, "name", type(gate).__name__)
        control_values = tuple(getattr(gate, "control_values", ()))
        if control_values and any(int(value) != 1 for value in control_values):
            unsupported.append(f"{gate_name} with anti-control at gate index {index}")
            continue
        operation = _quri_gate_to_operation(gate)
        if operation is None:
            unsupported.append(f'{gate_name} at gate index {index}')
            continue
        if operation:
            _append_operation_to_parallel_step(steps, operation)

    if unsupported:
        raise ValueError(
            "Unsupported QURI Parts operations; visualization stopped to avoid "
            "showing a different circuit: " + ", ".join(unsupported)
        )
    return steps, int(circuit.qubit_count), ()


def _append_operation_to_parallel_step(
    steps: list[list[dict[str, Any]]], operation: dict[str, Any]
) -> None:
    """Place adjacent, equivalent operations on disjoint qubits in one step."""
    occupied_qubits = {
        int(index)
        for key in ("targets", "controls")
        for index in operation.get(key, ())
    }
    if steps:
        current_operation = steps[-1][-1]
        current_step_qubits = {
            int(index)
            for step_operation in steps[-1]
            for key in ("targets", "controls")
            for index in step_operation.get(key, ())
        }
        same_gate_shape = (
            operation.get("type") == current_operation.get("type")
            and len(operation.get("targets", ()))
            == len(current_operation.get("targets", ()))
            and len(operation.get("controls", ()))
            == len(current_operation.get("controls", ()))
        )
        if same_gate_shape and occupied_qubits.isdisjoint(current_step_qubits):
            steps[-1].append(operation)
            return
    steps.append([operation])


def _remember_circuit_step_layout(
    circuit: QuriLikeCircuit,
    steps: list[Any],
    qubit_count: int,
) -> None:
    """Keep Qni's visual columns for an unchanged circuit returned by commit()."""
    normalized_steps = json.loads(json.dumps(steps))
    if not isinstance(normalized_steps, list) or not all(
        isinstance(step, list) for step in normalized_steps
    ):
        return
    _CIRCUIT_STEP_LAYOUTS[id(circuit)] = (
        circuit,
        _circuit_layout_fingerprint(circuit),
        normalized_steps,
        qubit_count,
    )


def _remembered_circuit_step_layout(
    circuit: QuriLikeCircuit,
) -> tuple[list[list[dict[str, Any]]], int] | None:
    remembered = _CIRCUIT_STEP_LAYOUTS.get(id(circuit))
    if remembered is None:
        return None
    remembered_circuit, fingerprint, steps, qubit_count = remembered
    if remembered_circuit is not circuit:
        return None
    if fingerprint != _circuit_layout_fingerprint(circuit):
        _CIRCUIT_STEP_LAYOUTS.pop(id(circuit), None)
        return None
    return json.loads(json.dumps(steps)), qubit_count


def _circuit_layout_fingerprint(circuit: QuriLikeCircuit) -> tuple[Any, ...]:
    """Describe the gate sequence so stale visual metadata is never reused."""
    gates = tuple(
        (
            getattr(gate, "name", type(gate).__name__),
            tuple(getattr(gate, "target_indices", ())),
            tuple(getattr(gate, "control_indices", ())),
            tuple(repr(param) for param in getattr(gate, "params", ())),
            tuple(getattr(gate, "classical_indices", ())),
        )
        for gate in circuit.gates
    )
    return (int(circuit.qubit_count), gates)


def quri_code_to_steps(
    code: str,
) -> tuple[list[list[dict[str, Any]]], int, tuple[str, ...]]:
    """Parse simple QURI Parts Python code into Qni steps without importing QURI."""
    try:
        module = ast.parse(code)
    except SyntaxError as exc:
        raise ValueError(f"quri_code is not valid Python: {exc}") from exc

    int_names = _find_literal_int_variables(module)
    circuit_names = _find_quantum_circuit_variables(module, int_names)
    if not circuit_names:
        raise ValueError(
            "quri_code must assign QuantumCircuit(...), for example "
            "circuit = QuantumCircuit(2)."
        )

    steps: list[list[dict[str, Any]]] = []
    warnings: list[str] = []
    qubit_count = max(circuit_names.values())
    for statement in module.body:
        operation = _statement_to_qni_operation(statement, circuit_names)
        if operation is None:
            continue
        if isinstance(operation, str):
            warnings.append(operation)
            continue
        steps.append([operation])

    return steps, qubit_count, tuple(warnings)


def _find_literal_int_variables(module: ast.Module) -> dict[str, int]:
    """Collect simple integer constants used in typical QURI tutorial code."""
    int_names: dict[str, int] = {}
    for statement in module.body:
        if not isinstance(statement, ast.Assign):
            continue
        try:
            value = ast.literal_eval(statement.value)
        except (ValueError, TypeError):
            continue
        if not isinstance(value, int):
            continue
        for target in statement.targets:
            if isinstance(target, ast.Name):
                int_names[target.id] = value
    return int_names


def _find_quantum_circuit_variables(
    module: ast.Module,
    int_names: dict[str, int],
) -> dict[str, int]:
    """Collect variable names assigned from QuantumCircuit(qubit_count)."""
    circuit_names: dict[str, int] = {}
    for statement in module.body:
        if not isinstance(statement, ast.Assign):
            continue
        if not isinstance(statement.value, ast.Call):
            continue
        if _call_name(statement.value.func) != "QuantumCircuit":
            continue
        qubit_count = _literal_int_arg(statement.value, 0, int_names)
        if qubit_count is None:
            qubit_count = _literal_int_keyword(
                statement.value,
                ("n_qubits", "qubit_count"),
                int_names,
            )
        if qubit_count is None:
            continue
        for target in statement.targets:
            if isinstance(target, ast.Name):
                circuit_names[target.id] = qubit_count
    return circuit_names


def _statement_to_qni_operation(
    statement: ast.stmt,
    circuit_names: dict[str, int],
) -> dict[str, Any] | str | None:
    """Convert one circuit method call statement into a Qni operation or warning."""
    if not isinstance(statement, ast.Expr) or not isinstance(statement.value, ast.Call):
        return None
    call = statement.value
    if not isinstance(call.func, ast.Attribute):
        return None
    if not isinstance(call.func.value, ast.Name):
        return None
    if call.func.value.id not in circuit_names:
        return None

    method_name = call.func.attr
    operation = _quri_method_call_to_operation(method_name, call)
    if operation is None:
        return f'QURI code call "{method_name}" was skipped.'
    return operation


def _quri_method_call_to_operation(
    method_name: str,
    call: ast.Call,
) -> dict[str, Any] | None:
    """Map supported QuantumCircuit.add_* calls to Qni serialized operations."""
    single_methods = {
        "add_H_gate": "H",
        "add_X_gate": "X",
        "add_Y_gate": "Y",
        "add_Z_gate": "Z",
        "add_S_gate": "S",
        "add_Sdag_gate": "S†",
        "add_T_gate": "T",
        "add_Tdag_gate": "T†",
        "add_SqrtX_gate": "X^½",
    }
    if method_name in single_methods:
        target = _literal_int_arg(call, 0)
        return None if target is None else _operation(single_methods[method_name], [target])

    angle_methods = {
        "add_RX_gate": "Rx",
        "add_RY_gate": "Ry",
        "add_RZ_gate": "Rz",
        "add_U1_gate": "P",
    }
    if method_name in angle_methods:
        target = _literal_int_arg(call, 0)
        angle = _literal_arg(call, 1)
        if target is None:
            return None
        operation = _operation(angle_methods[method_name], [target])
        if angle is not None:
            operation["angle"] = _format_quri_angle(angle)
        return operation

    if method_name == "add_CNOT_gate":
        control = _literal_int_arg(call, 0)
        target = _literal_int_arg(call, 1)
        if control is None or target is None:
            return None
        return _operation("X", [target], [control])

    if method_name == "add_CZ_gate":
        control = _literal_int_arg(call, 0)
        target = _literal_int_arg(call, 1)
        if control is None or target is None:
            return None
        return _operation("Z", [target], [control])

    if method_name == "add_TOFFOLI_gate":
        control0 = _literal_int_arg(call, 0)
        control1 = _literal_int_arg(call, 1)
        target = _literal_int_arg(call, 2)
        if control0 is None or control1 is None or target is None:
            return None
        return _operation("X", [target], [control0, control1])

    if method_name == "add_SWAP_gate":
        target0 = _literal_int_arg(call, 0)
        target1 = _literal_int_arg(call, 1)
        if target0 is None or target1 is None:
            return None
        return _operation("Swap", [target0, target1])

    if method_name == "measure":
        targets = _literal_int_list_arg(call, 0)
        if targets is None:
            target = _literal_int_arg(call, 0)
            targets = None if target is None else [target]
        if targets is None:
            return None
        operation = _operation("Measure", targets)
        classical_indices = _literal_int_list_arg(call, 1)
        if classical_indices is None:
            classical_index = _literal_int_arg(call, 1)
            classical_indices = None if classical_index is None else [classical_index]
        if classical_indices is not None:
            operation["classical_indices"] = classical_indices
        return operation

    return None


def _quri_gate_to_operation(gate: Any) -> dict[str, Any] | None:
    """Map one QURI gate object to the serialized operation shape Qni can load."""
    name = getattr(gate, "name", None)
    targets = [int(target) for target in getattr(gate, "target_indices", ())]
    controls = [int(control) for control in getattr(gate, "control_indices", ())]
    params = tuple(getattr(gate, "params", ()))
    classical_indices = getattr(gate, "classical_indices", ())

    if name == "Identity":
        return {}

    single_gate_map = {
        "H": "H",
        "X": "X",
        "Y": "Y",
        "Z": "Z",
        "S": "S",
        "Sdag": "S†",
        "T": "T",
        "Tdag": "T†",
        "SqrtX": "X^½",
    }
    if name in single_gate_map:
        return _operation(single_gate_map[name], targets, controls)

    rotation_gate_map = {
        "RX": "Rx",
        "RY": "Ry",
        "RZ": "Rz",
        "U1": "P",
    }
    if name in rotation_gate_map and params:
        operation = _operation(rotation_gate_map[name], targets, controls)
        operation["angle"] = _format_quri_angle(params[0])
        return operation

    if name == "CNOT" and len(controls) == 1 and len(targets) == 1:
        return _operation("X", targets, controls)
    if name == "CZ" and len(controls) == 1 and len(targets) == 1:
        return _operation("Z", targets, controls)
    if name == "TOFFOLI" and len(controls) == 2 and len(targets) == 1:
        return _operation("X", targets, controls)
    if name == "SWAP" and len(targets) == 2:
        return _operation("Swap", targets)
    if name == "Measurement":
        if classical_indices and tuple(map(int, classical_indices)) != tuple(targets):
            return None
        operation = _operation("Measure", targets)
        if classical_indices:
            operation["classical_indices"] = [
                int(index) for index in classical_indices
            ]
        return operation

    if name in {"MCX", "MCY", "MCZ", "MCH", "MCS", "MCSdag", "MCT", "MCTdag"}:
        mc_gate_map = {
            "MCX": "X",
            "MCY": "Y",
            "MCZ": "Z",
            "MCH": "H",
            "MCS": "S",
            "MCSdag": "S†",
            "MCT": "T",
            "MCTdag": "T†",
        }
        return _operation(mc_gate_map[name], targets, controls)

    return None


def _operation(
    operation_type: str,
    targets: Sequence[int],
    controls: Sequence[int] = (),
) -> dict[str, Any]:
    """Build one Qni serialized operation, omitting empty optional fields."""
    operation: dict[str, Any] = {
        "type": operation_type,
        "targets": list(targets),
    }
    if controls:
        operation["controls"] = list(controls)
    return operation


def _format_quri_angle(value: Any) -> str:
    """Format QURI numeric parameters for Qni angle gate labels."""
    if isinstance(value, float):
        return f"{value:.12g}"
    return str(value)


def _call_name(node: ast.AST) -> str | None:
    """Return the simple function name from a direct or module-qualified call."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _literal_arg(call: ast.Call, index: int) -> Any | None:
    """Read a positional call argument only when it is a Python literal."""
    if index >= len(call.args):
        return None
    try:
        return ast.literal_eval(call.args[index])
    except (ValueError, TypeError):
        return None


def _literal_int_arg(
    call: ast.Call,
    index: int,
    int_names: dict[str, int] | None = None,
) -> int | None:
    """Read a positional call argument as an int literal or known int variable."""
    if int_names is not None and index < len(call.args):
        node = call.args[index]
        if isinstance(node, ast.Name) and node.id in int_names:
            return int_names[node.id]
    value = _literal_arg(call, index)
    return value if isinstance(value, int) else None


def _literal_int_keyword(
    call: ast.Call,
    names: Sequence[str],
    int_names: dict[str, int],
) -> int | None:
    """Read a keyword call argument as an int literal or known int variable."""
    for keyword in call.keywords:
        if keyword.arg not in names:
            continue
        if isinstance(keyword.value, ast.Name) and keyword.value.id in int_names:
            return int_names[keyword.value.id]
        try:
            value = ast.literal_eval(keyword.value)
        except (ValueError, TypeError):
            return None
        return value if isinstance(value, int) else None
    return None


def _literal_int_list_arg(call: ast.Call, index: int) -> list[int] | None:
    """Read a positional call argument as a list of literal integers."""
    value = _literal_arg(call, index)
    if isinstance(value, int):
        return [value]
    if not isinstance(value, (list, tuple)):
        return None
    if not all(isinstance(item, int) for item in value):
        return None
    return list(value)


def _render_warnings(warnings: Sequence[str]) -> str:
    """Render conversion warnings above the iframe without breaking notebook layout."""
    if not warnings:
        return ""

    items = "".join(
        f"<li>{html.escape(warning)}</li>" for warning in warnings[:5]
    )
    more = ""
    if len(warnings) > 5:
        more = f"<li>{len(warnings) - 5} more warnings omitted.</li>"

    return (
        '<div style="box-sizing:border-box; position:absolute; left:8px; right:8px; '
        'top:8px; z-index:2; max-height:96px; overflow:auto; padding:6px 8px; '
        'border:1px solid #f59e0b; background:#fffbeb; color:#92400e; '
        'font:12px/1.4 system-ui, sans-serif; box-shadow:0 1px 3px rgba(0,0,0,.12);">'
        "<strong>QURI to Qni warnings</strong>"
        f'<ul style="margin:4px 0 0 18px; padding:0;">{items}{more}</ul>'
        "</div>"
    )


def _server(port: int | None, backend_url: str | None = None) -> QniJupyterServer:
    """Return the existing frontend server unless the requested port requires a new one."""
    global _SERVER
    if _SERVER is not None and (port is None or _SERVER.port == port):
        if backend_url is not None:
            _SERVER.backend_url = backend_url
        return _SERVER

    if _SERVER is not None:
        _SERVER.close()

    _SERVER = QniJupyterServer(_frontend_dir(), port, backend_url=backend_url)
    return _SERVER


def _backend_server(port: int | None = None) -> QniJupyterBackendServer:
    """Return the existing backend server unless the requested port requires a new one."""
    global _BACKEND_SERVER
    if _BACKEND_SERVER is not None and (port is None or _BACKEND_SERVER.port == port):
        return _BACKEND_SERVER

    if _BACKEND_SERVER is not None:
        _BACKEND_SERVER.close()

    _BACKEND_SERVER = QniJupyterBackendServer(port)
    return _BACKEND_SERVER


def _frontend_dir() -> Path:
    """Locate the repository frontend directory from the installed package path."""
    frontend_dir = Path(__file__).resolve().parents[1] / "frontend"
    if not frontend_dir.exists():
        raise FileNotFoundError(f"Could not find QniGPU frontend: {frontend_dir}")
    return frontend_dir


def _display_viewer(viewer: QniViewer) -> None:
    """Display the iframe in IPython, or raise a clear error outside notebooks."""
    try:
        from IPython.display import clear_output, display as ipython_display
    except ImportError as exc:
        raise RuntimeError(
            "IPython is required to display QniGPU in a notebook cell. "
            "Call qni.open(display=False) to get the iframe URL instead.",
        ) from exc

    # 古い大きなiframe出力を即時に消し、Notebookセルの表示高さを再計算させる。
    clear_output(wait=False)
    ipython_display(viewer)


def _find_free_port() -> int:
    """Ask the OS for an available localhost TCP port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _is_port_open(port: int) -> bool:
    """Return true when a process is listening on the localhost port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) == 0


atexit.register(close)
