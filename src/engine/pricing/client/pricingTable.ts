//////////////////////////////////////////////////////
// 💰 PRICING TABLE (SOURCE OF TRUTH)
//////////////////////////////////////////////////////

export const BASE_PRICING = {
  "80-83": {
    CASTILLO: 22,
    CATURRA: 24,
    COLOMBIA: 22,
    TYPICA: 26,
    BOURBON: 26,
    TABI: 26,
  },
  "84-86": {
    CASTILLO: 28,
    CATURRA: 30,
    COLOMBIA: 28,
    TYPICA: 32,
    BOURBON: 34,
    PINK_BOURBON: 40,
    GEISHA: 55,
    TABI: 32,
  },
  "86-90": {
    CASTILLO: 38,
    CATURRA: 40,
    COLOMBIA: 38,
    TYPICA: 45,
    BOURBON: 48,
    PINK_BOURBON: 55,
    GEISHA: 95,
    TABI: 45,
  },
} as const

export const ALTITUDE_MODIFIER = [
  { min: 0, max: 1400, value: -2 },
  { min: 1400, max: 1600, value: 0 },
  { min: 1600, max: 1800, value: 2 },
  { min: 1800, max: 2000, value: 4 },
  { min: 2000, max: Infinity, value: 6 },
]