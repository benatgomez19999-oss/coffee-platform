//////////////////////////////////////////////////////
// 🌱 ORIGIN COST ENGINE
//////////////////////////////////////////////////////

type OriginInput = {
  region: string
  port: string
}

export function calculateOriginCosts({ region, port }: OriginInput) {
  // puedes conectar esto luego con costTables reales
  const inlandTransport = 0.1
  const portCosts = 0.15

  return {
    total: inlandTransport + portCosts,
    breakdown: {
      inlandTransport,
      portCosts,
    },
  }
}