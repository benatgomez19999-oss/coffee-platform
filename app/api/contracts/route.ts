import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";

// ✅ NECESARIO para Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ======================================================
// GET CONTRACTS — USER SCOPED (MULTI-TENANT SAFE)
// ======================================================

export async function GET() {
  try {
    // ======================================================
    // ⚠️ IMPORT DINÁMICO DE PRISMA (CLAVE)
    // ======================================================
    const { prisma } = await import("@/database/prisma");

    // ======================================================
    // AUTH
    // ======================================================
    const user = await requireAuth();

    if (!user.companyId) {
      return NextResponse.json(
        { error: "User has no company" },
        { status: 403 }
      );
    }

    // ======================================================
    // FETCH CONTRACTS (SCOPED)
    // ======================================================
    const contracts = await prisma.contract.findMany({
      where: {
        companyId: user.companyId, // 🔥 multi-tenant isolation
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(contracts);

  } catch (error: any) {
    // ======================================================
    // AUTH ERROR
    // ======================================================
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.error("❌ GET CONTRACTS ERROR:", error);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}