"""Core quantum circuit execution engine for the Qni simulator.

Provides the QiskitRunner class which serves as the primary interface between
Qni's high-level circuit operations and Qiskit's execution environment.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING, TypedDict

import numpy as np
import numpy.typing as npt

if TYPE_CHECKING:
    import logging

    from qiskit.result import Result  # type: ignore[import-untyped]

from qiskit import QuantumCircuit, transpile  # type: ignore[import-untyped]
from qiskit_aer import AerSimulator  # type: ignore[import-untyped]

from qni.qiskit_circuit_builder import QiskitCircuitBuilder
from qni.types import (
    DeviceType,
    MeasuredBits,
    QiskitAmplitude,
    QiskitStepAmplitudes,
    QiskitStepResult,
)

MAX_SIMULATION_SECONDS = 10


class SimulationTimeoutError(TimeoutError):
    """Raised when the bounded demo simulation exceeds its execution limit."""

    def __init__(self) -> None:
        """Initialize the timeout with the public demo limit."""
        super().__init__(
            f"Simulation exceeded the {MAX_SIMULATION_SECONDS}-second demo limit."
        )


class BasicOperation(TypedDict):
    """A dictionary type representing a basic quantum operation.

    Represents single-qubit gates and non-controlled multi-qubit operations.

    Attributes
    ----------
        type: The type of quantum operation (e.g., "H", "X", "Y", "Z", "Swap")
        targets: List of target qubit indices the operation acts on

    """

    type: str
    targets: list[int]


class ControllableOperation(TypedDict):
    """A dictionary type representing a controlled quantum operation.

    Represents quantum operations that can be controlled by other qubits,
    such as controlled-NOT, controlled-Y, and controlled-Z gates.

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


class QiskitRunner:
    """A Qiskit-based quantum circuit execution engine.

    Responsible for:
    - Building and executing quantum circuits using Qiskit
    - Managing circuit execution state and measurement results
    - Supporting both CPU and GPU-based simulation
    - Extracting simulation results (state vectors and measurements)

    The runner works with QiskitCircuitBuilder to convert high-level quantum
    operations into executable Qiskit circuits.

    Attributes
    ----------
        logger: Optional logging instance for debug output
        circuit: Current quantum circuit being executed
        steps: List of quantum operations to execute

    """

    _STATEVECTOR_LABEL_PREFIX = "state_at_step_"
    _BLOCH_STATEVECTOR_LABEL_PREFIX = "state_at_bloch_step_"

    def __init__(self, logger: logging.Logger | None = None) -> None:
        """Initialize QiskitRunner with an optional logger.

        Args:
        ----
            logger (logging.Logger | None, optional): Logger instance for debug output.
            Defaults to None.

        """
        self.logger = logger
        self.circuit: QuantumCircuit | None = None
        self.steps: list = []

    def run_circuit(
        self,
        steps: list,
        *,
        qubit_count: int | None = None,
        until_step_index: int | None = None,
        device: DeviceType = DeviceType.CPU,
        simulation_seed: int | None = None,
    ) -> list[QiskitStepResult]:
        """Execute the specified quantum circuit and return the results of each step.

        Args:
        ----
            steps (list): A list of steps to execute.
            qubit_count (int | None, optional): The number of qubits. Defaults to None.
            until_step_index (int | None, optional): The index of the step until which
                to execute. Defaults to None.
            device (str, optional): The device to use ("CPU" or "GPU").
            Defaults to "CPU".

        Returns:
        -------
            list: A list containing the results of each step. Each result is
                a dictionary including measured bits and amplitudes.

        """
        step_results: list[QiskitStepResult] = []

        self.steps = steps
        if until_step_index is None:
            until_step_index = self._last_step_index()
        self.circuit = self._build_circuit(
            qubit_count=qubit_count,
            until_step_index=until_step_index,
        )

        if self.circuit.depth() == 0:
            return step_results

        result = self._run_backend(device=device, simulation_seed=simulation_seed)
        statevectors = [
            self._get_statevector(result, self._statevector_label(step_index))
            for step_index in range(len(self.steps))
        ]
        measured_bits = self._extract_measurement_results(result)
        bloch_vectors = self._bloch_vectors_by_step(
            result,
            statevectors[until_step_index],
        )

        for step_index in range(len(self.steps)):
            step_results.append(
                QiskitStepResult(
                    measuredBits=measured_bits[step_index],
                    amplitudes=statevectors[step_index],
                    blochVectors=bloch_vectors[step_index],
                ),
            )

        return step_results

    def _build_circuit(
        self,
        *,
        qubit_count: int | None = None,
        until_step_index: int | None = None,
    ) -> QuantumCircuit:
        if qubit_count is None:
            qubit_count = self._get_qubit_count()

        if until_step_index is None:
            until_step_index = self._last_step_index()

        return self._process_step_operations(qubit_count, until_step_index)

    def _last_step_index(self) -> int:
        if len(self.steps) == 0:
            return 0
        return len(self.steps) - 1

    def _get_qubit_count(self) -> int:
        return (
            max(
                max(
                    (
                        max(gate.get("targets", [-1]))
                        for step in self.steps
                        for gate in step
                    ),
                    default=-1,
                ),
                max(
                    (
                        max(gate.get("controls", [-1]))
                        for step in self.steps
                        for gate in step
                    ),
                    default=-1,
                ),
                max(
                    (
                        max(gate.get("antiControls", [-1]))
                        for step in self.steps
                        for gate in step
                    ),
                    default=-1,
                ),
            )
            + 1
        )

    def _process_step_operations(
        self,
        qubit_count: int,
        until_step_index: int,
    ) -> QuantumCircuit:
        circuit = QuantumCircuit(qubit_count)
        circuit_builder = QiskitCircuitBuilder()

        for step_index, step in enumerate(self.steps):
            if len(step) == 0:
                circuit.id(list(range(qubit_count)))

            for operation in step:
                circuit_builder.apply_operation(circuit, operation)

            circuit.save_statevector(label=self._statevector_label(step_index))
            if self._step_has_bloch_display(step):
                circuit.save_statevector(label=self._bloch_statevector_label(step_index))

        return circuit

    def _run_backend(
        self, device: DeviceType, simulation_seed: int | None = None
    ) -> Result:
        backend = AerSimulator(method="statevector")
        if device == DeviceType.GPU:
            backend.set_options(device="GPU", cuStateVec_enable=True)

        # State inspection must preserve the logical basis ordering. Higher
        # optimization levels may absorb a trailing SWAP into the final layout,
        # which changes the indices of the saved state vector.
        circuit_transpiled = transpile(
            self.circuit,
            backend=backend,
            optimization_level=0,
        )

        job = backend.run(
            circuit_transpiled,
            shots=1,
            memory=True,
            **(
                {"seed_simulator": simulation_seed}
                if simulation_seed is not None
                else {}
            ),
        )
        try:
            return job.result(timeout=MAX_SIMULATION_SECONDS)
        except TimeoutError as exc:
            job.cancel()
            raise SimulationTimeoutError from exc

    @staticmethod
    def _get_statevector(
        result: Result,
        label: str,
    ) -> dict[int, QiskitAmplitude]:
        amplitudes: npt.NDArray[np.complex128] = np.asarray(
            result.data().get(label),
            dtype=np.complex128,
        )

        return dict(enumerate(amplitudes))

    def _extract_measurement_results(self, result: Result) -> list[MeasuredBits]:
        measured_bits: list[MeasuredBits] = [{} for _ in self.steps]

        circuit_has_measurements = any(
            operation["type"] == "Measure" for step in self.steps for operation in step
        )

        if not circuit_has_measurements:
            return measured_bits

        tmp_measured_bits = [
            {
                target: None
                for operation in step
                if operation["type"] == "Measure"
                for target in operation["targets"]
            }
            for step in self.steps
        ]

        bit_strings = next(iter(result.get_counts().keys())).split()

        for index, each in enumerate(tmp_measured_bits):
            if each:
                bit_string = bit_strings.pop()
                for bit in each:
                    measured_bits[index][bit] = int(bit_string[-(bit + 1)])

        return measured_bits

    def _bloch_vectors_by_step(
        self,
        result: Result,
        fallback_statevector: QiskitStepAmplitudes,
    ) -> list[dict[int, dict[str, float]]]:
        bloch_vectors: list[dict[int, dict[str, float]]] = []
        for step_index, step in enumerate(self.steps):
            if not self._step_has_bloch_display(step):
                bloch_vectors.append({})
                continue

            label = self._bloch_statevector_label(step_index)
            statevector = (
                self._get_statevector(result, label)
                if label in result.data()
                else fallback_statevector
            )
            bloch_vectors.append(
                {
                    target: self._bloch_vector(statevector, target)
                    for operation in step
                    if operation["type"] == "Bloch"
                    for target in operation["targets"]
                },
            )

        return bloch_vectors

    @staticmethod
    def _step_has_bloch_display(step: list) -> bool:
        return any(operation["type"] == "Bloch" for operation in step)

    def _statevector_label(self, step_index: int) -> str:
        return f"{self._STATEVECTOR_LABEL_PREFIX}{step_index}"

    def _bloch_statevector_label(self, step_index: int) -> str:
        return f"{self._BLOCH_STATEVECTOR_LABEL_PREFIX}{step_index}"

    @staticmethod
    def _bloch_vector(
        statevector: QiskitStepAmplitudes,
        target: int,
    ) -> dict[str, float]:
        x = 0.0
        y = 0.0
        z = 0.0
        target_mask = 1 << target

        for index, amplitude0 in statevector.items():
            if index & target_mask:
                continue

            amplitude1 = statevector.get(index | target_mask, 0j)
            coherence = amplitude0.conjugate() * amplitude1
            x += 2.0 * float(coherence.real)
            y += 2.0 * float(coherence.imag)
            z += float(abs(amplitude0) ** 2 - abs(amplitude1) ** 2)

        return {"x": x, "y": y, "z": z}
