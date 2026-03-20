// =====================================================
// DEV RESET CONTRACTS
// ⚠️ SOLO PARA DESARROLLO
// =====================================================

import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"

export async function POST() {

  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not allowed" },
      { status: 403 }
    )
  }

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