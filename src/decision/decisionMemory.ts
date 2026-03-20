// =====================================================
// DECISION MEMORY — OBSERVABILITY BUFFER
// Almacena historial reciente de decisiones.
// Permite trazabilidad sin acoplar UI.
// =====================================================

export interface DecisionRecord {

  timestamp: number

  unifiedPressure: number
  adaptiveStress: number

  trafficState: "green" | "yellow" | "red"
  semaphoreState: "green" | "yellow" | "red"

  confidence: number

  suggestedVolume?: number

}

const MAX_RECORDS = 200

const memory: DecisionRecord[] = []

export function recordDecision(entry: DecisionRecord) {

  memory.push(entry)

  if (memory.length > MAX_RECORDS) {
    memory.shift()
  }

}

export function getDecisionHistory() {
  return memory
}