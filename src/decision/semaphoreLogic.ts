// =====================================================
// SEMAPHORE LOGIC — DECISION OUTPUT
// =====================================================

export function computeSemaphore(
  coverageRatio: number,
  decisionRisk: number,
  riskVelocity: number,
  patienceField: number,
  lastSemaphore: "green" | "yellow" | "red"
) {

  let semaphore = lastSemaphore

  // =====================================================
  // RED ZONE — structural shortage or extreme risk
  // =====================================================

  if (
    coverageRatio < 0.6 ||
    decisionRisk > 0.8 ||
    riskVelocity > 0.2
  ) {

    semaphore = "red"

  }

  // =====================================================
  // GREEN ZONE — safe execution
  // =====================================================

 else if (

  coverageRatio >= 2 ||

  (
    coverageRatio >= 1.2 &&
    decisionRisk < 0.55
  )

) {
  semaphore = "green"
}

  // =====================================================
  // YELLOW ZONE — review / negotiation
  // =====================================================

  else {

    semaphore = "yellow"

  }

  return semaphore
}