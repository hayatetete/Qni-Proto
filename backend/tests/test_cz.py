import unittest

from qni.qiskit_runner import QiskitRunner
from tests.conftest import assert_complex_approx


class TestCz(unittest.TestCase):
    def setUp(self):
        self.qiskit_runner = QiskitRunner()

    # CZ|00⟩ = |00⟩
    def test_cz_00(self):
        steps = [[{"type": "•", "targets": [0, 1]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[0]["amplitudes"]
        assert_complex_approx(amplitudes[0], 1, 0)
        assert_complex_approx(amplitudes[1], 0, 0)
        assert_complex_approx(amplitudes[2], 0, 0)
        assert_complex_approx(amplitudes[3], 0, 0)

    # CZ|01⟩ = |01⟩
    def test_cz_01(self):
        steps = [[{"type": "X", "targets": [0]}], [{"type": "•", "targets": [0, 1]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 1, 0)
        assert_complex_approx(amplitudes[2], 0, 0)
        assert_complex_approx(amplitudes[3], 0, 0)

    # CZ|10⟩ = |10⟩
    def test_cz_10(self):
        steps = [[{"type": "X", "targets": [1]}], [{"type": "•", "targets": [0, 1]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 0, 0)
        assert_complex_approx(amplitudes[2], 1, 0)
        assert_complex_approx(amplitudes[3], 0, 0)

    # CZ|11⟩ = -|11⟩
    def test_cz_11(self):
        steps = [[{"type": "X", "targets": [0, 1]}], [{"type": "•", "targets": [0, 1]}]]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 0, 0)
        assert_complex_approx(amplitudes[2], 0, 0)
        assert_complex_approx(amplitudes[3], -1, 0)

    # CZ|111⟩ = -|111⟩
    def test_cz_111(self):
        steps = [
            [{"type": "X", "targets": [0, 1, 2]}],
            [{"type": "•", "targets": [0, 1, 2]}],
        ]

        result = self.qiskit_runner.run_circuit(steps)

        amplitudes = result[1]["amplitudes"]
        assert_complex_approx(amplitudes[0], 0, 0)
        assert_complex_approx(amplitudes[1], 0, 0)
        assert_complex_approx(amplitudes[2], 0, 0)
        assert_complex_approx(amplitudes[3], 0, 0)
        assert_complex_approx(amplitudes[4], 0, 0)
        assert_complex_approx(amplitudes[5], 0, 0)
        assert_complex_approx(amplitudes[6], 0, 0)
        assert_complex_approx(amplitudes[7], -1, 0)
