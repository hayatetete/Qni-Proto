from dataclasses import dataclass, field
from unittest.mock import patch

import pytest

from qni_jupyter import qni


@dataclass
class FakeGate:
    name: str
    target_indices: tuple[int, ...]
    control_indices: tuple[int, ...] = ()
    params: tuple[float, ...] = ()
    classical_indices: tuple[int, ...] = ()


@dataclass
class FakeCircuit:
    qubit_count: int
    gates: list[FakeGate] = field(default_factory=list)


def test_editor_commit_preserves_parallel_gate_columns() -> None:
    steps = [
        [
            {"type": "H", "targets": [0]},
            {"type": "H", "targets": [1]},
            {"type": "H", "targets": [2]},
        ]
    ]
    payload = {
        "steps": steps,
        "qubit_count": 3,
        "warnings": [],
        "code": (
            "from quri_parts.circuit import QuantumCircuit\n"
            "circuit = QuantumCircuit(3)\n"
            "circuit.add_H_gate(0)\n"
            "circuit.add_H_gate(1)\n"
            "circuit.add_H_gate(2)\n"
        ),
    }
    editor = qni.QniEditor(
        url="http://example.invalid",
        height=420,
        width="100%",
        draft_id="test",
        backend_url="http://example.invalid",
    )

    with patch.object(qni.QniEditor, "_draft_payload", return_value=payload):
        circuit = editor.commit()

    restored_steps, qubit_count, warnings = qni.quri_circuit_to_steps(circuit)
    assert restored_steps == steps
    assert qubit_count == 3
    assert warnings == ()


def test_changed_circuit_does_not_reuse_stale_visual_columns() -> None:
    circuit = FakeCircuit(
        3,
        [
            FakeGate("H", (0,)),
            FakeGate("H", (1,)),
            FakeGate("H", (2,)),
        ],
    )
    parallel_steps = [
        [
            {"type": "H", "targets": [0]},
            {"type": "H", "targets": [1]},
            {"type": "H", "targets": [2]},
        ]
    ]
    qni._remember_circuit_step_layout(circuit, parallel_steps, 3)

    circuit.gates.append(FakeGate("X", (0,)))
    restored_steps, _, _ = qni.quri_circuit_to_steps(circuit)

    assert restored_steps == [
        [{"type": "H", "targets": [0]}],
        [{"type": "H", "targets": [1]}],
        [{"type": "H", "targets": [2]}],
        [{"type": "X", "targets": [0]}],
    ]


def test_remembered_layout_is_returned_as_a_defensive_copy() -> None:
    circuit = FakeCircuit(1, [FakeGate("H", (0,))])
    steps = [[{"type": "H", "targets": [0]}]]
    qni._remember_circuit_step_layout(circuit, steps, 1)

    first, _, _ = qni.quri_circuit_to_steps(circuit)
    first[0][0]["targets"][0] = 99
    second, _, _ = qni.quri_circuit_to_steps(circuit)

    assert second == steps


def test_mixed_columns_and_internal_empty_columns_are_preserved() -> None:
    circuit = FakeCircuit(
        4,
        [
            FakeGate("H", (0,)),
            FakeGate("X", (2,), (1,)),
            FakeGate("SWAP", (0, 3)),
            FakeGate("Measurement", (2,), classical_indices=(2,)),
        ],
    )
    steps = [
        [
            {"type": "H", "targets": [0]},
            {"type": "X", "targets": [2], "controls": [1]},
        ],
        [],
        [{"type": "Swap", "targets": [0, 3]}],
        [{"type": "Measure", "targets": [2], "classical_indices": [2]}],
    ]
    qni._remember_circuit_step_layout(circuit, steps, 4)

    restored_steps, qubit_count, warnings = qni.quri_circuit_to_steps(circuit)

    assert restored_steps == steps
    assert qubit_count == 4
    assert warnings == ()


def test_explicit_display_names_select_the_expected_panels() -> None:
    circuit = FakeCircuit(1, [FakeGate("H", (0,))])

    with patch.object(qni, "open", return_value=None) as open_view:
        qni.show_circuit_and_state(circuit, height=300)
        assert open_view.call_args.kwargs["view"] == "notebook"

        qni.show_circuit(circuit, height=300)
        assert open_view.call_args.kwargs["view"] == "circuit"
        assert open_view.call_args.kwargs["active_step"] == "last"
class _UnsupportedGate:
    name = "UnsupportedGate"
    target_indices = (0,)
    control_indices = ()
    params = ()
    classical_indices = ()


class _CircuitWithUnsupportedGate:
    qubit_count = 1
    gates = (_UnsupportedGate(),)


def test_unsupported_quri_gate_stops_visualization() -> None:
    with pytest.raises(ValueError, match="visualization stopped"):
        qni.quri_circuit_to_steps(_CircuitWithUnsupportedGate())


@pytest.mark.parametrize("gate_name", ["RX", "RY", "RZ", "U1"])
def test_rotation_gate_stops_visualization_until_angles_are_preserved(
    gate_name: str,
) -> None:
    circuit = FakeCircuit(1, [FakeGate(gate_name, (0,), params=(0.25,))])

    with pytest.raises(ValueError, match=f"{gate_name} with a rotation angle"):
        qni.quri_circuit_to_steps(circuit)


def test_non_identity_measurement_mapping_stops_visualization() -> None:
    circuit = FakeCircuit(
        2,
        [FakeGate("Measurement", (0,), classical_indices=(1,))],
    )

    with pytest.raises(ValueError, match="Measurement"):
        qni.quri_circuit_to_steps(circuit)


def test_demo_qubit_limit_is_enforced_before_starting_servers() -> None:
    with pytest.raises(ValueError, match="supports 1-8 qubits"):
        qni.open(steps=[[]], qubit_count=9, display=False)
