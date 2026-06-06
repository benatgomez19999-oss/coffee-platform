//////////////////////////////////////////////////////
// 🧪 DASHBOARD-IMAGES-1 — pure helper tests
//
// Exercises buildLotMediaDisplaySequence + buildLotMediaTrustBadge.
// No React. No DOM. No DTO mapper coupling — fixtures are
// plain LotMediaItem objects.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildLotMediaDisplaySequence,
  buildLotMediaTrustBadge,
} from "../lotMediaCarousel.helpers.ts"
import type {
  LotMediaItem,
  LotMediaRole,
  LotMediaSource,
} from "../../../../services/lot-media/lotMedia.types.ts"

function item(
  over: Partial<LotMediaItem> & {
    id: string
    role: LotMediaRole
    source: LotMediaSource
  },
): LotMediaItem {
  return {
    url: `https://example.com/${over.id}.jpg`,
    position: 0,
    isPrimary: false,
    altText: null,
    visibility: "PUBLIC_MARKET",
    ...over,
  }
}

// ------------------------------------------------------
// buildLotMediaDisplaySequence
// ------------------------------------------------------

describe("buildLotMediaDisplaySequence", () => {

  it("primary media is first when present", () => {
    const farm = item({ id: "farm", role: "FARM",    source: "PARTNER_UPLOAD" })
    const proc = item({ id: "proc", role: "PROCESS", source: "PARTNER_UPLOAD" })
    const out = buildLotMediaDisplaySequence({
      media: [farm, proc],
      primaryMedia: proc,
    })
    assert.deepEqual(out.map((m) => m.id), ["proc", "farm"])
  })

  it("primary media that's also in media[] is not duplicated", () => {
    const farm = item({ id: "farm", role: "FARM", source: "PARTNER_UPLOAD" })
    const out = buildLotMediaDisplaySequence({
      media: [farm],
      primaryMedia: farm,
    })
    assert.deepEqual(out.map((m) => m.id), ["farm"])
  })

  it("falls through media[] when no primary supplied", () => {
    const farm = item({ id: "farm", role: "FARM", source: "PARTNER_UPLOAD" })
    const proc = item({ id: "proc", role: "PROCESS", source: "PARTNER_UPLOAD" })
    const out = buildLotMediaDisplaySequence({
      media: [farm, proc],
      primaryMedia: null,
    })
    assert.deepEqual(out.map((m) => m.id), ["farm", "proc"])
  })

  it("returns an empty array for null/undefined inputs", () => {
    assert.deepEqual(buildLotMediaDisplaySequence({}), [])
    assert.deepEqual(buildLotMediaDisplaySequence({ media: null }), [])
    assert.deepEqual(
      buildLotMediaDisplaySequence({ media: undefined, primaryMedia: null }),
      [],
    )
  })

  it("deduplicates by id but allows different ids with the same url", () => {
    const a = item({ id: "a", role: "FARM",    source: "PARTNER_UPLOAD", url: "https://example.com/x.jpg" })
    const b = item({ id: "b", role: "PROCESS", source: "PARTNER_UPLOAD", url: "https://example.com/x.jpg" })
    const out = buildLotMediaDisplaySequence({
      media: [a, b],
      primaryMedia: a,
    })
    // Same URL but different ids → both kept.
    assert.deepEqual(out.map((m) => m.id), ["a", "b"])
  })

  it("ignores entries without ids defensively", () => {
    const valid = item({ id: "valid", role: "FARM", source: "PARTNER_UPLOAD" })
    // Runtime guard against malformed rows — typed-as-string but empty.
    const broken: LotMediaItem = { ...valid, id: "" }
    const out = buildLotMediaDisplaySequence({
      media: [broken, valid],
      primaryMedia: null,
    })
    assert.deepEqual(out.map((m) => m.id), ["valid"])
  })

  it("does not mutate the input arrays", () => {
    const a = item({ id: "a", role: "FARM",    source: "PARTNER_UPLOAD" })
    const b = item({ id: "b", role: "PROCESS", source: "PARTNER_UPLOAD" })
    const media = [a, b]
    const before = media.map((m) => ({ ...m }))
    buildLotMediaDisplaySequence({ media, primaryMedia: b })
    assert.deepEqual(media, before)
  })
})

// ------------------------------------------------------
// buildLotMediaTrustBadge
// ------------------------------------------------------

describe("buildLotMediaTrustBadge", () => {

  it("returns null when there is no media at all", () => {
    const badge = buildLotMediaTrustBadge({
      summary: {
        hasVerifiedMedia: false,
        hasPartnerMedia: false,
        hasOnlyFallbackMedia: false,
        missingRecommendedRoles: ["FARM", "PROCESS", "TRACEABILITY_BAG"],
      },
      hasAnyMedia: false,
    })
    assert.equal(badge, null)
  })

  it("returns null when summary is missing", () => {
    const badge = buildLotMediaTrustBadge({
      summary: null,
      hasAnyMedia: true,
    })
    assert.equal(badge, null)
  })

  it("Partner media label takes precedence over curated", () => {
    const badge = buildLotMediaTrustBadge({
      summary: {
        hasVerifiedMedia: true,
        hasPartnerMedia: true,
        hasOnlyFallbackMedia: false,
        missingRecommendedRoles: [],
      },
      hasAnyMedia: true,
    })
    assert.deepEqual(badge, { label: "Partner media", tone: "partner" })
  })

  it("Curated media when verified but no partner uploads", () => {
    const badge = buildLotMediaTrustBadge({
      summary: {
        hasVerifiedMedia: true,
        hasPartnerMedia: false,
        hasOnlyFallbackMedia: false,
        missingRecommendedRoles: [],
      },
      hasAnyMedia: true,
    })
    assert.deepEqual(badge, { label: "Curated media", tone: "curated" })
  })

  it("Illustrative when only fallback media", () => {
    const badge = buildLotMediaTrustBadge({
      summary: {
        hasVerifiedMedia: false,
        hasPartnerMedia: false,
        hasOnlyFallbackMedia: true,
        missingRecommendedRoles: ["FARM", "PROCESS", "TRACEABILITY_BAG"],
      },
      hasAnyMedia: true,
    })
    assert.deepEqual(badge, { label: "Illustrative", tone: "illustrative" })
  })

  it("never claims verification when source signals are absent", () => {
    const badge = buildLotMediaTrustBadge({
      summary: {
        hasVerifiedMedia: false,
        hasPartnerMedia: false,
        hasOnlyFallbackMedia: false,
        missingRecommendedRoles: [],
      },
      hasAnyMedia: true,
    })
    assert.equal(badge, null)
  })
})
