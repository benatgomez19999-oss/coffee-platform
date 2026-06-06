import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import {
  evaluateBuyerProofMediaReadiness,
  normalizeLotMediaRole,
  normalizeLotMediaSource,
  normalizeLotMediaVisibility,
} from "@/src/services/lot-media/lotMedia.pure"
import type { LotMediaItem } from "@/src/services/lot-media/lotMedia.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// 🧠 EXPORT READY LOTS
//
// BUYER-PROOF-2B — each lot now carries advisory
//   { proofReady, proofMissing }
// so the partner UI can flag rows that will be
// rejected by the shipment-create guard. This is
// advisory only — enforcement lives in createShipment.
//
// We intentionally do NOT expose any of the underlying
// private media (id, url, signed reference). The flag
// is enough for UI; full proof bytes still go through
// the authorised proof endpoint.
//////////////////////////////////////////////////////

const MEDIA_SELECT = {
  id: true,
  url: true,
  role: true,
  source: true,
  visibility: true,
  position: true,
  isPrimary: true,
  altText: true,
} as const

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

function projectMedia(rows: ReadonlyArray<RawMediaRow>): LotMediaItem[] {
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

export async function GET(req: NextRequest) {

  //////////////////////////////////////////////////////
  // 🔐 AUTH — PARTNER / ADMIN only
  //
  // PRODUCER-PROOF-POLISH — the BUYER-PROOF-2A audit
  // flagged this route as unauthenticated. The only
  // consumer is the partner export-ready panel, which
  // already runs at /platform/partner/lots behind
  // partner auth. Gating the API matches the rest of
  // /api/partner/* and prevents the lot listing
  // (including the new proofReady/proofMissing
  // signal) from leaking.
  //////////////////////////////////////////////////////

  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.role !== "PARTNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  //////////////////////////////////////////////////////
  // 👉 GREEN LOTS DISPONIBLES
  //////////////////////////////////////////////////////

  const lots = await prisma.greenLot.findMany({
    where: {
      status: "PUBLISHED",
      availableKg: { gt: 0 },
    },
    include: {
      producerDraft: true,
      media: {
        select: MEDIA_SELECT,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  //////////////////////////////////////////////////////
  // 🔐 BUYER-PROOF-2B — advisory proof readiness
  //
  // Mirrors the rule enforced in createShipment so the
  // UI can flag rows that would be rejected. We never
  // surface the private media itself — only a coarse
  // string array of what is missing.
  //////////////////////////////////////////////////////

  // PRODUCER-PROOF-POLISH — `proofMissing` carries stable
  // machine codes (e.g. "TRACEABILITY_PROOF"). The partner
  // UI maps them to friendly copy via the pure helper at
  // `src/services/lot-media/proofReadinessLabels.pure.ts`.
  // Keeping codes (not English) here makes the contract
  // stable and i18n-friendly without leaking enum names
  // anywhere a user can see them.
  const enriched = lots.map((lot) => {
    const { media, ...rest } = lot
    const readiness = evaluateBuyerProofMediaReadiness({
      lotMedia: projectMedia(media ?? []),
      farmMedia: [],
      mode: "SHIPMENT_READY",
    })
    const proofMissing: string[] = []
    if (!readiness.coverage.hasBuyerPrivateTraceabilityProof) {
      proofMissing.push("TRACEABILITY_PROOF")
    }
    return {
      ...rest,
      proofReady: readiness.ready,
      proofMissing,
    }
  })

  return Response.json(enriched)
}
