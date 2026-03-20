// =====================================================
// MARKET IMPACT ENGINE
//
// Modela el impacto sistémico de ejecuciones comerciales.
//
// Impacta:
//
// - presión de mercado
// - estrés de suministro
// - logística
// - shocks de commodity
//
// Se ejecuta inmediatamente después de una operación.
// =====================================================

import type { EngineState } from "@/engine/runtime"

export function applyMarketImpact(

  state: EngineState,
  commodity: string,
  volume: number

) {

  if (!Number.isFinite(volume) || volume <= 0) return


  // -----------------------------------------------------
  // NORMALIZE VOLUME
  // -----------------------------------------------------

  const impact =
    volume / 20000


  // -----------------------------------------------------
  // SUPPLY STRESS IMPACT
  // -----------------------------------------------------

  state.supplyStressField =
    Math.min(
      1,
      state.supplyStressField +
      impact * 0.3
    )


  // -----------------------------------------------------
  // SYSTEM FATIGUE IMPACT
  // -----------------------------------------------------

  state.systemFatigue =
    Math.min(
      1,
      state.systemFatigue +
      impact * 0.2
    )


  // -----------------------------------------------------
  // SHOCK GENERATION
  // -----------------------------------------------------

  if (impact > 0.02) {

    state.shockLevel =
      Math.min(
        1.5,
        state.shockLevel +
        impact * 0.4
      )

  }


  // -----------------------------------------------------
  // COMMODITY SHOCK SIGNAL
  // -----------------------------------------------------

  const signals =
    state.commodityShockSignals ?? []

  signals.push({

    commodity,
    shockPressure: impact

  })

  state.commodityShockSignals =
    signals.slice(-20)

}