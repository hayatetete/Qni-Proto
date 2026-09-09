# QniNotebook

QniNotebook is a read-only intermediate-state visualizer for small QURI Parts
circuits. The initial demo supports circuits with up to 8 qubits.

## 動作確認のしかた

docker イメージを作成

```shell
docker build -f Dockerfile . -t qni-gl
```

docker イメージを起動

```shell
docker run -p 8000:8000 --rm -it qni-gl
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

起動後、`http://127.0.0.1:8888/lab/tree/qni_demo.ipynb`を開きます。
Node、Yarn、Pythonパッケージはコンテナ内へ固定して導入されます。

5173、8000、8888番ポートが使用中の場合は、ホスト側のポートをまとめて変更できます。

```shell
QNI_DEMO_FRONTEND_PORT=15173 \
QNI_DEMO_BACKEND_PORT=18000 \
QNI_DEMO_JUPYTER_PORT=18888 \
docker compose -f compose.demo.yml up --build
```

この場合は`http://127.0.0.1:18888/lab/tree/qni_demo.ipynb`を開きます。

> `8000` がすでに使われている環境では、上のように `QNI_DEMO_BACKEND_PORT` を別ポートに変えて起動してください。

### 対応範囲

- 1〜8量子ビットの回路入力、回路図表示、状態ベクトル表示
- H、X、Y、Z、S、S†、T、T†、√X、数値で角度が確定した回転ゲートと位相ゲート
- CNOT、CZ、Toffoli、対応する複数制御ゲート、SWAP、Measurement
- 読み取り専用の `qni.show_circuit_and_state(circuit)`
- 1リクエストの上限は256 KiB
- Backendの1回のシミュレーション上限は10秒

未対応ゲート、未束縛のパラメータ式、アンチコントロール、保持できない
classical bit mappingは、別の意味で表示せず例外で停止します。
GUI編集と`commit()`は、この読み取り専用デモの対象外です。

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

### デモNotebookを起動する

JupyterLabを使用する場合:

```shell
jupyter lab qni_demo.ipynb
```

VS Codeを使用する場合は、リポジトリルートをVS Codeで開き、
[`qni_demo.ipynb`](./qni_demo.ipynb) のカーネルに
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
Step 0はゲート適用前の初期状態です。基底ラベルは`|q(n-1)…q0⟩`の順で、
Qiskit/QURIと同じく`q0`を右端に表示します。円の面積は確率、針は位相を表し、
各円へカーソルを置くとbitstring、振幅、確率、位相を数値で確認できます。

期待条件を自動判定する場合は、名前付きチェックポイントを渡します。

```python
checks = [
    qni.QniCheckpoint(
        "Bell state",
        step="last",
        expected_probabilities={"00": 0.5, "11": 0.5},
        source="build_bell(): CNOT",
    )
]
qni.show_circuit_and_state(
    circuit,
    checkpoints=checks,
    qubit_names=["control", "target"],
)
```

検査パネルには各条件のPASS/FAIL、最初に失敗した境界、主要な基底状態の
確率・振幅・位相が表示されます。失敗時は、期待値・実測値・差分も表示されます。
パネル内の目盛り付きスライダー、または入力可能な
`Step`番号から任意の境界へ移動できます。`quri_code=`から開いた回路では、対応するPython行も表示します。

チェックポイントは、Qniが正解を推測する機能ではありません。テストと同様に、
利用者がアルゴリズム上必ず成り立つ条件を指定します。`step=0`はゲート適用前、
`step=1`は最初に表示された回路列の適用後です。最終境界は、回路列を数えず
`step="last"`で指定できます。`expected_probabilities`は基底状態ごとの確率、
位相や符号まで検査するときは`expected_amplitudes`も指定します。

[`qni_demo.ipynb`](./qni_demo.ipynb) は、実装済み機能を順番に確認する日本語デモです。
対応ゲート一覧、上限の8量子ビットGHZ状態、8頂点リングMax-Cutの3層QAOA回路、
チェックポイントがすべてPASSする例、意図的にすべてFAILする例を収録しています。
FAIL例は実在する不具合とは主張せず、最初の失敗、期待値、実測値、差分の表示確認に使います。

### 2つの確認シナリオ

- 回路構造の確認: `qni.show_circuit(circuit)`で、複数ステップのゲート、制御線、順序と、セル実行時に得た測定結果を確認します。状態ベクトルパネルは表示しません。
- 状態の検査: `qni.show_circuit_and_state(circuit)`で初期状態と各ステップ境界を移動し、主要状態やチェックポイント判定を確認します。

初期デモでは、どちらも1〜8量子ビットの回路を受け付けます。
`show_circuit()`は、測定を含まない回路では状態ベクトル計算を行いません。

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
