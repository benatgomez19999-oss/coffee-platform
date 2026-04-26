// =====================================================
// ATTRIBUTION
//
// For each fired detector, return up to ATTRIBUTION_TOP_N
// IDs from the source data that contributed most.
//
// Pure. IDs only — no names, no PII.
// Stable, deterministic ordering.
// =====================================================

import { ATTRIBUTION_TOP_N } from "./constants.ts"
import { listOverdueFulfilmentIds } from "./metrics/derived.ts"

import type {
  DetectorResult,
  DataAccessSnapshot,
  Attribution,
} from "./types.ts"

function topContractsByGreen(
  rows: DataAccessSnapshot["committedContractRows"]
): string[] {
  return [...rows]
    .sort((a, b) => {
      const da = b.monthlyGreenKg - a.monthlyGreenKg
      if (da !== 0) return da
      // Tiebreaker: stable order by id.
      return a.id.localeCompare(b.id)
    })
    .slice(0, ATTRIBUTION_TOP_N)
    .map((c) => c.id)
}

function topIntentsByGreen(
  rows: DataAccessSnapshot["openIntentRowsCurrent"]
): string[] {
  return [...rows]
    .sort((a, b) => {
      const da = b.deltaKg - a.deltaKg
      if (da !== 0) return da
      return a.id.localeCompare(b.id)
    })
    .slice(0, ATTRIBUTION_TOP_N)
    .map((i) => i.id)
}

function topGreenLotsByAvailable(
  rows: DataAccessSnapshot["publishedSupplyGreenRows"]
): string[] {
  return [...rows]
    .sort((a, b) => {
      const da = b.availableKg - a.availableKg
      if (da !== 0) return da
      return a.id.localeCompare(b.id)
    })
    .slice(0, ATTRIBUTION_TOP_N)
    .map((l) => l.id)
}

export function buildAttribution(
  detectors: DetectorResult[],
  snapshot: DataAccessSnapshot
): Attribution {

  const byDetector: Attribution["byDetector"] = {}

  for (const d of detectors) {
    switch (d.name) {
      case "COMMITMENT_LOAD_HIGH":
      case "MONTHS_OF_COVER_LOW":
      case "MONTHS_OF_COVER_COMMITTED_LOW":
        byDetector[d.name] = {
          contractIds: topContractsByGreen(snapshot.committedContractRows),
          greenLotIds: topGreenLotsByAvailable(
            snapshot.publishedSupplyGreenRows
          ),
        }
        break

      case "INTENT_PRESSURE_HIGH":
      case "INTENT_CONVERSION_DROP":
        byDetector[d.name] = {
          demandIntentIds: topIntentsByGreen(snapshot.openIntentRowsCurrent),
        }
        break

      case "FULFILMENT_OVERDUE":
        byDetector[d.name] = {
          producerFulfilmentIds: listOverdueFulfilmentIds(
            snapshot.fulfilmentRows,
            snapshot.runStartedAt
          ).slice(0, ATTRIBUTION_TOP_N),
        }
        break

      // -------------------------------------------------
      // Phase 2 — supply-axis fragility detectors.
      //
      // Farm-keyed detectors do not have a farmIds bucket
      // in the contributingIds shape; we attribute via the
      // largest published green lots, which is the
      // closest entity-shaped signal a downstream consumer
      // can act on. The metric itself carries the actual
      // top farm ids for callers that want them.
      // -------------------------------------------------

      case "FARM_CONCENTRATION_HIGH":
      case "SUPPLY_DIVERSITY_LOW":
        byDetector[d.name] = {
          greenLotIds: topGreenLotsByAvailable(
            snapshot.publishedSupplyGreenRows
          ),
        }
        break

      case "PINNED_LOT_OVEREXPOSED":
        // The detector itself already chose the load-bearing
        // lot ids (depleted set, or worstLotId) — re-use
        // that exact list rather than re-deriving here so
        // attribution and rationale stay in lockstep.
        byDetector[d.name] = {
          greenLotIds: (d.contributingIds.greenLotIds ?? []).slice(
            0,
            ATTRIBUTION_TOP_N
          ),
        }
        break

      case "UNBACKED_COMMITMENTS_HIGH":
        // contractIds are pre-computed by the metric (top
        // unbacked contracts by monthly green, capped).
        byDetector[d.name] = {
          contractIds: (d.contributingIds.contractIds ?? []).slice(
            0,
            ATTRIBUTION_TOP_N
          ),
        }
        break
    }
  }

  return { byDetector }
}
