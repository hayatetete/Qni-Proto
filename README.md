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
