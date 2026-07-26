# Gunderhouse — `/api/alfred/*` integration contract

Complete external-caller reference. Accurate as of commit `c44ae11`.

Gunderhouse exposes read endpoints for homes, appliances, maintenance history,
replacement forecasting, and routine tasks, plus exactly one write: completing a
routine task, behind a two-step confirmation.

---

## 1. Base URL

```
https://<your-gunderhouse-domain>
```

All paths below are relative to that origin.

---

## 2. Authentication

| | |
|---|---|
| Server env var | `ALFRED_TOKEN` |
| Request header | `X-Alfred-Token: <token>` |

The token is compared server-side in constant time. There is no user session,
no cookie, no CORS handling, and no per-home permission check — **the token is
the entire access control**, so it grants read access to the whole household's
data and the ability to complete routine tasks.

Auth failures:

| Condition | Status | Body |
|---|---|---|
| Header missing or wrong | `401` | `{"error":"Unauthorized"}` |
| `ALFRED_TOKEN` unset on the server | `503` | `{"error":"Integration is not configured."}` |
| Method not implemented by that path | `405` | (framework default) |

Every endpoint is `GET` except `/api/alfred/tasks/complete`, which is `POST`.

---

## 3. Conventions

- **Dates** are `YYYY-MM-DD` strings. The only exception is `generatedAt`, which
  is a full ISO-8601 timestamp.
- **Money** is dollars as a JSON number (`costUsd`, `estimatedReplacementCostUsd`),
  never cents, never a string.
- **`home` parameter** — accepted by every read endpoint except `/homes`. Takes a
  home **id or name**, case-insensitive, so a spoken "the Oak Street rental" can
  be passed through unmodified. `homeId` is accepted as an alias. Omit it to span
  every home. An unmatched value returns:

  ```json
  { "error": "No home matches that identifier." }
  ```

  with status `404`.
- **`home` in responses** echoes the resolved home as `{ "id", "name" }`, or is
  `null` when the parameter was omitted.
- Nullable fields are present and `null` rather than absent.

---

## 4. `GET /api/alfred`

Self-describing index. No query parameters.

```json
{
  "app": "gunderhouse",
  "version": 1,
  "access": {
    "reads": "unrestricted",
    "writes": "confirm-first; completing a routine task is the only one"
  },
  "auth": { "header": "X-Alfred-Token" },
  "endpoints": [
    { "path": "/api/alfred/homes", "description": "...", "params": {} }
  ],
  "writes": [
    {
      "path": "/api/alfred/tasks/complete",
      "method": "POST",
      "description": "Mark a routine task complete. Two steps, always.",
      "steps": [
        { "step": 1, "body": {}, "effect": "..." },
        { "step": 2, "body": {}, "effect": "..." }
      ],
      "expectation": "..."
    }
  ],
  "notes": "Completing a routine task is the only write available. Everything else is read-only."
}
```

Useful as a one-call capability check: `access` summarises the posture and the
`writes` array enumerates every mutating call.

---

## 5. `GET /api/alfred/homes`

No query parameters. Returns every home.

```json
{
  "homes": [
    {
      "id": "cms0abc123",
      "name": "Main House",
      "type": "PRIMARY_RESIDENCE",
      "address": {
        "line1": "14 Cedar Lane",
        "line2": null,
        "city": "Madison",
        "state": "WI",
        "postalCode": "53703"
      },
      "yearBuilt": 1998,
      "squareFeet": null,
      "purchasedOn": null,
      "notes": null,
      "counts": {
        "appliances": 3,
        "maintenanceEntries": 2,
        "documents": 1
      }
    }
  ]
}
```

Sorted by `type`, then `name`.

---

## 6. `GET /api/alfred/appliances`

Appliances and whole-home systems.

| Param | Required | Meaning |
|---|---|---|
| `home` | no | home id or name; omit for all homes |
| `category` | no | one `ApplianceCategory` value; an unrecognised value is **silently ignored** rather than erroring |

```json
{
  "home": { "id": "cms0abc123", "name": "Main House" },
  "appliances": [
    {
      "id": "cms0def456",
      "homeId": "cms0abc123",
      "homeName": "Main House",
      "name": "Basement water heater",
      "category": "WATER_HEATER",
      "brand": "Rheem",
      "modelNumber": "XE50M06ST45U1",
      "serialNumber": "SN-0099123",
      "location": "Utility closet",
      "installedOn": "2008-04-15",
      "modelYear": null,
      "warrantyExpiresOn": "2014-04-15",
      "expectedLifespanYears": { "low": 10, "high": 12, "overridden": false },
      "notes": null
    }
  ]
}
```

Sorted by `installedOn` descending, then `name`.

- `modelYear` is the unit's actual vintage, recorded when it differs from
  `installedOn` — i.e. the appliance was bought second-hand. `null` otherwise.
- `expectedLifespanYears.overridden` is `true` when that range was set by hand
  for this unit rather than taken from the category table.

---

## 7. `GET /api/alfred/maintenance`

The maintenance and repair log.

| Param | Required | Meaning |
|---|---|---|
| `home` | no | home id or name |
| `applianceId` | no | restrict to one appliance |
| `from` | no | `YYYY-MM-DD`, inclusive |
| `to` | no | `YYYY-MM-DD`, inclusive |
| `limit` | no | default `100`, maximum `500` |

```json
{
  "home": { "id": "cms0abc123", "name": "Main House" },
  "range": { "from": "2025-01-01", "to": "2025-12-31" },
  "totals": { "entries": 2, "costUsd": 367.5 },
  "returned": 2,
  "entries": [
    {
      "id": "cms0ghi789",
      "homeId": "cms0abc123",
      "homeName": "Main House",
      "performedOn": "2025-09-02",
      "description": "Gutter cleaning",
      "costUsd": 325,
      "vendor": "TopSide",
      "notes": null,
      "appliance": null,
      "task": null,
      "loggedBy": "Gunder",
      "loggedVia": "APP"
    },
    {
      "id": "cms0mno345",
      "homeId": "cms0abc123",
      "homeName": "Main House",
      "performedOn": "2025-07-25",
      "description": "Replace furnace filter",
      "costUsd": 42.5,
      "vendor": null,
      "notes": "Swapped for a MERV 11",
      "appliance": {
        "id": "cms0def456",
        "name": "Basement furnace",
        "category": "FURNACE"
      },
      "task": {
        "id": "cms0jkl012",
        "title": "Replace furnace filter"
      },
      "loggedBy": null,
      "loggedVia": "ALFRED"
    }
  ]
}
```

The first entry is one-off home-level work someone logged in the app. The second
is a routine-task completion confirmed through this integration — note `task`
populated, `loggedBy` null, and `loggedVia: "ALFRED"`.

Notes:

- Sorted by `performedOn` descending.
- `totals` covers the **whole filtered set**; `entries` is capped by `limit`, so
  `totals.entries` may exceed `returned`.
- `appliance` is `null` for home-level work (roof, gutters, landscaping).
- `costUsd` is `null` when no cost was recorded.
- `task` is `null` for one-off work, and populated when the entry was the
  completion of a routine task — the `id` matches `/api/alfred/tasks`, so a
  caller can answer "when did we last do this one?" from the log.
- `loggedBy` is the name of the person who recorded it, or `null` for entries
  written through the integration.
- `loggedVia` is `APP` (someone using Gunderhouse directly) or `ALFRED` (a
  confirmed assistant write), letting a caller recognise its own entries.

---

## 8. `GET /api/alfred/forecast`

Appliances measured against typical service life.

| Param | Required | Meaning |
|---|---|---|
| `home` | no | home id or name |
| `includeOk` | no | `"1"` to also return items that are not yet near replacement |

```json
{
  "home": null,
  "generatedAt": "2026-07-25T20:15:00.000Z",
  "basis": "Age compared to an expected service-life range. Age runs from the unit's model year when one is recorded (a second-hand machine is as old as it is), otherwise from its in-service date. The range is the category default unless overridden for that unit.",
  "totals": {
    "items": 2,
    "estimatedReplacementCostUsd": 17000,
    "applianceCountNotForecast": 1
  },
  "items": [
    {
      "applianceId": "cms0def456",
      "homeId": "cms0abc123",
      "homeName": "Main House",
      "name": "Basement water heater",
      "category": "WATER_HEATER",
      "location": "Utility closet",
      "installedOn": "2008-04-15",
      "modelYear": null,
      "ageBasis": "IN_SERVICE",
      "agedFrom": "2008-04-15",
      "ageYears": 18.3,
      "expectedLifespanYears": { "low": 10, "high": 12, "overridden": false },
      "replacementWindowOpensYear": 2018,
      "yearsRemaining": -8.3,
      "status": "OVERDUE",
      "estimatedReplacementCostUsd": 2000,
      "warrantyExpiresOn": "2014-04-15"
    }
  ]
}
```

Notes:

- Sorted most urgent first.
- By default only non-`OK` items are returned, so "what's coming due?" needs no
  client-side filtering.
- `ageBasis` is `MODEL_YEAR` when the unit's own vintage was used, `IN_SERVICE`
  otherwise, and `agedFrom` is the date the age was actually measured from.
  Together they explain why something can read far older than the date it was
  installed: a used appliance is as old as it is.
- Appliances with **neither a model year nor an in-service date cannot be
  forecast** and are excluded entirely. `totals.applianceCountNotForecast`
  reports how many — worth surfacing, since an empty forecast may just mean
  missing dates.
- `expectedLifespanYears.overridden` is `true` when that unit's range was set by
  hand. Commercial-grade equipment routinely outlasts its category, so an
  override is the difference between a useful forecast and a false alarm.
- `estimatedReplacementCostUsd` comes from a rough per-category table. It is a
  planning hint, not a quote, and may be `null`.

---

## 9. `GET /api/alfred/tasks`

Routine (recurring) maintenance jobs and when they are next due.

| Param | Required | Meaning |
|---|---|---|
| `home` | no | home id or name |
| `status` | no | `"due"` (default) returns only `OVERDUE` + `DUE_SOON`; `"all"` returns everything including paused tasks. Any other value is treated as `"due"`. |

```json
{
  "home": null,
  "generatedAt": "2026-07-25T20:15:00.000Z",
  "filter": "due",
  "totals": { "returned": 2, "overdue": 1, "dueSoon": 1 },
  "tasks": [
    {
      "id": "cms0jkl012",
      "homeId": "cms0abc123",
      "homeName": "Main House",
      "title": "Replace furnace filter",
      "cadence": "every 3 months",
      "intervalValue": 3,
      "intervalUnit": "MONTH",
      "appliance": { "id": "cms0def456", "name": "Basement furnace" },
      "nextDueOn": "2026-07-15",
      "lastCompletedOn": "2026-04-15",
      "daysUntilDue": -10,
      "status": "OVERDUE",
      "active": true,
      "notes": null
    }
  ]
}
```

Notes:

- Sorted most urgent first; paused tasks sink to the bottom.
- `appliance` is `null` for home-level jobs.
- `daysUntilDue` is negative once overdue.
- `cadence` is a ready-to-speak phrase (`"every 3 months"`, `"yearly"`).
- Paused tasks report `active: false` and never carry a due status.

---

## 10. `POST /api/alfred/tasks/complete` — the only write

**Two round trips, always.** Step 1 changes nothing; it exists so the user hears
what will happen before it happens. The endpoint dispatches on which body shape
it receives.

### Step 1 — propose

Request body:

```json
{
  "taskId": "cms0jkl012",
  "completedOn": "2026-07-25",
  "notes": "Swapped for a MERV 11",
  "vendor": "Nelson Plumbing",
  "costUsd": 42.5
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `taskId` | **yes** | string | |
| `completedOn` | no | string | `YYYY-MM-DD`; defaults to today |
| `notes` | no | string | max 2000 chars |
| `vendor` | no | string | max 200 chars |
| `costUsd` | no | number | must be ≥ 0 |

Response `200`:

```json
{
  "status": "confirmation_required",
  "summary": "Record \"Replace furnace filter\" (Basement furnace) at Main House as completed today. This adds an entry to the maintenance log and moves the next due date to 2026-10-25 (every 3 months).",
  "confirmationToken": "9f2c8a1b4e6d0c3f7a5b2e9d8c1f4a6b3e7d0c9f2a5b8e1d",
  "expiresAt": "2026-07-25T20:20:00.000Z",
  "instructions": "Read the summary to the user. If they agree, POST { confirmationToken } back to this endpoint. Nothing has been recorded yet.",
  "task": {
    "id": "cms0jkl012",
    "title": "Replace furnace filter",
    "homeName": "Main House",
    "appliance": "Basement furnace",
    "currentNextDueOn": "2026-07-15",
    "lastCompletedOn": "2026-04-15"
  }
}
```

**Nothing has been written at this point.**

### Step 2 — confirm

Request body:

```json
{ "confirmationToken": "9f2c8a1b4e6d0c3f7a5b2e9d8c1f4a6b3e7d0c9f2a5b8e1d" }
```

Response `200`:

```json
{
  "status": "completed",
  "summary": "Record \"Replace furnace filter\" (Basement furnace) at Main House as completed today. This adds an entry to the maintenance log and moves the next due date to 2026-10-25 (every 3 months).",
  "maintenanceEntryId": "cms0mno345",
  "task": {
    "id": "cms0jkl012",
    "title": "Replace furnace filter",
    "lastCompletedOn": "2026-07-25",
    "nextDueOn": "2026-10-25"
  }
}
```

This writes a maintenance-log entry and rolls the task's due date forward, in
one transaction.

### Errors

| Condition | Status | Body |
|---|---|---|
| Body is not valid JSON | `400` | `{"error":"Body must be JSON."}` |
| Body matches neither shape | `400` | `{"error":"Send either { taskId, ... } to propose, or { confirmationToken } to confirm.","details":["..."]}` |
| `taskId` does not exist | `404` | `{"error":"No such task."}` |
| Token not recognised | `404` | `{"error":"Unknown confirmation token."}` |
| Task deleted between the two steps | `404` | `{"error":"The task no longer exists."}` |
| Token already used | `409` | `{"error":"That confirmation was already used. Propose the change again."}` |
| Token expired | `410` | `{"error":"That confirmation expired. Propose the change again."}` |

### Rules for the calling assistant

- **Do not auto-confirm.** Sending step 1 and step 2 back to back defeats the
  entire design. Speak the `summary`, wait for a real answer.
- **Prefer the returned `summary` verbatim** over composing your own wording, so
  what the user agrees to is exactly what gets written.
- If the user declines, simply drop the token — it expires on its own. There is
  no cancel call.
- Tokens are **single-use** and expire **5 minutes** after issue.
- Entries created this way are stamped internally as Alfred-sourced and display
  as "Alfred / Lucy" in the app, so they are never mistaken for a person's own
  entry.

---

## 11. Enum reference

**`type`** (home) — `PRIMARY_RESIDENCE`, `RENTAL`

**`category`** (appliance) — `WATER_HEATER`, `WATER_HEATER_TANKLESS`, `FURNACE`,
`AIR_CONDITIONER`, `HEAT_PUMP`, `BOILER`, `ROOF`, `DISHWASHER`, `REFRIGERATOR`,
`FREEZER`, `RANGE_OVEN`, `MICROWAVE`, `WASHER`, `DRYER`, `GARBAGE_DISPOSAL`,
`WATER_SOFTENER`, `SUMP_PUMP`, `WELL_PUMP`, `SEPTIC_SYSTEM`,
`GARAGE_DOOR_OPENER`, `GENERATOR`, `OTHER`

**`status`** (forecast item) — `OVERDUE` (past the high end of expected life),
`DUE_SOON` (at or past the low end), `WATCH` (within 2 years of the low end),
`OK`

**`ageBasis`** (forecast item) — `MODEL_YEAR`, `IN_SERVICE`

**`status`** (routine task) — `OVERDUE`, `DUE_SOON` (within 14 days), `UPCOMING`

**`loggedVia`** (maintenance entry) — `APP`, `ALFRED`

**`intervalUnit`** (routine task) — `DAY`, `WEEK`, `MONTH`, `YEAR`

---

## 12. Worked examples

```bash
TOKEN='your-alfred-token'
BASE='https://your-gunderhouse-domain'

# All homes
curl -s -H "X-Alfred-Token: $TOKEN" "$BASE/api/alfred/homes"

# Appliances at one home, by name
curl -s -H "X-Alfred-Token: $TOKEN" \
  "$BASE/api/alfred/appliances?home=Main%20House"

# This year's maintenance spend at one home
curl -s -H "X-Alfred-Token: $TOKEN" \
  "$BASE/api/alfred/maintenance?home=Main%20House&from=2026-01-01&to=2026-12-31"

# What's coming due everywhere
curl -s -H "X-Alfred-Token: $TOKEN" "$BASE/api/alfred/forecast"

# What routine work is due
curl -s -H "X-Alfred-Token: $TOKEN" "$BASE/api/alfred/tasks"

# Step 1 — propose a completion (writes nothing)
curl -s -X POST -H "X-Alfred-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"taskId":"cms0jkl012","notes":"Swapped for a MERV 11"}' \
  "$BASE/api/alfred/tasks/complete"

# Step 2 — confirm, after the user says yes
curl -s -X POST -H "X-Alfred-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"confirmationToken":"9f2c8a1b..."}' \
  "$BASE/api/alfred/tasks/complete"
```

---

## 13. Not implemented

These do not exist. Calling them returns `404` or `405`.

- **No documents endpoint.** `/api/alfred/homes` reports `counts.documents` and
  nothing further. This is deliberate: documents sit behind per-home permissions
  in the app, and this surface has no user identity, so exposing them would hand
  every stored insurance policy, lease, and receipt to anyone holding the token.
- **No general maintenance write.** There is no way to add or edit an arbitrary
  maintenance entry. The only write is completing an existing routine task.
- **No appliance, home, task, or document creation or editing.**
- **No delete of anything.**

There is no `taskId` filter on `/api/alfred/maintenance`; entries carry `task`,
so filter client-side, or call `/api/alfred/tasks` for current schedule state.

Any future write should follow the same propose/confirm shape as
`/api/alfred/tasks/complete` rather than accepting a single-shot mutation.
