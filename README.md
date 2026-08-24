# QniNotebook

QniNotebook is a read-only intermediate-state visualizer for small QURI Parts
circuits. It is not presented as a general quantum IDE, a 32-qubit simulator,
or a full visual circuit debugger.

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

QniNotebookを使うと、Jupyter NotebookまたはVS Code Notebook上で小規模な
QURI Parts回路と、各ステップ境界までの状態ベクトルを確認できます。

### 固定デモ環境を起動する

Dockerが利用できる環境で、リポジトリルートから次の一手順で起動します。

```shell
docker compose -f compose.demo.yml up --build
```

起動後、`http://127.0.0.1:8888/lab/tree/qni_tutorial.ipynb`を開きます。
Node、Yarn、Pythonパッケージはコンテナ内へ固定して導入されます。

5173、8000、8888番ポートが使用中の場合は、ホスト側のポートをまとめて変更できます。

```shell
QNI_DEMO_FRONTEND_PORT=15173 \
QNI_DEMO_BACKEND_PORT=18000 \
QNI_DEMO_JUPYTER_PORT=18888 \
docker compose -f compose.demo.yml up --build
```

この場合は`http://127.0.0.1:18888/lab/tree/qni_tutorial.ipynb`を開きます。

### 初期デモの対応範囲

- 1〜8量子ビット（完全な状態ベクトルを使用）
- H、X、Y、Z、S、S†、T、T†、√X
- CNOT、CZ、Toffoli、対応する複数制御ゲート、SWAP、Measurement
- 読み取り専用の `qni.show_circuit_and_state(circuit)`
- 1リクエストの上限は256 KiB
- Backendの1回のシミュレーション上限は10秒

RX、RY、RZ、U1を含む回転ゲート、未対応ゲート、アンチコントロール、
保持できないclassical bit mappingは、別の意味で表示せず例外で停止します。
GUI編集、`commit()`、パラメータ式、20〜32量子ビットの性能保証は初期デモの対象外です。

### 準備

以下はコンテナを使わず開発する場合の手順です。

次のソフトウェアを事前に用意してください。

- Python 3.10以上
- Node.js 20以上
- Corepack（Node.jsに同梱）
- Jupyter Notebook、JupyterLab、またはVS CodeのNotebook機能

リポジトリをcloneし、リポジトリルートへ移動します。

```shell
git clone https://github.com/hayatetete/Qni-Proto.git
cd Qni-Proto
```

Python仮想環境を作成します。

Linux / macOS / WSL:

```shell
python3 -m venv .venv-qni
source .venv-qni/bin/activate
```

Windows PowerShell:

```powershell
py -m venv .venv-qni
.\.venv-qni\Scripts\Activate.ps1
```

QniNotebook、backend、JupyterLabを同じPython環境へインストールします。

```shell
python -m pip install --upgrade pip
python -m pip install -e . -e ./backend jupyterlab
```

Corepackを有効にし、frontendの依存関係をインストールします。

```shell
corepack enable
cd frontend
yarn install --immutable
cd ..
```

### チュートリアルを起動する

JupyterLabを使用する場合:

```shell
jupyter lab qni_tutorial.ipynb
```

VS Codeを使用する場合は、リポジトリルートをVS Codeで開き、
[`qni_tutorial.ipynb`](./qni_tutorial.ipynb) のカーネルに
`.venv-qni`を選択してください。

Notebookはリポジトリルートから開いてください。初回のQni表示時に、
ローカルのbackendとVite開発サーバーが自動的に起動します。

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

### 2つの確認シナリオ

- 回路構造の確認: `qni.show_circuit(circuit)`で、複数ステップのゲート、制御線、順序と、セル実行時に得た測定結果を確認します。状態ベクトルパネルは表示しません。
- 誤りの位置特定: `qni.show_circuit_and_state(circuit)`でステップ境界を左から順に選び、既知の期待状態から最初に外れたステップを特定します。こちらが初期デモの主導線です。

初期デモでは両方とも検証済みの1〜8量子ビットに限定します。回路表示だけを行う場合の上限拡大は、このデモの価値を検証した後に別途定義します。

### 回路だけを表示する

```python
qni.show_circuit(circuit)
```

`show_circuit()`と`show_circuit_and_state()`は読み取り専用です。

### 表示を終了する

Notebookを閉じる前や、開発中の実装を読み直す前に実行します。

```python
qni.close()
```

### 補足

- `qni.open()`には`steps=`またはQURI Partsの`QuantumCircuit`を`circuit=`で渡せます。
- 未対応ゲートは回路の意味を変えて表示せず、明示的に拒否されます。
- Qiskit回路は、QURI Partsの`circuit_from_qiskit()`で変換してから渡してください。
- Notebookでは`/jupyter.html`をiframeで表示し、既存の`frontend/index.html`は変更しません。

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
