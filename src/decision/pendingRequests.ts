// =====================================================
// PENDING REQUEST MEMORY — ENHANCED
// Guarda solicitudes no resueltas para reevaluación.
// Diseñado para evolución determinista.
// =====================================================

export interface PendingRequest {

  id: string

  clientId: string

  requestedVolume: number
  suggestedVolume?: number

  region: string

  // producto / lote afectado
  lotId: string

  // prioridad comercial
  priority: number

  createdAt: number

  status: "waiting" | "recheck" | "resolved"

}

export interface PendingState {
  requests: PendingRequest[]
}

// =====================================================
// ADD REQUEST
// =====================================================

export function addPendingRequest(
  state: PendingState,
  req: PendingRequest
): PendingState {

  return {
    requests: [...state.requests, req]
  }

}

// =====================================================
// MARK RESOLVED
// =====================================================

export function resolveRequest(
  state: PendingState,
  id: string
): PendingState {

  return {
    requests: state.requests.map(r =>
      r.id === id
        ? { ...r, status: "resolved" }
        : r
    )
  }

}

// =====================================================
// RECHECK TRIGGER
// Se llama cuando cambia supply.
// =====================================================

export function markForRecheck(
  state: PendingState
): PendingState {

  return {
    requests: state.requests.map(r =>
      r.status === "waiting"
        ? { ...r, status: "recheck" }
        : r
    )
  }

}