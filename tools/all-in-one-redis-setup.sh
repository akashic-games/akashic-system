#!/usr/bin/env bash

# オールインワン用 content-storage 向けクラスター作る
SIZE=$(redis-cli -h redis-content-storage-node-0 -p 6401 CLUSTER INFO | awk -F: '/cluster_size/ {print $2}' | tr -d '\r\n')
# SIZE が空または数値以外の場合は 0 とみなす
if ! [[ "$SIZE" =~ ^[0-9]+$ ]]; then
  echo "warning: CLUSTER INFO returned non-numeric cluster_size ('$SIZE'); treating as 0"
  SIZE=0
fi
if [ "$SIZE" -eq 0 ]; then
  echo "creating redis cluster..."
  redis-cli --cluster create \
    redis-content-storage-node-0:6401 \
    redis-content-storage-node-1:6379 \
    redis-content-storage-node-2:6379 \
    --cluster-replicas 0 \
    --cluster-yes
else
  echo "redis cluster already exists and is healthy"
fi

# 各ノードの IP アドレスを node-0 に通知
IP1=$(getent hosts redis-content-storage-node-1 | awk '{ print $1 }')
IP2=$(getent hosts redis-content-storage-node-2 | awk '{ print $1 }')
redis-cli -h redis-content-storage-node-0 -p 6401 CLUSTER MEET $IP1 6379
redis-cli -h redis-content-storage-node-0 -p 6401 CLUSTER MEET $IP2 6379
echo "done."
