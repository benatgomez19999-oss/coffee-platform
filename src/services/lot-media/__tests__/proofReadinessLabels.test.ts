//////////////////////////////////////////////////////
// 🧪 PRODUCER-PROOF-POLISH — label helper tests
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildProofCtaHref,
  formatProofBadge,
  formatProofMissingDetail,
  formatProofMissingLabel,
} from "../proofReadinessLabels.pure.ts"

// ------------------------------------------------------
// formatProofMissingLabel
// ------------------------------------------------------

describe("formatProofMissingLabel", () => {

  it("maps TRACEABILITY_PROOF to a human label", () => {
    assert.equal(
      formatProofMissingLabel("TRACEABILITY_PROOF"),
      "Private traceability proof",
    )
  })

  it("maps CERTIFICATE", () => {
    assert.equal(formatProofMissingLabel("CERTIFICATE"), "Quality certificate")
  })

  it("maps FINAL_BAG_PHOTO", () => {
    assert.equal(
      formatProofMissingLabel("FINAL_BAG_PHOTO"),
      "Final bag / label photo",
    )
  })

  it("falls back safely for unknown codes", () => {
    assert.equal(formatProofMissingLabel("WHATEVER"), "Required proof")
  })

  it("never leaks raw enum-style names", () => {
    const sample = ["TRACEABILITY_PROOF", "CERTIFICATE", "UNKNOWN", "FINAL_BAG_PHOTO"]
    for (const code of sample) {
      const out = formatProofMissingLabel(code)
      assert.ok(!/[A-Z]{2,}_[A-Z]/.test(out), `Label leaks enum: "${out}"`)
      assert.ok(!/supabase|bucket/i.test(out), `Label leaks storage term: "${out}"`)
    }
  })

  it("handles non-string input", () => {
    assert.equal(formatProofMissingLabel(undefined), "Required proof")
    assert.equal(formatProofMissingLabel(null), "Required proof")
    assert.equal(formatProofMissingLabel(42), "Required proof")
  })
})

// ------------------------------------------------------
// formatProofBadge
// ------------------------------------------------------

describe("formatProofBadge", () => {

  it("proofReady true → ok badge with 'Proof ready'", () => {
    assert.deepEqual(
      formatProofBadge({ proofReady: true, proofMissing: [] }),
      { tone: "ok", label: "Proof ready" },
    )
  })

  it("proofReady false → warning badge with 'Proof missing'", () => {
    assert.deepEqual(
      formatProofBadge({ proofReady: false, proofMissing: ["TRACEABILITY_PROOF"] }),
      { tone: "warning", label: "Proof missing" },
    )
  })

  it("missing proofReady defaults to warning (never falsely OK)", () => {
    assert.equal(formatProofBadge({}).tone, "warning")
    assert.equal(formatProofBadge({ proofReady: null }).tone, "warning")
    assert.equal(formatProofBadge({ proofReady: undefined }).tone, "warning")
  })

  it("labels never include enum names", () => {
    for (const ready of [true, false, undefined]) {
      const b = formatProofBadge({ proofReady: ready })
      assert.ok(!/[A-Z]{2,}_[A-Z]/.test(b.label))
      assert.ok(!/supabase|bucket/i.test(b.label))
    }
  })
})

// ------------------------------------------------------
// formatProofMissingDetail
// ------------------------------------------------------

describe("formatProofMissingDetail", () => {

  it("falls back to a generic prompt when nothing is supplied", () => {
    assert.match(formatProofMissingDetail(null), /private traceability/i)
    assert.match(formatProofMissingDetail(undefined), /private traceability/i)
    assert.match(formatProofMissingDetail([]), /private traceability/i)
  })

  it("renders a single missing item without conjunction", () => {
    const out = formatProofMissingDetail(["TRACEABILITY_PROOF"])
    assert.equal(out, "Missing: Private traceability proof.")
  })

  it("renders two missing items with 'and'", () => {
    const out = formatProofMissingDetail(["TRACEABILITY_PROOF", "CERTIFICATE"])
    assert.equal(out, "Missing: Private traceability proof and Quality certificate.")
  })

  it("oxford-commas three or more items", () => {
    const out = formatProofMissingDetail([
      "TRACEABILITY_PROOF",
      "CERTIFICATE",
      "FINAL_BAG_PHOTO",
    ])
    assert.equal(
      out,
      "Missing: Private traceability proof, Quality certificate, and Final bag / label photo.",
    )
  })

  it("does not leak raw codes for unknown values", () => {
    const out = formatProofMissingDetail(["WEIRD_CODE"])
    assert.ok(!out.includes("WEIRD_CODE"))
    assert.match(out, /required proof/i)
  })
})

// ------------------------------------------------------
// buildProofCtaHref
// ------------------------------------------------------

describe("buildProofCtaHref", () => {

  it("defaults to the partner media route when no params are supplied", () => {
    assert.equal(buildProofCtaHref({}), "/platform/partner/media")
  })

  it("includes lotId + focus when provided", () => {
    assert.equal(
      buildProofCtaHref({ lotId: "lot-123", focus: "private-proof" }),
      "/platform/partner/media?lotId=lot-123&focus=private-proof",
    )
  })

  it("includes farmId + lotId + focus together", () => {
    assert.equal(
      buildProofCtaHref({
        farmId: "farm-9",
        lotId: "lot-1",
        focus: "private-proof",
      }),
      "/platform/partner/media?lotId=lot-1&farmId=farm-9&focus=private-proof",
    )
  })

  it("ignores empty / whitespace ids", () => {
    assert.equal(
      buildProofCtaHref({ lotId: "   ", farmId: "" , focus: "private-proof" }),
      "/platform/partner/media?focus=private-proof",
    )
  })

  it("passes the public-listing focus", () => {
    assert.equal(
      buildProofCtaHref({ focus: "public-listing" }),
      "/platform/partner/media?focus=public-listing",
    )
  })

  it("honours basePath override (producer surface)", () => {
    assert.equal(
      buildProofCtaHref({
        lotId: "lot-1",
        focus: "private-proof",
        basePath: "/platform/producer/media",
      }),
      "/platform/producer/media?lotId=lot-1&focus=private-proof",
    )
  })

  it("falls back to partner default when basePath is whitespace", () => {
    assert.equal(
      buildProofCtaHref({ lotId: "lot-1", basePath: "   " }),
      "/platform/partner/media?lotId=lot-1",
    )
  })
})
