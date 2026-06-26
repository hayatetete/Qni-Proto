import unittest
from math import sqrt

from qni.qiskit_runner import QiskitRunner
from tests.conftest import assert_complex_approx


class TestH(unittest.TestCase):
    def setUp(self):
        self.qiskit_runner = QiskitRunner()

    # H|0⟩=1/√2(|0⟩+|1⟩)
    def test_h_0(self):
        steps = [
            [{"type": "H", "targets": [0]}],
        ]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[0]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1 / sqrt(2), 0)
        assert_complex_approx(amplitudes[1], 1 / sqrt(2), 0)

    # H|1⟩=1/√2(|0⟩-|1⟩)
    def test_h_1(self):
        steps = [
            [{"type": "X", "targets": [0]}],
            [{"type": "H", "targets": [0]}],
        ]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1 / sqrt(2), 0)
        assert_complex_approx(amplitudes[1], -1 / sqrt(2), 0)

    def test_hh_0(self):
        steps = [
            [{"type": "H", "targets": [0]}],
            [{"type": "H", "targets": [0]}],
        ]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1, 0)
        assert_complex_approx(amplitudes[1], 0, 0)
