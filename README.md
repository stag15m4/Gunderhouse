# Gunderhouse

Household and property management: homes, the appliances in them, maintenance
history, replacement forecasting, and a per-home document repository.

Deliberately not a property-management tool — there is no tenant management,
lease administration, or rent collection. A rental's lease is just a file in
that home's document repository.

## Stack

Next.js 15 (App Router) · Prisma · PostgreSQL · Auth.js (email + password) ·
Tailwind. Built to run on Railway, same shape as Alfred and Lucy.

## Access model

Two layers. Household standing lives on the user; day-to-day access is granted
per home.

**Household standing** (`User.systemRole`)

| | |
|---|---|
| `OWNER` | Peer household admin. Implicit ADMIN on every home — including homes added later — plus inviting people and changing anyone's standing. |
| `MEMBER` | Sees only the homes they've been granted. |

**Per-home role** (`HomeMembership.role`)

| | Read | Add appliances, log maintenance, upload docs | Edit the home, delete records, manage that home's access |
|---|---|---|---|
| `VIEWER` | ✅ | | |
| `MEMBER` | ✅ | ✅ | |
| `ADMIN` | ✅ | ✅ | ✅ |

Someone can be MEMBER on one home and VIEWER on another — the roles are
independent. Nothing assumes a fixed number of people or homes; adding a home
or a household member is a form, not a deploy.

## Local setup

```bash
npm install
cp .env.example .env.local          # then fill it in
npx prisma migrate deploy
npm run db:seed                     # creates the first OWNER from SEED_OWNER_*
npm run dev
```

Sign in with the seeded account and change its password from **Your account**.
Everyone else joins by invitation: **Household → Invite someone** produces a
`/invite/<token>` link you pass along yourself (there's no mail sending
configured, on purpose — it keeps the household off an email provider).

## Passwords

There is no default password anywhere. The seeded account uses whatever
`SEED_OWNER_PASSWORD` you supply, and re-running the seed never overwrites an
existing password.

- **Someone forgot theirs** — a household admin clicks **Reset password** next
  to them on the Household page. That produces a single-use `/reset/<token>`
  link, valid 24 hours, which you hand over the same way as an invitation.
  Issuing a new link cancels any earlier one for that person.
- **Changing your own** — **Your account**, with the current password.
- **Nobody can get in at all** — the one case no in-app button can solve. Run
  the CLI against the database:

  ```bash
  RESET_EMAIL=you@example.com RESET_PASSWORD='new-password' \
    npx tsx prisma/reset-password.ts
  ```

Any password change — reset link, self-service, or CLI — signs out every
session that was opened with the old password.

### Sessions

Sessions are JWTs, so their contents are a snapshot from sign-in. Authorization
never trusts that snapshot: `requireUser()` re-reads the account on every
request and rejects the session if the account is gone, or if the password
changed after the token was issued. Removing someone, or demoting them from
household admin, therefore takes effect on their next click rather than
whenever their token happens to expire.

## Deploying to Railway

1. Create a Postgres service; Railway provides `DATABASE_URL`.
2. Point a service at this repo. Build runs `prisma generate && next build`.
3. Set the start command so migrations run on deploy:
   `npx prisma migrate deploy && npx next start` (already in `railway.json`).
4. Set the environment variables from `.env.example`. At minimum:
   `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST=1`,
   the `S3_*` group, and `ALFRED_TOKEN`.
5. Seed the first admin once, from the Railway shell:
   `SEED_OWNER_EMAIL=... SEED_OWNER_NAME=... SEED_OWNER_PASSWORD=... npm run db:seed`

## Document storage

Uploads go through a driver interface (`src/lib/storage.ts`), selected by
`STORAGE_DRIVER`:

- **`s3`** (default) — any S3-compatible bucket: Cloudflare R2, AWS S3, B2.
  Downloads redirect to a 5-minute presigned URL, so file bytes never pass
  through the app.
- **`local`** — files on disk under `LOCAL_STORAGE_DIR`. Fine for development.
  On Railway it needs a mounted volume and won't survive a platform move.

R2 is the intended production target given the expected scale (thousands of
files including photos, 5–50 GB): storage scales independently of the app
container, survives redeploys, and has no egress fees.

Uploads are capped at 25 MB per file because the route handler buffers the
whole file in memory. Raising that meaningfully wants presigned
direct-to-bucket uploads instead — a contained change to the upload route and
the document form.

## Maintenance forecasting

`src/lib/lifespans.ts` is a plain lookup table of typical service life per
category (water heater 10–12 yr, HVAC 15–20, roof 20–25, dishwasher 9–10, …).
An appliance's age since its in-service date is compared against that range:

- **Past expected life** — older than the high end
- **Replacement window** — at or past the low end
- **Within 2 years** — approaching the low end
- **OK** — everything else

Appliances without an in-service date are excluded and counted separately, so
the gap is visible rather than silently treated as fine. To adjust an estimate,
edit the table.

## Alfred / Lucy integration

Read-only JSON under `/api/alfred/*`, authenticated by the `X-Alfred-Token`
header against the `ALFRED_TOKEN` env var. No user session is involved — the
token is the entire check, so it grants read access to the whole household.

| Endpoint | Returns |
|---|---|
| `GET /api/alfred` | Self-describing index of the endpoints below |
| `GET /api/alfred/homes` | All homes, with type, address, and record counts |
| `GET /api/alfred/appliances` | Appliances and home systems, with lifespan ranges |
| `GET /api/alfred/maintenance` | Maintenance entries, with date-range filtering and cost totals |
| `GET /api/alfred/forecast` | Items flagged against expected service life, most urgent first |

Most endpoints accept `home=<id or name>` so Alfred can pass through whatever
the user said. See `docs/alfred-integration.md` for parameters and response
shapes.

Writes are not part of this contract. If Alfred should ever log maintenance
("log that we replaced the water heater today"), that belongs behind an
explicit confirm-first flow added separately — not bolted onto these routes.

## Layout

```
prisma/schema.prisma          data model
src/auth.ts                   Auth.js configuration
src/lib/access.ts             the access model, in one file
prisma/reset-password.ts      CLI password reset, for a locked-out admin
src/lib/forecast.ts           age-vs-lifespan classification
src/lib/lifespans.ts          the lifespan table — edit estimates here
src/lib/storage.ts            document storage drivers (s3 / local)
src/lib/alfred.ts             shared token check and helpers for /api/alfred
src/app/(app)/                signed-in UI
src/app/actions/              server actions (all mutations)
src/app/api/alfred/           read-only integration endpoints
```
