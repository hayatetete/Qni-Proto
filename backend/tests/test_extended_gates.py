import pytest

from qni.qiskit_runner import QiskitRunner


def test_anti_controlled_x_flips_when_control_is_zero():
    runner = QiskitRunner()
    result = runner.run_circuit([[{"type": "X", "targets": [1], "antiControls": [0]}]])
    assert pytest.approx(result[0]["amplitudes"][2].real) == 1


def test_x_gate_changes_basis_state_without_adding_phase():
    result = QiskitRunner().run_circuit(
        [[{"type": "X", "targets": [0, 1, 2, 3, 4]}]],
        qubit_count=5,
    )

    amplitude = result[0]["amplitudes"][31]
    assert amplitude.real == pytest.approx(1)
    assert amplitude.imag == pytest.approx(0)


def test_later_multi_controlled_gate_does_not_shift_earlier_snapshot_phase():
    result = QiskitRunner().run_circuit(
        [
            [{"type": "X", "targets": [0, 1, 2, 3, 4]}],
            [
                {
                    "type": "Z",
                    "targets": [0],
                    "controls": [1, 3, 4],
                    "antiControls": [2],
                },
            ],
            [
                {
                    "type": "X",
                    "targets": [4],
                    "controls": [0, 1, 2, 3],
                },
            ],
        ],
        qubit_count=5,
    )

    amplitude_after_x = result[0]["amplitudes"][31]
    assert amplitude_after_x.real == pytest.approx(1)
    assert amplitude_after_x.imag == pytest.approx(0)


def test_mixed_controls_and_anti_control_apply_phase_only_to_matching_state():
    oracle = {
        "type": "Z",
        "targets": [0],
        "controls": [1, 3, 4],
        "antiControls": [2],
    }
    matching = QiskitRunner().run_circuit(
        [
            [{"type": "X", "targets": [0, 1, 3, 4]}],
            [oracle],
        ],
        qubit_count=5,
    )
    anti_control_not_satisfied = QiskitRunner().run_circuit(
        [
            [{"type": "X", "targets": [0, 1, 2, 3, 4]}],
            [oracle],
        ],
        qubit_count=5,
    )

    assert matching[1]["amplitudes"][27].real == pytest.approx(-1)
    assert anti_control_not_satisfied[1]["amplitudes"][31].real == pytest.approx(1)


def test_phase_gate_applies_pi_phase():
    runner = QiskitRunner()
    result = runner.run_circuit(
        [[{"type": "X", "targets": [0]}], [{"type": "P", "targets": [0], "angle": "π"}]],
    )
    assert pytest.approx(result[1]["amplitudes"][1].real) == -1


def test_rx_gate_pi_moves_zero_to_one_with_negative_imaginary_phase():
    runner = QiskitRunner()
    result = runner.run_circuit([[{"type": "Rx", "targets": [0], "angle": "π"}]])
    assert pytest.approx(result[0]["amplitudes"][1].imag) == -1


def test_ry_gate_pi_moves_zero_to_one():
    runner = QiskitRunner()
    result = runner.run_circuit([[{"type": "Ry", "targets": [0], "angle": "π"}]])
    assert pytest.approx(result[0]["amplitudes"][1].real) == 1


def test_rz_gate_pi_rotates_zero_with_negative_phase():
    runner = QiskitRunner()
    result = runner.run_circuit([[{"type": "Rz", "targets": [0], "angle": "π"}]])
    assert pytest.approx(result[0]["amplitudes"][0].imag) == -1


def test_bloch_display_reports_hadamard_x_axis():
    runner = QiskitRunner()
    result = runner.run_circuit(
        [[{"type": "H", "targets": [0]}], [{"type": "Bloch", "targets": [0]}]],
    )
    assert pytest.approx(result[1]["blochVectors"][0]["x"]) == 1


def test_qft_gate_is_executable():
    runner = QiskitRunner()
    result = runner.run_circuit([[{"type": "QFT", "targets": [0, 1], "span": 2}]])
    assert pytest.approx(result[0]["amplitudes"][0].real) == 0.5


def test_qft_dagger_gate_is_executable():
    runner = QiskitRunner()
    result = runner.run_circuit([[{"type": "QFT†", "targets": [0, 1], "span": 2}]])
    assert pytest.approx(result[0]["amplitudes"][0].real) == 0.5
