import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { ContractStatus } from "@prisma/client"
import { eventBus } from "@/events/core/eventBus"
import { EVENTS } from "@/events/core/eventTypes"
import {
  amendContractWithSupplyValidation,
  ContractServiceError,
} from "@/src/services/clients/contracts.service"
import { resolveClientB2BPriceForLot } from "@/src/services/pricing/clientB2BPrice"
import { evaluateContractPriceDrift } from "@/src/services/contract-request/contractPriceDrift.pure"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// =====================================================
// VERIFY OTP
//
// CREATE mode: mark token + set contract SIGNED
// AMEND mode:  mark token + validate intent + apply
//              amend via amendContractWithSupplyValidation
//              + consume intent + set contract SIGNED
//
// The amend is NEVER applied before OTP verification.
// =====================================================

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { code, contractId } = body

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!code || !contractId) {
      return NextResponse.json(
        { error: "Missing code or contractId" },
        { status: 400 }
      )
    }

    // =====================================================
    // GET LAST VALID TOKEN
    // =====================================================

    const record = await prisma.signatureToken.findFirst({
      where: { contractId },
      orderBy: { createdAt: "desc" }
    })

    if (!record || record.token !== code) {
      return NextResponse.json(
        { error: "Invalid code" },
        { status: 400 }
      )
    }

    if (record.verified) {
      return NextResponse.json(
        { error: "Code already used" },
        { status: 400 }
      )
    }

    if (record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Code expired" },
        { status: 400 }
      )
    }

    // =====================================================
    // GET CONTRACT
    // =====================================================

    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    })

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      )
    }

    if (contract.status === ContractStatus.SIGNED) {
      return NextResponse.json(
        { error: "Contract already signed" },
        { status: 400 }
      )
    }

    // =====================================================
    // AMEND MODE — apply amendment after OTP
    //
    // 1. Read demandIntentId from stored token draft
    // 2. Validate intent is OPEN + not expired
    // 3. Call amendContractWithSupplyValidation()
    // 4. Consume intent
    // 5. Mark token + set SIGNED
    // =====================================================

    if (record.mode === "amend") {

      const storedDraft: any = record.contractDraft
      const demandIntentId = storedDraft?.demandIntentId

      if (!demandIntentId) {
        return NextResponse.json(
          { error: "Amend requires a DemandIntent reference" },
          { status: 400 }
        )
      }

      // Read intent outside the amend transaction (fast-fail)
      const intent = await prisma.demandIntent.findUnique({
        where: { id: demandIntentId }
      })

      if (!intent) {
        return NextResponse.json(
          { error: "DemandIntent not found" },
          { status: 400 }
        )
      }

      if (intent.status !== "OPEN") {
        return NextResponse.json(
          { error: `DemandIntent status is ${intent.status}, expected OPEN` },
          { status: 400 }
        )
      }

      if (intent.expiresAt && intent.expiresAt <= new Date()) {
        return NextResponse.json(
          { error: "DemandIntent has expired" },
          { status: 400 }
        )
      }

      // =====================================================
      // CONTRACT-REQUEST-2 — PRICE DRIFT GUARD (AMEND PATH)
      //
      // Re-resolve the lot's current B2B price right before the
      // amend goes through, and compare to intent.previewPricePerKg.
      // If the lot got more expensive (or we can't read either
      // price), refuse: don't consume the intent, don't mutate
      // the contract. The buyer can refresh from the dashboard.
      // =====================================================

      let currentPricePerKg: number | null = null
      if (intent.greenLotId) {
        const lot = await prisma.greenLot.findUnique({
          where: { id: intent.greenLotId },
          include: { pricingSnapshot: true },
        })
        if (lot?.pricingSnapshot) {
          try {
            currentPricePerKg = resolveClientB2BPriceForLot(lot).pricePerKgRoasted
          } catch {
            currentPricePerKg = null
          }
        }
      }

      const drift = evaluateContractPriceDrift({
        intentPreviewPricePerKg: intent.previewPricePerKg,
        currentPricePerKg,
      })
      if (drift.blocking) {
        return NextResponse.json(
          {
            error: drift.message,
            code: "PRICE_DRIFT_REQUIRES_REVIEW",
            previewPricePerKg: drift.previewPricePerKg,
            currentPricePerKg: drift.currentPricePerKg,
            driftStatus: drift.status,
            delta: drift.delta,
            deltaPercent: drift.deltaPercent,
          },
          { status: 409 },
        )
      }

      // Apply the amendment (transactional supply validation + pricing)
      try {
        await amendContractWithSupplyValidation({
          contractId,
          companyId: contract.companyId,
          monthlyVolumeKg: intent.requestedKg,
          greenLotId: intent.greenLotId ?? null,
          excludeIntentId: demandIntentId,
        })
      } catch (err: any) {
        if (err instanceof ContractServiceError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: err.code === "INSUFFICIENT_SUPPLY" ? 409 : 400 }
          )
        }
        throw err
      }

      // Consume intent + mark token + set SIGNED (atomic)
      await prisma.$transaction(async (tx) => {
        await tx.demandIntent.update({
          where: { id: demandIntentId },
          data: { status: "CONSUMED", consumedAt: new Date() }
        })

        await tx.signatureToken.update({
          where: { token: record.token },
          data: { verified: true, signed: true }
        })

        await tx.contract.update({
          where: { id: contractId },
          data: { status: ContractStatus.SIGNED }
        })
      })

      eventBus.emit(EVENTS.CONTRACT_SIGNED, { contractId })

      return NextResponse.json({ success: true, contractId })
    }

    // =====================================================
    // CREATE MODE — mark token + set SIGNED
    //
    // Contract was already created (with supply validation
    // and intent consumption) before OTP was sent.
    // =====================================================

    await prisma.$transaction(async (tx) => {

      await tx.signatureToken.update({
        where: { token: record.token },
        data: { verified: true, signed: true }
      })

      await tx.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.SIGNED }
      })
    })

    eventBus.emit(EVENTS.CONTRACT_SIGNED, { contractId })

    return NextResponse.json({ success: true, contractId })

  } catch (err) {
    console.error("VERIFY OTP ERROR:", err)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}
