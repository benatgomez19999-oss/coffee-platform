import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { ContractStatus } from "@prisma/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// =====================================================
// VERIFY OTP (FINAL FLOW - FIXED)
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
    // 🔥 GET LAST VALID TOKEN (IMPORTANT)
    // =====================================================

    const record = await prisma.signatureToken.findFirst({
      where: {
        contractId
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    if (!record || record.token !== code) {
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
    // 🔥 GET CONTRACT (EXTRA SAFETY)
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
    // TRANSACTION
    // =====================================================

    await prisma.$transaction(async (tx) => {

      // -----------------------------
      // 🔐 MARK TOKEN AS USED
      // -----------------------------

      await tx.signatureToken.update({
        where: { token: record.token },
        data: {
          verified: true,
          signed: true
        }
      })

      // -----------------------------
      // 🟢 UPDATE CONTRACT STATUS
      // -----------------------------

      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: ContractStatus.SIGNED
        }
      })

      // -----------------------------
      // 🟡 HANDLE AMEND
      // -----------------------------

      if (record.mode === "amend" && record.contractDraft) {

        const draft: any = record.contractDraft

        await tx.contract.update({
          where: { id: contractId },
          data: {
            monthlyVolumeKg: draft?.supply?.monthlyVolume,
            durationMonths: draft?.supply?.duration,
            remainingMonths: draft?.supply?.duration
          }
        })
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

    console.error("❌ VERIFY OTP ERROR:", err)

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}