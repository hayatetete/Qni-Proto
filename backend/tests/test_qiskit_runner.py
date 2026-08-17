import unittest
from unittest.mock import Mock, patch

import pytest

from qni.qiskit_runner import (
    MAX_SIMULATION_SECONDS,
    QiskitRunner,
    SimulationTimeoutError,
)
from qni.types import DeviceType
from tests.conftest import assert_complex_approx


class TestQiskitRunner(unittest.TestCase):
    def setUp(self):
        self.qiskit_runner = QiskitRunner()

    def test_run_empty_circuit(self):
        results = self.qiskit_runner.run_circuit([])

        assert len(results) == 0

    def test_simple_circuit(self):
        steps = [
            [{"type": "H", "targets": [0]}],
            [],
            [],
            [],
            [],
        ]

        results = self.qiskit_runner.run_circuit(steps, qubit_count=2)

        assert len(results) == 5

    def test_until_step_index(self):
        steps = [
            [{"type": "H", "targets": [0]}],
            [{"type": "H", "targets": [1]}],
            [{"type": "H", "targets": [2]}],
        ]

        result = self.qiskit_runner.run_circuit(steps, until_step_index=1)

        assert len(result) == 3
        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1 / 2, 0)
        assert_complex_approx(amplitudes[1], 1 / 2, 0)
        assert_complex_approx(amplitudes[2], 1 / 2, 0)
        assert_complex_approx(amplitudes[3], 1 / 2, 0)

    def test_build_circuit_with_unknown_operation(self):
        steps = [
            [{"type": "UnknownGate", "targets": [0]}],
        ]

        with pytest.raises(ValueError, match="Unknown operation: UnknownGate"):
            self.qiskit_runner.run_circuit(steps)

    @patch("qiskit_aer.AerSimulator.set_options")
    def test_gpu_backend(self, mock_set_options):
        steps = [
            [{"type": "H", "targets": [0]}],
        ]

        self.qiskit_runner.run_circuit(steps, device=DeviceType.GPU)

        mock_set_options.assert_called_with(device="GPU", cuStateVec_enable=True)

    @patch("qni.qiskit_runner.transpile", return_value=Mock())
    @patch("qni.qiskit_runner.AerSimulator")
    def test_backend_job_is_cancelled_after_timeout(
        self,
        simulator_type,
        mock_transpile,
    ):
        job = Mock()
        job.result.side_effect = TimeoutError
        simulator_type.return_value.run.return_value = job

        with pytest.raises(SimulationTimeoutError, match="10-second demo limit"):
            self.qiskit_runner.run_circuit(
                [[{"type": "H", "targets": [0]}]],
                qubit_count=1,
            )

        mock_transpile.assert_called_once()
        job.result.assert_called_once_with(timeout=MAX_SIMULATION_SECONDS)
        job.cancel.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
