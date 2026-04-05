// =====================================================
// REGIME LEARNING — STRUCTURAL STATE DETECTOR
// Aprende patrones de tensión y clasifica régimen.
// =====================================================

import { getDecisionMemorySnapshot } from "@/src/brain/cognitiveMemory"

export type SystemRegime =
  | "stable"
  | "tightening"
  | "stressed"
  | "recovery"

let lastRegime: SystemRegime = "stable"

export function getSystemRegime(): SystemRegime {

  const m = getDecisionMemorySnapshot()

 const stressLevel =
  m.volatility * 0.5 +
  Math.max(0, m.stressTrend) * 0.5

  const trend =
    m.stressTrend

  const instability =
    m.instability

  // ===== REGIME LOGIC =====

  if (stressLevel > 0.75 || instability > 0.6)
    lastRegime = "stressed"

  else if (trend > 0.02)
    lastRegime = "tightening"

  else if (trend < -0.02)
    lastRegime = "recovery"

  else
    lastRegime = "stable"

  return lastRegime

}