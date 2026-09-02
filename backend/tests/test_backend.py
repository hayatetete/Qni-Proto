import json
from math import sqrt
from unittest.mock import patch

from qni.backend import app, editor_drafts
from qni.qiskit_runner import SimulationTimeoutError
from tests.conftest import assert_amplitudes_approx


def test_post_empty_circuit():
    response = app.test_client().post("/backend.json", data={})
    res = json.loads(response.data.decode("utf-8"))

    assert response.status_code == 400
    assert "qubitCount" in res["error"]


def test_rejects_circuit_above_demo_qubit_limit():
    response = app.test_client().post(
        "/backend.json",
        data={"qubitCount": 9, "untilStepIndex": 0, "steps": "[[]]"},
    )

    assert response.status_code == 400
    assert "between 1 and 8" in response.get_json()["error"]


def test_rejects_step_index_outside_circuit():
    response = app.test_client().post(
        "/backend.json",
        data={"qubitCount": 2, "untilStepIndex": 1, "steps": "[[]]"},
    )

    assert response.status_code == 400
    assert "outside the circuit steps" in response.get_json()["error"]


def test_rejects_payload_above_demo_limit():
    response = app.test_client().post(
        "/backend.json",
        data={
            "qubitCount": 2,
            "untilStepIndex": 0,
            "steps": "[[]]",
            "padding": "x" * (256 * 1024),
        },
    )

    assert response.status_code == 413


def test_reports_simulation_timeout():
    with patch(
        "qni.backend.cached_qiskit_runner.run",
        side_effect=SimulationTimeoutError(),
    ):
        response = app.test_client().post(
            "/backend.json",
            data={"qubitCount": 2, "untilStepIndex": 0, "steps": "[[]]"},
        )

    assert response.status_code == 504
    assert "10-second demo limit" in response.get_json()["error"]


def test_post_simple_circuit():
    request_data = {
        "id": '{"cols": [["H", 1], [1, 1], [1, 1], [1, 1], [1, 1]]}',
        "qubitCount": 2,
        "untilStepIndex": 0,
        "amplitudeIndices": "0,1,2,3",
        "steps": '[[{"type": "H", "targets": [0]}], [], [], [], []]',
    }

    response = app.test_client().post("/backend.json", data=request_data)

    res = json.loads(response.data.decode("utf-8"))

    assert response.status_code == 200
    assert len(res) == 5
    assert_amplitudes_approx(
        res[0]["amplitudes"],
        {"0": [1 / sqrt(2), 0], "1": [1 / sqrt(2), 0], "2": [0, 0], "3": [0, 0.0]},
    )


def test_post_simple_circuit_no_amplitude_indices():
    request_data = {
        "id": '{"cols": [["H", 1], [1, 1], [1, 1], [1, 1], [1, 1]]}',
        "qubitCount": 2,
        "untilStepIndex": 0,
        "steps": '[[{"type": "H", "targets": [0]}], [], [], [], []]',
    }

    response = app.test_client().post("/backend.json", data=request_data)

    res = json.loads(response.data.decode("utf-8"))

    assert response.status_code == 200
    assert len(res) == 5
    assert_amplitudes_approx(
        res[0]["amplitudes"],
        {"0": [1 / sqrt(2), 0], "1": [1 / sqrt(2), 0], "2": [0, 0], "3": [0, 0.0]},
    )


def test_can_return_amplitudes_for_every_step_for_client_cache():
    response = app.test_client().post(
        "/backend.json",
        data={
            "qubitCount": 1,
            "untilStepIndex": 0,
            "amplitudeIndices": "0,1",
            "includeAllAmplitudes": "true",
            "steps": '[[{"type": "H", "targets": [0]}], [{"type": "X", "targets": [0]}]]',
        },
    )

    results = response.get_json()
    assert response.status_code == 200
    assert "amplitudes" in results[0]
    assert "amplitudes" in results[1]


def test_editor_draft_round_trip():
    editor_drafts.clear()
    payload = {
        "steps": [[{"type": "H", "targets": [0]}]],
        "qubit_count": 2,
        "code": "circuit = object()",
        "warnings": [],
        "dirty": True,
    }

    saved = app.test_client().put("/editor-drafts/session-1", json=payload)
    loaded = app.test_client().get("/editor-drafts/session-1")

    assert saved.status_code == 200
    assert loaded.status_code == 200
    assert loaded.get_json() == payload
