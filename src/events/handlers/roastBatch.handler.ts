import { eventBus } from "@/events/core/eventBus"
import { EVENTS } from "@/events/core/eventTypes"

// =====================================================
// ROAST BATCH HANDLER
//
// Reacciona a:
// green → roasted transformation
//
// Aquí van:
// — inventory updates
// — analytics
// — websocket
// =====================================================

export function registerRoastBatchHandler() {

  eventBus.on(EVENTS.ROAST_BATCH_COMPLETED, async (payload: any) => {

    //////////////////////////////////////////////////////
    // 🧠 EVENT RECEIVED
    //////////////////////////////////////////////////////

    console.log("EVENT: ROAST BATCH COMPLETED", payload)

    //////////////////////////////////////////////////////
    // ⏳ FUTURE
    //////////////////////////////////////////////////////

    // inventory sync
    // metrics
    // notifications

  })
}