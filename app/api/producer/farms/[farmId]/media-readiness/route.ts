import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import {
  buildLotMediaReadinessPanel,
  normalizeLotMediaRole,
  normalizeLotMediaSource,
  normalizeLotMediaVisibility,
} from "@/src/services/lot-media/lotMedia.pure"
import type { LotMediaItem } from "@/src/services/lot-media/lotMedia.types"

//////////////////////////////////////////////////////
// GET /api/producer/farms/[farmId]/media-readiness
//
// PARTNER-MEDIA-2A — returns the two-column readiness panel
// the producer wizard renders. Reads FarmMedia only; lot-level
// readiness is computed when the wizard knows which lot is
// being prepared. Ownership-guarded: producers can only read
// their own farms.
//////////////////////////////////////////////////////

type RawMediaRow = {
  id: string
  url: string
  role: string
  source: string
  visibility: string
  position: number
  isPrimary: boolean
  altText: string | null
}

function projectMediaRows(
  rows: ReadonlyArray<RawMediaRow>,
): LotMediaItem[] {
  const out: LotMediaItem[] = []
  for (const r of rows) {
    if (typeof r.url !== "string" || r.url.trim() === "") continue
    const role = normalizeLotMediaRole(r.role)
    const source = normalizeLotMediaSource(r.source)
    if (!role || !source) continue
    const visibility = normalizeLotMediaVisibility(r.visibility) ?? "PUBLIC_MARKET"
    out.push({
      id: r.id,
      url: r.url,
      role,
      source,
      visibility,
      position: Number.isFinite(r.position) && r.position >= 0 ? r.position : 0,
      isPrimary: r.isPrimary === true,
      altText: r.altText ?? null,
    })
  }
  return out
}

export async function GET(
  req: NextRequest,
  { params }: { params: { farmId: string } },
) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.role !== "PRODUCER" && user.role !== "PARTNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const farm = await prisma.farm.findUnique({
    where: { id: params.farmId },
    select: {
      id: true,
      producer: { select: { userId: true } },
    },
  })
  if (!farm) {
    return NextResponse.json({ error: "Farm not found" }, { status: 404 })
  }
  if (user.role === "PRODUCER" && farm.producer?.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const farmRows = await prisma.farmMedia.findMany({
    where: { farmId: farm.id },
    select: {
      id: true,
      url: true,
      role: true,
      source: true,
      visibility: true,
      position: true,
      isPrimary: true,
      altText: true,
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  })

  const panel = buildLotMediaReadinessPanel({
    lotMedia: [],
    farmMedia: projectMediaRows(farmRows),
  })

  return NextResponse.json({ readiness: panel })
}
