import { CLIENT_PROFILES } from "./clientProfiles"
import { ClientProfile } from "./clientTypes"

export function getAllClients(): ClientProfile[] {

  return CLIENT_PROFILES
}

export function getClientById(id: string): ClientProfile | undefined {

  return CLIENT_PROFILES.find(c => c.id === id)
}