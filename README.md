# qni-gl

## 動作確認のしかた

docker イメージを作成

```shell
docker build -f Dockerfile . -t qni-gl
```

docker イメージを起動

```shell
docker run --gpus all -p 8000:8000 --rm -it qni-gl
```

ブラウザで `http://localhost:8000/` を開く

## Jupyter Notebook / VSCode Notebook で開く

リポジトリルートを Python の作業ディレクトリにして、Notebook セルで次を実行します。

```python
from qni_jupyter import qni

qni.open()
```

初期回路を渡す場合:

```python
from qni_jupyter import qni

steps = [
    [{"type": "H", "targets": [0]}],
    [{"type": "X", "targets": [1], "controls": [0]}],
]

qni.open(steps=steps, qubit_count=2, height=720)
```

QURI Parts の回路オブジェクトを渡す場合は、文字列ではなく
`QuantumCircuit` オブジェクトを `circuit=` に渡します。

QURI の `add_*_gate` メソッドで回路を書く場合:

```python
from qni_jupyter import qni
from quri_parts.circuit import QuantumCircuit

circuit = QuantumCircuit(2)
circuit.add_H_gate(0)
circuit.add_CNOT_gate(0, 1)

qni.open(circuit=circuit, height=680)
```

QURI の gate factory と `add_gate(...)` で回路を書く場合:

```python
from qni_jupyter import qni
from quri_parts.circuit import CNOT, H, QuantumCircuit

circuit = QuantumCircuit(2)
circuit.add_gate(H(0))
circuit.add_gate(CNOT(0, 1))

qni.open(circuit=circuit, height=680)
```

未対応 gate は Notebook 上に警告されます。`RX` / `RY` / `RZ` / `U1` は表示できますが、現状の初期ロードでは角度は復元されません。

QURI の状態評価ワークフローで使う場合:

```python
from qni_jupyter import qni
from quri_parts.circuit import QuantumCircuit
from quri_parts.core.state import quantum_state
from quri_parts.qulacs.simulator import evaluate_state_to_vector

n_qubits = 2
circuit = QuantumCircuit(n_qubits)
circuit.add_H_gate(0)
circuit.add_CNOT_gate(0, 1)

bell_state = quantum_state(n_qubits=n_qubits, circuit=circuit)
out_state = evaluate_state_to_vector(bell_state)

print("State vector:")
print(out_state.vector)
print("")
print("Circuit:")
print(out_state.circuit.gates)

qni.open(circuit=bell_state.circuit, height=720)
```

Qiskit の `QuantumCircuit` を使う場合は、QURI Parts の変換器で QURI 回路へ変換してから渡します。

```python
from qni_jupyter import qni
from qiskit import QuantumCircuit as QiskitQuantumCircuit
from quri_parts.qiskit.circuit import circuit_from_qiskit

qiskit_circuit = QiskitQuantumCircuit(2)
qiskit_circuit.h(0)
qiskit_circuit.cx(0, 1)

quri_circuit = circuit_from_qiskit(qiskit_circuit)

qni.open(circuit=quri_circuit, height=720)
```

Notebook 内では `/jupyter.html` を iframe で表示します。既存ブラウザ版の `frontend/index.html` は差し替えません。GUI の `Export QURI` から QURI Parts / QURI VM 用の Python コードまたは `.ipynb` をコピー・ダウンロードできます。

## .htpasswd 認証を有効にするには

`backend/merged.conf` の次の行をコメントアウト。初期パスワード userA:passA は Dockerfile の中でセットしているので、適宜書き換えてください。

```shell
# auth_basic "Restricted";
# auth_basic_user_file /etc/nginx/.htpasswd;
```

## error.logに ModuleNotFoundError: No module named 'qni'エラーが出たとき

`docker-entrypoint.sh` に以下を追加してください。

```shell
# Set PYTHONPATH to include the qni module
export PYTHONPATH=/qni-gl/backend/src:$PYTHONPATH
```

## backend.logに RuntimeError: No CUDA device available! エラーが出たとき

`docker-entrypoint.sh` に以下を追加して,CPUを使用するようにしてください。
`VITE_USE_GPU=true yarn build`　をコメントアウト

```shell
yarn build
```

` --gpus all `  オプションをはずしてrun

```shell
docker run -p 8000:8000 --rm -it -v $(pwd):/qni-gl qni-gl
```
