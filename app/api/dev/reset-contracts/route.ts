// =====================================================
// DEV RESET CONTRACTS
// ⚠️ SOLO PARA DESARROLLO
// =====================================================

import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"

export async function POST() {

  const guard = await requireDevRoute()
  if (!guard.ok) return guard.response

  try {

    // primero borra tokens (FK)
    await prisma.signatureToken.deleteMany()

    // luego contratos
    await prisma.contract.deleteMany()

    return NextResponse.json({
      success: true
    })

  } catch (err) {

    console.error("RESET ERROR", err)

    return NextResponse.json(
      { error: "Reset failed" },
      { status: 500 }
    )

  }

}