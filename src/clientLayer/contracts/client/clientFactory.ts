import { CLIENT_PROFILES } from "@/src/clientLayer/contracts/client/clientProfiles"
import { ClientProfile } from "@/src/clientLayer/contracts/client/clientTypes"

export function getAllClients(): ClientProfile[] {

  return CLIENT_PROFILES
}

export function getClientById(id: string): ClientProfile | undefined {

  return CLIENT_PROFILES.find(c => c.id === id)
}