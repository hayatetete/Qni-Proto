import json
import subprocess
from math import sqrt
from pathlib import Path

import pytest
from qni.qiskit_runner import QiskitRunner
from qni_jupyter import qni
from quri_parts.circuit import QuantumCircuit


def test_quri_circuit_intermediate_states_match_known_values() -> None:
    circuit = QuantumCircuit(4)
    circuit.add_H_gate(0)
    circuit.add_H_gate(1)
    circuit.add_CNOT_gate(0, 2)
    circuit.add_CZ_gate(1, 3)
    circuit.add_CNOT_gate(2, 3)
    circuit.add_X_gate(3)  # Intentional defect used by the demo scenario.

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
    assert len(steps) == 6

    expected_amplitudes_by_step = [
        {0: 1 / sqrt(2), 1: 1 / sqrt(2)},
        {0: 0.5, 1: 0.5, 2: 0.5, 3: 0.5},
        {0: 0.5, 2: 0.5, 5: 0.5, 7: 0.5},
        {0: 0.5, 2: 0.5, 5: 0.5, 7: 0.5},
        {0: 0.5, 2: 0.5, 13: 0.5, 15: 0.5},
        {5: 0.5, 7: 0.5, 8: 0.5, 10: 0.5},
    ]
    for result, expected_amplitudes in zip(
        results,
        expected_amplitudes_by_step,
        strict=True,
    ):
        for index, amplitude in result["amplitudes"].items():
            assert amplitude == pytest.approx(expected_amplitudes.get(index, 0j))
        assert sum(abs(value) ** 2 for value in result["amplitudes"].values()) == (
            pytest.approx(1.0)
        )


def test_demo_rejects_rotation_gate_instead_of_changing_its_angle() -> None:
    circuit = QuantumCircuit(1)
    circuit.add_RX_gate(0, 0.25)

    with pytest.raises(ValueError, match="RX with a rotation angle"):
        qni.show_circuit_and_state(circuit, display=False)


def test_quri_circuit_can_be_inspected_step_by_step_in_browser() -> None:
    circuit = QuantumCircuit(4)
    circuit.add_H_gate(0)
    circuit.add_H_gate(1)
    circuit.add_CNOT_gate(0, 2)
    circuit.add_CZ_gate(1, 3)
    circuit.add_CNOT_gate(2, 3)
    circuit.add_X_gate(3)
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
    assert result == {
        "supportByStep": [
            [0, 1],
            [0, 1, 2, 3],
            [0, 2],
            [0, 2],
            [0, 2],
            [8, 10],
        ],
        "headerVisible": True,
        "editMenuHidden": True,
    }
