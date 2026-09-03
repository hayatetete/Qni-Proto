import unittest
from unittest.mock import MagicMock, patch

from werkzeug.datastructures import ImmutableMultiDict

from qni.cached_qiskit_runner import CachedQiskitRunner
from qni.circuit_request_data import CircuitRequestData


class TestCachedQiskitRunner(unittest.TestCase):
    def setUp(self):
        self.logger = MagicMock()
        self.cached_runner = CachedQiskitRunner(self.logger)
        self.request_data = CircuitRequestData(
            ImmutableMultiDict([
                ("id", "test_circuit"),
                ("qubitCount", "5"),
                ("untilStepIndex", "3"),
                ("steps", '[{"type": "H", "targets": [0]}]'),
                ("amplitudeIndices", "0,1,2,3"),
                ("device", "GPU"),
                ("simulationSeed", "12345"),
            ]),
        )

    @patch("qni.qiskit_runner.QiskitRunner.run_circuit")
    def test_run_and_cache_miss(self, mock_run_circuit):
        mock_run_circuit.return_value = {"result": "test_result"}

        result = self.cached_runner.run(self.request_data)
        assert result == {"result": "test_result"}
        assert self.logger.info.call_args.args[0] == "Cache miss for circuit_key: %s"
        assert self.logger.info.call_args.args[1][1] == 12345
        mock_run_circuit.assert_called_once_with(
            self.request_data.steps,
            qubit_count=5,
            until_step_index=3,
            device=self.request_data.device,
            simulation_seed=12345,
        )

    @patch("qni.qiskit_runner.QiskitRunner.run_circuit")
    def test_run_and_cache_hit(self, mock_run_circuit):
        mock_run_circuit.return_value = {"result": "test_result"}

        # First run to populate the cache
        result = self.cached_runner.run(self.request_data)
        assert result == {"result": "test_result"}

        # Second run to test cache hit
        result = self.cached_runner.run(self.request_data)
        assert result == {"result": "test_result"}
        assert self.logger.info.call_args.args[0] == "Cache hit for circuit_key: %s"
        assert self.logger.info.call_args.args[1][1] == 12345

    @patch("qni.qiskit_runner.QiskitRunner.run_circuit")
    def test_same_id_with_different_steps_is_not_a_cache_hit(self, mock_run_circuit):
        mock_run_circuit.return_value = {"result": "test_result"}
        changed_request = CircuitRequestData(
            ImmutableMultiDict([
                ("id", "test_circuit"),
                ("qubitCount", "5"),
                ("untilStepIndex", "3"),
                ("steps", '[{"type": "X", "targets": [0]}]'),
                ("device", "GPU"),
            ]),
        )

        self.cached_runner.run(self.request_data)
        self.cached_runner.run(changed_request)

        assert mock_run_circuit.call_count == 2

    @patch("qni.qiskit_runner.QiskitRunner.run_circuit")
    def test_selecting_another_step_reuses_the_viewer_run(self, mock_run_circuit):
        mock_run_circuit.return_value = {"result": "test_result"}
        changed_request = CircuitRequestData(
            ImmutableMultiDict([
                ("qubitCount", "5"),
                ("untilStepIndex", "1"),
                ("steps", '[{"type": "H", "targets": [0]}]'),
                ("device", "GPU"),
                ("simulationSeed", "12345"),
            ]),
        )

        self.cached_runner.run(self.request_data)
        self.cached_runner.run(changed_request)

        assert mock_run_circuit.call_count == 1

    @patch("qni.qiskit_runner.QiskitRunner.run_circuit")
    def test_different_viewer_seed_is_not_a_cache_hit(self, mock_run_circuit):
        mock_run_circuit.return_value = {"result": "test_result"}
        changed_request = CircuitRequestData(
            ImmutableMultiDict([
                ("qubitCount", "5"),
                ("untilStepIndex", "3"),
                ("steps", '[{"type": "H", "targets": [0]}]'),
                ("device", "GPU"),
                ("simulationSeed", "54321"),
            ]),
        )

        self.cached_runner.run(self.request_data)
        self.cached_runner.run(changed_request)

        assert mock_run_circuit.call_count == 2
