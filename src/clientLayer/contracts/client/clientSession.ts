import { ClientSession } from "./clientTypes"

const STORAGE_KEY = "clientSession"

// ======================================================
// LOGIN
// ======================================================

export function loginClient(clientId: string) {

  const session: ClientSession = {
    clientId,
    loggedIn: true
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(session)
  )
}

// ======================================================
// LOGOUT
// ======================================================

export function logoutClient() {

  localStorage.removeItem(STORAGE_KEY)
}

// ======================================================
// GET SESSION
// ======================================================

export function getClientSession(): ClientSession | null {

  if (typeof window === "undefined") return null

  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }

}