import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import {
  evaluateLotMediaReadiness,
  normalizeLotMediaRole,
  normalizeLotMediaSource,
  normalizeLotMediaVisibility,
} from "@/src/services/lot-media/lotMedia.pure"
import type { LotMediaItem } from "@/src/services/lot-media/lotMedia.types"

//////////////////////////////////////////////////////
// POST — Publish a GreenLot (DRAFT → PUBLISHED)
//
// [id] = GreenLot.id
//
// The lot must already exist (created by verifyLotService)
// and must be in DRAFT status. Only then can it go live.
//
// FARM-MEDIA-1: PUBLISH also requires verified FARM +
// PROCESS media from either the lot or its farm. Editorial
// / tonal placeholder sources never satisfy this gate.
//////////////////////////////////////////////////////

type RawMediaRow = {
  id: string
  url: string
  role: string
  source: string
  visibility?: string | null
  position: number
  isPrimary: boolean
  altText: string | null
}

function projectMediaRows(rows: ReadonlyArray<RawMediaRow>): LotMediaItem[] {
  const out: LotMediaItem[] = []
  for (const r of rows) {
    if (typeof r.url !== "string" || r.url.trim() === "") continue
    const role = normalizeLotMediaRole(r.role)
    const source = normalizeLotMediaSource(r.source)
    if (!role || !source) continue
    const visibility =
      normalizeLotMediaVisibility(r.visibility) ?? "PUBLIC_MARKET"
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 AUTH
    //////////////////////////////////////////////////////

    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "PARTNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    //////////////////////////////////////////////////////
    // 🔍 FETCH GREEN LOT (+ media + farm media)
    //////////////////////////////////////////////////////

    const greenLot = await prisma.greenLot.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        name: true,
        farmId: true,
        media: {
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
        },
        farm: {
          select: {
            id: true,
            media: {
              select: {
                id: true,
                url: true,
                role: true,
                source: true,
                position: true,
                isPrimary: true,
                altText: true,
              },
              orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    })

    if (!greenLot) {
      return NextResponse.json({ error: "Green lot not found" }, { status: 404 })
    }

    //////////////////////////////////////////////////////
    // 🛑 STATUS GUARD
    //////////////////////////////////////////////////////

    if (greenLot.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Cannot publish lot with status ${greenLot.status}. Expected DRAFT.`,
        },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // 🖼️ FARM-MEDIA-1 — PUBLISH READINESS GUARD
    //////////////////////////////////////////////////////

    const readiness = evaluateLotMediaReadiness({
      lotMedia: projectMediaRows(greenLot.media ?? []),
      farmMedia: projectMediaRows(greenLot.farm?.media ?? []),
      mode: "PUBLISH",
    })

    if (!readiness.ready) {
      return NextResponse.json(
        {
          code: "LOT_MEDIA_NOT_READY",
          error: "Lot media is not ready for publish.",
          reasons: readiness.blockingReasons,
        },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // ✅ TRANSITION DRAFT → PUBLISHED
    //////////////////////////////////////////////////////

    const updated = await prisma.greenLot.update({
      where: { id: greenLot.id },
      data: { status: "PUBLISHED" },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PARTNER_LOT_PUBLISH]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
