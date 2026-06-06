//////////////////////////////////////////////////////
// 📊 CONTRACT PORTFOLIO METRICS
//
// Pure derivation of dashboard portfolio metrics from
// the data the existing client dashboard already loads:
//   - /api/contracts (contracts list with status + monthly volume)
//   - /api/demand-intent (intents list with status)
//   - /api/market (market totals: roasted available, lot count)
//   - /api/contracts/catalog (catalog totals)
//
// Returns deterministic numbers + safe zeroes so empty
// states render correctly when the user has no data yet.
//////////////////////////////////////////////////////

export type ContractStatusLike = {
  status?: string | null
  monthlyGreenKg?: number | null
  monthlyVolumeKg?: number | null
  remainingMonths?: number | null
  nextShipmentAt?: string | null
  origin?: { country?: string | null } | null
  greenLot?: {
    farm?: { region?: string | null } | null
    producer?: { country?: string | null } | null
  } | null
}

export type DemandIntentStatusLike = {
  status?: string | null
}

export type MarketTotalsLike = {
  roastedAvailableKg?: number | null
  lotCount?: number | null
}

export type CatalogTotalsLike = {
  totalAssignableRoastedKg?: number | null
  totalLots?: number | null
}

export type PortfolioMetrics = {
  activeContracts: number
  pendingSignatureContracts: number
  pendingPaymentContracts: number
  monthlyGreenKg: number
  availableRoastedKg: number
  publishedLots: number
  pendingRequests: number
  uniqueOrigins: number
  contractCatalogRoastedKg: number
  contractCatalogLots: number
  nextShipment: { dateIso: string | null; country: string | null }
}

const ACTIVE_STATUSES = new Set(["ACTIVE"])
const PENDING_SIGNATURE_STATUSES = new Set([
  "PENDING_SIGNATURE",
  "AWAITING_SIGNATURE",
  "PENDING_OTP",
  "PILOT_PENDING",
])
const PENDING_PAYMENT_STATUSES = new Set([
  "PENDING_PAYMENT",
  "AWAITING_PAYMENT",
  "PAYMENT_PENDING",
])
const PENDING_INTENT_STATUSES = new Set([
  "OPEN",
  "COUNTERED",
  "WAITING",
])

function safeMonthlyGreenKg(c: ContractStatusLike): number {
  if (typeof c.monthlyGreenKg === "number" && Number.isFinite(c.monthlyGreenKg)) {
    return c.monthlyGreenKg
  }
  if (typeof c.monthlyVolumeKg === "number" && Number.isFinite(c.monthlyVolumeKg)) {
    return c.monthlyVolumeKg
  }
  return 0
}

function originCountry(c: ContractStatusLike): string | null {
  return (
    c.greenLot?.producer?.country ??
    c.origin?.country ??
    null
  )
}

export function computePortfolioMetrics(input: {
  contracts: ReadonlyArray<ContractStatusLike>
  intents: ReadonlyArray<DemandIntentStatusLike>
  market: { totals?: MarketTotalsLike | null } | null
  catalog: CatalogTotalsLike | null
}): PortfolioMetrics {

  const contracts = input.contracts ?? []
  const intents = input.intents ?? []

  let active = 0
  let pendSig = 0
  let pendPay = 0
  let monthlyGreen = 0
  const origins = new Set<string>()

  // Earliest upcoming shipment among active contracts.
  let nextShipmentDate: number | null = null
  let nextShipmentCountry: string | null = null

  for (const c of contracts) {
    const s = (c.status ?? "").toUpperCase()
    if (ACTIVE_STATUSES.has(s)) {
      active += 1
      monthlyGreen += safeMonthlyGreenKg(c)
      const country = originCountry(c)
      if (country && country.trim()) origins.add(country.trim())
      if (typeof c.nextShipmentAt === "string" && c.nextShipmentAt.trim()) {
        const t = Date.parse(c.nextShipmentAt)
        if (Number.isFinite(t)) {
          if (nextShipmentDate == null || t < nextShipmentDate) {
            nextShipmentDate = t
            nextShipmentCountry = country
          }
        }
      }
    } else if (PENDING_SIGNATURE_STATUSES.has(s)) {
      pendSig += 1
    } else if (PENDING_PAYMENT_STATUSES.has(s)) {
      pendPay += 1
    }
  }

  let pending = 0
  for (const i of intents) {
    const s = (i.status ?? "").toUpperCase()
    if (PENDING_INTENT_STATUSES.has(s)) pending += 1
  }

  return {
    activeContracts: active,
    pendingSignatureContracts: pendSig,
    pendingPaymentContracts: pendPay,
    monthlyGreenKg: Math.round(monthlyGreen),
    availableRoastedKg: Math.round(input.market?.totals?.roastedAvailableKg ?? 0),
    publishedLots: input.market?.totals?.lotCount ?? 0,
    pendingRequests: pending,
    uniqueOrigins: origins.size,
    contractCatalogRoastedKg: Math.round(input.catalog?.totalAssignableRoastedKg ?? 0),
    contractCatalogLots: input.catalog?.totalLots ?? 0,
    nextShipment: {
      dateIso: nextShipmentDate != null ? new Date(nextShipmentDate).toISOString() : null,
      country: nextShipmentCountry,
    },
  }
}
