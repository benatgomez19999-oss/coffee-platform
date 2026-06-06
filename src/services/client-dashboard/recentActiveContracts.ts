//////////////////////////////////////////////////////
// 📑 RECENT ACTIVE CONTRACTS — pure selector
//
// Filters the dashboard's contracts feed down to the
// "currently relevant" rows the right-side portfolio
// sidebar shows. Excludes COMPLETED and CANCELLED so
// historical noise doesn't flood the dashboard.
//
// No Prisma. No fetch. Easy to unit-test.
//////////////////////////////////////////////////////

export type DashboardContractLike = {
  id?: string | null
  status?: string | null
  monthlyVolumeKg?: number | null
  monthlyGreenKg?: number | null
  lockedPricePerKg?: number | null
  pricePerBag?: number | null
  bagSizeKg?: number | null
  nextExecution?: string | Date | null
  createdAt?: string | Date | null
  greenLot?: {
    name?: string | null
    variety?: string | null
    process?: string | null
    farm?: { name?: string | null; region?: string | null } | null
    producer?: { country?: string | null } | null
  } | null
}

export type RecentActiveContractRow = {
  id: string
  status: string
  title: string
  subtitle: string | null
  monthlyVolumeKg: number | null
  lockedPricePerKg: number | null
  nextExecutionIso: string | null
}

const ACTIVE_STATUSES = new Set([
  "ACTIVE",
  "AWAITING_SIGNATURE",
  "PAYMENT_PENDING",
])

const HIDE_FROM_DASHBOARD = new Set([
  "COMPLETED",
  "CANCELLED",
])

export function pickRecentActiveContracts(
  contracts: ReadonlyArray<DashboardContractLike>,
  limit = 3,
): RecentActiveContractRow[] {

  const max = Math.max(0, Math.floor(limit))
  if (max === 0) return []

  const usable = contracts
    .filter((c): c is DashboardContractLike & { status: string } => {
      const s = (c?.status ?? "").toUpperCase()
      if (!s) return false
      if (HIDE_FROM_DASHBOARD.has(s)) return false
      return ACTIVE_STATUSES.has(s)
    })
    .slice()
    .sort((a, b) => {
      // Active first, then awaiting signature, then payment pending.
      const order = (s: string) =>
        s === "ACTIVE" ? 0 :
        s === "AWAITING_SIGNATURE" ? 1 :
        s === "PAYMENT_PENDING" ? 2 :
        99
      const da = order((a.status ?? "").toUpperCase())
      const db = order((b.status ?? "").toUpperCase())
      if (da !== db) return da - db
      // Newest contract first within the same tier.
      const ta = parseEpoch(a.createdAt)
      const tb = parseEpoch(b.createdAt)
      return tb - ta
    })

  return usable.slice(0, max).map((c) => {
    const title =
      c.greenLot?.name ??
      c.greenLot?.farm?.name ??
      "Active contract"
    const region =
      c.greenLot?.farm?.region ?? c.greenLot?.producer?.country ?? null
    const process = c.greenLot?.process ? titleCase(c.greenLot.process) : null
    const subtitleParts: string[] = []
    if (region) {
      subtitleParts.push(region)
      if (c.greenLot?.producer?.country && region !== c.greenLot.producer.country) {
        subtitleParts.push(c.greenLot.producer.country)
      }
    } else if (c.greenLot?.producer?.country) {
      subtitleParts.push(c.greenLot.producer.country)
    }
    if (process) subtitleParts.push(process)
    const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : null

    return {
      id: c.id ?? "",
      status: (c.status ?? "").toUpperCase(),
      title,
      subtitle,
      monthlyVolumeKg:
        typeof c.monthlyVolumeKg === "number" && Number.isFinite(c.monthlyVolumeKg)
          ? c.monthlyVolumeKg
          : null,
      lockedPricePerKg:
        typeof c.lockedPricePerKg === "number" && Number.isFinite(c.lockedPricePerKg)
          ? c.lockedPricePerKg
          : null,
      nextExecutionIso: isoOrNull(c.nextExecution),
    }
  })
}

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

function parseEpoch(value: string | Date | null | undefined): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "string") {
    const t = Date.parse(value)
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

function isoOrNull(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null
  if (typeof value !== "string") return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

function titleCase(value: string): string {
  if (!value) return value
  const lower = value.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
