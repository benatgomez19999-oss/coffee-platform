"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Select from "react-select"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"

// 🌍 FULL COUNTRY LIST (simplificada pero amplia)
const countryOptions = [
  { value: "ES", label: "Spain 🇪🇸" },
  { value: "US", label: "United States 🇺🇸" },
  { value: "GB", label: "United Kingdom 🇬🇧" },
  { value: "FR", label: "France 🇫🇷" },
  { value: "IT", label: "Italy 🇮🇹" },
  { value: "DE", label: "Germany 🇩🇪" },
  { value: "PT", label: "Portugal 🇵🇹" },
  { value: "NL", label: "Netherlands 🇳🇱" },
  { value: "BE", label: "Belgium 🇧🇪" },
  { value: "CH", label: "Switzerland 🇨🇭" },
  { value: "PL", label: "Poland 🇵🇱" },
  { value: "SE", label: "Sweden 🇸🇪" },
  { value: "NO", label: "Norway 🇳🇴" },
  { value: "DK", label: "Denmark 🇩🇰" },
  { value: "FI", label: "Finland 🇫🇮" },
  { value: "BR", label: "Brazil 🇧🇷" },
  { value: "CO", label: "Colombia 🇨🇴" },
  { value: "MX", label: "Mexico 🇲🇽" },
  { value: "AR", label: "Argentina 🇦🇷" },
  { value: "CL", label: "Chile 🇨🇱" },
  { value: "PE", label: "Peru 🇵🇪" },
  { value: "CN", label: "China 🇨🇳" },
  { value: "JP", label: "Japan 🇯🇵" },
  { value: "KR", label: "South Korea 🇰🇷" },
  { value: "IN", label: "India 🇮🇳" },
  { value: "AU", label: "Australia 🇦🇺" },
  { value: "CA", label: "Canada 🇨🇦" },
  { value: "ZA", label: "South Africa 🇿🇦" },
]

export default function OnboardingProfile() {

  const router = useRouter()

  const [form, setForm] = useState({
    country: "",
    phone: "",
    address: "",
    vat: "",
    contactName: "",
    businessName: "",
    legalCompanyName: ""
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
            contactName: data.company.contactName || "",
            businessName: data.company.businessName || "",
            legalCompanyName: data.company.legalCompanyName || ""
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
          className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md"
          placeholder="Business Name"
          value={form.businessName}
          onChange={e => handleChange("businessName", e.target.value)}
        />

        <input
          className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md"
          placeholder="Legal Company Name"
          value={form.legalCompanyName}
          onChange={e => handleChange("legalCompanyName", e.target.value)}
        />

        {/* 🌍 COUNTRY SELECT */}
        <Select
  options={countryOptions}
  value={countryOptions.find(opt => opt.value === form.country)}
  onChange={(option) =>
    handleChange("country", option?.value || "")
  }
  styles={{
    control: (base) => ({
      ...base,
      backgroundColor: "#00000066",
      borderColor: "#ffffff1a",
      color: "white",
    }),
    singleValue: (base) => ({
      ...base,
      color: "white",
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: "#111",
      color: "white",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "#222" : "#111",
      color: "white",
    }),
  }}
/>

    <PhoneInput
  country={form.country?.toLowerCase() || "es"}
  value={form.phone}
  disableDropdown // 🔥 quitamos dropdown feo
  onChange={(value, data: any) => {
    setForm(prev => ({
      ...prev,
      phone: value
    }))
  }}
  inputStyle={{
    width: "100%",
    background: "#00000066",
    color: "white",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    height: "42px"
  }}
  buttonStyle={{
    background: "#111",
    border: "1px solid rgba(255,255,255,0.1)"
  }}
/>

        <input
          className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md"
          placeholder="Address"
          value={form.address}
          onChange={e => handleChange("address", e.target.value)}
        />

        <input
          className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md"
          placeholder="VAT"
          value={form.vat}
          onChange={e => handleChange("vat", e.target.value)}
        />

        <input
          className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md"
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