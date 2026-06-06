# PRODUCER-SETTINGS-1

> Extended by [PRODUCER-ONBOARDING-V2](../producer-onboarding/PRODUCER-ONBOARDING-V2.md):
> the "Region / Country / Altitude not asked at onboarding" gaps surfaced
> by the report below are now closed. Producer Settings remains the
> editor; onboarding captures the real values up front.

Producer settings drawer opened from the platform header settings icon.
Six soft cards on the right side of the screen: producer profile, farm
profile, farm media readiness, notifications, operations and support.
No schema changes — everything persisted reuses existing `User`,
`Producer` and `Farm` columns.

## Files changed

| File | Purpose |
|---|---|
| `src/services/producer-settings/producerSettings.pure.ts` | Pure validation, sanitisation, farm selection, readiness projection |
| `src/services/producer-settings/__tests__/producerSettings.test.ts` | 28 pure tests |
| `app/api/producer/settings/route.ts` | `GET` + `PATCH` |
| `src/components/shared/general/PlatformHeader.tsx` | Optional `onSettingsClick` prop on the existing settings icon |
| `app/platform/producer/ProducerView.tsx` | Drawer state + wires header click |
| `src/components/platform/producer/ProducerSettingsDrawer.tsx` | Drawer UI |
| `package.json` | Test glob includes producer-settings tests |
| `docs/producer-settings/PRODUCER-SETTINGS-1.md` | This document |

## Schema changes
**None.** Strictly reuses existing columns:

| UI field | Persisted on | Notes |
|---|---|---|
| Producer / company name | `Producer.name` | NOT NULL — empty input skipped |
| Contact person | `User.name` | nullable |
| Email | `User.email` | read-only (auth invariant) |
| Phone / WhatsApp | `User.phone` | nullable; empty string → `null` |
| Country | `Producer.country` | NOT NULL — empty input skipped |
| Preferred language | — | display-only, "English"; disabled |
| Farm name | `Farm.name` | NOT NULL — clearing is a no-op |
| Region | `Farm.region` | nullable |
| Altitude (m) | `Farm.altitude` | 0–3500 metres, integer |
| Notifications + operations | `localStorage` | server persistence ships later |

## API endpoints

### `GET /api/producer/settings`
Returns the authenticated producer's profile, farms list, the active
farm, current farm media readiness (producer-friendly copy) and the
notification/operational stubs. Supports `?farmId=` to scope readiness
to a specific farm.

```json
{
  "producerProfile": {
    "producerName": "Finca Demo S.A.",
    "contactName": "María González",
    "email": "producer@example.com",
    "phone": "+57 …",
    "country": "Colombia",
    "preferredLanguage": null
  },
  "farms": [{ "id": "…", "name": "…", "region": "…", "altitude": 1850 }],
  "activeFarmId": "…",
  "farmProfile": { "id": "…", "name": "…", "region": "…", "altitude": 1850 },
  "farmMediaReadiness": {
    "ready": true,
    "missingCount": 0,
    "headline": "Your farm is ready to publish lots.",
    "rows": [
      { "code": "PUBLIC_FARM_PHOTO", "label": "Farm / origin photo", "description": "…", "ready": true },
      { "code": "PUBLIC_PROCESS_OR_PRODUCT_PHOTO", "label": "Process or product photo", "description": "…", "ready": true },
      { "code": "PUBLIC_PRODUCER_PHOTO", "label": "Producer / team photo", "description": "…", "ready": false }
    ]
  },
  "notificationPreferences": {},
  "operationalPreferences": {},
  "support": { "originManagerEmail": "support@alturacollective.com" }
}
```

### `PATCH /api/producer/settings`
Partial update — only supplied sections are written. Sanitised by
`validateProducerSettingsPatch`. Cross-account writes are blocked: the
farm being updated must belong to the authenticated producer (404 if
missing, 403 if owned by another producer).

Returns the freshly loaded GET payload so the drawer can render the
saved state without a second round-trip.

Status codes: `200` on success, `400` invalid input, `401`
unauthenticated, `403` non-producer / cross-farm, `404` no producer
profile or farm.

## Settings drawer UX
- Right-side drawer, ≤ 480px wide on desktop, full-width on mobile.
- Overlay click + Escape both close.
- Six cards in order. Each card has an eyebrow + serif title + muted
  description, with the inputs underneath in the dark coffee palette
  used by the rest of the producer surface.
- A floating save bar pinned to the bottom of the drawer shows the
  saved state and the **Save changes** button.
- "Saved · settings up to date" message clears itself after 2.4s.
- The media readiness card never renders enum names. The
  "Manage farm media" CTA links to `/platform/producer/media`.
- If the producer has more than one farm, a farm selector card appears
  at the top and switching it reloads the relevant farm profile +
  readiness.

## Notifications + operations
Stored in `localStorage` only:

| Key | Shape |
|---|---|
| `producerSettings.notifications` | `{ sampleRequested, reviewUpdates, decisionUpdates, salesUpdates, channelEmail, channelWhatsApp }` |
| `producerSettings.operations` | `{ preferredContact, pickupAddress, preferredPickupDays, logisticsContact }` |

Copy explicitly says: *"Saved in your browser for now. Server-side
delivery is coming soon."* — so we don't promise something the backend
doesn't deliver.

## Tests
28 pure tests under `src/services/producer-settings/__tests__/`
covering: empty patch, trim / null-coerce, length caps, unknown root
section rejection, farmId requirement, no-op clearing of NOT-NULL
columns, partial PATCH, phone sanitisation (valid format, junk reject,
empty → null), altitude sanitisation (range, rounding, null clear),
farm selection (empty / requested / fallback), readiness projection
(ready / pluralised / singular / no enum names / known-code labels).

Project-wide totals after this sprint: **724 / 724 pass**, tsc clean.

## Manual validation
1. Log in as a producer with `onboardingCompleted = true`.
2. Open `/platform/producer`.
3. Click the gold settings icon in the header → drawer slides in.
4. Verify the cards render with the dashboard palette (no white admin
   chrome).
5. Edit contact person, phone, region, altitude — click **Save changes**
   → "Saved · settings up to date" appears.
6. Refresh the page, reopen the drawer → fields hold the persisted
   values.
7. With a farm that has no media, the readiness card shows two missing
   items and a `1 / 2 items missing before your next lot can be
   published.` headline.
8. Click **Manage farm media** → routes to `/platform/producer/media`.
9. Add the missing FARM + PROCESS photos, return to settings → headline
   flips to "Your farm is ready to publish lots."
10. Toggle a notification + change preferred contact → close + reopen
    drawer → values persist (localStorage).
11. `curl /api/producer/settings` without auth → 401. As BUYER → 403.
12. Try a `PATCH` with `farmProfile.farmId` of another producer's farm
    → 403 with "You can only update your own farms."
13. Mobile viewport: drawer fills the screen; save bar remains pinned;
    overlay still closes.

## Farm profile completion report

> Snapshot of which fields are persisted today vs. asked from the
> producer at onboarding vs. used by publish/readiness. Use this when
> deciding whether a future sprint should widen the schema.

| Field | Existing source / model | Editable now? | Asked at onboarding? | Used for publish / readiness? | Recommendation |
|---|---|---|---|---|---|
| Farm name | `Farm.name` (NOT NULL) | Yes (settings + onboarding) | Yes (`businessName` → Farm name) | Indirect — required to attach lots | OK |
| Region | `Farm.region` | Yes (settings) | **No** — onboarding never writes it | No | Wire onboarding step or settings nudge |
| Country | `Producer.country` (NOT NULL, default `COLOMBIA`) | Yes (settings) | Defaulted, not asked | No | Add an onboarding country picker |
| Altitude | `Farm.altitude` | Yes (settings) | Hard-coded to `1800` at onboarding | Hard requirement at `verifyLotService` | Asked from producer in settings; add to onboarding |
| Farm story / description | `FarmStory.content` (separate model, AI/manual) | **Not** in this drawer | No | No (display only) | Future sprint — could surface a short story field directly on Farm |
| Main varieties | — | **Not in schema** | No | No | Not blocking. Could become a `String[]` on Farm if catalog filters need it |
| Main processes | — | **Not in schema** | No | No | Same as above |
| Farm / origin photo | `FarmMedia` (role `FARM`, visibility `PUBLIC_MARKET`) | Manage page only | No | **Required before publish** | Already wired (PARTNER-MEDIA-2A) |
| Process photo | `FarmMedia` / `GreenLotMedia` (role `PROCESS` or `PRODUCT_DETAIL`, PUBLIC) | Manage page only | No | **Required before publish** | Already wired |
| Pickup address | — | Local-only (operations card) | Onboarding writes `Company.address` for buyers, not producers | No | Future: persist on `Producer` or a new operations table |
| Producer / company name | `Producer.name` (NOT NULL, defaults to `User.name`) | Yes (settings) | Defaulted from `User.name` | No | Asked from producer in settings |
| Contact person | `User.name` | Yes (settings) | Onboarding writes `Company.contactName` for buyer flow only | No | Producer flow now uses `User.name` directly |
| Email | `User.email` | Read-only | Yes (signup) | No (auth invariant) | OK |
| Phone / WhatsApp | `User.phone` | Yes (settings) | Yes (signup) | No | OK |
| Preferred language | — | Display-only ("English") | No | No | Add `Producer.preferredLanguage String?` once translations land |
| Notification preferences | `localStorage` | Yes (browser only) | No | No | Future: `Producer.notificationPreferences Json?` once server delivery exists |
| Preferred contact method | `localStorage` (operations card) | Yes (browser only) | No | No | Future: persist alongside notification prefs |
| Logistics / export contact | `localStorage` (operations card) | Yes (browser only) | No | No | Future |

**Highlights for product:**
- Onboarding never asks the producer for **region** or **real altitude**, but the
  verification flow needs altitude to price the lot. Today the
  defaulted `1800m` is what every dev/seed lot uses. A small onboarding
  upgrade would materially improve pricing realism.
- **Farm story**, **main varieties** and **main processes** are clearly
  useful for the catalog narrative but currently unsupported by the
  schema. None block publishing.
- **Pickup address** and the rest of the operations card are
  intentionally browser-only — see "Recommended next sprint" below for
  the persistence path.

## Known limitations
- No schema changes — preferred language, notification + operational
  preferences are not persisted server-side.
- No upload UI inside the drawer; the media card always deep-links to
  `/platform/producer/media`.
- Email is read-only; account changes still require support.
- Multi-farm UX is intentionally minimal — a simple `<select>`. No
  per-farm story / variety / process editing yet.
- Producer story (`FarmStory`) is not exposed here — it stays in the
  existing dashboard "Tell the story behind your coffee" surface.
- The `/api/supply` + `/api/partner/export-ready` static-export errors
  at build time are pre-existing artefacts from a separate Prisma-mode
  issue and are unaffected by this sprint.

## Recommended next sprint
- **PRODUCER-ONBOARDING-V2** — capture **real altitude**, **region**
  and **country** at producer onboarding so the verification flow has
  honest data on day one. Settings keeps existing as the editor.
- **PRODUCER-PREFS-PERSIST-1** — add `Producer.notificationPreferences
  Json?` + `Producer.operationalPreferences Json?` columns and migrate
  the localStorage values to the server.
- Or proceed straight to **CONTRACT-REQUEST-1** if the producer
  profile gaps above are acceptable for now.
