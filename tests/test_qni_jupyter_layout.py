from dataclasses import dataclass, field
import json
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from quri_parts.circuit import QuantumCircuit

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
        [
            {"type": "H", "targets": [0]},
            {"type": "H", "targets": [1]},
            {"type": "H", "targets": [2]},
        ],
        [{"type": "X", "targets": [0]}],
    ]


def test_adjacent_gates_on_disjoint_qubits_share_a_visual_step() -> None:
    circuit = FakeCircuit(
        3,
        [
            FakeGate("H", (0,)),
            FakeGate("H", (1,)),
            FakeGate("H", (2,)),
            FakeGate("X", (0,)),
        ],
    )

    steps, _, _ = qni.quri_circuit_to_steps(circuit)

    assert steps == [
        [
            {"type": "H", "targets": [0]},
            {"type": "H", "targets": [1]},
            {"type": "H", "targets": [2]},
        ],
        [{"type": "X", "targets": [0]}],
    ]


def test_swap_connection_lines_that_overlap_use_separate_visual_steps() -> None:
    circuit = FakeCircuit(
        4,
        [
            FakeGate("SWAP", (1, 2)),
            FakeGate("SWAP", (0, 3)),
        ],
    )

    steps, _, _ = qni.quri_circuit_to_steps(circuit)

    assert steps == [
        [{"type": "Swap", "targets": [1, 2]}],
        [{"type": "Swap", "targets": [0, 3]}],
    ]


def test_non_overlapping_swap_connection_lines_share_a_visual_step() -> None:
    circuit = FakeCircuit(
        4,
        [
            FakeGate("SWAP", (0, 1)),
            FakeGate("SWAP", (2, 3)),
        ],
    )

    steps, _, _ = qni.quri_circuit_to_steps(circuit)

    assert steps == [
        [
            {"type": "Swap", "targets": [0, 1]},
            {"type": "Swap", "targets": [2, 3]},
        ]
    ]


def test_gate_sharing_a_control_or_target_starts_a_new_visual_step() -> None:
    circuit = FakeCircuit(
        3,
        [
            FakeGate("H", (0,)),
            FakeGate("CNOT", (1,), (0,)),
            FakeGate("X", (2,)),
        ],
    )

    steps, _, _ = qni.quri_circuit_to_steps(circuit)

    assert steps == [
        [{"type": "H", "targets": [0]}],
        [{"type": "X", "targets": [1], "controls": [0]}],
        [{"type": "X", "targets": [2]}],
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

        qni.show_circuit(circuit, height=300, scroll_to="last")
        assert open_view.call_args.kwargs["active_step"] == "last"
        assert open_view.call_args.kwargs["focus_active_step"] is True


def test_inspection_height_includes_both_panes_and_notebook_chrome() -> None:
    steps = [[{"type": "H", "targets": [0]}]]

    height = qni._preferred_inspect_height(steps, qubit_count=5)

    assert height >= qni.NOTEBOOK_TOOLBAR_HEIGHT + qni._preferred_circuit_height(
        steps, 5
    )
    assert height >= (
        qni.NOTEBOOK_TOOLBAR_HEIGHT
        + qni.NOTEBOOK_STATE_HEADER_HEIGHT
        + qni._preferred_state_height(5)
    )


def test_checkpoint_validates_and_serializes_probability_and_amplitude() -> None:
    checkpoint = qni.QniCheckpoint(
        "phase oracle",
        3,
        {"111": 0.25},
        expected_amplitudes={"111": (-0.5, 0)},
        source="build_oracle(): Z gate",
    )

    assert checkpoint.to_json() == {
        "name": "phase oracle",
        "step": 3,
        "expected_probabilities": {"111": 0.25},
        "expected_amplitudes": {"111": [-0.5, 0.0]},
        "tolerance": 1e-6,
        "source": "build_oracle(): Z gate",
    }


def test_checkpoint_last_resolves_to_the_final_boundary() -> None:
    circuit = QuantumCircuit(2)
    circuit.add_H_gate(0)
    circuit.add_CNOT_gate(0, 1)

    try:
        viewer = qni.show_circuit_and_state(
            circuit,
            checkpoints=[
                qni.QniCheckpoint(
                    "final Bell state", "last", {"00": 0.5, "11": 0.5}
                )
            ],
            display=False,
        )

        assert viewer is not None
        state = json.loads(parse_qs(urlparse(viewer.url).query)["state"][0])
        assert state["checkpoints"][0]["step"] == 2
    finally:
        qni.close()


def test_inspection_step_uses_state_boundary_numbers() -> None:
    steps = [
        [{"type": "H", "targets": [0]}],
        [{"type": "X", "targets": [1], "controls": [0]}],
    ]

    assert qni._resolve_active_step_index(
        0, steps, include_initial_boundary=True
    ) == 0
    assert qni._resolve_active_step_index(
        2, steps, include_initial_boundary=True
    ) == 2
    assert qni._resolve_active_step_index(
        "last", steps, include_initial_boundary=True
    ) == 2


def test_circuit_only_step_keeps_gate_index_numbers() -> None:
    steps = [
        [{"type": "H", "targets": [0]}],
        [{"type": "X", "targets": [1], "controls": [0]}],
    ]

    assert qni._resolve_active_step_index("last", steps) == 1
    with pytest.raises(ValueError, match="out of range"):
        qni._resolve_active_step_index(2, steps)


@pytest.mark.parametrize("bits", ["", "012"])
def test_checkpoint_rejects_invalid_bitstrings(bits: str) -> None:
    with pytest.raises(ValueError, match="Invalid checkpoint bitstring"):
        qni.QniCheckpoint("bad", 0, {bits: 1}).to_json()


def test_show_circuit_forwards_inspection_metadata() -> None:
    circuit = FakeCircuit(2, [FakeGate("H", (0,))])
    checkpoint = qni.QniCheckpoint("prepared", 1, {"00": 0.5})

    with patch.object(qni, "open", return_value=None) as open_view:
        qni.show_circuit_and_state(
            circuit,
            height=300,
            checkpoints=[checkpoint],
            qubit_names=["control", "target"],
        )

    assert open_view.call_args.kwargs["checkpoints"] == [checkpoint]
    assert open_view.call_args.kwargs["qubit_names"] == ["control", "target"]


def test_quri_code_steps_retain_python_source_line() -> None:
    steps, qubit_count, warnings = qni.quri_code_to_steps(
        "from quri_parts.circuit import QuantumCircuit\n"
        "circuit = QuantumCircuit(2)\n"
        "circuit.add_H_gate(0)\n"
    )

    assert qubit_count == 2
    assert warnings == ()
    assert steps[0][0]["source"] == {
        "line": 3,
        "code": "circuit.add_H_gate(0)",
        "scope": "module",
    }


def test_quri_code_expands_called_function_loop_with_source_scope() -> None:
    steps, qubit_count, warnings = qni.quri_code_to_steps(
        "from quri_parts.circuit import QuantumCircuit\n"
        "def build():\n"
        "    circuit = QuantumCircuit(3)\n"
        "    for qubit in range(3):\n"
        "        circuit.add_H_gate(qubit)\n"
        "    return circuit\n"
        "circuit = build()\n"
    )

    assert qubit_count == 3
    assert warnings == ()
    assert [step[0]["targets"] for step in steps] == [[0], [1], [2]]
    assert [step[0]["source"]["scope"] for step in steps] == [
        "module > build() > for qubit=0",
        "module > build() > for qubit=1",
        "module > build() > for qubit=2",
    ]
    assert all(step[0]["source"]["line"] == 5 for step in steps)


def test_quri_code_does_not_expand_an_uncalled_helper() -> None:
    steps, qubit_count, warnings = qni.quri_code_to_steps(
        "from quri_parts.circuit import QuantumCircuit\n"
        "def unused():\n"
        "    helper = QuantumCircuit(2)\n"
        "    helper.add_X_gate(1)\n"
        "circuit = QuantumCircuit(2)\n"
        "circuit.add_H_gate(0)\n"
    )

    assert qubit_count == 2
    assert warnings == ()
    assert len(steps) == 1
    assert steps[0][0]["type"] == "H"


def test_steps_api_rejects_qubits_outside_initial_demo_scope() -> None:
    with pytest.raises(ValueError, match="qubits 0-7"):
        qni.open(steps=[[{"type": "X", "targets": [8]}]], display=False)


@pytest.mark.parametrize(
    ("qubit_count", "visible_wire_rows"),
    [(4, 4), (5, 7), (6, 8), (7, 10), (8, 11)],
)
def test_circuit_height_reserves_extra_rows_for_larger_circuits(
    qubit_count: int,
    visible_wire_rows: int,
) -> None:
    height = qni._preferred_circuit_height([], qubit_count)

    assert height == max(120, 16 + visible_wire_rows * 48 + 32)
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


@pytest.mark.parametrize(
    ("gate_name", "operation_type"),
    [("RX", "Rx"), ("RY", "Ry"), ("RZ", "Rz"), ("U1", "P")],
)
def test_numeric_rotation_gate_preserves_its_angle(
    gate_name: str,
    operation_type: str,
) -> None:
    circuit = FakeCircuit(1, [FakeGate(gate_name, (0,), params=(0.25,))])

    steps, qubit_count, warnings = qni.quri_circuit_to_steps(circuit)

    assert steps == [[{"type": operation_type, "targets": [0], "angle": "0.25"}]]
    assert qubit_count == 1
    assert warnings == ()


def test_non_identity_measurement_mapping_stops_visualization() -> None:
    circuit = FakeCircuit(
        2,
        [FakeGate("Measurement", (0,), classical_indices=(1,))],
    )

    with pytest.raises(ValueError, match="Measurement"):
        qni.quri_circuit_to_steps(circuit)


def test_qubit_limit_is_enforced_before_starting_servers() -> None:
    with pytest.raises(ValueError, match="supports 1-8 qubits"):
        qni.open(steps=[[]], qubit_count=9, display=False)


def test_8_qubit_input_is_accepted_before_simulation() -> None:
    with (
        patch.object(qni, "_backend_server") as backend_server,
        patch.object(qni, "_server") as frontend_server,
    ):
        backend_server.return_value.port = 8000
        frontend_server.return_value.port = 5173
        viewer = qni.open(steps=[[]], qubit_count=8, display=False)

    assert isinstance(viewer, qni.QniViewer)
