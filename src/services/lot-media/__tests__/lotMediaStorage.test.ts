//////////////////////////////////////////////////////
// 🧪 STORAGE-MEDIA-1 — pure helper tests
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildLotMediaStoragePath,
  extensionForContentType,
  normaliseLotMediaContentType,
  sanitiseOriginalFileNameForMetadata,
  validateLotMediaUploadRequest,
} from "../lotMediaStorage.pure.ts"
import {
  LOT_MEDIA_MAX_UPLOAD_BYTES,
} from "../lotMediaStorage.types.ts"

// ------------------------------------------------------
// normaliseLotMediaContentType
// ------------------------------------------------------

describe("normaliseLotMediaContentType", () => {

  it("accepts image/jpeg", () => {
    assert.equal(normaliseLotMediaContentType("image/jpeg"), "image/jpeg")
  })

  it("accepts image/png", () => {
    assert.equal(normaliseLotMediaContentType("image/png"), "image/png")
  })

  it("accepts image/webp", () => {
    assert.equal(normaliseLotMediaContentType("image/webp"), "image/webp")
  })

  it("normalises image/jpg → image/jpeg", () => {
    assert.equal(normaliseLotMediaContentType("image/jpg"), "image/jpeg")
  })

  it("is case insensitive + trims", () => {
    assert.equal(normaliseLotMediaContentType("  IMAGE/PNG "), "image/png")
  })

  it("rejects image/svg+xml", () => {
    assert.equal(normaliseLotMediaContentType("image/svg+xml"), null)
  })

  it("rejects image/gif", () => {
    assert.equal(normaliseLotMediaContentType("image/gif"), null)
  })

  it("rejects application/pdf", () => {
    assert.equal(normaliseLotMediaContentType("application/pdf"), null)
  })

  it("rejects image/heic", () => {
    assert.equal(normaliseLotMediaContentType("image/heic"), null)
  })

  it("rejects empty / non-string", () => {
    assert.equal(normaliseLotMediaContentType(""), null)
    assert.equal(normaliseLotMediaContentType(null), null)
    assert.equal(normaliseLotMediaContentType(undefined), null)
    assert.equal(normaliseLotMediaContentType(42), null)
  })
})

// ------------------------------------------------------
// extensionForContentType
// ------------------------------------------------------

describe("extensionForContentType", () => {
  it("maps mimes to canonical extensions", () => {
    assert.equal(extensionForContentType("image/jpeg"), "jpg")
    assert.equal(extensionForContentType("image/png"), "png")
    assert.equal(extensionForContentType("image/webp"), "webp")
  })
})

// ------------------------------------------------------
// validateLotMediaUploadRequest
// ------------------------------------------------------

const VALID = {
  fileName: "farm.jpg",
  contentType: "image/jpeg",
  sizeBytes: 1024,
  role: "FARM",
} as const

describe("validateLotMediaUploadRequest", () => {

  it("accepts a canonical upload payload", () => {
    const r = validateLotMediaUploadRequest({ ...VALID })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.input.contentType, "image/jpeg")
      assert.equal(r.input.extension, "jpg")
      assert.equal(r.input.role, "FARM")
      assert.equal(r.input.visibility, "PUBLIC_MARKET") // role default
      assert.equal(r.input.source, "PARTNER_UPLOAD")
    }
  })

  it("rejects missing fileName", () => {
    const r = validateLotMediaUploadRequest({ ...VALID, fileName: "" })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "FILE_NAME_REQUIRED")
  })

  it("rejects an overlong fileName", () => {
    const r = validateLotMediaUploadRequest({
      ...VALID,
      fileName: "x".repeat(500) + ".jpg",
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "FILE_NAME_TOO_LONG")
  })

  it("rejects SVG / GIF / PDF MIME types", () => {
    for (const bad of ["image/svg+xml", "image/gif", "application/pdf"]) {
      const r = validateLotMediaUploadRequest({
        ...VALID,
        contentType: bad,
      })
      assert.equal(r.ok, false)
      if (!r.ok) assert.equal(r.error.code, "CONTENT_TYPE_INVALID")
    }
  })

  it("rejects oversized files", () => {
    const r = validateLotMediaUploadRequest({
      ...VALID,
      sizeBytes: LOT_MEDIA_MAX_UPLOAD_BYTES + 1,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "SIZE_TOO_LARGE")
  })

  it("rejects zero or negative size", () => {
    for (const bad of [0, -10]) {
      const r = validateLotMediaUploadRequest({ ...VALID, sizeBytes: bad })
      assert.equal(r.ok, false)
      if (!r.ok) assert.equal(r.error.code, "SIZE_INVALID")
    }
  })

  it("rejects NaN / Infinity / non-number size", () => {
    for (const bad of [NaN, Infinity, -Infinity, "10", null, undefined]) {
      const r = validateLotMediaUploadRequest({
        ...VALID,
        sizeBytes: bad as unknown as number,
      })
      assert.equal(r.ok, false)
      if (!r.ok) assert.equal(r.error.code, "SIZE_INVALID")
    }
  })

  it("rejects missing / unknown role", () => {
    const missing = validateLotMediaUploadRequest({
      ...VALID,
      role: undefined,
    } as unknown as { role: unknown })
    assert.equal(missing.ok, false)
    if (!missing.ok) assert.equal(missing.error.code, "ROLE_REQUIRED")

    const bad = validateLotMediaUploadRequest({ ...VALID, role: "WAREHOUSE" })
    assert.equal(bad.ok, false)
    if (!bad.ok) assert.equal(bad.error.code, "ROLE_INVALID")
  })

  it("defaults TRACEABILITY_BAG visibility to BUYER_PRIVATE", () => {
    const r = validateLotMediaUploadRequest({
      ...VALID,
      role: "TRACEABILITY_BAG",
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.input.visibility, "BUYER_PRIVATE")
  })

  it("defaults FARM visibility to PUBLIC_MARKET", () => {
    const r = validateLotMediaUploadRequest({ ...VALID, role: "FARM" })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.input.visibility, "PUBLIC_MARKET")
  })

  it("allows explicit visibility override", () => {
    const r = validateLotMediaUploadRequest({
      ...VALID,
      role: "FARM",
      visibility: "INTERNAL_ONLY",
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.input.visibility, "INTERNAL_ONLY")
  })

  it("rejects an unknown visibility value", () => {
    const r = validateLotMediaUploadRequest({
      ...VALID,
      visibility: "PUBLIC_EVERYWHERE",
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "VISIBILITY_INVALID")
  })

  it("does not mutate the input", () => {
    const input = { ...VALID, fileName: "  farm.jpg  " }
    const snapshot = { ...input }
    validateLotMediaUploadRequest(input)
    assert.deepEqual(input, snapshot)
  })
})

// ------------------------------------------------------
// buildLotMediaStoragePath
// ------------------------------------------------------

describe("buildLotMediaStoragePath", () => {

  it("builds a farm path with no original filename or PII", () => {
    const path = buildLotMediaStoragePath({
      target: "FARM",
      ownerId: "farm-uuid-123",
      role: "FARM",
      contentType: "image/jpeg",
      uuid: "abcdef0123456789",
    })
    assert.equal(path, "farm/farm-uuid-123/farm/abcdef0123456789.jpg")
  })

  it("builds a lot path with the lower-cased role segment", () => {
    const path = buildLotMediaStoragePath({
      target: "LOT",
      ownerId: "lot-uuid-9",
      role: "TRACEABILITY_BAG",
      contentType: "image/webp",
      uuid: "u1u1u1u1u1u1",
    })
    assert.equal(path, "lot/lot-uuid-9/traceability_bag/u1u1u1u1u1u1.webp")
  })

  it("never embeds the original filename", () => {
    const path = buildLotMediaStoragePath({
      target: "FARM",
      ownerId: "owner-1",
      role: "PROCESS",
      contentType: "image/png",
      uuid: "u123",
    })
    assert.equal(path.includes("farm.jpg"), false)
    assert.equal(path.includes("original"), false)
  })

  it("throws on an unsafe ownerId", () => {
    assert.throws(() => buildLotMediaStoragePath({
      target: "FARM",
      ownerId: "../etc/passwd",
      role: "FARM",
      contentType: "image/jpeg",
      uuid: "u",
    }))
  })

  it("throws on an empty uuid", () => {
    assert.throws(() => buildLotMediaStoragePath({
      target: "FARM",
      ownerId: "owner-1",
      role: "FARM",
      contentType: "image/jpeg",
      uuid: "",
    }))
  })

  it("throws on an unknown role", () => {
    assert.throws(() => buildLotMediaStoragePath({
      target: "FARM",
      ownerId: "owner-1",
      role: "BAD_ROLE" as unknown as "FARM",
      contentType: "image/jpeg",
      uuid: "u",
    }))
  })
})

// ------------------------------------------------------
// sanitiseOriginalFileNameForMetadata
// ------------------------------------------------------

describe("sanitiseOriginalFileNameForMetadata", () => {

  it("trims and returns the cleaned filename", () => {
    assert.equal(
      sanitiseOriginalFileNameForMetadata("  finca-demo.jpg  "),
      "finca-demo.jpg",
    )
  })

  it("returns null for empty / non-string input", () => {
    assert.equal(sanitiseOriginalFileNameForMetadata(""), null)
    assert.equal(sanitiseOriginalFileNameForMetadata(null), null)
    assert.equal(sanitiseOriginalFileNameForMetadata(undefined), null)
    assert.equal(sanitiseOriginalFileNameForMetadata(123), null)
  })

  it("clips overlong filenames", () => {
    const long = "f".repeat(500) + ".jpg"
    const out = sanitiseOriginalFileNameForMetadata(long)
    assert.ok(out)
    assert.equal(out!.length <= 240, true)
  })

  it("does not mutate the input", () => {
    const value = "  finca-demo.jpg  "
    sanitiseOriginalFileNameForMetadata(value)
    assert.equal(value, "  finca-demo.jpg  ")
  })
})
