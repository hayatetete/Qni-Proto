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

## QniNotebook

QniNotebookを使うと、Jupyter NotebookまたはVS Code Notebook上でQURI Partsの量子回路を表示・編集できます。

### 準備

リポジトリルートでPython環境とフロントエンドの依存関係を準備します。

```shell
python3 -m pip install -e .
yarn install
```

Notebookもリポジトリルートから開いてください。基本操作は
[`qni_tutorial.ipynb`](./qni_tutorial.ipynb) で順番に確認できます。

### 回路を作る

```python
from qni_jupyter import qni
from quri_parts.circuit import QuantumCircuit

circuit = QuantumCircuit(2)
circuit.add_H_gate(0)
circuit.add_CNOT_gate(0, 1)
```

### 回路と状態ベクトルを表示する

```python
qni.show_circuit_and_state(circuit)
```

回路のステップ境界を選択すると、そのステップまで実行した状態ベクトルを確認できます。

### 回路だけを表示する

```python
qni.show_circuit(circuit)
```

`show_circuit()`と`show_circuit_and_state()`は読み取り専用です。

### 回路を編集してPython側へ保存する

```python
editor = qni.open(circuit=circuit, height=420, mode="edit")
```

表示されたエディタでゲートを編集した後、次のセルを実行します。

```python
circuit = editor.commit()
```

`commit()`は編集後のQURI Parts回路を返します。同じステップに並べた複数のゲートは、保存後に再表示しても同じステップとして表示されます。

```python
qni.show_circuit_and_state(circuit)
```

### 表示を終了する

Notebookを閉じる前や、開発中の実装を読み直す前に実行します。

```python
qni.close()
```

### 補足

- `qni.open()`には`steps=`またはQURI Partsの`QuantumCircuit`を`circuit=`で渡せます。
- 未対応ゲートはスキップされ、Notebook上に警告が表示されます。
- Qiskit回路は、QURI Partsの`circuit_from_qiskit()`で変換してから渡してください。
- Notebookでは`/jupyter.html`をiframeで表示し、既存の`frontend/index.html`は変更しません。
- GUIの`Export QURI`から、QURI Parts / QURI VM向けPythonコードやNotebookを出力できます。

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
