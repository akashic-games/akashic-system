#!/usr/bin/env bash
set -eu

# current working directory がプロジェクトルートな状態で `bash ./tools/${JOB_NAME}.sh` と実行している前提。
# cwd がこのファイルと同じディレクトリで実行されたら、 `docker-compose down` あたりでエラーになるはず

export PATH="/usr/local/bin:${PATH}"
echo $PATH | sed -e "s/:/\n/g"
export NODE_OPTIONS="--max-old-space-size=8192"

# run middleware services
docker compose pull database redis rabbitmq mongodb zookeeper game-runner minio
docker build --tag ghcr.io/akashic-games/akashic-system:latest --file ./Dockerfile .
docker compose up -d database redis rabbitmq mongodb zookeeper game-runner minio

yarn install --immutable --check-cache
yarn build
yarn try-connect

# migration
yarn db:migrate
yarn db:seed
yarn create-s3-buckets

# seeding
## nothing

# setup akashic system services
sleep 2
docker compose up -d akashic-cluster-master conduct-worker\
  cluster-monitor system-api-server

sleep 2
docker compose up -d cluster-monitor-api-server playlog-server

sleep 2
docker compose up -d cluster-monitor

# run E2E test before each package tests
cp config/test-ci.yaml config/local.yaml
yarn test

# teardown middlewares
docker compose down

# clean dangling images, that is created by `docker-compose build`
## and its size may be about 1GB.
docker image prune -f
