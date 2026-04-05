import { ClientProfile } from "@/src/clientLayer/contracts/client/clientTypes"

export const CLIENT_PROFILES: ClientProfile[] = [

  {
    id: "roaster_1",
    name: "Barcelona Specialty Roasters",
    type: "roaster",

    baseDemand: 1200,
    demandVolatility: 0.3,
    urgencyBias: 0.2,
    negotiationTolerance: 0.9,

    priorityLevel: 3,

    preferredRegions: ["brazil", "colombia"]
  },

  {
    id: "retailer_1",
    name: "European Coffee Retail Group",
    type: "retailer",

    baseDemand: 5000,
    demandVolatility: 0.5,
    urgencyBias: 0.4,
    negotiationTolerance: 0.6,

    priorityLevel: 5,

    preferredRegions: ["brazil"]
  },

  {
    id: "trader_1",
    name: "Global Coffee Trading Desk",
    type: "trader",

    baseDemand: 8000,
    demandVolatility: 0.8,
    urgencyBias: 0.7,
    negotiationTolerance: 0.3,

    priorityLevel: 2,

    preferredRegions: ["vietnam", "brazil"]
  }

]