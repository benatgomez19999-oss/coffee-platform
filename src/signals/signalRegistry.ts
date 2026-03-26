// =====================================================
// GLOBAL SIGNAL REGISTRY — RUNTIME ASCENSOR
//
// Single source of shared decision signals.
//
// Este archivo actúa como puente vertical ("ascensor")
// entre el runtime interno y las capas superiores:
//
// Decision Pipeline
// Learning Layer
// Supervisory Systems
//
// No contiene estado propio.
// No usa globalThis.
// No crea señales nuevas.
//
// Solo expone las señales vivas del runtime.
//
// Principios:
// — Sin estado global implícito
// — Sin duplicación de ownership
// — Determinismo preservado
// — Acceso coherente por tick
// =====================================================

import { getEngineSignals } from "@/engine/core/runtime"

// =====================================================
// SIGNAL ACCESS — LIVE RUNTIME REFERENCE
//
// Devuelve la referencia interna del runtime.
// No copia.
// No muta.
// Solo expone el contenedor oficial.
//
// El runtime sigue siendo la única fuente de verdad.
// =====================================================

export function getSignals() {
  return getEngineSignals()
}