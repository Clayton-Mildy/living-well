#!/usr/bin/env bash
# Start an isolated API + web pair for e2e tests: own database, own ports.
#   scripts/e2e-env.sh <name> <apiPort> <webPort>    e.g. scripts/e2e-env.sh lobby 8801 5201
# Then: E2E_BASE_URL=http://localhost:<webPort> pnpm exec playwright test e2e/<area>
# Stop:  scripts/e2e-env.sh stop <name>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ "${1:-}" = "stop" ]; then
  pkill -f "citrapremier_e2e_${2}" 2>/dev/null || true
  [ -f "/tmp/cp-e2e-${2}.pids" ] && kill $(cat "/tmp/cp-e2e-${2}.pids") 2>/dev/null || true
  rm -f "/tmp/cp-e2e-${2}.pids"; echo "stopped ${2}"; exit 0
fi
NAME="$1"; API="$2"; WEB="$3"
export DATABASE_URL="postgres://localhost:5434/citrapremier_e2e_${NAME}"
cd "$ROOT/apps/server" && CP_SEED_SMALL=1 DATABASE_URL="$DATABASE_URL" npx tsx src/db/setup.ts --reset > "/tmp/cp-e2e-${NAME}-setup.log" 2>&1
( cd "$ROOT/apps/server" && CP_SEED_SMALL=1 CP_TRUST_USER_HEADER=1 SERVE_WEB=0 API_PORT="$API" DATABASE_URL="$DATABASE_URL" nohup npx tsx src/index.ts > "/tmp/cp-e2e-${NAME}-api.log" 2>&1 & echo $! >> "/tmp/cp-e2e-${NAME}.pids" )
( cd "$ROOT/apps/web" && API_PORT="$API" WEB_PORT="$WEB" nohup npx vite > "/tmp/cp-e2e-${NAME}-web.log" 2>&1 & echo $! >> "/tmp/cp-e2e-${NAME}.pids" )
for i in $(seq 1 60); do curl -sf "http://localhost:${WEB}/api/health" > /dev/null && break; sleep 1; done
curl -sf "http://localhost:${WEB}/api/health" > /dev/null && echo "ready: http://localhost:${WEB} (api ${API}, db citrapremier_e2e_${NAME})" || { echo "failed to start; see /tmp/cp-e2e-${NAME}-*.log"; exit 1; }
