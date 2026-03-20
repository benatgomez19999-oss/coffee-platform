export function computeSupplySecurityIndex(
  coverageRatio: number,
  riskScore: number,
  totalAvailable: number,
  monthlyDemand: number
) {

  // ------------------------------------------------
  // coverage ratio contribution (max 50)
  // ------------------------------------------------

  const coverageScore =
    Math.min(1, coverageRatio) * 50

  // ------------------------------------------------
  // risk score contribution (inverse, max 30)
  // ------------------------------------------------

  const riskScoreInverse =
    (1 - Math.min(1, riskScore)) * 30

  // ------------------------------------------------
  // supply buffer contribution (max 20)
  // ------------------------------------------------

  const bufferRatio =
    monthlyDemand === 0
      ? 0
      : totalAvailable / monthlyDemand

  const bufferScore =
    Math.min(1, bufferRatio) * 20

  const raw =
    coverageScore +
    riskScoreInverse +
    bufferScore

  return Math.round(Math.min(100, raw))

}