"""REST API server for the Qni quantum circuit simulator.

Provides HTTP endpoints for circuit execution and QASM export,
using Flask and Qiskit for quantum computations.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from flask import Flask, Response, jsonify, request
from flask_cors import CORS

if TYPE_CHECKING:
    from qni.types import (
        QiskitStepAmplitudes,
        QiskitStepResult,
        StepAmplitudes,
        StepResult,
    )

from qiskit.qasm3 import dumps  # type: ignore[import-untyped]

from qni.cached_qiskit_runner import CachedQiskitRunner
from qni.circuit_request_data import CircuitRequestData
from qni.logging_config import setup_custom_logger
from qni.qiskit_circuit_builder import QiskitCircuitBuilder

app = Flask(__name__)
CORS(app)

setup_custom_logger()
cached_qiskit_runner = CachedQiskitRunner(app.logger)


@app.route("/backend.json", methods=["POST"])
def backend() -> tuple[Response, int]:
    """Handle the POST request to the /backend.json endpoint.

    This function processes the incoming request,
    runs the quantum circuit simulation using Qiskit,
    and returns the simulation results in JSON format.

    Returns
    -------
        Response: A JSON response containing the simulation results or an error message.

    """
    request_type = request.form.get("requestType", "circuit")

    request_handlers = {
        "circuit": handle_circuit_request,
        "export": handle_export_request,
    }

    handler = request_handlers.get(request_type)
    if handler:
        return handler()
    return jsonify({"error": "Invalid request type"}), 400


def handle_circuit_request() -> tuple[Response, int]:
    """Handle quantum circuit execution requests.

    Processes the circuit data from the request form, executes the circuit
    using the cached Qiskit runner, and returns the simulation results.

    Returns
    -------
        tuple[Response, int]: A tuple containing:
            - JSON response with circuit execution results
            - HTTP status code 200

    """
    circuit_request_data = CircuitRequestData(request.form)
    _log_request_data(circuit_request_data)

    qiskit_step_results = cached_qiskit_runner.run(circuit_request_data)
    step_results = _convert_and_filter_qiskit_step_results(
        qiskit_step_results,
        circuit_request_data,
    )
    app.logger.info("step_results = %s", step_results)
    return jsonify(step_results), 200


class EmptyStepsError(ValueError):
    """Exception raised when steps list is empty."""

    def __init__(self, steps: list) -> None:
        """Initialize EmptyStepsError with the empty steps list.

        Args:
        ----
            steps (list): The empty steps list that caused the error.

        """
        super().__init__(f"Steps cannot be empty (got {steps})")


class InvalidQubitCountError(ValueError):
    """Exception raised when qubit count is invalid."""

    def __init__(self, qubit_count: int) -> None:
        """Initialize InvalidQubitCountError with the invalid qubit count.

        Args:
        ----
            qubit_count (int): The invalid qubit count that caused the error.

        """
        super().__init__(f"Qubit count must be greater than 0 (got {qubit_count})")


def handle_export_request() -> tuple[Response, int]:
    """Handle QASM export requests.

    Converts the quantum circuit specified in the request to QASM format.
    Validates input parameters and handles potential errors.

    Returns
    -------
        tuple[Response, int]: A tuple containing:
            - JSON response with QASM representation or error message
            - HTTP status code (200 for success, 400 for errors)

    """
    try:
        steps, qubit_count = _parse_and_validate_export_parameters()

        qiskit_circuit_builder = QiskitCircuitBuilder()
        circuit = qiskit_circuit_builder.build_circuit_for_export(steps, qubit_count)
        qasm3 = dumps(circuit)

        return jsonify({"qasm3": qasm3}), 200

    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON format"}), 400
    except (EmptyStepsError, InvalidQubitCountError) as e:
        return jsonify({"error": str(e)}), 400


def _parse_and_validate_export_parameters() -> tuple[list, int]:
    steps = json.loads(request.form.get("steps", "[]"))
    qubit_count = int(request.form.get("qubitCount", "0"))

    if not steps:
        raise EmptyStepsError(steps)
    if qubit_count <= 0:
        raise InvalidQubitCountError(qubit_count)

    return steps, qubit_count


def _log_request_data(request_data: CircuitRequestData) -> None:
    app.logger.debug("circuit_id = %s", request_data.circuit_id)
    app.logger.debug("qubit_count = %d", request_data.qubit_count)
    app.logger.debug("until_step_index = %d", request_data.until_step_index)
    app.logger.debug("amplitude_indices = %s", request_data.amplitude_indices)
    app.logger.debug("steps = %s", request_data.steps)
    app.logger.info("device = %s", request_data.device)


def _convert_and_filter_qiskit_step_results(
    qiskit_step_results: list[QiskitStepResult],
    circuit_request_data: CircuitRequestData,
) -> list[StepResult]:
    return [
        _convert_qiskit_step_result(each, circuit_request_data)
        for each in qiskit_step_results
    ]


def _convert_qiskit_step_result(
    qiskit_step_result: QiskitStepResult,
    circuit_request_data: CircuitRequestData,
) -> StepResult:
    measured_bits = qiskit_step_result["measuredBits"]

    amplitudes_qiskit = qiskit_step_result.get("amplitudes", None)
    if amplitudes_qiskit is None:
        return {"measuredBits": measured_bits}

    amplitudes = _flatten_amplitudes(
        _filter_amplitudes(amplitudes_qiskit, circuit_request_data.amplitude_indices),
    )
    return {"amplitudes": amplitudes, "measuredBits": measured_bits}


def _filter_amplitudes(
    qiskit_amplitudes: QiskitStepAmplitudes,
    amplitude_indices: list[int],
) -> QiskitStepAmplitudes:
    return (
        {each: qiskit_amplitudes[each] for each in amplitude_indices}
        if amplitude_indices
        else qiskit_amplitudes
    )


def _flatten_amplitudes(qiskit_amplitudes: QiskitStepAmplitudes) -> StepAmplitudes:
    return {
        index: (float(each.real), float(each.imag))
        for index, each in qiskit_amplitudes.items()
    }
