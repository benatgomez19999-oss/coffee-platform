"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import {
  generateContractPDF
} from "@/clientLayer/layer/contractPDFGenerator"

import {
  getSelectedContract
} from "@/clientLayer/layer/contractController"

import { registerEngineContract } from "@/engine/runtime"



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
  const total = monthly * duration


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
  console.error("🔥 SIGN CONTRACT ERROR:", err)
  setLoading(false) // 🔥 MUY IMPORTANTE
}
    }

    buildPDF()
  }, [monthly, duration, draft.supply.origin])


  // =====================================================
  // SIGN CONTRACT
  // =====================================================

  async function signContract() {
    if (loading) return
setLoading(true)

    console.log("🚀 SIGN CLICKED")

    try {

      // =====================================================
      // ✅ VALIDATE PHONE (CRÍTICO)
      // =====================================================

      const phone = draft.client.phone?.trim()

      if (!phone) {
        console.error("❌ PHONE MISSING — BLOCKING SIGN")
        alert("Please enter a phone number before signing")
        return
      }

      console.log("📱 PHONE OK:", phone)


      const selectedContract = getSelectedContract()


      // =====================================================
      // MODIFY EXISTING CONTRACT
      // =====================================================

      if (selectedContract) {

        console.log("🟡 AMENDING CONTRACT:", selectedContract.id)

        await fetch("/api/contracts/amend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractId: selectedContract.id,
            monthlyVolumeKg: monthly
          })
        })

        console.log("🟡 REQUEST SIGNATURE (existing)")

        const signRes = await fetch("/api/signature/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractId: selectedContract.id,
            phone
          })
        })

        const signData = await signRes.json()

        console.log("✅ SIGNATURE RESPONSE:", signData)

        router.replace("/platform?contract=awaiting_signature")
        return
      }


      // =====================================================
      // CREATE NEW CONTRACT
      // =====================================================

      const contract = {
        id: crypto.randomUUID(),
        product: draft.supply.origin,
        monthlyVolumeKg: monthly,
        durationMonths: duration,
        remainingMonths: duration,
        startDate: Date.now(),
        nextExecution: Date.now(),
        status: "pending_signature" as const
      }

      console.log("🟢 NEW CONTRACT:", contract)


      // =====================================================
      // REGISTER IN ENGINE
      // =====================================================

      registerEngineContract(contract)


      // =====================================================
      // CREATE CONTRACT (API)
      // =====================================================

     const createRes = await fetch("/api/contracts/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // 🔥 CLAVE PARA AUTH
  body: JSON.stringify({
    id: contract.id,
    monthlyVolumeKg: contract.monthlyVolumeKg,
    durationMonths: contract.durationMonths
  })
})

// 💣 VALIDACIÓN
if (!createRes.ok) {
  const err = await createRes.text()
  console.error("❌ CREATE FAILED:", err)
  throw new Error("Contract creation failed")
}

const createData = await createRes.json()

console.log("✅ CONTRACT CREATED:", createData)


      // =====================================================
      // REQUEST SIGNATURE
      // =====================================================

      console.log("🟡 REQUESTING SIGNATURE...")

      const signRes = await fetch("/api/signature/request", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // 🔥 REQUIRED FOR AUTH
  body: JSON.stringify({
    contractId: contract.id,
    phone
  })
})

    const text = await signRes.text()

console.log("🧪 RAW RESPONSE:", text)

let signData: any = null

try {
  signData = JSON.parse(text)
} catch {
  console.error("❌ INVALID JSON RESPONSE")
}

if (!signRes.ok) {
  console.error("❌ SIGNATURE FAILED:", signData)
  throw new Error(signData?.message || "Signature failed")
}

console.log("✅ SIGNATURE RESPONSE:", signData)


      // =====================================================
      // 👉 AQUÍ ESTÁ LA MAGIA (PRUEBA MÓVIL)
      // =====================================================

     if (signData?.signingLink) {
  window.location.href = signData.signingLink
  return
   }


      // =====================================================
      // REDIRECT DASHBOARD
      // =====================================================

      router.replace("/platform?contract=awaiting_signature")

    } catch (err) {

      console.error("🔥 SIGN CONTRACT ERROR:", err)

    }

    

  }


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="space-y-6 p-6 border rounded">

      <h2 className="text-lg font-semibold">
        Contract Preview
      </h2>

      <div className="space-y-1">
        <h3 className="font-medium">Client</h3>
        <p>{draft.client.businessName}</p>
        <p className="text-sm text-gray-600">
          {draft.client.country}
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-medium">Supply</h3>
        <p>Origin: {draft.supply.origin}</p>
        <p>Monthly Volume: {monthly} kg</p>
        <p>Duration: {duration} months</p>
      </div>

      <div className="text-lg font-semibold">
        Total Supply: {total} kg
      </div>

      {pdfUrl && (
        <iframe
          src={pdfUrl}
          style={{
            width: "100%",
            height: "600px",
            border: "1px solid #ccc",
            borderRadius: "6px"
          }}
        />
      )}

   <button
  onClick={signContract}
  disabled={loading}
  className="bg-black text-white px-6 py-2 rounded"
>
  {loading ? "Signing..." : "Sign Contract"}
</button>

    </div>
  )
}