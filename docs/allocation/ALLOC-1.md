# ALLOC-1 — Pure Inventory Allocation Engine

Sprint scope: a deterministic TypeScript engine that decides, for every `GreenLot`,
how much green kg should flow to each commercial surface (contract catalog,
open marketplace, exclusive microlot) versus stay blocked. No Prisma, no DB,
no UI, no Next route handler — pure domain logic only.

---

## 1. Files created / changed

| Path | Role |
|---|---|
| [src/services/allocation/domain/types.ts](../../src/services/allocation/domain/types.ts) | All domain types — no imports, no Prisma |
| [src/services/allocation/domain/partition.ts](../../src/services/allocation/domain/partition.ts) | `clampNonNegative`, `computeFreeGreenKg`, `normalizeVariety`, `isRareVariety`, `computeProfileViability` |
| [src/services/allocation/policy/customerProfiles.ts](../../src/services/allocation/policy/customerProfiles.ts) | `CUSTOMER_CONSUMPTION_PROFILES_V0` — 9 calibration rows |
| [src/services/allocation/policy/allocationPolicy.ts](../../src/services/allocation/policy/allocationPolicy.ts) | `DEFAULT_ALLOCATION_POLICY` constant |
| [src/services/allocation/engine/confidence.ts](../../src/services/allocation/engine/confidence.ts) | `computeAllocationConfidence` — 0.35..1, rounded |
| [src/services/allocation/engine/lotAllocationEngine.ts](../../src/services/allocation/engine/lotAllocationEngine.ts) | `decideLotAllocation(snap, policy?)` |
| [src/services/allocation/__tests__/lotAllocationEngine.golden.test.ts](../../src/services/allocation/__tests__/lotAllocationEngine.golden.test.ts) | 12 golden cases + cross-case invariants |
| [src/services/allocation/__tests__/partition.test.ts](../../src/services/allocation/__tests__/partition.test.ts) | Helper unit tests |
| [package.json](../../package.json) | Added `test:allocation` script (no new dependency) |

Untouched: Prisma schema, migrations, contract / demand-intent / supply / market /
shipment services, Next API routes, marketplace UI, dashboards, pricing,
engine/core, CoffeeAssistant.

---

## 2. Policy values implemented

```ts
DEFAULT_ALLOCATION_POLICY = {
  policyVersion: "allocation-policy-v0",
  safetyBufferGreenKg: 400,
  minMarketplaceKg: 5,
  minContractGreenKg: 1500,
  minimumContractMonths: 3,
  residualContractCoverageMonths: 6,
  premiumScaThreshold: 86,
  exclusiveScaThreshold: 90,
  microLotMaxGreenKg: 500,
  rareVarieties: ["GEISHA", "PINK_BOURBON", "SUDAN_RUME", "WUSH_WUSH"],
  contractProfiles: CUSTOMER_CONSUMPTION_PROFILES_V0,
}
```

### Customer profiles v0 (calibration assumptions, NOT verified truth)

| id | min / typical / max roasted kg/mo | duration | bag kg | microlot? | continuity? | switch tol. | minSCA | price |
|---|---|---|---|---|---|---|---|---|
| `small_specialty_cafe` | 30 / 60 / 120 | 6 | 5 | yes | yes | low | 84 | medium |
| `medium_cafe` | 120 / 250 / 400 | 6 | 10 | no | yes | low | 83 | medium |
| `large_cafe` | 400 / 700 / 1200 | 12 | 20 | no | yes | very-low | 83 | medium |
| `restaurant` | 20 / 40 / 80 | 6 | 5 | yes | no | medium | 82 | low |
| `hotel` | 100 / 200 / 400 | 12 | 10 | no | yes | low | 83 | medium |
| `office_corporate` | 30 / 80 / 200 | 12 | 10 | no | yes | high | 80 | high |
| `small_roaster` | 200 / 500 / 1000 | 6 | 30 | yes | no | medium | 84 | medium |
| `medium_roaster` | 800 / 1500 / 3000 | 12 | 60 | no | yes | low | 83 | medium |
| `high_volume_hospitality_group` | 1500 / 3000 / 6000 | 12 | 60 | no | yes | very-low | 82 | high |

These rows are explicitly marked as v0 in the source; founder validation is the
unblock for ALLOC-2+.

---

## 3. Algorithm shape

The engine routes a snapshot through six numbered stages:

1. **Structural holds** — `DRAFT`, `SOLD`, `RESERVED` / has `shipmentId`, or
   `greenPricePerKg == null` ⇒ `HOLD` with the matching blocking reason.
2. **Unclaimed pool** — `available − committed − reservedIntents` (no buffer
   yet). The buffer is applied per-branch in stage 5.
3. **Classification** — exclusive (rare variety, OR high SCA on a microlot-sized
   pool), small lot (`total < minContractGreenKg`), premium microlot
   (`SCA ≥ premium && pool ≤ microLotMaxGreenKg`).
4. **Profile viability** — for each customer profile, `monthlyGreenKg =
   monthlyRoastedKgTypical / yield`; viable iff lot SCA passes the profile's
   minimum AND `floor(free / monthlyGreenKg) ≥ minimumContractMonths`. Free
   pool here already subtracts the buffer the contract path would face.
5. **Routing** — exclusive ⇒ `EXCLUSIVE_MICROLOT`, small ⇒ `OPEN_MARKETPLACE`
   (`LOW_VOLUME_LOT`), premium microlot ⇒ `OPEN_MARKETPLACE`
   (`PREMIUM_MICROLOT_MARKETPLACE`), viable contract ⇒ reserve
   `largest-monthly × residualContractCoverageMonths` and route the rest to
   marketplace if it clears `minMarketplaceKg` (`SPLIT`) else
   `CONTRACT_CATALOG`. No viable profile but contract-sized lot ⇒ marketplace
   if free ≥ floor, else `HOLD`.
6. **Pool invariant + confidence** — partition sum can never exceed
   `availableGreenKg` (drained in marketplace → assignable → exclusive →
   blocked order to absorb rounding); confidence is computed pure from data
   completeness flags and clamped to `[0.35, 1]`.

### Why the safety buffer is applied per-branch, not globally

The user spec drafted a flat
`freeGreenKg = available − committed − reserved − safetyBuffer` for every lot.
That collides with the user-listed test cases for 300 kg and 400 kg lots: a flat
400 kg deduction would zero out the entire free pool and force `HOLD` for both
`LOW_VOLUME_LOT` and `RARE_VARIETY_EXCLUSIVE` cases. The buffer's job in
production (`src/services/system/supply.service.ts`) is to protect contract
supply from over-commit; small / exclusive / premium-microlot lots don't drive
recurring contracts, so the buffer is intentionally bypassed on those branches
and applied only on the contract-candidate and no-viable-profile paths. This is
documented in [allocationPolicy.ts](../../src/services/allocation/policy/allocationPolicy.ts)
and in the engine header.

### Why "high SCA alone" doesn't trigger exclusive

A 4-tonne SCA-90 lot would otherwise be ripped out of the contract supply.
`isExclusive = isRare || (isHighSca && microlot-sized)` ensures large
high-quality lots stay contract-eligible, while truly limited high-SCA lots
get the exclusive route.

### Committed-contract semantics

`committedContractGreenKg` is treated as **monthly** committed (matches
`src/services/system/supply.service.ts` line 82–84). The snapshot also carries
`committedContractMonthsRemaining` so ALLOC-2 can model long-horizon
obligations explicitly; the engine surfaces it on the snapshot but does not
multiply yet — per the user note "do not pretend monthlyGreenKg and full
contract coverage are the same thing", the multiplication belongs in the
snapshot builder, not the pure engine.

---

## 4. Reason codes

All 20 codes from the spec are wired up with one short audit-friendly message:

```
LOT_NOT_PUBLISHED  LOT_ALREADY_SOLD  SHIPMENT_ALREADY_RESERVED
SAFETY_BUFFER_RESERVED  CONTRACT_COMMITTED  DEMAND_INTENT_RESERVED
CONTRACT_VOLUME_SUFFICIENT  CONTRACT_VOLUME_INSUFFICIENT
MONTHLY_CONTRACT_CAPACITY_AVAILABLE
RESIDUAL_TOO_SMALL_FOR_CONTRACT  RESIDUAL_MARKETPLACE_ELIGIBLE
PREMIUM_MICROLOT_MARKETPLACE  RARE_VARIETY_EXCLUSIVE  HIGH_SCA_EXCLUSIVE
LOW_VOLUME_LOT  MISSING_ROAST_YIELD  MISSING_PRICING
QUALITY_HOLD  RISK_HOLD  PRICING_HOLD
```

`LOW_VOLUME_LOT` (not `LOW_VOLUME_FARM`) is the deliberate naming, per the spec
note that we don't have reliable annual farm production yet.

`RISK_HOLD` and `PRICING_HOLD` are declared but not currently emitted; they
are reserved hooks for ALLOC-2 once the snapshot builder can read
`MarketSignalSnapshot` and detect pricing inconsistencies.

---

## 5. Golden tests implemented

All 12 spec cases plus invariants. From `npm run test:allocation`:

```
▶ decideLotAllocation — golden
  ✔ 1. Large lot 5000kg, SCA 84, Caturra, no commitments → contract eligible
  ✔ 2. Very large lot 30000kg → SPLIT with marketplace residual
  ✔ 3. Small lot 300kg, SCA 85 → OPEN_MARKETPLACE + LOW_VOLUME_LOT
  ✔ 4. Geisha SCA 91, 400kg → EXCLUSIVE_MICROLOT (rare variety)
  ✔ 5. Caturra SCA 90, 2000kg → NOT exclusive, contract route
  ✔ 6. Lot with active committedContractGreenKg → CONTRACT_COMMITTED reason
  ✔ 7. Lot with reservedIntentGreenKg → DEMAND_INTENT_RESERVED + deduction
  ✔ 8. Shipment-bound lot (status RESERVED + shipmentId) → HOLD
  ✔ 9. Missing pricing → HOLD + MISSING_PRICING
  ✔ 10. Default roast yield → confidence < 1 + MISSING_ROAST_YIELD warning
  ✔ 11. DRAFT lot → HOLD + LOT_NOT_PUBLISHED
  ✔ 12. Free pool below minMarketplace and no viable contract → HOLD
▶ decideLotAllocation — invariants
  ✔ evaluatedAt is a valid ISO-8601 timestamp
  ✔ policyVersion matches the policy used
  ✔ partition pools are never negative for any golden case
  ✔ pool sum never exceeds availableGreenKg for any golden case
```

Plus 18 helper unit tests in `partition.test.ts` covering `clampNonNegative`,
`computeFreeGreenKg`, `normalizeVariety`, `isRareVariety`, and
`computeProfileViability` (NaN/Infinity guards, SCA filtering, yield
fallbacks, monthsCovered floor).

For test 2 (SPLIT), the smallest lot that produces a marketplace residual
under the v0 policy is ~22 tonnes — the largest viable profile is the
hospitality group at 3 614 kg green/month, requiring 6 × 3 614 ≈ 21 684 kg
of contract reserve before any residual remains. The test uses 30 000 kg.
This is intentional: under the current policy, residuals only appear on
genuinely huge lots. Founder calibration may shift this.

---

## 6. Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Clean (no output) |
| `npm run test:allocation` | ✅ 34 / 34 pass, ~0.5 s end-to-end |
| `npm run build` | ✅ Next.js build green; new files compile cleanly |

Node version: `v24.14.1` — `--experimental-strip-types` works without flags
warnings. The runtime emits a one-off `MODULE_TYPELESS_PACKAGE_JSON` warning
because the package is CommonJS by default; this is informational only and
does not affect correctness or the test pass rate.

No new npm dependencies. No migrations. No schema changes.

---

## 7. Known limitations

1. **Calibration is unverified.** Every number in `customerProfiles.ts` and the
   thresholds in `allocationPolicy.ts` is a v0 placeholder. They produce
   internally consistent decisions but were not validated against real customer
   data. ALLOC-1 explicitly does not claim these are correct.

2. **`committedContractGreenKg` is treated as monthly.** Matches
   `supply.service.ts` line 82–84 today. The engine accepts
   `committedContractMonthsRemaining` on the snapshot so the snapshot builder
   in ALLOC-2 can choose to deduct full-horizon obligations. Until that
   change, a 12-month contract committed at 100 kg/mo only deducts 100 kg
   from `availableGreenKg`, not 1 200 kg.

3. **`isExclusive` precedence over `committed`.** A rare-variety lot with
   active contract commitments still routes its unclaimed pool to
   `EXCLUSIVE_MICROLOT`. The contract reservation is reflected in
   `contractReservedGreenKg`, but the engine does not currently warn that
   future contracts on this lot have been deprioritised. Acceptable for v0;
   surface in ALLOC-5 admin inspector.

4. **SPLIT requires very large lots under v0 thresholds.** Because the engine
   reserves `largest-viable-monthly × 6` for future contracts, residual only
   appears once the lot is materially larger than the biggest profile's
   half-year horizon. If founder calibration shifts the largest viable
   profile down, splits will appear on smaller lots.

5. **`MarketDemandIndex` accepted but not used.** Snapshot field exists for
   ALLOC-2 risk scoring; the engine ignores it for now.

6. **`evaluatedAt` is non-deterministic.** `decideLotAllocation` calls
   `new Date().toISOString()`. Tests work around this by comparing structure
   rather than equality. Bit-for-bit golden snapshots would require the
   caller to inject the timestamp; out of scope for v0.

7. **`isolatedModules` strict mode + `@/src/...` aliases.** All allocation
   files use **relative** imports with explicit `.ts` extensions. This is
   required for Node's `--experimental-strip-types` runtime, which does not
   resolve TypeScript path aliases. The rest of the codebase keeps its
   `@/src/...` style untouched.

8. **No Spanish strings in reason messages.** All operator-facing text is
   English. The UI layer (ALLOC-3+) is responsible for i18n.

---

## 8. Next recommended sprint — ALLOC-2

Build the **Prisma snapshot builder + internal dry-run endpoint** behind
`requireDevRoute`.

Concretely:

```
src/services/allocation/snapshot/lotAllocationSnapshot.service.ts
app/api/internal/allocation/run/route.ts
app/api/internal/allocation/lot/[id]/route.ts
```

Responsibilities:

1. `buildAllocationSnapshots({ greenLotId?, tx? })` issues **three** queries
   (lots with farm+pricing, contracts grouped by `greenLotId`, open intents
   grouped by `greenLotId`) and stitches them into `LotAllocationSnapshot[]`.
   This kills the existing N+1 pattern in
   `src/services/clients/market.service.ts` line 97–102.
2. Convert long-horizon contract commitments here (sum of
   `monthlyGreenKg × remainingMonths`), not in the engine.
3. Resolve `estimatedRoastYield` via `src/lib/roastYield.ts` and set
   `usedDefaultRoastYield: estimatedRoastYield === null`.
4. Filter `RESERVED` lots in by default so `SHIPMENT_ALREADY_RESERVED`
   reasons can be emitted (do not silently drop them — the inspector page
   needs to see them).
5. Internal endpoint behind the existing `requireDevRoute({ requireUser: true })`
   guard, returning `{ decisions, snapshotsTakenAt, policyVersion }`.

After ALLOC-2, ALLOC-3 wires `/api/marketplace/lots` and ALLOC-4 wires
`/api/contracts/catalog` — these are pure adapter layers that filter the
decisions array.

**Non-goals for ALLOC-2**: no schema changes, no admin UI yet, no persistence
of decisions, no override mechanism.
