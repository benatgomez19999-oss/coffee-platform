// =====================================================
// REGISTER EVENT HANDLERS — SERVER ONLY
//
// Este archivo registra todos los event handlers del dominio.
// Solo debe importarse desde API routes (server-side).
//
// NUNCA importar desde componentes cliente.
// =====================================================

if (typeof window !== "undefined") {
  throw new Error("[SERVER ONLY] registerEventHandlers cannot be imported in client code")
}

import { registerLotVerifiedHandler } from "@/src/events/handlers/lotVerified.handler"
import { registerRoastBatchHandler } from "@/src/events/handlers/roastBatch.handler"
import { registerSampleDeliveredHandler } from "@/src/events/handlers/sampleDelivered.handler"

// =====================================================
// IDEMPOTENT GUARD — evita doble registro en dev
// =====================================================

const g = globalThis as typeof globalThis & { __handlersRegistered?: boolean }

if (!g.__handlersRegistered) {
  g.__handlersRegistered = true

  registerLotVerifiedHandler()
  registerRoastBatchHandler()
  registerSampleDeliveredHandler()
}
