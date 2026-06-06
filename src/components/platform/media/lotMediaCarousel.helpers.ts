//////////////////////////////////////////////////////
// 🎞️ LOT MEDIA CAROUSEL — PURE HELPERS (DASHBOARD-IMAGES-1)
//
// No React. No Prisma. Builds the display sequence the
// carousel cycles through plus the small "trust badge"
// projection that cards show over the image area.
//
// IMPORTANT — visibility:
// We trust the caller to pass already-public media. The
// public DTOs (marketplaceLot.mapper / contractCatalog.mapper)
// filter PUBLIC_MARKET before emitting the rows, so this
// helper just consumes what it's given without re-filtering.
//////////////////////////////////////////////////////

import type {
  LotMediaItem,
  LotMediaSummary,
} from "@/src/services/lot-media/lotMedia.types"

//////////////////////////////////////////////////////
// DISPLAY SEQUENCE
//
// 1. primaryMedia first if present.
// 2. then the remaining media in the order the DTO supplied.
// 3. duplicates removed by id; if the same url shows up under
//    two ids we still keep both — same image, different role/
//    altText could be deliberate.
// 4. null / undefined inputs handled.
// 5. INPUTS ARE NEVER MUTATED.
//////////////////////////////////////////////////////

export function buildLotMediaDisplaySequence(input: {
  media?: ReadonlyArray<LotMediaItem> | null
  primaryMedia?: LotMediaItem | null
}): LotMediaItem[] {
  const out: LotMediaItem[] = []
  const seenIds = new Set<string>()

  if (input.primaryMedia && input.primaryMedia.id) {
    seenIds.add(input.primaryMedia.id)
    out.push(input.primaryMedia)
  }

  for (const m of input.media ?? []) {
    if (!m || !m.id) continue
    if (seenIds.has(m.id)) continue
    seenIds.add(m.id)
    out.push(m)
  }

  return out
}

//////////////////////////////////////////////////////
// TRUST BADGE PROJECTION
//
// Mirrors the rules in DASHBOARD-IMAGES-1 spec:
//
//   hasPartnerMedia        → "Partner media"
//   else hasVerifiedMedia  → "Curated media"
//   else hasOnlyFallback   → "Illustrative"
//   else (no media)        → null
//
// Never exposes technical source names. Never claims
// GENERATED_EDITORIAL / TONAL_PLACEHOLDER as verified.
//////////////////////////////////////////////////////

export type LotMediaTrustBadge = {
  label: string
  tone: "partner" | "curated" | "illustrative"
}

export function buildLotMediaTrustBadge(input: {
  summary?: LotMediaSummary | null
  hasAnyMedia: boolean
}): LotMediaTrustBadge | null {
  if (!input.hasAnyMedia) return null
  const s = input.summary
  if (!s) return null
  if (s.hasPartnerMedia) return { label: "Partner media", tone: "partner" }
  if (s.hasVerifiedMedia) return { label: "Curated media", tone: "curated" }
  if (s.hasOnlyFallbackMedia) return { label: "Illustrative", tone: "illustrative" }
  return null
}
