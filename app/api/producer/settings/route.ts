import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import {
  buildProducerReadinessSummary,
  pickActiveFarmId,
  validateProducerSettingsPatch,
} from "@/src/services/producer-settings/producerSettings.pure"
import {
  buildLotMediaReadinessPanel,
  normalizeLotMediaRole,
  normalizeLotMediaSource,
  normalizeLotMediaVisibility,
} from "@/src/services/lot-media/lotMedia.pure"
import type { LotMediaItem } from "@/src/services/lot-media/lotMedia.types"

//////////////////////////////////////////////////////
// /api/producer/settings (PRODUCER-SETTINGS-1)
//
// GET → producer + farm profile + farm media readiness
//       (producer-friendly copy, no enum names).
// PATCH → partial update of producer + farm profile.
//
// Notification + operational preferences are
// intentionally NOT persisted here — they live in the
// browser (localStorage) so this sprint avoids a
// schema migration for a UI that may still evolve.
// See docs/producer-settings/PRODUCER-SETTINGS-1.md.
//////////////////////////////////////////////////////

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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

// ----------------------------------------------------
// GET — load settings for the authenticated producer.
// ----------------------------------------------------

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
    select: {
      id: true,
      name: true,
      country: true,
      farms: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          region: true,
          altitude: true,
        },
      },
    },
  })

  if (!producer) {
    return NextResponse.json(
      { error: "Producer profile not found. Complete onboarding first." },
      { status: 404 },
    )
  }

  const requestedFarmId = req.nextUrl.searchParams.get("farmId")
  const activeFarmId = pickActiveFarmId(producer.farms, requestedFarmId)

  // ─── FARM MEDIA READINESS (for the active farm) ───
  let readinessSummary = null
  if (activeFarmId) {
    const farmMediaRows = await prisma.farmMedia.findMany({
      where: { farmId: activeFarmId },
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
      farmMedia: projectMediaRows(farmMediaRows),
    })
    readinessSummary = buildProducerReadinessSummary(panel)
  }

  return NextResponse.json({
    producerProfile: {
      producerName: producer.name,
      contactName: user.name ?? null,
      email: user.email,
      phone: user.phone ?? null,
      country: producer.country,
      // Preferred language is NOT persisted yet — UI shows English
      // and a "coming soon" hint. The field is here so the client
      // doesn't have to special-case its presence later.
      preferredLanguage: null,
    },
    farms: producer.farms,
    activeFarmId,
    farmProfile: activeFarmId
      ? producer.farms.find((f) => f.id === activeFarmId) ?? null
      : null,
    farmMediaReadiness: readinessSummary,
    // notificationPreferences + operationalPreferences are stored
    // client-side this sprint. Returning empty objects here keeps
    // the API contract forward-compatible.
    notificationPreferences: {},
    operationalPreferences: {},
    support: {
      originManagerEmail: "support@alturacollective.com",
    },
  })
}

// ----------------------------------------------------
// PATCH — update producer + farm profile.
// ----------------------------------------------------

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.role !== "PRODUCER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const validation = validateProducerSettingsPatch(body)
  if (!validation.ok) {
    return NextResponse.json(
      { code: validation.error.code, error: validation.error.message },
      { status: 400 },
    )
  }
  const patch = validation.patch

  // Load the producer so we can scope writes correctly.
  const producer = await prisma.producer.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (!producer) {
    return NextResponse.json(
      { error: "Producer profile not found." },
      { status: 404 },
    )
  }

  try {
    await prisma.$transaction(async (tx) => {

      // ─── PRODUCER PROFILE ─────────────────────────
      if (patch.producerProfile) {
        const p = patch.producerProfile

        // User columns: phone (always exists) + name (= contact person)
        const userData: { phone?: string | null; name?: string | null } = {}
        if (p.phone !== undefined) userData.phone = p.phone
        if (p.contactName !== undefined) userData.name = p.contactName
        if (Object.keys(userData).length > 0) {
          await tx.user.update({
            where: { id: user.id },
            data: userData,
          })
        }

        // Producer columns: name + country (only when non-null/non-empty,
        // both columns are NOT NULL in the schema)
        const producerData: { name?: string; country?: string } = {}
        if (typeof p.producerName === "string" && p.producerName.length > 0) {
          producerData.name = p.producerName
        }
        if (typeof p.country === "string" && p.country.length > 0) {
          producerData.country = p.country
        }
        if (Object.keys(producerData).length > 0) {
          await tx.producer.update({
            where: { id: producer.id },
            data: producerData,
          })
        }
      }

      // ─── FARM PROFILE ─────────────────────────────
      if (patch.farmProfile) {
        const f = patch.farmProfile

        // Ownership check: the farm must belong to this producer.
        const farm = await tx.farm.findUnique({
          where: { id: f.farmId },
          select: { id: true, producerId: true },
        })
        if (!farm) {
          throw new Response(
            JSON.stringify({ error: "Farm not found." }),
            { status: 404 },
          )
        }
        if (farm.producerId !== producer.id) {
          throw new Response(
            JSON.stringify({ error: "You can only update your own farms." }),
            { status: 403 },
          )
        }

        const farmData: {
          name?: string
          region?: string | null
          altitude?: number | null
        } = {}
        if (typeof f.name === "string" && f.name.length > 0) farmData.name = f.name
        if (f.region !== undefined) farmData.region = f.region
        if (f.altitude !== undefined) farmData.altitude = f.altitude

        if (Object.keys(farmData).length > 0) {
          await tx.farm.update({
            where: { id: farm.id },
            data: farmData,
          })
        }
      }
    })
  } catch (err) {
    if (err instanceof Response) {
      const body = await err.text()
      return new NextResponse(body, {
        status: err.status,
        headers: { "Content-Type": "application/json" },
      })
    }
    console.error("[PRODUCER_SETTINGS_PATCH]", err)
    return NextResponse.json(
      { error: "Failed to save settings." },
      { status: 500 },
    )
  }

  // Return the freshly persisted state so the drawer can update
  // local state without re-fetching twice.
  const refreshUrl = new URL(req.url)
  const farmId = patch.farmProfile?.farmId
  if (farmId) refreshUrl.searchParams.set("farmId", farmId)
  const passthroughReq = new NextRequest(refreshUrl, {
    method: "GET",
    headers: req.headers,
  })
  return GET(passthroughReq)
}
