// =====================================================
// DECISION MOMENTUM — COGNITIVE INERTIA
// evita cambios bruscos de decisión
// =====================================================

export function updateDecisionMomentum(
  lastSemaphore: "green" | "yellow" | "red",
  decisionMomentum: number
) {

  const momentumSignal =
    (lastSemaphore === "green" ? -0.2 :
     lastSemaphore === "yellow" ? 0 :
     0.2)

  const nextMomentum =
    decisionMomentum * 0.85 +
    momentumSignal * 0.15

  return nextMomentum

}