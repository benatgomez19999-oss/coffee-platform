# PRODUCER-ONBOARDING-V2

Capture real farm region, country and altitude during producer
onboarding. Closes the biggest data-honesty gap surfaced by
[PRODUCER-SETTINGS-1](../producer-settings/PRODUCER-SETTINGS-1.md):

- Onboarding hard-coded `altitude = 1800` and silently defaulted
  `country = "COLOMBIA"`. Both went straight into the pricing /
  marketplace pipeline.
- Region was collected by the address autofill but never sent through
  to the server.

This sprint asks for the three fields, validates them with the same
range as Producer Settings, and persists them to existing columns. No
schema changes.

## Files changed

| File | Purpose |
|---|---|
| `src/services/producer-onboarding/producerOnboarding.pure.ts` | **New** — sanitisation + validation, reuses producer-settings altitude rules |
| `src/services/producer-onboarding/__tests__/producerOnboarding.test.ts` | **New** — 26 pure tests |
| `app/api/onboarding/producer/route.ts` | Now validates region / country / altitude, persists Farm.region + Farm.altitude (real values), idempotent re-runs update existing rows |
| `app/onboarding/profile/page.tsx` | Adds the `altitude` form field for the PRODUCER branch, splits the country select into buyer vs producer lists, ISO map for PhoneInput, producer-friendly region placeholder |
| `package.json` | Test glob picks up the new onboarding test folder |
| `docs/producer-onboarding/PRODUCER-ONBOARDING-V2.md` | This document |

## Schema changes
**None.** Strictly reuses `Producer.country`, `Farm.region`, `Farm.altitude`.

## Onboarding fields added

| Field | UI surface | Persisted on |
|---|---|---|
| Country | Step 1 — producer-specific country `<Select>` (17 coffee-producing origins) | `Producer.country` |
| Farm region | Step 2 — text input (auto-fillable via Google Places, editable) | `Farm.region` |
| Farm altitude (m) | Step 2 — numeric input shown only for the PRODUCER branch | `Farm.altitude` |

The producer-side country list was added explicitly because the legacy
list (`ES / US / GB / FR / IT / DE`) had no coffee origins at all.
Buyers keep the legacy list unchanged.

For PhoneInput, the producer flow uses an ISO-code lookup
(`PRODUCER_COUNTRY_ISO`) so the country flag still works while the
canonical persisted value remains the country *name* used by the
marketplace tone table and dev seeds.

## API / data mapping

`POST /api/onboarding/producer`

Required body fields:

| Body | Persisted on | Notes |
|---|---|---|
| `businessName` | `Producer.name` + `Farm.name` | Required, ≤ 120 chars |
| `country` | `Producer.country` | Required, free text on the server (UI offers a select), ≤ 64 chars |
| `region` | `Farm.region` | Required, ≤ 120 chars |
| `altitude` | `Farm.altitude` | Required, 0–3500 m, integer (number or numeric string) |
| `contactName` | `User.name` | Optional, ≤ 120 chars |

Idempotency:
- Re-running with the same `businessName` updates the existing farm's
  `region` + `altitude` (so producers can correct mistakes themselves).
- `Producer.name` + `Producer.country` are updated on re-run if the
  new input differs.
- `User.name` is only overwritten if `contactName` is supplied (avoids
  stomping a value the producer set later in settings).

Error shape on validation failure:
```json
{ "code": "ALTITUDE_REQUIRED", "error": "Farm altitude is required." }
```

Status: `400` for invalid input, `401` unauth, `400` (legacy) for
non-PRODUCER, `500` on transaction failure.

## Validation rules

| Field | Rule |
|---|---|
| `businessName` | Required, trimmed, ≤ `BUSINESS_NAME_MAX` (120) |
| `country` | Required, trimmed, clamped to ≤ `COUNTRY_MAX` (64) |
| `region` | Required, trimmed, clamped to ≤ `FARM_REGION_MAX` (120) |
| `altitude` | Required, finite number (number **or** numeric string), `MIN_ALTITUDE_M` (0) – `MAX_ALTITUDE_M` (3500), rounded to integer |
| `contactName` | Optional, trimmed, ≤ `CONTACT_NAME_MAX` (120) |

The altitude validator imports `sanitiseAltitude` directly from
`producer-settings/producerSettings.pure` — tests pin that the two
validators stay in sync on the range so the settings editor and the
onboarding form can never accept different values.

`validateFarmAltitude` differs from `sanitiseAltitude` only in that it
treats `undefined / null / ""` as `ALTITUDE_REQUIRED` (settings allows
clearing).

## Settings consistency

- Producer Settings drawer already reads/writes `Farm.region`,
  `Farm.altitude` and `Producer.country`. After onboarding, those
  fields contain the producer's real input — no migration step needed.
- Both surfaces share the same altitude range (0–3500 m) and length
  caps. Tests assert this explicitly.
- Settings drawer doc updated accordingly (the farm-profile completion
  report no longer flags region/country/altitude as "not asked at
  onboarding" — see below).

## Tests added

**26 new pure tests** in `src/services/producer-onboarding/__tests__/`:

- `sanitiseProducerOnboardingInput` (15): trims + accepts; rejects
  missing businessName / country / region / altitude; rejects altitude
  as `""`, non-numeric, NaN, ±Infinity, below range, above range;
  accepts numeric string; clamps overlong region / country; rejects
  overlong businessName; preserves null contactName; **asserts no
  "1800" leaks into any error message**.
- `validateFarmAltitude` (4): number, numeric string, undefined →
  `ALTITUDE_REQUIRED`, out-of-range → `ALTITUDE_INVALID`.
- Consistency (2): cross-checks `validateFarmAltitude` against
  `sanitiseAltitude` from producer-settings for accept + reject parity.
- `sanitiseFarmRegion` + `sanitiseProducerCountry` (5): empty + null +
  trim semantics.

Project-wide totals after this sprint: **750 / 750 pass**, tsc clean,
build EXIT=0.

API/route integration tests: not added — repo still has no Prisma test
harness for HTTP routes. Documented as a sprint limitation.

## Commands run

- `npx tsc --noEmit` ✅ clean
- `npm run test:allocation` ✅ 750/750
- `npm run build` ✅ EXIT=0

No prisma generate / migration needed.

## Manual validation

1. Reset a dev producer: `UPDATE "User" SET "onboardingCompleted" = false
   WHERE email = '<producer email>'` (or sign up a fresh one).
2. Log in → automatically redirected to `/onboarding/role` → continue
   to `/onboarding/profile`.
3. **Step 1**: confirm the country `<Select>` shows coffee origins
   (Colombia, Brazil, Ethiopia, …). Phone input flag updates to match.
4. **Step 2**:
   - Region input shows the producer-friendly placeholder
     `Farm region (e.g. Huila, Antioquia)`.
   - A new numeric input appears: "Farm altitude in metres
     (e.g. 1850)" plus the helper copy.
   - Postal Code input is hidden for producers.
5. Try to **Finish** without altitude — alert reads
   "Farm altitude is required." (returned by the server).
6. Try altitude `7000` — alert reads "Farm altitude must be a number
   between 0 and 3500 metres."
7. Submit with: country = Colombia, region = Nariño, altitude = 2050.
   Redirected to `/platform/producer`.
8. Open Settings drawer → Farm profile card shows
   `Nariño / 2050` and the producer profile card shows country
   `Colombia`. No `1800` anywhere.
9. Create a draft lot, send to lab, and have it verified
   (or run `verifyLotService` directly) — pricing should use the real
   altitude.
10. `/api/marketplace/lots` returns the lot with `altitude: 2050`.
11. Re-run onboarding (e.g. by toggling `onboardingCompleted` back to
    false and changing the farm altitude to `1920`). Refresh the
    settings drawer → altitude has been corrected, the producer row
    was not duplicated.
12. Buyer onboarding still works: country select shows EU/US/UK, no
    altitude prompt, /api/company/update flow untouched.

## Updated farm profile completion report

| Field | Source / model | Editable now? | **Asked at onboarding?** | Used for publish / readiness? | Recommendation |
|---|---|---|---|---|---|
| Farm name | `Farm.name` (NOT NULL) | Yes (settings + onboarding) | Yes (`businessName` → Farm.name) | Indirect | OK |
| Region | `Farm.region` | Yes (settings) | **Yes — required (this sprint)** | No | OK |
| Country | `Producer.country` | Yes (settings) | **Yes — producer-specific list (this sprint)** | No | OK |
| Altitude | `Farm.altitude` | Yes (settings) | **Yes — required (this sprint, range 0–3500m)** | Required at `verifyLotService` | OK |
| Farm story / description | `FarmStory.content` | No (separate dashboard) | No | No | Future: surface in settings |
| Main varieties | — | **Not in schema** | No | No | Future: `String[]` if catalog filters need it |
| Main processes | — | **Not in schema** | No | No | Same |
| Farm / origin photo | `FarmMedia` (`FARM`, PUBLIC) | `/platform/producer/media` | No | **Required before publish** | Wired in PARTNER-MEDIA-2A |
| Process photo | `FarmMedia` / `GreenLotMedia` (`PROCESS` or `PRODUCT_DETAIL`, PUBLIC) | Same | No | **Required before publish** | Wired |
| Pickup address | — | Local-only | No | No | Future column |
| Producer / company name | `Producer.name` (NOT NULL) | Yes (settings) | Yes | No | OK |
| Contact person | `User.name` | Yes (settings) | Yes (optional) | No | OK |
| Email | `User.email` | Read-only | Yes (signup) | No | OK |
| Phone / WhatsApp | `User.phone` | Yes (settings) | Yes (signup) | No | OK |
| Preferred language | — | Display-only | No | No | Future column |
| Notification preferences | `localStorage` | Yes (browser) | No | No | Future column |
| Preferred contact method | `localStorage` | Yes (browser) | No | No | Future column |
| Logistics / export contact | `localStorage` | Yes (browser) | No | No | Future column |

Net result: every column the **pricing + publish pipeline** depends on
is now collected at onboarding from real producer input. The remaining
"future" gaps are storytelling / preference fields — none of them
block lot creation.

## Known limitations

- **Existing producers keep their previously-hardcoded altitude (1800)
  and default country until they edit those values in Producer
  Settings.** No backfill — that would silently rewrite producer data.
- No farm story / main varieties / main processes yet (no schema).
- No onboarding media upload (still handled by
  `/platform/producer/media` post-onboarding).
- No geocoding / GPS — region remains a string the producer types or
  auto-fills from Google Places.
- Country select is fixed-list. A producer in a country we did not
  list cannot submit through the UI today; the API would accept free
  text but the form doesn't expose it.
- No integration tests for the onboarding HTTP route — pure helper
  coverage is comprehensive (26 tests) but the request → DB path is
  only covered by manual validation.

## Recommended next sprint

- **CONTRACT-REQUEST-0 audit** or **CONTRACT-REQUEST-1** — onboarding
  data is honest now; the next major operational gap is wiring the
  "Configure monthly supply" CTA from the client dashboard to a real
  contract-request flow.
- Optional smaller win: **PRODUCER-ONBOARDING-V2.1** — let producers
  type a custom country if their origin is outside the dropdown, and
  surface the same select inside the settings drawer for consistency.
