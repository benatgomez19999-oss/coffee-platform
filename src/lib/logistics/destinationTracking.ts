// =====================================================
// Destination Tracking — pure constants + helpers
//
// Mirrors the Prisma DestinationTrackingStage enum but
// lives in a pure module (no Prisma client import) so it
// can be safely consumed by both server routes/services
// AND client components without bundling the Prisma
// runtime into the browser.
//
// The `as const` array gives us:
//   - a runtime list (for UI iteration / validation)
//   - a TS literal union (DestinationStage)
// in lockstep with the schema. If you add a value to the
// Prisma enum, mirror it here in the same order.
// =====================================================

export const DESTINATION_STAGES = [
  "ARRIVED_AT_ROTTERDAM_PORT",
  "ROTTERDAM_CUSTOMS_CHECKING",
  "ROTTERDAM_CUSTOMS_CLEARED",
  "TO_PORT_WAREHOUSE",
  "AT_PORT_WAREHOUSE",
  "AWAITING_PORT_WAREHOUSE_PICKUP",
  "TO_CO_ROASTER",
  "AT_CO_ROASTER_WAREHOUSE",
  "ROASTING_IN_PROGRESS",
  "FINAL_PACKING_20KG",
  "AWAITING_CO_ROASTER_PICKUP",
  "TO_CLIENT",
  "DESTINATION_CUSTOMS_CHECKING",
  "DESTINATION_CUSTOMS_CLEARED",
  "RECEIVED_BY_CLIENT",
] as const

export type DestinationStage = (typeof DESTINATION_STAGES)[number]

export const DESTINATION_STAGE_LABELS: Record<DestinationStage, string> = {
  ARRIVED_AT_ROTTERDAM_PORT:      "Arrived at Rotterdam port",
  ROTTERDAM_CUSTOMS_CHECKING:     "Rotterdam customs checking",
  ROTTERDAM_CUSTOMS_CLEARED:      "Rotterdam customs cleared",
  TO_PORT_WAREHOUSE:              "Moving to port warehouse",
  AT_PORT_WAREHOUSE:              "At port warehouse",
  AWAITING_PORT_WAREHOUSE_PICKUP: "Awaiting pickup from port warehouse",
  TO_CO_ROASTER:                  "On the way to co-roaster",
  AT_CO_ROASTER_WAREHOUSE:        "At co-roaster warehouse",
  ROASTING_IN_PROGRESS:           "Roasting in progress",
  FINAL_PACKING_20KG:             "Final packing — 20kg sacks",
  AWAITING_CO_ROASTER_PICKUP:     "Awaiting pickup from co-roaster",
  TO_CLIENT:                      "On the way to client",
  DESTINATION_CUSTOMS_CHECKING:   "Destination customs checking",
  DESTINATION_CUSTOMS_CLEARED:    "Destination customs cleared",
  RECEIVED_BY_CLIENT:             "Received by client",
}

// =====================================================
// Linear pre-customs flow.
// Branching happens after TO_CLIENT depending on
// requiresDestinationCustoms.
// =====================================================

const LINEAR_FLOW_BEFORE_CUSTOMS: readonly DestinationStage[] = [
  "ARRIVED_AT_ROTTERDAM_PORT",
  "ROTTERDAM_CUSTOMS_CHECKING",
  "ROTTERDAM_CUSTOMS_CLEARED",
  "TO_PORT_WAREHOUSE",
  "AT_PORT_WAREHOUSE",
  "AWAITING_PORT_WAREHOUSE_PICKUP",
  "TO_CO_ROASTER",
  "AT_CO_ROASTER_WAREHOUSE",
  "ROASTING_IN_PROGRESS",
  "FINAL_PACKING_20KG",
  "AWAITING_CO_ROASTER_PICKUP",
  "TO_CLIENT",
]

// =====================================================
// getNextDestinationStage
//
// - null  → ARRIVED_AT_ROTTERDAM_PORT (entry into
//   destination journey)
// - linear flow up to TO_CLIENT
// - TO_CLIENT branches based on requiresDestinationCustoms
// - DESTINATION_CUSTOMS_* leads to RECEIVED_BY_CLIENT
// - RECEIVED_BY_CLIENT is terminal (returns itself)
// =====================================================

export function getNextDestinationStage(
  current: DestinationStage | null,
  requiresDestinationCustoms: boolean
): DestinationStage {
  if (current === null) return "ARRIVED_AT_ROTTERDAM_PORT"

  if (current === "TO_CLIENT") {
    return requiresDestinationCustoms
      ? "DESTINATION_CUSTOMS_CHECKING"
      : "RECEIVED_BY_CLIENT"
  }

  if (current === "DESTINATION_CUSTOMS_CHECKING") return "DESTINATION_CUSTOMS_CLEARED"
  if (current === "DESTINATION_CUSTOMS_CLEARED")  return "RECEIVED_BY_CLIENT"
  if (current === "RECEIVED_BY_CLIENT")           return "RECEIVED_BY_CLIENT"

  const idx = LINEAR_FLOW_BEFORE_CUSTOMS.indexOf(current)
  if (idx >= 0 && idx < LINEAR_FLOW_BEFORE_CUSTOMS.length - 1) {
    return LINEAR_FLOW_BEFORE_CUSTOMS[idx + 1]
  }

  return current
}

// =====================================================
// Type guard for incoming dynamic input (route bodies).
// =====================================================

export function isDestinationStage(value: unknown): value is DestinationStage {
  return (
    typeof value === "string" &&
    (DESTINATION_STAGES as readonly string[]).includes(value)
  )
}
