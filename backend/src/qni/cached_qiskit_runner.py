"""Performance optimization layer for quantum circuit execution.

Provides caching mechanisms to avoid redundant circuit computations
in the Qni simulator.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import logging

    from qni.circuit_request_data import CircuitRequestData
    from qni.types import QiskitStepResult

from qni.qiskit_runner import QiskitRunner


class CachedQiskitRunner:
    """A caching wrapper for the QiskitRunner.

    Implements a caching layer to optimize repeated circuit executions by:
    - Storing results based on circuit ID and step index
    - Managing cache invalidation
    - Delegating actual execution to QiskitRunner

    The cache is invalidated when either the circuit ID or step index changes,
    ensuring that modified circuits are properly re-executed.

    Attributes
    ----------
        logger: Logger instance for tracking cache hits/misses
        cache: List of cached quantum circuit results
        last_cache_key: Tuple of (circuit_id, step_index) for the last execution

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

        Returns cached results if available for the given circuit_id and step_index
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
            Cache key is a tuple of (circuit_id, until_step_index). Cache is invalidated
            when either circuit_id or until_step_index changes.

        """
        cache_key = (request_data.circuit_id, request_data.until_step_index)

        if self.last_cache_key == cache_key:
            self.logger.info("Cache hit for circuit_key: %s", cache_key)
            return self.cache

        self.logger.info("Cache miss for circuit_key: %s", cache_key)

        step_results = QiskitRunner(self.logger).run_circuit(
            request_data.steps,
            qubit_count=request_data.qubit_count,
            until_step_index=request_data.until_step_index,
            device=request_data.device,
        )
        self.cache = step_results
        self.last_cache_key = cache_key

        return step_results
