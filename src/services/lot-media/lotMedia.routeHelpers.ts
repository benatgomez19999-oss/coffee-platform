//////////////////////////////////////////////////////
// 🧰 LOT MEDIA — SHARED ROUTE HELPERS (PARTNER-MEDIA-2A)
//
// Producer and partner routes share the same service +
// validation, only the auth boundary differs:
//   - producer route: actor.role = "PRODUCER",
//     ownership is enforced by the service.
//   - partner route: actor.role = "PARTNER",
//     bypasses producer-owns-farm checks.
//
// These helpers keep the route shells thin (auth + delegate)
// so the 8 endpoint files don't drift from each other.
//////////////////////////////////////////////////////

import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import {
  createFarmMedia,
  createLotMedia,
  deleteFarmMedia,
  deleteLotMedia,
  listFarmMedia,
  listLotMedia,
  LotMediaServiceError,
  updateFarmMedia,
  updateLotMedia,
  type LotMediaActor,
} from "./lotMedia.service"

export type RouteAudience = "PRODUCER" | "PARTNER"

async function authActor(
  req: NextRequest,
  audience: RouteAudience,
): Promise<LotMediaActor | NextResponse> {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (audience === "PRODUCER") {
    if (user.role !== "PRODUCER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return { userId: user.id, role: "PRODUCER" }
  }
  // PARTNER audience
  if (user.role !== "PARTNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return {
    userId: user.id,
    role: user.role === "ADMIN" ? "ADMIN" : "PARTNER",
  }
}

function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof LotMediaServiceError) {
    return NextResponse.json(
      {
        code: err.code,
        error: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      { status: err.status },
    )
  }
  console.error("[LOT_MEDIA_ROUTE]", err)
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  )
}

async function readJsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

//////////////////////////////////////////////////////
// FARM MEDIA COLLECTION (GET, POST)
//////////////////////////////////////////////////////

export async function farmMediaCollection(
  req: NextRequest,
  params: { farmId: string },
  audience: RouteAudience,
  method: "GET" | "POST",
): Promise<NextResponse> {
  const actor = await authActor(req, audience)
  if (actor instanceof NextResponse) return actor

  try {
    if (method === "GET") {
      const rows = await listFarmMedia(params.farmId, actor)
      return NextResponse.json({ media: rows })
    }
    const body = (await readJsonBody(req)) as Record<string, unknown> | null
    const row = await createFarmMedia(params.farmId, body ?? {}, actor)
    return NextResponse.json({ media: row }, { status: 201 })
  } catch (err) {
    return toErrorResponse(err)
  }
}

//////////////////////////////////////////////////////
// FARM MEDIA ITEM (PATCH, DELETE)
//////////////////////////////////////////////////////

export async function farmMediaItem(
  req: NextRequest,
  params: { farmId: string; mediaId: string },
  audience: RouteAudience,
  method: "PATCH" | "DELETE",
): Promise<NextResponse> {
  const actor = await authActor(req, audience)
  if (actor instanceof NextResponse) return actor

  try {
    if (method === "DELETE") {
      const result = await deleteFarmMedia(params.farmId, params.mediaId, actor)
      return NextResponse.json(result)
    }
    const body = (await readJsonBody(req)) as Record<string, unknown> | null
    const row = await updateFarmMedia(
      params.farmId,
      params.mediaId,
      body ?? {},
      actor,
    )
    return NextResponse.json({ media: row })
  } catch (err) {
    return toErrorResponse(err)
  }
}

//////////////////////////////////////////////////////
// LOT MEDIA COLLECTION (GET, POST)
//////////////////////////////////////////////////////

export async function lotMediaCollection(
  req: NextRequest,
  params: { lotId: string },
  audience: RouteAudience,
  method: "GET" | "POST",
): Promise<NextResponse> {
  const actor = await authActor(req, audience)
  if (actor instanceof NextResponse) return actor

  try {
    if (method === "GET") {
      const rows = await listLotMedia(params.lotId, actor)
      return NextResponse.json({ media: rows })
    }
    const body = (await readJsonBody(req)) as Record<string, unknown> | null
    const row = await createLotMedia(params.lotId, body ?? {}, actor)
    return NextResponse.json({ media: row }, { status: 201 })
  } catch (err) {
    return toErrorResponse(err)
  }
}

//////////////////////////////////////////////////////
// LOT MEDIA ITEM (PATCH, DELETE)
//////////////////////////////////////////////////////

export async function lotMediaItem(
  req: NextRequest,
  params: { lotId: string; mediaId: string },
  audience: RouteAudience,
  method: "PATCH" | "DELETE",
): Promise<NextResponse> {
  const actor = await authActor(req, audience)
  if (actor instanceof NextResponse) return actor

  try {
    if (method === "DELETE") {
      const result = await deleteLotMedia(params.lotId, params.mediaId, actor)
      return NextResponse.json(result)
    }
    const body = (await readJsonBody(req)) as Record<string, unknown> | null
    const row = await updateLotMedia(
      params.lotId,
      params.mediaId,
      body ?? {},
      actor,
    )
    return NextResponse.json({ media: row })
  } catch (err) {
    return toErrorResponse(err)
  }
}

//////////////////////////////////////////////////////
// STORAGE-MEDIA-1 — SIGNED UPLOAD ROUTE HELPERS
//
// The shells are thin (auth + delegate). The actual
// signing lives in lotMediaStorage.service.ts and the
// validation lives in lotMediaStorage.pure.ts.
//////////////////////////////////////////////////////

function toStorageErrorResponse(err: unknown): NextResponse {
  // Dynamic import to keep lotMedia.routeHelpers.ts free of
  // @supabase/supabase-js at module load.
  const { LotMediaStorageError } = require("./lotMediaStorage.service") as typeof import("./lotMediaStorage.service")
  if (err instanceof LotMediaStorageError) {
    return NextResponse.json(
      {
        code: err.code,
        error: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      { status: err.status },
    )
  }
  return toErrorResponse(err)
}

export async function farmMediaSignedUpload(
  req: NextRequest,
  params: { farmId: string },
  audience: RouteAudience,
): Promise<NextResponse> {
  const actor = await authActor(req, audience)
  if (actor instanceof NextResponse) return actor

  try {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null
    const { createLotMediaSignedUpload } =
      await import("./lotMediaStorage.service")
    const result = await createLotMediaSignedUpload({
      actor,
      target: "FARM",
      ownerId: params.farmId,
      body: body ?? {},
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return toStorageErrorResponse(err)
  }
}

export async function lotMediaSignedUpload(
  req: NextRequest,
  params: { lotId: string },
  audience: RouteAudience,
): Promise<NextResponse> {
  const actor = await authActor(req, audience)
  if (actor instanceof NextResponse) return actor

  try {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null
    const { createLotMediaSignedUpload } =
      await import("./lotMediaStorage.service")
    const result = await createLotMediaSignedUpload({
      actor,
      target: "LOT",
      ownerId: params.lotId,
      body: body ?? {},
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return toStorageErrorResponse(err)
  }
}
