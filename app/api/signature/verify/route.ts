// =====================================================
// VERIFY SIGNATURE TOKEN (PRISMA)
// =====================================================

import { NextResponse } from "next/server"
import { prisma } from "@/database/prisma"


// =====================================================
// GET
// =====================================================

export async function GET(req: Request) {

  try {

    const { searchParams } = new URL(req.url)

    const token = searchParams.get("token")


    // =====================================================
    // VALIDATION
    // =====================================================

    if (!token) {

      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      )

    }


    // =====================================================
    // FIND TOKEN
    // =====================================================

    const record = await prisma.signatureToken.findUnique({
      where: { token }
    })


    // =====================================================
    // NOT FOUND
    // =====================================================

    if (!record) {

      return NextResponse.json(
        { error: "Invalid signature link" },
        { status: 404 }
      )

    }


    // =====================================================
    // EXPIRED
    // =====================================================

    if (new Date() > record.expiresAt) {

      return NextResponse.json(
        { error: "Signature link expired" },
        { status: 400 }
      )

    }


    // =====================================================
    // ALREADY SIGNED
    // =====================================================

    if (record.signed) {

      return NextResponse.json(
        { error: "Contract already signed" },
        { status: 400 }
      )

    }


    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json({

      token: record.token,
      contractId: record.contractId,
      expiresAt: record.expiresAt

    })


  } catch (err) {

    console.error("VERIFY ERROR", err)

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    )

  }

}