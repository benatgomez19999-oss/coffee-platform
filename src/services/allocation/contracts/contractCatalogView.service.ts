//////////////////////////////////////////////////////
// 📄 CONTRACT CATALOG VIEW SERVICE
//
// Single orchestrator used by:
//   - GET /api/contracts/catalog (HTTP route)
//
// Pipeline:
//   buildAllocationSnapshots()
//     → decideLotAllocation per snapshot
//       → mapDecisionToContractCatalogLot
//         (filters HOLD / OPEN_MARKETPLACE-only / EXCLUSIVE_MICROLOT-only,
//          and any lot with contractAssignableGreenKg = 0)
//         → sort + metrics
//
// Read-only. No writes. No events.
// Mirrors marketplaceView.service.ts so the producer engine
// is injected as a function dependency (the engine's literal
// union types aren't exported, so we cast at the boundary).
//////////////////////////////////////////////////////

import { buildAllocationSnapshots } from "@/src/services/allocation/snapshot/lotAllocationSnapshot.service"
import { decideLotAllocation } from "@/src/services/allocation/engine/lotAllocationEngine"
import { DEFAULT_ALLOCATION_POLICY } from "@/src/services/allocation/policy/allocationPolicy"
import { calculateProducerPricing } from "@/src/engine/pricing/producer/calculatePricing"
import { getLatestMarketSignalForPricing } from "@/src/services/pricing/marketSignal.service"

import {
  computeContractCatalogMetrics,
  mapDecisionToContractCatalogLot,
  sortContractCatalogLots,
  type ContractCatalogLotDto,
  type ContractCatalogResponse,
} from "./contractCatalog.mapper"

export async function getContractCatalogView(): Promise<ContractCatalogResponse> {

  const generatedAt = new Date().toISOString()

  const [snapshots, marketData] = await Promise.all([
    buildAllocationSnapshots(),
    getLatestMarketSignalForPricing(),
  ])

  // Adapter — the producer engine's input type uses literal unions
  // (Variety / ProcessType) that aren't exported. Same pattern as
  // marketplaceView.service.ts: validate variety at calculate time
  // (the pricing module short-circuits unsupported varieties via
  // calculateB2BRoastedPricing) and cast at the boundary.
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

  const lots: ContractCatalogLotDto[] = []
  for (const snapshot of snapshots) {
    const decision = decideLotAllocation(snapshot)
    const dto = mapDecisionToContractCatalogLot(snapshot, decision, pricingContext)
    if (dto) lots.push(dto)
  }

  const sorted = sortContractCatalogLots(lots)
  const metrics = computeContractCatalogMetrics(sorted)

  return {
    generatedAt,
    policyVersion: DEFAULT_ALLOCATION_POLICY.policyVersion,
    count: sorted.length,
    lots: sorted,
    metrics,
  }
}
