import { prisma } from "@/src/database/prisma"
import { DemandIntentStatus } from "@prisma/client"
import { evaluateSemaphore, SemaphoreResult } from "@/src/decision/semaphoreEvaluator"
import { getContractableSupply } from "@/src/services/system/supply.service"
import { resolveRoastYield, roastedToGreen, computeRoastedPrice } from "@/src/lib/roastYield"
import { resolveClientB2BPriceForLot } from "@/src/services/pricing/clientB2BPrice"
import { evaluateContractPriceDrift } from "@/src/services/contract-request/contractPriceDrift.pure"

// =====================================================
// DEMAND INTENT SERVICE
//
// Manages the DemandIntent lifecycle:
//   - create (evaluate semaphore, reserve supply)
//   - accept (COUNTERED → OPEN at offered volume)
//   - wait (RED → WAITING for deferred execution)
//   - confirm (WAITING → OPEN when supply available)
//   - cancel (any non-terminal → CANCELLED)
//   - getById / getByCompany
//
// UNIT SEMANTICS:
//   - requestedKg, offeredKg = ROASTED (client-facing)
//   - deltaKg = GREEN (supply reservation)
//   - roastYieldAtEval = snapshot at evaluation time
//
// Only OPEN intents reserve supply (via deltaKg).
// COUNTERED and WAITING do NOT reserve.
// =====================================================

const INTENT_TTL_HOURS = 48

export class IntentServiceError extends Error {
  code: string
  // CONTRACT-REQUEST-3 — optional detail bag so the route
  // layer can surface drift context (preview vs current
  // price) without us tucking it onto error.message.
  details?: Record<string, unknown>
  constructor(
    message: string,
    code: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "IntentServiceError"
    this.code = code
    if (details) this.details = details
  }
}

// =====================================================
// CREATE INTENT
// =====================================================

export async function createDemandIntent(input: {
  companyId: string
  greenLotId: string
  requestedKg: number       // ROASTED
  type: "CREATE" | "AMEND"
  contractId?: string
  // CONTRACT-REQUEST-3 — persisted on the intent so the
  // contract wizard hydrates the same values the buyer
  // entered in the modal, regardless of when they return.
  requestedDurationMonths?: number | null
  requestedStartDate?: Date | null
}) {

  const {
    companyId,
    greenLotId,
    requestedKg,
    type,
    contractId,
    requestedDurationMonths,
    requestedStartDate,
  } = input

  // Transactional: lot read, supply check, semaphore eval, intent create
  const result = await prisma.$transaction(async (tx) => {

    // -------------------------------------------------
    // 0. DUPLICATE GUARD (CONTRACT-REQUEST-1)
    //
    // A buyer should never hold more than one pending
    // request on the same lot — that would double-reserve
    // the same green delta and confuse the dashboard.
    // Pending = OPEN | COUNTERED | WAITING with a TTL
    // still in the future.
    // -------------------------------------------------

    const existing = await tx.demandIntent.findFirst({
      where: {
        companyId,
        greenLotId,
        status: { in: ["OPEN", "COUNTERED", "WAITING"] },
        expiresAt: { gt: new Date() },
      },
      select: { id: true, status: true },
    })

    if (existing) {
      const err = new IntentServiceError(
        "You already have a pending request for this lot.",
        "DUPLICATE_REQUEST",
      ) as IntentServiceError & { existingIntentId?: string; existingStatus?: string }
      err.existingIntentId = existing.id
      err.existingStatus = existing.status
      throw err
    }

    // -------------------------------------------------
    // 1. RESOLVE LOT + YIELD + PRICING
    // -------------------------------------------------

    const lot = await tx.greenLot.findUnique({
      where: { id: greenLotId },
      include: { pricingSnapshot: true }
    })

    if (!lot || lot.status !== "PUBLISHED") {
      throw new IntentServiceError("GreenLot not found or not published", "LOT_NOT_AVAILABLE")
    }
    if (!lot.pricingSnapshot) {
      throw new IntentServiceError("GreenLot has no pricing", "LOT_NO_PRICING")
    }

    const roastYield = resolveRoastYield(lot)
    const requestedGreenKg = roastedToGreen(requestedKg, roastYield)
    // PRICING-B2B-3 — preview must match the contract lock price.
    // Resolver prefers persisted clientB2BPricePerKg and falls back
    // to legacy green/yield for un-migrated rows.
    const resolvedB2B = resolveClientB2BPriceForLot(lot)
    const roastedPricePerKg = resolvedB2B.pricePerKgRoasted

    // -------------------------------------------------
    // 2. GET CONTRACTABLE SUPPLY (inside tx)
    // -------------------------------------------------

    const supply = await getContractableSupply({ greenLotId, tx })

    // -------------------------------------------------
    // 3. EVALUATE SEMAPHORE
    // -------------------------------------------------
    // safetyBuffer = 0 because getContractableSupply already
    // deducts SAFETY_BUFFER_KG (400). Single authoritative reserve.

    const semaphoreResult: SemaphoreResult = evaluateSemaphore({
      requestedVolume: requestedGreenKg,
      availableNow: supply.contractableKg,
      forecastIncoming: 0,
      riskScore: 0.2,
      clientPriority: 1.0,
      safetyBuffer: 0,
      adaptiveStress: 0,
    })

    // -------------------------------------------------
    // 4. DETERMINE STATUS + deltaKg
    // -------------------------------------------------

    let status: DemandIntentStatus
    let deltaKg: number
    let offeredKg: number | null = null

    if (semaphoreResult.status === "green") {
      status = "OPEN"
      deltaKg = requestedGreenKg
    } else if (semaphoreResult.status === "yellow") {
      status = "COUNTERED"
      deltaKg = 0
      if (semaphoreResult.suggestedVolume != null) {
        offeredKg = Math.round(semaphoreResult.suggestedVolume * roastYield * 10) / 10
      }
    } else {
      status = "REJECTED"
      deltaKg = 0
    }

    // -------------------------------------------------
    // 5. CREATE INTENT (inside tx)
    // -------------------------------------------------

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + INTENT_TTL_HOURS)

    const intent = await tx.demandIntent.create({
      data: {
        companyId,
        type,
        contractId: contractId ?? null,
        greenLotId,

        requestedKg,
        deltaKg,
        offeredKg,

        roastYieldAtEval: roastYield,

        priceLocked: semaphoreResult.status === "green",
        previewPricePerKg: roastedPricePerKg,

        semaphore: semaphoreResult.status,
        riskScore: semaphoreResult.confidence,
        availableAtEval: supply.contractableKg,

        // CONTRACT-REQUEST-3 — buyer's request parameters.
        // Persisted alongside the price so the contract
        // wizard hydrates identically whether the buyer
        // continues immediately or returns days later.
        requestedDurationMonths: requestedDurationMonths ?? null,
        requestedStartDate: requestedStartDate ?? null,

        status,
        expiresAt,
      }
    })

    return { intent, semaphore: semaphoreResult }
  })

  return result
}

// =====================================================
// ACCEPT COUNTEROFFER → OPEN
// =====================================================

export async function acceptCounteroffer(input: {
  intentId: string
  companyId: string
}) {
  const { intentId, companyId } = input

  // Pre-flight check (outside transaction — fast fail)
  const preflight = await prisma.demandIntent.findUnique({
    where: { id: intentId }
  })

  if (!preflight) {
    throw new IntentServiceError("Intent not found", "NOT_FOUND")
  }
  if (preflight.companyId !== companyId) {
    throw new IntentServiceError("Forbidden", "FORBIDDEN")
  }
  if (preflight.status !== "COUNTERED") {
    throw new IntentServiceError(
      `Cannot accept — status is ${preflight.status}, expected COUNTERED`,
      "INVALID_STATUS"
    )
  }

  // Transactional: re-read, validate supply, then reserve
  const updated = await prisma.$transaction(async (tx) => {

    const intent = await tx.demandIntent.findUnique({
      where: { id: intentId }
    })

    if (!intent || intent.status !== "COUNTERED") {
      throw new IntentServiceError("Intent no longer COUNTERED", "INVALID_STATUS")
    }
    if (!intent.offeredKg || !intent.roastYieldAtEval) {
      throw new IntentServiceError("No counteroffer available", "NO_OFFER")
    }

    const offeredGreenKg = roastedToGreen(intent.offeredKg, intent.roastYieldAtEval)

    const supply = await getContractableSupply({
      greenLotId: intent.greenLotId ?? undefined,
      tx,
    })

    if (offeredGreenKg > supply.contractableKg) {
      throw new IntentServiceError(
        `Offered ${intent.offeredKg}kg roasted (${offeredGreenKg.toFixed(1)}kg green) exceeds contractable supply of ${supply.contractableKg}kg green`,
        "INSUFFICIENT_SUPPLY"
      )
    }

    return tx.demandIntent.update({
      where: { id: intentId },
      data: {
        status: "OPEN",
        requestedKg: intent.offeredKg,
        deltaKg: offeredGreenKg,
      }
    })
  })

  return updated
}

// =====================================================
// WAIT — REJECTED → WAITING (deferred execution)
// =====================================================

export async function waitForSupply(input: {
  intentId: string
  companyId: string
  autoExecute?: boolean
}) {
  const { intentId, companyId, autoExecute } = input

  const intent = await prisma.demandIntent.findUnique({
    where: { id: intentId }
  })

  if (!intent) {
    throw new IntentServiceError("Intent not found", "NOT_FOUND")
  }
  if (intent.companyId !== companyId) {
    throw new IntentServiceError("Forbidden", "FORBIDDEN")
  }
  if (intent.status !== "REJECTED") {
    throw new IntentServiceError(
      `Cannot wait — status is ${intent.status}, expected REJECTED`,
      "INVALID_STATUS"
    )
  }

  // WAITING does NOT reserve supply (deltaKg stays 0)
  const updated = await prisma.demandIntent.update({
    where: { id: intentId },
    data: {
      status: "WAITING",
      autoExecute: autoExecute ?? false,
    }
  })

  return updated
}

// =====================================================
// CONFIRM — WAITING → OPEN (supply now available)
// Requires explicit client confirmation unless autoExecute
// =====================================================

export async function confirmWaiting(input: {
  intentId: string
  companyId: string
}) {
  const { intentId, companyId } = input

  // Pre-flight check (outside transaction — fast fail)
  const preflight = await prisma.demandIntent.findUnique({
    where: { id: intentId }
  })

  if (!preflight) {
    throw new IntentServiceError("Intent not found", "NOT_FOUND")
  }
  if (preflight.companyId !== companyId) {
    throw new IntentServiceError("Forbidden", "FORBIDDEN")
  }
  if (preflight.status !== "WAITING") {
    throw new IntentServiceError(
      `Cannot confirm — status is ${preflight.status}, expected WAITING`,
      "INVALID_STATUS"
    )
  }

  // Transactional: re-read, validate supply, then reserve
  const updated = await prisma.$transaction(async (tx) => {

    const intent = await tx.demandIntent.findUnique({
      where: { id: intentId }
    })

    if (!intent || intent.status !== "WAITING") {
      throw new IntentServiceError("Intent no longer WAITING", "INVALID_STATUS")
    }

    const roastYield = intent.roastYieldAtEval ?? 0.84
    const requestedGreenKg = roastedToGreen(intent.requestedKg, roastYield)

    const supply = await getContractableSupply({
      greenLotId: intent.greenLotId ?? undefined,
      tx,
    })

    if (requestedGreenKg > supply.contractableKg) {
      throw new IntentServiceError(
        "Supply still insufficient — cannot confirm",
        "INSUFFICIENT_SUPPLY"
      )
    }

    // CONTRACT-REQUEST-3 — price drift guard.
    //
    // The buyer placed this request at intent.previewPricePerKg.
    // Before we flip WAITING → OPEN (which is what makes the
    // request "active" again from a UX point of view), check
    // that the lot's current B2B price hasn't drifted UP. If
    // it has, surface a 409 PRICE_DRIFT_REQUIRES_REVIEW and
    // leave the intent in WAITING. The buyer can then create
    // a new request at the new price, knowingly.
    //
    // Lower / matching prices are allowed — the eventual
    // contract creation re-runs the same drift evaluator and
    // locks the lower number (CONTRACT-REQUEST-2). We never
    // mutate intent.previewPricePerKg here.
    let currentPricePerKg: number | null = null
    if (intent.greenLotId) {
      const lot = await tx.greenLot.findUnique({
        where: { id: intent.greenLotId },
        include: { pricingSnapshot: true },
      })
      if (lot) {
        const resolved = resolveClientB2BPriceForLot(lot)
        if (Number.isFinite(resolved.pricePerKgRoasted)) {
          currentPricePerKg = resolved.pricePerKgRoasted
        }
      }
    }

    const drift = evaluateContractPriceDrift({
      intentPreviewPricePerKg: intent.previewPricePerKg,
      currentPricePerKg,
    })

    if (drift.blocking) {
      throw new IntentServiceError(
        drift.message,
        "PRICE_DRIFT_REQUIRES_REVIEW",
        {
          previewPricePerKg: drift.previewPricePerKg,
          currentPricePerKg: drift.currentPricePerKg,
          driftStatus: drift.status,
          delta: drift.delta,
          deltaPercent: drift.deltaPercent,
        },
      )
    }

    return tx.demandIntent.update({
      where: { id: intentId },
      data: {
        status: "OPEN",
        deltaKg: requestedGreenKg,
        // Note: we deliberately do NOT touch previewPricePerKg.
        // It remains the buyer's remembered price. Contract
        // creation re-runs the drift check and signs at the
        // lower of preview vs current.
      }
    })
  })

  return updated
}

// =====================================================
// CANCEL — any non-terminal → CANCELLED
// =====================================================

export async function cancelIntent(input: {
  intentId: string
  companyId: string
}) {
  const { intentId, companyId } = input

  const intent = await prisma.demandIntent.findUnique({
    where: { id: intentId }
  })

  if (!intent) {
    throw new IntentServiceError("Intent not found", "NOT_FOUND")
  }
  if (intent.companyId !== companyId) {
    throw new IntentServiceError("Forbidden", "FORBIDDEN")
  }

  const terminalStatuses: DemandIntentStatus[] = ["CONSUMED", "EXPIRED", "CANCELLED"]
  if (terminalStatuses.includes(intent.status)) {
    throw new IntentServiceError(
      `Cannot cancel — status is already ${intent.status}`,
      "ALREADY_TERMINAL"
    )
  }

  const updated = await prisma.demandIntent.update({
    where: { id: intentId },
    data: {
      status: "CANCELLED",
      deltaKg: 0,
    }
  })

  return updated
}

// =====================================================
// QUERIES
// =====================================================

export async function getIntentById(intentId: string, companyId: string) {
  const intent = await prisma.demandIntent.findUnique({
    where: { id: intentId },
    include: { greenLot: { include: { farm: true } } }
  })

  if (!intent) {
    throw new IntentServiceError("Intent not found", "NOT_FOUND")
  }
  if (intent.companyId !== companyId) {
    throw new IntentServiceError("Forbidden", "FORBIDDEN")
  }

  return intent
}

export async function getIntentsByCompany(companyId: string) {
  return prisma.demandIntent.findMany({
    where: {
      companyId,
      status: { notIn: ["EXPIRED", "CANCELLED", "CONSUMED", "REJECTED"] },
      expiresAt: { gt: new Date() },
    },
    include: { greenLot: { include: { farm: true } } },
    orderBy: { createdAt: "desc" }
  })
}
