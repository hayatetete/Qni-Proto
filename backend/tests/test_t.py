import unittest
from math import sqrt

from qni.qiskit_runner import QiskitRunner
from tests.conftest import assert_complex_approx


class TestT(unittest.TestCase):
    def setUp(self):
        self.qiskit_runner = QiskitRunner()

    # T|0⟩=|0⟩
    def test_t_0(self):
        steps = [[{"type": "T", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[0]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1, 0)
        assert_complex_approx(amplitudes[1], 0, 0)

    # T|1⟩=exp(iπ/4)|1⟩
    def test_t_1(self):
        steps = [[{"type": "X", "targets": [0]}], [{"type": "T", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], sqrt(2) / 2, sqrt(2) / 2)
