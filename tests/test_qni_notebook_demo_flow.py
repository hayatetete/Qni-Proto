import json
import subprocess
from math import pi, sqrt
from pathlib import Path

import pytest
from qni.qiskit_runner import QiskitRunner
from qni_jupyter import qni
from quri_parts.circuit import QuantumCircuit


def _grover_circuit() -> QuantumCircuit:
    circuit = QuantumCircuit(5, cbit_count=5)
    for qubit in range(3):
        circuit.add_H_gate(qubit)
    circuit.add_TOFFOLI_gate(0, 1, 4)
    circuit.add_TOFFOLI_gate(4, 2, 3)
    circuit.add_Z_gate(3)
    circuit.add_TOFFOLI_gate(4, 2, 3)
    circuit.add_TOFFOLI_gate(0, 1, 4)
    for qubit in range(3):
        circuit.add_H_gate(qubit)
    for qubit in range(3):
        circuit.add_X_gate(qubit)
    circuit.add_H_gate(2)
    circuit.add_TOFFOLI_gate(0, 1, 2)
    circuit.add_H_gate(2)
    for qubit in range(3):
        circuit.add_X_gate(qubit)
    for qubit in range(3):
        circuit.add_H_gate(qubit)
    circuit.measure([0, 1, 2], [0, 1, 2])
    return circuit


def test_quri_circuit_intermediate_states_match_known_values() -> None:
    circuit = _grover_circuit()

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
    assert qubit_count == 5
    assert len(steps) == 14
    assert steps[0] == [
        {"type": "H", "targets": [0]},
        {"type": "H", "targets": [1]},
        {"type": "H", "targets": [2]},
    ]

    for result in results:
        assert sum(abs(value) ** 2 for value in result["amplitudes"].values()) == (
            pytest.approx(1.0)
        )

    # オラクルが条件111だけを位相反転し、補助量子ビットを|0>へ戻す。
    expected_amplitude = 1 / sqrt(8)
    assert results[3]["amplitudes"][31] == pytest.approx(-expected_amplitude)
    assert results[4]["amplitudes"][23] == pytest.approx(-expected_amplitude)
    assert results[5]["amplitudes"][7] == pytest.approx(-expected_amplitude)
    assert all(
        abs(results[5]["amplitudes"][index]) < 1e-9 for index in range(16, 32)
    )

    # 拡散演算途中のHでは、破壊的干渉により000、001、010が一時的に0になる。
    diffusion_intermediate = results[8]["amplitudes"]
    assert all(
        abs(diffusion_intermediate[index]) < 1e-9 for index in (0, 1, 2)
    )
    assert abs(diffusion_intermediate[3]) ** 2 == pytest.approx(1 / 2)
    for index in range(4, 8):
        assert abs(diffusion_intermediate[index]) ** 2 == pytest.approx(1 / 8)

    # 1回の拡散演算で111の測定確率が25/32まで増幅される。
    before_measurement = results[12]["amplitudes"]
    assert abs(before_measurement[7]) ** 2 == pytest.approx(25 / 32)
    for index in range(7):
        assert abs(before_measurement[index]) ** 2 == pytest.approx(1 / 32)
    assert all(abs(before_measurement[index]) < 1e-9 for index in range(8, 32))

    # 測定値と測定後に残る基底状態が一致する。
    measured = results[13]
    assert set(measured["measuredBits"]) == {0, 1, 2}
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


def test_demo_rejects_rotation_gate_instead_of_changing_its_angle() -> None:
    circuit = QuantumCircuit(1)
    circuit.add_RX_gate(0, 0.25)

    with pytest.raises(ValueError, match="RX with a rotation angle"):
        qni.show_circuit_and_state(circuit, display=False)


def test_quri_circuit_can_be_inspected_step_by_step_in_browser() -> None:
    circuit = _grover_circuit()
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
    assert len(result["stateByStep"]) == 14

    oracle_state = {entry["index"]: entry for entry in result["stateByStep"][3]}
    assert abs(oracle_state[31]["phase"]) == pytest.approx(pi)

    before_measurement = {
        entry["index"]: entry for entry in result["stateByStep"][12]
    }
    assert before_measurement[7]["probability"] == pytest.approx(78.125)
    assert all(
        before_measurement[index]["probability"] == pytest.approx(3.125)
        for index in range(7)
    )

    measured_bits = {
        int(bit): value for bit, value in result["measuredByStep"][13].items()
    }
    revisited_measurement = {
        int(bit): value for bit, value in result["revisitedMeasurement"].items()
    }
    assert set(measured_bits) == {0, 1, 2}
    assert revisited_measurement == measured_bits
    measurements_by_step = [
        {int(bit): value for bit, value in step_measurement.items()}
        for step_measurement in result["measuredByStep"]
    ]
    assert measurements_by_step == [measured_bits] * 14, measurements_by_step
    measured_index = sum(value << bit for bit, value in measured_bits.items())
    measured_state = result["stateByStep"][13]
    assert len(measured_state) == 1
    assert measured_state[0]["index"] == measured_index
    assert measured_state[0]["probability"] == pytest.approx(100)
