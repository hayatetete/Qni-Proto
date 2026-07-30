from urllib.request import urlopen

from qni_jupyter import qni
from quri_parts.circuit import QuantumCircuit


def test_qni_notebook_starts_frontend_and_backend() -> None:
    circuit = QuantumCircuit(1)
    circuit.add_H_gate(0)

    viewer = qni.open(circuit=circuit, mode="inspect", display=False)
    assert viewer is not None

    try:
        with urlopen(viewer.url, timeout=30) as response:
            assert response.status == 200
            assert b"jupyter-main.ts" in response.read()
    finally:
        qni.close()
