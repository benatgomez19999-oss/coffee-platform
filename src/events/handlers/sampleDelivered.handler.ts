import { prisma } from "@/src/database/prisma"
import { eventBus } from "@/src/events/core/eventBus"
import { LOGISTICS_EVENTS } from "@/src/events/logistics/logistics.events"

//////////////////////////////////////////////////////
// 🚚 SAMPLE DELIVERED HANDLER
//////////////////////////////////////////////////////

export function registerSampleDeliveredHandler() {
  eventBus.on(
    LOGISTICS_EVENTS.SAMPLE_DELIVERED,
    async (payload: { lotId: string }) => {
      try {
        //////////////////////////////////////////////////////
        // 🧠 EVENT RECEIVED
        //////////////////////////////////////////////////////

        console.log("EVENT: SAMPLE DELIVERED", payload)

        //////////////////////////////////////////////////////
        // 🔥 MOVE LOT TO IN_REVIEW
        //////////////////////////////////////////////////////

        await prisma.producerLotDraft.update({
          where: { id: payload.lotId },
          data: {
            status: "IN_REVIEW",
          },
        })
      } catch (error) {
        console.error("[SAMPLE_DELIVERED_HANDLER_ERROR]", error)
      }
    }
  )
}