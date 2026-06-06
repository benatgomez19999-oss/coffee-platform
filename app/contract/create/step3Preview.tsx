"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import {
  generateContractPDF
} from "@/src/clientLayer/layer/contractPDFGenerator"

import {
  getSelectedContract
} from "@/src/clientLayer/layer/contractController"


// =====================================================
// TYPES
// =====================================================

type Draft = {
  client: {
    country: string
    businessName: string
    legalCompanyName: string
    vat: string
    address: string
    contactName: string
    email: string
    phone: string
  }
  supply: {
    origin: string
    monthlyVolume: number
    duration: number
    greenLotId: string | null
    lotName: string | null
    farmName: string | null
    pricePerKg: number | null
  }
  demandIntentId: string | null
}

type Props = {
  draft: Draft
}


// CONTRACT-REQUEST-2 — shape returned by /api/contracts/create
// (HTTP 409) when the lot's B2B price diverged upward since the
// buyer's DemandIntent. The wizard blocks signature when this is set.
type PriceDriftBlock = {
  previewPricePerKg: number | null
  currentPricePerKg: number | null
  message: string
}

function formatEurPerKg(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  return `€${value.toFixed(2)}/kg`
}

// =====================================================
// COMPONENT
// =====================================================

export default function Step3Preview({ draft }: Props) {

  const router = useRouter()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // CONTRACT-REQUEST-2 — when set, the signature CTA is replaced
  // by a blocking panel showing old vs new price.
  const [priceDrift, setPriceDrift] = useState<PriceDriftBlock | null>(null)

  const monthly = draft.supply.monthlyVolume
  const duration = draft.supply.duration


  // =====================================================
  // GENERATE PDF
  // =====================================================

  useEffect(() => {
    async function buildPDF() {
      try {
        const url = await generateContractPDF({
          version: 1,
          product: draft.supply.origin,
          monthlyVolumeKg: monthly,
          durationMonths: duration,
          lotName: draft.supply.lotName ?? undefined,
          farmName: draft.supply.farmName ?? undefined,
          pricePerKg: draft.supply.pricePerKg ?? undefined,
        })

        setPdfUrl(url)
      } catch (err) {
        console.error("PDF ERROR:", err)
      }
    }

    buildPDF()
  }, [monthly, duration, draft.supply.origin, draft.supply.lotName, draft.supply.farmName, draft.supply.pricePerKg])


  // =====================================================
  // SIGN CONTRACT → OTP FLOW
  // =====================================================

 async function signContract() {

  if (loading) return
  setLoading(true)

  try {

    const phone = draft.client.phone?.trim()

    if (!draft.client.email?.trim()) {
      alert("Email is required before signing")
      setLoading(false)
      return
    }

    if (!phone) {
      alert("Please enter a phone number before signing")
      setLoading(false)
      return
    }

    const selectedContract = getSelectedContract()


    // =====================================================
    // AMEND EXISTING CONTRACT
    //
    // No contract mutation here. The amend is a proposal:
    // 1. Send OTP with demandIntentId + contractId
    // 2. verify-otp gates final apply behind OTP
    // 3. Only after OTP: amendContractWithSupplyValidation
    //    + intent consumption + status → SIGNED
    // =====================================================

    if (selectedContract) {

      if (!draft.demandIntentId) {
        alert("No demand intent — cannot amend without a validated request")
        setLoading(false)
        return
      }

      await fetch("/api/contracts/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "amend",
          contractId: selectedContract.id,
          contractDraft: {
            client: {
              email: draft.client.email,
              phone: draft.client.phone,
            },
            demandIntentId: draft.demandIntentId,
          }
        })
      })

      router.replace(`/contract/verify-otp?contractId=${selectedContract.id}`)
      return
    }


    // =====================================================
    // NEW CONTRACT
    // 1. CREATE CONTRACT (with greenLotId + intentId)
    // 2. SEND OTP
    // 3. REDIRECT
    // =====================================================

    if (!draft.supply.greenLotId) {
      alert("No coffee lot selected — cannot create contract")
      setLoading(false)
      return
    }

    const createRes = await fetch("/api/contracts/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractDraft: {
          ...draft,
          supply: {
            ...draft.supply,
            greenLotId: draft.supply.greenLotId,
          },
          demandIntentId: draft.demandIntentId,
        }
      })
    })

    const createData = await createRes.json()

    if (!createData.success || !createData.contractId) {
      // CONTRACT-REQUEST-2 — special-case the price drift block.
      // No alert, no implicit retry — the wizard renders a panel
      // with old vs new price and routes the buyer back.
      if (createData?.code === "PRICE_DRIFT_REQUIRES_REVIEW") {
        setPriceDrift({
          previewPricePerKg:
            typeof createData.previewPricePerKg === "number"
              ? createData.previewPricePerKg
              : null,
          currentPricePerKg:
            typeof createData.currentPricePerKg === "number"
              ? createData.currentPricePerKg
              : null,
          message:
            typeof createData.error === "string" && createData.error.trim() !== ""
              ? createData.error
              : "This lot's price changed since your request. Please review the updated price before continuing.",
        })
        setLoading(false)
        return
      }
      const msg = createData.error ?? "Failed to create contract"
      alert(msg)
      setLoading(false)
      return
    }

    const contractId = createData.contractId

    // SEND OTP

    await fetch("/api/contracts/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "create",
        contractId,
        contractDraft: draft
      })
    })

    // REDIRECT TO OTP VERIFICATION

    router.replace(`/contract/verify-otp?contractId=${contractId}`)

  } catch (err) {

    console.error("SIGN CONTRACT ERROR:", err)
    alert("Error during signing process")
    setLoading(false)

  }

}

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div>

      <h2 style={{ marginBottom: 16 }}>Contract Preview</h2>

      {/* INTENT SUMMARY */}

      {draft.supply.greenLotId && (
        <div style={{
          padding: 16,
          borderRadius: 10,
          border: "1px solid #e0e0e0",
          marginBottom: 20,
          background: "#fafafa",
        }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
            CONTRACT DETAILS
          </div>
          <div style={{ fontSize: 14 }}>
            {draft.supply.lotName ?? "Coffee Lot"} — {draft.supply.farmName ?? draft.supply.origin}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: "#555" }}>
            {monthly} kg/month for {duration} months
            {draft.supply.pricePerKg != null && (
              <> · ${draft.supply.pricePerKg}/kg</>
            )}
          </div>
        </div>
      )}

      {pdfUrl && (
        <iframe
          src={pdfUrl}
          style={{
            width: "100%",
            height: "400px",
            border: "1px solid #ddd",
            marginBottom: 20
          }}
        />
      )}

      {/* CONTRACT-REQUEST-2 — PRICE DRIFT BLOCKING PANEL */}
      {priceDrift && (
        <div
          style={{
            padding: 18,
            borderRadius: 12,
            border: "1px solid #b45309",
            background: "#fff7ed",
            color: "#7c2d12",
            marginBottom: 20,
          }}
          role="alert"
        >
          <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.7 }}>
            Price changed
          </div>
          <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5 }}>
            {priceDrift.message}
          </p>
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              fontSize: 13,
            }}
          >
            <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(124,45,18,0.18)" }}>
              <div style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.65 }}>
                Your request
              </div>
              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 600 }}>
                {formatEurPerKg(priceDrift.previewPricePerKg)}
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(124,45,18,0.18)" }}>
              <div style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.65 }}>
                Current price
              </div>
              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 600 }}>
                {formatEurPerKg(priceDrift.currentPricePerKg)}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => router.push("/platform/client")}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                background: "#7c2d12",
                color: "#fff",
                border: "1px solid #7c2d12",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Return to dashboard
            </button>
            <button
              type="button"
              onClick={() => setPriceDrift(null)}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                background: "transparent",
                color: "#7c2d12",
                border: "1px solid #7c2d12",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <button
        onClick={signContract}
        disabled={loading || priceDrift != null}
        style={{
          padding: "12px 20px",
          background: loading || priceDrift != null ? "#888" : "#000",
          color: "#fff",
          borderRadius: 8,
          cursor: loading || priceDrift != null ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Sending OTP..." : "Sign Contract"}
      </button>

    </div>
  )
}
