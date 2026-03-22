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

export default function OnboardingWizard({ user, onComplete }: Props) {

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

  const handleSubmit = async () => {

    // =========================
    // BASIC VALIDATION
    // =========================

    if (!form.country || !form.contactName) {
      setError("Please fill required fields")
      return
    }

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

    } catch (err) {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">

      <div className="bg-neutral-900 p-8 rounded-xl w-full max-w-lg border border-white/10 shadow-xl">

        <h2 className="text-xl text-white mb-2">
          Complete your company profile
        </h2>

        <p className="text-sm text-gray-400 mb-6">
          This helps auto-fill your contracts and streamline operations.
        </p>

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

        {error && (
          <p className="text-red-400 text-sm mt-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full bg-white text-black py-2 rounded hover:opacity-90 transition"
        >
          {loading ? "Saving..." : "Save and continue"}
        </button>

      </div>
    </div>
  )
}