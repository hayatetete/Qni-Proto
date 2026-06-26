import unittest

from qni.qiskit_runner import QiskitRunner
from tests.conftest import assert_complex_approx


class TestMeasurement(unittest.TestCase):
    def setUp(self):
        self.qiskit_runner = QiskitRunner()

    # M|0⟩=|0⟩
    def test_measurement_0(self):
        steps = [[{"type": "Measure", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[0]["amplitudes"]
        measured_bits = result[0]["measuredBits"]
        assert_complex_approx(amplitudes[0], 1, 0)
        assert_complex_approx(amplitudes[1], 0, 0)
        assert measured_bits == {0: 0}

    # M|1⟩=|1⟩
    def test_measurement_1(self):
        steps = [[{"type": "X", "targets": [0]}], [{"type": "Measure", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        measured_bits = result[1]["measuredBits"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 1, 0)
        assert measured_bits == {0: 1}

    def test_measure_multiple_qubits(self):
        steps = [
            [{"type": "X", "targets": [1, 2]}],
            [{"type": "Measure", "targets": [0, 2]}],
            [{"type": "Measure", "targets": [1, 2]}],
            [{"type": "Measure", "targets": [2]}],
        ]

        result = self.qiskit_runner.run_circuit(steps)

        assert result[0]["measuredBits"] == {}
        assert result[1]["measuredBits"] == {0: 0, 2: 1}
        assert result[2]["measuredBits"] == {1: 1, 2: 1}
        assert result[3]["measuredBits"] == {2: 1}
