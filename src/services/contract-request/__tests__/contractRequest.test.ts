//////////////////////////////////////////////////////
// 🧪 CONTRACT-REQUEST-1 — pure helper tests
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  ALLOWED_DURATION_MONTHS,
  CONTRACT_REQUEST_MAX_FUTURE_MONTHS,
  formatDemandIntentOutcome,
  getDefaultContractRequestDurationMonths,
  hasPendingRequestForLot,
  MAX_MONTHLY_ROASTED_KG,
  sanitiseContractRequestCreateInput,
  validateContractRequestDuration,
  validateContractRequestInput,
  validateContractRequestStartDate,
} from "../contractRequest.pure.ts"

// ------------------------------------------------------
// validateContractRequestInput
// ------------------------------------------------------

describe("validateContractRequestInput", () => {

  it("accepts a canonical payload", () => {
    const r = validateContractRequestInput({
      greenLotId: "lot-1",
      requestedKg: 250,
      durationMonths: 6,
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.value.greenLotId, "lot-1")
      assert.equal(r.value.requestedKg, 250)
      assert.equal(r.value.durationMonths, 6)
    }
  })

  it("trims greenLotId", () => {
    const r = validateContractRequestInput({
      greenLotId: "  lot-1  ",
      requestedKg: 250,
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value.greenLotId, "lot-1")
  })

  it("rejects missing greenLotId", () => {
    const r = validateContractRequestInput({
      greenLotId: "",
      requestedKg: 200,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "GREEN_LOT_ID_REQUIRED")
  })

  it("rejects non-string greenLotId", () => {
    const r = validateContractRequestInput({
      greenLotId: 42,
      requestedKg: 200,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "GREEN_LOT_ID_REQUIRED")
  })

  it("rejects missing requestedKg", () => {
    const r = validateContractRequestInput({
      greenLotId: "lot-1",
      requestedKg: undefined,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "REQUESTED_KG_REQUIRED")
  })

  it("rejects requestedKg <= 0", () => {
    for (const bad of [0, -5, -0.1]) {
      const r = validateContractRequestInput({
        greenLotId: "lot-1",
        requestedKg: bad,
      })
      assert.equal(r.ok, false)
      if (!r.ok) {
        // 0 fails the minimum gate; negatives fail the same gate.
        assert.equal(r.error.code, "REQUESTED_KG_TOO_SMALL")
      }
    }
  })

  it("rejects NaN / Infinity / non-numeric strings", () => {
    for (const bad of [NaN, Infinity, -Infinity, "abc", "1,000"]) {
      const r = validateContractRequestInput({
        greenLotId: "lot-1",
        requestedKg: bad as unknown,
      })
      assert.equal(r.ok, false)
      if (!r.ok) {
        assert.ok(
          r.error.code === "REQUESTED_KG_INVALID" ||
            r.error.code === "REQUESTED_KG_REQUIRED",
        )
      }
    }
  })

  it("accepts requestedKg as a numeric string (the modal type='number' value is a string)", () => {
    const r = validateContractRequestInput({
      greenLotId: "lot-1",
      requestedKg: "1850",
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value.requestedKg, 1850)
  })

  it("rounds fractional kilograms to the nearest integer", () => {
    const r = validateContractRequestInput({
      greenLotId: "lot-1",
      requestedKg: 199.7,
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value.requestedKg, 200)
  })

  it("rejects requestedKg above the cap", () => {
    const r = validateContractRequestInput({
      greenLotId: "lot-1",
      requestedKg: MAX_MONTHLY_ROASTED_KG + 1,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "REQUESTED_KG_TOO_LARGE")
  })

  it("accepts each duration option", () => {
    for (const d of ALLOWED_DURATION_MONTHS) {
      const r = validateContractRequestInput({
        greenLotId: "lot-1",
        requestedKg: 200,
        durationMonths: d,
      })
      assert.equal(r.ok, true)
      if (r.ok) assert.equal(r.value.durationMonths, d)
    }
  })

  it("rejects a duration outside the allowed set", () => {
    const r = validateContractRequestInput({
      greenLotId: "lot-1",
      requestedKg: 200,
      durationMonths: 5,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "DURATION_INVALID")
  })

  it("defaults the duration when omitted", () => {
    const r = validateContractRequestInput({
      greenLotId: "lot-1",
      requestedKg: 200,
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.value.durationMonths, getDefaultContractRequestDurationMonths())
    }
  })

  it("does not expose technical terms in error messages", () => {
    const cases = [
      { greenLotId: "", requestedKg: 1 },
      { greenLotId: "lot-1", requestedKg: 0 },
      { greenLotId: "lot-1", requestedKg: MAX_MONTHLY_ROASTED_KG + 1 },
      { greenLotId: "lot-1", requestedKg: 200, durationMonths: 5 },
    ]
    for (const c of cases) {
      const r = validateContractRequestInput(c)
      assert.equal(r.ok, false)
      if (!r.ok) {
        assert.doesNotMatch(r.error.message, /green|deltaKg|semaphore|roasted|greenLotId|OPEN|COUNTERED|REJECTED|WAITING/i)
      }
    }
  })
})

// ------------------------------------------------------
// hasPendingRequestForLot
// ------------------------------------------------------

describe("hasPendingRequestForLot", () => {

  const open    = { status: "OPEN",       greenLotId: "L1" }
  const counter = { status: "COUNTERED",  greenLotId: "L1" }
  const wait    = { status: "WAITING",    greenLotId: "L1" }
  const closed  = { status: "CONSUMED",   greenLotId: "L1" }
  const cancel  = { status: "CANCELLED",  greenLotId: "L1" }
  const expired = { status: "EXPIRED",    greenLotId: "L1" }
  const rejected= { status: "REJECTED",   greenLotId: "L1" }
  const other   = { status: "OPEN",       greenLotId: "OTHER" }

  it("detects OPEN intents", () => {
    assert.equal(hasPendingRequestForLot([open], "L1"), true)
  })

  it("detects COUNTERED intents", () => {
    assert.equal(hasPendingRequestForLot([counter], "L1"), true)
  })

  it("detects WAITING intents", () => {
    assert.equal(hasPendingRequestForLot([wait], "L1"), true)
  })

  it("ignores CANCELLED / CONSUMED / EXPIRED / REJECTED", () => {
    assert.equal(hasPendingRequestForLot([cancel, closed, expired, rejected], "L1"), false)
  })

  it("ignores intents on other lots", () => {
    assert.equal(hasPendingRequestForLot([other], "L1"), false)
  })

  it("is case-insensitive on the status value", () => {
    assert.equal(hasPendingRequestForLot([{ status: "open", greenLotId: "L1" }], "L1"), true)
  })

  it("handles a null / empty greenLotId argument", () => {
    assert.equal(hasPendingRequestForLot([open], ""), false)
    assert.equal(hasPendingRequestForLot([open], null), false)
  })

  it("handles a null / empty intent list", () => {
    assert.equal(hasPendingRequestForLot([], "L1"), false)
    assert.equal(hasPendingRequestForLot(null, "L1"), false)
  })
})

// ------------------------------------------------------
// formatDemandIntentOutcome
// ------------------------------------------------------

describe("formatDemandIntentOutcome", () => {

  it("maps green semaphore + OPEN status to approved", () => {
    const r = formatDemandIntentOutcome({
      intent: { id: "i1", status: "OPEN" },
      semaphore: { status: "green" },
    })
    assert.ok(r)
    if (r) {
      assert.equal(r.kind, "approved")
      assert.equal(r.tone, "success")
      assert.equal(r.cta, "CONTINUE_TO_CONTRACT")
    }
  })

  it("maps yellow semaphore to counter with offeredKg", () => {
    const r = formatDemandIntentOutcome({
      intent: { id: "i1", status: "COUNTERED", offeredKg: 187.5 },
      semaphore: { status: "yellow" },
    })
    assert.ok(r)
    if (r && r.kind === "counter") {
      assert.equal(r.tone, "warning")
      assert.equal(r.offeredKg, 188)
      assert.match(r.headline, /188/)
      assert.equal(r.cta, "ACCEPT_OR_CANCEL")
    } else {
      assert.fail("Expected counter outcome")
    }
  })

  it("maps red semaphore to rejected with waitlist CTA", () => {
    const r = formatDemandIntentOutcome({
      intent: { id: "i1", status: "REJECTED" },
      semaphore: { status: "red" },
    })
    assert.ok(r)
    if (r) {
      assert.equal(r.kind, "rejected")
      assert.equal(r.cta, "JOIN_WAITLIST")
    }
  })

  it("never leaks technical semaphore names in headlines", () => {
    const outcomes = [
      formatDemandIntentOutcome({ intent: { id: "1", status: "OPEN" }, semaphore: { status: "green" } }),
      formatDemandIntentOutcome({ intent: { id: "1", status: "COUNTERED", offeredKg: 100 }, semaphore: { status: "yellow" } }),
      formatDemandIntentOutcome({ intent: { id: "1", status: "REJECTED" }, semaphore: { status: "red" } }),
    ]
    for (const o of outcomes) {
      assert.ok(o)
      if (o) {
        assert.doesNotMatch(o.headline, /green|yellow|red|semaphore|OPEN|COUNTERED|REJECTED|deltaKg/i)
      }
    }
  })

  it("returns null on a malformed payload", () => {
    assert.equal(
      formatDemandIntentOutcome({ intent: { id: "" }, semaphore: null }),
      null,
    )
  })
})

// ------------------------------------------------------
// CONTRACT-REQUEST-3 — duration helper
// ------------------------------------------------------

describe("validateContractRequestDuration", () => {

  for (const d of ALLOWED_DURATION_MONTHS) {
    it(`accepts duration ${d}`, () => {
      const r = validateContractRequestDuration(d)
      assert.equal(r.ok, true)
      if (r.ok) assert.equal(r.value, d)
    })
  }

  it("accepts numeric-string duration", () => {
    const r = validateContractRequestDuration("12")
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value, 12)
  })

  it("rejects 5 with DURATION_INVALID", () => {
    const r = validateContractRequestDuration(5)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "DURATION_INVALID")
  })

  it("rejects non-numeric strings", () => {
    const r = validateContractRequestDuration("six")
    assert.equal(r.ok, false)
  })

  it("falls back to the default when undefined / null", () => {
    const expected = getDefaultContractRequestDurationMonths()
    assert.deepEqual(validateContractRequestDuration(undefined), { ok: true, value: expected })
    assert.deepEqual(validateContractRequestDuration(null), { ok: true, value: expected })
  })

  it("never leaks technical terms in messages", () => {
    const r = validateContractRequestDuration(5)
    if (!r.ok) {
      assert.doesNotMatch(r.error.message, /enum|semaphore|prisma/i)
    }
  })
})

// ------------------------------------------------------
// CONTRACT-REQUEST-3 — start-date helper
// ------------------------------------------------------

describe("validateContractRequestStartDate", () => {

  // Anchor "now" so the test is deterministic year over year.
  // 2026-05-15 is mid-month, gives us a clean current-month
  // boundary for the past/future checks.
  const NOW = new Date("2026-05-15T12:00:00Z")

  it("returns null when value is undefined / null / empty", () => {
    assert.deepEqual(validateContractRequestStartDate(undefined, NOW), {
      ok: true,
      value: null,
    })
    assert.deepEqual(validateContractRequestStartDate(null, NOW), {
      ok: true,
      value: null,
    })
    assert.deepEqual(validateContractRequestStartDate("", NOW), {
      ok: true,
      value: null,
    })
    assert.deepEqual(validateContractRequestStartDate("   ", NOW), {
      ok: true,
      value: null,
    })
  })

  it("parses YYYY-MM to the first of that month (UTC)", () => {
    const r = validateContractRequestStartDate("2026-07", NOW)
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.value?.toISOString(), "2026-07-01T00:00:00.000Z")
    }
  })

  it("parses YYYY-MM-DD and normalises to first of month", () => {
    const r = validateContractRequestStartDate("2026-07-15", NOW)
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.value?.toISOString(), "2026-07-01T00:00:00.000Z")
    }
  })

  it("accepts the current month", () => {
    const r = validateContractRequestStartDate("2026-05", NOW)
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.value?.toISOString(), "2026-05-01T00:00:00.000Z")
    }
  })

  it("rejects months strictly in the past", () => {
    const r = validateContractRequestStartDate("2026-04", NOW)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "START_DATE_TOO_OLD")
  })

  it(`rejects months beyond ${CONTRACT_REQUEST_MAX_FUTURE_MONTHS} months ahead`, () => {
    // 2026-05 + 25 months → 2028-06
    const r = validateContractRequestStartDate("2028-06", NOW)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "START_DATE_TOO_FAR")
  })

  it("accepts the inclusive max future month", () => {
    // 2026-05 + 24 months → 2028-05
    const r = validateContractRequestStartDate("2028-05", NOW)
    assert.equal(r.ok, true)
  })

  it("rejects malformed strings", () => {
    const r = validateContractRequestStartDate("nope", NOW)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "START_DATE_INVALID")
  })

  it("accepts a Date instance (and normalises)", () => {
    const r = validateContractRequestStartDate(
      new Date("2026-07-20T10:00:00Z"),
      NOW,
    )
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.value?.toISOString(), "2026-07-01T00:00:00.000Z")
    }
  })

  it("rejects an invalid Date", () => {
    const r = validateContractRequestStartDate(new Date("not a date"), NOW)
    assert.equal(r.ok, false)
  })

  it("does not mutate its input", () => {
    const input = new Date("2026-07-20T10:00:00Z")
    const before = input.toISOString()
    validateContractRequestStartDate(input, NOW)
    assert.equal(input.toISOString(), before)
  })
})

// ------------------------------------------------------
// CONTRACT-REQUEST-3 — validateContractRequestInput w/ start date
// ------------------------------------------------------

describe("validateContractRequestInput — CONTRACT-REQUEST-3", () => {

  const NOW = new Date("2026-05-15T12:00:00Z")

  it("returns requestedStartDate=null when modal omits it", () => {
    const r = validateContractRequestInput(
      { greenLotId: "lot-1", requestedKg: 250, durationMonths: 6 },
      NOW,
    )
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value.requestedStartDate, null)
  })

  it("carries a parsed YYYY-MM through", () => {
    const r = validateContractRequestInput(
      {
        greenLotId: "lot-1",
        requestedKg: 250,
        durationMonths: 6,
        requestedStartDate: "2026-07",
      },
      NOW,
    )
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(
        r.value.requestedStartDate?.toISOString(),
        "2026-07-01T00:00:00.000Z",
      )
    }
  })

  it("rejects past start dates with START_DATE_TOO_OLD", () => {
    const r = validateContractRequestInput(
      {
        greenLotId: "lot-1",
        requestedKg: 250,
        requestedStartDate: "2026-01",
      },
      NOW,
    )
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, "START_DATE_TOO_OLD")
  })

  it("does not mutate the input", () => {
    const input = {
      greenLotId: "lot-1",
      requestedKg: 250,
      durationMonths: 6,
      requestedStartDate: "2026-07",
    }
    const before = JSON.stringify(input)
    validateContractRequestInput(input, NOW)
    assert.equal(JSON.stringify(input), before)
  })
})

// ------------------------------------------------------
// CONTRACT-REQUEST-3 — sanitiseContractRequestCreateInput
// ------------------------------------------------------

describe("sanitiseContractRequestCreateInput", () => {

  const NOW = new Date("2026-05-15T12:00:00Z")

  it("is a thin alias of validateContractRequestInput", () => {
    const input = {
      greenLotId: "lot-1",
      requestedKg: 250,
      durationMonths: 12,
      requestedStartDate: "2026-08",
    }
    const a = validateContractRequestInput(input, NOW)
    const b = sanitiseContractRequestCreateInput(input, NOW)
    assert.deepEqual(a, b)
  })
})
