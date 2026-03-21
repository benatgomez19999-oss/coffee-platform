import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { prisma } from "@/database/prisma";

// ✅ NECESARIO para Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// POST — SIGNATURE REQUEST (PRISMA + TWILIO SMS)
// =====================================================

export async function POST(req: Request) {
  console.log("🟢 SIGNATURE ENDPOINT HIT");

  try {
    // =====================================================
    // ⚠️ IMPORTS DINÁMICOS (CLAVE TOTAL)
    // =====================================================
   
    const twilio = (await import("twilio")).default;

    // =====================================================
    // TWILIO CLIENT (DENTRO DEL HANDLER ⚠️)
    // =====================================================
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    // =====================================================
    // BODY
    // =====================================================
    const body = await req.json();
    console.log("📦 BODY RECEIVED:", body);

    const { contractId, phone } = body;

    // =====================================================
    // AUTH
    // =====================================================
    const user = await requireAuth();

    if (!user.companyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // =====================================================
    // VALIDATION
    // =====================================================
    if (!contractId || !phone) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    // =====================================================
    // PHONE VALIDATION (E.164)
    // =====================================================
    if (!phone.startsWith("+")) {
      return NextResponse.json(
        { error: "Phone must be in format +346XXXXXXXX" },
        { status: 400 }
      );
    }

    console.log("📲 SIGNATURE REQUEST:", { contractId, phone });

    // =====================================================
    // GENERATE TOKEN
    // =====================================================
    const token = crypto.randomUUID();

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // =====================================================
    // SAVE TOKEN
    // =====================================================
    await prisma.signatureToken.create({
      data: {
        token,
        contractId,
        phone,
        expiresAt,
      },
    });

    // =====================================================
    // UPDATE CONTRACT
    // =====================================================
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: "AWAITING_SIGNATURE",
      },
    });

    // =====================================================
    // BUILD SIGN LINK
    // =====================================================
    const host =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const signingLink = `${host}/sign/${token}`;

    console.log("🔗 SIGN LINK:", signingLink);

    // =====================================================
    // SEND SMS (TWILIO)
    // =====================================================
    try {
      console.log("📤 SENDING SMS TO:", phone);

      const msg = await client.messages.create({
        body: `Sign your contract: ${signingLink}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: phone,
      });

      console.log("✅ TWILIO SUCCESS SID:", msg.sid);

    } catch (twilioError: any) {
      console.error("❌ TWILIO ERROR:", twilioError);

      return NextResponse.json(
        {
          error: "Twilio failed",
          message: twilioError.message,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // RESPONSE
    // =====================================================
    return NextResponse.json({
      success: true,
      token,
      signingLink,
    });

  } catch (err: any) {
    console.error("❌ SIGNATURE ERROR:", err);

    return NextResponse.json(
      {
        error: "Internal error",
        message: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}