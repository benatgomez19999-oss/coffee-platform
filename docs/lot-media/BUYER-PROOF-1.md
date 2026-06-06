# BUYER-PROOF-1

> Extended by [BUYER-PROOF-2B](./BUYER-PROOF-2B.md) — wires the
> `SHIPMENT_READY` branch of `evaluateBuyerProofMediaReadiness` into
> `createShipment`, so no production shipment can be created for a lot
> that lacks verified buyer-private traceability proof. This is the
> producer-side enforcement that makes BUYER-PROOF-1's visibility
> boundary load-bearing.

Authorized buyer-proof media endpoint and contract proof panel.
Extends [STORAGE-MEDIA-1](./STORAGE-MEDIA-1.md) with a **two-bucket
storage model** (public marketplace media + private buyer proof /
internal ops media) and exposes a `GET /api/contracts/[contractId]/proof-media`
endpoint that returns short-lived **signed read URLs** to the contract's
authorised audience (CLIENT / PARTNER / PRODUCER).

## 1. Summary

- **Two Supabase Storage buckets** instead of one:
  - `lot-media-public` — `PUBLIC_MARKET` media (marketplace, catalog).
    Rows persist a CDN URL on `FarmMedia.url` / `GreenLotMedia.url`.
  - `lot-media-private` — `BUYER_PRIVATE` + `INTERNAL_ONLY` media
    (traceability bags, certificates, internal docs). Rows persist
    a `supabase://<bucket>/<path>` reference instead of a public URL.
    The proof endpoint signs a fresh read URL on every call.
- New pure helpers:
  - `resolveLotMediaBucketForVisibility(visibility, config)` —
    pure visibility → bucket-kind resolver.
  - `buildLotMediaStorageReference` / `parseLotMediaStorageReference` /
    `isLotMediaStorageReference` — serialise + parse `supabase://`
    references with a strict character set + traversal guard.
  - `filterMediaForContractProofAudience` — audience filter
    (`BUYER` / `PARTNER` / `PRODUCER`).
  - `buildBuyerProofMediaSummary` — compact summary
    (`hasTraceabilityProof`, `hasCertificate`, `missing`).
- New service surface:
  - `createLotMediaSignedReadUrl({ bucket, storagePath, expiresInSeconds })`
    on `lotMediaStorage.service` returns a short-lived
    `signedUrl` for a private storage reference.
  - `isLotMediaStorageConfigured()` lets the route layer surface a
    clean "not configured" hint without trying to sign.
- New endpoint: `GET /api/contracts/[contractId]/proof-media`.
- New buyer surface:
  `src/components/platform/client/ContractProofMediaPanel.tsx`,
  expandable per-contract in `SupplyContractsPanel`.
- Producer UI now persists `storageReference` (not a public URL) when
  the signing endpoint returns a `PRIVATE` upload, and renders a lock
  affordance instead of `<img>` for `supabase://` rows in the list view.
- 27 new pure tests; full project suite 848 / 848 green; tsc clean;
  `next build` clean.
- **No schema changes.** No migration.

## 2. Bucket model

| Visibility | Bucket | Persisted `url` | Buyer sees |
|---|---|---|---|
| `PUBLIC_MARKET` | `lot-media-public`  | CDN URL (https://…) | yes |
| `BUYER_PRIVATE` | `lot-media-private` | `supabase://lot-media-private/<path>` | yes (via signed URL) |
| `INTERNAL_ONLY` | `lot-media-private` | `supabase://lot-media-private/<path>` | no |

Bucket resolution lives in
[`resolveLotMediaBucketForVisibility`](../../src/services/lot-media/lotMediaStorage.pure.ts).
The service injects the env-resolved bucket config so the pure layer
stays deterministic and testable.

### Env

```
SUPABASE_LOT_MEDIA_PUBLIC_BUCKET   # default "lot-media-public"
SUPABASE_LOT_MEDIA_PRIVATE_BUCKET  # default "lot-media-private"
SUPABASE_LOT_MEDIA_BUCKET          # legacy alias — used as public if *_PUBLIC_BUCKET is unset
```

## 3. Storage reference

Private rows persist a URI rather than a public URL because public-URL
access to the private bucket is blocked. The reference is the only
way the proof endpoint can find the object later.

```
supabase://lot-media-private/lot/<lotId>/traceability_bag/<uuid>.jpg
```

Safety:

- Bucket regex `^[A-Za-z0-9][A-Za-z0-9_-]{1,62}$` (matches Supabase
  bucket naming).
- Storage path regex `^[A-Za-z0-9][A-Za-z0-9._/-]{1,240}[A-Za-z0-9]$`,
  no `..` or `//` segments.
- The same rules are inlined into [`validateLotMediaUrl`](../../src/services/lot-media/lotMedia.pure.ts)
  so a producer pasting an arbitrary `supabase://` URL through the
  create-media endpoint cannot smuggle traversal sequences.

## 4. The proof endpoint

`GET /api/contracts/[contractId]/proof-media`

Auth matrix:

| Caller | Allowed when | Visibility filter |
|---|---|---|
| `CLIENT` | `user.companyId === contract.companyId` | `PUBLIC_MARKET` + `BUYER_PRIVATE` |
| `PARTNER` / `ADMIN` | always | all |
| `PRODUCER` | `greenLot.farm.producer.userId === user.id` | all |

Response shape:

```ts
{
  contractId: string
  greenLotId: string | null
  generatedAt: string         // ISO timestamp
  audience: "BUYER" | "PARTNER" | "PRODUCER"
  storageConfigured: boolean
  media: Array<{
    id: string
    role: LotMediaRole
    roleLabel: string         // human label, e.g. "Traceability proof"
    source: LotMediaSource
    visibility: LotMediaVisibility
    owner: "LOT" | "FARM"
    position: number
    isPrimary: boolean
    altText: string | null
    caption: string | null
    credit: string | null
    resolvedUrl: string | null
    signed: boolean
    expiresInSeconds: number | null
    signError?: string
  }>
  summary: {
    hasTraceabilityProof: boolean
    hasCertificate: boolean
    hasFinalBagPhoto: null    // populated by BUYER-PROOF-2
    itemCount: number
    missing: Array<"TRACEABILITY_PROOF" | "CERTIFICATE">
  }
}
```

Public-bucket rows pass their stored URL through unchanged. Private
references are re-signed on every call — there is no caching layer.
Signing failures land in `signError` so the panel can render a
"couldn't load" tile without breaking the rest of the response.

## 5. Buyer panel

[`ContractProofMediaPanel`](../../src/components/platform/client/ContractProofMediaPanel.tsx)
fetches the endpoint above and renders a grid of proof tiles, with:

- A "Waiting on …" hint when `summary.missing` is non-empty
  (BUYER audience only).
- A dashed-border "Final export bag — Coming soon" placeholder tile
  (BUYER audience only).
- A `Private` badge over private-bucket tiles.
- A graceful "Image unavailable" body when signing failed.

Wired into [`SupplyContractsPanel`](../../src/components/platform/client/SupplyContractsPanel.tsx)
as an expandable "View proof" affordance on each active contract row.

## 6. Producer UI tweaks

- `/platform/producer/media` upload flow now reads `sign.bucketKind`
  from the response. When `PRIVATE`, it POSTs the storage
  reference (`supabase://…`) to the create-media endpoint instead of
  a `publicUrl` (the field is `null` for private uploads).
- The list view renders a lock icon (instead of `<img>`) for rows
  whose `url` starts with `supabase://`, and displays
  "Stored privately in Supabase" as the row caption.

## 7. Out of scope for this sprint

- **Shipment-guard wiring.** `hasFinalBagPhoto` is intentionally `null`.
  The shipment readiness check that blocks dispatch on missing proof
  moves into BUYER-PROOF-2.
- **Schema changes.** `FarmMedia.url` and `GreenLotMedia.url` continue
  to hold both public URLs and `supabase://` references. We will not
  split them into a separate column until there is downstream pressure
  to.
- **Audit logging.** Signed-read URL generation is not yet recorded;
  add when a future compliance review needs it.

## 8. Files changed / added

| File | Purpose |
|---|---|
| `src/services/lot-media/lotMediaStorage.types.ts` | Two-bucket constants, `bucketKind` + `storageReference` on the signed-upload response. |
| `src/services/lot-media/lotMediaStorage.pure.ts` | `resolveLotMediaBucketForVisibility`, reference serialiser/parser. |
| `src/services/lot-media/lotMediaStorage.service.ts` | Dual-bucket env reads, bucket routing in `createLotMediaSignedUpload`, new `createLotMediaSignedReadUrl`, `isLotMediaStorageConfigured`, `getLotMediaBucketConfig`. |
| `src/services/lot-media/lotMedia.pure.ts` | `validateLotMediaUrl` accepts safe `supabase://` references (inlined to avoid circular import). |
| `src/services/lot-media/buyerProofMedia.pure.ts` | NEW — audience filter + proof summary + role labels. |
| `app/api/contracts/[contractId]/proof-media/route.ts` | NEW — authorised proof endpoint. |
| `src/components/platform/client/ContractProofMediaPanel.tsx` | NEW — buyer-facing proof panel. |
| `src/components/platform/client/SupplyContractsPanel.tsx` | Expandable "View proof" hook on each active row. |
| `app/platform/producer/media/page.tsx` | Persist `storageReference` for private uploads; lock affordance + private-row caption in the list view. |
| `src/services/lot-media/__tests__/buyerProofMedia.test.ts` | NEW — 27 tests covering filter / summary / bucket resolution / reference round-trip. |

## 9. Tests

```
npx tsc --noEmit              # clean
npm run test:allocation       # 848 / 848 pass
npm run build                 # clean
```

## 10. Related sprints

- [STORAGE-MEDIA-1](./STORAGE-MEDIA-1.md) — single-bucket signed uploads.
  Legacy `SUPABASE_LOT_MEDIA_BUCKET` env still works as a public-bucket
  fallback.
- [LOT-MEDIA-2](./LOT-MEDIA-2.md) — introduced `LotMediaVisibility`
  (`PUBLIC_MARKET` / `BUYER_PRIVATE` / `INTERNAL_ONLY`). This sprint
  is what turns the `BUYER_PRIVATE` visibility into a real, enforced
  boundary at the storage layer.
- [PARTNER-MEDIA-2A](./PARTNER-MEDIA-2A.md) — producer media wizard.
  Now stores `supabase://` references for private uploads.
- BUYER-PROOF-2 (planned) — shipment readiness guard, final export
  bag photo role, audit log for signed-read URLs.
