import { NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/auth" 


// =====================================================
// UPDATE COMPANY (ONBOARDING)
// =====================================================

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)

    if (!user || !user.companyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await req.json()

    const {
      country,
      phone,
      address,
      vat,
      contactName,

      // 🔥 NUEVOS CAMPOS
      businessName,
      legalCompanyName
    } = body

    // =====================================================
    // UPDATE COMPANY
    // =====================================================

    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        country,
        phone,
        address,
        vat,
        contactName,

        // 🔥 FIX
        businessName,
        legalCompanyName
      }
    })

    // =====================================================
    // MARK ONBOARDING COMPLETE
    // =====================================================

    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingCompleted: true
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("❌ COMPANY UPDATE ERROR:", error)

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    )
  }
}