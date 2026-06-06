//////////////////////////////////////////////////////
// 🧪 BUYER-PROOF-1 — pure helper tests
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildBuyerProofMediaSummary,
  filterMediaForContractProofAudience,
  isCertificateProofMedia,
  isTraceabilityProofMedia,
  normaliseProofMediaRoleLabel,
} from "../buyerProofMedia.pure.ts"
import {
  buildLotMediaStorageReference,
  parseLotMediaStorageReference,
  resolveLotMediaBucketForVisibility,
} from "../lotMediaStorage.pure.ts"
import type { LotMediaItem } from "../lotMedia.types.ts"

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

function makeItem(overrides: Partial<LotMediaItem>): LotMediaItem {
  return {
    id: overrides.id ?? "m1",
    url: overrides.url ?? "https://example.com/x.jpg",
    role: overrides.role ?? "FARM",
    source: overrides.source ?? "PARTNER_UPLOAD",
    position: overrides.position ?? 0,
    isPrimary: overrides.isPrimary ?? false,
    altText: overrides.altText ?? null,
    caption: overrides.caption,
    credit: overrides.credit,
    owner: overrides.owner,
    ownerId: overrides.ownerId,
    visibility: overrides.visibility,
  }
}

// ------------------------------------------------------
// filterMediaForContractProofAudience
// ------------------------------------------------------

describe("filterMediaForContractProofAudience", () => {

  const items: LotMediaItem[] = [
    makeItem({ id: "pub",   role: "FARM",             visibility: "PUBLIC_MARKET" }),
    makeItem({ id: "trace", role: "TRACEABILITY_BAG", visibility: "BUYER_PRIVATE" }),
    makeItem({ id: "cert",  role: "CERTIFICATE",      visibility: "BUYER_PRIVATE" }),
    makeItem({ id: "ops",   role: "FARM",             visibility: "INTERNAL_ONLY" }),
    makeItem({ id: "legacy", role: "PROCESS",         visibility: undefined }), // LOT-MEDIA-1 row
  ]

  it("BUYER sees PUBLIC_MARKET + BUYER_PRIVATE only", () => {
    const filtered = filterMediaForContractProofAudience(items, "BUYER")
    const ids = filtered.map((i) => i.id).sort()
    assert.deepEqual(ids, ["cert", "legacy", "pub", "trace"])
  })

  it("BUYER never sees INTERNAL_ONLY", () => {
    const filtered = filterMediaForContractProofAudience(items, "BUYER")
    assert.equal(filtered.find((i) => i.id === "ops"), undefined)
  })

  it("PARTNER sees everything (route enforces ownership)", () => {
    const filtered = filterMediaForContractProofAudience(items, "PARTNER")
    assert.equal(filtered.length, items.length)
  })

  it("PRODUCER sees everything (route enforces ownership)", () => {
    const filtered = filterMediaForContractProofAudience(items, "PRODUCER")
    assert.equal(filtered.length, items.length)
  })

  it("treats undefined visibility as PUBLIC_MARKET for the BUYER branch", () => {
    const filtered = filterMediaForContractProofAudience(
      [makeItem({ id: "legacy", role: "FARM", visibility: undefined })],
      "BUYER",
    )
    assert.equal(filtered.length, 1)
  })

  it("does not mutate the input array", () => {
    const before = items.slice()
    filterMediaForContractProofAudience(items, "BUYER")
    assert.deepEqual(items, before)
  })
})

// ------------------------------------------------------
// isTraceabilityProofMedia / isCertificateProofMedia
// ------------------------------------------------------

describe("proof role predicates", () => {

  it("isTraceabilityProofMedia matches TRACEABILITY_BAG", () => {
    assert.equal(
      isTraceabilityProofMedia(makeItem({ role: "TRACEABILITY_BAG" })),
      true,
    )
    assert.equal(
      isTraceabilityProofMedia(makeItem({ role: "FARM" })),
      false,
    )
  })

  it("isCertificateProofMedia matches CERTIFICATE", () => {
    assert.equal(
      isCertificateProofMedia(makeItem({ role: "CERTIFICATE" })),
      true,
    )
    assert.equal(
      isCertificateProofMedia(makeItem({ role: "TRACEABILITY_BAG" })),
      false,
    )
  })
})

// ------------------------------------------------------
// buildBuyerProofMediaSummary
// ------------------------------------------------------

describe("buildBuyerProofMediaSummary", () => {

  it("reports both missing on empty list", () => {
    const s = buildBuyerProofMediaSummary([])
    assert.equal(s.hasTraceabilityProof, false)
    assert.equal(s.hasCertificate, false)
    assert.equal(s.hasFinalBagPhoto, null)
    assert.equal(s.itemCount, 0)
    assert.deepEqual(s.missing, ["TRACEABILITY_PROOF", "CERTIFICATE"])
  })

  it("flags traceability proof present", () => {
    const s = buildBuyerProofMediaSummary([
      makeItem({ role: "TRACEABILITY_BAG", visibility: "BUYER_PRIVATE" }),
    ])
    assert.equal(s.hasTraceabilityProof, true)
    assert.equal(s.hasCertificate, false)
    assert.deepEqual(s.missing, ["CERTIFICATE"])
  })

  it("flags certificate present", () => {
    const s = buildBuyerProofMediaSummary([
      makeItem({ role: "CERTIFICATE", visibility: "BUYER_PRIVATE" }),
    ])
    assert.equal(s.hasCertificate, true)
    assert.equal(s.hasTraceabilityProof, false)
    assert.deepEqual(s.missing, ["TRACEABILITY_PROOF"])
  })

  it("flags both when both present", () => {
    const s = buildBuyerProofMediaSummary([
      makeItem({ id: "t", role: "TRACEABILITY_BAG" }),
      makeItem({ id: "c", role: "CERTIFICATE" }),
      makeItem({ id: "f", role: "FARM" }),
    ])
    assert.equal(s.hasTraceabilityProof, true)
    assert.equal(s.hasCertificate, true)
    assert.equal(s.itemCount, 3)
    assert.deepEqual(s.missing, [])
  })

  it("ignores non-proof roles", () => {
    const s = buildBuyerProofMediaSummary([
      makeItem({ id: "f", role: "FARM" }),
      makeItem({ id: "p", role: "PROCESS" }),
      makeItem({ id: "d", role: "PRODUCT_DETAIL" }),
    ])
    assert.equal(s.hasTraceabilityProof, false)
    assert.equal(s.hasCertificate, false)
  })
})

// ------------------------------------------------------
// normaliseProofMediaRoleLabel
// ------------------------------------------------------

describe("normaliseProofMediaRoleLabel", () => {

  it("labels proof roles distinctly", () => {
    assert.equal(normaliseProofMediaRoleLabel("TRACEABILITY_BAG"), "Traceability proof")
    assert.equal(normaliseProofMediaRoleLabel("CERTIFICATE"), "Certificate")
  })

  it("labels remaining roles in human-readable form", () => {
    assert.equal(normaliseProofMediaRoleLabel("FARM"), "Farm photo")
    assert.equal(normaliseProofMediaRoleLabel("PROCESS"), "Process photo")
    assert.equal(normaliseProofMediaRoleLabel("PRODUCER"), "Producer photo")
    assert.equal(normaliseProofMediaRoleLabel("PRODUCT_DETAIL"), "Product detail")
    assert.equal(normaliseProofMediaRoleLabel("EDITORIAL_FALLBACK"), "Editorial")
  })
})

// ------------------------------------------------------
// resolveLotMediaBucketForVisibility + storage reference
// (BUYER-PROOF-1 pure storage helpers — covered here so
// the buyer-proof test file is the single home for the
// new sprint's pure logic.)
// ------------------------------------------------------

describe("resolveLotMediaBucketForVisibility", () => {

  const config = { publicBucket: "pub-bucket", privateBucket: "priv-bucket" }

  it("routes PUBLIC_MARKET to the public bucket", () => {
    assert.deepEqual(
      resolveLotMediaBucketForVisibility("PUBLIC_MARKET", config),
      { kind: "PUBLIC", bucket: "pub-bucket" },
    )
  })

  it("routes BUYER_PRIVATE to the private bucket", () => {
    assert.deepEqual(
      resolveLotMediaBucketForVisibility("BUYER_PRIVATE", config),
      { kind: "PRIVATE", bucket: "priv-bucket" },
    )
  })

  it("routes INTERNAL_ONLY to the private bucket", () => {
    assert.deepEqual(
      resolveLotMediaBucketForVisibility("INTERNAL_ONLY", config),
      { kind: "PRIVATE", bucket: "priv-bucket" },
    )
  })
})

describe("buildLotMediaStorageReference + parseLotMediaStorageReference", () => {

  it("round-trips a valid reference", () => {
    const built = buildLotMediaStorageReference({
      bucket: "lot-media-private",
      storagePath: "lot/abc-123/traceability_bag/aaaa-bbbb.jpg",
    })
    assert.equal(built, "supabase://lot-media-private/lot/abc-123/traceability_bag/aaaa-bbbb.jpg")
    const parsed = parseLotMediaStorageReference(built)
    assert.deepEqual(parsed, {
      bucket: "lot-media-private",
      storagePath: "lot/abc-123/traceability_bag/aaaa-bbbb.jpg",
    })
  })

  it("rejects path traversal on serialise", () => {
    assert.throws(() =>
      buildLotMediaStorageReference({
        bucket: "priv",
        storagePath: "lot/../../etc/passwd",
      }),
    )
  })

  it("rejects bad bucket on serialise", () => {
    assert.throws(() =>
      buildLotMediaStorageReference({
        bucket: "..",
        storagePath: "lot/abc/farm/uuid.jpg",
      }),
    )
  })

  it("returns null on parse for non-supabase://", () => {
    assert.equal(parseLotMediaStorageReference("https://example.com/x.jpg"), null)
  })

  it("returns null on parse for missing path", () => {
    assert.equal(parseLotMediaStorageReference("supabase://only-bucket"), null)
    assert.equal(parseLotMediaStorageReference("supabase://only-bucket/"), null)
  })

  it("returns null on parse for traversal", () => {
    assert.equal(
      parseLotMediaStorageReference("supabase://priv/lot/../etc/passwd"),
      null,
    )
  })

  it("returns null on parse for non-string", () => {
    assert.equal(parseLotMediaStorageReference(42), null)
    assert.equal(parseLotMediaStorageReference(null), null)
    assert.equal(parseLotMediaStorageReference(undefined), null)
  })
})
