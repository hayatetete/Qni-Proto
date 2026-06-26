import unittest

from qni.qiskit_runner import QiskitRunner
from tests.conftest import assert_complex_approx


class TestY(unittest.TestCase):
    def setUp(self):
        self.qiskit_runner = QiskitRunner()

    # Y|0⟩=i|1⟩
    def test_y_0(self):
        steps = [[{"type": "Y", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[0]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 0, 1)

    # Y|1⟩=-i|0⟩
    def test_y_1(self):
        steps = [[{"type": "X", "targets": [0]}], [{"type": "Y", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, -1)
        assert_complex_approx(amplitudes[1], 0, 0)
