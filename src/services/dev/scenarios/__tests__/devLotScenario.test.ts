//////////////////////////////////////////////////////
// 🧪 DEV LOT SCENARIO — PURE TESTS
//
// No DB. No HTTP. Just the validators / helpers /
// recipe presets exposed by devLotScenario.types.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  DEV_FARM_PREFIX,
  DEV_FARM_RECIPES,
  DEV_PRICING_VERSION,
  DEV_PRODUCER_USER_EMAIL,
  DEV_SCENARIO_PREFIX,
  DEV_SHIPMENT_PREFIX,
  PRICING_ENGINE_VARIETIES,
  SCENARIO_KINDS,
  SCENARIO_LIMITS,
  TARGET_STAGES,
  applyJitterToRecipes,
  applyRecipeJitter,
  clampCount,
  createSeededRng,
  getRecipePreset,
  hashSeedToUint32,
  isDevScenarioKind,
  isDevTargetStage,
  isScenarioJitterable,
  pickRecipes,
  resolveSeedConfig,
  toPricingEngineVariety,
  type DevFarmKey,
  type DevLotRecipe,
  type DevLotScenarioKind,
} from "../devLotScenario.types.ts"
import { BASE_PRODUCER_PRICING } from "../../../../engine/pricing/producer/pricingTable.ts"

const KNOWN_FARM_KEYS: ReadonlyArray<DevFarmKey> = [
  "huila", "narino", "antioquia", "tolima", "cauca",
]

const JITTERABLE: ReadonlyArray<DevLotScenarioKind> = [
  "marketplace_mix",
  "contract_catalog_mix",
  "exclusive_microlots",
  "large_split_lots",
  "logistics_ready",
  "stress_25_lots",
]

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

describe("constants", () => {

  it("uses the documented prefixes", () => {
    assert.equal(DEV_SCENARIO_PREFIX, "DEV-SCENARIO")
    assert.equal(DEV_SHIPMENT_PREFIX, "DEV-SCENARIO-SHIP")
    assert.equal(DEV_FARM_PREFIX, "[DEV]")
    assert.equal(DEV_PRICING_VERSION, "dev-scenario-v1")
    assert.equal(DEV_PRODUCER_USER_EMAIL, "producer.dev@alturacollective.test")
  })

  it("ships exactly five [DEV]-prefixed farms", () => {
    assert.equal(DEV_FARM_RECIPES.length, 5)
    for (const f of DEV_FARM_RECIPES) {
      assert.ok(f.name.startsWith(DEV_FARM_PREFIX), `${f.name} must start with ${DEV_FARM_PREFIX}`)
      assert.ok(f.altitude > 0)
      assert.ok(f.region.length > 0)
    }
  })

})

// ------------------------------------------------------
// SCENARIO + STAGE GUARDS
// ------------------------------------------------------

describe("isDevScenarioKind", () => {
  it("accepts every documented scenario", () => {
    for (const k of SCENARIO_KINDS) assert.ok(isDevScenarioKind(k))
  })
  it("rejects unknown values", () => {
    assert.equal(isDevScenarioKind("banana"), false)
    assert.equal(isDevScenarioKind(""), false)
    assert.equal(isDevScenarioKind(null), false)
    assert.equal(isDevScenarioKind(undefined), false)
    assert.equal(isDevScenarioKind(42), false)
  })
})

describe("isDevTargetStage", () => {
  it("accepts both documented stages", () => {
    for (const s of TARGET_STAGES) assert.ok(isDevTargetStage(s))
  })
  it("rejects unknown values", () => {
    assert.equal(isDevTargetStage("DELIVERED"), false)
    assert.equal(isDevTargetStage(""), false)
    assert.equal(isDevTargetStage(null), false)
  })
})

// ------------------------------------------------------
// CLAMP COUNT
// ------------------------------------------------------

describe("clampCount", () => {

  it("returns the scenario default when count is missing", () => {
    assert.equal(clampCount("allocation_engine_decides"), 10)
    assert.equal(clampCount("marketplace_mix"), 8)
    assert.equal(clampCount("stress_25_lots"), 25)
  })

  it("respects the per-scenario maximum", () => {
    assert.equal(clampCount("marketplace_mix", 50), 8)
    assert.equal(clampCount("stress_25_lots", 999), 25)
    assert.equal(clampCount("allocation_engine_decides", 25), 10)
  })

  it("never returns less than 1", () => {
    assert.equal(clampCount("marketplace_mix", 0), 1)
    assert.equal(clampCount("marketplace_mix", -5), 1)
  })

  it("ignores NaN / Infinity", () => {
    assert.equal(clampCount("marketplace_mix", Number.NaN), 8)
    assert.equal(clampCount("marketplace_mix", Number.POSITIVE_INFINITY), 8)
  })

  it("floors fractional inputs", () => {
    assert.equal(clampCount("marketplace_mix", 3.9), 3)
  })
})

// ------------------------------------------------------
// RECIPE PRESETS
// ------------------------------------------------------

describe("recipe presets", () => {

  it("every scenario provides at least its default count of recipes", () => {
    for (const kind of SCENARIO_KINDS) {
      const preset = getRecipePreset(kind)
      const limit = SCENARIO_LIMITS[kind]
      assert.ok(
        preset.length >= limit.default,
        `${kind} preset has ${preset.length}, default ${limit.default}`
      )
    }
  })

  it("stress_25_lots has exactly 25 recipes", () => {
    assert.equal(getRecipePreset("stress_25_lots").length, 25)
  })

  it("allocation_engine_decides has exactly 10 boundary recipes", () => {
    assert.equal(getRecipePreset("allocation_engine_decides").length, 10)
  })

  it("every recipe has positive volume + valid SCA + parchment >= greenKg", () => {
    for (const kind of SCENARIO_KINDS) {
      for (const r of getRecipePreset(kind)) {
        assert.ok(r.greenKg > 0, `greenKg must be > 0 in ${kind}`)
        assert.ok(r.scaScore >= 70 && r.scaScore <= 95, `SCA out of range in ${kind}`)
        assert.ok(r.parchmentKg >= r.greenKg, `parchmentKg must be >= greenKg in ${kind}`)
        assert.ok(r.estimatedRoastYield >= 0.5 && r.estimatedRoastYield <= 1.0)
        assert.ok(["WASHED", "NATURAL", "HONEY", "ANAEROBIC"].includes(r.process))
      }
    }
  })

  it("recipes do NOT carry an invented pricePerKg field", () => {
    // Pricing must come from the producer pricing engine, not from
    // the recipe. Catches anyone re-introducing a fake price field.
    for (const kind of SCENARIO_KINDS) {
      for (const r of getRecipePreset(kind)) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(r, "pricePerKg"),
          false,
          `recipe in ${kind} must not carry a pricePerKg field`
        )
      }
    }
  })

  it("allocation_engine_decides preset includes the documented boundary cases", () => {
    const preset = getRecipePreset("allocation_engine_decides")
    // Just below contract floor (1450 kg)
    assert.ok(preset.some((r) => r.greenKg === 1450 && r.scaScore === 83))
    // True exclusive (350 kg Geisha SCA 91)
    assert.ok(preset.some((r) =>
      r.greenKg === 350 && r.scaScore === 91 && r.variety === "Geisha"
    ))
    // Huge split candidate
    assert.ok(preset.some((r) => r.greenKg === 28000))
  })

})

// ------------------------------------------------------
// pickRecipes
// ------------------------------------------------------

describe("pickRecipes", () => {

  it("returns the requested slice up to the cap", () => {
    const five = pickRecipes("marketplace_mix", 5)
    assert.equal(five.length, 5)

    const overflow = pickRecipes("marketplace_mix", 999)
    assert.equal(overflow.length, 8)
  })

  it("returns the scenario default when count is undefined", () => {
    assert.equal(pickRecipes("allocation_engine_decides").length, 10)
    assert.equal(pickRecipes("marketplace_mix").length, 8)
    assert.equal(pickRecipes("stress_25_lots").length, 25)
  })

  it("never returns fewer than 1 recipe", () => {
    const zero = pickRecipes("marketplace_mix", 0)
    assert.equal(zero.length, 1)
  })

  it("returned recipes carry [DEV]-friendly farmKey", () => {
    const recipes = pickRecipes("logistics_ready", 8)
    for (const r of recipes) {
      assert.ok(
        ["huila", "narino", "antioquia", "tolima", "cauca"].includes(r.farmKey)
      )
    }
  })

})

// ------------------------------------------------------
// PRICING ENGINE COMPATIBILITY
//
// Every recipe must be priceable by the producer pricing
// engine (calculateProducerPricing). The engine throws when
// (variety, scaRange) has no entry in BASE_PRODUCER_PRICING.
// Catches Wush Wush / Sudan Rume style mistakes.
// ------------------------------------------------------

describe("pricing engine compatibility", () => {

  it("toPricingEngineVariety normalises common variety strings", () => {
    assert.equal(toPricingEngineVariety("Geisha"), "GEISHA")
    assert.equal(toPricingEngineVariety("Pink Bourbon"), "PINK_BOURBON")
    assert.equal(toPricingEngineVariety("pink-bourbon"), "PINK_BOURBON")
    assert.equal(toPricingEngineVariety("CATURRA"), "CATURRA")
  })

  it("toPricingEngineVariety throws for unsupported varieties", () => {
    assert.throws(() => toPricingEngineVariety("Wush Wush"))
    assert.throws(() => toPricingEngineVariety("Sudan Rume"))
    assert.throws(() => toPricingEngineVariety(""))
  })

  function pickScaRange(sca: number): "80-83" | "84-86" | "87-90" {
    if (sca >= 80 && sca <= 83) return "80-83"
    if (sca >= 84 && sca <= 86) return "84-86"
    if (sca >= 87) return "87-90"
    throw new Error(`SCA ${sca} below the engine's supported floor of 80`)
  }

  it("every recipe variety + SCA combination has a base price", () => {
    for (const kind of SCENARIO_KINDS) {
      for (const r of getRecipePreset(kind)) {
        const variety = toPricingEngineVariety(r.variety)
        assert.ok(
          PRICING_ENGINE_VARIETIES.includes(variety),
          `${variety} not in PRICING_ENGINE_VARIETIES (${kind})`
        )
        const range = pickScaRange(r.scaScore)
        const table = BASE_PRODUCER_PRICING[range] as Record<string, number>
        assert.ok(
          variety in table,
          `${variety} has no base price in range ${range} for scenario ${kind}`
        )
        assert.ok(
          table[variety] > 0,
          `${variety} base price not positive in range ${range}`
        )
      }
    }
  })

})

// ------------------------------------------------------
// LOT NUMBER PREFIX RULE
// ------------------------------------------------------

describe("lotNumber convention", () => {
  it("constructs a DEV-SCENARIO- prefixed identifier", () => {
    const ts = 1700000000000
    const prefix = `${DEV_SCENARIO_PREFIX}-marketplace_mix-${ts}-1`
    assert.ok(prefix.startsWith(`${DEV_SCENARIO_PREFIX}-`))
  })
})

// ------------------------------------------------------
// SEEDED PRNG
// ------------------------------------------------------

describe("hashSeedToUint32", () => {
  it("returns identical hashes for identical seeds", () => {
    assert.equal(hashSeedToUint32("abc"), hashSeedToUint32("abc"))
    assert.equal(hashSeedToUint32(""), hashSeedToUint32(""))
  })

  it("differs across distinct seeds", () => {
    assert.notEqual(hashSeedToUint32("abc"), hashSeedToUint32("xyz"))
    assert.notEqual(hashSeedToUint32("abc"), hashSeedToUint32("abcd"))
  })

  it("always returns an unsigned 32-bit integer", () => {
    for (const seed of ["", "a", "abc", "DEV-LOTS-4", "0", "🎲"]) {
      const h = hashSeedToUint32(seed)
      assert.ok(Number.isInteger(h), `${seed} must hash to integer`)
      assert.ok(h >= 0 && h <= 0xffffffff, `${seed} hash out of u32 range`)
    }
  })
})

describe("createSeededRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createSeededRng("abc")
    const b = createSeededRng("abc")
    for (let i = 0; i < 50; i++) {
      assert.equal(a(), b())
    }
  })

  it("produces different sequences for different seeds", () => {
    const a = createSeededRng("abc")
    const b = createSeededRng("xyz")
    let differs = false
    for (let i = 0; i < 50; i++) {
      if (a() !== b()) { differs = true; break }
    }
    assert.ok(differs, "two different seeds must diverge within 50 draws")
  })

  it("always returns numbers in [0, 1)", () => {
    const rng = createSeededRng("range-check")
    for (let i = 0; i < 200; i++) {
      const x = rng()
      assert.ok(x >= 0 && x < 1, `out-of-range value ${x}`)
    }
  })
})

// ------------------------------------------------------
// isScenarioJitterable
// ------------------------------------------------------

describe("isScenarioJitterable", () => {
  it("excludes the regression boundary preset", () => {
    assert.equal(isScenarioJitterable("allocation_engine_decides"), false)
  })

  it("includes every other scenario", () => {
    for (const k of JITTERABLE) {
      assert.ok(isScenarioJitterable(k), `${k} must be jitterable`)
    }
  })
})

// ------------------------------------------------------
// applyJitterToRecipes — deterministic invariants
// ------------------------------------------------------

describe("applyJitterToRecipes — deterministic invariants", () => {

  it("allocation_engine_decides is never jittered (defensive)", () => {
    const base = getRecipePreset("allocation_engine_decides")
    const out = applyJitterToRecipes(
      "allocation_engine_decides", base, "any-seed"
    )
    assert.deepEqual(out, base.map((r) => ({ ...r })))
  })

  it("same seed + same scenario + same count produces deeply equal lists", () => {
    const base = getRecipePreset("stress_25_lots")
    const a = applyJitterToRecipes("stress_25_lots", base, "abc")
    const b = applyJitterToRecipes("stress_25_lots", base, "abc")
    assert.deepEqual(a, b)
  })

  it("different seeds produce at least one differing recipe", () => {
    const base = getRecipePreset("stress_25_lots")
    const a = applyJitterToRecipes("stress_25_lots", base, "abc")
    const b = applyJitterToRecipes("stress_25_lots", base, "xyz")
    let differs = false
    for (let i = 0; i < a.length; i++) {
      const ra = a[i], rb = b[i]
      if (
        ra.scaScore !== rb.scaScore ||
        ra.greenKg !== rb.greenKg ||
        ra.parchmentKg !== rb.parchmentKg ||
        ra.farmKey !== rb.farmKey
      ) {
        differs = true
        break
      }
    }
    assert.ok(differs, "abc vs xyz must differ in at least one field")
  })

  it("preserves variety, process, harvestYear, conversionRate, estimatedRoastYield", () => {
    for (const kind of JITTERABLE) {
      const base = getRecipePreset(kind)
      const out = applyJitterToRecipes(kind, base, "preserve-fields")
      assert.equal(out.length, base.length)
      for (let i = 0; i < out.length; i++) {
        assert.equal(out[i].variety, base[i].variety, `variety drift in ${kind}`)
        assert.equal(out[i].process, base[i].process, `process drift in ${kind}`)
        assert.equal(out[i].harvestYear, base[i].harvestYear, `harvestYear drift in ${kind}`)
        assert.equal(out[i].conversionRate, base[i].conversionRate, `conversionRate drift in ${kind}`)
        assert.equal(out[i].estimatedRoastYield, base[i].estimatedRoastYield, `yield drift in ${kind}`)
      }
    }
  })

  it("SCA stays integer in [80, 92] after jitter", () => {
    for (const kind of JITTERABLE) {
      const base = getRecipePreset(kind)
      const out = applyJitterToRecipes(kind, base, `sca-${kind}`)
      for (const r of out) {
        assert.ok(Number.isInteger(r.scaScore), `non-integer SCA in ${kind}`)
        assert.ok(r.scaScore >= 80, `SCA below floor in ${kind}: ${r.scaScore}`)
        assert.ok(r.scaScore <= 92, `SCA above ceiling in ${kind}: ${r.scaScore}`)
      }
    }
  })

  it("greenKg ≥ 50 and parchmentKg = round(greenKg / conversionRate) after jitter", () => {
    for (const kind of JITTERABLE) {
      const base = getRecipePreset(kind)
      const out = applyJitterToRecipes(kind, base, `vol-${kind}`)
      for (const r of out) {
        assert.ok(r.greenKg >= 50, `greenKg < 50 in ${kind}: ${r.greenKg}`)
        assert.equal(
          r.parchmentKg,
          Math.round(r.greenKg / r.conversionRate),
          `parchment recompute mismatch in ${kind}`
        )
      }
    }
  })

  it("farmKey stays in the known DEV farm keys after jitter", () => {
    for (const kind of JITTERABLE) {
      const base = getRecipePreset(kind)
      const out = applyJitterToRecipes(kind, base, `farms-${kind}`)
      for (const r of out) {
        assert.ok(
          KNOWN_FARM_KEYS.includes(r.farmKey),
          `unknown farmKey ${r.farmKey} in ${kind}`
        )
      }
    }
  })

  it("exclusive_microlots farm group is restricted to high-altitude farms", () => {
    const base = getRecipePreset("exclusive_microlots")
    // 8 recipes × 50 different seeds = 400 samples. The microlot farm group
    // is narino/cauca/huila/antioquia — tolima must never appear.
    for (let s = 0; s < 50; s++) {
      const out = applyJitterToRecipes("exclusive_microlots", base, `seed-${s}`)
      for (const r of out) {
        assert.notEqual(
          r.farmKey, "tolima",
          "exclusive_microlots must never land on the tolima farm group"
        )
        assert.ok(
          ["narino", "cauca", "huila", "antioquia"].includes(r.farmKey),
          `unexpected farm ${r.farmKey} for exclusive_microlots`
        )
      }
    }
  })
})

// ------------------------------------------------------
// applyRecipeJitter — direct unit tests with controlled RNGs
// ------------------------------------------------------

describe("applyRecipeJitter — controlled RNGs", () => {

  // Build a deterministic recipe scaffold for synthetic tests.
  function recipe(overrides: Partial<DevLotRecipe>): DevLotRecipe {
    const base: DevLotRecipe = {
      farmKey: "huila",
      variety: "Caturra",
      process: "WASHED",
      harvestYear: 2026,
      greenKg: 1000,
      parchmentKg: 1250,
      conversionRate: 0.8,
      scaScore: 85,
      estimatedRoastYield: 0.85,
      name: null,
    }
    return { ...base, ...overrides }
  }

  // RNG that always returns 0 — drives SCA offset to -1 and greenKg
  // multiplier to its minimum (0.8).
  const rngZero = (): () => number => {
    return () => 0
  }

  // RNG that always returns ~0.999 — drives SCA offset to +1 and
  // greenKg multiplier to its near-maximum.
  const rngHigh = (): () => number => {
    return () => 0.9999
  }

  it("SCA offset uses {-1, 0, +1} integer steps", () => {
    const r = recipe({ scaScore: 85, greenKg: 1000 })
    const low = applyRecipeJitter(r, { rng: rngZero(), allowedFarmKeys: [] })
    assert.equal(low.scaScore, 84)
    const high = applyRecipeJitter(r, { rng: rngHigh(), allowedFarmKeys: [] })
    assert.equal(high.scaScore, 86)
  })

  it("Geisha never falls below 84 even when SCA offset would push it lower", () => {
    const r = recipe({ variety: "Geisha", scaScore: 84 })
    // rng=0 gives offset -1 → 83 → clamp 84.
    const out = applyRecipeJitter(r, { rng: rngZero(), allowedFarmKeys: [] })
    assert.equal(out.scaScore, 84)
  })

  it("Pink Bourbon never falls below 84 even when SCA offset would push it lower", () => {
    const r = recipe({ variety: "Pink Bourbon", scaScore: 84 })
    const out = applyRecipeJitter(r, { rng: rngZero(), allowedFarmKeys: [] })
    assert.equal(out.scaScore, 84)
  })

  it("greenKg never falls below 50 even when multiplier × base would round lower", () => {
    const r = recipe({ greenKg: 60 })
    // rng=0 → multiplier 0.8 → 48 → clamp 50.
    const out = applyRecipeJitter(r, { rng: rngZero(), allowedFarmKeys: [] })
    assert.equal(out.greenKg, 50)
    assert.equal(out.parchmentKg, Math.round(50 / 0.8))
  })

  it("parchmentKg is always recomputed from the jittered greenKg / conversionRate", () => {
    const r = recipe({ greenKg: 2000, conversionRate: 0.8 })
    const out = applyRecipeJitter(r, { rng: rngHigh(), allowedFarmKeys: [] })
    assert.equal(out.parchmentKg, Math.round(out.greenKg / 0.8))
    // conversionRate stays untouched.
    assert.equal(out.conversionRate, 0.8)
  })

  it("variety, process, harvestYear preserved exactly", () => {
    const r = recipe({
      variety: "Pink Bourbon",
      process: "ANAEROBIC",
      harvestYear: 2025,
    })
    const out = applyRecipeJitter(r, {
      rng: createSeededRng("preserve"),
      allowedFarmKeys: KNOWN_FARM_KEYS,
    })
    assert.equal(out.variety, "Pink Bourbon")
    assert.equal(out.process, "ANAEROBIC")
    assert.equal(out.harvestYear, 2025)
  })

  it("empty allowedFarmKeys preserves the recipe's original farm", () => {
    const r = recipe({ farmKey: "narino" })
    const out = applyRecipeJitter(r, {
      rng: createSeededRng("no-farms"),
      allowedFarmKeys: [],
    })
    assert.equal(out.farmKey, "narino")
  })
})

// ------------------------------------------------------
// resolveSeedConfig
// ------------------------------------------------------

describe("resolveSeedConfig", () => {

  it("defaults to deterministic with appliedSeed=null when nothing is provided", () => {
    const out = resolveSeedConfig({ scenario: "marketplace_mix" })
    assert.equal(out.variationMode, "deterministic")
    assert.equal(out.appliedSeed, null)
  })

  it("explicit deterministic ignores any seed", () => {
    const out = resolveSeedConfig({
      scenario: "marketplace_mix",
      variationMode: "deterministic",
      seed: "ignored",
    })
    assert.equal(out.variationMode, "deterministic")
    assert.equal(out.appliedSeed, null)
  })

  it("forces deterministic for allocation_engine_decides even when jittered requested", () => {
    const out = resolveSeedConfig({
      scenario: "allocation_engine_decides",
      variationMode: "jittered",
      seed: "x",
    })
    assert.equal(out.variationMode, "deterministic")
    assert.equal(out.appliedSeed, null)
  })

  it("uses the provided seed verbatim (trimmed) when jittered", () => {
    const out = resolveSeedConfig({
      scenario: "stress_25_lots",
      variationMode: "jittered",
      seed: "  pricing-geisha-1  ",
    })
    assert.equal(out.variationMode, "jittered")
    assert.equal(out.appliedSeed, "pricing-geisha-1")
  })

  it("auto-fills appliedSeed from now() when jittered without seed", () => {
    const fakeNow = () => 1731000000000
    const out = resolveSeedConfig({
      scenario: "marketplace_mix",
      variationMode: "jittered",
      now: fakeNow,
    })
    assert.equal(out.variationMode, "jittered")
    assert.equal(out.appliedSeed, "1731000000000")
  })

  it("treats empty/whitespace-only seed as missing and auto-fills", () => {
    const fakeNow = () => 9999
    const out = resolveSeedConfig({
      scenario: "marketplace_mix",
      variationMode: "jittered",
      seed: "   ",
      now: fakeNow,
    })
    assert.equal(out.appliedSeed, "9999")
  })
})
