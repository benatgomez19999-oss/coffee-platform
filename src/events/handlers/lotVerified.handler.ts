import { eventBus } from "@/events/core/eventBus"
import { EVENTS } from "@/events/core/eventTypes"

// =====================================================
// LOT VERIFIED HANDLER
//
// Reacciona al evento más importante del sistema
//
// Aquí NO hay lógica principal
// SOLO side effects
// =====================================================

export function registerLotVerifiedHandler() {

  eventBus.on(EVENTS.LOT_VERIFIED, async (payload: {

    greenLotId: string
    lotId: string

  }) => {

    //////////////////////////////////////////////////////
    // 🧠 EVENT RECEIVED
    //////////////////////////////////////////////////////

    console.log("EVENT: LOT VERIFIED", payload)

    //////////////////////////////////////////////////////
    // ⏳ FUTURO
    //////////////////////////////////////////////////////

    // labels
    // inventory sync
    // notifications

  })
}