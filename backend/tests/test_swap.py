import unittest

from qni.qiskit_runner import QiskitRunner
from tests.conftest import assert_complex_approx


class TestSwap(unittest.TestCase):
    def setUp(self):
        self.qiskit_runner = QiskitRunner()

    # Swap|0⟩=|0⟩
    def test_swap_0(self):
        steps = [[{"type": "Swap", "targets": [0]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[0]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1, 0)
        assert_complex_approx(amplitudes[1], 0, 0)

    # (Swap,Swap)|00⟩ = |00⟩
    def test_swap_swap_00(self):
        steps = [[{"type": "Swap", "targets": [0, 1]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[0]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1, 0)
        assert_complex_approx(amplitudes[1], 0, 0)
        assert_complex_approx(amplitudes[2], 0, 0)
        assert_complex_approx(amplitudes[3], 0, 0)

    # (Swap,Swap)|01> = |10>
    def test_swap_swap_01(self):
        steps = [[{"type": "X", "targets": [0]}], [{"type": "Swap", "targets": [0, 1]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 0, 0)
        assert_complex_approx(amplitudes[2], 1, 0)
        assert_complex_approx(amplitudes[3], 0, 0)

    # (Swap,Swap)|10> = |01>
    def test_swap_swap_10(self):
        steps = [[{"type": "X", "targets": [1]}], [{"type": "Swap", "targets": [0, 1]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 1, 0)
        assert_complex_approx(amplitudes[2], 0, 0)
        assert_complex_approx(amplitudes[3], 0, 0)

    # (Swap,Swap)|11> = |11>
    def test_swap_swap_11(self):
        steps = [
            [{"type": "X", "targets": [0, 1]}],
            [{"type": "Swap", "targets": [0, 1]}],
        ]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 0, 0)
        assert_complex_approx(amplitudes[2], 0, 0)
        assert_complex_approx(amplitudes[3], 1, 0)
