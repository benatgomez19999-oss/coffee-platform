"use client"

import { useState } from "react"

// =====================================================
// TYPES
// =====================================================

type Props = {
  user: any
  onComplete: () => void
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

export default function OnboardingWizard({ onComplete }: Props) {

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

  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit = async () => {
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/company/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      })

      if (!res.ok) {
        setError("Failed to save data")
        return
      }

      onComplete()

    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">

      <div className="bg-neutral-900 p-8 rounded-xl w-full max-w-lg border border-white/10">

        {/* HEADER */}
        <div className="mb-6">
          <h2 className="text-xl text-white">
            Setup your company
          </h2>

          <p className="text-sm text-gray-400 mt-1">
            Step {step} of 2
          </p>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="flex flex-col gap-3">

            <input
              name="country"
              placeholder="Country *"
              onChange={handleChange}
              className="p-2 rounded bg-black border border-white/10 text-white"
            />

            <input
              name="contactName"
              placeholder="Contact name *"
              onChange={handleChange}
              className="p-2 rounded bg-black border border-white/10 text-white"
            />

          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="flex flex-col gap-3">

            <input
              name="phone"
              placeholder="Phone"
              onChange={handleChange}
              className="p-2 rounded bg-black border border-white/10 text-white"
            />

            <input
              name="vat"
              placeholder="VAT / CIF"
              onChange={handleChange}
              className="p-2 rounded bg-black border border-white/10 text-white"
            />

            <input
              name="address"
              placeholder="Address"
              onChange={handleChange}
              className="p-2 rounded bg-black border border-white/10 text-white"
            />

          </div>
        )}

        {/* ERROR */}
        {error && (
          <p className="text-red-400 text-sm mt-3">{error}</p>
        )}

        {/* ACTIONS */}
        <div className="mt-6 flex justify-between">

          {step === 2 && (
            <button
              onClick={handleBack}
              className="text-gray-400"
            >
              Back
            </button>
          )}

          {step === 1 && (
            <div />
          )}

          {step === 1 ? (
            <button
              onClick={handleNext}
              className="bg-white text-black px-4 py-2 rounded"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-white text-black px-4 py-2 rounded"
            >
              {loading ? "Saving..." : "Finish"}
            </button>
          )}

        </div>

      </div>
    </div>
  )
}