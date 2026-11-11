#!/usr/bin/env bash
# Cloudflare quick tunnel to the API, which serves the built web app (`pnpm start` / `pnpm demo`).
# The port comes from the repo's .env like the server's (8788 on KC's Mac, where the POA project has 8787); API_PORT in the environment wins.
set -uo pipefail
cd "$(dirname "$0")/.."
FILE_PORT=$(grep -E '^API_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '[:space:]"')
PORT=${API_PORT:-${FILE_PORT:-8787}}
echo "Tunnel to http://localhost:$PORT"
exec cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT"
