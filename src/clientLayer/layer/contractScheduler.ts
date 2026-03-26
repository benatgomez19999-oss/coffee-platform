// =====================================================
// IMPORT ENGINE RUNTIME
// =====================================================

import { submitOperationalRequest } from "@/engine/core/runtime"

// =====================================================
// IMPORT EVENTS 
// =====================================================

import { eventBus } from "@/events/eventBus"
import { EVENTS } from "@/events/eventTypes"

// =====================================================
// DEMO TIME SCALE
// =====================================================
// 30s representa 1 mes dentro del engine
// =====================================================

const MONTH_MS = 30000 // demo: 30s = 1 month

// =====================================================
// CONTRACT EXECUTION STEP
// =====================================================
// Este step se ejecuta en cada tick del engine.
// Se encarga de revisar contratos activos y generar
// solicitudes operacionales cuando corresponde.
// =====================================================

export function stepContracts(state: any) {

  const now = state.engineTime

  state.contracts.forEach((c: any) => {

    // =====================================================
    // ONLY EXECUTE ACTIVE CONTRACTS
    // =====================================================

    if (c.status !== "active") return

    // =====================================================
    // STOP CONTRACT IF FINISHED
    // =====================================================

    if (c.remainingMonths <= 0) return

// =====================================================
// EXECUTION TIME CHECK
// =====================================================

if (now >= c.nextExecution) {

  console.log(
    "Scheduler executing contract:",
    c.id,
    c.monthlyVolumeKg
  )

  // =====================================================
  // GENERATE OPERATIONAL REQUEST
  // =====================================================

  submitOperationalRequest(
    c.monthlyVolumeKg,
    "contract"
  )

  // =====================================================
  // EMIT CONTRACT EVENT
  // =====================================================

  eventBus.emit(EVENTS.CONTRACT_SYNC, {
    contractId: c.id,
    volumeKg: c.monthlyVolumeKg,
    executionTime: now
  })

  // =====================================================
  // UPDATE CONTRACT STATE
  // =====================================================

  c.remainingMonths--

  // =====================================================
  // SCHEDULE NEXT EXECUTION
  // =====================================================

  c.nextExecution = now + MONTH_MS

}

// =====================================================
// END CONTRACT LOOP
// =====================================================

  })

}