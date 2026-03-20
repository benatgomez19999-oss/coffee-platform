// =====================================================
// DECISION MEMORY — ADAPTIVE COGNITIVE MEMORY
// Memoria viva del comportamiento de decisiones.
// Detecta patrones, deriva e inestabilidad.
// =====================================================

type DecisionRecord = {

  timestamp: number

  unifiedPressure: number
  adaptiveStress: number

  trafficState: "green" | "yellow" | "red"
  semaphoreState: "green" | "yellow" | "red"

  confidence: number
  suggestedVolume?: number

}

const history: DecisionRecord[] = []

const MAX_HISTORY = 500

// =====================================================
// RECORD DECISION
// =====================================================

export function recordDecision(record: DecisionRecord) {

  history.push(record)

  if (history.length > MAX_HISTORY) {
    history.shift()
  }

}

// =====================================================
// MEMORY ANALYTICS
// Señales emergentes del comportamiento.
// =====================================================

export function getDecisionMemorySnapshot() {

  if (history.length < 5) {

    return {
      volatility: 0,
      stressTrend: 0,
      confidenceDrift: 0,
      instability: 0
    }

  }

  const last = history.slice(-20)

  // ===== volatility =====
  let transitions = 0

  for (let i = 1; i < last.length; i++) {

    if (last[i].semaphoreState !== last[i - 1].semaphoreState) {
      transitions++
    }

  }

  const volatility = transitions / last.length

  // ===== stress trend =====
  const stressValues = last.map(r => r.adaptiveStress)

  const stressTrend =
    stressValues[stressValues.length - 1] - stressValues[0]

  // ===== confidence drift =====
  const confValues = last.map(r => r.confidence)

  const confidenceDrift =
    confValues[confValues.length - 1] - confValues[0]

  // ===== instability signal =====
  const instability =
    volatility * 0.4 +
    Math.max(0, stressTrend) * 0.4 +
    Math.max(0, -confidenceDrift) * 0.2

  return {

    volatility,
    stressTrend,
    confidenceDrift,
    instability

  }

}

// =====================================================
// OPTIONAL — RAW ACCESS
// =====================================================

export function getDecisionHistory() {
  return history
}

// =====================================================
// LEARNING SIGNAL — ADAPTIVE FEEDBACK
// Deriva señales de prudencia a partir de decision memory.
// Hardened — estable ante shocks y ruido.
// =====================================================


const clamp01 = (x: number) =>
  Math.max(0, Math.min(1, x))

export function getLearningSignal() {

  // snapshot agregado del histórico reciente
  const snapshot = getDecisionMemorySnapshot()

  // ===============================
  // CONSERVATISM — prudencia sistémica
  // Aumenta bajo volatilidad, estrés ascendente e inestabilidad
  // ===============================

  const conservatism = clamp01(
    snapshot.volatility * 0.4 +
    Math.max(0, snapshot.stressTrend) * 0.4 +
    snapshot.instability * 0.2
  )

  // ===============================
  // CAUTION BOOST — refuerzo de buffers
  // Se activa cuando la confianza cae
  // ===============================

  const cautionBoost = clamp01(
    Math.max(0, -snapshot.confidenceDrift)
  )

  // ===============================
  // OUTPUT
  // ===============================

  return {

    conservatism, // endurece decisiones
    cautionBoost, // expande buffers
    instability: clamp01(snapshot.instability)

  }

}
