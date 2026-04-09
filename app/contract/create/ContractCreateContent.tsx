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
    greenLotId: string | null
    lotName: string | null
    farmName: string | null
    pricePerKg: number | null
  }

  demandIntentId: string | null
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

  const intentId = searchParams.get("intentId")

  // When intentId is present, start in a loading state (step 0)
  // to prevent rendering step 3 from stale volumeParam before
  // the intent fetch resolves.
  const [step, setStep] = useState(
    intentId ? 0 : (volumeParam ? 3 : 1)
  )

  const [intentError, setIntentError] = useState<string | null>(null)
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
      duration: 9,
      greenLotId: null,
      lotName: null,
      farmName: null,
      pricePerKg: null,
    },

    demandIntentId: intentId,
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
  // FETCH DEMAND INTENT (if intentId in URL)
  // Populates draft with lot info, volume, pricing.
  // =====================================================

  useEffect(() => {

    if (!intentId) {
      // Fallback: apply volumeParam directly (no intent)
      if (volumeParam) {
        setDraft(prev => ({
          ...prev,
          supply: { ...prev.supply, monthlyVolume: Number(volumeParam) }
        }))
        setStep(3)
      }
      return
    }

    const fetchIntent = async () => {
      try {
        const res = await fetch(`/api/demand-intent/${intentId}`)

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setIntentError(data.error ?? "Failed to load contract request")
          return
        }

        const data = await res.json()
        const intent = data.intent

        // -------------------------------------------------
        // STATUS GATING — only OPEN intents proceed
        // -------------------------------------------------

        if (intent.status !== "OPEN") {
          const messages: Record<string, string> = {
            COUNTERED: "This request received a counteroffer. Please respond in the trading panel before proceeding.",
            WAITING: "This request is waiting for supply. You will be notified when it becomes available.",
            CONSUMED: "This request has already been used to create a contract.",
            EXPIRED: "This request has expired. Please create a new request from the trading panel.",
            REJECTED: "This request was rejected due to insufficient supply.",
            CANCELLED: "This request was cancelled.",
          }
          setIntentError(messages[intent.status] ?? `Request status is ${intent.status} — cannot proceed.`)
          return
        }

        // -------------------------------------------------
        // EXPIRY CHECK — intent must not be past expiresAt
        // -------------------------------------------------

        if (intent.expiresAt && new Date(intent.expiresAt) <= new Date()) {
          setIntentError("This request has expired. Please create a new request from the trading panel.")
          return
        }

        // -------------------------------------------------
        // VALID — populate draft and proceed to step 3
        // -------------------------------------------------

        setDraft(prev => ({
          ...prev,
          supply: {
            ...prev.supply,
            monthlyVolume: intent.requestedKg,
            greenLotId: intent.greenLotId,
            lotName: intent.greenLot?.name ?? intent.greenLot?.variety ?? null,
            farmName: intent.greenLot?.farm?.name ?? null,
            origin: intent.greenLot?.farm?.region ?? prev.supply.origin,
            pricePerKg: intent.previewPricePerKg ?? null,
          },
          demandIntentId: intentId,
        }))

        setStep(3)
      } catch (err) {
        console.error("Intent fetch error:", err)
        setIntentError("Failed to load contract request. Please try again.")
      }
    }

    fetchIntent()

  }, [intentId])

  // =====================================================
  // LOAD CONTRACT
  // =====================================================

  useEffect(() => {

    if (mode === "amend" && contractId) {

      const load = async () => {
        const mod = await import("@/src/clientLayer/layer/contractController")
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

        {step === 0 && !intentError && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.6 }}>
            Loading contract request...
          </div>
        )}

        {intentError && (
          <div style={{
            padding: 24,
            borderRadius: 12,
            border: "1px solid #e0e0e0",
            background: "#fafafa",
          }}>
            <div style={{ fontSize: 15, marginBottom: 12 }}>
              {intentError}
            </div>
            <a
              href="/platform"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                borderRadius: 8,
                background: "#000",
                color: "#fff",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Back to Platform
            </a>
          </div>
        )}

        {step === 1 && !intentError && (
          <Step1Client
            client={draft.client}
            onNext={updateClient}
          />
        )}

        {step === 2 && !intentError && (
          <Step2Supply
            supply={draft.supply}
            onNext={updateSupply}
          />
        )}

        {step === 3 && !intentError && (
          <Step3Preview
            draft={draft}
          />
        )}

      </div>

    </div>
  )
}