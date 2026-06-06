//////////////////////////////////////////////////////
// 🖼️ LOT MEDIA SERVICE (PARTNER-MEDIA-2A)
//
// Auth-aware CRUD on FarmMedia + GreenLotMedia. Producers
// can only manage media that belong to one of their farms
// or to a lot they own (a GreenLot whose farm.producerId
// matches the actor). Partner/admin permissions reuse the
// same actor type; routes that need them call this layer
// with `actor.role = "PARTNER"` and we skip the ownership
// check.
//
// Pure normalisation + validation lives in lotMedia.pure.ts.
// This file is the only place that talks to Prisma.
//////////////////////////////////////////////////////

import { Prisma } from "@prisma/client"
import { prisma } from "@/src/database/prisma"
import {
  buildDefaultLotMediaAltText,
  normalizeLotMediaCreateInput,
  normalizeLotMediaUpdateInput,
  type LotMediaInputValidationError,
  type NormalizedLotMediaUpdateInput,
} from "./lotMedia.pure"
import type {
  LotMediaCreateInput,
  LotMediaItem,
  LotMediaRole,
  LotMediaSource,
  LotMediaUpdateInput,
  LotMediaVisibility,
} from "./lotMedia.types"

//////////////////////////////////////////////////////
// ACTOR + ERRORS
//////////////////////////////////////////////////////

export type LotMediaActor = {
  userId: string
  role: "PRODUCER" | "PARTNER" | "ADMIN"
}

export type LotMediaServiceErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "FARM_NOT_FOUND"
  | "LOT_NOT_FOUND"
  | "MEDIA_NOT_FOUND"
  | "MEDIA_NOT_OWNED_BY_PARENT"
  | "INVALID_INPUT"

export class LotMediaServiceError extends Error {
  code: LotMediaServiceErrorCode
  status: number
  details?: LotMediaInputValidationError

  constructor(
    code: LotMediaServiceErrorCode,
    message: string,
    opts?: { status?: number; details?: LotMediaInputValidationError },
  ) {
    super(message)
    this.code = code
    this.status =
      opts?.status ??
      (code === "UNAUTHORIZED"
        ? 401
        : code === "FORBIDDEN"
          ? 403
          : code === "INVALID_INPUT"
            ? 400
            : code === "FARM_NOT_FOUND" ||
                code === "LOT_NOT_FOUND" ||
                code === "MEDIA_NOT_FOUND"
              ? 404
              : code === "MEDIA_NOT_OWNED_BY_PARENT"
                ? 400
                : 500)
    if (opts?.details) this.details = opts.details
  }
}

//////////////////////////////////////////////////////
// MEDIA-ROW PUBLIC SHAPE
//
// Routes serialise this object directly. The fields match
// LotMediaItem with a `createdAt` timestamp so the UI can
// sort/filter recently uploaded rows. We deliberately do
// NOT expose `metadata` from this surface; it's reserved
// for future EXIF / storage-bound integrations.
//////////////////////////////////////////////////////

export type LotMediaRowDto = LotMediaItem & {
  createdAt: string
  updatedAt: string
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
  updatedAt: true,
} as const

function farmMediaToDto(
  row: {
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
    updatedAt: Date
  },
  ownerId: string,
): LotMediaRowDto {
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
    owner: "FARM",
    ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function lotMediaToDto(
  row: {
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
    updatedAt: Date
  },
  ownerId: string,
): LotMediaRowDto {
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
    owner: "LOT",
    ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

//////////////////////////////////////////////////////
// OWNERSHIP CHECKS
//
// Both helpers throw LotMediaServiceError with a 403/404
// when the actor isn't allowed near the resource. PRODUCER
// is restricted to their own producer rows; PARTNER and
// ADMIN can manage media globally (mirroring the existing
// /api/partner/lots/[id]/verify+publish permission model).
//////////////////////////////////////////////////////

async function loadFarmForActor(farmId: string, actor: LotMediaActor) {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: {
      id: true,
      producerId: true,
      producer: { select: { userId: true } },
    },
  })
  if (!farm) {
    throw new LotMediaServiceError("FARM_NOT_FOUND", "Farm not found.")
  }
  if (actor.role === "PRODUCER" && farm.producer?.userId !== actor.userId) {
    throw new LotMediaServiceError(
      "FORBIDDEN",
      "You can only manage media on farms you own.",
    )
  }
  return farm
}

async function loadLotForActor(greenLotId: string, actor: LotMediaActor) {
  const lot = await prisma.greenLot.findUnique({
    where: { id: greenLotId },
    select: {
      id: true,
      name: true,
      variety: true,
      process: true,
      farm: {
        select: {
          id: true,
          region: true,
          producerId: true,
          producer: { select: { userId: true, country: true } },
        },
      },
    },
  })
  if (!lot) {
    throw new LotMediaServiceError("LOT_NOT_FOUND", "Green lot not found.")
  }
  if (
    actor.role === "PRODUCER" &&
    lot.farm?.producer?.userId !== actor.userId
  ) {
    throw new LotMediaServiceError(
      "FORBIDDEN",
      "You can only manage media on lots you own.",
    )
  }
  return lot
}

//////////////////////////////////////////////////////
// FARM MEDIA — CRUD
//////////////////////////////////////////////////////

export async function listFarmMedia(
  farmId: string,
  actor: LotMediaActor,
): Promise<LotMediaRowDto[]> {
  await loadFarmForActor(farmId, actor)
  const rows = await prisma.farmMedia.findMany({
    where: { farmId },
    select: MEDIA_SELECT,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  })
  return rows.map((r) => farmMediaToDto(r, farmId))
}

export async function createFarmMedia(
  farmId: string,
  body: Partial<LotMediaCreateInput>,
  actor: LotMediaActor,
): Promise<LotMediaRowDto> {

  const farm = await loadFarmForActor(farmId, actor)
  const normalized = normalizeLotMediaCreateInput(body)
  if (!normalized.ok) {
    throw new LotMediaServiceError(
      "INVALID_INPUT",
      normalized.error.message,
      { details: normalized.error },
    )
  }
  const input = normalized.input

  return prisma.$transaction(async (tx) => {
    const position = input.position ?? (await nextFarmMediaPosition(tx, farm.id))

    if (input.isPrimary) {
      // Single-primary invariant: clear every sibling first
      // INSIDE the transaction so concurrent uploads don't race.
      await tx.farmMedia.updateMany({
        where: { farmId: farm.id, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const altText =
      input.altText ??
      buildDefaultLotMediaAltText({
        lotName: null,
        role: input.role,
        region: null,
        country: null,
      })

    const row = await tx.farmMedia.create({
      data: {
        farmId: farm.id,
        url: input.url,
        role: input.role,
        source: input.source,
        visibility: input.visibility,
        position,
        isPrimary: input.isPrimary,
        altText,
        caption: input.caption,
        credit: input.credit,
      },
      select: MEDIA_SELECT,
    })

    return farmMediaToDto(row, farm.id)
  })
}

export async function updateFarmMedia(
  farmId: string,
  mediaId: string,
  body: Partial<LotMediaUpdateInput>,
  actor: LotMediaActor,
): Promise<LotMediaRowDto> {

  const farm = await loadFarmForActor(farmId, actor)
  const normalized = normalizeLotMediaUpdateInput(body)
  if (!normalized.ok) {
    throw new LotMediaServiceError(
      "INVALID_INPUT",
      normalized.error.message,
      { details: normalized.error },
    )
  }
  const input = normalized.input

  return prisma.$transaction(async (tx) => {
    const existing = await tx.farmMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, farmId: true },
    })
    if (!existing) {
      throw new LotMediaServiceError("MEDIA_NOT_FOUND", "Media not found.")
    }
    if (existing.farmId !== farm.id) {
      throw new LotMediaServiceError(
        "MEDIA_NOT_OWNED_BY_PARENT",
        "This media row does not belong to the specified farm.",
      )
    }

    if (input.isPrimary === true) {
      await tx.farmMedia.updateMany({
        where: { farmId: farm.id, isPrimary: true, NOT: { id: mediaId } },
        data: { isPrimary: false },
      })
    }

    const row = await tx.farmMedia.update({
      where: { id: mediaId },
      data: stripUndefined(input),
      select: MEDIA_SELECT,
    })

    return farmMediaToDto(row, farm.id)
  })
}

export async function deleteFarmMedia(
  farmId: string,
  mediaId: string,
  actor: LotMediaActor,
): Promise<{ deletedId: string }> {
  const farm = await loadFarmForActor(farmId, actor)

  const existing = await prisma.farmMedia.findUnique({
    where: { id: mediaId },
    select: { id: true, farmId: true },
  })
  if (!existing) {
    throw new LotMediaServiceError("MEDIA_NOT_FOUND", "Media not found.")
  }
  if (existing.farmId !== farm.id) {
    throw new LotMediaServiceError(
      "MEDIA_NOT_OWNED_BY_PARENT",
      "This media row does not belong to the specified farm.",
    )
  }

  await prisma.farmMedia.delete({ where: { id: mediaId } })
  return { deletedId: mediaId }
}

//////////////////////////////////////////////////////
// LOT MEDIA — CRUD
//////////////////////////////////////////////////////

export async function listLotMedia(
  greenLotId: string,
  actor: LotMediaActor,
): Promise<LotMediaRowDto[]> {
  await loadLotForActor(greenLotId, actor)
  const rows = await prisma.greenLotMedia.findMany({
    where: { greenLotId },
    select: MEDIA_SELECT,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  })
  return rows.map((r) => lotMediaToDto(r, greenLotId))
}

export async function createLotMedia(
  greenLotId: string,
  body: Partial<LotMediaCreateInput>,
  actor: LotMediaActor,
): Promise<LotMediaRowDto> {

  const lot = await loadLotForActor(greenLotId, actor)
  const normalized = normalizeLotMediaCreateInput(body)
  if (!normalized.ok) {
    throw new LotMediaServiceError(
      "INVALID_INPUT",
      normalized.error.message,
      { details: normalized.error },
    )
  }
  const input = normalized.input

  return prisma.$transaction(async (tx) => {
    const position = input.position ?? (await nextLotMediaPosition(tx, lot.id))

    if (input.isPrimary) {
      await tx.greenLotMedia.updateMany({
        where: { greenLotId: lot.id, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const altText =
      input.altText ??
      buildDefaultLotMediaAltText({
        lotName: lot.name ?? null,
        variety: lot.variety ?? null,
        process: lot.process ?? null,
        region: lot.farm?.region ?? null,
        country: lot.farm?.producer?.country ?? null,
        role: input.role,
      })

    const row = await tx.greenLotMedia.create({
      data: {
        greenLotId: lot.id,
        url: input.url,
        role: input.role,
        source: input.source,
        visibility: input.visibility,
        position,
        isPrimary: input.isPrimary,
        altText,
        caption: input.caption,
        credit: input.credit,
      },
      select: MEDIA_SELECT,
    })

    return lotMediaToDto(row, lot.id)
  })
}

export async function updateLotMedia(
  greenLotId: string,
  mediaId: string,
  body: Partial<LotMediaUpdateInput>,
  actor: LotMediaActor,
): Promise<LotMediaRowDto> {

  const lot = await loadLotForActor(greenLotId, actor)
  const normalized = normalizeLotMediaUpdateInput(body)
  if (!normalized.ok) {
    throw new LotMediaServiceError(
      "INVALID_INPUT",
      normalized.error.message,
      { details: normalized.error },
    )
  }
  const input = normalized.input

  return prisma.$transaction(async (tx) => {
    const existing = await tx.greenLotMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, greenLotId: true },
    })
    if (!existing) {
      throw new LotMediaServiceError("MEDIA_NOT_FOUND", "Media not found.")
    }
    if (existing.greenLotId !== lot.id) {
      throw new LotMediaServiceError(
        "MEDIA_NOT_OWNED_BY_PARENT",
        "This media row does not belong to the specified lot.",
      )
    }

    if (input.isPrimary === true) {
      await tx.greenLotMedia.updateMany({
        where: { greenLotId: lot.id, isPrimary: true, NOT: { id: mediaId } },
        data: { isPrimary: false },
      })
    }

    const row = await tx.greenLotMedia.update({
      where: { id: mediaId },
      data: stripUndefined(input),
      select: MEDIA_SELECT,
    })

    return lotMediaToDto(row, lot.id)
  })
}

export async function deleteLotMedia(
  greenLotId: string,
  mediaId: string,
  actor: LotMediaActor,
): Promise<{ deletedId: string }> {
  const lot = await loadLotForActor(greenLotId, actor)

  const existing = await prisma.greenLotMedia.findUnique({
    where: { id: mediaId },
    select: { id: true, greenLotId: true },
  })
  if (!existing) {
    throw new LotMediaServiceError("MEDIA_NOT_FOUND", "Media not found.")
  }
  if (existing.greenLotId !== lot.id) {
    throw new LotMediaServiceError(
      "MEDIA_NOT_OWNED_BY_PARENT",
      "This media row does not belong to the specified lot.",
    )
  }

  await prisma.greenLotMedia.delete({ where: { id: mediaId } })
  return { deletedId: mediaId }
}

//////////////////////////////////////////////////////
// POSITION HELPERS
//
// "Next slot" = max(position) + 1 across the owner. We do
// a SELECT inside the transaction so concurrent creates
// at least pick distinct positions; the unique-ish ordering
// downstream (compareLotMediaItems) breaks remaining ties
// on id deterministically.
//////////////////////////////////////////////////////

async function nextFarmMediaPosition(
  tx: Prisma.TransactionClient,
  farmId: string,
): Promise<number> {
  const max = await tx.farmMedia.aggregate({
    where: { farmId },
    _max: { position: true },
  })
  const current = max._max.position
  return typeof current === "number" && Number.isFinite(current) ? current + 1 : 0
}

async function nextLotMediaPosition(
  tx: Prisma.TransactionClient,
  greenLotId: string,
): Promise<number> {
  const max = await tx.greenLotMedia.aggregate({
    where: { greenLotId },
    _max: { position: true },
  })
  const current = max._max.position
  return typeof current === "number" && Number.isFinite(current) ? current + 1 : 0
}

//////////////////////////////////////////////////////
// UTILS
//////////////////////////////////////////////////////

function stripUndefined(
  input: NormalizedLotMediaUpdateInput,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = v
  }
  return out
}
