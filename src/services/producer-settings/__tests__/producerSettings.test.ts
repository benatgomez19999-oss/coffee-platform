//////////////////////////////////////////////////////
// 🧪 PRODUCER-SETTINGS-1 — pure helper tests
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildProducerReadinessSummary,
  pickActiveFarmId,
  sanitiseAltitude,
  sanitisePhone,
  validateProducerSettingsPatch,
  PRODUCER_NAME_MAX,
  FARM_NAME_MAX,
} from "../producerSettings.pure.ts"
import type { LotMediaReadinessPanel } from "../../lot-media/lotMedia.types.ts"

// ------------------------------------------------------
// validateProducerSettingsPatch
// ------------------------------------------------------

describe("validateProducerSettingsPatch", () => {

  it("accepts an empty object as a no-op patch", () => {
    const r = validateProducerSettingsPatch({})
    assert.equal(r.ok, true)
    if (r.ok) assert.deepEqual(r.patch, {})
  })

  it("trims string fields and converts empty strings to null", () => {
    const r = validateProducerSettingsPatch({
      producerProfile: {
        contactName: "  Maria  ",
        country: "",
      },
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.patch.producerProfile?.contactName, "Maria")
      assert.equal(r.patch.producerProfile?.country, null)
    }
  })

  it("rejects producer name over the max length", () => {
    const r = validateProducerSettingsPatch({
      producerProfile: { producerName: "x".repeat(PRODUCER_NAME_MAX + 1) },
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "PRODUCER_NAME_TOO_LONG")
  })

  it("rejects unknown root sections", () => {
    const r = validateProducerSettingsPatch({
      producerProfile: "not an object",
    } as unknown)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "UNKNOWN_SECTION")
  })

  it("requires farmId on farmProfile updates", () => {
    const r = validateProducerSettingsPatch({
      farmProfile: { name: "Finca Demo" },
    } as unknown)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "FARM_ID_REQUIRED")
  })

  it("rejects farm name over the max length", () => {
    const r = validateProducerSettingsPatch({
      farmProfile: { farmId: "f1", name: "x".repeat(FARM_NAME_MAX + 1) },
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "FARM_NAME_TOO_LONG")
  })

  it("partial PATCH preserves omitted sections", () => {
    const r = validateProducerSettingsPatch({
      producerProfile: { phone: "+34 666 111 222" },
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.patch.producerProfile?.phone, "+34 666 111 222")
      assert.equal(r.patch.farmProfile, undefined)
    }
  })

  it("clears phone with an empty string", () => {
    const r = validateProducerSettingsPatch({
      producerProfile: { phone: "" },
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.patch.producerProfile?.phone, null)
  })

  it("rejects an invalid phone format", () => {
    const r = validateProducerSettingsPatch({
      producerProfile: { phone: "abc-def" },
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "PHONE_INVALID")
  })

  it("treats clearing Farm.name as a no-op (NOT NULL in schema)", () => {
    const r = validateProducerSettingsPatch({
      farmProfile: { farmId: "f1", name: "" },
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.patch.farmProfile?.name, undefined)
  })
})

// ------------------------------------------------------
// sanitisePhone / sanitiseAltitude
// ------------------------------------------------------

describe("sanitisePhone", () => {
  it("accepts a typical international phone", () => {
    const r = sanitisePhone("+34 666-111 222")
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value, "+34 666-111 222")
  })

  it("rejects junk characters", () => {
    const r = sanitisePhone("javascript:alert(1)")
    assert.equal(r.ok, false)
  })

  it("treats empty string as clearing (null)", () => {
    const r = sanitisePhone("")
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value, null)
  })

  it("propagates undefined as no-op", () => {
    const r = sanitisePhone(undefined)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value, undefined)
  })
})

describe("sanitiseAltitude", () => {

  it("accepts a normal coffee farm altitude", () => {
    const r = sanitiseAltitude(1850)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value, 1850)
  })

  it("rounds non-integer altitudes", () => {
    const r = sanitiseAltitude(1850.7)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value, 1851)
  })

  it("rejects unreasonable altitudes", () => {
    assert.equal(sanitiseAltitude(-100).ok, false)
    assert.equal(sanitiseAltitude(18000).ok, false)
  })

  it("rejects non-numeric input", () => {
    const r = sanitiseAltitude("high" as unknown)
    assert.equal(r.ok, false)
  })

  it("treats null as clearing", () => {
    const r = sanitiseAltitude(null)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value, null)
  })
})

// ------------------------------------------------------
// pickActiveFarmId
// ------------------------------------------------------

describe("pickActiveFarmId", () => {

  it("returns null when there are no farms", () => {
    assert.equal(pickActiveFarmId([], undefined), null)
  })

  it("returns the requested farm when it exists", () => {
    const farms = [{ id: "a", name: "A" }, { id: "b", name: "B" }]
    assert.equal(pickActiveFarmId(farms, "b"), "b")
  })

  it("falls back to the first farm when requested id does not match", () => {
    const farms = [{ id: "a", name: "A" }, { id: "b", name: "B" }]
    assert.equal(pickActiveFarmId(farms, "missing"), "a")
  })

  it("falls back to the first farm when nothing requested", () => {
    const farms = [{ id: "a", name: "A" }, { id: "b", name: "B" }]
    assert.equal(pickActiveFarmId(farms, undefined), "a")
  })
})

// ------------------------------------------------------
// buildProducerReadinessSummary
// ------------------------------------------------------

function panel(input: {
  ready: boolean
  farmState: "SATISFIED" | "MISSING"
  processState: "SATISFIED" | "MISSING"
  producerState?: "SATISFIED" | "MISSING"
}): LotMediaReadinessPanel {
  return {
    publicListing: {
      ready: input.ready,
      slots: [
        {
          code: "PUBLIC_FARM_PHOTO",
          label: "Farm photo",
          description: "x",
          state: input.farmState,
          required: true,
        },
        {
          code: "PUBLIC_PROCESS_OR_PRODUCT_PHOTO",
          label: "Process photo",
          description: "x",
          state: input.processState,
          required: true,
        },
        {
          code: "PUBLIC_PRODUCER_PHOTO",
          label: "Producer photo",
          description: "x",
          state: input.producerState ?? "MISSING",
          required: false,
        },
      ],
    },
    buyerProof: { blocking: false, slots: [] },
  }
}

describe("buildProducerReadinessSummary", () => {

  it("emits a ready headline when everything is in place", () => {
    const r = buildProducerReadinessSummary(
      panel({ ready: true, farmState: "SATISFIED", processState: "SATISFIED" }),
    )
    assert.equal(r.ready, true)
    assert.equal(r.missingCount, 0)
    assert.match(r.headline, /ready to publish/i)
  })

  it("pluralises the missing-count headline", () => {
    const r = buildProducerReadinessSummary(
      panel({ ready: false, farmState: "MISSING", processState: "MISSING" }),
    )
    assert.equal(r.missingCount, 2)
    assert.match(r.headline, /2 items missing/i)
  })

  it("uses singular for a single missing item", () => {
    const r = buildProducerReadinessSummary(
      panel({ ready: false, farmState: "MISSING", processState: "SATISFIED" }),
    )
    assert.equal(r.missingCount, 1)
    assert.match(r.headline, /^1 item missing/i)
  })

  it("never returns technical enum names in user-facing strings", () => {
    const r = buildProducerReadinessSummary(
      panel({ ready: false, farmState: "MISSING", processState: "MISSING" }),
    )
    for (const row of r.rows) {
      assert.doesNotMatch(row.label, /PUBLIC_MARKET|BUYER_PRIVATE|INTERNAL_ONLY|SATISFIED|MISSING/)
      assert.doesNotMatch(row.description, /PUBLIC_MARKET|BUYER_PRIVATE|INTERNAL_ONLY/)
    }
    assert.doesNotMatch(r.headline, /PUBLIC_MARKET|BUYER_PRIVATE|INTERNAL_ONLY/)
  })

  it("maps known slot codes to producer-friendly labels", () => {
    const r = buildProducerReadinessSummary(
      panel({ ready: false, farmState: "MISSING", processState: "SATISFIED" }),
    )
    const farmRow = r.rows.find((row) => row.code === "PUBLIC_FARM_PHOTO")
    assert.ok(farmRow)
    assert.equal(farmRow.label, "Farm / origin photo")
    assert.equal(farmRow.ready, false)
  })
})
