#!/usr/bin/env bash
# akashic-system イメージをビルドする

set -au

platform=""
mode="load"
tags=() # 複数指定を可能にするため配列

show_help() {
  echo "usage: $0 [platform] [options]..."
  echo "          platform : arm|amd (required)"
  echo 
  echo "options:"
  echo "  -p, --push       : push image directly"
  echo "  -t, --tag string : docker tag. can be specified multiple times"
  echo ""
  echo "examples:"
  echo "  $0 arm --push -t akashic-system:0.1-arm"
  echo "  $0 amd -t akashic-system:latest-amd -t akashic-system:1.0-amd"
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--tag)
      shift
      if [[ $# -eq 0 ]]; then
          echo "error: --tag option requires a tag argument"
          exit 1
      fi
      tags+=("$1")
      shift
      ;;
    -p|--push)
      mode="push"
      shift
      ;;
    arm)
      platform="linux/arm64"
      shift
      ;;
    amd)
      platform="linux/amd64"
      shift
      ;;
    *)
      echo "invalid argument: $1"
      show_help
      exit 1
      ;;
  esac
done

if [ -z "$platform" ]; then
  show_help
  exit 1
fi

# 既定値
if [ ${#tags[@]} -eq 0 ]; then
  tags=("ghcr.io/akashic-games/akashic-system:latest")
fi

echo "platform: $platform"
for tag in "${tags[@]}"; do
  echo "tag: $tag"
done


tag_args=()
for tag in "${tags[@]}"; do
  tag_args+=(--tag "$tag")
done

set -aux

docker buildx build \
       --platform $platform \
       --provenance=false \
       "${tag_args[@]}" \
       --file ./Dockerfile --$mode .
