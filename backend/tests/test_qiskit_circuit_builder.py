import pytest
from qiskit import QuantumCircuit  # type: ignore
from qiskit.circuit.library import (  # type: ignore
    HGate,
    SdgGate,
    SGate,
    SwapGate,
    TdgGate,
    TGate,
    XGate,
    YGate,
    ZGate,
)

from qni.qiskit_circuit_builder import (
    BasicOperation,
    ControllableOperation,
    QiskitCircuitBuilder,
)


@pytest.fixture
def builder():
    return QiskitCircuitBuilder()


def test_build_circuit_for_export(builder):
    steps = [
        [{"type": "H", "targets": [0]}],
        [{"type": "X", "targets": [1]}],
        [{"type": "Z", "targets": [2]}],
        [{"type": "S", "targets": [0]}],
        [{"type": "S†", "targets": [1]}],
        [{"type": "T", "targets": [2]}],
        [{"type": "T†", "targets": [0]}],
        [{"type": "Y", "targets": [1]}],
        [{"type": "Swap", "targets": [0, 2]}],
        [{"type": "X", "targets": [1], "controls": [0]}],
    ]
    qubit_count = 3
    circuit = builder.build_circuit_for_export(steps, qubit_count)
    assert isinstance(circuit, QuantumCircuit)
    assert circuit.num_qubits == qubit_count
    assert len(circuit.data) == len(steps)


def test_apply_h_operation(builder):
    circuit = QuantumCircuit(1)
    operation = BasicOperation(type="H", targets=[0])
    builder.apply_operation(circuit, operation)
    assert circuit.data[0].operation == HGate()


def test_apply_x_operation(builder):
    circuit = QuantumCircuit(1)
    operation = BasicOperation(type="X", targets=[0])
    builder.apply_operation(circuit, operation)
    assert circuit.data[0].operation == XGate()


def test_apply_z_operation(builder):
    circuit = QuantumCircuit(1)
    operation = BasicOperation(type="Z", targets=[0])
    builder.apply_operation(circuit, operation)
    assert circuit.data[0].operation == ZGate()


def test_apply_s_operation(builder):
    circuit = QuantumCircuit(1)
    operation = BasicOperation(type="S", targets=[0])
    builder.apply_operation(circuit, operation)
    assert circuit.data[0].operation == SGate()


def test_apply_s_dagger_operation(builder):
    circuit = QuantumCircuit(1)
    operation = BasicOperation(type="S†", targets=[0])
    builder.apply_operation(circuit, operation)
    assert circuit.data[0].operation == SdgGate()


def test_apply_t_operation(builder):
    circuit = QuantumCircuit(1)
    operation = BasicOperation(type="T", targets=[0])
    builder.apply_operation(circuit, operation)
    assert circuit.data[0].operation == TGate()


def test_apply_t_dagger_operation(builder):
    circuit = QuantumCircuit(1)
    operation = BasicOperation(type="T†", targets=[0])
    builder.apply_operation(circuit, operation)
    assert circuit.data[0].operation == TdgGate()


def test_apply_y_operation(builder):
    circuit = QuantumCircuit(1)
    operation = BasicOperation(type="Y", targets=[0])
    builder.apply_operation(circuit, operation)
    assert circuit.data[0].operation == YGate()


def test_apply_swap_operation(builder):
    circuit = QuantumCircuit(2)
    operation = BasicOperation(type="Swap", targets=[0, 1])
    builder.apply_operation(circuit, operation)
    assert circuit.data[0].operation == SwapGate()


def test_apply_controlled_x_operation(builder):
    circuit = QuantumCircuit(2)
    operation = ControllableOperation(type="X", targets=[1], controls=[0])
    builder.apply_operation(circuit, operation)
    assert circuit.data[0].operation.name == "cx"


def test_apply_unknown_operation(builder):
    circuit = QuantumCircuit(1)
    operation = BasicOperation(type="Unknown", targets=[0])
    with pytest.raises(ValueError):
        builder.apply_operation(circuit, operation)
