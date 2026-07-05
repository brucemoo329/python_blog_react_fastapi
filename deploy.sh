#!/usr/bin/env bash

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "==> 更新 main 分支代码"
git pull origin main

echo "==> 停止旧容器"
docker compose down

echo "==> 构建并启动校园交易平台"
docker compose up -d --build

echo "==> 当前容器状态"
docker compose ps

echo "==> 部署完成"
