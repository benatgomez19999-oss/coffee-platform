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


// =====================================================
// COMPONENT
// =====================================================

export default function Step3Preview({ draft }: Props) {

  const router = useRouter()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

      <button
        onClick={signContract}
        disabled={loading}
        style={{
          padding: "12px 20px",
          background: loading ? "#888" : "#000",
          color: "#fff",
          borderRadius: 8,
          cursor: loading ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Sending OTP..." : "Sign Contract"}
      </button>

    </div>
  )
}
