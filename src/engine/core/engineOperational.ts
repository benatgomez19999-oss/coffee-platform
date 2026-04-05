// =====================================================
// OPERATIONAL LAYER
// Decision + memory evaluation
//
// Evalúa solicitudes comerciales pendientes.
// NO modifica física.
// Solo ejecuta allocaciones cuando procede.
// =====================================================

import type { EngineState } from "@/src/engine/core/runtime"
import { allocateFromRegion } from "@/src/engine/core/runtime"

export function stepOperationalLayer(
  state: EngineState
) {

  if (!state.pending?.requests?.length) return

  const now = state.engineTime

  // =====================================================
  // LOOP SOBRE SOLICITUDES ACTIVAS
  // =====================================================

  state.pending.requests = state.pending.requests.filter(request => {

    const {
      remainingVolume,
      autoExecute
    } = request

    // =====================================================
    // 1. CIERRE DE OFERTA EXPIRADA
    // =====================================================

    if (
      request.offerOpen &&
      request.offerExpiry &&
      now > request.offerExpiry
    ) {
      request.offerOpen = false
      request.offerExpiry = null
    }

    // =====================================================
    // 2. EVALUACIÓN DE VIABILIDAD MULTI-REGIÓN
    // =====================================================

    const totalAvailable = state.regions.reduce(
      (sum, r) => sum + r.availableKg,
      0
    )

    const isFullyViable =
      totalAvailable >= remainingVolume

    const isPartiallyViable =
      totalAvailable > 0 &&
      totalAvailable < remainingVolume

    // =====================================================
// 3. AUTOEXECUTE
// SOLO PERMITIDO PARA CONTRATOS
// =====================================================

if (
  autoExecute &&
  isFullyViable &&
  request.source === "contract"
) {

  allocateFromRegion(remainingVolume)

  return false
}


// =====================================================
// 4. TOTALMENTE VIABLE
// =====================================================

if (isFullyViable) {

  const zones = state.liveDecision?.decisionZones

  const greenLimit =
    zones?.greenLimit ?? remainingVolume

  const yellowLimit =
    zones?.yellowLimit ?? remainingVolume


  // ---------------------------------------------------
  // GREEN ZONE
  // ---------------------------------------------------

  if (remainingVolume <= greenLimit) {

    // SOLO CONTRATOS EJECUTAN AUTOMÁTICAMENTE

    if (request.source === "contract") {

      allocateFromRegion(remainingVolume)

      return false

    }

    // requests manuales esperan wizard

    return true

    }
  

      // ---------------------------------------------------
      // YELLOW ZONE → contraoferta
      // ---------------------------------------------------

      if (remainingVolume <= yellowLimit) {

        request.suggestedVolume = greenLimit

        if (!request.offerOpen) {

          request.offerOpen = true
          request.offerExpiry = now + 15000

        }

        return true
      }

      // ---------------------------------------------------
      // RED ZONE → rechazo pero contraoferta segura
      // ---------------------------------------------------

      request.suggestedVolume = greenLimit

      if (!request.offerOpen) {

        request.offerOpen = true
        request.offerExpiry = now + 15000

      }

      return true
    }

    // =====================================================
    // 5. PARCIALMENTE VIABLE
    // =====================================================

    if (isPartiallyViable) {

      request.suggestedVolume = totalAvailable

      if (!request.offerOpen) {

        request.offerOpen = true
        request.offerExpiry = now + 15000

      }

      return true
    }

    // =====================================================
    // 6. NO VIABLE
    // =====================================================

    request.suggestedVolume = undefined

    return true

  })

}