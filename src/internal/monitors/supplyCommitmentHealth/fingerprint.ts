// =====================================================
// INPUT FINGERPRINT
//
// Deterministic SHA-256 hash over the snapshot used by
// a monitor run. Two runs with the same fingerprint
// observed identical inputs.
//
// Properties asserted by tests:
//   - same input → same fingerprint
//   - any single row change → different fingerprint
//   - order-independent (rows sorted by id before hashing)
//
// Pure. Uses node:crypto only.
// =====================================================

import { createHash } from "node:crypto"

import { MONITOR_VERSION } from "./constants.ts"
import type { DataAccessSnapshot } from "./types.ts"

// Stable serialization helpers — never JSON.stringify of an
// arbitrary object, since key order is not guaranteed across
// engines for non-string keys.

type Stamp = { id: string; v: string }

function stampList(list: Stamp[]): string {
  return list
    .map((s) => `${s.id}|${s.v}`)
    .sort()  // sort by joined string → order-independent
    .join("\n")
}

function isoOrEmpty(d: Date | null | undefined): string {
  return d ? d.toISOString() : ""
}

export function computeInputFingerprint(
  snapshot: DataAccessSnapshot
): string {

  // 1. Committed contracts
  const contractStamps: Stamp[] = snapshot.committedContractRows.map((c) => ({
    id: `C:${c.id}`,
    v: `${c.status}|${c.monthlyGreenKg}|${c.greenLotId ?? ""}`,
  }))

  // 2. Open intents (current)
  const openIntentStamps: Stamp[] = snapshot.openIntentRowsCurrent.map((i) => ({
    id: `OI:${i.id}`,
    v: `${i.type}|${i.deltaKg}|${i.requestedKg}|${i.offeredKg ?? ""}|${i.greenLotId ?? ""}|${isoOrEmpty(i.expiresAt)}|${isoOrEmpty(i.createdAt)}`,
  }))

  // 3. Intent windows (use createdAt + status + consumedAt)
  const windowCurrentStamps: Stamp[] = snapshot.intentWindowCurrent.map((i) => ({
    id: `WC:${i.id}`,
    v: `${i.status}|${i.type}|${i.contractId ?? ""}|${isoOrEmpty(i.createdAt)}|${isoOrEmpty(i.consumedAt)}`,
  }))
  const windowPriorStamps: Stamp[] = snapshot.intentWindowPrior.map((i) => ({
    id: `WP:${i.id}`,
    v: `${i.status}|${i.type}|${i.contractId ?? ""}|${isoOrEmpty(i.createdAt)}|${isoOrEmpty(i.consumedAt)}`,
  }))

  // 4. Green lots
  const greenLotStamps: Stamp[] = snapshot.publishedSupplyGreenRows.map((l) => ({
    id: `GL:${l.id}`,
    v: `${l.availableKg}|${l.farmId}`,
  }))

  // 5. Fulfilments
  const fulfilmentStamps: Stamp[] = snapshot.fulfilmentRows.map((f) => ({
    id: `PF:${f.id}`,
    v: `${f.status}|${f.greenLotId}|${f.producerId}|${isoOrEmpty(f.createdAt)}|${isoOrEmpty(f.updatedAt)}`,
  }))

  // 6. Contractable supply numeric result
  const cs = snapshot.contractableSupplyResult
  const csStamp =
    `CS|${cs.contractableKg}|${cs.grossAvailableKg}|${cs.committedKg}|${cs.reservedByIntentsKg}`

  // 7. Monitor version
  const versionStamp = `MV|${MONITOR_VERSION}`

  // Compose
  const parts = [
    `[contracts]\n${stampList(contractStamps)}`,
    `[openIntents]\n${stampList(openIntentStamps)}`,
    `[windowCurrent]\n${stampList(windowCurrentStamps)}`,
    `[windowPrior]\n${stampList(windowPriorStamps)}`,
    `[greenLots]\n${stampList(greenLotStamps)}`,
    `[fulfilments]\n${stampList(fulfilmentStamps)}`,
    `[contractableSupply]\n${csStamp}`,
    `[monitorVersion]\n${versionStamp}`,
  ]

  const serialized = parts.join("\n---\n")

  return createHash("sha256")
    .update(serialized, "utf8")
    .digest("hex")
    // Compact for storage / human comparison.
    .slice(0, 32)
}
