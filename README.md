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
QURI Parts回路と、各ステップ境界までの状態ベクトル／Bloch表示を確認できます。

### 初期デモの対応範囲

- 1〜8量子ビット（完全な状態ベクトルを使用）
- H、X、Y、Z、S、S†、T、T†、√X、RX、RY、RZ、U1
- CNOT、CZ、Toffoli、対応する複数制御ゲート、SWAP、Measurement
- 読み取り専用の `qni.show_circuit_and_state(circuit)`
- 1リクエストの上限は256 KiB

未対応ゲートや意味を保持できない操作はスキップせず、表示前に例外で停止します。
GUI編集、`commit()`、パラメータ式、20〜32量子ビットの性能保証は初期デモの対象外です。

### 準備

QniNotebookは現在、リポジトリをcloneした開発環境で動作します。
Pythonパッケージ単体での配布には対応していません。

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
