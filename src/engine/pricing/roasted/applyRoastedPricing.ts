//////////////////////////////////////////////////////
// 🔥 ROASTED VALUE LAYER (CALIBRATED REAL DATA)
//////////////////////////////////////////////////////

type RoastedInput = {
  basePrice: number
  variety: string
  scaScore: number
  altitude: number
}

export function applyRoastedPricing({
  basePrice,
  variety,
  scaScore,
  altitude,
}: RoastedInput) {

//////////////////////////////////////////////////////
// 🔥 BASE ROASTING COST (SIEMPRE)
//////////////////////////////////////////////////////

let factor = 1.35 // mínimo realista mercado


  //////////////////////////////////////////////////////
  // 🌸 VARIETY BASE
  //////////////////////////////////////////////////////

  const varietyBase: Record<string, number> = {
    CASTILLO: 1,
    CATURRA: 1.05,
    COLOMBIA: 1,
    TYPICA: 1.15,
    BOURBON: 1.2,
    PINK_BOURBON: 1.4,
    GEISHA: 1.8, 
    TABI: 1.15,
  }

  factor *= varietyBase[variety] || 1

  //////////////////////////////////////////////////////
  // ⭐ SCA IMPACT
  //////////////////////////////////////////////////////

  if (scaScore >= 84) factor += 0.2
  if (scaScore >= 86) factor += 0.3
  if (scaScore >= 88) factor += 0.4
  if (scaScore >= 90) factor += 0.5

  //////////////////////////////////////////////////////
  // ⛰ ALTITUDE PREMIUM
  //////////////////////////////////////////////////////

  if (altitude >= 1600) factor += 0.2
  if (altitude >= 1800) factor += 0.3
  if (altitude >= 2000) factor += 0.5

  //////////////////////////////////////////////////////
  // 🔥 GEISHA BOOST (clave de tus datos)
  //////////////////////////////////////////////////////

  if (variety === "GEISHA") {
    if (scaScore >= 88 && altitude >= 1800) {
      factor += 0.8 // elite
    } else if (scaScore >= 86) {
      factor += 0.5
    }
  }

  //////////////////////////////////////////////////////
  // 💎 ELITE SEGMENT (muy importante)
  //////////////////////////////////////////////////////

  if (scaScore >= 88 && altitude >= 1900) {
    factor += 0.5
  }

  //////////////////////////////////////////////////////
  // 🔢 FINAL
  //////////////////////////////////////////////////////

  const roastedPrice = basePrice * factor

  return {
    roastedPrice: Number(roastedPrice.toFixed(2)),
    multiplier: Number(factor.toFixed(2)),
  }
}