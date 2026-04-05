// =====================================================
// IMPORTS
// =====================================================

import { eventBus } from "@/src/events/core/eventBus"
import { EVENTS } from "@/src/events/core/eventTypes"

// 👉 conexión con el motor
import { registerEngineContract } from "@/src/engine/core/runtime"

// 👉 (luego conectaremos semáforo aquí)

// =====================================================
// REGISTER HANDLER
// =====================================================

export function registerContractSignedHandler() {

  eventBus.on(EVENTS.CONTRACT_SIGNED, async (payload) => {

    //////////////////////////////////////////////////////
    // 📥 EVENT INPUT
    //////////////////////////////////////////////////////

    const { contractId } = payload

    console.log("🟢 CONTRACT SIGNED EVENT:", contractId)

    //////////////////////////////////////////////////////
    // 🧠 FETCH CONTRACT (DB SOURCE OF TRUTH)
    //////////////////////////////////////////////////////

    // ⚠️ IMPORTANTE:
    // no confiamos en el payload → vamos a DB

    const { prisma } = await import("@/src/database/prisma")

    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    })

    if (!contract) {
      console.warn("⚠️ Contract not found in handler:", contractId)
      return
    }

    //////////////////////////////////////////////////////
    // 🔗 REGISTER INTO ENGINE
    //////////////////////////////////////////////////////

    const engineContract = {
  id: contract.id,
  monthlyVolumeKg: contract.monthlyVolumeKg ?? 0,
  durationMonths: contract.durationMonths ?? 0,
  remainingMonths: contract.remainingMonths ?? 0,
  nextExecution: Date.now(),
  status: "active" as const
} as Parameters<typeof registerEngineContract>[0]

    //////////////////////////////////////////////////////
    // 🚦 (FUTURE) SEMAPHORE HOOK
    //////////////////////////////////////////////////////

    // aquí conectaremos:
    // - risk gating
    // - decision layer

    //////////////////////////////////////////////////////
    // DONE
    //////////////////////////////////////////////////////

    console.log("⚙️ Contract registered in engine:", contractId)

  })

}