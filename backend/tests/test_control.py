import unittest

from qni.qiskit_runner import QiskitRunner
from tests.conftest import assert_complex_approx


class TestControl(unittest.TestCase):
    def setUp(self):
        self.qiskit_runner = QiskitRunner()

    # Control|0⟩ = |0>
    def test_control_0(self):
        steps = [[{"type": "•", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[0]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1, 0)
        assert_complex_approx(amplitudes[1], 0, 0)

    # Control|1⟩ = |1>
    def test_control_1(self):
        steps = [[{"type": "X", "targets": [0]}], [{"type": "•", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 1, 0)
