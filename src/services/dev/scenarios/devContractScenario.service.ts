//////////////////////////////////////////////////////
// 📑 DEV CONTRACT SCENARIO SERVICE
//
// Seeds and resets dev-only Contract + DemandIntent rows
// against existing DEV-SCENARIO- lots.
//
// HARD RULES (mirror the dev lot factory):
//   • Real user data is never touched. Reset only removes
//     rows owned by the dedicated dev contract company,
//     and only when those rows reference a DEV-SCENARIO-
//     prefixed lot.
//   • This factory NEVER seeds lots. It errors clearly
//     when no eligible dev lots exist.
//   • No Stripe, no email, no signature/OTP side effects.
//   • Pricing comes from resolveClientB2BPriceForLot.
//   • monthlyVolumeKg is roasted; monthlyGreenKg is derived
//     via the lot's resolved roast yield.
//////////////////////////////////////////////////////

import { ContractStatus, DemandIntentStatus, Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"

import { prisma } from "@/src/database/prisma"
import {
  DEV_CONTRACT_CLIENT_USER_EMAIL,
  DEV_CONTRACT_COMPANY_NAME,
  DEV_CONTRACT_LOT_PREFIX,
  DEV_CONTRACT_PRICING_VERSION,
  DevContractScenarioError,
  getDevContractScenarioSpec,
  isDevContractScenarioKind,
  type ContractStatusName,
  type DemandIntentStatusName,
  type DevContractScenarioKind,
} from "./devContractScenario.types"
import {
  buildDevContractPayload,
  pickEligibleLotsForContractScenario,
  resolveDevContractRoastYield,
  roastedToGreenLocal,
  type EligibleContractLot,
} from "./devContractScenario.pure"

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type SeedDevContractScenarioInput = {
  scenario: DevContractScenarioKind
  seed?: string
  clientEmail?: string  // reserved for a future per-client override
}

export type DevContractLotUsage = {
  greenLotId: string
  lotNumber: string
  variety: string
  scaScore: number | null
  clientB2BPricePerKg: number | null
}

export type SeededDevContract = {
  id: string
  status: string
  greenLotId: string | null
  monthlyVolumeKg: number
  monthlyGreenKg: number | null
  durationMonths: number
  lockedPricePerKg: number | null
}

export type SeededDevDemandIntent = {
  id: string
  status: string
  greenLotId: string | null
  requestedKg: number
  deltaKg: number
  previewPricePerKg: number | null
}

export type SeedDevContractScenarioResult = {
  ok: true
  scenario: DevContractScenarioKind
  appliedSeed: string
  contractsCreated: SeededDevContract[]
  demandIntentsCreated: SeededDevDemandIntent[]
  lotsUsed: DevContractLotUsage[]
  resetSummary: DevContractResetSummary | null
}

export type DevContractResetSummary = {
  contractsDeleted: number
  demandIntentsDeleted: number
  signatureTokensDeleted: number
  ordersDeleted: number
  warnings: string[]
}

export type DevContractScenarioStatus = {
  generatedAt: string
  devClient: {
    userEmail: string
    companyName: string
    companyId: string | null
  }
  contracts: number
  demandIntents: number
  recentContracts: Array<{
    id: string
    status: string
    monthlyVolumeKg: number
    durationMonths: number
    remainingMonths: number
    lockedPricePerKg: number | null
    greenLotId: string | null
    lotNumber: string | null
    variety: string | null
    createdAt: string
  }>
  recentDemandIntents: Array<{
    id: string
    status: string
    requestedKg: number
    deltaKg: number
    previewPricePerKg: number | null
    greenLotId: string | null
    lotNumber: string | null
    createdAt: string
  }>
}

// ------------------------------------------------------
// DEV CLIENT ACTOR — User + Company
// ------------------------------------------------------

const DEV_CONTRACT_USER_NAME = "Dev Contract Scenarios Client"
const DEV_CONTRACT_PASSWORD_HASH: string = bcrypt.hashSync(
  "dev-contract-scenarios-no-login-do-not-use",
  4,
)

async function ensureDevContractClient(tx: Prisma.TransactionClient): Promise<{
  userId: string
  companyId: string
}> {
  const existingUser = await tx.user.findUnique({
    where: { email: DEV_CONTRACT_CLIENT_USER_EMAIL },
    select: { id: true, role: true, onboardingCompleted: true, companyId: true },
  })

  let user: { id: string; companyId: string | null }
  if (existingUser) {
    if (existingUser.role !== "CLIENT" || !existingUser.onboardingCompleted) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: { role: "CLIENT", onboardingCompleted: true },
      })
    }
    user = { id: existingUser.id, companyId: existingUser.companyId }
  } else {
    const created = await tx.user.create({
      data: {
        email: DEV_CONTRACT_CLIENT_USER_EMAIL,
        passwordHash: DEV_CONTRACT_PASSWORD_HASH,
        name: DEV_CONTRACT_USER_NAME,
        role: "CLIENT",
        onboardingCompleted: true,
      },
      select: { id: true, companyId: true },
    })
    user = created
  }

  // Find or create the dev company.
  const existingCompany = await tx.company.findFirst({
    where: { name: DEV_CONTRACT_COMPANY_NAME },
    select: { id: true },
  })

  let companyId: string
  if (existingCompany) {
    companyId = existingCompany.id
  } else {
    const created = await tx.company.create({
      data: {
        name: DEV_CONTRACT_COMPANY_NAME,
        country: "TEST",
        contactName: DEV_CONTRACT_USER_NAME,
      },
      select: { id: true },
    })
    companyId = created.id
  }

  // Link the user to the company if not already linked.
  if (user.companyId !== companyId) {
    await tx.user.update({
      where: { id: user.id },
      data: { companyId },
    })
  }

  return { userId: user.id, companyId }
}

// ------------------------------------------------------
// ELIGIBLE LOT LOOKUP
// ------------------------------------------------------

async function loadEligibleDevLots(
  tx: Prisma.TransactionClient,
): Promise<EligibleContractLot[]> {

  const rows = await tx.greenLot.findMany({
    where: {
      status: "PUBLISHED",
      lotNumber: { startsWith: `${DEV_CONTRACT_LOT_PREFIX}-` },
      pricingSnapshot: { isNot: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      lotNumber: true,
      variety: true,
      process: true,
      scaScore: true,
      altitude: true,
      estimatedRoastYield: true,
      availableKg: true,
      status: true,
      pricingSnapshot: {
        select: {
          clientB2BPricePerKg: true,
          clientPricePerKg: true,
        },
      },
    },
  })

  return rows
    .filter((r) => r.pricingSnapshot != null)
    .map((r) => ({
      id: r.id,
      lotNumber: r.lotNumber,
      variety: r.variety,
      process: r.process,
      scaScore: r.scaScore,
      altitude: r.altitude,
      estimatedRoastYield: r.estimatedRoastYield,
      availableGreenKg: r.availableKg,
      clientB2BPricePerKg: r.pricingSnapshot!.clientB2BPricePerKg ?? null,
      legacyGreenPricePerKg: r.pricingSnapshot!.clientPricePerKg,
      status: r.status,
    }))
}

// ------------------------------------------------------
// PRICE RESOLVER — mirrors resolveClientB2BPriceForLot
//
// We inline the rule here to avoid coupling this dev
// service to the pricing service's Prisma type narrowing.
// Rule: persisted B2B wins; else legacy green via yield.
// ------------------------------------------------------

function resolveB2BPriceForLot(lot: EligibleContractLot): {
  pricePerKgRoasted: number
  source: "CLIENT_B2B_PERSISTED" | "LEGACY_GREEN_EQUIVALENT"
} {
  const yieldRate = resolveDevContractRoastYield({
    estimatedRoastYield: lot.estimatedRoastYield,
    process: lot.process,
  })
  if (
    typeof lot.clientB2BPricePerKg === "number" &&
    Number.isFinite(lot.clientB2BPricePerKg) &&
    lot.clientB2BPricePerKg > 0
  ) {
    return {
      pricePerKgRoasted: lot.clientB2BPricePerKg,
      source: "CLIENT_B2B_PERSISTED",
    }
  }
  if (
    typeof lot.legacyGreenPricePerKg === "number" &&
    Number.isFinite(lot.legacyGreenPricePerKg) &&
    lot.legacyGreenPricePerKg > 0
  ) {
    const safe = Math.max(0.5, yieldRate)
    return {
      pricePerKgRoasted: lot.legacyGreenPricePerKg / safe,
      source: "LEGACY_GREEN_EQUIVALENT",
    }
  }
  throw new DevContractScenarioError(
    `Lot ${lot.lotNumber} has no usable pricing (clientB2BPricePerKg and clientPricePerKg both missing).`,
    "DEV_CONTRACT_NO_PRICING",
    500,
  )
}

// ------------------------------------------------------
// SEED
// ------------------------------------------------------

export async function seedContractScenario(
  input: SeedDevContractScenarioInput,
): Promise<SeedDevContractScenarioResult> {

  if (!isDevContractScenarioKind(input.scenario)) {
    throw new DevContractScenarioError(
      `Invalid scenario: ${String(input.scenario)}`,
      "DEV_CONTRACT_INVALID_SCENARIO",
    )
  }

  const appliedSeed = (input.seed ?? "").trim() || Date.now().toString()
  const spec = getDevContractScenarioSpec(input.scenario)
  const now = new Date()

  // STAGE A — reset existing dev contracts. The empty_contracts
  // scenario is effectively just "reset, leave catalog alone".
  const resetSummary = await resetContractScenarios()

  if (input.scenario === "empty_contracts") {
    return {
      ok: true,
      scenario: input.scenario,
      appliedSeed,
      contractsCreated: [],
      demandIntentsCreated: [],
      lotsUsed: [],
      resetSummary,
    }
  }

  // STAGE B — seed inside a transaction.
  const result = await prisma.$transaction(async (tx) => {
    const { companyId } = await ensureDevContractClient(tx)
    const lots = await loadEligibleDevLots(tx)

    const pick = pickEligibleLotsForContractScenario(input.scenario, lots)
    if (!pick.ok) {
      throw new DevContractScenarioError(
        pick.message ?? "Insufficient eligible dev lots.",
        "DEV_CONTRACT_NO_ELIGIBLE_LOTS",
        409,
      )
    }

    let lotCursor = 0
    const contractsCreated: SeededDevContract[] = []
    const demandIntentsCreated: SeededDevDemandIntent[] = []
    const lotsUsed: DevContractLotUsage[] = []

    // ─── Contracts ──────────────────────────────────
    for (const recipe of spec.contracts) {
      const lot = pick.picked[lotCursor++]
      const price = resolveB2BPriceForLot(lot)
      const payload = buildDevContractPayload({
        lot,
        recipe,
        resolvedPricePerKgRoasted: price.pricePerKgRoasted,
        now,
      })
      const created = await tx.contract.create({
        data: {
          companyId,
          greenLotId: payload.greenLotId,
          monthlyVolumeKg: payload.monthlyVolumeKg,
          monthlyGreenKg: payload.monthlyGreenKg,
          durationMonths: payload.durationMonths,
          remainingMonths: payload.remainingMonths,
          lockedPricePerKg: payload.lockedPricePerKg,
          roastYieldAtCreation: payload.roastYieldAtCreation,
          pricePerBag: payload.pricePerBag,
          bagSizeKg: payload.bagSizeKg,
          bagsPerDelivery: payload.bagsPerDelivery,
          monthlyPrice: payload.monthlyPrice,
          startDate: payload.startDate,
          endDate: payload.endDate,
          nextExecution: payload.nextExecution,
          status: payload.status as ContractStatus,
        },
        select: {
          id: true, status: true, greenLotId: true,
          monthlyVolumeKg: true, monthlyGreenKg: true,
          durationMonths: true, lockedPricePerKg: true,
        },
      })
      contractsCreated.push({
        id: created.id,
        status: created.status,
        greenLotId: created.greenLotId,
        monthlyVolumeKg: created.monthlyVolumeKg,
        monthlyGreenKg: created.monthlyGreenKg ?? null,
        durationMonths: created.durationMonths,
        lockedPricePerKg: created.lockedPricePerKg ?? null,
      })
      lotsUsed.push({
        greenLotId: lot.id,
        lotNumber: lot.lotNumber,
        variety: lot.variety,
        scaScore: lot.scaScore,
        clientB2BPricePerKg: lot.clientB2BPricePerKg,
      })
    }

    // ─── Demand intents ─────────────────────────────
    for (const recipe of spec.demandIntents) {
      const lot = pick.picked[lotCursor++]
      const price = resolveB2BPriceForLot(lot)
      const yieldRate = resolveDevContractRoastYield({
        estimatedRoastYield: lot.estimatedRoastYield,
        process: lot.process,
      })
      const deltaKg = roastedToGreenLocal(recipe.requestedRoastedKg, yieldRate)
      const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)

      const created = await tx.demandIntent.create({
        data: {
          companyId,
          type: "CREATE",
          greenLotId: lot.id,
          requestedKg: recipe.requestedRoastedKg,
          deltaKg,
          roastYieldAtEval: yieldRate,
          priceLocked: recipe.priceLocked,
          previewPricePerKg: price.pricePerKgRoasted,
          semaphore: recipe.semaphore,
          riskScore: 0.2,
          availableAtEval: lot.availableGreenKg,
          autoExecute: recipe.autoExecute,
          status: recipe.status as DemandIntentStatus,
          expiresAt,
        },
        select: {
          id: true, status: true, greenLotId: true,
          requestedKg: true, deltaKg: true, previewPricePerKg: true,
        },
      })
      demandIntentsCreated.push({
        id: created.id,
        status: created.status,
        greenLotId: created.greenLotId,
        requestedKg: created.requestedKg,
        deltaKg: created.deltaKg,
        previewPricePerKg: created.previewPricePerKg ?? null,
      })
      lotsUsed.push({
        greenLotId: lot.id,
        lotNumber: lot.lotNumber,
        variety: lot.variety,
        scaScore: lot.scaScore,
        clientB2BPricePerKg: lot.clientB2BPricePerKg,
      })
    }

    return { contractsCreated, demandIntentsCreated, lotsUsed }
  })

  return {
    ok: true,
    scenario: input.scenario,
    appliedSeed,
    contractsCreated: result.contractsCreated,
    demandIntentsCreated: result.demandIntentsCreated,
    lotsUsed: result.lotsUsed,
    resetSummary,
  }
}

// ------------------------------------------------------
// RESET
//
// Deletes ONLY rows owned by the dev contract company,
// and only when those rows reference a DEV-SCENARIO- lot
// (defensive — even if the dev company gets reused).
// ------------------------------------------------------

export async function resetContractScenarios(): Promise<DevContractResetSummary> {

  const warnings: string[] = []

  const company = await prisma.company.findFirst({
    where: { name: DEV_CONTRACT_COMPANY_NAME },
    select: { id: true },
  })

  if (!company) {
    return {
      contractsDeleted: 0,
      demandIntentsDeleted: 0,
      signatureTokensDeleted: 0,
      ordersDeleted: 0,
      warnings: ["No dev contract company exists yet — nothing to reset."],
    }
  }

  return prisma.$transaction(async (tx) => {

    // Gather contract ids owned by the dev company AND tied to a dev lot.
    const devContracts = await tx.contract.findMany({
      where: {
        companyId: company.id,
        OR: [
          { greenLot: { lotNumber: { startsWith: `${DEV_CONTRACT_LOT_PREFIX}-` } } },
          { greenLotId: null }, // legacy rows without a lot link
        ],
      },
      select: { id: true },
    })
    const contractIds = devContracts.map((c) => c.id)

    // Defensive warning if any contract on the dev company isn't tied to a dev lot.
    const offSpecCount = await tx.contract.count({
      where: {
        companyId: company.id,
        NOT: {
          OR: [
            { greenLot: { lotNumber: { startsWith: `${DEV_CONTRACT_LOT_PREFIX}-` } } },
            { greenLotId: null },
          ],
        },
      },
    })
    if (offSpecCount > 0) {
      warnings.push(
        `${offSpecCount} contract(s) on the dev company reference NON-dev lots — left untouched.`,
      )
    }

    let demandIntentsDeleted = 0
    let signatureTokensDeleted = 0
    let ordersDeleted = 0
    let contractsDeleted = 0

    // 1) DemandIntent — both contract-linked and standalone (company-owned).
    if (contractIds.length > 0) {
      const linked = await tx.demandIntent.deleteMany({
        where: { contractId: { in: contractIds } },
      })
      demandIntentsDeleted += linked.count
    }
    const standaloneIntents = await tx.demandIntent.deleteMany({
      where: {
        companyId: company.id,
        contractId: null,
        OR: [
          { greenLot: { lotNumber: { startsWith: `${DEV_CONTRACT_LOT_PREFIX}-` } } },
          { greenLotId: null },
        ],
      },
    })
    demandIntentsDeleted += standaloneIntents.count

    if (contractIds.length > 0) {
      // 2) SignatureToken
      const sig = await tx.signatureToken.deleteMany({
        where: { contractId: { in: contractIds } },
      })
      signatureTokensDeleted = sig.count

      // 3) Orders linked to dev contracts.
      const ord = await tx.order.deleteMany({
        where: { contractId: { in: contractIds } },
      })
      ordersDeleted = ord.count

      // 4) Contracts themselves.
      const c = await tx.contract.deleteMany({
        where: { id: { in: contractIds } },
      })
      contractsDeleted = c.count
    }

    return {
      contractsDeleted,
      demandIntentsDeleted,
      signatureTokensDeleted,
      ordersDeleted,
      warnings,
    }
  })
}

// ------------------------------------------------------
// STATUS
// ------------------------------------------------------

export async function listContractScenarioStatus(): Promise<DevContractScenarioStatus> {

  const generatedAt = new Date().toISOString()

  const company = await prisma.company.findFirst({
    where: { name: DEV_CONTRACT_COMPANY_NAME },
    select: { id: true },
  })

  if (!company) {
    return {
      generatedAt,
      devClient: {
        userEmail: DEV_CONTRACT_CLIENT_USER_EMAIL,
        companyName: DEV_CONTRACT_COMPANY_NAME,
        companyId: null,
      },
      contracts: 0,
      demandIntents: 0,
      recentContracts: [],
      recentDemandIntents: [],
    }
  }

  const [contracts, demandIntents, recentContracts, recentIntents] = await Promise.all([
    prisma.contract.count({ where: { companyId: company.id } }),
    prisma.demandIntent.count({ where: { companyId: company.id } }),
    prisma.contract.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        monthlyVolumeKg: true,
        durationMonths: true,
        remainingMonths: true,
        lockedPricePerKg: true,
        greenLotId: true,
        createdAt: true,
        greenLot: { select: { lotNumber: true, variety: true } },
      },
    }),
    prisma.demandIntent.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        requestedKg: true,
        deltaKg: true,
        previewPricePerKg: true,
        greenLotId: true,
        createdAt: true,
        greenLot: { select: { lotNumber: true } },
      },
    }),
  ])

  return {
    generatedAt,
    devClient: {
      userEmail: DEV_CONTRACT_CLIENT_USER_EMAIL,
      companyName: DEV_CONTRACT_COMPANY_NAME,
      companyId: company.id,
    },
    contracts,
    demandIntents,
    recentContracts: recentContracts.map((c) => ({
      id: c.id,
      status: c.status,
      monthlyVolumeKg: c.monthlyVolumeKg,
      durationMonths: c.durationMonths,
      remainingMonths: c.remainingMonths,
      lockedPricePerKg: c.lockedPricePerKg ?? null,
      greenLotId: c.greenLotId,
      lotNumber: c.greenLot?.lotNumber ?? null,
      variety: c.greenLot?.variety ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    recentDemandIntents: recentIntents.map((i) => ({
      id: i.id,
      status: i.status,
      requestedKg: i.requestedKg,
      deltaKg: i.deltaKg,
      previewPricePerKg: i.previewPricePerKg ?? null,
      greenLotId: i.greenLotId,
      lotNumber: i.greenLot?.lotNumber ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
  }
}

// Suppress unused-import warning in tooling — the values are used by
// types-only consumers downstream and to keep parity with the dev lot
// factory's exports.
void DEV_CONTRACT_PRICING_VERSION
void (null as ContractStatusName | DemandIntentStatusName | null)
