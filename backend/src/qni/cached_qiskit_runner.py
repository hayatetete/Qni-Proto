"""Performance optimization layer for quantum circuit execution.

Provides caching mechanisms to avoid redundant circuit computations
in the Qni simulator.
"""

from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import logging

    from qni.circuit_request_data import CircuitRequestData
    from qni.types import QiskitStepResult

from qni.qiskit_runner import QiskitRunner


class CachedQiskitRunner:
    """A caching wrapper for the QiskitRunner.

    Implements a caching layer to optimize repeated circuit executions by:
    - Storing all step results for one viewer execution
    - Managing cache invalidation
    - Delegating actual execution to QiskitRunner

    The selected step is intentionally not part of the key, so moving between
    step boundaries reuses one simulation run.

    Attributes
    ----------
        logger: Logger instance for tracking cache hits/misses
        cache: List of cached quantum circuit results
        last_cache_key: Circuit fingerprint and viewer seed for the last execution

    """

    def __init__(self, logger: logging.Logger) -> None:
        """Initialize the cached runner.

        Args:
        ----
            logger: Logger instance for recording cache events

        """
        self.logger = logger
        self.cache: list[QiskitStepResult] = []
        self.last_cache_key: tuple | None = None

    def run(self, request_data: CircuitRequestData) -> list[QiskitStepResult]:
        """Execute quantum circuit with caching optimization.

        Returns cached results if available for the circuit and viewer seed
        combination. Otherwise, executes the circuit using QiskitRunner, caches the
        results, and returns them.

        Args:
        ----
            request_data: Circuit request data containing circuit_id, steps,
                qubit_count, until_step_index, device, and other parameters.

        Returns:
        -------
            list[QiskitStepResult]: List of execution results for each step, containing
                measurement results and state vector amplitudes.

        Note:
        ----
            The step index is not part of the key because one run stores every
            step boundary.

        """
        circuit_fingerprint = hashlib.sha256(
            json.dumps(
                {
                    "steps": request_data.steps,
                    "qubit_count": request_data.qubit_count,
                    "device": request_data.device.value,
                },
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8"),
        ).hexdigest()
        cache_key = (
            circuit_fingerprint,
            request_data.simulation_seed,
        )

        if self.last_cache_key == cache_key:
            self.logger.info("Cache hit for circuit_key: %s", cache_key)
            return self.cache

        self.logger.info("Cache miss for circuit_key: %s", cache_key)

        step_results = QiskitRunner(self.logger).run_circuit(
            request_data.steps,
            qubit_count=request_data.qubit_count,
            until_step_index=request_data.until_step_index,
            device=request_data.device,
            simulation_seed=request_data.simulation_seed,
        )
        self.cache = step_results
        self.last_cache_key = cache_key

        return step_results
