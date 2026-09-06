# Gunderhouse — `/api/legal/*` integration contract

Complete reference for the Legal app. Accurate as of September 2026.

Gunderhouse tracks what each property is **worth**. The Legal app tracks what
is **filed against** it. Neither can compute equity alone, so they meet here.

## 1. Direction of trust

| | System of record | Flows |
| --- | --- | --- |
| Property value, appraisals | Gunderhouse | Legal reads |
| Mortgages, HELOCs, judgments, liens | **Legal** | Legal writes |
| Equity, LTV, borrowing headroom | Computed in Gunderhouse | Legal reads |

Liens written through this surface are **owned by Legal**. They appear in the
Gunderhouse UI badged "From Legal" and cannot be edited there — a record
editable in two places is a record that will eventually disagree with itself.
Liens entered by hand in Gunderhouse are never read, modified, or deleted by
this surface.

## 2. Base URL and authentication

```
https://<your-gunderhouse-host>/api/legal
```

Every request needs a shared secret in a header:

```
X-Legal-Token: <the value of the LEGAL_TOKEN env var>
```

This is a **different secret from `ALFRED_TOKEN`**, on purpose: different
caller, different reach, and one leaking should not hand over the other. An
Alfred token presented here returns `401`.

| Status | Meaning |
| --- | --- |
| `401` | Missing or wrong token |
| `404` | No property matches the identifier given |
| `400` | The payload was malformed — the body says exactly what |
| `503` | `LEGAL_TOKEN` isn't configured on the server |

## 3. Conventions

- Money is **dollars** as a JSON number (`184000` = $184,000.00). Gunderhouse
  stores cents internally; the conversion happens at the boundary.
- Rates are **percent** as a number (`6.25` = 6.25%).
- Dates are `YYYY-MM-DD` strings. Anything else is a `400`.
- `null` means "not recorded" and never means zero.

## 4. `GET /api/legal/properties`

The list Legal needs in order to attach a matter to a property. Addresses are
included because a recorded instrument identifies real estate by address, not
by a database id.

```json
{
  "properties": [
    {
      "propertyId": "cms0abc123",
      "name": "Main House",
      "type": "PRIMARY_RESIDENCE",
      "address": {
        "line1": "114 Gunder Road",
        "line2": null,
        "city": "Huntsville",
        "state": "AL",
        "postalCode": "35801",
        "formatted": "114 Gunder Road, Huntsville, AL · 35801"
      },
      "purchasedOn": "2019-06-01",
      "currentValueUsd": 410000,
      "valuedOn": "2026-01-15",
      "valuationSource": "APPRAISAL",
      "totalOwedUsd": 184000,
      "grossEquityUsd": 226000
    }
  ]
}
```

`currentValueUsd` and `grossEquityUsd` are `null` when nothing has been valued.

## 5. `GET /api/legal/liens`

**Query params:** `property` — a property id or name. Optional; omit for all.

```json
{
  "generatedAt": "2026-09-06T23:40:00.000Z",
  "basis": "Equity is value less every open lien. …",
  "properties": [
    {
      "propertyId": "cms0abc123",
      "name": "Main House",
      "currentValueUsd": 410000,
      "unvalued": false,
      "totalOwedUsd": 204000,
      "grossEquityUsd": 206000,
      "ltvPercent": 49.76,
      "availableTodayUsd": 80000,
      "borrowingHeadroomUsd": 124000,
      "maxCombinedLtvPercent": 80,
      "liens": [
        {
          "id": "cms0lien01",
          "externalId": null,
          "source": "MANUAL",
          "type": "FIRST_MORTGAGE",
          "lender": "Regions Bank",
          "position": 1,
          "balanceUsd": 184000,
          "balanceAsOf": "2026-09-01",
          "creditLimitUsd": null,
          "interestRatePercent": 6.25,
          "monthlyPaymentUsd": 1420,
          "openedOn": null,
          "maturesOn": null,
          "closedOn": null
        }
      ]
    }
  ]
}
```

### The two availability figures are different kinds of money

This is the part worth getting right, because conflating them means counting
money that can't be reached:

- **`availableTodayUsd`** — the undrawn part of open credit lines. Spendable
  this afternoon. Nothing to apply for.
- **`borrowingHeadroomUsd`** — what a lender would likely still advance before
  hitting `maxCombinedLtvPercent`. Getting at it means originating a loan: an
  application, an appraisal, weeks.

**Never add them together.** A HELOC's drawn balance already counts against the
headroom, so summing them double-counts the same collateral.

When `unvalued` is `true` there is no valuation on file. `grossEquityUsd` and
`currentValueUsd` are `null`, and the headroom is `0` — say "the property
hasn't been valued", not "there's no equity".

## 6. `PUT /api/legal/liens`

Replaces the **full set** of Legal-owned liens for one property.

```json
{
  "propertyId": "cms0abc123",
  "liens": [
    {
      "externalId": "matter-001",
      "type": "SECOND_MORTGAGE",
      "lender": "Sunbelt Lending",
      "position": 2,
      "balanceUsd": 42000,
      "balanceAsOf": "2026-09-01",
      "monthlyPaymentUsd": 410,
      "interestRatePercent": 9.5,
      "originalAmountUsd": 50000,
      "creditLimitUsd": null,
      "openedOn": "2024-03-11",
      "maturesOn": "2039-03-11",
      "closedOn": null,
      "notes": "Recorded 2024-03-14, Book 4411 Page 220"
    }
  ]
}
```

**Required per lien:** `externalId`, `type`, `lender`, `balanceUsd`.
Everything else is optional and defaults to `null`.

**Response:**

```json
{
  "propertyId": "cms0abc123",
  "name": "Main House",
  "synced": 1,
  "released": 2,
  "equity": {
    "currentValueUsd": 410000,
    "unvalued": false,
    "totalOwedUsd": 226000,
    "grossEquityUsd": 184000,
    "availableTodayUsd": 0,
    "borrowingHeadroomUsd": 102000
  }
}
```

### How to use it

- **Send everything, every time.** This is a replace, not a patch. Any
  Legal-owned lien on that property *absent from the payload* is released —
  which is how a satisfied mortgage disappears without a delete call.
- **`externalId` is the key.** It's how a lien is matched on the next sync, so
  it must be stable and unique per instrument. A lien without one is rejected.
- **Send `"liens": []` to release everything** Legal holds on that property.
  Omitting the field entirely is a `400`, not an empty set — releasing every
  lien is too consequential to happen through a missing key.
- **It's idempotent.** Re-sending the same payload changes nothing and
  re-reports the same equity.
- **Manual liens are untouchable here.** Whatever the payload says, a
  hand-entered lien is never modified or deleted.
- Sending a lien for a property it wasn't previously on **moves it** to the new
  property, matched by `externalId`.

### Why this write isn't confirm-first

The Alfred surface requires a propose/confirm round-trip for its one write,
because an assistant is acting on something a person said out loud and may have
misheard. This is a system sync — an idempotent restatement of records Legal
already holds, keyed by Legal's own ids. Confirming every sync would make it
useless and would train someone to confirm without reading.

The safety comes from containment instead: the sync can only touch rows it
already owns, so the worst a wrong payload can do is corrupt Legal's own
records, which the next correct sync repairs.

## 7. Enum reference

**`type`** (lien) — `FIRST_MORTGAGE`, `SECOND_MORTGAGE`, `HELOC`,
`HOME_EQUITY_LOAN`, `TAX_LIEN`, `MECHANICS_LIEN`, `JUDGMENT`, `OTHER`

`HELOC` is the only type whose `creditLimitUsd` feeds `availableTodayUsd`. A
credit limit below the drawn balance is rejected.

**`source`** (lien) — `MANUAL`, `LEGAL`

**`valuationSource`** — `APPRAISAL`, `BROKER_OPINION`, `TAX_ASSESSMENT`,
`ONLINE_ESTIMATE`, `PURCHASE_PRICE`, `OWNER_ESTIMATE`

**`type`** (property) — `PRIMARY_RESIDENCE`, `RENTAL`

## 8. Worked examples

```bash
BASE=https://gunderhouse.up.railway.app/api/legal
TOKEN=$LEGAL_TOKEN

# Map matters to properties
curl -s -H "X-Legal-Token: $TOKEN" "$BASE/properties"

# What's on record for one property
curl -s -H "X-Legal-Token: $TOKEN" "$BASE/liens?property=Main%20House"

# Push the current set
curl -s -X PUT -H "X-Legal-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"propertyId":"cms0abc123","liens":[
        {"externalId":"matter-001","type":"SECOND_MORTGAGE",
         "lender":"Sunbelt Lending","balanceUsd":42000}]}' \
  "$BASE/liens"

# Release everything Legal holds on it
curl -s -X PUT -H "X-Legal-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"propertyId":"cms0abc123","liens":[]}' "$BASE/liens"
```

## 9. Not implemented

These do not exist. Calling them returns `404` or `405`.

- **No valuation write.** Legal reads what a property is worth; it doesn't set
  it. Valuations are recorded in Gunderhouse by a household admin.
- **No property creation or editing.** Homes are created in Gunderhouse.
- **No access to documents, maintenance, appliances, or the budget.** This
  surface is deliberately narrow: properties and the instruments against them,
  nothing else. The Alfred surface is separate and its token doesn't work here.
- **No per-lien delete.** Omit it from the next `PUT` instead.
