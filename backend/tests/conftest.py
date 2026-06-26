import pytest


def assert_complex_approx(actual, expected_real, expected_imag):
    __tracebackhide__ = True
    assert pytest.approx(actual.real) == expected_real, (
        f"Real parts differ: {actual.real} != {expected_real}"
    )
    assert pytest.approx(actual.imag) == expected_imag, (
        f"Imaginary parts differ: {actual.imag} != {expected_imag}"
    )


def assert_amplitudes_approx(actual_amplitudes, expected_amplitudes):
    __tracebackhide__ = True
    for key, (expected_real, expected_imag) in expected_amplitudes.items():
        actual_real, actual_imag = actual_amplitudes[key]
        assert pytest.approx(actual_real) == expected_real, (
            f"Real parts differ for key {key}: {actual_real} != {expected_real}"
        )
        assert pytest.approx(actual_imag) == expected_imag, (
            f"Imaginary parts differ for key {key}: {actual_imag} != {expected_imag}"
        )
