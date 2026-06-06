//////////////////////////////////////////////////////
// 🛍️ MARKETPLACE VIEW SERVICE
//
// Single orchestrator used by:
//   - GET /api/marketplace/lots (HTTP route)
//   - app/platform/marketplace/page.tsx (server component)
//
// Pipeline:
//   buildAllocationSnapshots()
//     → decideLotAllocation per snapshot
//       → mapDecisionToMarketplaceLot (filters HOLD/contract-only)
//         → sort + metrics + insights
//
// Read-only. No writes. No events.
//////////////////////////////////////////////////////

import { buildAllocationSnapshots } from "@/src/services/allocation/snapshot/lotAllocationSnapshot.service"
import { decideLotAllocation } from "@/src/services/allocation/engine/lotAllocationEngine"
import { DEFAULT_ALLOCATION_POLICY } from "@/src/services/allocation/policy/allocationPolicy"
import { calculateProducerPricing } from "@/src/engine/pricing/producer/calculatePricing"
import { getLatestMarketSignalForPricing } from "@/src/services/pricing/marketSignal.service"

import {
  computeMarketplaceInsights,
  computeMarketplaceMetrics,
  mapDecisionToMarketplaceLot,
  sortMarketplaceLots,
  type MarketplaceLotDto,
  type MarketplaceLotsResponse,
} from "./marketplaceLot.mapper"

export async function getMarketplaceLotsView(): Promise<MarketplaceLotsResponse> {

  const generatedAt = new Date().toISOString()

  // Read latest active MarketSignalSnapshot ONCE for the whole sweep —
  // each lot's adaptive pricing uses the same cPrice / demandIndex
  // pair, so a marketplace render is internally consistent. Returns
  // null when no usable snapshot exists; the engine then runs purely
  // deterministic.
  const [snapshots, marketData] = await Promise.all([
    buildAllocationSnapshots(),
    getLatestMarketSignalForPricing(),
  ])

  // Adapter — the producer engine's input type uses literal unions
  // (Variety / ProcessType) that aren't exported. The marketplace
  // pricing module already validates variety is in the engine's
  // supported set before invoking, so the boundary cast is runtime-safe.
  type EngineInput = Parameters<typeof calculateProducerPricing>[0]
  const pricingContext = {
    marketData,
    producerPricingFn: ((input: {
      scaScore: number
      altitude: number
      variety: string
      process: string
      country?: string
      marketData?: { cPrice?: number; demandIndex?: number }
    }) =>
      calculateProducerPricing({
        scaScore: input.scaScore,
        altitude: input.altitude,
        variety: input.variety as EngineInput["variety"],
        process: input.process as EngineInput["process"],
        country: input.country,
        marketData: input.marketData,
      })),
  }

  const lots: MarketplaceLotDto[] = []
  for (const snapshot of snapshots) {
    const decision = decideLotAllocation(snapshot)
    const dto = mapDecisionToMarketplaceLot(snapshot, decision, pricingContext)
    if (dto) lots.push(dto)
  }

  const sorted = sortMarketplaceLots(lots)
  const metrics = computeMarketplaceMetrics(sorted)
  const insights = computeMarketplaceInsights(sorted)

  return {
    lots: sorted,
    metrics,
    insights,
    generatedAt,
    policyVersion: DEFAULT_ALLOCATION_POLICY.policyVersion,
  }
}
