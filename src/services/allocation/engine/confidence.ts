//////////////////////////////////////////////////////
// ⚖️ ALLOCATION CONFIDENCE
//
// Deterministic 0.35..1 score reflecting how trustworthy
// a single allocation decision is given the inputs we
// observed. Lower confidence = the UI should show the
// "best-effort" badge / nudge an operator to review.
//
// Pure function — no external state, no Date.now().
//////////////////////////////////////////////////////

export function computeAllocationConfidence(input: {
  usedDefaultRoastYield: boolean
  hasScaScore: boolean
  hasPricing: boolean
  hasFarmRegion: boolean
  hasAltitude: boolean
  viableProfileCount: number
  hasBlockingReason: boolean
}): number {
  let c = 1

  // Yield is the single largest source of conversion error.
  // Default fallback (process-based) is materially less
  // trustworthy than a measured value.
  if (input.usedDefaultRoastYield) c -= 0.15

  // Quality signal absent — premium / exclusive routes
  // can't be applied with confidence.
  if (!input.hasScaScore) c -= 0.10

  // No pricing → engine should HOLD, but if a caller
  // forces a decision through, signal low trust here too.
  if (!input.hasPricing) c -= 0.20

  // Provenance cues. Each missing cue knocks a small
  // amount off — they accumulate when many are absent.
  if (!input.hasFarmRegion) c -= 0.05
  if (!input.hasAltitude) c -= 0.05

  // No viable contract profile = the lot is fully on the
  // marketplace path; not a defect, but slightly less
  // certain because we can't validate against any segment.
  if (input.viableProfileCount === 0) c -= 0.05

  // A blocking reason already routes the decision to
  // HOLD. Low confidence is the audit signal.
  if (input.hasBlockingReason) c -= 0.20

  // Floor + round to 2 decimals.
  if (c < 0.35) c = 0.35
  if (c > 1) c = 1
  return Math.round(c * 100) / 100
}
