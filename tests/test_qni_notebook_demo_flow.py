import json
import subprocess
from math import cos, pi, sin
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from qni.qiskit_runner import QiskitRunner
from qni_jupyter import qni
from quri_parts.circuit import QuantumCircuit


def _qsci_input_state_circuit(*, omit_last_entangler: bool = False) -> QuantumCircuit:
    """Prepare a readable two-configuration trial state for the QSCI demo."""
    circuit = QuantumCircuit(4, cbit_count=4)
    circuit.add_X_gate(0)
    circuit.add_X_gate(1)
    circuit.add_RY_gate(0, pi / 3)
    circuit.add_X_gate(0)
    circuit.add_CNOT_gate(0, 1)
    circuit.add_CNOT_gate(0, 2)
    if not omit_last_entangler:
        circuit.add_CNOT_gate(0, 3)
    circuit.add_X_gate(0)
    circuit.measure([0, 1, 2, 3], [0, 1, 2, 3])
    return circuit


def test_quri_circuit_intermediate_states_match_known_values() -> None:
    circuit = _qsci_input_state_circuit()

    steps, qubit_count, warnings = qni.quri_circuit_to_steps(circuit)
    results = [
        QiskitRunner().run_circuit(
            steps,
            qubit_count=qubit_count,
            until_step_index=step_index,
        )[step_index]
        for step_index in range(len(steps))
    ]

    assert warnings == ()
    assert qubit_count == 4
    assert len(steps) == 8
    assert steps[0] == [
        {"type": "X", "targets": [0]},
        {"type": "X", "targets": [1]},
    ]

    for result in results:
        assert sum(abs(value) ** 2 for value in result["amplitudes"].values()) == (
            pytest.approx(1.0)
        )

    # 初期配置|0011>から、2電子配置|0011>と|1100>を75%対25%で作る。
    assert results[0]["amplitudes"][3] == pytest.approx(1.0)
    before_measurement = results[6]["amplitudes"]
    theta = pi / 6
    assert before_measurement[3] == pytest.approx(cos(theta))
    assert before_measurement[12] == pytest.approx(-sin(theta))
    assert abs(before_measurement[3]) ** 2 == pytest.approx(0.75)
    assert abs(before_measurement[12]) ** 2 == pytest.approx(0.25)
    assert all(
        abs(before_measurement[index]) < 1e-9
        for index in range(16)
        if index not in (3, 12)
    )

    # 測定値と測定後に残る基底状態が一致する。
    measured = results[7]
    assert set(measured["measuredBits"]) == {0, 1, 2, 3}
    assert set(measured["measuredBits"].values()) <= {0, 1}
    measured_index = sum(
        value << bit for bit, value in measured["measuredBits"].items()
    )
    collapsed_support = [
        index
        for index, amplitude in measured["amplitudes"].items()
        if abs(amplitude) > 1e-9
    ]
    assert collapsed_support == [measured_index]


def test_demo_preserves_numeric_rotation_angle() -> None:
    circuit = QuantumCircuit(1)
    circuit.add_RX_gate(0, 0.25)

    viewer = qni.show_circuit_and_state(circuit, display=False)

    assert viewer is not None
    assert '%22angle%22%3A%220.25%22' in viewer.url
    qni.close()


def test_notebook_helpers_select_distinct_read_only_views() -> None:
    circuit = QuantumCircuit(2)
    circuit.add_H_gate(0)
    circuit.add_CNOT_gate(0, 1)

    try:
        circuit_viewer = qni.show_circuit(circuit, display=False)
        state_viewer = qni.show_circuit_and_state(circuit, display=False)
        assert circuit_viewer is not None
        assert state_viewer is not None

        def viewer_state(url: str) -> dict[str, object]:
            encoded = parse_qs(urlparse(url).query)["state"][0]
            return json.loads(encoded)

        circuit_state = viewer_state(circuit_viewer.url)
        state_state = viewer_state(state_viewer.url)
        assert circuit_state["view"] == "circuit"
        assert circuit_state["editable"] is False
        assert state_state["view"] == "notebook"
        assert state_state["editable"] is False
    finally:
        qni.close()


def test_missing_entangler_exposes_particle_number_violation() -> None:
    circuit = _qsci_input_state_circuit(omit_last_entangler=True)
    steps, qubit_count, _ = qni.quri_circuit_to_steps(circuit)

    result = QiskitRunner().run_circuit(
        steps,
        qubit_count=qubit_count,
        until_step_index=len(steps) - 2,
    )[len(steps) - 2]
    support = {
        index
        for index, amplitude in result["amplitudes"].items()
        if abs(amplitude) > 1e-9
    }

    assert support == {3, 4}
    assert (4).bit_count() == 1


def test_quri_circuit_can_be_inspected_step_by_step_in_browser() -> None:
    circuit = _qsci_input_state_circuit()
    viewer = qni.show_circuit_and_state(circuit, display=False)
    assert viewer is not None

    project_root = Path(__file__).resolve().parents[1]
    try:
        completed = subprocess.run(
            [
                "yarn",
                "node",
                "script/inspect-notebook-demo.mjs",
                viewer.url,
            ],
            cwd=project_root / "frontend",
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
    finally:
        qni.close()

    result = json.loads(completed.stdout)
    assert result["headerVisible"] is True
    assert result["editMenuHidden"] is True
    assert len(result["stateByStep"]) == 8

    before_measurement = {
        entry["index"]: entry for entry in result["stateByStep"][6]
    }
    assert before_measurement[3]["probability"] == pytest.approx(75.0, abs=1e-4)
    assert before_measurement[12]["probability"] == pytest.approx(25.0, abs=1e-4)

    measured_bits = {
        int(bit): value for bit, value in result["measuredByStep"][7].items()
    }
    revisited_measurement = {
        int(bit): value for bit, value in result["revisitedMeasurement"].items()
    }
    assert set(measured_bits) == {0, 1, 2, 3}
    assert revisited_measurement == measured_bits
    measurements_by_step = [
        {int(bit): value for bit, value in step_measurement.items()}
        for step_measurement in result["measuredByStep"]
    ]
    assert measurements_by_step == [measured_bits] * 8, measurements_by_step
    measured_index = sum(value << bit for bit, value in measured_bits.items())
    assert measured_index in {3, 12}
    measured_state = result["stateByStep"][7]
    assert len(measured_state) == 1
    assert measured_state[0]["index"] == measured_index
    assert measured_state[0]["probability"] == pytest.approx(100)
