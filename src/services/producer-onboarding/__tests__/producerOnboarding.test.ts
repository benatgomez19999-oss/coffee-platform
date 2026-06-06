//////////////////////////////////////////////////////
// 🧪 PRODUCER-ONBOARDING-V2 — pure helper tests
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  BUSINESS_NAME_MAX,
  COUNTRY_MAX,
  FARM_REGION_MAX,
  MAX_ALTITUDE_M,
  MIN_ALTITUDE_M,
  sanitiseFarmRegion,
  sanitiseProducerCountry,
  sanitiseProducerOnboardingInput,
  validateFarmAltitude,
} from "../producerOnboarding.pure.ts"
import { sanitiseAltitude } from "../../producer-settings/producerSettings.pure.ts"

const VALID: Record<string, unknown> = {
  businessName: "Finca Demo",
  country: "Colombia",
  region: "Huila",
  altitude: 1850,
}

// ------------------------------------------------------
// sanitiseProducerOnboardingInput — happy path + trims
// ------------------------------------------------------

describe("sanitiseProducerOnboardingInput", () => {

  it("accepts a valid payload and trims strings", () => {
    const r = sanitiseProducerOnboardingInput({
      businessName: "  Finca Demo  ",
      country: "  Colombia ",
      region: " Huila ",
      altitude: 1850,
      contactName: " María González ",
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.input.businessName, "Finca Demo")
      assert.equal(r.input.country, "Colombia")
      assert.equal(r.input.region, "Huila")
      assert.equal(r.input.altitude, 1850)
      assert.equal(r.input.contactName, "María González")
    }
  })

  it("rejects when businessName is missing", () => {
    const r = sanitiseProducerOnboardingInput({ ...VALID, businessName: " " })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "BUSINESS_NAME_REQUIRED")
  })

  it("rejects when country is missing", () => {
    const r = sanitiseProducerOnboardingInput({ ...VALID, country: "" })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "COUNTRY_REQUIRED")
  })

  it("rejects when region is missing", () => {
    const r = sanitiseProducerOnboardingInput({ ...VALID, region: undefined })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "REGION_REQUIRED")
  })

  it("rejects when altitude is missing — no silent fallback to 1800", () => {
    const r = sanitiseProducerOnboardingInput({
      ...VALID,
      altitude: undefined,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "ALTITUDE_REQUIRED")
  })

  it("rejects altitude as empty string (form sends '' for blanks)", () => {
    const r = sanitiseProducerOnboardingInput({ ...VALID, altitude: "" })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "ALTITUDE_REQUIRED")
  })

  it("rejects non-numeric altitude", () => {
    const r = sanitiseProducerOnboardingInput({ ...VALID, altitude: "high" })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "ALTITUDE_INVALID")
  })

  it("rejects NaN / Infinity altitudes", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const r = sanitiseProducerOnboardingInput({ ...VALID, altitude: bad })
      assert.equal(r.ok, false)
      if (!r.ok) assert.equal(r.error.code, "ALTITUDE_INVALID")
    }
  })

  it("rejects altitude below range", () => {
    const r = sanitiseProducerOnboardingInput({
      ...VALID,
      altitude: MIN_ALTITUDE_M - 1,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "ALTITUDE_INVALID")
  })

  it("rejects altitude above range", () => {
    const r = sanitiseProducerOnboardingInput({
      ...VALID,
      altitude: MAX_ALTITUDE_M + 1,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "ALTITUDE_INVALID")
  })

  it("accepts altitude provided as a numeric string", () => {
    const r = sanitiseProducerOnboardingInput({ ...VALID, altitude: "2050" })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.input.altitude, 2050)
  })

  it("clamps an overlong region instead of throwing", () => {
    const long = "x".repeat(FARM_REGION_MAX + 50)
    const r = sanitiseProducerOnboardingInput({ ...VALID, region: long })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.input.region.length, FARM_REGION_MAX)
  })

  it("clamps an overlong country instead of throwing", () => {
    const long = "x".repeat(COUNTRY_MAX + 50)
    const r = sanitiseProducerOnboardingInput({ ...VALID, country: long })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.input.country.length, COUNTRY_MAX)
  })

  it("rejects an overlong businessName", () => {
    const long = "x".repeat(BUSINESS_NAME_MAX + 1)
    const r = sanitiseProducerOnboardingInput({ ...VALID, businessName: long })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "BUSINESS_NAME_TOO_LONG")
  })

  it("preserves contactName as null when omitted", () => {
    const r = sanitiseProducerOnboardingInput(VALID)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.input.contactName, null)
  })

  it("does NOT inject 1800m anywhere when altitude is missing", () => {
    const r = sanitiseProducerOnboardingInput({
      ...VALID,
      altitude: undefined,
    })
    if (!r.ok) {
      assert.doesNotMatch(r.error.message, /1800/)
    } else {
      assert.fail("Expected error for missing altitude")
    }
  })
})

// ------------------------------------------------------
// validateFarmAltitude
// ------------------------------------------------------

describe("validateFarmAltitude", () => {

  it("accepts a typical farm altitude as a number", () => {
    const r = validateFarmAltitude(1850)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value, 1850)
  })

  it("accepts a numeric string", () => {
    const r = validateFarmAltitude("2050")
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value, 2050)
  })

  it("rejects undefined as ALTITUDE_REQUIRED", () => {
    const r = validateFarmAltitude(undefined)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, "ALTITUDE_REQUIRED")
  })

  it("rejects out-of-range as ALTITUDE_INVALID", () => {
    const r = validateFarmAltitude(7000)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, "ALTITUDE_INVALID")
  })
})

// ------------------------------------------------------
// Cross-check: onboarding altitude validator agrees with
// PRODUCER-SETTINGS-1's sanitiseAltitude on the range.
// ------------------------------------------------------

describe("altitude rules stay consistent with producer-settings", () => {

  it("settings validator accepts the same valid altitudes", () => {
    const onboardingResult = validateFarmAltitude(2050)
    const settingsResult = sanitiseAltitude(2050)
    assert.equal(onboardingResult.ok, true)
    assert.equal(settingsResult.ok, true)
    if (onboardingResult.ok && settingsResult.ok) {
      assert.equal(onboardingResult.value, settingsResult.value)
    }
  })

  it("settings validator rejects what onboarding rejects (>MAX)", () => {
    const onboardingResult = validateFarmAltitude(MAX_ALTITUDE_M + 100)
    const settingsResult = sanitiseAltitude(MAX_ALTITUDE_M + 100)
    assert.equal(onboardingResult.ok, false)
    assert.equal(settingsResult.ok, false)
  })
})

// ------------------------------------------------------
// sanitiseFarmRegion / sanitiseProducerCountry
// ------------------------------------------------------

describe("sanitiseFarmRegion + sanitiseProducerCountry", () => {

  it("returns null for empty / whitespace region", () => {
    assert.equal(sanitiseFarmRegion(""), null)
    assert.equal(sanitiseFarmRegion("   "), null)
    assert.equal(sanitiseFarmRegion(undefined), null)
  })

  it("trims and returns the region", () => {
    assert.equal(sanitiseFarmRegion("  Huila  "), "Huila")
  })

  it("returns null for empty / whitespace country", () => {
    assert.equal(sanitiseProducerCountry(""), null)
    assert.equal(sanitiseProducerCountry(null), null)
  })

  it("trims and returns the country", () => {
    assert.equal(sanitiseProducerCountry(" Colombia "), "Colombia")
  })
})
