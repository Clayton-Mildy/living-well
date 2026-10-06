#!/usr/bin/env bash
# Run every e2e spec in parallel against frozen builds: one web build + one API bundle, N servers with their own databases.
#   scripts/e2e-all.sh [groups=4] [projects="phone tablet laptop"] [spec filter...]
# Results: artifacts/e2e-all/<group>.log, summary at the end. Exit code is non-zero if any group failed.
# Tests are written for the seed's own date: servers here pin CP_DEMO_DATE=2026-10-21 (the app otherwise uses today).
# Several runs at once (one per agent): E2E_NAME=lobby E2E_PORT=8831 scripts/e2e-all.sh ... (own build dir, ports, databases, logs).
set -uo pipefail
cd "$(dirname "$0")/.."
N=${1:-4}; shift || true
PROJECTS=${1:-"phone tablet laptop"}; shift || true
NAME=${E2E_NAME:-int}
OUT=.e2e${E2E_NAME:+-$E2E_NAME}
PORT0=${E2E_PORT:-8821}
LOGS=artifacts/e2e-all${E2E_NAME:+-$E2E_NAME}
ESBUILD=node_modules/.pnpm/node_modules/.bin/esbuild
mkdir -p "$OUT" "$LOGS"
rm -f "$LOGS"/*.log

echo "Building the web app and the API bundle…"
pnpm --filter @cp/web exec vite build --outDir "$PWD/$OUT/web" --emptyOutDir >"$OUT/build.log" 2>&1 || { tail -30 "$OUT/build.log"; exit 1; }
"$ESBUILD" apps/server/src/index.ts --bundle --platform=node --format=esm --target=node22 --log-level=error \
  --define:process.env.CP_BUNDLE='"1"' \
  --banner:js="import { createRequire as __cpRequire } from 'module'; const require = __cpRequire(import.meta.url);" \
  --outfile="$OUT/api.mjs" || exit 1
rm -rf "$OUT/drizzle"; cp -R apps/server/drizzle "$OUT/drizzle"

# spec files (optionally filtered), largest first so groups finish together
SPECS=$(ls -S e2e/*.spec.ts)
if [ $# -gt 0 ]; then PAT=$(IFS='|'; echo "$*"); SPECS=$(printf '%s\n' $SPECS | grep -E "$PAT"); fi
declare -a GROUP
i=0; for f in $SPECS; do GROUP[$((i % N))]="${GROUP[$((i % N))]:-} $f"; i=$((i + 1)); done

# CP_TRUST_USER_HEADER=1: the API also accepts a bare `x-user-id` header, so specs can call it directly without a session token (browsers always send the signed token)
PIDS=(); PORTS=()
for g in $(seq 0 $((N - 1))); do
  [ -z "${GROUP[$g]:-}" ] && continue
  port=$((PORT0 + g)); PORTS+=("$port")
  lsof -ti "tcp:$port" -sTCP:LISTEN | xargs kill 2>/dev/null || true
  CP_DEMO_DATE="${CP_DEMO_DATE:-2026-10-21}" CP_TRUST_USER_HEADER=1 WEB_DIST="$PWD/$OUT/web" MIGRATIONS_DIR="$PWD/$OUT/drizzle" API_PORT="$port" DATABASE_URL="postgres://localhost:5434/citrapremier_e2e_${NAME}$g" \
    nohup node "$OUT/api.mjs" >"$OUT/api-$g.log" 2>&1 &
  PIDS+=("$!")
done
for port in "${PORTS[@]}"; do
  for _ in $(seq 1 180); do curl -sf "http://localhost:$port/api/health" >/dev/null && break; sleep 0.5; done
  curl -sf "http://localhost:$port/api/health" >/dev/null || { echo "server :$port did not start (see $OUT/api-*.log)"; for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null; done; exit 1; }
done

PROJ_ARGS=""; for p in $PROJECTS; do PROJ_ARGS="$PROJ_ARGS --project=$p"; done
echo "Running $(echo $SPECS | wc -w | tr -d ' ') spec files in $N groups ($PROJECTS)…"
RUNS=()
for g in $(seq 0 $((N - 1))); do
  [ -z "${GROUP[$g]:-}" ] && continue
  port=$((PORT0 + g))
  echo "  group $g (:$port):${GROUP[$g]}"
  # shellcheck disable=SC2086
  E2E_BASE_URL="http://localhost:$port" pnpm exec playwright test ${GROUP[$g]} $PROJ_ARGS --reporter=line --trace=off --output="$LOGS/out-$g" >"$LOGS/group-$g.log" 2>&1 &
  RUNS+=("$!:$g")
done
FAIL=0
for r in "${RUNS[@]}"; do pid=${r%%:*}; g=${r##*:}; if ! wait "$pid"; then FAIL=1; fi
  echo "group $g: $(grep -E '^\s+[0-9]+ (passed|failed|flaky|skipped|did not run)' "$LOGS/group-$g.log" | tr -s ' ' | tr '\n' ' ')"; done
for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
if [ $FAIL -ne 0 ]; then echo "FAILURES (see $LOGS/group-*.log):"; grep -hE '^\s+[0-9]+\) \[' "$LOGS"/group-*.log | sort -u | head -60; exit 1; fi
echo "All e2e groups passed."
