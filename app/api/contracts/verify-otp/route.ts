import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// =====================================================
// VERIFY OTP
// =====================================================

export async function POST(req: Request) {
  try {

    const body = await req.json()
    const { otp } = body

    if (!otp) {
      return NextResponse.json(
        { error: "Missing OTP" },
        { status: 400 }
      )
    }

    // =====================================================
    // FIND TOKEN
    // =====================================================

    const record = await prisma.signatureToken.findUnique({
      where: { token: otp }
    })

    if (!record) {
      return NextResponse.json(
        { error: "Invalid code" },
        { status: 400 }
      )
    }

    // =====================================================
    // VALIDATIONS
    // =====================================================

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

    if (!record.contractDraft) {
      return NextResponse.json(
        { error: "Missing contract draft" },
        { status: 400 }
      )
    }

    // =====================================================
    // CREATE OR AMEND CONTRACT
    // =====================================================

    let contractId = record.contractId

    // 🔧 TEMP: tiparemos después
    const draft: any = record.contractDraft

    // -----------------------------
    // CREATE
    // -----------------------------

    if (record.mode === "create") {

      // 🔥 REQUIRED: companyId debe existir en draft
      if (!draft.companyId) {
        return NextResponse.json(
          { error: "Missing companyId in draft" },
          { status: 400 }
        )
      }

      const created = await prisma.contract.create({
        data: {
          id: crypto.randomUUID(),

          // 🔥 RELATION
          companyId: draft.companyId,

          // 🔧 CORE DATA
          monthlyVolumeKg: draft.supply.monthlyVolume,
          durationMonths: draft.supply.duration,
          remainingMonths: draft.supply.duration,

          // 🔧 DEFAULTS (ajústalos luego si quieres)
          pricePerBag: draft.pricePerBag ?? 0,
          bagSizeKg: 20,
          bagsPerDelivery: draft.bagsPerDelivery ?? 1,

          startDate: new Date(),

          // 🔥 YA FIRMADO → CONFIRMED
          status: "CONFIRMED"
        }
      })

      contractId = created.id
    }

    // -----------------------------
    // AMEND
    // -----------------------------

    if (record.mode === "amend") {

      if (!record.contractId) {
        return NextResponse.json(
          { error: "Missing contractId" },
          { status: 400 }
        )
      }

      await prisma.contract.update({
        where: { id: record.contractId },
        data: {
          monthlyVolumeKg: draft.supply.monthlyVolume,
          durationMonths: draft.supply.duration,
          remainingMonths: draft.supply.duration
        }
      })

      contractId = record.contractId
    }

    // =====================================================
    // MARK TOKEN AS USED
    // =====================================================

    await prisma.signatureToken.update({
      where: { token: otp },
      data: {
        verified: true,
        signed: true
      }
    })

    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json({
      success: true,
      contractId
    })

  } catch (err) {

    console.error("VERIFY OTP ERROR:", err)

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}