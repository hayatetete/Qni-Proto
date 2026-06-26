"""Qiskit circuit construction utilities for the Qni simulator.

Provides builder classes to convert Qni's high-level quantum operations
into executable Qiskit circuits.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING, TypedDict, cast

from qiskit import (  # type: ignore[import-untyped]
    ClassicalRegister,
    QuantumCircuit,  # type: ignore[import-untyped]
)
from qiskit.circuit.library import (  # type: ignore[import-untyped]
    HGate,
    SdgGate,
    SGate,
    SXGate,
    TdgGate,
    TGate,
    YGate,
    ZGate,
)

if TYPE_CHECKING:
    from qiskit.circuit import ControlledGate  # type: ignore[import-untyped]


class BasicOperation(TypedDict):
    """A dictionary type representing a basic quantum operation.

    Used for single-qubit gates and non-controlled multi-qubit operations.

    Attributes
    ----------
        type: The type of quantum operation (e.g., "H", "X", "Y", "Z", "Swap")
        targets: List of target qubit indices the operation acts on

    """

    type: str
    targets: list[int]


class ControllableOperation(TypedDict):
    """A dictionary type representing a controlled quantum operation.

    Used for quantum operations that can be controlled by other qubits.

    Attributes
    ----------
        type: The type of quantum operation (e.g., "X", "Y", "Z")
        targets: List of target qubit indices the operation acts on
        controls: List of control qubit indices

    """

    type: str
    targets: list[int]
    controls: list[int]


OperationMethod = Callable[
    [QuantumCircuit, BasicOperation | ControllableOperation],
    None,
]


class QiskitCircuitBuilder:
    """A builder for constructing Qiskit quantum circuits.

    Converts high-level quantum operations into Qiskit circuit instructions.
    Supports a wide range of quantum gates and operations:
    - Basic gates (H, X, Y, Z, S, T and conjugates)
    - Controlled operations (CNOT, controlled-Y, controlled-Z)
    - State preparation (|0⟩, |1⟩)
    - Measurement operations
    - Multi-qubit operations (SWAP)

    Each operation is represented as a dictionary containing the operation type
    and target qubits, with optional control qubits for controlled operations.

    Attributes
    ----------
        _PAIR_OPERATION_COUNT: Constant defining the number of qubits for
            two-qubit gates

    """

    _PAIR_OPERATION_COUNT = 2

    def build_circuit_for_export(
        self,
        steps: list,
        qubit_count: int,
    ) -> QuantumCircuit:
        """Build a Qiskit quantum circuit for export from a list of quantum operations.

        Constructs a quantum circuit by applying the specified quantum operations
        in sequence. Each step can contain multiple operations that are applied
        in parallel.

        Args:
        ----
            steps: A list of quantum operations to be applied to the circuit.
                Each step is a list of operations that can be executed in parallel.
            qubit_count: The number of qubits in the circuit.

        Returns:
        -------
            A Qiskit QuantumCircuit object containing all the specified operations.

        """
        circuit = QuantumCircuit(qubit_count)

        for step in steps:
            if len(step) == 0:
                circuit.id(list(range(qubit_count)))

            for operation in step:
                self.apply_operation(circuit, operation)

        return circuit

    def apply_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
    ) -> None:
        """Apply a quantum operation to the given circuit.

        Takes a quantum operation specified as a dictionary and applies it to
        the circuit. Supports both basic operations (single-qubit gates,
        multi-qubit gates) and controlled operations.

        Args:
        ----
            circuit: The Qiskit quantum circuit to apply the operation to.
            operation: A dictionary describing the quantum operation to apply.
                Can be either a BasicOperation or ControllableOperation.

        """
        operation_type = operation["type"]
        operation_methods: dict[str, OperationMethod] = {
            "H": self._apply_h_operation,
            "X": self._apply_x_operation,
            "Y": self._apply_y_operation,
            "Z": self._apply_z_operation,
            "X^½": self._apply_rnot_operation,
            "S": self._apply_s_operation,
            "S†": self._apply_s_dagger_operation,
            "T": self._apply_t_operation,
            "T†": self._apply_t_dagger_operation,
            "Swap": self._apply_swap_operation,
            "•": self._apply_controlled_z_operation,
            "|0>": self._apply_write0,
            "|1>": self._apply_write1,
            "Measure": self._apply_measure_operation,
        }

        if operation_type in operation_methods:
            operation_methods[operation_type](circuit, operation)
        else:
            raise self.UnknownOperationError(operation_type)

    class UnknownOperationError(ValueError):
        """Exception raised when an unknown operation type is encountered.

        Attributes
        ----------
            operation_type: The type of the unknown operation

        """

        def __init__(self, operation_type: str) -> None:
            """Initialize UnknownOperationError with the unknown operation type.

            Args:
            ----
                operation_type (str): The type of the unknown operation that
                    caused the error.

            """
            super().__init__(f"Unknown operation: {operation_type}")

    def _apply_h_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
    ) -> None:
        if "controls" in operation:
            self._apply_controlled_u(circuit, operation, HGate())
        else:
            circuit.h(operation["targets"])

    @staticmethod
    def _apply_x_operation(
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
    ) -> None:
        if "controls" in operation:
            operation = cast("ControllableOperation", operation)
            for target in operation["targets"]:
                circuit.mcx(operation["controls"], target)
        else:
            circuit.x(operation["targets"])

    def _apply_y_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
    ) -> None:
        if "controls" in operation:
            self._apply_controlled_u(circuit, operation, YGate())
        else:
            circuit.y(operation["targets"])

    def _apply_z_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
    ) -> None:
        if "controls" in operation:
            self._apply_controlled_u(circuit, operation, ZGate())
        else:
            circuit.z(operation["targets"])

    def _apply_rnot_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
    ) -> None:
        if "controls" in operation:
            self._apply_controlled_u(circuit, operation, SXGate())
        else:
            circuit.append(SXGate(), qargs=operation["targets"])

    def _apply_s_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
    ) -> None:
        if "controls" in operation:
            self._apply_controlled_u(circuit, operation, SGate())
        else:
            circuit.s(operation["targets"])

    def _apply_s_dagger_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
    ) -> None:
        if "controls" in operation:
            self._apply_controlled_u(circuit, operation, SdgGate())
        else:
            circuit.sdg(operation["targets"])

    def _apply_t_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
    ) -> None:
        if "controls" in operation:
            self._apply_controlled_u(circuit, operation, TGate())
        else:
            circuit.t(operation["targets"])

    def _apply_t_dagger_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
    ) -> None:
        if "controls" in operation:
            self._apply_controlled_u(circuit, operation, TdgGate())
        else:
            circuit.tdg(operation["targets"])

    def _apply_swap_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation,
    ) -> None:
        if len(operation["targets"]) == self._PAIR_OPERATION_COUNT:
            circuit.swap(operation["targets"][0], operation["targets"][1])
        else:
            circuit.id(operation["targets"])

    def _apply_controlled_z_operation(
        self,
        circuit: QuantumCircuit,
        operation: BasicOperation,
    ) -> None:
        if len(operation["targets"]) >= self._PAIR_OPERATION_COUNT:
            u = ZGate().control(num_ctrl_qubits=len(operation["targets"]) - 1)
            circuit.append(u, qargs=operation["targets"])
        else:
            circuit.id(operation["targets"])

    @staticmethod
    def _apply_write0(circuit: QuantumCircuit, operation: BasicOperation) -> None:
        circuit.reset(operation["targets"])

    @staticmethod
    def _apply_write1(circuit: QuantumCircuit, operation: BasicOperation) -> None:
        circuit.reset(operation["targets"])
        circuit.x(operation["targets"])

    @staticmethod
    def _apply_measure_operation(
        circuit: QuantumCircuit,
        operation: BasicOperation,
    ) -> None:
        creg = ClassicalRegister(circuit.num_qubits)
        circuit.add_register(creg)
        for target in operation["targets"]:
            circuit.measure(target, creg[target])

    @staticmethod
    def _apply_controlled_u(
        circuit: QuantumCircuit,
        operation: BasicOperation | ControllableOperation,
        gate: ControlledGate,
    ) -> None:
        operation = cast("ControllableOperation", operation)
        u = gate.control(num_ctrl_qubits=len(operation["controls"]))
        for target in operation["targets"]:
            circuit.append(u, qargs=operation["controls"] + [target])
