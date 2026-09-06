# End-to-end suites

These drive a real browser against a real Postgres. Most of what has actually
broken in this app — a redirect loop, a permission leaking through a total, a
stale session surviving a password change — only shows up with both in play,
so there is deliberately no mocking here.

They live in the repo rather than in a scratch directory because an earlier set
was lost when a dev container was reclaimed, taking its only copy with it.

## Running them

Needs a Postgres the app can reach, a seeded database, a build, and a running
server. Roughly:

```bash
createdb gunderhouse
npx prisma migrate deploy
npm run db:seed
npx next build
npx next start -p 3000 &

node e2e/property.mjs
```

`run.sh` rebuilds first, because `next start` serves the last build — editing
a page and re-running without a rebuild silently tests the old version. Set
`E2E_SKIP_BUILD=1` to skip it when nothing has changed.

Each suite assumes a **freshly seeded database** and creates its own homes and
people. Re-running one against a dirty database will fail on duplicate names.

## Playwright

Deliberately **not** a dependency of this project: adding it would make the
Railway build try to download a browser it will never run. Install it
separately and point the suites at it:

```bash
mkdir -p /tmp/e2e-deps && cd /tmp/e2e-deps && npm init -y
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright
export E2E_PLAYWRIGHT_DIR=/tmp/e2e-deps/node_modules
```

`run.sh` symlinks it into `node_modules` from there. It has to be a symlink
rather than `NODE_PATH`, which ESM imports ignore. `node_modules` is
gitignored, so nothing about this reaches the repo.

If you would rather have it local, `npm i -D playwright` works too — just be
aware of what it does to the deploy build.

## Configuration

Read from the environment, with defaults suiting a local scratch setup:

| Variable | Default |
| --- | --- |
| `E2E_BASE` | `http://localhost:3000` |
| `E2E_PGHOST` / `E2E_PGPORT` | `/tmp` / `5433` |
| `E2E_CHROMIUM` | the sandbox's bundled Chromium |
| `E2E_PLAYWRIGHT_DIR` | the `node_modules` holding `playwright` |
| `ALFRED_TOKEN`, `LEGAL_TOKEN` | the local test tokens |
| `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` | the seeded admin |

## Writing one

`harness.mjs` carries the shared pieces. Two traps worth knowing:

- **`clickAndSettle`, not `click`.** A server action is a POST, a 303 and a
  re-render; `networkidle` alone races it.
- **`has()` is a substring match on the whole page.** Section copy counts:
  asserting a category named "Groceries" is absent fails if a hint below it
  reads *"groceries, $1,240"*. Scope to a table when it matters.
