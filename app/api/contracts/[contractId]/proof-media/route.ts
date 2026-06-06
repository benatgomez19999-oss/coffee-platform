export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import {
  buildBuyerProofMediaSummary,
  filterMediaForContractProofAudience,
  normaliseProofMediaRoleLabel,
  type ContractProofAudience,
} from "@/src/services/lot-media/buyerProofMedia.pure"
import {
  createLotMediaSignedReadUrl,
  isLotMediaStorageConfigured,
} from "@/src/services/lot-media/lotMediaStorage.service"
import { parseLotMediaStorageReference } from "@/src/services/lot-media/lotMediaStorage.pure"
import type {
  LotMediaItem,
  LotMediaRole,
  LotMediaSource,
  LotMediaVisibility,
} from "@/src/services/lot-media/lotMedia.types"

//////////////////////////////////////////////////////
// 🔐 GET /api/contracts/[contractId]/proof-media
// BUYER-PROOF-1
//
// Returns the buyer-proof media bundle for a single
// contract. Each item carries a short-lived signed
// read URL when the row is stored as a `supabase://`
// reference in the private bucket; public rows pass
// through unchanged.
//
// AUTH MATRIX
//   CLIENT   — must own the contract (companyId match).
//              Sees PUBLIC + BUYER_PRIVATE rows only.
//   PARTNER  — sees all rows on all contracts.
//   ADMIN    — sees all rows on all contracts.
//   PRODUCER — must own the farm behind the contract's
//              greenLot. Sees all rows on that lot.
//
// Response shape (200):
//   {
//     contractId, greenLotId, generatedAt,
//     audience: "BUYER" | "PARTNER" | "PRODUCER",
//     storageConfigured: boolean,
//     media: Array<ProofMediaDto>,
//     summary: BuyerProofMediaSummary
//   }
//
// Each ProofMediaDto carries either:
//   - resolvedUrl: a public CDN URL or a signed read URL
//   - resolvedUrl: null + signError: string  (signing
//     failed; UI can render a "couldn't load" tile)
// We never surface the raw `supabase://` reference to
// the browser — the UI doesn't need it and exposing it
// would leak the private bucket name.
//////////////////////////////////////////////////////

type ProofMediaDto = {
  id: string
  role: LotMediaRole
  roleLabel: string
  source: LotMediaSource
  visibility: LotMediaVisibility
  owner: "LOT" | "FARM"
  position: number
  isPrimary: boolean
  altText: string | null
  caption: string | null
  credit: string | null
  // When the underlying row is public, equals the row's `url`.
  // When private, equals a freshly signed read URL.
  resolvedUrl: string | null
  // True when the row was a `supabase://` reference resolved
  // via the storage service.
  signed: boolean
  // Seconds-to-live for signed read URLs. null for public rows.
  expiresInSeconds: number | null
  // Present only on signing failures so the UI can show a
  // clear "couldn't load" affordance without breaking the page.
  signError?: string
}

type LotMediaRowSelect = {
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
} as const

function rowToItem(
  row: LotMediaRowSelect,
  owner: "LOT" | "FARM",
  ownerId: string,
): LotMediaItem {
  return {
    id: row.id,
    url: row.url,
    role: row.role as LotMediaRole,
    source: row.source as LotMediaSource,
    visibility: row.visibility as LotMediaVisibility,
    position: row.position,
    isPrimary: row.isPrimary,
    altText: row.altText,
    caption: row.caption,
    credit: row.credit,
    owner,
    ownerId,
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { contractId: string } },
) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const contractId = (params.contractId ?? "").trim()
  if (!contractId) {
    return NextResponse.json(
      { error: "Missing contractId." },
      { status: 400 },
    )
  }

  // ─── LOAD CONTRACT + OWNERSHIP ──────────────────────
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      companyId: true,
      greenLotId: true,
      greenLot: {
        select: {
          id: true,
          farmId: true,
          farm: {
            select: {
              id: true,
              producer: { select: { userId: true } },
            },
          },
        },
      },
    },
  })
  if (!contract) {
    return NextResponse.json(
      { error: "Contract not found." },
      { status: 404 },
    )
  }

  // ─── AUDIENCE RESOLUTION ────────────────────────────
  const role = user.role ?? ""
  let audience: ContractProofAudience
  if (role === "PARTNER" || role === "ADMIN") {
    audience = "PARTNER"
  } else if (role === "PRODUCER") {
    const producerUserId = contract.greenLot?.farm?.producer?.userId
    if (!producerUserId || producerUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    audience = "PRODUCER"
  } else {
    // Default = CLIENT / buyer. Must own the contract via company.
    if (!user.companyId || user.companyId !== contract.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    audience = "BUYER"
  }

  // ─── EARLY RETURN — NO GREEN LOT LINKED ─────────────
  if (!contract.greenLotId || !contract.greenLot) {
    return NextResponse.json({
      contractId: contract.id,
      greenLotId: null,
      generatedAt: new Date().toISOString(),
      audience,
      storageConfigured: isLotMediaStorageConfigured(),
      media: [],
      summary: buildBuyerProofMediaSummary([]),
    })
  }

  const greenLotId = contract.greenLot.id
  const farmId = contract.greenLot.farmId

  // ─── FETCH MEDIA (lot + farm) ───────────────────────
  const [lotRows, farmRows] = await Promise.all([
    prisma.greenLotMedia.findMany({
      where: { greenLotId },
      select: MEDIA_SELECT,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    farmId
      ? prisma.farmMedia.findMany({
          where: { farmId },
          select: MEDIA_SELECT,
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([] as LotMediaRowSelect[]),
  ])

  const combined: LotMediaItem[] = [
    ...lotRows.map((r) => rowToItem(r, "LOT", greenLotId)),
    ...(farmId ? farmRows.map((r) => rowToItem(r, "FARM", farmId)) : []),
  ]

  // ─── AUDIENCE FILTER ────────────────────────────────
  const visibleItems = filterMediaForContractProofAudience(combined, audience)

  // ─── RESOLVE URLS (sign private references) ─────────
  const storageConfigured = isLotMediaStorageConfigured()
  const resolved: ProofMediaDto[] = await Promise.all(
    visibleItems.map(async (item) => {
      const base: ProofMediaDto = {
        id: item.id,
        role: item.role,
        roleLabel: normaliseProofMediaRoleLabel(item.role),
        source: item.source,
        visibility: item.visibility ?? "PUBLIC_MARKET",
        owner: (item.owner ?? "LOT") as "LOT" | "FARM",
        position: item.position,
        isPrimary: item.isPrimary,
        altText: item.altText,
        caption: item.caption ?? null,
        credit: item.credit ?? null,
        resolvedUrl: null,
        signed: false,
        expiresInSeconds: null,
      }

      const reference = parseLotMediaStorageReference(item.url)
      if (!reference) {
        // Public row — pass the stored URL through unchanged.
        return { ...base, resolvedUrl: item.url }
      }

      if (!storageConfigured) {
        return {
          ...base,
          signError:
            "Image storage is not configured on this environment.",
        }
      }

      try {
        const signed = await createLotMediaSignedReadUrl({
          bucket: reference.bucket,
          storagePath: reference.storagePath,
        })
        return {
          ...base,
          resolvedUrl: signed.signedUrl,
          signed: true,
          expiresInSeconds: signed.expiresInSeconds,
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Couldn't sign proof image."
        return { ...base, signError: msg }
      }
    }),
  )

  // ─── SUMMARY (from audience-filtered list) ──────────
  const summary = buildBuyerProofMediaSummary(visibleItems)

  return NextResponse.json({
    contractId: contract.id,
    greenLotId,
    generatedAt: new Date().toISOString(),
    audience,
    storageConfigured,
    media: resolved,
    summary,
  })
}
