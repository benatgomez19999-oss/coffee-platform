// =====================================================
// EVENT BUS
//
// Sistema central de eventos del dominio
// =====================================================

import { EventEmitter } from "events"

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
// NOTE: handlers are registered server-side only.
// Import @/src/events/server/registerEventHandlers
// from the API routes that emit domain events.
// =====================================================

// =====================================================
// DEBUG 
// =====================================================