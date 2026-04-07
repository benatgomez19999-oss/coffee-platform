import { EVENTS } from "@/src/events/core/eventTypes"

//////////////////////////////////////////////////////
// 🚚 LOGISTICS EVENTS
//////////////////////////////////////////////////////

export const LOGISTICS_EVENTS = {
  SAMPLE_PICKUP_REQUESTED: "sample_pickup_requested",
  SAMPLE_PICKUP_SCHEDULED: "sample_pickup_scheduled",
  SAMPLE_IN_TRANSIT: "sample_in_transit",
  SAMPLE_DELIVERED: "sample_delivered",
} as const

//////////////////////////////////////////////////////
// 🔗 OPTIONAL: MAP TO CORE EVENTS
// (si quieres centralizar naming después)
//////////////////////////////////////////////////////

export const mapLogisticsEventToCore = (status: string) => {
  switch (status) {
    case "PICKUP_REQUESTED":
      return LOGISTICS_EVENTS.SAMPLE_PICKUP_REQUESTED
    case "PICKUP_SCHEDULED":
      return LOGISTICS_EVENTS.SAMPLE_PICKUP_SCHEDULED
    case "IN_TRANSIT":
      return LOGISTICS_EVENTS.SAMPLE_IN_TRANSIT
    case "DELIVERED":
      return LOGISTICS_EVENTS.SAMPLE_DELIVERED
    default:
      return null
  }
}