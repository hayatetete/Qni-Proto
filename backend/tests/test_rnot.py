import unittest

from qni.qiskit_runner import QiskitRunner
from tests.conftest import assert_complex_approx


class TestRnot(unittest.TestCase):
    def setUp(self):
        self.qiskit_runner = QiskitRunner()

    # X^½|0⟩=1/2((1+i)|0⟩+(1-i)|1⟩)
    def test_rnot_0(self):
        steps = [[{"type": "X^½", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[0]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1 / 2, 1 / 2)
        assert_complex_approx(amplitudes[1], 1 / 2, -1 / 2)

    # X^½|1⟩=1/2((1-i)|0⟩+(1+i)|1⟩)
    def test_rnot_1(self):
        steps = [[{"type": "X", "targets": [0]}], [{"type": "X^½", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1 / 2, -1 / 2)
        assert_complex_approx(amplitudes[1], 1 / 2, 1 / 2)
