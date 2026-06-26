import pytest
from werkzeug.datastructures import ImmutableMultiDict

from qni.circuit_request_data import CircuitRequestData
from qni.types import DeviceType


@pytest.fixture
def form_data():
    return ImmutableMultiDict([
        ("id", "test_circuit"),
        ("qubitCount", "5"),
        ("untilStepIndex", "3"),
        ("steps", '[{"type": "H", "targets": [0]}]'),
        ("amplitudeIndices", "0,1,2,3"),
        ("device", "GPU"),
    ])


def test_request_data_initialization(form_data):
    request_data = CircuitRequestData(form_data)

    assert request_data.circuit_id == "test_circuit"
    assert request_data.qubit_count == 5
    assert request_data.until_step_index == 3
    assert request_data.steps == [{"type": "H", "targets": [0]}]
    assert request_data.amplitude_indices == [0, 1, 2, 3]
    assert request_data.device == DeviceType.GPU


def test_request_data_default_values():
    form_data = ImmutableMultiDict()
    request_data = CircuitRequestData(form_data)

    assert request_data.circuit_id == ""
    assert request_data.qubit_count == 0
    assert request_data.until_step_index == 0
    assert request_data.steps == []
    assert request_data.amplitude_indices == []
    assert request_data.device == DeviceType.CPU
