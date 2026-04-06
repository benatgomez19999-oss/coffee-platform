"use client"

import { useState } from "react"

// =====================================================
// TYPES
// =====================================================

type Props = {
  onComplete: () => void
  role: "BUYER" | "PRODUCER"
}

type FormState = {
  country: string
  phone: string
  address: string
  vat: string
  contactName: string
}

// =====================================================
// COMPONENT
// =====================================================

export default function OnboardingWizard({ onComplete, role }: Props) {

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  

  const [form, setForm] = useState<FormState>({
    country: "",
    phone: "",
    address: "",
    vat: "",
    contactName: ""
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  // =====================================================
  // VALIDATION
  // =====================================================

  const validateStep1 = () => {
    if (!form.country || !form.contactName) {
      setError("Please fill required fields")
      return false
    }
    return true
  }

  const handleNext = () => {
    setError("")
    if (validateStep1()) {
      setStep(2)
    }
  }

  const handleBack = () => {
    setError("")
    setStep(1)
  }

//////////////////////////////////////////////////////
// SUBMIT
//////////////////////////////////////////////////////

const handleSubmit = async () => {
  setLoading(true)
  setError("")

  try {
    console.log("FORM SUBMIT:", form)

    //////////////////////////////////////////////////////
    // 🧠 SELECT ENDPOINT SEGÚN ROLE
    //////////////////////////////////////////////////////

    const endpoint =
      role === "PRODUCER"
        ? "/api/onboarding/producer"
        : "/api/company/update"

    //////////////////////////////////////////////////////
    // 🚀 REQUEST
    //////////////////////////////////////////////////////

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(form)
    })

    //////////////////////////////////////////////////////
    // ❌ ERROR HANDLING
    //////////////////////////////////////////////////////

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      console.error("❌ SUBMIT ERROR:", data)

      setError(data?.error || "Failed to save data")
      return
    }

    //////////////////////////////////////////////////////
    // ✅ SUCCESS
    //////////////////////////////////////////////////////

    console.log("✅ SUCCESS")

    onComplete() // 🔥 CLAVE

  } catch (err) {
    console.error("❌ NETWORK ERROR:", err)
    setError("Network error")
  } finally {
    setLoading(false)
  }
}

  return (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">

    <div className="bg-neutral-900 p-8 rounded-2xl w-full max-w-lg border border-white/10 shadow-2xl">

      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl text-white font-light">
          Setup your company
        </h2>

        {/* PROGRESS BAR */}
        <div className="mt-3 h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-300"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>
      </div>

      {/* FORM */}
      <div className="flex flex-col gap-3">

        {step === 1 && (
          <>
            <input
              name="country"
              placeholder="Country"
              onChange={handleChange}
              className="p-3 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            />

            <input
              name="contactName"
              placeholder="Contact name"
              onChange={handleChange}
              className="p-3 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </>
        )}

        {step === 2 && (
          <>
            <input
              name="phone"
              placeholder="Phone"
              onChange={handleChange}
              className="p-3 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            />

            <input
              name="vat"
              placeholder="VAT / CIF"
              onChange={handleChange}
              className="p-3 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            />

            <input
              name="address"
              placeholder="Address"
              onChange={handleChange}
              className="p-3 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </>
        )}

      </div>

      {/* ERROR */}
      {error && (
        <p className="text-red-400 text-sm mt-4">
          {error}
        </p>
      )}

      {/* ACTIONS */}
      <div className="flex justify-between items-center mt-6">

        {step === 2 ? (
          <button
            onClick={() => setStep(1)}
            className="text-white/60 hover:text-white transition"
          >
            Back
          </button>
        ) : <div />}

        <button
          onClick={step === 1 ? () => setStep(2) : handleSubmit}
          disabled={loading}
          className="bg-white text-black px-5 py-2 rounded-lg hover:bg-neutral-200 transition flex items-center gap-2"
        >
          {loading ? (
            <div className="h-4 w-4 border border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            step === 1 ? "Next" : "Finish"
          )}
        </button>

      </div>

    </div>
  </div>
)
}