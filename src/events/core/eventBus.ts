// =====================================================
// EVENT BUS
//
// Sistema central de eventos del dominio
// =====================================================

import { EventEmitter } from "events"

// =====================================================
// HANDLERS REGISTRATION
// Cada handler se conecta aquí una sola vez
// =====================================================

import { registerLotVerifiedHandler } from "../handlers/lotVerified.handler"
import { registerRoastBatchHandler } from "../handlers/roastBatch.handler"

// =====================================================
// GLOBAL EVENT BUS (SINGLETON)
// =====================================================

export const eventBus = new EventEmitter()

// =====================================================
// SAFETY — LISTENER LIMIT
// Evita warnings en desarrollo
// =====================================================

eventBus.setMaxListeners(20)

// =====================================================
// REGISTER HANDLERS
// Punto de conexión del sistema reactivo
// =====================================================

registerLotVerifiedHandler()
registerRoastBatchHandler()

// =====================================================
// DEBUG 
// =====================================================