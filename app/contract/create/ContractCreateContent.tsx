"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"

import Step1Client from "./step1Client"
import Step2Supply from "./step2Supply"
import Step3Preview from "./step3Preview"

// =====================================================
// CONTRACT DRAFT
// =====================================================

export type ContractDraft = {
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

// =====================================================
// CONTRACT CREATE PAGE
// =====================================================

export default function ContractCreatePage() {

  const searchParams = useSearchParams()!

  const mode = searchParams.get("mode")
  const contractId = searchParams.get("contractId")

  const volumeParam = searchParams.get("volume")

  const initialVolume =
    volumeParam
      ? Number(volumeParam)
      : 400

  const [step, setStep] = useState(
    volumeParam ? 3 : 1
  )

  const [company, setCompany] = useState<any | null>(null)

  const [draft, setDraft] = useState<ContractDraft>({
    client: {
      country: "",
      businessName: "",
      legalCompanyName: "",
      vat: "",
      address: "",
      contactName: "",
      email: "",
      phone: ""
    },

    supply: {
      origin: "Brazil",
      monthlyVolume: initialVolume,
      duration: 9
    }
  })

  // =====================================================
  // 🔥 FETCH COMPANY (AUTOFILL BASE)
  // =====================================================

useEffect(() => {
  const fetchCompany = async () => {
    try {
      const res = await fetch("/api/company/me", {
        credentials: "include"
      })

      const userRes = await fetch("/api/auth/me", {
        credentials: "include"
      })

      let userEmail = ""

      if (userRes.ok) {
        const userData = await userRes.json()
        userEmail = userData.user?.email || ""
      }

      let companyData = null

      if (res.ok) {
        const data = await res.json()
        companyData = data.company
        setCompany(companyData)
      }

      // 💥 SIEMPRE PREFILL (aunque no haya company)
      setDraft(prev => ({
  ...prev,
  client: {
    ...prev.client,
    country: prev.client.country || companyData?.country || "",
    businessName: prev.client.businessName || companyData?.businessName || "",
    legalCompanyName: prev.client.legalCompanyName || companyData?.legalCompanyName || "", 

    vat: prev.client.vat || companyData?.vat || "",
    address: prev.client.address || companyData?.address || "",
    contactName: prev.client.contactName || companyData?.contactName || "",
    phone: prev.client.phone || companyData?.phone || "",
    email: prev.client.email !== "" ? prev.client.email : userEmail,
  }
}))

    } catch (err) {
      console.error(err)
    }
  }

  fetchCompany()
}, [])

  // =====================================================
  // APPLY VOLUME PARAM FROM SLIDER
  // =====================================================

  useEffect(() => {

    if (!volumeParam) return

    const volume = Number(volumeParam)

    setDraft(prev => ({
      ...prev,
      supply: {
        ...prev.supply,
        monthlyVolume: volume
      }
    }))

    setStep(3)

  }, [volumeParam])

  // =====================================================
  // LOAD CONTRACT
  // =====================================================

  useEffect(() => {

    if (mode === "amend" && contractId) {

      const load = async () => {
        const mod = await import("@/clientLayer/layer/contractController")
        mod.selectContract(contractId)
      }

      load()

    }

  }, [mode, contractId])

  // =====================================================
  // STEP HANDLERS
  // =====================================================

  function updateClient(data: ContractDraft["client"]) {
    setDraft(prev => ({
      ...prev,
      client: data
    }))

    setStep(2)
  }

  function updateSupply(data: ContractDraft["supply"]) {
    setDraft(prev => ({
      ...prev,
      supply: data
    }))

    setStep(3)
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40
      }}
    >

      <div
        style={{
          width: "900px",
          background: "#ffffff",
          color: "#000",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
        }}
      >

        <h1
          style={{
            fontSize: 26,
            marginBottom: 30
          }}
        >
          Coffee Supply Contract
        </h1>

        {step === 1 && (
          <Step1Client
            client={draft.client}
            onNext={updateClient}
          />
        )}

        {step === 2 && (
          <Step2Supply
            supply={draft.supply}
            onNext={updateSupply}
          />
        )}

        {step === 3 && (
          <Step3Preview
            draft={draft}
          />
        )}

      </div>

    </div>
  )
}