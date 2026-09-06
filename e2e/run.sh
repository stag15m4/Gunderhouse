#!/usr/bin/env bash
# Reset the database, rebuild, restart the server, and run the named suites.
# The server must be stopped before the drop, or it reconnects mid-drop and the
# database survives with stale rows.
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env.local ] && . ./.env.local; set +a

PGH="${E2E_PGHOST:-/tmp}"; PGP="${E2E_PGPORT:-5433}"

# Playwright is deliberately not a project dependency: installing it here would
# make the deploy build try to download a browser it will never run. Link it in
# from wherever it lives instead — node_modules is gitignored, so the link is
# local only. ESM ignores NODE_PATH, which is why this is a symlink.
if [ -n "${E2E_PLAYWRIGHT_DIR:-}" ]; then
  for pkg in playwright playwright-core; do
    [ -e "node_modules/$pkg" ] || ln -s "$E2E_PLAYWRIGHT_DIR/$pkg" "node_modules/$pkg"
  done
fi

# Build once up front. `next start` serves the last build, so editing a page
# and re-running without this silently tests the previous version — a mistake
# that is very easy to make and very confusing to debug.
if [ -z "${E2E_SKIP_BUILD:-}" ]; then
  echo "building..."
  npx next build >/tmp/gh-e2e-build.log 2>&1 || {
    echo "build failed; see /tmp/gh-e2e-build.log"; exit 1;
  }
fi

for suite in "$@"; do
  pkill -f "next-serve[r]" 2>/dev/null; sleep 2
  dropdb -h "$PGH" -p "$PGP" -U postgres --if-exists gunderhouse
  createdb -h "$PGH" -p "$PGP" -U postgres gunderhouse
  npx prisma migrate deploy >/dev/null 2>&1
  npm run db:seed >/dev/null 2>&1
  npx next start -p 3000 >/tmp/gh-e2e-server.log 2>&1 &
  for _ in $(seq 1 25); do curl -sf -o /dev/null http://localhost:3000/login && break; sleep 1; done
  echo "===== $suite ====="
  node "e2e/$suite"
done
pkill -f "next-serve[r]" 2>/dev/null
