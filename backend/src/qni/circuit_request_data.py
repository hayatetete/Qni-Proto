"""Request data handling for the Qni quantum circuit simulator.

Provides type-safe access to HTTP form data for quantum circuit execution.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from werkzeug.datastructures import ImmutableMultiDict

from qni.types import DeviceType


class CircuitRequestData:
    """A data class for handling quantum circuit request parameters.

    Responsible for:
    - Parsing and validating HTTP form data
    - Providing type-safe access to circuit parameters
    - Converting data types for circuit execution

    Attributes
    ----------
        _form: ImmutableMultiDict containing the raw form data

    """

    def __init__(self, form: ImmutableMultiDict[str, str]) -> None:
        """Initialize the CircuitRequestData object with form data.

        :param form: The form data received from the request.
        :type form: ImmutableMultiDict[str, str]
        """
        self._form = form

    @property
    def circuit_id(self) -> str:
        """Retrieves the circuit ID from the form data.

        Default: "" (empty string)

        :return: The circuit ID.
        :rtype: str
        """
        return self._form.get("id", "")

    @property
    def qubit_count(self) -> int:
        """Retrieves the qubit count from the form data.

        Default: 0

        :return: The qubit count.
        :rtype: int
        """
        return self._form.get("qubitCount", 0, type=int)

    @property
    def until_step_index(self) -> int:
        """Retrieves the index of the last step to be executed from the form data.

        Default: 0

        :return: The index of the last step.
        :rtype: int
        """
        return self._form.get("untilStepIndex", 0, type=int)

    @property
    def steps(self) -> list[dict]:
        """Retrieves the list of steps from the form data.

        Default: [] (empty list)

        :return: The list of steps.
        :rtype: list[dict]
        """
        return self._form.get("steps", [], type=self._steps_type)

    @property
    def amplitude_indices(self) -> list[int]:
        """Retrieves the list of amplitude indices from the form data.

        Default: [] (empty list)

        :return: The list of amplitude indices.
        :rtype: list[int]
        """
        return self._form.get("amplitudeIndices", [], type=self._amplitude_indices_type)

    @property
    def device(self) -> DeviceType:
        """Retrieves the device type (CPU or GPU) from the form data.

        Default: DeviceType.CPU

        :return: The device type.
        :rtype: DeviceType
        """
        use_gpu = self._form.get("useGpu", "false").lower() == "true"
        return (
            DeviceType.GPU
            if use_gpu
            else self._form.get("device", DeviceType.CPU, type=self._device_type)
        )

    @staticmethod
    def _steps_type(parameter: str) -> list[dict]:
        return json.loads(parameter)

    @staticmethod
    def _amplitude_indices_type(parameter: str) -> list[int]:
        return [int(each) for each in parameter.split(",") if each.isdigit()]

    @staticmethod
    def _device_type(parameter: str) -> DeviceType:
        return DeviceType(parameter)
