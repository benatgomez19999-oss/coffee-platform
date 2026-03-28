export const BASE_PRODUCER_PRICING = {
 "80-83": {
  CASTILLO: 3.5,
  CATURRA: 3.75,
  COLOMBIA: 3.5,
  TYPICA: 3.75,
  BOURBON: 4,
  TABI: 3.75,
},

 "84-86": {
  CASTILLO: 4.5,
  CATURRA: 5,
  COLOMBIA: 4.5,
  TYPICA: 5.25,
  BOURBON: 5.5,
  PINK_BOURBON: 5.75,
  GEISHA: 6,
  TABI: 5.25,
},

  "87-90": {
  CASTILLO: 6,
  CATURRA: 6.5,
  COLOMBIA: 6,
  TYPICA: 7.25,
  BOURBON: 7.5,
  PINK_BOURBON: 7.75,
  GEISHA: 8,
  TABI: 7,
},
} as const

export const PRODUCER_ALTITUDE_MODIFIER = [
  { min: 0, max: 1400, value: -1 },
  { min: 1400, max: 1500, value: 0 },
  { min: 1500, max: 1600, value: 0.5 },
  { min: 1600, max: 1700, value: 1 },
  { min: 1700, max: 1800, value: 1.5 },
  { min: 1800, max: 1900, value: 2 },
  { min: 1900, max: 2000, value: 2.5 },
  { min: 2000, max: Infinity, value: 3 },
] as const