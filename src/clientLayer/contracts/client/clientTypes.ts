export type ClientType =
  | "roaster"
  | "trader"
  | "retailer"
  | "industrial"

export interface ClientProfile {

  id: string

  name: string

  type: ClientType

  baseDemand: number

  demandVolatility: number

  urgencyBias: number

  negotiationTolerance: number

  priorityLevel: number

  preferredRegions: string[]
}

export interface ClientSession {

  clientId: string

  loggedIn: boolean
}