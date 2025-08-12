#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Quick Setup for Message Aggregator"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Please install Docker and retry."
  exit 1
fi
if ! command -v docker compose >/dev/null 2>&1; then
  echo "Docker Compose V2 is required. Please install/update Docker Desktop/Engine."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  if [ -f .env.example ]; then cp .env.example .env; fi
  if [ -f env.sample ]; then cp env.sample .env; fi
fi

docker compose up -d --build
docker compose ps | cat