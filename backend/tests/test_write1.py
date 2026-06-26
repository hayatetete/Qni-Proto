import unittest

from qni.qiskit_runner import QiskitRunner
from tests.conftest import assert_complex_approx


class TestWrite1(unittest.TestCase):
    def setUp(self):
        self.qiskit_runner = QiskitRunner()

    # Write1|0⟩=|1>
    def test_write1_0(self):
        steps = [
            [{"type": "|1>", "targets": [0]}],
        ]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[0]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 1, 0)

    # Write1|1⟩=|1>
    def test_write1_1(self):
        steps = [
            [{"type": "X", "targets": [0]}],
            [{"type": "|1>", "targets": [0]}],
        ]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 1, 0)
