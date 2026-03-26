"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function OnboardingProfile() {

  const router = useRouter()

  const [form, setForm] = useState({
    country: "",
    phone: "",
    address: "",
    vat: "",
    contactName: ""
  })

  const [loading, setLoading] = useState(false)

  // =====================================================
  // LOAD EXISTING DATA
  // =====================================================

  useEffect(() => {
    fetch("/api/company/me")
      .then(res => res.json())
      .then(data => {
        if (data.company) {
          setForm({
            country: data.company.country || "",
            phone: data.company.phone || "",
            address: data.company.address || "",
            vat: data.company.vat || "",
            contactName: data.company.contactName || ""
          })
        }
      })
  }, [])

  // =====================================================
  // HANDLE CHANGE
  // =====================================================

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit = async () => {
    setLoading(true)

    try {
      const res = await fetch("/api/company/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      })

      if (!res.ok) {
        alert("Error saving profile")
        return
      }

      // 👉 redirect final
      router.push("/platform")

    } catch (err) {
      console.error(err)
      alert("Network error")
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-md bg-neutral-900 p-8 rounded-xl space-y-4">

        <h2 className="text-xl font-semibold">
          Complete your profile
        </h2>

        <input
          placeholder="Country"
          value={form.country}
          onChange={e => handleChange("country", e.target.value)}
        />

        <input
          placeholder="Phone"
          value={form.phone}
          onChange={e => handleChange("phone", e.target.value)}
        />

        <input
          placeholder="Address"
          value={form.address}
          onChange={e => handleChange("address", e.target.value)}
        />

        <input
          placeholder="VAT"
          value={form.vat}
          onChange={e => handleChange("vat", e.target.value)}
        />

        <input
          placeholder="Contact Name"
          value={form.contactName}
          onChange={e => handleChange("contactName", e.target.value)}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-4 p-3 rounded-full bg-yellow-500 text-black font-medium"
        >
          {loading ? "Saving..." : "Continue"}
        </button>

      </div>
    </div>
  )
}