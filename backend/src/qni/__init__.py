"""Qni - A quantum circuit simulator for browser-based quantum computing.

Provides a Flask-based REST API server and Qiskit-powered quantum circuit
execution engine that enables users to build, simulate and visualize quantum
circuits in their web browser.
"""

from importlib.metadata import version

from .cached_qiskit_runner import CachedQiskitRunner
from .circuit_request_data import CircuitRequestData
from .qiskit_circuit_builder import QiskitCircuitBuilder
from .qiskit_runner import QiskitRunner

__all__ = [
    "CachedQiskitRunner",
    "CircuitRequestData",
    "QiskitCircuitBuilder",
    "QiskitRunner",
]
__version__ = version("qni")
