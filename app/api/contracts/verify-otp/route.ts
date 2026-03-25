import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { ContractStatus } from "@prisma/client"



export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// =====================================================
// VERIFY OTP (FINAL FLOW)
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
    // FIND TOKEN (OTP + CONTRACT LINKED)
    // =====================================================

    const record = await prisma.signatureToken.findFirst({
      where: {
        token: code,
        contractId: contractId
      }
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

    // =====================================================
    // TRANSACTION (CONFIRM CONTRACT)
    // =====================================================

    await prisma.$transaction(async (tx) => {

      // -----------------------------
      // 🟢 CONFIRM CONTRACT (NEW FLOW)
      // -----------------------------

      if (!record.contractId) {
        throw new Error("Missing contractId on token")
      }

      await tx.contract.update({
        where: { id: record.contractId },
        data: {
        status: ContractStatus.SIGNED
        }
      })

      // -----------------------------
      // 🟡 OPTIONAL: HANDLE AMEND
      // -----------------------------

      if (record.mode === "amend" && record.contractDraft) {

        const draft: any = record.contractDraft

        await tx.contract.update({
          where: { id: record.contractId },
          data: {
            monthlyVolumeKg: draft?.supply?.monthlyVolume,
            durationMonths: draft?.supply?.duration,
            remainingMonths: draft?.supply?.duration
          }
        })
      }

      // -----------------------------
      // 🔐 MARK TOKEN AS USED
      // -----------------------------

      await tx.signatureToken.update({
        where: { token: code },
        data: {
          verified: true,
          signed: true
        }
      })

    })

    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json({
      success: true,
      contractId
    })

  } catch (err) {

    console.error("❌ VERIFY OTP ERROR:", err)

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}