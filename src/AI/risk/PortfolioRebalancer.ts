// =====================================================
// PORTFOLIO REBALANCER
//
// Rebalancea el portfolio dinámicamente.
//
// Reduce riesgo y redistribuye capital.
//
// =====================================================

import type { EngineState } from "@/engine/core/runtime"

import { submitOperationalRequest }
from "@/engine/core/runtime"

// =====================================================
// MAIN FUNCTION
// =====================================================

export function runPortfolioRebalancer(
  state: EngineState
) {

  const portfolio =
    state.commodityPortfolio ?? []

  if (!portfolio.length) return

  // -------------------------------------------------
  // OVEREXPOSURE REDUCTION
  // -------------------------------------------------

  for (const position of portfolio) {

    if (position.weight > 0.5) {

      const reductionVolume =
        200 * position.weight

      console.log(
        `REBALANCE: reducing ${position.commodity}`
      )

      submitOperationalRequest(
        Math.round(reductionVolume),
        "manual"
      )

    }

  }

  // -------------------------------------------------
  // HIGH RISK REDUCTION
  // -------------------------------------------------

  for (const position of portfolio) {

    if (position.riskScore > 0.7) {

      const reductionVolume =
        150 * position.riskScore

      console.log(
        `REBALANCE: risk reduction ${position.commodity}`
      )

      submitOperationalRequest(
        Math.round(reductionVolume),
        "manual"
      )

    }

  }

}