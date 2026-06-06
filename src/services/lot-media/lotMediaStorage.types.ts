//////////////////////////////////////////////////////
// 🪣 LOT MEDIA STORAGE — TYPES (STORAGE-MEDIA-1 + BUYER-PROOF-1)
//
// Constants + shapes shared by the pure helpers, the
// server storage service and the route layer. No
// dependency on @supabase/supabase-js — this file is
// safe to import from node --test.
//////////////////////////////////////////////////////

import type {
  LotMediaRole,
  LotMediaSource,
  LotMediaVisibility,
} from "./lotMedia.types.ts"

//////////////////////////////////////////////////////
// BUCKET + LIMITS
//////////////////////////////////////////////////////

// STORAGE-MEDIA-1 (legacy alias) — when a single
// SUPABASE_LOT_MEDIA_BUCKET env was used as the public
// bucket. New code should read the *_PUBLIC_BUCKET +
// *_PRIVATE_BUCKET pair via the storage service.
export const LOT_MEDIA_BUCKET_DEFAULT = "lot-media"

// BUYER-PROOF-1 — two-bucket model.
//   public bucket  → PUBLIC_MARKET media
//   private bucket → BUYER_PRIVATE + INTERNAL_ONLY media
//
// Both buckets live in the same Supabase project. Public
// rows store their `publicUrl`; private rows store a
// `supabase://<bucket>/<path>` reference so the proof
// endpoint can signed-read them on demand.
export const LOT_MEDIA_PUBLIC_BUCKET_DEFAULT = "lot-media-public"
export const LOT_MEDIA_PRIVATE_BUCKET_DEFAULT = "lot-media-private"

export const LOT_MEDIA_MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8 MB
export const LOT_MEDIA_FILENAME_METADATA_MAX = 240
export const LOT_MEDIA_SIGNED_URL_EXPIRY_SECONDS = 600 // 10 minutes — upload

// Signed READ URLs are short-lived. We re-sign on every
// proof-endpoint call so a browser tab can't keep an
// open URL alive forever after a refresh.
export const LOT_MEDIA_SIGNED_READ_URL_EXPIRY_SECONDS = 600 // 10 minutes

// `supabase://` references stored on private media rows.
// Format: `supabase://<bucket>/<storagePath>`.
// The bucket and path are validated against allow-lists
// in the pure helpers — no traversal, no PII.
export const LOT_MEDIA_STORAGE_REFERENCE_PROTOCOL = "supabase://"

//////////////////////////////////////////////////////
// MIME WHITELIST
//
// Strictly the three formats the existing carousel can
// render correctly. SVG / GIF / PDF / HEIC are all
// rejected — SVG specifically because it allows script
// execution when rendered inline.
//////////////////////////////////////////////////////

export const ALLOWED_LOT_MEDIA_MIME_TYPES: ReadonlyArray<
  "image/jpeg" | "image/png" | "image/webp"
> = ["image/jpeg", "image/png", "image/webp"]

export type AllowedLotMediaMimeType =
  (typeof ALLOWED_LOT_MEDIA_MIME_TYPES)[number]

export type AllowedLotMediaExtension = "jpg" | "png" | "webp"

//////////////////////////////////////////////////////
// BUCKET RESOLUTION
//
// Pure layer doesn't know the runtime env values; the
// service injects them. The resolver returns the kind +
// the configured bucket name so the rest of the code
// stays decoupled from the env.
//////////////////////////////////////////////////////

export type LotMediaBucketKind = "PUBLIC" | "PRIVATE"

export type LotMediaBucketConfig = {
  publicBucket: string
  privateBucket: string
}

export type LotMediaBucketResolution = {
  kind: LotMediaBucketKind
  bucket: string
}

//////////////////////////////////////////////////////
// REQUEST / RESULT SHAPES
//////////////////////////////////////////////////////

export type LotMediaUploadTarget = "FARM" | "LOT"

export type LotMediaUploadRequestInput = {
  fileName?: unknown
  contentType?: unknown
  sizeBytes?: unknown
  role?: unknown
  visibility?: unknown
}

export type LotMediaUploadValidationError = {
  code:
    | "FILE_NAME_REQUIRED"
    | "FILE_NAME_TOO_LONG"
    | "CONTENT_TYPE_INVALID"
    | "SIZE_INVALID"
    | "SIZE_TOO_LARGE"
    | "ROLE_REQUIRED"
    | "ROLE_INVALID"
    | "VISIBILITY_INVALID"
  message: string
}

export type NormalisedLotMediaUploadRequest = {
  fileName: string
  contentType: AllowedLotMediaMimeType
  extension: AllowedLotMediaExtension
  sizeBytes: number
  role: LotMediaRole
  visibility: LotMediaVisibility
  // PARTNER_UPLOAD because the route only accepts authenticated
  // producer / partner / admin actors. Surfaced on the response so
  // the client's create-media call defaults consistently.
  source: LotMediaSource
}

export type LotMediaUploadValidationResult =
  | { ok: true; input: NormalisedLotMediaUploadRequest }
  | { ok: false; error: LotMediaUploadValidationError }

//////////////////////////////////////////////////////
// PATH BUILDER INPUT
//////////////////////////////////////////////////////

export type LotMediaStoragePathInput = {
  target: LotMediaUploadTarget
  ownerId: string
  role: LotMediaRole
  contentType: AllowedLotMediaMimeType
  // Caller-supplied UUID. The pure helper does NOT call
  // crypto.randomUUID() so it stays deterministic in tests.
  uuid: string
}

//////////////////////////////////////////////////////
// STORAGE REFERENCE
//
// Persisted on FarmMedia.url / GreenLotMedia.url for
// private rows. The serialiser / parser pair is in
// lotMediaStorage.pure.ts and is the only valid way
// to construct or read a reference.
//////////////////////////////////////////////////////

export type LotMediaStorageReference = {
  bucket: string
  storagePath: string
}

//////////////////////////////////////////////////////
// SIGNED UPLOAD RESPONSE
//
// Returned by the route layer to the browser. Never
// includes Supabase service-role secrets.
//
// BUYER-PROOF-1 — `publicUrl` is null for private
// uploads. The browser stores `storageReference` on the
// media row instead, and the proof endpoint resolves it
// to a signed read URL at view time.
//////////////////////////////////////////////////////

export type LotMediaSignedUploadResponse = {
  uploadUrl: string
  // Some Supabase JS versions return a separate token. When
  // present the client should call
  // supabase.storage.from(bucket).uploadToSignedUrl(path, token, file).
  token?: string
  method: "PUT" | "POST"
  bucket: string
  bucketKind: LotMediaBucketKind
  storagePath: string
  // Persisted reference for private rows (and informational for
  // public rows). Format: `supabase://<bucket>/<storagePath>`.
  storageReference: string
  // Public URL ONLY for public uploads. Null for BUYER_PRIVATE /
  // INTERNAL_ONLY uploads — the browser must not try to render
  // the storageReference directly.
  publicUrl: string | null
  expiresInSeconds: number
  mediaDefaults: {
    role: LotMediaRole
    source: LotMediaSource
    visibility: LotMediaVisibility
  }
}
