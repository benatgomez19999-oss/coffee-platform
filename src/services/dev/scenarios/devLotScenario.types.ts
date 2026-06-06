//////////////////////////////////////////////////////
// 🧪 DEV LOT SCENARIO TYPES + RECIPES
//
// Pure data + light helpers. No Prisma, no DB calls.
// Imported by both the service and the API routes
// (for input validation) and is unit-testable on its own.
//
// Important rule: recipes describe lot SHAPES, not
// allocation outcomes. They must NOT pre-decide whether
// a lot ends up in marketplace, contract catalog, etc.
// The allocation engine decides that downstream.
//////////////////////////////////////////////////////

export type DevLotScenarioKind =
  | "allocation_engine_decides"
  | "marketplace_mix"
  | "contract_catalog_mix"
  | "exclusive_microlots"
  | "large_split_lots"
  | "logistics_ready"
  | "stress_25_lots"

export type DevLotScenarioTargetStage =
  | "published"
  | "destination_received"

export type DevFarmKey =
  | "huila"
  | "narino"
  | "antioquia"
  | "tolima"
  | "cauca"

export type DevProcess = "WASHED" | "NATURAL" | "HONEY" | "ANAEROBIC"

// ------------------------------------------------------
// RECIPE
//
// IMPORTANT: recipes describe the PHYSICAL + QUALITY shape
// of a lot only — variety, process, volume, SCA, yield.
// They MUST NOT carry a pricePerKg field. Pricing is the
// sole responsibility of the producer pricing engine
// (src/engine/pricing/producer/calculatePricing.ts), called
// from the seed service so dev rows match what real lot
// verification produces.
// ------------------------------------------------------

export type DevLotRecipe = {
  farmKey: DevFarmKey
  variety: string
  process: DevProcess
  harvestYear: number

  // Volume (green kg). totalKg = availableKg = greenKg in dev.
  greenKg: number

  // Pre-conversion volume (parchment). Computed from greenKg / conversionRate.
  parchmentKg: number
  conversionRate: number

  scaScore: number
  estimatedRoastYield: number

  // Optional human-friendly label. null lets the marketplace
  // mapper build a composite name (`${farm} ${variety} ${process}`).
  name?: string | null
}

// ------------------------------------------------------
// VALIDATION HELPERS
// ------------------------------------------------------

export const SCENARIO_KINDS: ReadonlyArray<DevLotScenarioKind> = [
  "allocation_engine_decides",
  "marketplace_mix",
  "contract_catalog_mix",
  "exclusive_microlots",
  "large_split_lots",
  "logistics_ready",
  "stress_25_lots",
]

export const TARGET_STAGES: ReadonlyArray<DevLotScenarioTargetStage> = [
  "published",
  "destination_received",
]

export function isDevScenarioKind(value: unknown): value is DevLotScenarioKind {
  return typeof value === "string" && SCENARIO_KINDS.includes(value as DevLotScenarioKind)
}

export function isDevTargetStage(value: unknown): value is DevLotScenarioTargetStage {
  return typeof value === "string" && TARGET_STAGES.includes(value as DevLotScenarioTargetStage)
}

// ------------------------------------------------------
// SCENARIO LIMITS
//
// Per-scenario default and maximum lot counts. Stress
// goes up to 25; allocation_engine_decides defaults to
// 10 boundary lots; everything else caps at 8.
// ------------------------------------------------------

type ScenarioLimit = { default: number; max: number }

export const SCENARIO_LIMITS: Record<DevLotScenarioKind, ScenarioLimit> = {
  allocation_engine_decides: { default: 10, max: 10 },
  marketplace_mix:           { default: 8,  max: 8  },
  contract_catalog_mix:      { default: 8,  max: 8  },
  exclusive_microlots:       { default: 8,  max: 8  },
  large_split_lots:          { default: 8,  max: 8  },
  logistics_ready:           { default: 8,  max: 8  },
  stress_25_lots:            { default: 25, max: 25 },
}

export function clampCount(scenario: DevLotScenarioKind, requested?: number): number {
  const { default: def, max } = SCENARIO_LIMITS[scenario]
  if (typeof requested !== "number" || !Number.isFinite(requested)) return def
  const floor = Math.max(1, Math.floor(requested))
  return Math.min(floor, max)
}

// ------------------------------------------------------
// DEFAULT YIELDS (mirrors src/lib/roastYield.ts so
// recipes line up with what the engine will resolve).
// ------------------------------------------------------

const DEFAULT_YIELDS: Record<DevProcess, number> = {
  WASHED: 0.85,
  NATURAL: 0.82,
  HONEY: 0.84,
  ANAEROBIC: 0.82,
}

// ------------------------------------------------------
// PRICING ENGINE COMPATIBILITY
//
// The producer pricing engine
// (src/engine/pricing/producer/pricingTable.ts) only accepts
// a fixed set of varieties and an SCA window of 80–90+. We
// validate every recipe against these constraints so a
// developer cannot accidentally seed an unprice-able lot.
// ------------------------------------------------------

export const PRICING_ENGINE_VARIETIES = [
  "CASTILLO",
  "CATURRA",
  "COLOMBIA",
  "TYPICA",
  "BOURBON",
  "PINK_BOURBON",
  "GEISHA",
  "TABI",
] as const

export type PricingEngineVariety = (typeof PRICING_ENGINE_VARIETIES)[number]

// ------------------------------------------------------
// RECIPE BUILDER
// ------------------------------------------------------

function r(opts: {
  farmKey: DevFarmKey
  variety: string
  process: DevProcess
  greenKg: number
  scaScore: number
  harvestYear?: number
  conversionRate?: number
  estimatedRoastYield?: number
  name?: string
}): DevLotRecipe {
  const conversionRate = opts.conversionRate ?? 0.8
  const parchmentKg = Math.round(opts.greenKg / conversionRate)
  const harvestYear = opts.harvestYear ?? 2026
  const estimatedRoastYield = opts.estimatedRoastYield ?? DEFAULT_YIELDS[opts.process]

  return {
    farmKey: opts.farmKey,
    variety: opts.variety,
    process: opts.process,
    harvestYear,
    greenKg: opts.greenKg,
    parchmentKg,
    conversionRate,
    scaScore: opts.scaScore,
    estimatedRoastYield,
    name: opts.name ?? null,
  }
}

// ------------------------------------------------------
// RECIPE PRESETS
// ------------------------------------------------------

const RECIPES_ALLOCATION_ENGINE_DECIDES: DevLotRecipe[] = [
  // Boundary cases — let the engine decide.
  r({ farmKey: "huila",     variety: "Castillo",      process: "WASHED",  greenKg: 1450,  scaScore: 83 }), // borderline floor
  r({ farmKey: "tolima",    variety: "Caturra",       process: "WASHED",  greenKg: 1550,  scaScore: 84 }), // just above
  r({ farmKey: "cauca",     variety: "Bourbon",       process: "WASHED",  greenKg: 2500,  scaScore: 85 }), // medium specialty
  r({ farmKey: "antioquia", variety: "Pink Bourbon",  process: "WASHED",  greenKg: 1800,  scaScore: 87 }), // premium not tiny
  r({ farmKey: "narino",    variety: "Geisha",        process: "WASHED",  greenKg: 1200,  scaScore: 88 }), // rare mid-volume
  r({ farmKey: "narino",    variety: "Geisha",        process: "WASHED",  greenKg:  350,  scaScore: 91 }), // true exclusive
  r({ farmKey: "antioquia", variety: "Colombia",      process: "WASHED",  greenKg: 7000,  scaScore: 84 }), // large contract candidate
  r({ farmKey: "antioquia", variety: "Castillo",      process: "WASHED",  greenKg: 28000, scaScore: 83 }), // huge possible split
  r({ farmKey: "tolima",    variety: "Castillo",      process: "WASHED",  greenKg: 4000,  scaScore: 81 }), // low SCA usable
  r({ farmKey: "huila",     variety: "Bourbon",       process: "NATURAL", greenKg:  900,  scaScore: 86 }), // high-altitude natural
]

const RECIPES_MARKETPLACE_MIX: DevLotRecipe[] = [
  r({ farmKey: "huila",     variety: "Caturra",       process: "WASHED",  greenKg: 300, scaScore: 85 }),
  r({ farmKey: "antioquia", variety: "Pink Bourbon",  process: "WASHED",  greenKg: 450, scaScore: 87 }),
  r({ farmKey: "cauca",     variety: "Bourbon",       process: "NATURAL", greenKg: 600, scaScore: 86 }),
  r({ farmKey: "tolima",    variety: "Castillo",      process: "WASHED",  greenKg: 900, scaScore: 82 }),
  r({ farmKey: "narino",    variety: "Bourbon",       process: "WASHED",  greenKg: 250, scaScore: 88 }),
  r({ farmKey: "huila",     variety: "Caturra",       process: "WASHED",  greenKg: 700, scaScore: 84 }),
  r({ farmKey: "narino",    variety: "Geisha",        process: "WASHED",  greenKg: 400, scaScore: 89 }),
  r({ farmKey: "cauca",     variety: "Tabi",          process: "HONEY",   greenKg: 500, scaScore: 86 }),
]

const RECIPES_CONTRACT_CATALOG_MIX: DevLotRecipe[] = [
  r({ farmKey: "antioquia", variety: "Caturra",  process: "WASHED", greenKg:  5000, scaScore: 84 }),
  r({ farmKey: "antioquia", variety: "Castillo", process: "WASHED", greenKg:  8000, scaScore: 83 }),
  r({ farmKey: "antioquia", variety: "Colombia", process: "WASHED", greenKg: 12000, scaScore: 84 }),
  r({ farmKey: "cauca",     variety: "Tabi",     process: "WASHED", greenKg: 18000, scaScore: 85 }),
  r({ farmKey: "tolima",    variety: "Bourbon",  process: "WASHED", greenKg:  6000, scaScore: 84 }),
  r({ farmKey: "antioquia", variety: "Castillo", process: "WASHED", greenKg: 10000, scaScore: 83 }),
  r({ farmKey: "tolima",    variety: "Caturra",  process: "WASHED", greenKg: 15000, scaScore: 84 }),
  r({ farmKey: "antioquia", variety: "Colombia", process: "WASHED", greenKg: 20000, scaScore: 84 }),
]

// NOTE: Wush Wush / Sudan Rume are not in the producer pricing table
// (src/engine/pricing/producer/pricingTable.ts), so seeding them would
// throw at calculateProducerPricing time. The exclusive route is still
// covered by Geisha + Pink Bourbon (rare-variety branch) and by the
// high-SCA + microlot-volume branch on Bourbon/Typica.
const RECIPES_EXCLUSIVE_MICROLOTS: DevLotRecipe[] = [
  r({ farmKey: "narino",    variety: "Geisha",        process: "WASHED",    greenKg: 250, scaScore: 91 }),
  r({ farmKey: "antioquia", variety: "Pink Bourbon",  process: "WASHED",    greenKg: 400, scaScore: 90 }),
  r({ farmKey: "cauca",     variety: "Typica",        process: "WASHED",    greenKg: 300, scaScore: 89 }),
  r({ farmKey: "narino",    variety: "Bourbon",       process: "WASHED",    greenKg: 350, scaScore: 90 }),
  r({ farmKey: "narino",    variety: "Geisha",        process: "NATURAL",   greenKg: 200, scaScore: 92 }),
  r({ farmKey: "antioquia", variety: "Pink Bourbon",  process: "HONEY",     greenKg: 280, scaScore: 89 }),
  r({ farmKey: "cauca",     variety: "Typica",        process: "ANAEROBIC", greenKg: 320, scaScore: 90 }),
  r({ farmKey: "narino",    variety: "Bourbon",       process: "WASHED",    greenKg: 380, scaScore: 91 }),
]

const RECIPES_LARGE_SPLIT_LOTS: DevLotRecipe[] = [
  r({ farmKey: "antioquia", variety: "Castillo", process: "WASHED", greenKg: 30000, scaScore: 83 }),
  r({ farmKey: "antioquia", variety: "Colombia", process: "WASHED", greenKg: 25000, scaScore: 84 }),
  r({ farmKey: "tolima",    variety: "Caturra",  process: "WASHED", greenKg: 22000, scaScore: 84 }),
  r({ farmKey: "antioquia", variety: "Castillo", process: "WASHED", greenKg: 35000, scaScore: 82 }),
  r({ farmKey: "antioquia", variety: "Caturra",  process: "WASHED", greenKg: 27000, scaScore: 84 }),
  r({ farmKey: "antioquia", variety: "Colombia", process: "WASHED", greenKg: 24000, scaScore: 83 }),
  r({ farmKey: "antioquia", variety: "Castillo", process: "WASHED", greenKg: 31000, scaScore: 84 }),
  r({ farmKey: "antioquia", variety: "Bourbon",  process: "WASHED", greenKg: 26000, scaScore: 84 }),
]

const RECIPES_LOGISTICS_READY: DevLotRecipe[] = [
  r({ farmKey: "huila",     variety: "Caturra",  process: "WASHED",  greenKg: 1500, scaScore: 84 }),
  r({ farmKey: "cauca",     variety: "Bourbon",  process: "NATURAL", greenKg: 1200, scaScore: 85 }),
  r({ farmKey: "cauca",     variety: "Tabi",     process: "HONEY",   greenKg:  800, scaScore: 86 }),
  r({ farmKey: "huila",     variety: "Caturra",  process: "WASHED",  greenKg: 1800, scaScore: 85 }),
  r({ farmKey: "cauca",     variety: "Bourbon",  process: "NATURAL", greenKg: 1100, scaScore: 86 }),
  r({ farmKey: "cauca",     variety: "Tabi",     process: "HONEY",   greenKg:  950, scaScore: 85 }),
  r({ farmKey: "tolima",    variety: "Castillo", process: "WASHED",  greenKg: 1400, scaScore: 84 }),
  r({ farmKey: "huila",     variety: "Caturra",  process: "NATURAL", greenKg: 1700, scaScore: 85 }),
]

const RECIPES_STRESS: DevLotRecipe[] = [
  // 5 small marketplace
  r({ farmKey: "huila",     variety: "Caturra",       process: "WASHED",  greenKg: 280, scaScore: 84 }),
  r({ farmKey: "narino",    variety: "Bourbon",       process: "NATURAL", greenKg: 350, scaScore: 86 }),
  r({ farmKey: "tolima",    variety: "Castillo",      process: "WASHED",  greenKg: 500, scaScore: 82 }),
  r({ farmKey: "cauca",     variety: "Tabi",          process: "HONEY",   greenKg: 620, scaScore: 86 }),
  r({ farmKey: "huila",     variety: "Caturra",       process: "WASHED",  greenKg: 800, scaScore: 85 }),
  // 5 contract candidates
  r({ farmKey: "antioquia", variety: "Castillo",      process: "WASHED",  greenKg:  4500, scaScore: 83 }),
  r({ farmKey: "antioquia", variety: "Caturra",       process: "WASHED",  greenKg:  6000, scaScore: 84 }),
  r({ farmKey: "tolima",    variety: "Colombia",      process: "WASHED",  greenKg:  9000, scaScore: 84 }),
  r({ farmKey: "antioquia", variety: "Tabi",          process: "WASHED",  greenKg: 11000, scaScore: 85 }),
  r({ farmKey: "antioquia", variety: "Bourbon",       process: "WASHED",  greenKg: 14000, scaScore: 84 }),
  // 4 exclusive microlots — varieties restricted to those the
  // producer pricing table supports (Geisha, Pink Bourbon, Bourbon, Typica).
  r({ farmKey: "narino",    variety: "Geisha",        process: "WASHED",    greenKg: 220, scaScore: 91 }),
  r({ farmKey: "antioquia", variety: "Pink Bourbon",  process: "WASHED",    greenKg: 360, scaScore: 90 }),
  r({ farmKey: "cauca",     variety: "Typica",        process: "ANAEROBIC", greenKg: 280, scaScore: 90 }),
  r({ farmKey: "narino",    variety: "Bourbon",       process: "NATURAL",   greenKg: 320, scaScore: 90 }),
  // 4 huge split candidates
  r({ farmKey: "antioquia", variety: "Castillo",      process: "WASHED",  greenKg: 32000, scaScore: 83 }),
  r({ farmKey: "antioquia", variety: "Colombia",      process: "WASHED",  greenKg: 26000, scaScore: 84 }),
  r({ farmKey: "antioquia", variety: "Caturra",       process: "WASHED",  greenKg: 24000, scaScore: 84 }),
  r({ farmKey: "antioquia", variety: "Castillo",      process: "WASHED",  greenKg: 29000, scaScore: 82 }),
  // 7 mid-size mixed
  r({ farmKey: "tolima",    variety: "Caturra",       process: "WASHED",  greenKg: 1700, scaScore: 84 }),
  r({ farmKey: "huila",     variety: "Bourbon",       process: "NATURAL", greenKg: 1300, scaScore: 86 }),
  r({ farmKey: "cauca",     variety: "Bourbon",       process: "WASHED",  greenKg: 2200, scaScore: 85 }),
  r({ farmKey: "antioquia", variety: "Pink Bourbon",  process: "WASHED",  greenKg: 1900, scaScore: 87 }),
  r({ farmKey: "tolima",    variety: "Castillo",      process: "WASHED",  greenKg: 3500, scaScore: 83 }),
  r({ farmKey: "huila",     variety: "Caturra",       process: "HONEY",   greenKg: 2700, scaScore: 85 }),
  r({ farmKey: "narino",    variety: "Geisha",        process: "WASHED",  greenKg: 1100, scaScore: 88 }),
]

// ------------------------------------------------------
// PUBLIC: pick recipes
// ------------------------------------------------------

const PRESETS: Record<DevLotScenarioKind, ReadonlyArray<DevLotRecipe>> = {
  allocation_engine_decides: RECIPES_ALLOCATION_ENGINE_DECIDES,
  marketplace_mix:           RECIPES_MARKETPLACE_MIX,
  contract_catalog_mix:      RECIPES_CONTRACT_CATALOG_MIX,
  exclusive_microlots:       RECIPES_EXCLUSIVE_MICROLOTS,
  large_split_lots:          RECIPES_LARGE_SPLIT_LOTS,
  logistics_ready:           RECIPES_LOGISTICS_READY,
  stress_25_lots:            RECIPES_STRESS,
}

export function pickRecipes(
  scenario: DevLotScenarioKind,
  count?: number
): DevLotRecipe[] {
  const all = PRESETS[scenario]
  const limit = clampCount(scenario, count)
  return all.slice(0, Math.min(limit, all.length))
}

export function getRecipePreset(scenario: DevLotScenarioKind): ReadonlyArray<DevLotRecipe> {
  return PRESETS[scenario]
}

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

export const DEV_SCENARIO_PREFIX = "DEV-SCENARIO"
export const DEV_SHIPMENT_PREFIX = "DEV-SCENARIO-SHIP"
export const DEV_FARM_PREFIX = "[DEV]"
export const DEV_PRODUCER_USER_EMAIL = "producer.dev@alturacollective.test"
export const DEV_PRICING_VERSION = "dev-scenario-v1"

export type DevFarmRecipe = {
  key: DevFarmKey
  name: string
  region: string
  altitude: number
}

// ------------------------------------------------------
// VARIETY NORMALISATION FOR THE PRICING ENGINE
//
// The producer pricing engine's literal type is
// "CASTILLO" | "CATURRA" | … (all uppercase, underscored).
// Recipes can carry strings like "Pink Bourbon" or
// "pink-bourbon" — we normalise to the engine's enum.
// ------------------------------------------------------

export function toPricingEngineVariety(raw: string): PricingEngineVariety {
  const normalized = (raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, "_")
  if (
    PRICING_ENGINE_VARIETIES.includes(
      normalized as PricingEngineVariety
    )
  ) {
    return normalized as PricingEngineVariety
  }
  throw new Error(
    `Variety "${raw}" is not supported by the producer pricing engine. ` +
      `Supported: ${PRICING_ENGINE_VARIETIES.join(", ")}`
  )
}

export const DEV_FARM_RECIPES: ReadonlyArray<DevFarmRecipe> = [
  { key: "huila",     name: "[DEV] Huila High Altitude Farm",  region: "Huila",     altitude: 1850 },
  { key: "narino",    name: "[DEV] Nariño Micro Farm",         region: "Nariño",    altitude: 2050 },
  { key: "antioquia", name: "[DEV] Antioquia Volume Farm",     region: "Antioquia", altitude: 1650 },
  { key: "tolima",    name: "[DEV] Tolima Washed Farm",        region: "Tolima",    altitude: 1750 },
  { key: "cauca",     name: "[DEV] Cauca Experimental Farm",   region: "Cauca",     altitude: 1900 },
]

// ------------------------------------------------------
// SEEDED PRNG (xfnv1a hash + mulberry32 generator)
//
// No deps, no Math.random, no globals. Identical seed
// string → identical sequence forever. Used by the jitter
// helpers below so jittered scenarios stay reproducible
// across reseeds.
// ------------------------------------------------------

export function hashSeedToUint32(seed: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createSeededRng(seed: string): () => number {
  let a = hashSeedToUint32(seed)
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ------------------------------------------------------
// JITTER MODE
//
// Allows reproducible per-seed variation of dev recipes
// for marketplace/pricing exploration. The allocation
// regression boundary set (allocation_engine_decides) is
// excluded by design — keep it as a fixed regression
// fixture so the engine output stays comparable over time.
// ------------------------------------------------------

export type DevLotVariationMode = "deterministic" | "jittered"

const JITTERABLE_SCENARIOS: ReadonlySet<DevLotScenarioKind> = new Set<DevLotScenarioKind>([
  "marketplace_mix",
  "contract_catalog_mix",
  "exclusive_microlots",
  "large_split_lots",
  "logistics_ready",
  "stress_25_lots",
])

export function isScenarioJitterable(scenario: DevLotScenarioKind): boolean {
  return JITTERABLE_SCENARIOS.has(scenario)
}

const ALL_DEV_FARM_KEYS: ReadonlyArray<DevFarmKey> = [
  "huila",
  "narino",
  "antioquia",
  "tolima",
  "cauca",
]

const JITTER_FARM_GROUPS: Record<DevLotScenarioKind, ReadonlyArray<DevFarmKey>> = {
  allocation_engine_decides: [],
  marketplace_mix:           ALL_DEV_FARM_KEYS,
  contract_catalog_mix:      ALL_DEV_FARM_KEYS,
  exclusive_microlots:       ["narino", "cauca", "huila", "antioquia"],
  large_split_lots:          ALL_DEV_FARM_KEYS,
  logistics_ready:           ALL_DEV_FARM_KEYS,
  stress_25_lots:            ALL_DEV_FARM_KEYS,
}

export const SCA_JITTER_FLOOR = 80
export const SCA_JITTER_CEILING = 92
export const RARE_VARIETY_SCA_FLOOR = 84
export const GREEN_KG_JITTER_MIN = 50
export const GREEN_KG_JITTER_MULT_MIN = 0.8
export const GREEN_KG_JITTER_MULT_MAX = 1.2
export const SEED_MAX_LENGTH = 120

function pickFromArray<T>(rng: () => number, arr: ReadonlyArray<T>): T {
  const idx = Math.min(arr.length - 1, Math.floor(rng() * arr.length))
  return arr[idx]
}

function jitterSca(rng: () => number, base: number, variety: string): number {
  // Offset ∈ {-1, 0, +1}, integer.
  const offset = Math.floor(rng() * 3) - 1
  let next = Math.round(base) + offset
  if (next < SCA_JITTER_FLOOR) next = SCA_JITTER_FLOOR
  if (next > SCA_JITTER_CEILING) next = SCA_JITTER_CEILING
  const normalised = (variety ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, "_")
  if (normalised === "GEISHA" || normalised === "PINK_BOURBON") {
    if (next < RARE_VARIETY_SCA_FLOOR) next = RARE_VARIETY_SCA_FLOOR
  }
  return next
}

function jitterGreenKg(rng: () => number, base: number): number {
  const span = GREEN_KG_JITTER_MULT_MAX - GREEN_KG_JITTER_MULT_MIN
  const multiplier = GREEN_KG_JITTER_MULT_MIN + rng() * span
  let next = Math.round(base * multiplier)
  if (next < GREEN_KG_JITTER_MIN) next = GREEN_KG_JITTER_MIN
  return next
}

export type RecipeJitterOptions = {
  rng: () => number
  allowedFarmKeys: ReadonlyArray<DevFarmKey>
}

export function applyRecipeJitter(
  recipe: DevLotRecipe,
  opts: RecipeJitterOptions
): DevLotRecipe {
  // RNG call order matters for reproducibility: SCA → greenKg → farm.
  const scaScore = jitterSca(opts.rng, recipe.scaScore, recipe.variety)
  const greenKg = jitterGreenKg(opts.rng, recipe.greenKg)
  const farmKey = opts.allowedFarmKeys.length > 0
    ? pickFromArray(opts.rng, opts.allowedFarmKeys)
    : recipe.farmKey
  const parchmentKg = Math.round(greenKg / recipe.conversionRate)
  return {
    ...recipe,
    scaScore,
    greenKg,
    parchmentKg,
    farmKey,
  }
}

export function applyJitterToRecipes(
  scenario: DevLotScenarioKind,
  baseRecipes: ReadonlyArray<DevLotRecipe>,
  seed: string
): DevLotRecipe[] {
  if (!isScenarioJitterable(scenario)) {
    // Defensive: never mutate the regression fixture.
    return baseRecipes.map((r) => ({ ...r }))
  }
  const rng = createSeededRng(seed)
  const allowedFarmKeys = JITTER_FARM_GROUPS[scenario]
  return baseRecipes.map((recipe) =>
    applyRecipeJitter(recipe, { rng, allowedFarmKeys })
  )
}

// ------------------------------------------------------
// SEED CONFIG RESOLUTION
//
// Pure resolver — turns a (scenario, variationMode, seed)
// tuple into the actual mode/seed the seed pipeline will
// use. Forces deterministic for the regression preset and
// auto-fills appliedSeed from now() when jittered without
// a user-provided seed.
// ------------------------------------------------------

export function resolveSeedConfig(input: {
  scenario: DevLotScenarioKind
  variationMode?: DevLotVariationMode
  seed?: string
  now?: () => number
}): { variationMode: DevLotVariationMode; appliedSeed: string | null } {
  const requested: DevLotVariationMode = input.variationMode ?? "deterministic"
  if (requested === "deterministic" || !isScenarioJitterable(input.scenario)) {
    return { variationMode: "deterministic", appliedSeed: null }
  }
  const trimmed = (input.seed ?? "").trim()
  const appliedSeed = trimmed.length > 0
    ? trimmed
    : (input.now ?? Date.now)().toString()
  return { variationMode: "jittered", appliedSeed }
}
