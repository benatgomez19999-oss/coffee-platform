//////////////////////////////////////////////////////
// 👥 DEV SCENARIO ACTORS
//
// Idempotent ensure-helper for the actors every dev
// scenario seed needs:
//   - one User with role=PRODUCER (stable email)
//   - one Producer linked to that user
//   - five [DEV]-prefixed farms covering the regions
//     used by the scenario recipes
//
// Re-running is a no-op once the rows exist. We never
// overwrite name / region / altitude on an existing
// farm — a developer may have tweaked one for testing.
//////////////////////////////////////////////////////

import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"

import { prisma } from "@/src/database/prisma"
import {
  DEV_FARM_RECIPES,
  DEV_PRODUCER_USER_EMAIL,
  type DevFarmKey,
} from "./devLotScenario.types"

//////////////////////////////////////////////////////
// CONSTANTS
//////////////////////////////////////////////////////

// This producer/user never logs in via password — it's
// only used as the OWNER of dev scenario rows. The hash
// is intentionally throwaway: cost 4 + a string nobody
// would ever guess.
const DEV_PASSWORD_HASH: string = bcrypt.hashSync(
  "dev-scenario-no-login-do-not-use",
  4
)

const DEV_PRODUCER_NAME = "Dev Producer"
const DEV_PRODUCER_COUNTRY = "COLOMBIA"

//////////////////////////////////////////////////////
// PUBLIC TYPES
//////////////////////////////////////////////////////

export type DevFarmInfo = {
  id: string
  name: string
  region: string | null
  altitude: number | null
}

export type DevScenarioActors = {
  userId: string
  producerId: string
  farms: Record<DevFarmKey, DevFarmInfo>
}

//////////////////////////////////////////////////////
// MAIN
//////////////////////////////////////////////////////

export async function ensureDevScenarioActors(
  tx?: Prisma.TransactionClient
): Promise<DevScenarioActors> {

  const db = tx ?? prisma

  // ─── 1. USER ───────────────────────────────────────
  const user = await ensureDevUser(db)

  // ─── 2. PRODUCER ──────────────────────────────────
  const producer = await ensureDevProducer(db, user.id)

  // ─── 3. FARMS ─────────────────────────────────────
  const farms = await ensureDevFarms(db, producer.id)

  return {
    userId: user.id,
    producerId: producer.id,
    farms,
  }
}

//////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////

async function ensureDevUser(
  db: Prisma.TransactionClient | typeof prisma
) {

  const existing = await db.user.findUnique({
    where: { email: DEV_PRODUCER_USER_EMAIL },
    select: { id: true, role: true, onboardingCompleted: true },
  })

  if (existing) {
    // Defensively make sure role + onboarding flags are right
    // without touching anything else (no name/phone overwrite).
    if (existing.role !== "PRODUCER" || !existing.onboardingCompleted) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          role: "PRODUCER",
          onboardingCompleted: true,
        },
      })
    }
    return existing
  }

  return db.user.create({
    data: {
      email: DEV_PRODUCER_USER_EMAIL,
      passwordHash: DEV_PASSWORD_HASH,
      name: "Dev Producer User",
      role: "PRODUCER",
      onboardingCompleted: true,
    },
    select: { id: true, role: true, onboardingCompleted: true },
  })
}

async function ensureDevProducer(
  db: Prisma.TransactionClient | typeof prisma,
  userId: string
) {

  const existing = await db.producer.findUnique({
    where: { userId },
    select: { id: true },
  })

  if (existing) return existing

  return db.producer.create({
    data: {
      userId,
      name: DEV_PRODUCER_NAME,
      country: DEV_PRODUCER_COUNTRY,
    },
    select: { id: true },
  })
}

async function ensureDevFarms(
  db: Prisma.TransactionClient | typeof prisma,
  producerId: string
): Promise<Record<DevFarmKey, DevFarmInfo>> {

  // Single batched read — find any existing dev farms by name
  // for this producer.
  const farmNames = DEV_FARM_RECIPES.map((r) => r.name)
  const existing = await db.farm.findMany({
    where: { producerId, name: { in: farmNames } },
    select: { id: true, name: true, region: true, altitude: true },
  })

  const byName = new Map<string, DevFarmInfo>()
  for (const f of existing) {
    byName.set(f.name, f)
  }

  const out: Partial<Record<DevFarmKey, DevFarmInfo>> = {}

  for (const recipe of DEV_FARM_RECIPES) {
    const found = byName.get(recipe.name)
    if (found) {
      // Reuse — never overwrite manual tweaks.
      out[recipe.key] = found
      continue
    }

    const created = await db.farm.create({
      data: {
        producerId,
        name: recipe.name,
        region: recipe.region,
        altitude: recipe.altitude,
      },
      select: { id: true, name: true, region: true, altitude: true },
    })
    out[recipe.key] = created
  }

  // Type assertion — we just populated every key from DEV_FARM_RECIPES.
  return out as Record<DevFarmKey, DevFarmInfo>
}
