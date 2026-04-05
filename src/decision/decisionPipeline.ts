// =====================================================
// DECISION PIPELINE — SYSTEM ORCHESTRATOR
// Coordina evaluación completa de disponibilidad.
// Ejecuta diagnóstico → decisión → sugerencia → memoria.
// Independiente de UI.
// =====================================================

import { evaluateSemaphore } from "@/src/decision/semaphoreEvaluator"
import { suggestVolume } from "@/src/decision/volumeSuggestion"
import { recordDecision, getLearningSignal } from "@/src/brain/cognitiveMemory"
import { getSystemRegime } from "@/src/brain/regimeLearning"
import { getSignals } from "@/src/signals/signalRegistry"

// =====================================================
// MODULE STATE — DECISION PIPELINE MEMORY LAYER
// Estado persistente interno del pipeline.
// No depende de UI.
// Se mantiene entre ticks.
// =====================================================

let decisionDriftState: { signal: number } | null = null
let decisionMomentumSignalState: { signal: number } | null = null

let lastDecisionConfidenceState: number | null = null
let prevConfidenceState: number | null = null

let decisionAnomaliesState: string[] = []

let lastDecisionState: {
  semaphoreState: "green" | "yellow" | "red"
  confidence: number
} | null = null

let decisionHysteresisState: {
  state: "green" | "yellow" | "red"
  confidence: number
} | null = null

let decisionMomentumState: {
  score: number
  state: "green" | "yellow" | "red"
} | null = null

export interface DecisionInput {
  requestedVolume: number
  availableNow: number
  forecastIncoming: number

  riskScore: number
  adaptiveStress: number

  clientPriority: number
  safetyBuffer: number
}

export interface DecisionOutput {
  trafficState: "green" | "yellow" | "red"
  semaphoreState: "green" | "yellow" | "red"

  suggestedVolume?: number
  confidence: number

  explanation: string[]
}

export function runDecisionPipeline(
  input: DecisionInput
): DecisionOutput {
  const signals = getSignals()
  const learning = getLearningSignal()
  const regime = getSystemRegime()

  // =====================================================
  // SIGNAL SNAPSHOT — CONSISTENT READ
  // Congela señales en este tick para coherencia temporal.
  // =====================================================
  const collapseProximity = signals.collapseProximity ?? 0

  const regimeMultiplier = (() => {
    switch (regime) {
      case "stressed":
        return 1.3

      case "tightening":
        return 1.15

      case "recovery":
        return 0.9

      default:
        return 1
    }
  })()

  // =====================================================
  // SEMAPHORE — DECISIÓN ADAPTATIVA
  // Considera presión sistémica y resiliencia.
  // =====================================================
  const semaphore = evaluateSemaphore({
    requestedVolume: input.requestedVolume,
    availableNow: input.availableNow,
    forecastIncoming: input.forecastIncoming,

    riskScore: input.riskScore,
    clientPriority: input.clientPriority,
    safetyBuffer: input.safetyBuffer,

    adaptiveStress:
      (input.adaptiveStress + learning.conservatism * 0.3) *
      regimeMultiplier
  })

  // =====================================================
  // VOLUME SUGGESTION — AJUSTE BAJO INCERTIDUMBRE
  // Solo se calcula si no hay aprobación directa.
  // =====================================================
  let suggestedVolume: number | undefined

  if (semaphore.status !== "green") {
    const suggestion = suggestVolume({
      requestedVolume: input.requestedVolume,
      availableCapacity: input.availableNow,
      forecastBuffer: input.forecastIncoming,
      clientPriority: input.clientPriority
    })

    suggestedVolume = suggestion.suggestedVolume
  }

  // =====================================================
  // OUTPUT COMPUESTO
  // =====================================================
  const output: DecisionOutput = {
    trafficState: semaphore.status,
    semaphoreState: semaphore.status,

    suggestedVolume,
    confidence: semaphore.confidence,

    explanation: [semaphore.reason]
  }

  // =====================================================
  // REGIME ANTICIPATION — EARLY WARNING
  // Detecta transición estructural antes de confirmarse.
  // =====================================================
  const anticipationSignal =
    learning.instability * 0.5 +
    learning.conservatism * 0.3 +
    Math.max(0, input.adaptiveStress - 0.5) * 0.2

  const anticipatingShift = anticipationSignal > 0.4

  if (anticipatingShift) {
    output.explanation.push("Regime shift anticipated")
  }

  // =====================================================
  // CONFIDENCE DECAY — EVIDENCE AGING
  // Reduce confianza si no hay señales nuevas.
  // Evita sobreconfianza en entornos aparentemente estables.
  // Usa horizonte previo (tick anterior).
  // =====================================================
  const decaySignal =
    1 - (
      learning.instability * 0.4 +
      learning.conservatism * 0.3 +
      Math.min(1, input.adaptiveStress) * 0.3
    )

  // decay solo si entorno demasiado "silencioso"
  if (decaySignal > 0.6) {
    const horizon = signals.confidenceHorizon ?? 0.5

    const decayFactor = Math.min(
      0.15,
      decaySignal * 0.1 * (1 + (1 - horizon))
    )

    output.confidence =
      Math.max(0, output.confidence - decayFactor)

    output.explanation.push(
      "Confidence decayed due to low signal"
    )
  }

  // =====================================================
  // META CONFIDENCE — SELF TRUST EVALUATION
  // Evalúa si el sistema debería confiar en su propia confianza.
  // =====================================================
  const metaConfidence =
    1 - (
      learning.instability * 0.35 +
      Math.max(0, learning.conservatism - 0.3) * 0.25 +
      Math.min(1, input.adaptiveStress) * 0.4
    )

  if (metaConfidence < 0.7) {
    const dampening = (0.7 - metaConfidence) * 0.2

    output.confidence =
      Math.max(0, output.confidence - dampening)

    output.explanation.push(
      "Meta confidence reduced decision certainty"
    )
  }

  // =====================================================
  // COGNITIVE-PHYSICAL COHERENCE — ALIGNMENT SIGNAL
  // Detecta desacople entre percepción del brain y estado físico.
  // Evita sobre-reacción cuando no están alineados.
  // =====================================================
  const physicalStress =
    Math.min(
      1,
      input.adaptiveStress + learning.instability * 0.2
    )

  // presión cognitiva aproximada (brain ya sintetiza en riskScore)
  const cognitiveStress = Math.min(1, input.riskScore)

  const coherenceGap =
    Math.abs(cognitiveStress - physicalStress)

  const coherence = 1 - coherenceGap

  if (coherence < 0.6) {
    output.explanation.push(
      "Cognitive-physical mismatch detected"
    )
  }

  // =====================================================
  // DECISION ENTROPY — UNCERTAINTY MEASURE
  // Cuantifica desorden estructural del entorno.
  // =====================================================
  const entropy =
    learning.instability * 0.4 +
    Math.abs(learning.conservatism - 0.5) * 0.2 +
    Math.min(1, input.adaptiveStress) * 0.4

  if (entropy > 0.6) {
    const entropyPenalty = (entropy - 0.6) * 0.25

    const shockMemory = signals.shockMemory ?? 0

    output.confidence =
      Math.max(0, output.confidence - shockMemory * 0.08)

    output.confidence =
      Math.max(0, output.confidence - entropyPenalty)

    output.explanation.push(
      "High entropy reduced confidence"
    )
  }

  // =====================================================
  // DECISION DRIFT — EXPECTATION SHIFT DETECTOR
  // Detecta cambios graduales en el entorno.
  // Persistente — module scoped.
  // =====================================================
  const lastDrift = decisionDriftState

  const driftSignal =
    Math.abs(input.adaptiveStress - 0.5) * 0.4 +
    learning.instability * 0.3 +
    Math.abs(learning.conservatism - 0.5) * 0.3

  let driftDelta = 0

  if (lastDrift) {
    driftDelta =
      Math.abs(driftSignal - lastDrift.signal)
  }

  if (driftDelta > 0.15) {
    output.explanation.push(
      "Environment drift detected"
    )
  }

  // persistencia
  decisionDriftState = {
    signal: driftSignal
  }

  // =====================================================
  // EXPECTATION MOMENTUM — CHANGE VELOCITY
  // Detecta aceleración del entorno.
  // Determinista.
  // =====================================================
  const lastMomentum = decisionMomentumSignalState

  const momentumSignal =
    learning.instability * 0.4 +
    Math.abs(input.adaptiveStress - 0.5) * 0.3 +
    Math.abs(learning.conservatism - 0.5) * 0.3

  let momentumDelta = 0

  if (lastMomentum) {
    momentumDelta =
      Math.abs(momentumSignal - lastMomentum.signal)
  }

  if (momentumDelta > 0.12) {
    output.explanation.push(
      "Environmental momentum rising"
    )

    // pequeña reducción de confianza — prudencia
    output.confidence =
      Math.max(0, output.confidence - 0.03)
  }

  // persistencia para siguiente tick
  decisionMomentumSignalState = {
    signal: momentumSignal
  }

  // =====================================================
  // REGIME INSTABILITY WARNING — EARLY CRISIS SIGNAL
  // Detecta proximidad a transición estructural.
  // =====================================================
  const warningSignal =
    learning.instability * 0.4 +
    Math.min(1, input.adaptiveStress) * 0.3 +
    Math.abs(learning.conservatism - 0.5) * 0.3

  if (warningSignal > 0.65) {
    output.explanation.push(
      "Regime instability warning"
    )

    // prudencia adicional
    output.confidence =
      Math.max(0, output.confidence - 0.05)
  }

  // =====================================================
  // STRUCTURAL SNAPSHOT — SHOCK MEMORY
  // El pipeline solo consume estado estructural.
  // =====================================================
  const shockMemory = signals.shockMemory

  // =====================================================
  // COHERENCE ADJUSTMENT — TRUST MODULATION
  // Reduce confianza si percepción y realidad divergen.
  // =====================================================
  if (coherence < 0.7) {
    const penalty = (0.7 - coherence) * 0.15

    output.confidence =
      Math.max(0, output.confidence - penalty)
  }

  // =====================================================
  // PHASE RISK ADJUSTMENT — PRUDENCE NEAR TRANSITIONS
  // Reduce confianza cerca de bifurcaciones.
  // =====================================================
  const phaseRisk = signals.phaseRisk ?? 0

  if (phaseRisk > 0.5) {
    const penalty = (phaseRisk - 0.5) * 0.1

    output.confidence =
      Math.max(0, output.confidence - penalty)
  }

  // =====================================================
  // STRATEGIC PATIENCE FIELD — TIMING INTELLIGENCE
  // Ajusta urgencia de decisión según señales profundas.
  // =====================================================
  const patienceField =
    Math.max(
      0,
      Math.min(
        1,
        1 -
          collapseProximity * 0.5 -
          learning.instability * 0.3 -
          shockMemory * 0.2
      )
    )

  signals.patienceField = patienceField

  if (patienceField < 0.3) {
    output.explanation.push(
      "Low patience — environment fragile"
    )
  }

  // =====================================================
  // RESILIENCE ADJUSTMENT — CONFIDENCE MODULATION
  // Reduce confianza cuando la capacidad de absorción cae.
  // Persistente — module scoped.
  // =====================================================
  const resilienceBudget =
    signals.resilienceBudget ?? 1

  if (resilienceBudget < 0.5) {
    const penalty = (0.5 - resilienceBudget) * 0.25

    output.confidence =
      Math.max(0, output.confidence - penalty)

    output.explanation.push(
      "Confidence reduced — low resilience budget"
    )
  }

  // =====================================================
  // CONFIDENCE SMOOTHING — INERCIA DECISIONAL
  // Reduce jitter y ruido en la señal de confianza.
  // Persistente — module scoped.
  // =====================================================
  const lastConfidence =
    lastDecisionConfidenceState ?? output.confidence

  if (collapseProximity > 0.6) {
    const penalty = (collapseProximity - 0.6) * 0.25

    output.confidence =
      Math.max(0, output.confidence - penalty)

    output.explanation.push(
      "Collapse proximity elevated"
    )
  }

  const SMOOTHING = 0.15

  const smoothedConfidence =
    lastConfidence +
    (output.confidence - lastConfidence) * SMOOTHING

  // persistencia
  lastDecisionConfidenceState = smoothedConfidence
  output.confidence = smoothedConfidence

  // =====================================================
  // ANOMALY DETECTOR — SUPERVISIÓN OPERATIVA
  // Detecta incoherencias y condiciones anómalas.
  // Persistente — module scoped.
  // =====================================================
  const anomalyFlags: string[] = []

  // -----------------------------------------------------
  // LOW CONFIDENCE — señal crítica
  // -----------------------------------------------------
  if (output.confidence < 0.25) {
    anomalyFlags.push("low_confidence")
  }

  // -----------------------------------------------------
  // DECISION MISMATCH — inconsistencia estructural
  // -----------------------------------------------------
  if (
    output.semaphoreState === "red" &&
    output.trafficState === "green"
  ) {
    anomalyFlags.push("decision_mismatch")
  }

  // -----------------------------------------------------
  // CONFIDENCE JUMP — discontinuidad abrupta
  // -----------------------------------------------------
  const prevConfidence =
    prevConfidenceState ?? output.confidence

  if (Math.abs(output.confidence - prevConfidence) > 0.4) {
    anomalyFlags.push("confidence_jump")
  }

  // persistencia para siguiente tick
  prevConfidenceState = output.confidence

  // guardar anomalías en estado interno
  decisionAnomaliesState = anomalyFlags

  // =====================================================
  // SELF HEALING — HOMEOSTASIS ADAPTATIVA
  // Ajusta comportamiento ante condiciones anómalas.
  // Persistente — module scoped.
  // =====================================================
  let healingFactor = 1

  if (decisionAnomaliesState.length > 0) {
    // intensidad proporcional al número de anomalías
    healingFactor =
      Math.min(1.5, 1 + decisionAnomaliesState.length * 0.15)
  }

  // aplicar corrección suave
  output.confidence =
    output.confidence / healingFactor

  // endurecer decisión si está en borde
  if (
    decisionAnomaliesState.includes("low_confidence") &&
    output.semaphoreState === "yellow"
  ) {
    output.semaphoreState = "red"

    output.explanation.push(
      "Self-healing escalation applied"
    )
  }

  // =====================================================
  // DECISION INERTIA — STABILITY FILTER
  // Introduce resistencia a cambios bruscos.
  // Persistente — module scoped.
  // =====================================================
  const previousDecision = lastDecisionState

  if (previousDecision) {
    const switching =
      previousDecision.semaphoreState !== output.semaphoreState

    // IF SWITCH
    if (switching) {
      const instability =
        learning.instability ?? 0

      const horizon =
        signals.confidenceHorizon ?? 0.5

      const phaseRisk =
        signals.phaseRisk ?? 0

      const resilienceBudget =
        signals.resilienceBudget ?? 1

      const inertiaThreshold =
        (0.25 + instability * 0.4) *
        (1 + (1 - horizon) * 0.5) *
        (1 - (1 - coherence) * 0.3) *
        (1 - phaseRisk * 0.3) *
        (0.75 + resilienceBudget * 0.25)

      // bloquear cambio si confianza no es suficiente
      if (output.confidence < inertiaThreshold) {
        output.semaphoreState =
          previousDecision.semaphoreState

        output.explanation.push(
          "Decision inertia prevented rapid switch"
        )
      }
    }
  }

  // persistencia para siguiente tick
  lastDecisionState = {
    semaphoreState: output.semaphoreState,
    confidence: output.confidence
  }

  // =====================================================
  // DECISION HYSTERESIS — PERSISTENCE BAND
  // Requiere evidencia adicional para cambiar estado.
  // Adaptativo según shocks, coherencia y proximidad a transición.
  // Persistente — module scoped.
  // =====================================================
  const lastHysteresis = decisionHysteresisState

  if (lastHysteresis) {
    const prevState = lastHysteresis.state
    const nextState = output.semaphoreState

    const stateChanged = prevState !== nextState

    if (stateChanged) {
      const instability =
        learning.instability ?? 0

      const horizon =
        signals.confidenceHorizon ?? 0.5

      const shockMemory =
        signals.shockMemory ?? 0

      const phaseRisk =
        signals.phaseRisk ?? 0

      // ==================================================
      // HYSTERESIS BAND — FULL ADAPTIVE
      // ==================================================
      let hysteresisBand =
        (0.15 + instability * 0.3) +
        shockMemory * 0.1 +
        coherence * 0.05 -
        (1 - coherence) * 0.08

      // modulación temporal — horizonte ajusta rigidez
      hysteresisBand *= (0.9 + horizon * 0.2)

      // modulación estructural — cerca de transición permite cambio
      hysteresisBand *= (1 - phaseRisk * 0.25)

      // clamp para estabilidad numérica
      hysteresisBand =
        Math.max(0.05, Math.min(0.9, hysteresisBand))

      // si el cambio no supera banda → mantener estado
      if (output.confidence < 1 - hysteresisBand) {
        output.semaphoreState = prevState

        output.explanation.push(
          "Hysteresis held previous state (adaptive)"
        )
      }
    }
  }

  // persistencia para siguiente tick
  decisionHysteresisState = {
    state: output.semaphoreState,
    confidence: output.confidence
  }

  // =====================================================
  // DECISION HYSTERESIS — ASYMMETRIC PERSISTENCE
  // Cambios hacia riesgo son rápidos.
  // Recuperación requiere evidencia adicional.
  // Persistente — module scoped.
  // =====================================================
  type SemaphoreState = "green" | "yellow" | "red"

  const hysteresisMemory = decisionHysteresisState

  if (hysteresisMemory) {
    const prevState = hysteresisMemory.state
    const nextState = output.semaphoreState as SemaphoreState

    const stateChanged = prevState !== nextState

    if (stateChanged) {
      const instability =
        learning.instability ?? 0

      // mapa de severidad
      const severity: Record<SemaphoreState, number> = {
        green: 0,
        yellow: 1,
        red: 2
      }

      const movingToMoreRestrictive =
        severity[nextState] > severity[prevState]

      // bandas asimétricas
      const band =
        movingToMoreRestrictive
          ? 0.1 + instability * 0.2 // escalar rápido
          : 0.25 + instability * 0.4 // recuperar lento

      if (output.confidence < 1 - band) {
        output.semaphoreState = prevState

        output.explanation.push(
          movingToMoreRestrictive
            ? "Hysteresis softened escalation"
            : "Hysteresis slowed recovery"
        )
      }
    }
  }

  // persistencia para siguiente tick
  decisionHysteresisState = {
    state: output.semaphoreState,
    confidence: output.confidence
  }

  // =====================================================
  // DECISION MOMENTUM — TEMPORAL SMOOTHING
  // Requiere persistencia de señal para cambiar decisión.
  // Reduce jitter bajo ruido.
  // Persistente — module scoped.
  // =====================================================
  type MomentumMemory = {
    score: number
    state: "green" | "yellow" | "red"
  }

  const momentumMemory = decisionMomentumState ?? undefined

  const prevScore = momentumMemory?.score ?? 0
  const targetScore = output.confidence

  // velocidad adaptativa — más lenta si hay inestabilidad
  const instability = learning.instability ?? 0

  const alpha = 0.15 * (1 - instability * 0.5)

  // smoothing exponencial
  const smoothedScore =
    prevScore + (targetScore - prevScore) * alpha

  // si la señal aún no es suficientemente fuerte → mantener estado previo
  if (momentumMemory) {
    const delta = Math.abs(smoothedScore - prevScore)

    const horizon = signals.confidenceHorizon ?? 0.5

    const threshold =
      (0.05 + instability * 0.1) *
      (1 - horizon * 0.3)

    if (delta < threshold) {
      output.explanation.push(
        "Momentum held state — insufficient signal persistence"
      )
    }
  }

  // persistencia para siguiente tick
  decisionMomentumState = {
    score: smoothedScore,
    state: output.semaphoreState
  }

  // =====================================================
  // DECISION MEMORY — TELEMETRÍA OPERATIVA
  // Permite análisis histórico y aprendizaje futuro.
  // =====================================================
  recordDecision({
    timestamp: Date.now(),

    unifiedPressure: input.riskScore,
    adaptiveStress: input.adaptiveStress,

    trafficState: semaphore.status,
    semaphoreState: semaphore.status,

    confidence: semaphore.confidence,
    suggestedVolume
  })

  // =====================================================
  // RUNTIME TRACE — SYSTEM INTROSPECTION
  // Permite entender comportamiento en tiempo real.
  // =====================================================
  if (process.env.NODE_ENV === "development") {
    console.log("🧠 Decision Trace", {
      regime,
      learning,

      requested: input.requestedVolume,
      traffic: semaphore.status,
      semaphore: semaphore.status,

      confidence: semaphore.confidence,
      suggestedVolume
    })
  }

  if (!Number.isFinite(semaphore.confidence)) {
    console.warn("⚠️ Invalid decision confidence")
  }

  return output
}