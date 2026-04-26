// =====================================================
// SUPPLY & COMMITMENT HEALTH MONITOR — TYPES
//
// All shapes used by the monitor module live here.
// Pure type declarations only. No runtime code.
// =====================================================

// =====================================================
// HEALTH SEVERITY
// =====================================================

export type HealthSeverity = "OK" | "WATCH" | "STRESSED" | "CRITICAL"

// Ordering used by conservative-max rollup.
export const SEVERITY_ORDER: Record<HealthSeverity, number> = {
  OK: 0,
  WATCH: 1,
  STRESSED: 2,
  CRITICAL: 3,
}

// =====================================================
// HEALTH AXES
// =====================================================

export type HealthAxisName =
  | "supply"
  | "demand"
  | "commitment"
  | "fulfilment"

export type HealthAxes = {
  supplyHealth: HealthSeverity
  demandHealth: HealthSeverity
  commitmentHealth: HealthSeverity
  fulfilmentHealth: HealthSeverity
  overallHealth: HealthSeverity
}

// =====================================================
// RAW INPUT ROWS (returned by dataAccess.ts)
//
// dataAccess.ts is the only file allowed to fetch
// these. Every other module consumes these shapes.
// =====================================================

export type CommittedContractRow = {
  id: string
  status: string
  monthlyGreenKg: number
  greenLotId: string | null
  companyId: string
}

export type OpenIntentRow = {
  id: string
  greenLotId: string | null
  companyId: string
  type: "CREATE" | "AMEND"
  requestedKg: number    // roasted
  offeredKg: number | null // roasted
  deltaKg: number        // green
  expiresAt: Date
  createdAt: Date
}

export type IntentWindowRow = {
  id: string
  status: string
  type: "CREATE" | "AMEND"
  contractId: string | null
  createdAt: Date
  consumedAt: Date | null
}

export type GreenLotAttributionRow = {
  id: string
  availableKg: number
  farmId: string
}

export type FulfilmentRow = {
  id: string
  status: string
  greenLotId: string
  producerId: string
  createdAt: Date
  updatedAt: Date
}

export type ContractableSupplyResult = {
  contractableKg: number
  grossAvailableKg: number
  committedKg: number
  reservedByIntentsKg: number
}

export type DataAccessSnapshot = {
  runStartedAt: Date
  publishedSupplyGreenRows: GreenLotAttributionRow[]
  contractableSupplyResult: ContractableSupplyResult
  committedContractRows: CommittedContractRow[]
  openIntentRowsCurrent: OpenIntentRow[]
  intentWindowCurrent: IntentWindowRow[]
  intentWindowPrior: IntentWindowRow[]
  fulfilmentRows: FulfilmentRow[]
  inputCounts: InputCounts
}

export type InputCounts = {
  greenLotCount: number
  committedContractCount: number
  openIntentCount: number
  fulfilmentRowCount: number
  windowIntentCountCurrent: number
  windowIntentCountPrior: number
}

// =====================================================
// METRICS
// =====================================================

export type ActiveOpenIntentLoad = {
  greenKg: number
  roastedKg: number
  offeredRoastedKg: number
  intentCount: number
  createCount: number
  amendCount: number
}

export type IntentConversion = {
  current7d: number | null  // 0..1
  prior7d: number | null    // 0..1
  deltaPts: number | null   // percentage points (current - prior) * 100
}

export type FulfilmentMetrics = {
  overdueCount: number
  overdueRatio: number | null  // null when no fulfilments
  oldestOverdueDays: number | null
}

// =====================================================
// PHASE 2 — SUPPLY-AXIS METRICS
//
// Pure aggregations over rows already returned by
// dataAccess.ts. No new Prisma reads.
// =====================================================

export type FarmConcentration = {
  topNShare: number | null         // 0..1, share of top-3 farms
  topNFarmIds: string[]            // up to 3 ids, sorted by share desc, id asc
  distinctFarmCount: number        // farms with availableKg > 0
  totalGreen: number               // = publishedSupplyGreen
}

export type PinnedLotExposure = {
  worstLotId: string | null
  worstRatio: number | null        // pinned monthly draw / lot.availableKg
  exposedLotCount: number          // lots with ratio >= PINNED_LOT_OVEREXPOSED.WATCH
  totalPinnedMonthlyGreen: number  // Σ pinned monthly draw across all pinned lots
  // Lots whose availableKg = 0 but still carry pinned commitments;
  // they cannot be ratio-ranked (Infinity) so are tracked separately.
  depletedPinnedLotIds: string[]
}

export type SupplyDiversity = {
  distinctFarmCount: number
  distinctLotCount: number
}

export type UnbackedCommitment = {
  contractCount: number
  monthlyGreenKg: number
  shareOfMonthlyDraw: number | null
  contractIds: string[]            // sorted by monthlyGreenKg desc, id asc; capped
}

export type Metrics = {
  publishedSupplyGreen: number
  contractableGreen: number
  committedGreen: number
  monthlyDrawGreen: number
  monthsOfCover: number | null
  monthsOfCoverCommittedOnly: number | null
  activeOpenIntentLoad: ActiveOpenIntentLoad
  intentPressureRatio: number | null
  intentConversion: IntentConversion
  fulfilment: FulfilmentMetrics
  // Phase 2 supply-axis metrics. Additive only.
  farmConcentration: FarmConcentration
  pinnedLotExposure: PinnedLotExposure
  supplyDiversity: SupplyDiversity
  unbackedCommitment: UnbackedCommitment
}

// =====================================================
// DETECTORS
// =====================================================

export type DetectorName =
  | "COMMITMENT_LOAD_HIGH"
  | "MONTHS_OF_COVER_LOW"
  | "MONTHS_OF_COVER_COMMITTED_LOW"
  | "INTENT_PRESSURE_HIGH"
  | "INTENT_CONVERSION_DROP"
  | "FULFILMENT_OVERDUE"
  // Phase 2 supply-axis detectors. Additive only.
  | "FARM_CONCENTRATION_HIGH"
  | "SUPPLY_DIVERSITY_LOW"
  | "PINNED_LOT_OVEREXPOSED"
  | "UNBACKED_COMMITMENTS_HIGH"

export type DetectorResult = {
  name: DetectorName
  severity: Exclude<HealthSeverity, "OK">
  axis: HealthAxisName
  observed: number | null
  threshold: number
  rationale: Record<string, number | string | null>
  contributingIds: {
    contractIds?: string[]
    demandIntentIds?: string[]
    producerFulfilmentIds?: string[]
    greenLotIds?: string[]
  }
}

// =====================================================
// REPORT
// =====================================================

export type Attribution = {
  byDetector: Partial<
    Record<DetectorName, DetectorResult["contributingIds"]>
  >
}

export type ReportMeta = {
  runId: string
  monitorVersion: string
  runStartedAt: string  // ISO
  runFinishedAt: string // ISO
  durationMs: number
  inputFingerprint: string
}

export type CommitmentHealthReport = {
  meta: ReportMeta
  inputCounts: InputCounts
  metrics: Metrics
  healthAxes: HealthAxes
  detectors: DetectorResult[]
  signals: DetectorResult[]
  attribution: Attribution
}
