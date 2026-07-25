# Gunderhouse → Alfred / Lucy integration

Read-only JSON endpoints, shaped to match the pattern the other integrations
use: `/api/alfred/*`, a shared-secret header, plain JSON, simple query params.

Nothing here needs a user session, and there is no CORS handling — the token
check is the whole access control.

## Auth

```
X-Alfred-Token: <ALFRED_TOKEN>
```

Compared server-side against the `ALFRED_TOKEN` env var, in constant time.

- Missing or wrong token → `401 {"error":"Unauthorized"}`
- `ALFRED_TOKEN` unset on the server → `503`
- Any method other than `GET` → `405`

Generate a token with `openssl rand -hex 32` and set it on both sides.

## Conventions

- Dates are `YYYY-MM-DD` strings, never timestamps, except `generatedAt`.
- Money is dollars as a number (`costUsd`), not cents.
- The `home` param accepts a home **id or name** (case-insensitive), so a
  spoken "the Oak Street rental" can be passed straight through. Omit it to
  span every home. An unmatched value returns `404`.

## `GET /api/alfred`

Self-describing index — every endpoint, its parameters, and a note that writes
are out of scope. Useful as a one-call capability check.

## `GET /api/alfred/homes`

No parameters.

```json
{
  "homes": [
    {
      "id": "cm...",
      "name": "Main House",
      "type": "PRIMARY_RESIDENCE",
      "address": { "line1": "14 Cedar Lane", "line2": null,
                   "city": "Madison", "state": "WI", "postalCode": "53703" },
      "yearBuilt": 1998,
      "squareFeet": null,
      "purchasedOn": null,
      "notes": null,
      "counts": { "appliances": 3, "maintenanceEntries": 2, "documents": 1 }
    }
  ]
}
```

`type` is `PRIMARY_RESIDENCE` or `RENTAL`.

## `GET /api/alfred/appliances`

| Param | Meaning |
|---|---|
| `home` | home id or name (optional) |
| `category` | one of the `ApplianceCategory` values (optional) |

```json
{
  "home": { "id": "cm...", "name": "Main House" },
  "appliances": [
    {
      "id": "cm...",
      "homeId": "cm...",
      "homeName": "Main House",
      "name": "Basement water heater",
      "category": "WATER_HEATER",
      "brand": "Rheem",
      "modelNumber": "XE50M06ST45U1",
      "serialNumber": "SN-0099123",
      "location": "Utility closet",
      "installedOn": "2008-04-15",
      "warrantyExpiresOn": "2014-04-15",
      "expectedLifespanYears": { "low": 10, "high": 12 },
      "notes": null
    }
  ]
}
```

`home` is `null` when the parameter was omitted.

Categories include whole-home systems, not just appliances: `ROOF`, `FURNACE`,
`AIR_CONDITIONER`, `SEPTIC_SYSTEM`, `WELL_PUMP`, and so on. The full list is
the `ApplianceCategory` enum in `prisma/schema.prisma`.

## `GET /api/alfred/maintenance`

| Param | Meaning |
|---|---|
| `home` | home id or name (optional) |
| `applianceId` | restrict to one appliance (optional) |
| `from` | `YYYY-MM-DD`, inclusive (optional) |
| `to` | `YYYY-MM-DD`, inclusive (optional) |
| `limit` | default 100, max 500 (optional) |

```json
{
  "home": { "id": "cm...", "name": "Main House" },
  "range": { "from": "2025-01-01", "to": "2025-12-31" },
  "totals": { "entries": 2, "costUsd": 1575.75 },
  "returned": 2,
  "entries": [
    {
      "id": "cm...",
      "homeId": "cm...",
      "homeName": "Main House",
      "performedOn": "2025-09-02",
      "description": "Gutter cleaning",
      "costUsd": 325,
      "vendor": "TopSide",
      "notes": null,
      "appliance": null,
      "loggedBy": "Gunder"
    }
  ]
}
```

`totals` covers the whole filtered set; `entries` is capped by `limit`, so
`totals.entries` may exceed `returned`. `appliance` is `null` for home-level
work (roof, gutters, landscaping) that isn't tied to a specific unit.

## `GET /api/alfred/forecast`

| Param | Meaning |
|---|---|
| `home` | home id or name (optional) |
| `includeOk` | `1` to also return items not yet near replacement (optional) |

```json
{
  "home": null,
  "generatedAt": "2026-07-25T18:40:00.000Z",
  "basis": "Age since in-service date compared to a typical service-life range per category.",
  "totals": {
    "items": 2,
    "estimatedReplacementCostUsd": 17000,
    "applianceCountWithoutInstallDate": 1
  },
  "items": [
    {
      "applianceId": "cm...",
      "homeId": "cm...",
      "homeName": "Main House",
      "name": "Basement water heater",
      "category": "WATER_HEATER",
      "location": "Utility closet",
      "installedOn": "2008-04-15",
      "ageYears": 18.3,
      "expectedLifespanYears": { "low": 10, "high": 12 },
      "replacementWindowOpensYear": 2018,
      "yearsRemaining": -8.3,
      "status": "OVERDUE",
      "estimatedReplacementCostUsd": 2000,
      "warrantyExpiresOn": "2014-04-15"
    }
  ]
}
```

`status` is one of:

| | |
|---|---|
| `OVERDUE` | Older than the high end of its expected life |
| `DUE_SOON` | At or past the low end — inside the replacement window |
| `WATCH` | Within two years of the low end |
| `OK` | Everything else (only returned with `includeOk=1`) |

By default only non-`OK` items are returned, so "what's coming due" is a
single call with no filtering on Alfred's side.

`estimatedReplacementCostUsd` comes from a rough per-category figure in the
lifespan table. It's a planning hint, not a quote.

`applianceCountWithoutInstallDate` is worth surfacing when summarising — those
items can't be forecast at all, so a clean forecast may just mean missing
install dates.

## Notes for the Alfred side

- Call `/api/alfred/homes` first to resolve names to ids if you want stable
  references; otherwise just pass the name through as `home`.
- Everything is read-only. There is no endpoint that mutates state, by design.
  A future "log that we replaced the water heater today" flow should be added
  as a separate, explicitly confirmed write path — Gunderhouse should ask for
  confirmation before recording anything, rather than trusting a parsed
  utterance.
