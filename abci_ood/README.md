# Qni-GL Interactive App Example

Qni is a quantum computer simulator that runs in your browser.

## Qni-GL Singularity イメージの作成

Qni-GL Interactive Appの実行にはQNI-GLがインストールされたSingularityコンテナイメージが必要です。
`singularity/qni-gl.def`ファイルを元にABCI上にSingularityコンテナイメージを作成してください。

作成手順:

```
[username@es1 ~]$ module load singularitypro
[username@es1 ~]$ singularity build --fakeroot qni-gl.sif singularity/qni-gl.def
```

## インストール

Qni-GL Interactive Appをホームディレクトリにインストールします。
事前にOpen OnDemandのSandboxを有効にしておいてください。

Sandboxを有効にした後、 `~/ondemand/dev/` ディレクトリ下に本ファイルをコピーします。

```
[username@es1 ~]$ cp -r /path/to/bc_example_qni ~/ondemand/dev/qni
```

コピー後、Open OnDemandのウェブサイトにアクセスし、`"My Sandbox Apps"` メニューからアプリケーションにアクセスすることができます。
