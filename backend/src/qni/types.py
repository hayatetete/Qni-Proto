"""Core type definitions for the Qni quantum circuit simulator.

Provides type aliases and structured types for quantum circuit execution,
state representation, and device configuration.
"""

from __future__ import annotations

from enum import Enum
from typing import TypeAlias, TypedDict

MeasuredBits: TypeAlias = dict[int, int]
Amplitude: TypeAlias = tuple[float, float]
QiskitAmplitude: TypeAlias = complex
QiskitStepAmplitudes: TypeAlias = dict[int, QiskitAmplitude]
StepAmplitudes: TypeAlias = dict[int, Amplitude]


class StepResultWithoutAmplitudes(TypedDict):
    """Result type for quantum circuit steps without state vector information.

    Used when only measurement results are needed, typically for intermediate
    steps in circuit execution.

    Attributes
    ----------
        measuredBits: Dictionary mapping qubit indices to their measured values (0 or 1)

    """

    measuredBits: MeasuredBits


class StepResultWithAmplitudes(TypedDict):
    """Result type for quantum circuit steps including state vector information.

    Used for steps where both measurement results and quantum state amplitudes
    are required.

    Attributes
    ----------
        amplitudes: Dictionary mapping basis state indices to their complex amplitudes
        measuredBits: Dictionary mapping qubit indices to their measured values (0 or 1)

    """

    amplitudes: StepAmplitudes
    measuredBits: MeasuredBits


class QiskitStepResultWithAmplitudes(TypedDict):
    """Qiskit-specific result type for quantum circuit steps with amplitudes.

    Similar to StepResultWithAmplitudes but uses Qiskit's complex number format
    for amplitude representation.

    Attributes
    ----------
        amplitudes: Dictionary mapping basis state indices to Qiskit complex amplitudes
        measuredBits: Dictionary mapping qubit indices to their measured values (0 or 1)

    """

    amplitudes: QiskitStepAmplitudes
    measuredBits: MeasuredBits


StepResult: TypeAlias = StepResultWithAmplitudes | StepResultWithoutAmplitudes


class QiskitStepResult(TypedDict, total=False):
    """Flexible result type for Qiskit circuit execution steps.

    Allows optional amplitude information while maintaining type safety.
    Used by QiskitRunner to return execution results.

    Attributes
    ----------
        amplitudes: Optional dictionary of Qiskit complex amplitudes
        measuredBits: Dictionary mapping qubit indices to their measured values (0 or 1)

    """

    amplitudes: QiskitStepAmplitudes | None
    measuredBits: MeasuredBits


class DeviceType(Enum):
    """Enumeration of supported quantum circuit simulation devices.

    Used to specify whether to use CPU or GPU-based simulation backends.
    GPU support requires appropriate CUDA configuration.
    """

    CPU = "CPU"
    GPU = "GPU"
