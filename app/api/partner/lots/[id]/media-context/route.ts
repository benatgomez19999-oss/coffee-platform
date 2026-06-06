export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import {
  evaluateBuyerProofMediaReadiness,
  normalizeLotMediaRole,
  normalizeLotMediaSource,
  normalizeLotMediaVisibility,
} from "@/src/services/lot-media/lotMedia.pure"
import { isLotMediaStorageReference } from "@/src/services/lot-media/lotMediaStorage.pure"
import type {
  LotMediaItem,
  LotMediaRole,
  LotMediaSource,
  LotMediaVisibility,
} from "@/src/services/lot-media/lotMedia.types"

//////////////////////////////////////////////////////
// 🔍 GET /api/partner/lots/[id]/media-context
// PARTNER-MEDIA-UI-1
//
// One-shot context endpoint for the partner media
// page. Returns:
//   - lot identity (lotNumber, farm + region, status)
//   - existing lot media (public URLs pass through;
//     private supabase:// references are NOT exposed —
//     only safe metadata + an `isPrivate` flag)
//   - proofReady / proofMissing pair that matches the
//     BUYER-PROOF-2B shipment guard
//
// Auth: PARTNER or ADMIN.
//
// We deliberately do not sign read URLs for private
// rows here. The buyer-proof endpoint is the only
// surface that signs. The partner UI only needs to
// know which rows are private — the bytes themselves
// stay behind the buyer scope.
//////////////////////////////////////////////////////

type ContextMediaDto = {
  id: string
  role: LotMediaRole
  source: LotMediaSource
  visibility: LotMediaVisibility
  position: number
  isPrimary: boolean
  altText: string | null
  caption: string | null
  credit: string | null
  // True when the row is stored as a `supabase://` reference
  // (BUYER-PROOF-1). The partner UI uses this to render a
  // lock card instead of attempting to render the URL.
  isPrivateReference: boolean
  // Only populated for PUBLIC rows. Private rows expose
  // `null` so the partner page can never accidentally
  // render private bytes.
  publicUrl: string | null
  createdAt: string
}

const MEDIA_SELECT = {
  id: true,
  url: true,
  role: true,
  source: true,
  visibility: true,
  position: true,
  isPrimary: true,
  altText: true,
  caption: true,
  credit: true,
  createdAt: true,
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
  caption: string | null
  credit: string | null
  createdAt: Date
}

function toContextDto(row: RawMediaRow): ContextMediaDto | null {
  const role = normalizeLotMediaRole(row.role)
  const source = normalizeLotMediaSource(row.source)
  if (!role || !source) return null
  const visibility =
    normalizeLotMediaVisibility(row.visibility) ?? "PUBLIC_MARKET"
  const isPrivateReference = isLotMediaStorageReference(row.url)
  return {
    id: row.id,
    role,
    source,
    visibility,
    position:
      Number.isFinite(row.position) && row.position >= 0 ? row.position : 0,
    isPrimary: row.isPrimary === true,
    altText: row.altText ?? null,
    caption: row.caption ?? null,
    credit: row.credit ?? null,
    isPrivateReference,
    // Surface public URLs only. Anything that looks like a
    // private storage reference is masked here so the partner
    // UI cannot accidentally <img src=...> a supabase:// URI.
    publicUrl: isPrivateReference ? null : row.url,
    createdAt: row.createdAt.toISOString(),
  }
}

function toReadinessItem(
  row: RawMediaRow,
  lotId: string,
): LotMediaItem | null {
  const role = normalizeLotMediaRole(row.role)
  const source = normalizeLotMediaSource(row.source)
  if (!role || !source) return null
  const visibility =
    normalizeLotMediaVisibility(row.visibility) ?? "PUBLIC_MARKET"
  return {
    id: row.id,
    url: row.url,
    role,
    source,
    visibility,
    position:
      Number.isFinite(row.position) && row.position >= 0 ? row.position : 0,
    isPrimary: row.isPrimary === true,
    altText: row.altText ?? null,
    owner: "LOT",
    ownerId: lotId,
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.role !== "PARTNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lotId = (params.id ?? "").trim()
  if (!lotId) {
    return NextResponse.json({ error: "Missing lotId." }, { status: 400 })
  }

  const lot = await prisma.greenLot.findUnique({
    where: { id: lotId },
    select: {
      id: true,
      lotNumber: true,
      name: true,
      status: true,
      farmId: true,
      farm: {
        select: {
          id: true,
          name: true,
          region: true,
          producer: { select: { name: true, country: true } },
        },
      },
      media: {
        select: MEDIA_SELECT,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      },
    },
  })

  if (!lot) {
    return NextResponse.json({ error: "Lot not found." }, { status: 404 })
  }

  const mediaRows = (lot.media ?? []) as ReadonlyArray<RawMediaRow>

  const dtoMedia: ContextMediaDto[] = []
  const readinessItems: LotMediaItem[] = []
  for (const row of mediaRows) {
    const dto = toContextDto(row)
    if (dto) dtoMedia.push(dto)
    const readiness = toReadinessItem(row, lot.id)
    if (readiness) readinessItems.push(readiness)
  }

  // BUYER-PROOF-2B parity — same call shape as
  // createShipment + /api/partner/export-ready. Lot-only;
  // farm media never satisfies the shipment proof rule.
  const readiness = evaluateBuyerProofMediaReadiness({
    lotMedia: readinessItems,
    farmMedia: [],
    mode: "SHIPMENT_READY",
  })

  const proofMissing: string[] = []
  if (!readiness.coverage.hasBuyerPrivateTraceabilityProof) {
    proofMissing.push("TRACEABILITY_PROOF")
  }

  return NextResponse.json({
    lot: {
      id: lot.id,
      lotNumber: lot.lotNumber,
      name: lot.name,
      status: lot.status,
      farmId: lot.farmId,
      farmName: lot.farm?.name ?? null,
      region: lot.farm?.region ?? null,
      producerName: lot.farm?.producer?.name ?? null,
      producerCountry: lot.farm?.producer?.country ?? null,
    },
    media: dtoMedia,
    proofReady: readiness.ready,
    proofMissing,
  })
}
