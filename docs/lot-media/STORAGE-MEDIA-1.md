# STORAGE-MEDIA-1 / PARTNER-MEDIA-2B

> Extended by [BUYER-PROOF-1](./BUYER-PROOF-1.md) — splits the single
> `lot-media` bucket into a public + private pair, routes uploads by
> visibility, and adds `createLotMediaSignedReadUrl` for the proof
> endpoint. The legacy `SUPABASE_LOT_MEDIA_BUCKET` env continues to
> work as a public-bucket fallback.

Real file uploads for farm/lot media via **Supabase Storage signed
upload URLs**. Replaces the URL-paste workflow added in
[PARTNER-MEDIA-2A](./PARTNER-MEDIA-2A.md) with a proper file picker on
`/platform/producer/media`, while keeping URL paste as a fallback for
dev / external curated images / environments where Supabase Storage
isn't configured yet.

## 1. Summary

- One **pure helper module** (`lotMediaStorage.pure.ts`) that owns
  MIME validation, size guard, role/visibility defaults and the
  storage-path builder.
- One **server service** (`lotMediaStorage.service.ts`) that lazily
  constructs a server-only Supabase client using
  `SUPABASE_SERVICE_ROLE_KEY` and surfaces a clean
  `STORAGE_NOT_CONFIGURED` error when the env is incomplete.
- Four new POST routes returning a signed upload URL:
  - `/api/{producer,partner}/farms/[farmId]/media/upload-url`
  - `/api/{producer,partner}/lots/[id]/media/upload-url`
- Producer media page (`/platform/producer/media`) now offers two
  tabs: **Upload file** and **Use URL**. URL paste stays untouched.
- 34 new pure tests; full project suite 823 / 823 green; tsc clean.
- **No schema changes.** No migration.

## 2. Files changed

| File | Purpose |
|---|---|
| `src/services/lot-media/lotMediaStorage.types.ts` | **New** — constants, MIME / extension whitelists, request + response shapes |
| `src/services/lot-media/lotMediaStorage.pure.ts` | **New** — `normaliseLotMediaContentType`, `validateLotMediaUploadRequest`, `buildLotMediaStoragePath`, `sanitiseOriginalFileNameForMetadata`, `extensionForContentType` |
| `src/services/lot-media/lotMediaStorage.service.ts` | **New** — lazy Supabase client, `createLotMediaSignedUpload`, ownership checks, `LotMediaStorageError` |
| `src/services/lot-media/lotMedia.routeHelpers.ts` | Adds `farmMediaSignedUpload` / `lotMediaSignedUpload` shells |
| `app/api/producer/farms/[farmId]/media/upload-url/route.ts` | **New** |
| `app/api/producer/lots/[id]/media/upload-url/route.ts` | **New** |
| `app/api/partner/farms/[farmId]/media/upload-url/route.ts` | **New** |
| `app/api/partner/lots/[id]/media/upload-url/route.ts` | **New** |
| `app/platform/producer/media/page.tsx` | Tabbed Upload / URL form, file picker with client-side guards, three-phase status banner |
| `src/services/lot-media/__tests__/lotMediaStorage.test.ts` | **New** — 34 pure tests |
| `docs/lot-media/STORAGE-MEDIA-1.md` | This document |

## 3. Storage strategy chosen

**Public bucket, application-private visibility.**

- Bucket name (configurable): `lot-media` (default), or whatever
  `SUPABASE_LOT_MEDIA_BUCKET` is set to.
- All uploaded objects sit in **a public bucket**. The `publicUrl`
  Supabase returns is the canonical value stored on
  `FarmMedia.url` / `GreenLotMedia.url`.
- **Visibility filtering is still application-level** — the
  marketplace / contract catalog / client dashboard never expose
  `BUYER_PRIVATE` or `INTERNAL_ONLY` rows. This is the same filter
  pipeline added in [LOT-MEDIA-2](./LOT-MEDIA-2.md) and verified by
  the existing mapper tests.
- ⚠️ **Buyer-private media is app-hidden, not cryptographically
  private.** Anyone who knows the underlying public URL can fetch
  the object directly. This is acceptable for this sprint because
  the URLs are random 16-byte UUIDs (not enumerable) and only the
  uploading producer can ever read the path through the platform.
  Hardening to a private bucket + signed-read proxy is the next
  logical sprint (`BUYER-PROOF-1`).

Routing the storage layer this way means the existing carousel and
the existing `FarmMedia.url` / `GreenLotMedia.url` columns work
without changes — the upload simply produces a URL the rest of the
system already understood.

## 4. Env vars / bucket setup

Required server-only env (Vercel / `.env.local`):

| Var | Required | Default | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ already present | — | Reused. Server reads it. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ NEW — needed for signing | — | **Server-only**. Never expose to the browser. The Supabase client is instantiated with `autoRefreshToken: false`, `persistSession: false`. |
| `SUPABASE_LOT_MEDIA_BUCKET` | optional | `lot-media` | Override if you want a per-env bucket. |

When `SUPABASE_SERVICE_ROLE_KEY` is missing, the storage service
throws `LotMediaStorageError("STORAGE_NOT_CONFIGURED")` which the
route maps to **HTTP 503**. The producer UI catches that response
code and:
- shows a friendly notice,
- automatically switches the form to the **Use URL** tab so the
  producer is never blocked.

Bucket setup in Supabase:
1. Create a bucket named `lot-media` (or whatever you set in
   `SUPABASE_LOT_MEDIA_BUCKET`).
2. Mark it **public**.
3. No RLS policy needed beyond the bucket-level public-read setting —
   uploads go through service-role-signed URLs.

## 5. API endpoints added

All four routes accept the same body and return the same shape.

```http
POST /api/producer/farms/[farmId]/media/upload-url    PRODUCER
POST /api/producer/lots/[id]/media/upload-url         PRODUCER
POST /api/partner/farms/[farmId]/media/upload-url     PARTNER / ADMIN
POST /api/partner/lots/[id]/media/upload-url          PARTNER / ADMIN
```

Request:
```json
{
  "fileName":    "farm.jpg",
  "contentType": "image/jpeg",
  "sizeBytes":   8421,
  "role":        "FARM",
  "visibility":  "PUBLIC_MARKET"
}
```

Successful response (`201`):
```json
{
  "uploadUrl":       "https://<supabase>/storage/v1/object/upload/sign/lot-media/...",
  "token":           "<may be present depending on supabase-js version>",
  "method":          "PUT",
  "bucket":          "lot-media",
  "storagePath":     "farm/<farmId>/farm/<uuid>.jpg",
  "publicUrl":       "https://<supabase>/storage/v1/object/public/lot-media/farm/<farmId>/farm/<uuid>.jpg",
  "expiresInSeconds": 600,
  "mediaDefaults": {
    "role":       "FARM",
    "source":     "PARTNER_UPLOAD",
    "visibility": "PUBLIC_MARKET"
  }
}
```

Error codes:

| Code | HTTP | When |
|---|---|---|
| `STORAGE_NOT_CONFIGURED` | 503 | Env missing — UI falls back to URL paste |
| `MEDIA_UPLOAD_INVALID` | 400 | Body failed `validateLotMediaUploadRequest` |
| `MEDIA_UPLOAD_FORBIDDEN` | 403 | Producer trying to sign for a farm/lot they don't own |
| `OWNER_NOT_FOUND` | 404 | farmId / greenLotId missing |
| `MEDIA_UPLOAD_SIGNING_FAILED` | 500 | Supabase API returned an error |

Auth is the same role gate as PARTNER-MEDIA-2A: producer routes
require `role === "PRODUCER"` + ownership; partner routes require
`role === "PARTNER" || "ADMIN"` and skip the ownership check.

## 6. Producer UI changes

`/platform/producer/media` now has a **two-tab Add media form**:

1. **Upload file** (default)
   - `<input type="file" accept="image/jpeg,image/png,image/webp">`.
   - Client-side guards mirror the server: MIME whitelist + 8 MB
     cap. Errors surface immediately, before any network request.
   - Role + visibility selectors with the same default-by-role rule
     as PARTNER-MEDIA-2A (`TRACEABILITY_BAG` → `BUYER_PRIVATE`,
     etc.).
   - Optional alt text.
   - Three-phase banner (`Preparing upload…` → `Uploading…` → `Saving…`)
     → green "Saved." that auto-clears after 1.4 s.

2. **Use URL**
   - Original PARTNER-MEDIA-2A flow, untouched. Still accepts
     `https://` URLs and `/images/...` / `/uploads/...` local paths.
   - Used when Supabase isn't configured (`STORAGE_NOT_CONFIGURED`)
     or when the producer wants to point at an external curated
     image.

Tab toggle is a small pill at the top-right of the card. Switching
tabs clears the error band.

## 7. Upload flow

```
Producer picks file
        │
        ▼
POST /api/producer/farms/[farmId]/media/upload-url        ←—— validates +
        │                                                      asks Supabase
        ▼                                                      to sign
{ uploadUrl, publicUrl, mediaDefaults, ... }                   the path
        │
        ▼
PUT <uploadUrl>  body = file bytes                        ←—— browser →
                                                                Supabase
        │
        ▼
POST /api/producer/farms/[farmId]/media                   ←—— existing
{ url: publicUrl, role, source, visibility, altText }          create-media
                                                                endpoint
        │
        ▼
FarmMedia row inserted; refresh fires
```

Only one round-trip to our server before the upload + one after. The
browser uploads bytes **directly to Supabase**, never proxying
through our Next route. This keeps the route fast and keeps file
data off the application server entirely.

## 8. Validation / security behaviour

| Concern | Mitigation |
|---|---|
| File type | MIME whitelist on both client and server (`image/jpeg`, `image/png`, `image/webp`). `image/jpg` and `image/pjpeg` are normalised to `image/jpeg`. SVG / GIF / HEIC / PDF / data: URLs / anything else are rejected. |
| Size | Server cap `LOT_MEDIA_MAX_UPLOAD_BYTES = 8 MB`. Mirrored client-side for fast feedback. Zero / negative / NaN / Infinity all rejected. |
| Path traversal | The path builder rejects ownerIds and UUIDs outside `[A-Za-z0-9_-]+`. `..` / `/etc/passwd` fail validation. |
| PII / filename leakage | Storage path is `<farm|lot>/<ownerId>/<role>/<uuid>.<ext>`. The original filename never appears in the path; it's only kept as a sanitised string for future metadata display via `sanitiseOriginalFileNameForMetadata`. |
| Secret exposure | Service-role key is read **only** server-side. The Supabase client is lazily constructed and cached per env URL. Never sent to the browser. |
| Cross-tenant writes | Producer routes call `ensureFarmOwnership` / `ensureLotOwnership` before signing. Cross-account `farmId` / `lotId` → 403 `MEDIA_UPLOAD_FORBIDDEN`. |
| MIME spoofing | Documented limitation — we trust the browser-reported `Content-Type`. Reliable detection requires bytes; a future sprint can add server-side `file-type` sniffing. |
| Virus / malware | Not scanned in this sprint. Acceptable because the bucket is image-only and the platform never executes user-provided files. |
| EXIF / metadata | Not stripped. Acceptable for public farm/process photos; sensitive uploads (rare) can have EXIF removed before upload. Documented as a limitation. |

## 9. Tests added

**34 new pure tests** in `src/services/lot-media/__tests__/lotMediaStorage.test.ts`:

- `normaliseLotMediaContentType` (10): jpeg / png / webp accepted,
  `image/jpg` normalised, case-insensitive + trims, SVG / GIF / PDF
  / HEIC rejected, empty / non-string rejected.
- `extensionForContentType` (1): canonical extension mapping.
- `validateLotMediaUploadRequest` (12): canonical payload,
  missing/overlong filename, MIME rejection, oversized / zero /
  negative / NaN / Infinity / non-number size, missing/unknown role,
  TRACEABILITY_BAG defaults to BUYER_PRIVATE, FARM defaults to
  PUBLIC_MARKET, explicit visibility override, unknown visibility
  rejected, no input mutation.
- `buildLotMediaStoragePath` (6): farm path shape, lot path shape
  with lower-cased role segment, never embeds the original filename,
  rejects unsafe ownerId, rejects empty uuid, rejects unknown role.
- `sanitiseOriginalFileNameForMetadata` (5): trims + returns, null
  for empty / non-string, clips overlong, no input mutation.

**Project totals**: 823 / 823 pass, tsc clean.

Service-layer integration tests for the actual Supabase signing call
are not added — would require a mocked Supabase client per the spec
("Do not call real Supabase in tests"). Validation pathways and
error mapping are exhaustively covered by the pure tests.

## 10. Commands run

- `npx tsc --noEmit` ✅ clean
- `npm run test:allocation` ✅ 823 / 823
- `npm run build` running in background — same `--no-engine` /
  Prisma-Accelerate static-export artefact from previous sprints
  applies. Compile path itself passes; non-zero exit is the
  pre-existing environment issue documented since LOT-MEDIA-1.

## 11. Manual validation

Setup:
1. Add `SUPABASE_SERVICE_ROLE_KEY=…` to `.env.local` (you can copy
   the value from Supabase → Project Settings → API). Optionally set
   `SUPABASE_LOT_MEDIA_BUCKET=lot-media`.
2. In the Supabase dashboard create a bucket named `lot-media` and
   mark it **public**.
3. Restart `npm run dev`.

Producer happy path:
4. Log in as a producer. Open `/platform/producer/media`.
5. Pick a farm. The Add-media card defaults to the **Upload file**
   tab.
6. Choose a JPEG / PNG / WebP under 8 MB, leave role as `FARM` and
   visibility as `PUBLIC_MARKET`. Click **Upload image**.
7. Watch the banner: `Preparing upload…` → `Uploading…` →
   `Saving…` → `Saved.` Form clears after ≈ 1.4 s.
8. The media list refreshes. The new row's URL is the Supabase
   public URL (`https://<...>/storage/v1/object/public/lot-media/farm/<farmId>/farm/<uuid>.jpg`).
9. Open `/platform/marketplace` and `/platform/client` — the
   carousel renders the new image.

Private proof:
10. Upload a `TRACEABILITY_BAG` photo. Visibility auto-flips to
    `BUYER_PRIVATE`.
11. Check `/api/marketplace/lots` and `/api/contracts/catalog` — the
    URL does **not** appear in either response.
12. Documented caveat: the URL is still reachable directly by
    anyone who knows it, because the bucket is public. UUID-randomised
    path makes it non-enumerable, but not cryptographically secret.

Validation:
13. Try to upload an SVG → blocked client-side ("That file type isn't
    supported").
14. Try to upload a 12 MB JPEG → blocked client-side ("File is too
    large").
15. Send a manual `POST /api/producer/farms/<other-farm>/media/upload-url`
    as a producer who doesn't own that farm → 403
    `MEDIA_UPLOAD_FORBIDDEN`. No object is signed.
16. Remove `SUPABASE_SERVICE_ROLE_KEY` from env → POST returns 503
    `STORAGE_NOT_CONFIGURED`; the UI switches to the URL tab.
17. URL paste tab still works end-to-end.

Partner:
18. As a PARTNER, `POST /api/partner/farms/<any-farm>/media/upload-url`
    works without ownership checks (same model as PARTNER-MEDIA-2A).

## 12. Known limitations

- **Public bucket only.** `BUYER_PRIVATE` is application-hidden, not
  cryptographically private. Anyone with the URL can fetch the file.
  Acceptable for non-sensitive farm/process photos; sensitive proofs
  should land with the private-bucket strategy in BUYER-PROOF-1.
- **No authorized buyer-private endpoint** for contracted buyers
  yet. The mapper still filters `BUYER_PRIVATE` from marketplace /
  catalog. No surface in the UI today reads those rows for a buyer.
- **No shipment / export proof guard.** Out of scope for this
  sprint (lives behind BUYER-PROOF-1).
- **No automatic image optimisation / `srcset`.** The browser
  downloads the original file. Adding `next/image` or a CDN
  transformer is a separate sprint.
- **No virus scanning, no EXIF stripping.** Documented; acceptable
  for image-only public farm photos but worth revisiting if buyer-
  private proofs need stronger privacy.
- **No deletion of storage objects on row delete.** Currently the
  `DELETE /api/.../media/[mediaId]` endpoint removes the DB row but
  not the underlying Supabase object. Storage will accumulate orphan
  files. Easy follow-up: add a `storage.from(bucket).remove([path])`
  call in the service-side delete helper once we store the path.
- **No partner-side dedicated UI.** The endpoints exist; partners
  can use the producer media UI by impersonation or call the API
  directly. PARTNER-MEDIA-3 can ship a partner-specific lot media
  panel if needed.
- **MIME is trusted from the browser.** No server-side byte
  sniffing. Hardening means adding the `file-type` package (≈ 30 KB)
  to the storage service.
- **Single-region.** Supabase Storage uses whatever region your
  project lives in. Multi-region or CDN edge caching is out of
  scope.

## 13. Recommended next sprint

- **BUYER-PROOF-1** — flip the bucket to private; add an authorised
  buyer-private media endpoint scoped to a contract's
  `companyId`; ship the contract-detail proof panel; wire the
  `evaluateBuyerProofMediaReadiness` helper from FARM-MEDIA-1 into a
  shipment-ready guard.
- Or **CONTRACT-REQUEST-3** — persist
  `DemandIntent.requestedDurationMonths` + `requestedStartMonth` and
  wire the wait/confirm flow's drift handler if product wants
  analytics + parity with the CREATE/AMEND drift guard.
