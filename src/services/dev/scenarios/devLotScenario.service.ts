//////////////////////////////////////////////////////
// 🧪 DEV LOT SCENARIO SERVICE
//
// Three operations:
//   - seedDevScenario(input)     creates real rows
//   - listDevScenarioData()      summary of dev rows
//   - resetDevScenarios()        deletes only DEV-SCENARIO rows
//
// Hard rules:
//   - never deletes real users / non-dev farms
//   - never persists allocation decisions
//   - never creates RoastBatch / RoastedBatch / Order
//   - never wires events
//   - all created rows carry the DEV-SCENARIO- lotNumber
//     prefix or [DEV] farm prefix so reset can find them
//   - Stage B reuses the production createShipment service
//     so the lot.shipmentId / status=RESERVED transitions
//     stay identical to the real flow
//////////////////////////////////////////////////////

import { Prisma } from "@prisma/client"

import { prisma } from "@/src/database/prisma"
import {
  createShipment,
} from "@/src/services/logistics/shipment.service"
import type { DestinationStage } from "@/src/lib/logistics/destinationTracking"
import { calculateProducerPricing } from "@/src/engine/pricing/producer/calculatePricing"
import { calculateMarketplaceB2BPricing } from "@/src/engine/pricing/client/calculateMarketplaceB2BPricing"

import {
  DEV_SCENARIO_PREFIX,
  DEV_SHIPMENT_PREFIX,
  DEV_PRICING_VERSION,
  applyJitterToRecipes,
  resolveSeedConfig,
  toPricingEngineVariety,
  type DevLotRecipe,
  type DevLotScenarioKind,
  type DevLotScenarioTargetStage,
  type DevLotVariationMode,
  pickRecipes,
} from "./devLotScenario.types"
import {
  ensureDevScenarioActors,
  type DevScenarioActors,
} from "./devScenarioActors.service"

//////////////////////////////////////////////////////
// PUBLIC TYPES
//////////////////////////////////////////////////////

export type SeedDevScenarioInput = {
  scenario: DevLotScenarioKind
  targetStage: DevLotScenarioTargetStage
  count?: number
  destinationCountry?: string
  variationMode?: DevLotVariationMode
  seed?: string
}

export type SeededGreenLot = {
  id: string
  lotNumber: string
  name: string | null
  status: string
  variety: string
  process: string
  scaScore: number | null
  totalKg: number
  availableKg: number
  pricePerKg: number
  shipmentId: string | null
  farmName: string
}

export type SeededShipment = {
  id: string
  reference: string
  status: string
  currentStage: DestinationStage | null
  destinationCountry: string | null
  requiresDestinationCustoms: boolean
  receivedAt: string | null
  arrivedAt: string | null
}

export type SeedDevScenarioResult = {
  scenario: DevLotScenarioKind
  targetStage: DevLotScenarioTargetStage
  variationMode: DevLotVariationMode
  appliedSeed: string | null
  created: {
    producerLotDrafts: number
    greenLots: number
    pricingSnapshots: number
    shipments: number
  }
  greenLots: SeededGreenLot[]
  shipment: SeededShipment | null
}

export type DevScenarioListItem = {
  id: string
  lotNumber: string
  name: string | null
  status: string
  greenLotStatus: string
  availableKg: number
  scaScore: number | null
  variety: string
  process: string
  farmName: string
  shipmentReference: string | null
}

export type DevScenarioListResponse = {
  lots: DevScenarioListItem[]
  counts: {
    drafts: number
    greenLots: number
    shipments: number
  }
}

export type DevScenarioResetResponse = {
  deleted: {
    demandIntents: number
    contracts: number
    producerFulfilments: number
    pricingSnapshots: number
    shipments: number
    greenLots: number
    producerLotDrafts: number
  }
  warnings: string[]
}

export class DevScenarioError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = "DevScenarioError"
    this.status = status
  }
}

//////////////////////////////////////////////////////
// VALIDATION
//////////////////////////////////////////////////////

function validateInput(input: SeedDevScenarioInput): void {

  if (
    input.scenario === "allocation_engine_decides" &&
    input.targetStage === "destination_received"
  ) {
    // Routing all engine-boundary lots through Shipment would
    // turn every decision into HOLD + SHIPMENT_ALREADY_RESERVED,
    // which defeats the whole point of this preset.
    throw new DevScenarioError(
      "allocation_engine_decides must use targetStage=published",
      400
    )
  }
}

//////////////////////////////////////////////////////
// DESTINATION COUNTRY CHOICE
//
// The user may force a country via body. Otherwise we
// alternate by scenario so half the seeds end up with
// destination customs enabled and half don't — useful
// for testing both branches of the logistics tracking.
//////////////////////////////////////////////////////

const NORWAY_SCENARIOS: ReadonlyArray<DevLotScenarioKind> = [
  "marketplace_mix",
  "exclusive_microlots",
  "logistics_ready",
]

function pickDestination(
  scenario: DevLotScenarioKind,
  override?: string
): { destinationCountry: string; requiresDestinationCustoms: boolean } {

  const country = override?.trim() ||
    (NORWAY_SCENARIOS.includes(scenario) ? "Norway" : "Netherlands")

  return {
    destinationCountry: country,
    requiresDestinationCustoms: country.toLowerCase() === "norway",
  }
}

//////////////////////////////////////////////////////
// SEED
//////////////////////////////////////////////////////

export async function seedDevScenario(
  input: SeedDevScenarioInput
): Promise<SeedDevScenarioResult> {

  validateInput(input)

  const baseRecipes = pickRecipes(input.scenario, input.count)
  if (baseRecipes.length === 0) {
    throw new DevScenarioError("No recipes available for scenario", 400)
  }

  // Resolve mode + seed BEFORE seeding so the response is honest about
  // what the pipeline actually used. allocation_engine_decides forces
  // deterministic regardless of input — see resolveSeedConfig.
  const { variationMode, appliedSeed } = resolveSeedConfig({
    scenario: input.scenario,
    variationMode: input.variationMode,
    seed: input.seed,
  })

  const recipes: DevLotRecipe[] =
    variationMode === "jittered" && appliedSeed
      ? applyJitterToRecipes(input.scenario, baseRecipes, appliedSeed)
      : baseRecipes.map((r) => ({ ...r }))

  const timestamp = Date.now()

  // ─── STAGE A — drafts + green lots + pricing ──────
  const stageA = await prisma.$transaction(async (tx) => {

    const actors = await ensureDevScenarioActors(tx)
    const created: Array<{
      greenLot: SeededGreenLot
      farmKey: string
    }> = []

    for (let i = 0; i < recipes.length; i++) {
      const recipe = recipes[i]
      const lotNumber = `${DEV_SCENARIO_PREFIX}-${input.scenario}-${timestamp}-${i + 1}`
      const result = await seedSingleLot({
        tx,
        actors,
        recipe,
        lotNumber,
        scenario: input.scenario,
      })
      created.push(result)
    }

    return { actors, created }
  })

  const seededGreenLots = stageA.created.map((c) => c.greenLot)

  // ─── STAGE B — Shipment to destination_received ───
  let seededShipment: SeededShipment | null = null

  if (input.targetStage === "destination_received") {
    seededShipment = await seedShipmentForGreenLots({
      scenario: input.scenario,
      timestamp,
      greenLotIds: seededGreenLots.map((l) => l.id),
      destinationOverride: input.destinationCountry,
    })

    // Reflect the shipment + RESERVED status back in the
    // returned greenLots list (they were PUBLISHED before
    // createShipment; now they're RESERVED with shipmentId).
    for (const lot of seededGreenLots) {
      lot.status = "RESERVED"
      lot.shipmentId = seededShipment.id
    }
  }

  return {
    scenario: input.scenario,
    targetStage: input.targetStage,
    variationMode,
    appliedSeed,
    created: {
      producerLotDrafts: seededGreenLots.length,
      greenLots: seededGreenLots.length,
      pricingSnapshots: seededGreenLots.length,
      shipments: seededShipment ? 1 : 0,
    },
    greenLots: seededGreenLots,
    shipment: seededShipment,
  }
}

//////////////////////////////////////////////////////
// SEED — single lot inside the Stage A transaction
//////////////////////////////////////////////////////

type SeedSingleLotInput = {
  tx: Prisma.TransactionClient
  actors: DevScenarioActors
  recipe: DevLotRecipe
  lotNumber: string
  scenario: DevLotScenarioKind
}

async function seedSingleLot(input: SeedSingleLotInput): Promise<{
  greenLot: SeededGreenLot
  farmKey: string
}> {

  const { tx, actors, recipe, lotNumber, scenario } = input
  const farm = actors.farms[recipe.farmKey]

  // Pricing engine requires altitude. Refuse to seed silently
  // with a fake altitude — the dev farms always carry one, but
  // a developer who edited a farm could land here.
  if (farm.altitude == null) {
    throw new Error(
      `Farm ${farm.name} has no altitude — cannot price lot via calculateProducerPricing`
    )
  }

  // Normalise variety to the pricing engine's literal union.
  // Throws DevScenarioError-equivalent at the seed level if the
  // recipe carries an unsupported variety (caught by the route).
  const engineVariety = toPricingEngineVariety(recipe.variety)

  // ─── REAL PRODUCER PRICING ENGINE ──────────────────
  // Mirrors src/services/partner/lotVerification.service.ts so
  // dev rows are priced identically to real verified lots.
  // No marketData here — calling the engine without an active
  // MarketSignalSnapshot is the deterministic fallback path the
  // production pricing helper documents.
  const pricing = calculateProducerPricing({
    scaScore: recipe.scaScore,
    altitude: farm.altitude,
    variety: engineVariety,
    process: recipe.process,
    country: "COLOMBIA",
  })

  // ─── PRICING-B2B-3 — CLIENT B2B ROASTED PRICE ─────
  // Same target-anchored adaptive pipeline the marketplace uses,
  // run with marketData=null to keep dev seeds deterministic.
  // Best-effort: failure here MUST NOT break seeding.
  let b2bPricePerKg: number | null = null
  let b2bPricingVersion: string | null = null
  let b2bPricingMode: string | null = null
  let b2bPricingBreakdown: Prisma.InputJsonValue | null = null

  try {
    const b2b = calculateMarketplaceB2BPricing(
      {
        scaScore: recipe.scaScore,
        altitude: farm.altitude,
        variety: recipe.variety,
        process: recipe.process,
        country: "COLOMBIA",
        roastYield: recipe.estimatedRoastYield,
        currency: "EUR",
        marketplaceGreenKg: recipe.greenKg,
        marketData: null,
      },
      {
        producerPricingFn: ((engineInput: {
          scaScore: number
          altitude: number
          variety: string
          process: string
          country?: string
          marketData?: { cPrice?: number; demandIndex?: number }
        }) =>
          calculateProducerPricing({
            scaScore: engineInput.scaScore,
            altitude: engineInput.altitude,
            variety: engineInput.variety as any,
            process: engineInput.process as any,
            country: engineInput.country,
            marketData: engineInput.marketData,
          })) as any,
      }
    )
    b2bPricePerKg = b2b.pricePerKgRoasted
    b2bPricingVersion = b2b.pricingVersion
    b2bPricingMode = b2b.pricingMode
    b2bPricingBreakdown = b2b.breakdown as unknown as Prisma.InputJsonValue
  } catch (err) {
    console.warn("[DEV_SCENARIO_SEED] B2B pricing failed — leaving null", err)
  }

  // Public name — realistic-sounding, no scenario id leak.
  // Internal markers stay on lotNumber + pricingSnapshot.context.
  const displayName = recipe.name ?? buildPublicLotName({
    region: farm.region,
    variety: recipe.variety,
    process: recipe.process,
  })

  // 1. ProducerLotDraft (status VERIFIED)
  const draft = await tx.producerLotDraft.create({
    data: {
      producerId: actors.producerId,
      farmId: farm.id,
      lotNumber,
      name: displayName,
      variety: recipe.variety,
      process: recipe.process,
      harvestYear: recipe.harvestYear,
      parchmentKg: recipe.parchmentKg,
      estimatedGreenKg: recipe.greenKg,
      conversionRate: recipe.conversionRate,
      status: "VERIFIED",
    },
    select: { id: true },
  })

  // 2. GreenLot (status PUBLISHED)
  // pricePerKg = green producer price from the engine — same field
  // the production lotVerification service writes.
  const greenLot = await tx.greenLot.create({
    data: {
      farmId: farm.id,
      lotNumber,
      name: displayName,
      variety: recipe.variety,
      process: recipe.process,
      harvestYear: recipe.harvestYear,
      scaScore: recipe.scaScore,
      altitude: farm.altitude,
      estimatedRoastYield: recipe.estimatedRoastYield,
      totalKg: recipe.greenKg,
      availableKg: recipe.greenKg,
      pricePerKg: pricing.finalPrice,
      currency: "EUR",
      status: "PUBLISHED",
    },
    select: {
      id: true,
      lotNumber: true,
      name: true,
      status: true,
      variety: true,
      process: true,
      scaScore: true,
      totalKg: true,
      availableKg: true,
      pricePerKg: true,
      shipmentId: true,
    },
  })

  // 3. Link draft → greenLot
  await tx.producerLotDraft.update({
    where: { id: draft.id },
    data: { greenLotId: greenLot.id },
  })

  // 4. PricingSnapshot — mirrors lotVerification.service exactly:
  //    producer = client = pricing.finalPrice, margin = 0.
  //    The "client = producer" semantics is the documented
  //    Phase-1 stance; fixing the client-margin economics is
  //    out of scope for this sprint.
  await tx.pricingSnapshot.create({
    data: {
      lotId: greenLot.id,
      producerPricePerKg: pricing.finalPrice,
      clientPricePerKg: pricing.finalPrice,
      marginPerKg: 0,
      pricingVersion: DEV_PRICING_VERSION,
      breakdown: pricing.breakdown as unknown as Prisma.InputJsonValue,

      // PRICING-B2B-3 — persisted client B2B roasted price.
      clientB2BPricePerKg: b2bPricePerKg,
      clientB2BPricingVersion: b2bPricingVersion,
      clientB2BPricingMode: b2bPricingMode,
      clientB2BPricingBreakdown: b2bPricingBreakdown ?? Prisma.JsonNull,
      clientB2BPriceComputedAt: b2bPricePerKg != null ? new Date() : null,

      context: {
        source: "DEV_SCENARIO_FACTORY",
        scenario,
        pricingEngine: "calculateProducerPricing",
        farmKey: recipe.farmKey,
        scaScore: recipe.scaScore,
        altitude: farm.altitude,
        variety: engineVariety,
        process: recipe.process,
        country: "COLOMBIA",
        estimatedRoastYield: recipe.estimatedRoastYield,
        harvestYear: recipe.harvestYear,
      },
    },
  })

  return {
    greenLot: {
      id: greenLot.id,
      lotNumber: greenLot.lotNumber,
      name: greenLot.name,
      status: greenLot.status,
      variety: greenLot.variety,
      process: greenLot.process,
      scaScore: greenLot.scaScore,
      totalKg: greenLot.totalKg,
      availableKg: greenLot.availableKg,
      pricePerKg: greenLot.pricePerKg,
      shipmentId: greenLot.shipmentId,
      farmName: farm.name,
    },
    farmKey: recipe.farmKey,
  }
}

//////////////////////////////////////////////////////
// SHIPMENT — Stage B
//
// Reuses production createShipment so the lot transitions
// (shipmentId set, status RESERVED) stay identical to the
// real flow. Then we update the shipment record to mark
// it RECEIVED + final destination stage.
//////////////////////////////////////////////////////

type SeedShipmentInput = {
  scenario: DevLotScenarioKind
  timestamp: number
  greenLotIds: string[]
  destinationOverride?: string
}

async function seedShipmentForGreenLots(
  input: SeedShipmentInput
): Promise<SeededShipment> {

  const reference = `${DEV_SHIPMENT_PREFIX}-${input.scenario}-${input.timestamp}`
  const { destinationCountry, requiresDestinationCustoms } = pickDestination(
    input.scenario,
    input.destinationOverride
  )
  const now = new Date()

  // Use the real service so lots flip PUBLISHED → RESERVED.
  await createShipment({
    reference,
    carrier: "Dev Carrier",
    vesselOrFlight: "Dev Vessel",
    etaAt: now,
    greenLotIds: input.greenLotIds,
    destinationCountry,
    requiresDestinationCustoms,
    currentStage: "ARRIVED_AT_ROTTERDAM_PORT",
  })

  // Move to RECEIVED + final stage. We update directly
  // because receiveShipment doesn't set arrivedAt or
  // currentStage by itself.
  const updated = await prisma.shipment.update({
    where: { reference },
    data: {
      status: "RECEIVED",
      arrivedAt: now,
      receivedAt: now,
      currentStage: "RECEIVED_BY_CLIENT",
    },
    select: {
      id: true,
      reference: true,
      status: true,
      currentStage: true,
      destinationCountry: true,
      requiresDestinationCustoms: true,
      receivedAt: true,
      arrivedAt: true,
    },
  })

  return {
    id: updated.id,
    reference: updated.reference,
    status: updated.status,
    currentStage: updated.currentStage,
    destinationCountry: updated.destinationCountry,
    requiresDestinationCustoms: updated.requiresDestinationCustoms,
    receivedAt: updated.receivedAt ? updated.receivedAt.toISOString() : null,
    arrivedAt: updated.arrivedAt ? updated.arrivedAt.toISOString() : null,
  }
}

//////////////////////////////////////////////////////
// LIST
//////////////////////////////////////////////////////

export async function listDevScenarioData(): Promise<DevScenarioListResponse> {

  const [draftsCount, greenLots, shipmentsCount] = await Promise.all([
    prisma.producerLotDraft.count({
      where: { lotNumber: { startsWith: `${DEV_SCENARIO_PREFIX}-` } },
    }),
    prisma.greenLot.findMany({
      where: { lotNumber: { startsWith: `${DEV_SCENARIO_PREFIX}-` } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        lotNumber: true,
        name: true,
        status: true,
        availableKg: true,
        scaScore: true,
        variety: true,
        process: true,
        farm: { select: { name: true } },
        shipment: { select: { reference: true } },
      },
    }),
    prisma.shipment.count({
      where: { reference: { startsWith: `${DEV_SCENARIO_PREFIX}-` } },
    }),
  ])

  const lots: DevScenarioListItem[] = greenLots.map((l) => ({
    id: l.id,
    lotNumber: l.lotNumber,
    name: l.name,
    status: l.status,
    greenLotStatus: l.status,
    availableKg: l.availableKg,
    scaScore: l.scaScore,
    variety: l.variety,
    process: l.process,
    farmName: l.farm?.name ?? "—",
    shipmentReference: l.shipment?.reference ?? null,
  }))

  return {
    lots,
    counts: {
      drafts: draftsCount,
      greenLots: greenLots.length,
      shipments: shipmentsCount,
    },
  }
}

//////////////////////////////////////////////////////
// RESET
//
// Deletes ONLY rows whose lotNumber / reference starts
// with DEV-SCENARIO-. Producer / User / [DEV] farms
// are NOT deleted — they're shared across reseeds.
//
// Order matters: dependents first, then green lots,
// then drafts. We also unlink draft.greenLotId before
// deleting the green lots themselves to avoid the
// unique-constraint dance Prisma can otherwise hit.
//////////////////////////////////////////////////////

export async function resetDevScenarios(): Promise<DevScenarioResetResponse> {

  const warnings: string[] = []

  // Step 1 — gather ids (outside transaction; small reads).
  const greenLots = await prisma.greenLot.findMany({
    where: { lotNumber: { startsWith: `${DEV_SCENARIO_PREFIX}-` } },
    select: { id: true },
  })
  const greenLotIds = greenLots.map((l) => l.id)

  const shipments = await prisma.shipment.findMany({
    where: { reference: { startsWith: `${DEV_SCENARIO_PREFIX}-` } },
    select: { id: true },
  })
  const shipmentIds = shipments.map((s) => s.id)

  const drafts = await prisma.producerLotDraft.findMany({
    where: { lotNumber: { startsWith: `${DEV_SCENARIO_PREFIX}-` } },
    select: { id: true },
  })
  const draftIds = drafts.map((d) => d.id)

  // Defensive — if a non-dev contract / order exists on a dev
  // green lot we'd rather warn than silently delete.
  let nonDevContractWarning = 0
  let nonDevOrderWarning = 0

  if (greenLotIds.length > 0) {
    nonDevContractWarning = await prisma.contract.count({
      where: { greenLotId: { in: greenLotIds } },
    })
  }
  if (nonDevContractWarning > 0) {
    warnings.push(
      `${nonDevContractWarning} contract(s) referenced dev lots and will be deleted along with them.`
    )
  }

  // Step 2 — delete in dependency order inside one transaction.
  return prisma.$transaction(async (tx) => {

    let demandIntents = 0
    let contracts = 0
    let producerFulfilments = 0
    let pricingSnapshots = 0
    let shipmentsDeleted = 0
    let greenLotsDeleted = 0
    let draftsDeleted = 0

    if (greenLotIds.length > 0) {

      // 1. DemandIntent
      const di = await tx.demandIntent.deleteMany({
        where: { greenLotId: { in: greenLotIds } },
      })
      demandIntents = di.count

      // 2. ProducerFulfilment
      const pf = await tx.producerFulfilment.deleteMany({
        where: { greenLotId: { in: greenLotIds } },
      })
      producerFulfilments = pf.count

      // 3. Contract — uncouple Orders first (they're FK-soft via contractId)
      //    The schema has Order.contractId optional with no cascade rule;
      //    leaving orphan orders is acceptable for dev cleanup.
      const c = await tx.contract.deleteMany({
        where: { greenLotId: { in: greenLotIds } },
      })
      contracts = c.count

      // 4. PricingSnapshot
      const ps = await tx.pricingSnapshot.deleteMany({
        where: { lotId: { in: greenLotIds } },
      })
      pricingSnapshots = ps.count

      // 5. Unlink draft → greenLot before greenLot deletion
      //    (avoids any FK strictness on greenLotId unique field).
      await tx.producerLotDraft.updateMany({
        where: { greenLotId: { in: greenLotIds } },
        data: { greenLotId: null },
      })

      // 6. Detach lots from shipment so shipment delete is clean.
      await tx.greenLot.updateMany({
        where: { id: { in: greenLotIds } },
        data: { shipmentId: null },
      })
    }

    // 7. Shipments — delete the dev-prefixed ones.
    if (shipmentIds.length > 0) {
      const s = await tx.shipment.deleteMany({
        where: { id: { in: shipmentIds } },
      })
      shipmentsDeleted = s.count
    }

    // 8. GreenLots
    if (greenLotIds.length > 0) {
      const g = await tx.greenLot.deleteMany({
        where: { id: { in: greenLotIds } },
      })
      greenLotsDeleted = g.count
    }

    // 9. Producer drafts
    if (draftIds.length > 0) {
      const d = await tx.producerLotDraft.deleteMany({
        where: { id: { in: draftIds } },
      })
      draftsDeleted = d.count
    }

    return {
      deleted: {
        demandIntents,
        contracts,
        producerFulfilments,
        pricingSnapshots,
        shipments: shipmentsDeleted,
        greenLots: greenLotsDeleted,
        producerLotDrafts: draftsDeleted,
      },
      warnings,
    }
  })
}

//////////////////////////////////////////////////////
// 🪪 PUBLIC LOT NAME BUILDER
//
// Produces a customer-facing lot name from physical
// data only. Never leaks the scenario id or the
// DEV-SCENARIO- traceability prefix — those stay on
// lotNumber and pricingSnapshot.context for reset
// and audit.
//
// Examples (region + variety + descriptor):
//   Nariño Geisha Reserve
//   Antioquia Pink Bourbon Selection
//   Huila Bourbon Natural
//   Tolima Castillo Washed Lot
//   Cauca Caturra Honey
//////////////////////////////////////////////////////

function buildPublicLotName(input: {
  region: string | null
  variety: string
  process: "WASHED" | "NATURAL" | "HONEY" | "ANAEROBIC"
}): string {

  const region = input.region?.trim() || "Colombia"
  const variety = input.variety.trim()

  // Rare premium varieties get a curated descriptor regardless of process.
  if (variety === "Geisha")       return `${region} Geisha Reserve`
  if (variety === "Pink Bourbon") return `${region} Pink Bourbon Selection`

  // Common varieties — descriptor follows the process.
  switch (input.process) {
    case "NATURAL":   return `${region} ${variety} Natural`
    case "HONEY":     return `${region} ${variety} Honey`
    case "ANAEROBIC": return `${region} ${variety} Anaerobic`
    case "WASHED":    return `${region} ${variety} Washed Lot`
  }
}

