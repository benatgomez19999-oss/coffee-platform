//////////////////////////////////////////////////////
// 🧪 LOT MEDIA — PURE TESTS (LOT-MEDIA-1)
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildBuyerLotMediaSequence,
  buildDefaultLotMediaAltText,
  buildInheritedLotMediaSequence,
  buildLotMediaReadinessPanel,
  buildOrderedLotMedia,
  buildPublicMarketLotMediaSequence,
  compareLotMediaItems,
  evaluateBuyerProofMediaReadiness,
  evaluateLotMediaReadiness,
  filterLotMediaForBuyerPrivate,
  filterLotMediaForInternalOps,
  filterLotMediaForPublicMarket,
  getDefaultVisibilityForMediaRole,
  isBuyerPrivateMedia,
  isFallbackLotMediaSource,
  isInternalOnlyMedia,
  isPublicMarketMedia,
  isVerifiedLotMediaSource,
  LOT_MEDIA_ALT_TEXT_MAX_LENGTH,
  LOT_MEDIA_CAPTION_MAX_LENGTH,
  normalizeLotMediaCreateInput,
  normalizeLotMediaRole,
  normalizeLotMediaSource,
  normalizeLotMediaUpdateInput,
  normalizeLotMediaVisibility,
  orderLotMedia,
  pickSiblingPrimariesToUnset,
  selectPrimaryLotMedia,
  validateLotMediaUrl,
  withOwner,
} from "../lotMedia.pure.ts"
import type {
  LotMediaItem,
  LotMediaRole,
  LotMediaSource,
  LotMediaVisibility,
} from "../lotMedia.types.ts"

// ------------------------------------------------------
// FIXTURE BUILDER
// ------------------------------------------------------

function item(
  over: Partial<LotMediaItem> & { id: string; role: LotMediaRole; source: LotMediaSource }
): LotMediaItem {
  return {
    url: `https://example.com/${over.id}.jpg`,
    position: 0,
    isPrimary: false,
    altText: null,
    ...over,
  }
}

// ------------------------------------------------------
// NORMALISATION
// ------------------------------------------------------

describe("normalizeLotMediaRole", () => {
  it("returns known roles unchanged", () => {
    const roles: LotMediaRole[] = [
      "FARM",
      "PROCESS",
      "PRODUCER",
      "TRACEABILITY_BAG",
      "PRODUCT_DETAIL",
      "CERTIFICATE",
      "EDITORIAL_FALLBACK",
    ]
    for (const r of roles) {
      assert.equal(normalizeLotMediaRole(r), r)
    }
  })

  it("returns null for unknown / non-string", () => {
    assert.equal(normalizeLotMediaRole("UNKNOWN"), null)
    assert.equal(normalizeLotMediaRole(""), null)
    assert.equal(normalizeLotMediaRole(null), null)
    assert.equal(normalizeLotMediaRole(undefined), null)
    assert.equal(normalizeLotMediaRole(42), null)
  })
})

describe("normalizeLotMediaSource", () => {
  it("returns known sources unchanged", () => {
    const sources: LotMediaSource[] = [
      "PARTNER_UPLOAD",
      "PLATFORM_CURATED",
      "GENERATED_EDITORIAL",
      "TONAL_PLACEHOLDER",
    ]
    for (const s of sources) {
      assert.equal(normalizeLotMediaSource(s), s)
    }
  })

  it("returns null for unknown / non-string", () => {
    assert.equal(normalizeLotMediaSource("AI_GENERATED"), null)
    assert.equal(normalizeLotMediaSource(""), null)
    assert.equal(normalizeLotMediaSource(null), null)
  })
})

describe("isVerifiedLotMediaSource / isFallbackLotMediaSource", () => {
  it("PARTNER_UPLOAD and PLATFORM_CURATED are verified", () => {
    assert.equal(isVerifiedLotMediaSource("PARTNER_UPLOAD"), true)
    assert.equal(isVerifiedLotMediaSource("PLATFORM_CURATED"), true)
    assert.equal(isVerifiedLotMediaSource("GENERATED_EDITORIAL"), false)
    assert.equal(isVerifiedLotMediaSource("TONAL_PLACEHOLDER"), false)
  })

  it("GENERATED_EDITORIAL and TONAL_PLACEHOLDER are fallback", () => {
    assert.equal(isFallbackLotMediaSource("GENERATED_EDITORIAL"), true)
    assert.equal(isFallbackLotMediaSource("TONAL_PLACEHOLDER"), true)
    assert.equal(isFallbackLotMediaSource("PARTNER_UPLOAD"), false)
    assert.equal(isFallbackLotMediaSource("PLATFORM_CURATED"), false)
  })
})

// ------------------------------------------------------
// ORDERING
// ------------------------------------------------------

describe("compareLotMediaItems / orderLotMedia", () => {
  it("FARM before PROCESS before PRODUCER before TRACEABILITY_BAG before PRODUCT_DETAIL before CERTIFICATE before EDITORIAL_FALLBACK", () => {
    const items: LotMediaItem[] = [
      item({ id: "g", role: "EDITORIAL_FALLBACK", source: "GENERATED_EDITORIAL" }),
      item({ id: "f", role: "CERTIFICATE",        source: "PARTNER_UPLOAD" }),
      item({ id: "e", role: "PRODUCT_DETAIL",     source: "PARTNER_UPLOAD" }),
      item({ id: "d", role: "TRACEABILITY_BAG",   source: "PARTNER_UPLOAD" }),
      item({ id: "c", role: "PRODUCER",           source: "PARTNER_UPLOAD" }),
      item({ id: "b", role: "PROCESS",            source: "PARTNER_UPLOAD" }),
      item({ id: "a", role: "FARM",               source: "PARTNER_UPLOAD" }),
    ]
    const ordered = orderLotMedia(items)
    assert.deepEqual(
      ordered.map((i) => i.role),
      [
        "FARM",
        "PROCESS",
        "PRODUCER",
        "TRACEABILITY_BAG",
        "PRODUCT_DETAIL",
        "CERTIFICATE",
        "EDITORIAL_FALLBACK",
      ]
    )
  })

  it("breaks ties on position asc, then id asc", () => {
    const items: LotMediaItem[] = [
      item({ id: "z", role: "FARM", source: "PARTNER_UPLOAD", position: 0 }),
      item({ id: "a", role: "FARM", source: "PARTNER_UPLOAD", position: 1 }),
      item({ id: "b", role: "FARM", source: "PARTNER_UPLOAD", position: 0 }),
    ]
    const ordered = orderLotMedia(items)
    // position=0 ids (b, z) then position=1 (a).
    assert.deepEqual(ordered.map((i) => i.id), ["b", "z", "a"])
  })

  it("does not mutate the input array", () => {
    const items: LotMediaItem[] = [
      item({ id: "b", role: "PROCESS", source: "PARTNER_UPLOAD" }),
      item({ id: "a", role: "FARM",    source: "PARTNER_UPLOAD" }),
    ]
    const before = items.map((i) => i.id)
    orderLotMedia(items)
    assert.deepEqual(items.map((i) => i.id), before)
  })

  it("returns empty array for empty input", () => {
    assert.deepEqual(orderLotMedia([]), [])
  })
})

// ------------------------------------------------------
// PRIMARY SELECTION
// ------------------------------------------------------

describe("selectPrimaryLotMedia", () => {
  it("returns null for empty", () => {
    assert.equal(selectPrimaryLotMedia([]), null)
  })

  it("explicit primary wins over higher-priority non-primary", () => {
    const items: LotMediaItem[] = [
      item({ id: "farm-1",   role: "FARM",           source: "PARTNER_UPLOAD" }),
      item({ id: "detail-1", role: "PRODUCT_DETAIL", source: "PARTNER_UPLOAD", isPrimary: true }),
    ]
    const primary = selectPrimaryLotMedia(items)
    assert.equal(primary?.id, "detail-1")
  })

  it("multiple primaries: pick by role priority then position then id", () => {
    const items: LotMediaItem[] = [
      item({ id: "p-detail",  role: "PRODUCT_DETAIL", source: "PARTNER_UPLOAD", isPrimary: true }),
      item({ id: "p-farm-b",  role: "FARM",           source: "PARTNER_UPLOAD", isPrimary: true, position: 1 }),
      item({ id: "p-farm-a",  role: "FARM",           source: "PARTNER_UPLOAD", isPrimary: true, position: 1 }),
      item({ id: "p-process", role: "PROCESS",        source: "PARTNER_UPLOAD", isPrimary: true }),
    ]
    const primary = selectPrimaryLotMedia(items)
    // FARM beats PROCESS / PRODUCT_DETAIL; among FARM primaries
    // position is tied (both 1) so id asc → "p-farm-a".
    assert.equal(primary?.id, "p-farm-a")
  })

  it("no explicit primary: returns first item in role-priority order", () => {
    const items: LotMediaItem[] = [
      item({ id: "det", role: "PRODUCT_DETAIL", source: "PARTNER_UPLOAD" }),
      item({ id: "farm", role: "FARM",          source: "PARTNER_UPLOAD" }),
    ]
    assert.equal(selectPrimaryLotMedia(items)?.id, "farm")
  })
})

// ------------------------------------------------------
// BUILD ORDERED RESULT
// ------------------------------------------------------

describe("buildOrderedLotMedia", () => {

  it("empty input returns null primary, all flags false, missing = all recommended", () => {
    const r = buildOrderedLotMedia([])
    assert.deepEqual(r.items, [])
    assert.equal(r.primary, null)
    assert.equal(r.hasVerifiedMedia, false)
    assert.equal(r.hasPartnerMedia, false)
    assert.equal(r.hasOnlyFallbackMedia, false)
    assert.deepEqual(r.missingRecommendedRoles, [
      "FARM",
      "PROCESS",
      "TRACEABILITY_BAG",
    ])
  })

  it("hasVerifiedMedia true for PARTNER_UPLOAD", () => {
    const r = buildOrderedLotMedia([
      item({ id: "1", role: "FARM", source: "PARTNER_UPLOAD" }),
    ])
    assert.equal(r.hasVerifiedMedia, true)
    assert.equal(r.hasPartnerMedia, true)
  })

  it("hasVerifiedMedia true for PLATFORM_CURATED but hasPartnerMedia false", () => {
    const r = buildOrderedLotMedia([
      item({ id: "1", role: "FARM", source: "PLATFORM_CURATED" }),
    ])
    assert.equal(r.hasVerifiedMedia, true)
    assert.equal(r.hasPartnerMedia, false)
  })

  it("generated/tonal alone do not count as verified", () => {
    const r = buildOrderedLotMedia([
      item({ id: "1", role: "FARM",  source: "GENERATED_EDITORIAL" }),
      item({ id: "2", role: "PROCESS", source: "TONAL_PLACEHOLDER" }),
    ])
    assert.equal(r.hasVerifiedMedia, false)
    assert.equal(r.hasPartnerMedia, false)
    assert.equal(r.hasOnlyFallbackMedia, true)
  })

  it("hasOnlyFallbackMedia is false when even one verified row is present", () => {
    const r = buildOrderedLotMedia([
      item({ id: "1", role: "FARM",  source: "GENERATED_EDITORIAL" }),
      item({ id: "2", role: "PROCESS", source: "PARTNER_UPLOAD" }),
    ])
    assert.equal(r.hasOnlyFallbackMedia, false)
  })

  it("missingRecommendedRoles ignores fallback media", () => {
    const r = buildOrderedLotMedia([
      item({ id: "1", role: "FARM",             source: "GENERATED_EDITORIAL" }),
      item({ id: "2", role: "PROCESS",          source: "TONAL_PLACEHOLDER" }),
      item({ id: "3", role: "TRACEABILITY_BAG", source: "GENERATED_EDITORIAL" }),
    ])
    assert.deepEqual(r.missingRecommendedRoles, [
      "FARM",
      "PROCESS",
      "TRACEABILITY_BAG",
    ])
  })

  it("missingRecommendedRoles satisfied by verified FARM/PROCESS/TRACEABILITY_BAG", () => {
    const r = buildOrderedLotMedia([
      item({ id: "1", role: "FARM",             source: "PARTNER_UPLOAD" }),
      item({ id: "2", role: "PROCESS",          source: "PLATFORM_CURATED" }),
      item({ id: "3", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD" }),
    ])
    assert.deepEqual(r.missingRecommendedRoles, [])
  })

  it("partial coverage reports only the missing recommended roles", () => {
    const r = buildOrderedLotMedia([
      item({ id: "1", role: "FARM",             source: "PARTNER_UPLOAD" }),
      item({ id: "2", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD" }),
    ])
    assert.deepEqual(r.missingRecommendedRoles, ["PROCESS"])
  })

  it("orders items and picks primary in one call", () => {
    const items: LotMediaItem[] = [
      item({ id: "det", role: "PRODUCT_DETAIL", source: "PARTNER_UPLOAD" }),
      item({ id: "p",   role: "PROCESS",        source: "PARTNER_UPLOAD" }),
      item({ id: "f",   role: "FARM",           source: "PARTNER_UPLOAD" }),
    ]
    const r = buildOrderedLotMedia(items)
    assert.deepEqual(r.items.map((i) => i.id), ["f", "p", "det"])
    assert.equal(r.primary?.id, "f")
  })
})

// ------------------------------------------------------
// ALT TEXT
// ------------------------------------------------------

describe("buildDefaultLotMediaAltText", () => {

  it("FARM includes lotName, region and country when present", () => {
    const alt = buildDefaultLotMediaAltText({
      lotName: "Finca Demo Geisha",
      region: "Huila",
      country: "Colombia",
      role: "FARM",
    })
    assert.match(alt, /Finca Demo Geisha/)
    assert.match(alt, /Huila, Colombia/)
  })

  it("FARM falls back when origin is missing", () => {
    const alt = buildDefaultLotMediaAltText({
      lotName: "Finca Demo",
      role: "FARM",
    })
    assert.equal(alt, "Finca Demo farm landscape")
  })

  it("PROCESS includes the process label", () => {
    const alt = buildDefaultLotMediaAltText({
      lotName: "Finca Demo",
      process: "Washed",
      role: "PROCESS",
    })
    assert.match(alt, /Washed processing for Finca Demo/)
  })

  it("TRACEABILITY_BAG returns the canonical traceability phrase", () => {
    const alt = buildDefaultLotMediaAltText({
      lotName: "Finca Demo",
      role: "TRACEABILITY_BAG",
    })
    assert.match(alt, /Traceability label or bag for Finca Demo/)
  })

  it("EDITORIAL_FALLBACK never claims documentary evidence", () => {
    const alt = buildDefaultLotMediaAltText({
      lotName: "Finca Demo",
      role: "EDITORIAL_FALLBACK",
    })
    assert.match(alt, /Illustrative image for Finca Demo/)
  })

  it("falls back to 'Coffee lot' when lotName is missing", () => {
    const alt = buildDefaultLotMediaAltText({ role: "FARM" })
    assert.match(alt, /Coffee lot/)
  })
})

// ------------------------------------------------------
// FARM-MEDIA-1 — INHERITED SEQUENCE
// ------------------------------------------------------

describe("buildInheritedLotMediaSequence", () => {

  it("combines lot media and farm media into one ordered sequence", () => {
    const lotMedia: LotMediaItem[] = [
      item({ id: "lot-process", role: "PROCESS", source: "PARTNER_UPLOAD" }),
    ]
    const farmMedia: LotMediaItem[] = [
      item({ id: "farm-farm", role: "FARM", source: "PARTNER_UPLOAD" }),
    ]
    const r = buildInheritedLotMediaSequence({ lotMedia, farmMedia })
    assert.deepEqual(r.items.map((i) => i.id), ["farm-farm", "lot-process"])
    // owner tags are propagated for downstream provenance
    assert.equal(r.items[0].owner, "FARM")
    assert.equal(r.items[1].owner, "LOT")
  })

  it("lot media beats farm media at same role+position", () => {
    const lotMedia: LotMediaItem[] = [
      item({ id: "lot-farm", role: "FARM", source: "PARTNER_UPLOAD", position: 0 }),
    ]
    const farmMedia: LotMediaItem[] = [
      item({ id: "farm-farm", role: "FARM", source: "PARTNER_UPLOAD", position: 0 }),
    ]
    const r = buildInheritedLotMediaSequence({ lotMedia, farmMedia })
    assert.equal(r.items[0].id, "lot-farm")
    assert.equal(r.items[0].owner, "LOT")
  })

  it("farm FARM media can become primary when lot has no media", () => {
    const r = buildInheritedLotMediaSequence({
      lotMedia: [],
      farmMedia: [
        item({ id: "farm-1", role: "FARM", source: "PARTNER_UPLOAD" }),
      ],
    })
    assert.equal(r.primary?.id, "farm-1")
    assert.equal(r.primary?.owner, "FARM")
  })

  it("explicit lot primary beats explicit farm primary even across roles", () => {
    const r = buildInheritedLotMediaSequence({
      lotMedia: [
        item({ id: "lot-detail", role: "PRODUCT_DETAIL", source: "PARTNER_UPLOAD", isPrimary: true }),
      ],
      farmMedia: [
        item({ id: "farm-farm", role: "FARM", source: "PARTNER_UPLOAD", isPrimary: true }),
      ],
    })
    assert.equal(r.primary?.id, "lot-detail")
    assert.equal(r.primary?.owner, "LOT")
  })

  it("primary falls through to explicit farm primary when no lot primary exists", () => {
    const r = buildInheritedLotMediaSequence({
      lotMedia: [
        item({ id: "lot-detail", role: "PRODUCT_DETAIL", source: "PARTNER_UPLOAD" }),
      ],
      farmMedia: [
        item({ id: "farm-farm", role: "FARM", source: "PARTNER_UPLOAD", isPrimary: true }),
      ],
    })
    assert.equal(r.primary?.id, "farm-farm")
    assert.equal(r.primary?.owner, "FARM")
  })

  it("missingRecommendedRoles is satisfied by verified farm media", () => {
    const r = buildInheritedLotMediaSequence({
      lotMedia: [],
      farmMedia: [
        item({ id: "f-farm",    role: "FARM",             source: "PARTNER_UPLOAD" }),
        item({ id: "f-process", role: "PROCESS",          source: "PLATFORM_CURATED" }),
        item({ id: "f-trace",   role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD" }),
      ],
    })
    assert.deepEqual(r.missingRecommendedRoles, [])
    assert.equal(r.hasVerifiedMedia, true)
  })

  it("does not mutate the input arrays", () => {
    const lotMedia: LotMediaItem[] = [
      item({ id: "lot-1", role: "FARM", source: "PARTNER_UPLOAD" }),
    ]
    const farmMedia: LotMediaItem[] = [
      item({ id: "farm-1", role: "PROCESS", source: "PARTNER_UPLOAD" }),
    ]
    const beforeLot = lotMedia.map((i) => ({ ...i }))
    const beforeFarm = farmMedia.map((i) => ({ ...i }))
    buildInheritedLotMediaSequence({ lotMedia, farmMedia })
    assert.deepEqual(lotMedia, beforeLot)
    assert.deepEqual(farmMedia, beforeFarm)
  })
})

describe("withOwner", () => {
  it("tags every item with owner + ownerId without mutating input", () => {
    const items: LotMediaItem[] = [
      item({ id: "1", role: "FARM", source: "PARTNER_UPLOAD" }),
    ]
    const before = items.map((i) => ({ ...i }))
    const tagged = withOwner(items, "FARM", "farm-42")
    assert.equal(tagged[0].owner, "FARM")
    assert.equal(tagged[0].ownerId, "farm-42")
    assert.deepEqual(items, before)
  })

  it("returns empty array for empty input", () => {
    assert.deepEqual(withOwner([], "LOT"), [])
  })
})

// ------------------------------------------------------
// FARM-MEDIA-1 — READINESS EVALUATION
// ------------------------------------------------------

describe("evaluateLotMediaReadiness", () => {

  it("DRAFT mode is always ready, even with no media", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [],
      mode: "DRAFT",
    })
    assert.equal(r.ready, true)
    assert.equal(r.blockingReasons.length, 0)
    assert.equal(r.coverage.hasVerifiedFarmMedia, false)
    assert.equal(r.coverage.hasVerifiedProcessMedia, false)
    // Surfacing as a warning is OK on DRAFT — wizard nudges
    // the producer without blocking the save.
    assert.ok(r.warnings.length >= 0)
  })

  it("SUBMIT mode blocks when FARM media is missing", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        item({ id: "p", role: "PROCESS", source: "PARTNER_UPLOAD" }),
      ],
      mode: "SUBMIT",
    })
    assert.equal(r.ready, false)
    const codes = r.blockingReasons.map((b) => b.code)
    assert.ok(codes.includes("FARM_MEDIA_REQUIRED"))
    assert.ok(!codes.includes("PROCESS_MEDIA_REQUIRED"))
  })

  it("SUBMIT mode blocks when PROCESS media is missing", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        item({ id: "f", role: "FARM", source: "PARTNER_UPLOAD" }),
      ],
      mode: "SUBMIT",
    })
    assert.equal(r.ready, false)
    const codes = r.blockingReasons.map((b) => b.code)
    assert.ok(codes.includes("PROCESS_MEDIA_REQUIRED"))
    assert.ok(!codes.includes("FARM_MEDIA_REQUIRED"))
  })

  it("VERIFY/PUBLISH mode blocks the same way as SUBMIT", () => {
    for (const mode of ["VERIFY", "PUBLISH"] as const) {
      const r = evaluateLotMediaReadiness({
        lotMedia: [],
        farmMedia: [],
        mode,
      })
      assert.equal(r.ready, false)
      const codes = r.blockingReasons.map((b) => b.code)
      assert.ok(codes.includes("FARM_MEDIA_REQUIRED"))
      assert.ok(codes.includes("PROCESS_MEDIA_REQUIRED"))
    }
  })

  it("verified FARM at lot OR farm level satisfies the FARM gate", () => {
    const fromLot = evaluateLotMediaReadiness({
      lotMedia: [
        item({ id: "lot-f", role: "FARM",    source: "PARTNER_UPLOAD" }),
        item({ id: "lot-p", role: "PROCESS", source: "PARTNER_UPLOAD" }),
      ],
      farmMedia: [],
      mode: "VERIFY",
    })
    assert.equal(fromLot.ready, true)

    const fromFarm = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        item({ id: "f-f", role: "FARM",    source: "PARTNER_UPLOAD" }),
        item({ id: "f-p", role: "PROCESS", source: "PARTNER_UPLOAD" }),
      ],
      mode: "VERIFY",
    })
    assert.equal(fromFarm.ready, true)
  })

  it("fallback FARM (generated/tonal) does NOT satisfy the FARM gate", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        item({ id: "f-f", role: "FARM",    source: "GENERATED_EDITORIAL" }),
        item({ id: "f-p", role: "PROCESS", source: "TONAL_PLACEHOLDER" }),
      ],
      mode: "PUBLISH",
    })
    assert.equal(r.ready, false)
    const codes = r.blockingReasons.map((b) => b.code)
    assert.ok(codes.includes("FARM_MEDIA_REQUIRED"))
    assert.ok(codes.includes("PROCESS_MEDIA_REQUIRED"))
  })

  it("PLATFORM_CURATED counts as verified but emits MEDIA_PLATFORM_CURATED_ONLY warning", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        item({ id: "f-f", role: "FARM",    source: "PLATFORM_CURATED" }),
        item({ id: "f-p", role: "PROCESS", source: "PLATFORM_CURATED" }),
      ],
      mode: "PUBLISH",
    })
    assert.equal(r.ready, true)
    const wcodes = r.warnings.map((w) => w.code)
    assert.ok(wcodes.includes("MEDIA_PLATFORM_CURATED_ONLY"))
  })

  it("any PARTNER_UPLOAD suppresses the platform-curated-only warning", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        item({ id: "f-f", role: "FARM",    source: "PLATFORM_CURATED" }),
        item({ id: "f-p", role: "PROCESS", source: "PARTNER_UPLOAD" }),
      ],
      mode: "PUBLISH",
    })
    assert.equal(r.ready, true)
    const wcodes = r.warnings.map((w) => w.code)
    assert.ok(!wcodes.includes("MEDIA_PLATFORM_CURATED_ONLY"))
  })

  it("EXCLUSIVE / FEATURED warns when TRACEABILITY_BAG is missing (no block)", () => {
    for (const lotClass of ["EXCLUSIVE", "FEATURED"] as const) {
      const r = evaluateLotMediaReadiness({
        lotMedia: [],
        farmMedia: [
          item({ id: "f-f", role: "FARM",    source: "PARTNER_UPLOAD" }),
          item({ id: "f-p", role: "PROCESS", source: "PARTNER_UPLOAD" }),
        ],
        mode: "PUBLISH",
        lotClass,
      })
      assert.equal(r.ready, true)
      const wcodes = r.warnings.map((w) => w.code)
      assert.ok(wcodes.includes("TRACEABILITY_MEDIA_RECOMMENDED"))
    }
  })

  it("coverage flags expose role-level state", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [
        item({ id: "lot-trace", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD" }),
      ],
      farmMedia: [
        item({ id: "f-f",  role: "FARM",     source: "PARTNER_UPLOAD" }),
        item({ id: "f-p",  role: "PROCESS",  source: "PARTNER_UPLOAD" }),
        item({ id: "f-pr", role: "PRODUCER", source: "PARTNER_UPLOAD" }),
      ],
      mode: "PUBLISH",
    })
    assert.equal(r.ready, true)
    assert.equal(r.coverage.hasVerifiedFarmMedia, true)
    assert.equal(r.coverage.hasVerifiedProcessMedia, true)
    assert.equal(r.coverage.hasVerifiedProducerMedia, true)
    assert.equal(r.coverage.hasVerifiedTraceabilityMedia, true)
    assert.equal(r.coverage.hasAnyVerifiedMedia, true)
  })

  it("returns stable blocking-reason codes", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [],
      mode: "SUBMIT",
    })
    const codes = r.blockingReasons.map((b) => b.code).sort()
    assert.deepEqual(codes, ["FARM_MEDIA_REQUIRED", "PROCESS_MEDIA_REQUIRED"])
  })

  it("does not mutate the input arrays", () => {
    const lotMedia: LotMediaItem[] = [
      item({ id: "1", role: "FARM", source: "PARTNER_UPLOAD" }),
    ]
    const farmMedia: LotMediaItem[] = [
      item({ id: "2", role: "PROCESS", source: "PARTNER_UPLOAD" }),
    ]
    const beforeLot = lotMedia.map((i) => ({ ...i }))
    const beforeFarm = farmMedia.map((i) => ({ ...i }))
    evaluateLotMediaReadiness({ lotMedia, farmMedia, mode: "PUBLISH" })
    assert.deepEqual(lotMedia, beforeLot)
    assert.deepEqual(farmMedia, beforeFarm)
  })
})

// ------------------------------------------------------
// LOT-MEDIA-2 — VISIBILITY
// ------------------------------------------------------

function visItem(
  over: Partial<LotMediaItem> & {
    id: string
    role: LotMediaRole
    source: LotMediaSource
    visibility: LotMediaVisibility
  },
): LotMediaItem {
  return {
    url: `https://example.com/${over.id}.jpg`,
    position: 0,
    isPrimary: false,
    altText: null,
    ...over,
  }
}

describe("normalizeLotMediaVisibility", () => {
  it("returns known visibilities unchanged", () => {
    const all: LotMediaVisibility[] = ["PUBLIC_MARKET", "BUYER_PRIVATE", "INTERNAL_ONLY"]
    for (const v of all) {
      assert.equal(normalizeLotMediaVisibility(v), v)
    }
  })

  it("returns null for unknown / non-string", () => {
    assert.equal(normalizeLotMediaVisibility("MARKET"), null)
    assert.equal(normalizeLotMediaVisibility(""), null)
    assert.equal(normalizeLotMediaVisibility(null), null)
    assert.equal(normalizeLotMediaVisibility(undefined), null)
    assert.equal(normalizeLotMediaVisibility(42), null)
  })
})

describe("default visibility by role", () => {
  it("FARM defaults to PUBLIC_MARKET", () => {
    assert.equal(getDefaultVisibilityForMediaRole("FARM"), "PUBLIC_MARKET")
  })

  it("PROCESS defaults to PUBLIC_MARKET", () => {
    assert.equal(getDefaultVisibilityForMediaRole("PROCESS"), "PUBLIC_MARKET")
  })

  it("TRACEABILITY_BAG defaults to BUYER_PRIVATE", () => {
    assert.equal(getDefaultVisibilityForMediaRole("TRACEABILITY_BAG"), "BUYER_PRIVATE")
  })

  it("CERTIFICATE defaults to BUYER_PRIVATE", () => {
    assert.equal(getDefaultVisibilityForMediaRole("CERTIFICATE"), "BUYER_PRIVATE")
  })

  it("PRODUCT_DETAIL defaults to PUBLIC_MARKET", () => {
    assert.equal(getDefaultVisibilityForMediaRole("PRODUCT_DETAIL"), "PUBLIC_MARKET")
  })

  it("EDITORIAL_FALLBACK defaults to PUBLIC_MARKET", () => {
    assert.equal(getDefaultVisibilityForMediaRole("EDITORIAL_FALLBACK"), "PUBLIC_MARKET")
  })
})

describe("visibility classifiers (undefined = PUBLIC_MARKET)", () => {
  it("treats missing visibility as PUBLIC_MARKET", () => {
    const legacy = item({ id: "1", role: "FARM", source: "PARTNER_UPLOAD" })
    assert.equal(isPublicMarketMedia(legacy), true)
    assert.equal(isBuyerPrivateMedia(legacy), false)
    assert.equal(isInternalOnlyMedia(legacy), false)
  })

  it("classifies explicit visibility values", () => {
    const pub = visItem({ id: "a", role: "FARM", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" })
    const priv = visItem({ id: "b", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE" })
    const internal = visItem({ id: "c", role: "CERTIFICATE", source: "PARTNER_UPLOAD", visibility: "INTERNAL_ONLY" })
    assert.equal(isPublicMarketMedia(pub), true)
    assert.equal(isBuyerPrivateMedia(priv), true)
    assert.equal(isInternalOnlyMedia(internal), true)
  })
})

describe("audience-scoped filters", () => {

  const items: LotMediaItem[] = [
    visItem({ id: "pub-farm",     role: "FARM",             source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
    visItem({ id: "buy-trace",    role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE" }),
    visItem({ id: "int-cert",     role: "CERTIFICATE",      source: "PARTNER_UPLOAD", visibility: "INTERNAL_ONLY" }),
  ]

  it("public market filter returns only PUBLIC_MARKET", () => {
    const out = filterLotMediaForPublicMarket(items)
    assert.deepEqual(out.map((i) => i.id), ["pub-farm"])
  })

  it("buyer-private filter returns PUBLIC_MARKET + BUYER_PRIVATE", () => {
    const out = filterLotMediaForBuyerPrivate(items)
    assert.deepEqual(out.map((i) => i.id).sort(), ["buy-trace", "pub-farm"])
  })

  it("internal-ops filter returns all items", () => {
    const out = filterLotMediaForInternalOps(items)
    assert.equal(out.length, 3)
  })

  it("filters do not mutate input", () => {
    const before = items.map((i) => ({ ...i }))
    filterLotMediaForPublicMarket(items)
    filterLotMediaForBuyerPrivate(items)
    filterLotMediaForInternalOps(items)
    assert.deepEqual(items, before)
  })
})

describe("audience-scoped sequence builders", () => {

  it("buildPublicMarketLotMediaSequence excludes buyer-private bag", () => {
    const r = buildPublicMarketLotMediaSequence({
      lotMedia: [
        visItem({ id: "lot-trace", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE", isPrimary: true }),
      ],
      farmMedia: [
        visItem({ id: "farm-farm", role: "FARM",    source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
        visItem({ id: "farm-proc", role: "PROCESS", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
    })
    const ids = r.items.map((i) => i.id)
    assert.ok(!ids.includes("lot-trace"))
    // BUYER_PRIVATE isPrimary must not surface as the primary
    assert.ok(r.primary == null || r.primary.id !== "lot-trace")
    assert.equal(r.primary?.id, "farm-farm")
  })

  it("buildBuyerLotMediaSequence includes buyer-private proof", () => {
    const r = buildBuyerLotMediaSequence({
      lotMedia: [
        visItem({ id: "lot-trace", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE" }),
        visItem({ id: "lot-int",   role: "CERTIFICATE",      source: "PARTNER_UPLOAD", visibility: "INTERNAL_ONLY" }),
      ],
      farmMedia: [
        visItem({ id: "farm-farm", role: "FARM", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
    })
    const ids = r.items.map((i) => i.id)
    assert.ok(ids.includes("lot-trace"))
    assert.ok(ids.includes("farm-farm"))
    assert.ok(!ids.includes("lot-int"))
  })
})

describe("evaluateLotMediaReadiness — visibility split (LOT-MEDIA-2)", () => {

  it("public marketplace readiness ignores BUYER_PRIVATE FARM media", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        visItem({ id: "f", role: "FARM",    source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE" }),
        visItem({ id: "p", role: "PROCESS", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
      mode: "PUBLISH",
    })
    assert.equal(r.ready, false)
    const codes = r.blockingReasons.map((b) => b.code)
    assert.ok(codes.includes("FARM_MEDIA_REQUIRED"))
  })

  it("public marketplace readiness ignores BUYER_PRIVATE PROCESS media", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        visItem({ id: "f", role: "FARM",    source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
        visItem({ id: "p", role: "PROCESS", source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE" }),
      ],
      mode: "PUBLISH",
    })
    assert.equal(r.ready, false)
    const codes = r.blockingReasons.map((b) => b.code)
    assert.ok(codes.includes("PROCESS_MEDIA_REQUIRED"))
  })

  it("PUBLIC_MARKET verified FARM + PROCESS satisfies readiness", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        visItem({ id: "f", role: "FARM",    source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
        visItem({ id: "p", role: "PROCESS", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
      mode: "PUBLISH",
    })
    assert.equal(r.ready, true)
  })

  it("PUBLIC_MARKET fallback FARM still does not satisfy readiness", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        visItem({ id: "f", role: "FARM",    source: "GENERATED_EDITORIAL", visibility: "PUBLIC_MARKET" }),
        visItem({ id: "p", role: "PROCESS", source: "GENERATED_EDITORIAL", visibility: "PUBLIC_MARKET" }),
      ],
      mode: "PUBLISH",
    })
    assert.equal(r.ready, false)
  })

  it("LOT-MEDIA-1 fixtures (no visibility) still satisfy readiness", () => {
    // No visibility on the items — they default to PUBLIC_MARKET
    // so existing seed/test data keeps publishing as before.
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        item({ id: "f", role: "FARM",    source: "PARTNER_UPLOAD" }),
        item({ id: "p", role: "PROCESS", source: "PARTNER_UPLOAD" }),
      ],
      mode: "PUBLISH",
    })
    assert.equal(r.ready, true)
  })

  it("EXCLUSIVE warns about missing traceability but does not block publish", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [],
      farmMedia: [
        visItem({ id: "f", role: "FARM",    source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
        visItem({ id: "p", role: "PROCESS", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
      mode: "PUBLISH",
      lotClass: "EXCLUSIVE",
    })
    assert.equal(r.ready, true)
    const wcodes = r.warnings.map((w) => w.code)
    assert.ok(wcodes.includes("TRACEABILITY_MEDIA_RECOMMENDED"))
  })

  it("EXCLUSIVE accepts BUYER_PRIVATE traceability to suppress the warning", () => {
    const r = evaluateLotMediaReadiness({
      lotMedia: [
        visItem({ id: "t", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE" }),
      ],
      farmMedia: [
        visItem({ id: "f", role: "FARM",    source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
        visItem({ id: "p", role: "PROCESS", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
      mode: "PUBLISH",
      lotClass: "EXCLUSIVE",
    })
    assert.equal(r.ready, true)
    const wcodes = r.warnings.map((w) => w.code)
    assert.ok(!wcodes.includes("TRACEABILITY_MEDIA_RECOMMENDED"))
  })
})

describe("evaluateBuyerProofMediaReadiness", () => {

  it("CONTRACTED warns when no traceability proof exists, never blocks", () => {
    const r = evaluateBuyerProofMediaReadiness({
      lotMedia: [],
      farmMedia: [],
      mode: "CONTRACTED",
    })
    assert.equal(r.ready, true)
    const wcodes = r.warnings.map((w) => w.code)
    assert.ok(wcodes.includes("BUYER_TRACEABILITY_PROOF_RECOMMENDED"))
    assert.ok(wcodes.includes("BUYER_CERTIFICATE_RECOMMENDED"))
  })

  it("SHIPMENT_READY blocks when no BUYER_PRIVATE TRACEABILITY_BAG exists", () => {
    const r = evaluateBuyerProofMediaReadiness({
      lotMedia: [],
      farmMedia: [],
      mode: "SHIPMENT_READY",
    })
    assert.equal(r.ready, false)
    const codes = r.blockingReasons.map((b) => b.code)
    assert.ok(codes.includes("BUYER_TRACEABILITY_PROOF_REQUIRED"))
  })

  it("SHIPMENT_READY passes when BUYER_PRIVATE TRACEABILITY_BAG exists", () => {
    const r = evaluateBuyerProofMediaReadiness({
      lotMedia: [
        visItem({ id: "t", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE" }),
      ],
      farmMedia: [],
      mode: "SHIPMENT_READY",
    })
    assert.equal(r.ready, true)
    assert.equal(r.coverage.hasBuyerPrivateTraceabilityProof, true)
  })

  it("PUBLIC_MARKET traceability does not count as buyer-private proof", () => {
    const r = evaluateBuyerProofMediaReadiness({
      lotMedia: [
        visItem({ id: "t", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
      farmMedia: [],
      mode: "SHIPMENT_READY",
    })
    assert.equal(r.ready, false)
  })

  it("does not mutate inputs", () => {
    const lotMedia: LotMediaItem[] = [
      visItem({ id: "t", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE" }),
    ]
    const before = lotMedia.map((i) => ({ ...i }))
    evaluateBuyerProofMediaReadiness({ lotMedia, farmMedia: [], mode: "SHIPMENT_READY" })
    assert.deepEqual(lotMedia, before)
  })

  // ------------------------------------------------------
  // BUYER-PROOF-2B — shipment guard regression tests
  //
  // These pin down the exact behaviour the createShipment
  // guard relies on. Changing them is a flag that the
  // shipment-readiness rule moved.
  // ------------------------------------------------------

  it("SHIPMENT_READY rejects GENERATED_EDITORIAL traceability", () => {
    const r = evaluateBuyerProofMediaReadiness({
      lotMedia: [
        visItem({
          id: "t",
          role: "TRACEABILITY_BAG",
          source: "GENERATED_EDITORIAL",
          visibility: "BUYER_PRIVATE",
        }),
      ],
      farmMedia: [],
      mode: "SHIPMENT_READY",
    })
    assert.equal(r.ready, false)
  })

  it("SHIPMENT_READY rejects TONAL_PLACEHOLDER traceability", () => {
    const r = evaluateBuyerProofMediaReadiness({
      lotMedia: [
        visItem({
          id: "t",
          role: "TRACEABILITY_BAG",
          source: "TONAL_PLACEHOLDER",
          visibility: "BUYER_PRIVATE",
        }),
      ],
      farmMedia: [],
      mode: "SHIPMENT_READY",
    })
    assert.equal(r.ready, false)
  })

  it("SHIPMENT_READY rejects INTERNAL_ONLY traceability (not buyer-visible)", () => {
    const r = evaluateBuyerProofMediaReadiness({
      lotMedia: [
        visItem({
          id: "t",
          role: "TRACEABILITY_BAG",
          source: "PARTNER_UPLOAD",
          visibility: "INTERNAL_ONLY",
        }),
      ],
      farmMedia: [],
      mode: "SHIPMENT_READY",
    })
    assert.equal(r.ready, false)
  })

  it("SHIPMENT_READY: missing certificate is a warning, not a block", () => {
    const r = evaluateBuyerProofMediaReadiness({
      lotMedia: [
        visItem({
          id: "t",
          role: "TRACEABILITY_BAG",
          source: "PARTNER_UPLOAD",
          visibility: "BUYER_PRIVATE",
        }),
      ],
      farmMedia: [],
      mode: "SHIPMENT_READY",
    })
    assert.equal(r.ready, true)
    const wcodes = r.warnings.map((w) => w.code)
    assert.ok(wcodes.includes("BUYER_CERTIFICATE_RECOMMENDED"))
  })

  it("SHIPMENT_READY service-layer policy: farm-level traceability alone does NOT satisfy when called with farmMedia=[]", () => {
    // The createShipment guard intentionally passes farmMedia: []
    // so a producer cannot reuse a farm-wide bag photo as the
    // per-lot shipment proof. Verifying the call-site contract,
    // not the helper internals.
    const r = evaluateBuyerProofMediaReadiness({
      lotMedia: [],
      farmMedia: [],
      mode: "SHIPMENT_READY",
    })
    assert.equal(r.ready, false)
  })

  it("SHIPMENT_READY helper internals: farm-level traceability would satisfy if BOTH were passed (documents the call-site choice)", () => {
    // Documentation test — the pure helper combines lot+farm.
    // The createShipment guard deliberately suppresses the
    // farm side; if this test ever fails, the helper's
    // behaviour changed and the service policy must be revisited.
    const r = evaluateBuyerProofMediaReadiness({
      lotMedia: [],
      farmMedia: [
        visItem({
          id: "t",
          role: "TRACEABILITY_BAG",
          source: "PARTNER_UPLOAD",
          visibility: "BUYER_PRIVATE",
        }),
      ],
      mode: "SHIPMENT_READY",
    })
    assert.equal(r.ready, true)
  })
})

// ------------------------------------------------------
// PARTNER-MEDIA-2A — URL VALIDATION
// ------------------------------------------------------

describe("validateLotMediaUrl", () => {

  it("accepts an https:// URL", () => {
    const r = validateLotMediaUrl("https://example.com/farm.jpg")
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.url, "https://example.com/farm.jpg")
  })

  it("accepts a /images/* local path", () => {
    const r = validateLotMediaUrl("/images/farm.jpg")
    assert.equal(r.ok, true)
  })

  it("accepts an /uploads/* local path", () => {
    const r = validateLotMediaUrl("/uploads/abc/123.png")
    assert.equal(r.ok, true)
  })

  it("rejects javascript: URLs", () => {
    const r = validateLotMediaUrl("javascript:alert(1)")
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, "URL_SCHEME_NOT_ALLOWED")
  })

  it("rejects data: URLs", () => {
    const r = validateLotMediaUrl("data:image/png;base64,abc")
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, "URL_SCHEME_NOT_ALLOWED")
  })

  it("rejects file: URLs", () => {
    const r = validateLotMediaUrl("file:///etc/passwd")
    assert.equal(r.ok, false)
  })

  it("rejects http:// (only https)", () => {
    const r = validateLotMediaUrl("http://example.com/farm.jpg")
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, "URL_SCHEME_NOT_ALLOWED")
  })

  it("rejects empty / whitespace-only input", () => {
    const empty = validateLotMediaUrl("")
    assert.equal(empty.ok, false)
    const ws = validateLotMediaUrl("   ")
    assert.equal(ws.ok, false)
    const nil = validateLotMediaUrl(null as unknown as string)
    assert.equal(nil.ok, false)
  })

  it("rejects local paths outside /images/ or /uploads/", () => {
    const r = validateLotMediaUrl("/etc/passwd")
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, "URL_MALFORMED")
  })

  it("rejects malformed https URLs", () => {
    const r = validateLotMediaUrl("https://")
    assert.equal(r.ok, false)
  })
})

// ------------------------------------------------------
// PARTNER-MEDIA-2A — INPUT NORMALISATION
// ------------------------------------------------------

describe("normalizeLotMediaCreateInput", () => {

  it("defaults source=PARTNER_UPLOAD when not provided", () => {
    const r = normalizeLotMediaCreateInput({
      url: "https://example.com/farm.jpg",
      role: "FARM",
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.input.source, "PARTNER_UPLOAD")
    }
  })

  it("defaults visibility via role (TRACEABILITY_BAG → BUYER_PRIVATE)", () => {
    const r = normalizeLotMediaCreateInput({
      url: "https://example.com/bag.jpg",
      role: "TRACEABILITY_BAG",
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.input.visibility, "BUYER_PRIVATE")
    }
  })

  it("defaults visibility via role (FARM → PUBLIC_MARKET)", () => {
    const r = normalizeLotMediaCreateInput({
      url: "https://example.com/farm.jpg",
      role: "FARM",
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.input.visibility, "PUBLIC_MARKET")
  })

  it("respects explicit visibility override", () => {
    const r = normalizeLotMediaCreateInput({
      url: "https://example.com/cert.pdf",
      role: "CERTIFICATE",
      visibility: "PUBLIC_MARKET",
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.input.visibility, "PUBLIC_MARKET")
  })

  it("rejects unknown role", () => {
    const r = normalizeLotMediaCreateInput({
      url: "https://example.com/x.jpg",
      // @ts-expect-error — runtime guard
      role: "WAREHOUSE",
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "ROLE_INVALID")
  })

  it("requires a role", () => {
    const r = normalizeLotMediaCreateInput({
      url: "https://example.com/x.jpg",
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "ROLE_REQUIRED")
  })

  it("rejects unknown source", () => {
    const r = normalizeLotMediaCreateInput({
      url: "https://example.com/x.jpg",
      role: "FARM",
      // @ts-expect-error — runtime guard
      source: "AI_FANCY",
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "SOURCE_INVALID")
  })

  it("clamps altText / caption / credit to max length", () => {
    const big = "x".repeat(LOT_MEDIA_ALT_TEXT_MAX_LENGTH + 50)
    const r = normalizeLotMediaCreateInput({
      url: "https://example.com/x.jpg",
      role: "FARM",
      altText: big,
      caption: "y".repeat(LOT_MEDIA_CAPTION_MAX_LENGTH + 5),
      credit: "z".repeat(LOT_MEDIA_ALT_TEXT_MAX_LENGTH + 5),
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.input.altText?.length, LOT_MEDIA_ALT_TEXT_MAX_LENGTH)
      assert.equal(r.input.caption?.length, LOT_MEDIA_CAPTION_MAX_LENGTH)
    }
  })

  it("rejects malformed URLs (passes through validateLotMediaUrl)", () => {
    const r = normalizeLotMediaCreateInput({
      url: "javascript:alert(1)",
      role: "FARM",
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "URL_SCHEME_NOT_ALLOWED")
  })

  it("normalises position to non-negative integer or null", () => {
    const ok = normalizeLotMediaCreateInput({
      url: "https://example.com/x.jpg",
      role: "FARM",
      position: 3.7,
    })
    assert.equal(ok.ok, true)
    if (ok.ok) assert.equal(ok.input.position, 3)
    const bad = normalizeLotMediaCreateInput({
      url: "https://example.com/x.jpg",
      role: "FARM",
      position: -1,
    })
    assert.equal(bad.ok, false)
  })
})

describe("normalizeLotMediaUpdateInput", () => {

  it("returns only supplied fields (PATCH semantics)", () => {
    const r = normalizeLotMediaUpdateInput({ isPrimary: true })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.deepEqual(Object.keys(r.input), ["isPrimary"])
      assert.equal(r.input.isPrimary, true)
    }
  })

  it("validates URL when present", () => {
    const r = normalizeLotMediaUpdateInput({ url: "javascript:alert(1)" })
    assert.equal(r.ok, false)
  })

  it("allows clearing altText to null via empty string", () => {
    const r = normalizeLotMediaUpdateInput({ altText: "" })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.input.altText, null)
  })
})

// ------------------------------------------------------
// PARTNER-MEDIA-2A — SINGLE-PRIMARY HELPER
// ------------------------------------------------------

describe("pickSiblingPrimariesToUnset", () => {

  it("returns ids of every other primary, excluding the next primary", () => {
    const ids = pickSiblingPrimariesToUnset(
      [
        { id: "a", isPrimary: true },
        { id: "b", isPrimary: false },
        { id: "c", isPrimary: true },
        { id: "next", isPrimary: false },
      ],
      "next",
    )
    assert.deepEqual(ids.sort(), ["a", "c"])
  })

  it("returns empty when no siblings are primary", () => {
    const ids = pickSiblingPrimariesToUnset(
      [
        { id: "a", isPrimary: false },
        { id: "b", isPrimary: false },
      ],
      "a",
    )
    assert.deepEqual(ids, [])
  })

  it("does not include the next primary itself", () => {
    const ids = pickSiblingPrimariesToUnset(
      [
        { id: "a", isPrimary: true },
      ],
      "a",
    )
    assert.deepEqual(ids, [])
  })
})

// ------------------------------------------------------
// PARTNER-MEDIA-2A — READINESS PANEL PROJECTION
// ------------------------------------------------------

describe("buildLotMediaReadinessPanel", () => {

  it("flags publicListing.ready=false when farm has no public media", () => {
    const panel = buildLotMediaReadinessPanel({
      lotMedia: [],
      farmMedia: [],
    })
    assert.equal(panel.publicListing.ready, false)
    // FARM + PROCESS_OR_PRODUCT must be flagged MISSING + required
    const farm = panel.publicListing.slots.find((s) => s.code === "PUBLIC_FARM_PHOTO")
    const proc = panel.publicListing.slots.find((s) => s.code === "PUBLIC_PROCESS_OR_PRODUCT_PHOTO")
    assert.equal(farm?.state, "MISSING")
    assert.equal(farm?.required, true)
    assert.equal(proc?.state, "MISSING")
    assert.equal(proc?.required, true)
  })

  it("flags publicListing.ready=true with verified PUBLIC_MARKET FARM + PROCESS", () => {
    const panel = buildLotMediaReadinessPanel({
      lotMedia: [],
      farmMedia: [
        visItem({ id: "f", role: "FARM",    source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
        visItem({ id: "p", role: "PROCESS", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
    })
    assert.equal(panel.publicListing.ready, true)
  })

  it("PRODUCT_DETAIL counts toward the process-or-product slot", () => {
    const panel = buildLotMediaReadinessPanel({
      lotMedia: [
        visItem({ id: "pd", role: "PRODUCT_DETAIL", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
      farmMedia: [
        visItem({ id: "f", role: "FARM", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
    })
    assert.equal(panel.publicListing.ready, true)
  })

  it("BUYER_PRIVATE FARM does NOT satisfy the public farm slot", () => {
    const panel = buildLotMediaReadinessPanel({
      lotMedia: [],
      farmMedia: [
        visItem({ id: "f", role: "FARM", source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE" }),
        visItem({ id: "p", role: "PROCESS", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
      ],
    })
    assert.equal(panel.publicListing.ready, false)
    const farm = panel.publicListing.slots.find((s) => s.code === "PUBLIC_FARM_PHOTO")
    assert.equal(farm?.state, "MISSING")
  })

  it("buyer-proof slots reflect BUYER_PRIVATE coverage and never block publish", () => {
    const panel = buildLotMediaReadinessPanel({
      lotMedia: [
        visItem({ id: "t", role: "TRACEABILITY_BAG", source: "PARTNER_UPLOAD", visibility: "BUYER_PRIVATE" }),
      ],
      farmMedia: [],
    })
    assert.equal(panel.buyerProof.blocking, false)
    const trace = panel.buyerProof.slots.find((s) => s.code === "BUYER_TRACEABILITY_PROOF")
    assert.equal(trace?.state, "SATISFIED")
  })

  it("does not mutate inputs", () => {
    const lotMedia: LotMediaItem[] = [
      visItem({ id: "f", role: "FARM", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
    ]
    const farmMedia: LotMediaItem[] = [
      visItem({ id: "p", role: "PROCESS", source: "PARTNER_UPLOAD", visibility: "PUBLIC_MARKET" }),
    ]
    const beforeLot = lotMedia.map((i) => ({ ...i }))
    const beforeFarm = farmMedia.map((i) => ({ ...i }))
    buildLotMediaReadinessPanel({ lotMedia, farmMedia })
    assert.deepEqual(lotMedia, beforeLot)
    assert.deepEqual(farmMedia, beforeFarm)
  })
})
