// =====================================================
// SIGNAL FIREWALL — NUMERICAL STABILITY LAYER
// Protege contra NaN, drift explosivo y señales corruptas.
// =====================================================

export function safeSignal(
  value: number,
  {
    min = -Infinity,
    max = Infinity,
    fallback = 0,
    maxStep = Infinity,
    previous = value
  }: {
    min?: number
    max?: number
    fallback?: number
    maxStep?: number
    previous?: number
  } = {}
) {

  // invalid number → fallback
  if (!Number.isFinite(value)) {
    return fallback
  }

  // clamp físico
  let next =
    Math.max(min, Math.min(max, value))

  // limitar salto brusco
  const delta = next - previous

  if (Math.abs(delta) > maxStep) {
    next =
      previous + Math.sign(delta) * maxStep
  }

  return next

}