//////////////////////////////////////////////////////
// 📑 RECOMMENDED CONTRACT LOTS — Supply Desk selector
//
// Pure helper that picks the top N catalog lots the
// "Supply Desk → New contract request" panel will
// recommend on the client dashboard. Reads ContractCatalogLotDto
// (from /api/contracts/catalog) and projects a small,
// dashboard-shaped view model.
//
// No DB. No fetch. Deterministic and easy to test.
//////////////////////////////////////////////////////

import type { ContractCatalogLotDto } from "../allocation/contracts/contractCatalog.mapper.ts"
import type {
  LotMediaItem,
  LotMediaSummary,
} from "../lot-media/lotMedia.types.ts"

export const DEFAULT_RECOMMENDED_LIMIT = 3

export type RecommendedContractLot = {
  id: string
  lotNumber: string
  name: string
  origin: string
  process: string
  variety: string
  scaScore: number | null
  altitude: number | null
  assignableRoastedKg: number
  assignableGreenKg: number
  pricePerKgRoasted: number | null
  currency: string
  badges: string[]
  recommendedSurface: "CONTRACT_CATALOG" | "SPLIT"
  // DASHBOARD-IMAGES-1 — public media (already filtered to
  // PUBLIC_MARKET by contractCatalog.mapper). Empty array
  // when the lot has no media.
  media: LotMediaItem[]
  primaryMedia: LotMediaItem | null
  mediaSummary: LotMediaSummary | null
}

export function pickRecommendedContractLots(
  lots: ReadonlyArray<ContractCatalogLotDto>,
  limit: number = DEFAULT_RECOMMENDED_LIMIT
): RecommendedContractLot[] {

  // Catalog lots already arrive sorted by the catalog mapper
  // (CONTRACT_CATALOG before SPLIT, then assignable kg desc, then SCA desc).
  // For Supply Desk we want a slightly different heuristic that surfaces
  // a visible mix of premium and volume — so re-sort:
  //
  //   1. CONTRACT_CATALOG before SPLIT
  //   2. higher SCA first (premium signal)
  //   3. higher assignable roasted kg as tie-break
  //   4. lotNumber asc (stable)
  const ranked = [...lots].sort((a, b) => {
    const sa = a.recommendedSurface === "CONTRACT_CATALOG" ? 0 : 1
    const sb = b.recommendedSurface === "CONTRACT_CATALOG" ? 0 : 1
    if (sa !== sb) return sa - sb
    const scaA = a.scaScore ?? -Infinity
    const scaB = b.scaScore ?? -Infinity
    if (scaA !== scaB) return scaB - scaA
    if (b.contractAssignableRoastedKg !== a.contractAssignableRoastedKg) {
      return b.contractAssignableRoastedKg - a.contractAssignableRoastedKg
    }
    return a.lotNumber.localeCompare(b.lotNumber)
  })

  const max = Math.max(0, Math.floor(limit))
  return ranked.slice(0, max).map((dto) => ({
    id: dto.id,
    lotNumber: dto.lotNumber,
    name: dto.name,
    origin: buildOriginLabel(dto.region, dto.country),
    process: dto.process,
    variety: dto.variety,
    scaScore: dto.scaScore,
    altitude: dto.altitude,
    assignableRoastedKg: dto.contractAssignableRoastedKg,
    assignableGreenKg: dto.contractAssignableGreenKg,
    pricePerKgRoasted: dto.pricePerKgRoasted,
    currency: dto.currency,
    badges: dto.badges.slice(),
    recommendedSurface: dto.recommendedSurface,
    // DASHBOARD-IMAGES-1 — propagate the public media sequence.
    // Defaults to empty arrays / null so the SupplyDeskPanel
    // carousel can render the tonal fallback safely.
    media: (dto.media ?? []).slice(),
    primaryMedia: dto.primaryMedia ?? null,
    mediaSummary: dto.mediaSummary ?? null,
  }))
}

function buildOriginLabel(region: string | null, country: string | null): string {
  const parts: string[] = []
  if (region) parts.push(region)
  if (country) parts.push(country)
  return parts.join(", ")
}
