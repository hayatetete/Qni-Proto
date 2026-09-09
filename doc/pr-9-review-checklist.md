# PR #9 レビュー対応表・最終確認手順

## 指摘と対応の一覧

| レビュー指摘 | 状態 | 実装 | 自動確認 | 最後の手動確認 |
|:--|:--:|:--|:--|:--|
| clone直後にYarn本体がない | 対応済み | `Dockerfile.demo`内でCorepackからYarn 4.4.1を有効化。Git管理外の`.yarn/releases`へ依存しない | Docker imageを実build | `docker compose ... build --no-cache` |
| `doc/`除外でNotebook画像が404 | 対応済み | `.dockerignore`で`doc/screenshot/**`をbuild contextへ戻した。現在の主デモ自体は外部画像へ依存しない | Docker E2EでNotebookを開く | DevTools Networkに404がないこと |
| tokenなしJupyterが外部公開される | 対応済み | Composeの5173/8000/8888をホスト側`127.0.0.1`だけへbind | `docker compose config` | 同一PCでは開き、LANの別端末から開けないこと |
| ゲート前の初期状態を選べない | 対応済み | Step 0=ゲート前、Step N=N列適用後にPython・frontend・backendを統一 | Python/E2E | デモの最初の出力でStep 0を選び`|00000000⟩` 100% |
| bitstring・確率・振幅・位相がない | 対応済み | 全状態円のtooltipと検査パネルの表へ数値表示 | Playwright + screenshot | パネルを閉じ、各円をhover |
| 8量子ビットで重要状態が切れる | 対応済み | 確率順のDominant states、最大8行、`Show more states`、縦scrollを実装 | Playwright + screenshot | 8量子ビットGHZ出力を狭い高さでも確認 |
| エンディアン規約が不明 | 対応済み | READMEとデモに`|q(n−1)…q0⟩`、q0=右端を明記。二進ketの横に薄い十進ketを表示 | E2E | GHZのStep 1でq0側が右端の`|00000001⟩`になることと十進表記を確認 |
| 初期化中に8量子ビット回路を1量子ビットで送る | 対応済み | URL state反映完了後に1回だけsimulationを開始 | 初期化request E2E | Networkで最初から`qubitCount: 8`、500なし |
| Python/Backendが32量子ビットまで受理 | 対応済み | Python API、Backend、frontendを1〜8量子ビットに制限 | Python/backend test | 9量子ビット入力が明示的に拒否されること |
| 回転ゲートの説明が不一致 | 対応済み | 数値確定RX/RY/RZ/U1は対応。未束縛式は拒否に統一 | converter test | READMEの対応範囲を確認 |
| デモNotebook・起動先が不一致 | 対応済み | README、Docker、CI、captureを`qni_demo.ipynb`へ統一。旧2 Notebookは削除 | 参照検索 + Docker E2E | URLとNotebook名を確認 |
| 古い4量子ビット画像 | 対応済み | captureの対象を現行デモの8量子ビットGHZ出力へ変更 | capture script | 画像を再生成してPRへ貼り、8量子ビットであることを目視 |
| Docker/Jupyter/iframeをCIが通らない | 対応済み | image build、Notebook全セル実行、JupyterLab起動、Run All、生成iframe、最終状態待機をworkflowへ追加 | `verify-docker-demo.mjs` | Actionsの該当jobを確認 |
| 視覚回帰が数値assertionだけ | 対応済み | Notebook全体、Backend error、tooltip、検査panel、dropdownへ`toHaveScreenshot`とLinux baselineを追加 | Playwright | CIの画像差分がないこと |
| 名前付き条件・PASS/FAIL・最初の失敗 | 対応済み | `QniCheckpoint`と検査結果一覧を実装 | Python/E2E | デモの全PASS例と意図的な全FAIL例を確認 |
| FAILの理由が分からない | 対応済み | `Why this checkpoint failed`へExpected / Actual / Differenceを追加 | E2E + screenshot | checkpoint専用Playwright fixtureで期待・実測・差分を確認 |
| チェックポイントの使い方が分からない | 対応済み | 既知の期待状態を検証する用途を、同じGHZ回路に対する全PASS例と意図的な全FAIL例で示す | API test | PASS/FAIL例で期待値・実測値・最初の失敗境界を確認 |
| 元Pythonの行・関数・ループとの対応 | 対応済み（制約あり） | `quri_code=`入力でline/code/function/loop iterationを保持し表示。通常Circuitは`checkpoint.source`を表示 | Python/E2E | 検査パネルの`source`で`occupied_qubits`を確認 |
| qubit名 | 対応済み | `qubit_names`をQubits cardへ表示 | E2E | GHZの`GHZ q0`〜`GHZ q7`、QAOAの`vertex 0`〜`vertex 7`を確認 |
| 初期状態・前後移動 | 対応済み | 目盛り付きslider、数値入力、左右key、wheelを同期 | E2E | QAOA回路で0/1/最終Stepへ移動 |
| 前ステップとの差分 | 今回は非採用 | ユーザー判断で不要。値の差分ではなく、失敗した期待値との差分を表示 | — | — |
| 次に状態が変化する地点への専用移動 | 今回は非採用 | 前/次buttonを増やさず、目盛り付きsliderへ操作を統一 | — | — |
| 凡例 | 対応済み | 読みにくかった常設1行凡例を削除。列名、位相icon、README、デモ説明へ意味を配置 | screenshot | 初見でBasis/Probability/Amplitude/Phaseが対応すること |
| 読み取り専用から編集操作を外す | 対応済み | edit menu、palette、commit導線をinspect/circuit viewで非表示 | E2E + screenshot | デモの各出力に編集UIがないこと |
| Backend errorを画面へ出す | 対応済み | iframe内error表示 | E2E + screenshot | request blockingで確認 |
| メニューが初回clickで開かない | 対応済み | 初回open/外側closeを修正し、10 frame・2.5秒のGIFを再生成 | dropdown E2E + screenshot | GIFをPRへ掲載 |

## `qni_demo.ipynb`で確認する順序

1. 対応ゲート一覧で、1量子ビットゲート、数値確定回転ゲート、制御ゲート、SWAP、測定が表示されることを確認する。
2. 8量子ビットGHZで、Step 0の`|00000000⟩`が100%であり、最終Stepでは`|00000000⟩`と`|11111111⟩`が各50%になることを確認する。
3. 8頂点リングMax-CutのQAOA p=3で、横に長い77境界の回路をslider・数値入力・左右key・wheelで移動する。
4. GHZの全PASS例で、4件のチェックポイントがすべてPASSになり、`All checkpoints passed`が表示されることを確認する。
5. 同じGHZ回路の意図的な全FAIL例で、4件がすべてFAILになり、最初の失敗境界とExpected / Actual / Differenceが表示されることを確認する。
6. Dominant states、Probability、Amplitude、Phase、十進表記、qubit名を確認する。

## clone直後と同じ手動確認

```shell
docker compose -f compose.demo.yml build --no-cache
docker compose -f compose.demo.yml up
```

ブラウザで `http://127.0.0.1:8888/lab/tree/qni_demo.ipynb` を開き、`Run` → `Run All Cells`を実行する。6つのcode cellがerrorなしで終了することを確認する。

ポートが使用中なら、既存processを終了せず次のように変更する。

```shell
QNI_DEMO_FRONTEND_PORT=15173 \
QNI_DEMO_BACKEND_PORT=18000 \
QNI_DEMO_JUPYTER_PORT=18888 \
docker compose -f compose.demo.yml up --build
```

この場合は `http://127.0.0.1:18888/lab/tree/qni_demo.ipynb` を開く。

## UIの手動確認

1. 書類形の検査iconでpanelを開閉する。文言は英語のみ。
2. headerをdragして移動し、上下左右と四隅からresizeする。
3. panelを開いている間は状態円hoverが無効。閉じると全ての表示中の円でtooltipが出る。
4. 円を押している間はtooltipが消え、同じ円上でreleaseすると戻る。
5. 選択中の円は確率fillと外枠が通常より1段暗い。
6. QAOA回路を先頭から末尾まで移動でき、browser標準の横scrollbarは出ない。

## Networkとerrorの手動確認

1. DevTools Networkを開いて最初のQni出力セルを再実行する。
2. 初回`backend.json`が1件だけ、`qubitCount=8`、HTTP 200であること。500やerror表示のちらつきがないこと。
3. request blockingで`backend.json`を一時遮断し、stepを動かす。
4. Backend errorがNotebook出力内に出ることを確認し、blockingを解除する。

## localhost限定の手動確認

同一端末の`127.0.0.1:8888`では開け、LAN上の別端末からホストの8888番へ接続できないことを確認する。

終了時:

```shell
docker compose -f compose.demo.yml down --volumes
```

## 自動確認コマンド

```shell
cd frontend
yarn build
yarn test:unit
yarn playwright test test/playwright/notebook-state-inspection.spec.ts --project=chromium
yarn playwright test test/playwright/dropdown-menu-behavior.spec.ts --project=chromium
cd ..
python -m pytest tests backend/tests
```

## PR本文へ直接掲載する証跡

リポジトリに置くだけでは不十分なので、次をPR本文へMarkdown画像として直接掲載する。

1. 対応ゲート、8量子ビットGHZ、QAOA、全PASS/全FAILを含む読み取り専用デモ全体。
2. 編集メニュー非表示のNotebook layout。
3. Backend error表示。
4. 8量子ビットGHZの主要状態とqubit名を開いた検査panel。
5. 実行済み`qni_demo.ipynb`の出力cell。
6. main menuが初回clickで開き、外側clickで閉じる数秒のGIF。

旧`qni_tutorial.ipynb`と`qni_circuit_examples.ipynb`は`qni_demo.ipynb`へ統合して削除した。古い4量子ビット画像は使わない。
