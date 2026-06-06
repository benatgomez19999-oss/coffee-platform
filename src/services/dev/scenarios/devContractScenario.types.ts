//////////////////////////////////////////////////////
// 📑 DEV CONTRACT SCENARIO — TYPES + PURE CONSTS
//
// Pure module — no Prisma, no HTTP. Imported by both
// the service (Prisma writer) and the pure helpers
// (testable picker / spec / status mapping).
//////////////////////////////////////////////////////

export type DevContractScenarioKind =
  | "empty_contracts"
  | "one_pending_signature"
  | "one_active_contract"
  | "mixed_contract_portfolio"
  | "demand_intent_pending"

export const DEV_CONTRACT_SCENARIO_KINDS: ReadonlyArray<DevContractScenarioKind> = [
  "empty_contracts",
  "one_pending_signature",
  "one_active_contract",
  "mixed_contract_portfolio",
  "demand_intent_pending",
]

export function isDevContractScenarioKind(value: unknown): value is DevContractScenarioKind {
  return typeof value === "string" && (DEV_CONTRACT_SCENARIO_KINDS as readonly string[]).includes(value)
}

// ------------------------------------------------------
// Prefixes / identifiers — every dev-generated row must
// be tagged so reset can target exactly the right rows.
// ------------------------------------------------------

export const DEV_CONTRACT_COMPANY_NAME = "[DEV] Contract Scenarios Company"
export const DEV_CONTRACT_CLIENT_USER_EMAIL = "client.contract-scenarios@alturacollective.test"
export const DEV_CONTRACT_PRICING_VERSION = "dev-contract-scenario-v1"

// MarketSignalTick / lots use DEV-SCENARIO-; contracts piggy-back on
// the dev lot's lotNumber prefix for the inner join check on reset.
export const DEV_CONTRACT_LOT_PREFIX = "DEV-SCENARIO"

// ------------------------------------------------------
// PER-SCENARIO SPEC
//
// Used by both the picker (how many lots we need) and the
// service (which Contract statuses + DemandIntent statuses
// to write). Pure data — no Prisma enums here so this file
// stays consumable under node --test.
// ------------------------------------------------------

export type ContractStatusName =
  | "PENDING"
  | "AWAITING_SIGNATURE"
  | "SIGNED"
  | "PAYMENT_PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "COMPLETED"
  | "CANCELLED"

export type DemandIntentStatusName =
  | "OPEN"
  | "COUNTERED"
  | "WAITING"
  | "CONSUMED"
  | "EXPIRED"
  | "REJECTED"
  | "CANCELLED"

export type DevContractRecipe = {
  status: ContractStatusName
  monthlyRoastedKg: number
  durationMonths: number
  remainingMonths: number
  startOffsetDays: number   // negative = past, 0 = today
}

export type DevDemandIntentRecipe = {
  status: DemandIntentStatusName
  requestedRoastedKg: number
  semaphore: "green" | "yellow" | "red"
  priceLocked: boolean
  autoExecute: boolean
}

export type DevContractScenarioSpec = {
  scenario: DevContractScenarioKind
  contracts: DevContractRecipe[]
  demandIntents: DevDemandIntentRecipe[]
}

const SPEC_BY_SCENARIO: Record<DevContractScenarioKind, DevContractScenarioSpec> = {
  empty_contracts: {
    scenario: "empty_contracts",
    contracts: [],
    demandIntents: [],
  },
  one_pending_signature: {
    scenario: "one_pending_signature",
    contracts: [
      {
        status: "AWAITING_SIGNATURE",
        monthlyRoastedKg: 400,
        durationMonths: 6,
        remainingMonths: 6,
        startOffsetDays: 0,
      },
    ],
    demandIntents: [],
  },
  one_active_contract: {
    scenario: "one_active_contract",
    contracts: [
      {
        status: "ACTIVE",
        monthlyRoastedKg: 600,
        durationMonths: 12,
        remainingMonths: 10,
        startOffsetDays: -60,
      },
    ],
    demandIntents: [],
  },
  mixed_contract_portfolio: {
    scenario: "mixed_contract_portfolio",
    contracts: [
      {
        status: "ACTIVE",
        monthlyRoastedKg: 800,
        durationMonths: 12,
        remainingMonths: 9,
        startOffsetDays: -90,
      },
      {
        status: "AWAITING_SIGNATURE",
        monthlyRoastedKg: 350,
        durationMonths: 6,
        remainingMonths: 6,
        startOffsetDays: 0,
      },
      {
        status: "PAYMENT_PENDING",
        monthlyRoastedKg: 500,
        durationMonths: 9,
        remainingMonths: 9,
        startOffsetDays: -3,
      },
      {
        status: "COMPLETED",
        monthlyRoastedKg: 200,
        durationMonths: 6,
        remainingMonths: 0,
        startOffsetDays: -200,
      },
    ],
    demandIntents: [],
  },
  demand_intent_pending: {
    scenario: "demand_intent_pending",
    contracts: [],
    demandIntents: [
      {
        status: "OPEN",
        requestedRoastedKg: 250,
        semaphore: "green",
        priceLocked: true,
        autoExecute: false,
      },
    ],
  },
}

export function getDevContractScenarioSpec(
  scenario: DevContractScenarioKind,
): DevContractScenarioSpec {
  return SPEC_BY_SCENARIO[scenario]
}

export class DevContractScenarioError extends Error {
  status: number
  code: string
  constructor(message: string, code: string, status = 400) {
    super(message)
    this.name = "DevContractScenarioError"
    this.code = code
    this.status = status
  }
}
