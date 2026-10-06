#!/usr/bin/env bash
# Frozen review copy for manual checking while development continues.
# Builds the web app and bundles the API into .review/, then serves both on one port with their own database,
# so edits to the source don't restart or change what you're looking at.
#   scripts/review.sh          rebuild and restart (keeps the review data)
#   scripts/review.sh reset    rebuild, restart and reset the demo data (clock back to 09:58)
#   scripts/review.sh stop
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=.review
PORT=${REVIEW_PORT:-8790}
DB=${REVIEW_DATABASE_URL:-postgres://localhost:5434/citrapremier_review}
ESBUILD=node_modules/.pnpm/node_modules/.bin/esbuild

stop() {
  if [ -f "$OUT/api.pid" ]; then kill "$(cat "$OUT/api.pid")" 2>/dev/null || true; rm -f "$OUT/api.pid"; fi
  lsof -ti "tcp:$PORT" -sTCP:LISTEN | xargs kill 2>/dev/null || true
}
if [ "${1:-}" = stop ]; then stop; echo "Review copy stopped."; exit 0; fi

mkdir -p "$OUT"
echo "Building the web app…"
rm -rf "$OUT/web.next"
pnpm --filter @cp/web exec vite build --outDir "$PWD/$OUT/web.next" --emptyOutDir >"$OUT/build.log" 2>&1 || { tail -30 "$OUT/build.log"; exit 1; }
echo "Bundling the API…"
"$ESBUILD" apps/server/src/index.ts --bundle --platform=node --format=esm --target=node22 --log-level=error \
  --define:process.env.CP_BUNDLE='"1"' \
  --banner:js="import { createRequire as __cpRequire } from 'module'; const require = __cpRequire(import.meta.url);" \
  --outfile="$OUT/api.next.mjs"

stop
# keep the previous build's code files so tabs opened before this rebuild keep working (they reload into the new version)
if [ -d "$OUT/web/assets" ]; then cp -n "$OUT/web/assets/"* "$OUT/web.next/assets/" 2>/dev/null || true; fi
rm -rf "$OUT/web" "$OUT/drizzle"
mv "$OUT/web.next" "$OUT/web"
mv "$OUT/api.next.mjs" "$OUT/api.mjs"
cp -R apps/server/drizzle "$OUT/drizzle"
WEB_DIST="$PWD/$OUT/web" MIGRATIONS_DIR="$PWD/$OUT/drizzle" API_PORT="$PORT" DATABASE_URL="$DB" nohup node "$OUT/api.mjs" >"$OUT/api.log" 2>&1 &
echo $! >"$OUT/api.pid"
for _ in $(seq 1 60); do curl -sf "http://localhost:$PORT/api/health" >/dev/null && break; sleep 0.5; done
if ! curl -sf "http://localhost:$PORT/api/health" >/dev/null; then echo "The review copy failed to start:"; tail -30 "$OUT/api.log"; exit 1; fi
if [ "${1:-}" = reset ]; then curl -sf -X POST -H 'content-type: application/json' -d '{}' "http://localhost:$PORT/api/demo/reset" >/dev/null && echo "Demo data reset."; fi
echo "Review copy ready: http://localhost:$PORT  (built $(date '+%H:%M'))"
