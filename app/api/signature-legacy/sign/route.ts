// ⚠️ LEGACY LINK-BASED SIGNING (NOT USED IN PROD)
// kept for fallback & debugging

import { NextResponse } from "next/server";
import { prisma } from "@/database/prisma";
import { ContractStatus } from "@prisma/client"



// ✅ NECESARIO para Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// SIGN CONTRACT (SAFE + DEBUG)
// =====================================================

export async function POST(req: Request) {
  try {
    

    const body = await req.json();
    const { token } = body;

    console.log("🟡 SIGN TOKEN:", token);

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    // =====================================================
    // FIND TOKEN
    // =====================================================
    const record = await prisma.signatureToken.findUnique({
      where: { token },
    });

    console.log("🔍 TOKEN RECORD:", record);

    if (!record) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 404 }
      );
    }

    // =====================================================
    // MARK TOKEN AS SIGNED
    // =====================================================
    await prisma.signatureToken.update({
      where: { token },
      data: {
        signed: true,
      },
    });

    console.log("✅ TOKEN MARKED AS SIGNED");

   // =====================================================
// UPDATE CONTRACT
// =====================================================

try {

  // 🔒 ensure contractId exists
  if (!record.contractId) {
    return NextResponse.json(
      { error: "Missing contractId" },
      { status: 400 }
    )
  }

  await prisma.contract.update({
    where: { id: record.contractId },
    data: {
    status: ContractStatus.SIGNED
    },
  })

  console.log("✅ CONTRACT UPDATED")

} catch (err) {

  console.error("❌ CONTRACT UPDATE ERROR:", err)

  return NextResponse.json(
    { error: "Contract update failed" },
    { status: 500 }
  )
}
    // =====================================================
    // SUCCESS
    // =====================================================
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("🔥 SIGN ERROR:", err);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}