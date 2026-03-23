"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import {
  generateContractPDF
} from "@/clientLayer/layer/contractPDFGenerator"

import {
  getSelectedContract
} from "@/clientLayer/layer/contractController"


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
  }
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
          durationMonths: duration
        })

        setPdfUrl(url)
      } catch (err) {
        console.error("🔥 PDF ERROR:", err)
      }
    }

    buildPDF()
  }, [monthly, duration, draft.supply.origin])


  // =====================================================
  // SIGN CONTRACT → OTP FLOW (FIXED ARCHITECTURE)
  // =====================================================

  async function signContract() {

    if (loading) return
    setLoading(true)

    try {

      const phone = draft.client.phone?.trim()

// =====================================================
// DEBUG + VALIDATION (CRITICAL FOR EMAIL FLOW)
// =====================================================

console.log("📤 SENDING DRAFT:", draft)

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

      if (!phone) {
        alert("Please enter a phone number before signing")
        setLoading(false)
        return
      }

      const selectedContract = getSelectedContract()


      // =====================================================
      // 🟡 AMEND EXISTING CONTRACT
      // → ya existe contractId
      // → solo enviamos OTP
      // =====================================================

      if (selectedContract) {

        await fetch("/api/contracts/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "amend",
            contractId: selectedContract.id,
            contractDraft: draft
          })
        })

        // ✅ REDIRECT A OTP PAGE (NO MÁS PLATFORM HACK)
        router.replace(`/contract/verify-otp?contractId=${selectedContract.id}`)
        return
      }


      // =====================================================
      // 🟢 NEW CONTRACT (FIXED)
      // → 1. crear contrato en DB
      // → 2. enviar OTP ligado al contractId
      // → 3. redirect a verify page
      // =====================================================

      // -----------------------------------------------
      // 1. CREATE CONTRACT
      // -----------------------------------------------

      const createRes = await fetch("/api/contracts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractDraft: draft
        })
      })

      const createData = await createRes.json()

      if (!createData.success) {
        throw new Error("Failed to create contract")
      }

      const contractId = createData.contractId


      // -----------------------------------------------
     // 2. SEND OTP (FIXED: include draft for email)
    // -----------------------------------------------

  await fetch("/api/contracts/send-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mode: "create",
    contractId,
    contractDraft: draft // 🔥 CLAVE PARA EMAIL
  })
})


      // -----------------------------------------------
      // 3. REDIRECT TO OTP PAGE
      // -----------------------------------------------

      router.replace(`/contract/verify-otp?contractId=${contractId}`)


    } catch (err) {

      console.error("🔥 SIGN CONTRACT ERROR:", err)
      alert("Error during signing process")
      setLoading(false)

    }

  }


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div>

      <h2>Contract Preview</h2>

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