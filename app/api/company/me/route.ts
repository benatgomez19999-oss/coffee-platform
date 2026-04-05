import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/src/lib/auth"
import { prisma } from "@/src/database/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {

    // 🔐 token
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ company: null }, { status: 401 })
    }

    const payload = verifyToken(token)

    if (!payload) {
      return NextResponse.json({ company: null }, { status: 401 })
    }

    // 👤 user + company
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { company: true }
    })

    if (!user || !user.company) {
      return NextResponse.json({ company: null })
    }

    const c = user.company

    // 🔥 RETURN EXPLÍCITO (FIX)
    return NextResponse.json({
      company: {
        id: c.id,
        name: c.name,
        country: c.country,

        phone: c.phone,
        address: c.address,
        vat: c.vat,
        contactName: c.contactName,

        // ✅ NUEVOS
        businessName: c.businessName,
        legalCompanyName: c.legalCompanyName,
      }
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ company: null }, { status: 500 })
  }
}