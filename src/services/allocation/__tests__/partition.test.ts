//////////////////////////////////////////////////////
// 🧪 PARTITION HELPERS — UNIT TESTS
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  clampNonNegative,
  computeFreeGreenKg,
  computeProfileViability,
  isRareVariety,
  normalizeVariety,
} from "../domain/partition.ts"
import { CUSTOMER_CONSUMPTION_PROFILES_V0 } from "../policy/customerProfiles.ts"
import { DEFAULT_ALLOCATION_POLICY } from "../policy/allocationPolicy.ts"

// ------------------------------------------------------
// clampNonNegative
// ------------------------------------------------------

describe("clampNonNegative", () => {
  it("returns positive numbers unchanged", () => {
    assert.equal(clampNonNegative(42), 42)
    assert.equal(clampNonNegative(0.5), 0.5)
  })

  it("clamps zero and negatives to 0", () => {
    assert.equal(clampNonNegative(0), 0)
    assert.equal(clampNonNegative(-100), 0)
  })

  it("returns 0 for NaN / Infinity", () => {
    assert.equal(clampNonNegative(NaN), 0)
    assert.equal(clampNonNegative(Infinity), 0)
    assert.equal(clampNonNegative(-Infinity), 0)
  })

  it("returns 0 for non-number values", () => {
    // @ts-expect-error — guarding runtime behaviour
    assert.equal(clampNonNegative("100"), 0)
    // @ts-expect-error — guarding runtime behaviour
    assert.equal(clampNonNegative(undefined), 0)
    // @ts-expect-error — guarding runtime behaviour
    assert.equal(clampNonNegative(null), 0)
  })
})

// ------------------------------------------------------
// computeFreeGreenKg
// ------------------------------------------------------

describe("computeFreeGreenKg", () => {
  it("subtracts in the documented order", () => {
    const free = computeFreeGreenKg({
      availableGreenKg: 5000,
      committedContractGreenKg: 1000,
      reservedIntentGreenKg: 500,
      safetyBufferGreenKg: 400,
    })
    assert.equal(free, 3100)
  })

  it("never returns negative when claims exceed available", () => {
    const free = computeFreeGreenKg({
      availableGreenKg: 1000,
      committedContractGreenKg: 800,
      reservedIntentGreenKg: 500,
      safetyBufferGreenKg: 400,
    })
    assert.equal(free, 0)
  })

  it("treats NaN / Infinity inputs as zero", () => {
    const free = computeFreeGreenKg({
      availableGreenKg: Number.NaN,
      committedContractGreenKg: 0,
      reservedIntentGreenKg: 0,
      safetyBufferGreenKg: 0,
    })
    assert.equal(free, 0)
  })

  it("zero buffer = simple subtraction", () => {
    const free = computeFreeGreenKg({
      availableGreenKg: 1000,
      committedContractGreenKg: 200,
      reservedIntentGreenKg: 100,
      safetyBufferGreenKg: 0,
    })
    assert.equal(free, 700)
  })
})

// ------------------------------------------------------
// normalizeVariety / isRareVariety
// ------------------------------------------------------

describe("normalizeVariety", () => {
  it("uppercases and underscores whitespace + dashes", () => {
    assert.equal(normalizeVariety("pink bourbon"), "PINK_BOURBON")
    assert.equal(normalizeVariety("pink-bourbon"), "PINK_BOURBON")
    assert.equal(normalizeVariety("  Geisha  "), "GEISHA")
    assert.equal(normalizeVariety("Sudan Rume"), "SUDAN_RUME")
  })

  it("returns empty string for non-strings", () => {
    // @ts-expect-error — guarding runtime
    assert.equal(normalizeVariety(undefined), "")
    // @ts-expect-error — guarding runtime
    assert.equal(normalizeVariety(null), "")
    // @ts-expect-error — guarding runtime
    assert.equal(normalizeVariety(42), "")
  })
})

describe("isRareVariety", () => {
  const rare = DEFAULT_ALLOCATION_POLICY.rareVarieties

  it("matches across casing and separators", () => {
    assert.equal(isRareVariety("Geisha", rare), true)
    assert.equal(isRareVariety("geisha", rare), true)
    assert.equal(isRareVariety("Pink Bourbon", rare), true)
    assert.equal(isRareVariety("pink-bourbon", rare), true)
    assert.equal(isRareVariety("WUSH WUSH", rare), true)
  })

  it("returns false for non-rare", () => {
    assert.equal(isRareVariety("Caturra", rare), false)
    assert.equal(isRareVariety("Bourbon", rare), false) // not "PINK_BOURBON"
    assert.equal(isRareVariety("", rare), false)
  })
})

// ------------------------------------------------------
// computeProfileViability
// ------------------------------------------------------

describe("computeProfileViability", () => {
  it("returns empty when free pool is zero", () => {
    const v = computeProfileViability({
      freeGreenKg: 0,
      roastYield: 0.85,
      profiles: CUSTOMER_CONSUMPTION_PROFILES_V0,
      minimumContractMonths: 3,
    })
    assert.equal(v.length, 0)
  })

  it("filters profiles by minScaScore when scaScore is provided", () => {
    // SCA 79 → only office_corporate (minScaScore 80) is filtered out
    // because everyone with min ≤ 79 is admitted; nobody has min ≤ 79
    // in v0 except… nobody. Use 81 to admit office_corporate (min 80)
    // and exclude the rest (min ≥ 82).
    const v = computeProfileViability({
      freeGreenKg: 5000,
      roastYield: 0.85,
      profiles: CUSTOMER_CONSUMPTION_PROFILES_V0,
      minimumContractMonths: 3,
      scaScore: 81,
    })
    const ids = v.map((x) => x.profileId)
    assert.deepEqual(ids, ["office_corporate"])
  })

  it("ignores SCA filter when scaScore is null", () => {
    const v = computeProfileViability({
      freeGreenKg: 5000,
      roastYield: 0.85,
      profiles: CUSTOMER_CONSUMPTION_PROFILES_V0,
      minimumContractMonths: 3,
      scaScore: null,
    })
    assert.ok(v.length >= 5, `expected several viable profiles, got ${v.length}`)
  })

  it("requires monthsCovered >= minimumContractMonths", () => {
    // Tiny pool covers small_specialty (60kg roasted / 0.85 ≈ 70kg green/mo)
    // for ~5 months but nothing larger.
    const v = computeProfileViability({
      freeGreenKg: 350,
      roastYield: 0.85,
      profiles: CUSTOMER_CONSUMPTION_PROFILES_V0,
      minimumContractMonths: 3,
    })
    const ids = v.map((x) => x.profileId)
    assert.ok(ids.includes("small_specialty_cafe"))
    assert.ok(ids.includes("restaurant"))
    assert.ok(!ids.includes("medium_roaster"))
    assert.ok(!ids.includes("high_volume_hospitality_group"))
  })

  it("monthlyGreenKg uses the lot roast yield, not a default", () => {
    const v = computeProfileViability({
      freeGreenKg: 10000,
      roastYield: 0.80,
      profiles: CUSTOMER_CONSUMPTION_PROFILES_V0,
      minimumContractMonths: 3,
    })
    const small = v.find((x) => x.profileId === "small_specialty_cafe")
    assert.ok(small)
    assert.ok(Math.abs(small.monthlyGreenKg - 60 / 0.80) < 1e-6)
  })

  it("falls back to safe yield 0.83 when roastYield is non-finite", () => {
    const v = computeProfileViability({
      freeGreenKg: 10000,
      roastYield: Number.NaN,
      profiles: CUSTOMER_CONSUMPTION_PROFILES_V0,
      minimumContractMonths: 3,
    })
    const small = v.find((x) => x.profileId === "small_specialty_cafe")
    assert.ok(small)
    assert.ok(Math.abs(small.monthlyGreenKg - 60 / 0.83) < 1e-6)
  })
})
