#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies…"
  if command -v bun >/dev/null 2>&1; then
    bun install
  else
    npm install
  fi
fi

echo "Starting ConfigMedic at http://localhost:5173"

if command -v bun >/dev/null 2>&1; then
  exec bun run dev -- --host 127.0.0.1 --port 5173 --strictPort
else
  exec npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
fi
