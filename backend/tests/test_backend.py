import json
from math import sqrt

from qni.backend import app
from tests.conftest import assert_amplitudes_approx


def test_post_empty_circuit():
    response = app.test_client().post("/backend.json", data={})
    res = json.loads(response.data.decode("utf-8"))

    assert response.status_code == 200
    assert len(res) == 0


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
