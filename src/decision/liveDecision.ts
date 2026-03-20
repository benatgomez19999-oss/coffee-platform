import type { EngineState, EngineContext } from "@/engine/runtime"
import { computeAdjustedRisk } from "./riskModel"
import { updateDecisionMomentum } from "./decisionMomentum"
import { computeSemaphore } from "./semaphoreLogic"
import { getSystemRegime } from "@/brain/regimeLearning"
import { computeRegionalImbalance } from "./regionalImbalance"
import { computeSupplyCascadeRisk } from "@/decision//supplyCascadeRisk"
import { computeAnticipatoryShortage } from "./anticipatoryShortage"
import { computeMarketFeedback } from "./marketFeedback"
import { computeReplenishmentForecast } from "./replenishmentForecast"
import { computeSupplyPlan } from "./supplyPlanner"
import { computeRegionalRiskDiagnostics } from "./regionalRiskDiagnostics"
import { computeCapacityFrontier } from "@/decision/capacityFrontier"


// =====================================================
// LIVE DECISION MEMORY — MODULE STATE
// Persistente entre ticks.
// No pertenece al runtime físico.
// =====================================================

let previousRiskScore = 0
let riskVelocity = 0
let lastSemaphore: "green" | "yellow" | "red" = "green"
let patienceField = 0
let decisionMomentum = 0
let decisionAttractor = 0

// =====================================================
// LIVE DECISION ENGINE
// Evaluación sistémica de disponibilidad + riesgo.
// Produce señal de semáforo para capa operacional.
// =====================================================

export function computeLiveDecision(
  state: EngineState,
  context: EngineContext
) {

  // =====================================================
  // DECISION EXPLANATION COLLECTOR
  // =====================================================

  const explanation: string[] = []

  // =====================================================
  // SYSTEM REGIME DETECTION
  // =====================================================

  const regime = getSystemRegime()

  if (regime === "stressed")
    explanation.push("System operating under stressed regime")

  else if (regime === "tightening")
    explanation.push("System tightening detected")

  else if (regime === "recovery")
    explanation.push("System recovering from stress")


  // =====================================================
  // TOTAL AVAILABLE SUPPLY
  // =====================================================

  const totalAvailable = state.regions.reduce(
    (sum, r) => sum + r.availableKg,
    0
  )

  const requestedVolume =
    context.requestedVolume ?? 0


  // =====================================================
  // DYNAMIC SAFETY MARGIN
  // =====================================================

  const fatigue = state.systemFatigue ?? 0
  const energy = state.systemEnergy ?? 0
  const supplyStress = state.supplyStressField ?? 0

  const dynamicMargin =
    1 +
    fatigue * 0.2 +
    energy * 0.15 +
    supplyStress * 0.25

  const effectiveDemand =
    requestedVolume * dynamicMargin


  // =====================================================
  // COVERAGE RATIO
  // =====================================================

  const coverageRatio =
    requestedVolume > 0
      ? totalAvailable / Math.max(1, effectiveDemand)
      : 1


  // =====================================================
  // POST TRADE RESERVE CHECK
  // =====================================================

  const postTradeAvailable =
    totalAvailable - requestedVolume

  const stockRatio =
    totalAvailable > 0
      ? postTradeAvailable / totalAvailable
      : 0


  // =====================================================
  // STRUCTURAL RESERVE PENALTY
  // =====================================================

  let structuralPenalty = 0

  if (stockRatio < 0.25)
    structuralPenalty = 0.35
  else if (stockRatio < 0.4)
    structuralPenalty = 0.2
  else if (stockRatio < 0.6)
    structuralPenalty = 0.1


  // =====================================================
  // REGIONAL RESERVE CHECK
  // Protege contra vaciado de regiones
  // =====================================================

  const regionalReserveFloor = 400

  let regionalDepletionRisk = 0

  for (const region of state.regions) {

    const afterTrade =
      region.availableKg - requestedVolume

    if (afterTrade < regionalReserveFloor) {

      const deficit =
        regionalReserveFloor - afterTrade

      regionalDepletionRisk +=
        Math.min(
          0.4,
          deficit / regionalReserveFloor * 0.25
        )

    }

  }

  if (regionalDepletionRisk > 0.2) {
    explanation.push(
      "Regional reserves approaching depletion"
    )
  }


  // =====================================================
  // EXPLANATION
  // =====================================================

  if (coverageRatio < 1) {
    explanation.push(
      "Available supply below requested demand"
    )
  }

  if (stockRatio < 0.4) {
    explanation.push(
      "System reserves becoming critically low"
    )
  }

// =====================================================
// REGIONAL IMBALANCE
// Detecta mala distribución de supply en la red
// =====================================================

const regionalImbalance =
  computeRegionalImbalance(state)

if (regionalImbalance > 0.35) {
  explanation.push("Supply distribution imbalance detected")
}

// =====================================================
// SUPPLY CASCADE RISK
// Detecta colapso progresivo de regiones
// =====================================================

const cascadeSupplyRisk =
  computeSupplyCascadeRisk(state)

if (cascadeSupplyRisk > 0.45) {
  explanation.push("Supply cascade risk emerging across regions")

}

// =====================================================
// ANTICIPATORY SHORTAGE SIGNAL
// Detecta escasez futura antes de que ocurra
// =====================================================

const anticipatoryShortage =
  computeAnticipatoryShortage(state)

if (anticipatoryShortage > 0.45) {
  explanation.push("Anticipatory shortage signal detected")
}

// =====================================================
// MARKET FEEDBACK LOOP
// Ajusta comportamiento del mercado según estado sistémico
// =====================================================

const marketFeedback =
  computeMarketFeedback(state)

if (marketFeedback.demandModifier < 0.95) {
  explanation.push("Market demand contracting under system stress")
}

if (marketFeedback.volatilityModifier > 1.1) {
  explanation.push("Market volatility increasing")
}

// =====================================================
// DEMAND PRESSURE SIGNAL
// Detecta presión de demanda futura sobre el inventario
// =====================================================

const demandForecast =
  state.demandForecast?.nextMonth ?? 0

const totalStock =
  state.regions.reduce(
    (sum, r) => sum + r.availableKg,
    0
  )

const demandPressure =
  demandForecast /
  Math.max(1, totalStock)

if (demandPressure > 0.6) {
  explanation.push("Contract demand pressure building")
}

// =====================================================
// SYSTEMIC RISK ESTIMATION
// Riesgo estructural del sistema
// =====================================================

const systemicRisk =
  state.collapseProximity * 0.25 +
  state.ewsScore * 0.15 +
  state.criticalSlowing * 0.15 +
  Math.abs(state.regimeDriftSignal) * 0.1 +
  state.systemEnergy * 0.15 +
  demandPressure * 0.2

if (systemicRisk > 0.6) {
  explanation.push("High systemic risk detected")
}

// =====================================================
// PRESSURE SIGNAL
// =====================================================

const pressure =
  state.unifiedPressure ?? 0

// =====================================================
// COMBINED RISK SCORE
// Integra riesgo estructural + presión + imbalance logístico
// =====================================================

const riskScore =
  systemicRisk * 0.28 +
  pressure * 0.18 +
  regionalImbalance * 0.14 +
  cascadeSupplyRisk * 0.14 +
  anticipatoryShortage * 0.1 +
  (1 - marketFeedback.demandModifier) * 0.08 +
  regionalDepletionRisk * 0.08
   

// =====================================================
// DECISION CONFIDENCE FIELD
// mide estabilidad estructural del diagnóstico
// =====================================================

const confidence =
  1 -
  Math.min(
    1,
    Math.abs(state.regimeDriftSignal) * 0.35 +
    state.criticalSlowing * 0.35 +
    state.lyapunovIndicator * 0.3
  )

const clampedConfidence =
  Math.max(0, Math.min(1, confidence))

  if (clampedConfidence < 0.4) {
  explanation.push("Low confidence in system stability")
}


// =====================================================
// BASE RISK ADJUSTMENT
// riesgo estructural + riesgo de cascada
// =====================================================

const { adjustedRisk, cascadeRisk } =
  computeAdjustedRisk(
    state,
    riskScore,
    clampedConfidence
  )

// =====================================================
// CASCADE INSTABILITY EXPLANATION
// =====================================================

if (cascadeRisk > 0.6) {
  explanation.push("Cascade instability detected")
}


// =====================================================
// DECISION MOMENTUM — COGNITIVE INERTIA
// evita saltos bruscos de decisión
// =====================================================


decisionMomentum =
  updateDecisionMomentum(
    lastSemaphore,
    decisionMomentum
  )
// =====================================================
// MOMENTUM ADJUSTED RISK
// =====================================================

const decisionRisk =
  adjustedRisk +
  decisionMomentum * 0.15

// =====================================================
// REGIME RISK MODIFIER
// el sistema se vuelve más conservador bajo estrés
// =====================================================

let regimeBias = 0

if (regime === "stressed")
  regimeBias = 0.15

else if (regime === "tightening")
  regimeBias = 0.08

else if (regime === "recovery")
  regimeBias = -0.05

const regimeAdjustedRisk =
  decisionRisk + regimeBias

// =====================================================
// STRUCTURAL DECISION HYSTERESIS
// decisiones más conservadoras bajo estrés estructural
// =====================================================

const regimeStress =
  state.systemRegime === "Structural stress" ? 1 : 0

  if (regimeStress === 1) {
  explanation.push("System operating under structural stress regime")
}

const structuralMemory =
  state.regimePersistence * 0.5 +
  state.stressScar * 0.5

const hysteresisBias =
  regimeStress * 0.15 +
  structuralMemory * 0.2

const hysteresisRisk =
  decisionRisk + hysteresisBias

// =====================================================
// DECISION ATTRACTOR FIELD
// estabiliza regiones de decisión
// =====================================================

const attractorTarget =
  lastSemaphore === "green" ? -0.2 :
  lastSemaphore === "yellow" ? 0 :
  0.2

decisionAttractor =
  decisionAttractor * 0.92 +
  attractorTarget * 0.08

// =====================================================
// FINAL RISK — incluye hysteresis + attractor field
// =====================================================

const finalRisk =
  hysteresisRisk +
  decisionAttractor * 0.12 +
  structuralPenalty




// =====================================================
// STRUCTURAL PATIENCE FIELD
// evita reacción impulsiva del sistema
// =====================================================

const patienceSignal =
  adjustedRisk * 0.6 +
  Math.abs(riskVelocity) * 0.4

const patienceTarget =
  Math.max(0, Math.min(1, patienceSignal))

patienceField =
  patienceField * 0.9 +
  patienceTarget * 0.1



// =====================================================
// RISK VELOCITY — anticipatory derivative
// Detecta aceleración de riesgo sistémico
// =====================================================

const deltaRisk =
  adjustedRisk - previousRiskScore

riskVelocity =
  riskVelocity * 0.8 +
  deltaRisk * 0.2

  if (riskVelocity > 0.08) {
  explanation.push("Systemic risk accelerating")
}

previousRiskScore = adjustedRisk

// =====================================================
// REPLENISHMENT FORECAST
// Predice regiones que requerirán reposición
// =====================================================

const replenishmentSignals =
  computeReplenishmentForecast(state)

for (const signal of replenishmentSignals) {
  explanation.push(signal)
}

// =====================================================
// GLOBAL SUPPLY PLAN
// Recomendaciones operativas del sistema
// =====================================================

const supplyPlan =
  computeSupplyPlan(state)

for (const msg of supplyPlan) {
  explanation.push(msg)
}

// =====================================================
// REGIONAL RISK DIAGNOSTICS
// Explica qué regiones generan presión
// =====================================================

const regionalSignals =
  computeRegionalRiskDiagnostics(
    state,
    requestedVolume
  )

for (const signal of regionalSignals) {
  explanation.push(signal)
}

if (explanation.length === 0) {
  explanation.push("System operating within stable parameters")
}



// =====================================================
// CAPACITY FRONTIER
// =====================================================

const capacityFrontier =
  computeCapacityFrontier(
    state.regions,
    totalAvailable,
    riskScore
  )

// =====================================================
// SEMAPHORE LOGIC — HYSTERESIS STABILIZATION
// =====================================================

const frontier = capacityFrontier

let semaphore = computeSemaphore(
  coverageRatio,
  finalRisk,
  riskVelocity,
  patienceField,
  lastSemaphore
)

// override por frontera física

if (requestedVolume > frontier.yellowLimit) {
  semaphore = "red"
}

else if (requestedVolume > frontier.greenLimit) {
  semaphore = "yellow"
}

lastSemaphore = semaphore









return {

  semaphore,
  riskScore,
  coverageRatio,
  explanation,

  decisionZones: {

    greenLimit: capacityFrontier.greenLimit,

    yellowLimit: capacityFrontier.yellowLimit,

    maxLimit: capacityFrontier.effectiveMax

  }

}
}