import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"

//////////////////////////////////////////////////////
// GET /api/producer/farms
//
// PARTNER-MEDIA-2A — lists the authenticated producer's
// farms so the media management page can render the right
// readiness panel. Producer-scoped only; PARTNER/ADMIN
// callers should use the dashboard's own farm queries.
//////////////////////////////////////////////////////

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.role !== "PRODUCER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const producer = await prisma.producer.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (!producer) {
    return NextResponse.json({ farms: [] })
  }

  const farms = await prisma.farm.findMany({
    where: { producerId: producer.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      region: true,
      altitude: true,
    },
  })

  return NextResponse.json({ farms })
}
