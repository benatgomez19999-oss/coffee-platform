//////////////////////////////////////////////////////
// 💸 CONTRACT PRICE DRIFT — PURE HELPER (CONTRACT-REQUEST-2)
//
// Compares the price the buyer saw when their DemandIntent
// was created (`intent.previewPricePerKg`) with the lot's
// current B2B price right before contract creation /
// signature. If the price went UP, we block the flow and
// ask the buyer to review. If it went DOWN, we allow the
// flow at the lower price (favourable for the buyer).
//
// Why not store the preview price differently? Because
// `previewPricePerKg` IS the contract — the buyer signed
// up at that price. We never silently sign at a different
// number.
//
// Pure. No Prisma. No HTTP. Tested under node --test.
//////////////////////////////////////////////////////

//////////////////////////////////////////////////////
// CONSTANTS
//////////////////////////////////////////////////////

// €0.01/kg absolute tolerance — anything smaller is just
// floating-point / rounding noise after the producer pricing
// engine. Picked deliberately small because the buyer reads
// the price to the cent.
export const CONTRACT_PRICE_DRIFT_TOLERANCE_EUR = 0.01

//////////////////////////////////////////////////////
// SHAPES
//////////////////////////////////////////////////////

export type ContractPriceDriftStatus =
  | "MATCH"
  | "LOWER_CURRENT_PRICE"
  | "HIGHER_CURRENT_PRICE"
  | "MISSING_INTENT_PRICE"
  | "MISSING_CURRENT_PRICE"

export type ContractPriceDriftResult = {
  status: ContractPriceDriftStatus
  blocking: boolean
  delta: number | null         // currentPrice - previewPrice, EUR/kg (rounded to 4 decimals)
  deltaPercent: number | null  // 100 × delta / previewPrice (rounded to 2 decimals)
  message: string
  // Echoed for the route layer so the 409 response can show
  // both numbers without re-fetching.
  previewPricePerKg: number | null
  currentPricePerKg: number | null
}

export type EvaluateContractPriceDriftInput = {
  intentPreviewPricePerKg: number | null | undefined
  currentPricePerKg: number | null | undefined
  absoluteTolerance?: number
}

//////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////

function isUsable(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

//////////////////////////////////////////////////////
// POLICY (documented + tested)
//
//   MATCH                 — non-blocking. Proceed.
//   LOWER_CURRENT_PRICE   — non-blocking. The lot got
//                           cheaper since the buyer's request,
//                           which is favourable. We sign at
//                           the new lower price. UI may show a
//                           soft notice; server proceeds.
//   HIGHER_CURRENT_PRICE  — blocking. The lot got more
//                           expensive. The buyer must review
//                           the new price.
//   MISSING_INTENT_PRICE  — blocking. Defensive: an intent
//                           without a preview price should not
//                           translate into a contract.
//   MISSING_CURRENT_PRICE — blocking. Same: we can't quote
//                           a price we can't read.
//
// "Material" drift = |delta| > absoluteTolerance.
//////////////////////////////////////////////////////

export function evaluateContractPriceDrift(
  input: EvaluateContractPriceDriftInput,
): ContractPriceDriftResult {

  const tolerance =
    typeof input.absoluteTolerance === "number" &&
    Number.isFinite(input.absoluteTolerance) &&
    input.absoluteTolerance >= 0
      ? input.absoluteTolerance
      : CONTRACT_PRICE_DRIFT_TOLERANCE_EUR

  const preview = isUsable(input.intentPreviewPricePerKg)
    ? input.intentPreviewPricePerKg
    : null
  const current = isUsable(input.currentPricePerKg)
    ? input.currentPricePerKg
    : null

  if (preview === null) {
    return {
      status: "MISSING_INTENT_PRICE",
      blocking: true,
      delta: null,
      deltaPercent: null,
      message:
        "We can't confirm the price you saw when this request was created. Please create a new request.",
      previewPricePerKg: null,
      currentPricePerKg: current,
    }
  }

  if (current === null) {
    return {
      status: "MISSING_CURRENT_PRICE",
      blocking: true,
      delta: null,
      deltaPercent: null,
      message:
        "We can't read the current price for this lot. Please try again in a moment or create a new request.",
      previewPricePerKg: preview,
      currentPricePerKg: null,
    }
  }

  const delta = round4(current - preview)
  const deltaPercent = round2((delta / preview) * 100)

  if (Math.abs(delta) <= tolerance) {
    return {
      status: "MATCH",
      blocking: false,
      delta,
      deltaPercent,
      message: "Price is unchanged since your request.",
      previewPricePerKg: preview,
      currentPricePerKg: current,
    }
  }

  if (delta > 0) {
    return {
      status: "HIGHER_CURRENT_PRICE",
      blocking: true,
      delta,
      deltaPercent,
      message:
        "This lot's price changed since your request. Please review the updated price before continuing.",
      previewPricePerKg: preview,
      currentPricePerKg: current,
    }
  }

  // delta < 0 — current is lower than the preview.
  return {
    status: "LOWER_CURRENT_PRICE",
    blocking: false,
    delta,
    deltaPercent,
    message:
      "Good news — the current price is lower than your original request.",
    previewPricePerKg: preview,
    currentPricePerKg: current,
  }
}
