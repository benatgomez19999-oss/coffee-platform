"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Select from "react-select"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import { useRef } from "react"

const countryOptions = [
  { value: "ES", label: "Spain 🇪🇸" },
  { value: "US", label: "United States 🇺🇸" },
  { value: "GB", label: "United Kingdom 🇬🇧" },
  { value: "FR", label: "France 🇫🇷" },
  { value: "IT", label: "Italy 🇮🇹" },
  { value: "DE", label: "Germany 🇩🇪" }
]

export default function OnboardingProfile() {
  const router = useRouter()
  

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [predictions, setPredictions] = useState<any[]>([])
  const [debounceTimeout, setDebounceTimeout] = useState<any>(null)
  const streetRef = useRef<HTMLInputElement>(null)
  

  const [form, setForm] = useState({
    country: "",
    phone: "",
    address: "",
    street: "",
    streetNumber: "",
    unit: "",
    city: "",
    region: "",
    postalCode: "",
    vat: "",
    contactName: "",
    businessName: "",
    legalCompanyName: ""
  })

  // ================= LOAD DATA =================
  useEffect(() => {
    fetch("/api/company/me")
      .then(res => res.json())
      .then(data => {
        if (data.company) {
          setForm(prev => ({ ...prev, ...data.company }))
        }
      })
  }, [])

 // ================= HANDLERS =================
const handleChange = (field: string, value: string) => {
  setForm(prev => ({ ...prev, [field]: value }))
}




const handleAddressChange = (e: any) => {
  const value = e.target.value
  handleChange("address", value)

  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
  }

  const timeout = setTimeout(() => {
  fetch("/api/places", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: value,
      country: form.country,
    }),
  })
    .then(res => res.json())
    .then(data => {
      const suggestions = data?.suggestions || []
      setPredictions(suggestions)
    })
    .catch(err => console.error(err))
}, 300)

  setDebounceTimeout(timeout)
}

const handleSubmit = async () => {
  setLoading(true)

  try {
    const res = await fetch("/api/company/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    })

    if (!res.ok) throw new Error()

    router.push("/platform")
  } catch (err) {
    alert("Error saving profile")
  } finally {
    setLoading(false)
  }
}

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-md bg-neutral-900 p-8 rounded-xl space-y-4">
        <h2 className="text-xl font-semibold">Complete your profile</h2>

        {/* ================= STEP 1 (NO TOCADO) ================= */}
        {step === 1 && (
          <>
            <input
              className="input"
              placeholder="Business Name"
              value={form.businessName}
              onChange={e => handleChange("businessName", e.target.value)}
            />

            <input
              className="input"
              placeholder="Legal Company Name"
              value={form.legalCompanyName}
              onChange={e => handleChange("legalCompanyName", e.target.value)}
            />

            <Select
              options={countryOptions}
              value={countryOptions.find(opt => opt.value === form.country)}
              onChange={option => handleChange("country", option?.value || "")}
              styles={{
                control: base => ({
                  ...base,
                  backgroundColor: "rgba(0,0,0,0.4)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "white",
                  height: "42px",
                  boxShadow: "none"
                }),
                singleValue: base => ({
                  ...base,
                  color: "white"
                }),
                menu: base => ({
                  ...base,
                  backgroundColor: "#111",
                  color: "white"
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isFocused ? "#222" : "#111",
                  color: "white"
                })
              }}
            />

            <PhoneInput
              country={form.country?.toLowerCase() || "es"}
              value={form.phone}
              disableDropdown
              onChange={(value) => handleChange("phone", value)}
              inputStyle={{
                width: "100%",
                background: "rgba(0,0,0,0.4)",
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

            <button onClick={() => setStep(2)} className="btn-primary">
              Continue
            </button>
          </>
        )}

        {/* ================= STEP 2 ================= */}
        {step === 2 && (
          <>
            <div className="relative">
              <input
  value={form.address}
  onChange={(e) => handleAddressChange(e)} // 🔥 wrapper
  className="input"
  placeholder="Start typing your address..."
/>

              {predictions.length > 0 && (
                <div className="absolute left-0 top-full mt-1 w-full bg-black border border-white/10 rounded-md max-h-48 overflow-y-auto z-[9999]">
                  {predictions.map((p: any, i: number) => {
                    const text = p.placePrediction?.text?.text || ""
                    const placeId = p.placePrediction?.placeId

                    return (
                      <div
                        key={i}
                        className="px-3 py-2 hover:bg-white/10 cursor-pointer text-sm"
                        onClick={async () => {
                       setPredictions([])

                       // 🔥 STEP 4 aquí mismo
                      const res = await fetch("/api/place-details", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ placeId })
})
                      const data = await res.json()
                      // ================= VALIDATE ADDRESS =================
if (!data.city || !data.country) {
  console.error("Invalid address", data)
  return
}
// ================= ADVANCED VALIDATION =================

// ❌ Detect PO Box (common shipping issue)
const addressLower = (data.address || "").toLowerCase()

if (
  addressLower.includes("po box") ||
  addressLower.includes("apartado") ||
  addressLower.includes("p.o.")
) {
  console.error("PO Box not allowed", data)
  return
}

// ⚠️ Detect incomplete address (no street)
const isOnlyCity = !data.street && data.city

if (isOnlyCity) {
  console.warn("City selected without street", data)
  // 👉 NO bloqueamos, UX continúa
}
                      console.log("DETAILS DATA 👉", data) // 🔥 AÑADE ESTO

                     // ================= APPLY ADDRESS (Stripe style) =================
handleChange("address", data.addressLine1 || data.address || "")

handleChange("street", data.street || "")
handleChange("streetNumber", data.streetNumber || "")

handleChange("city", data.city || "")

// 🔥 SMART REGION (key part)
handleChange("region", data.subregion || data.region || "")

handleChange("postalCode", data.postalCode || "")
// 🔥 AUTO FOCUS IF NO STREET (city selected)
if (!data.street) {
  setTimeout(() => {
    streetRef.current?.focus()
  }, 100)
}
                      }}
                      >
                        {text}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Street"
                ref={streetRef}
                value={form.street}
                onChange={e => handleChange("street", e.target.value)}
              />

              <input
                className="input"
                placeholder="Number"
                value={form.streetNumber}
                onChange={e => handleChange("streetNumber", e.target.value)}
              />
            </div>

            <input
              className="input"
              placeholder="Unit / Apt / Door"
              value={form.unit}
              onChange={e => handleChange("unit", e.target.value)}
            />

            <input
              className="input"
              placeholder="City"
              value={form.city}
              onChange={e => handleChange("city", e.target.value)}
            />

            <input
              className="input"
              placeholder="Region"
              value={form.region}
              onChange={e => handleChange("region", e.target.value)}
            />

            <input
              className="input"
              placeholder="Postal Code"
              value={form.postalCode}
              onChange={e => handleChange("postalCode", e.target.value)}
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Saving..." : "Finish"}
            </button>
          </>
        )}
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 10px;
          border-radius: 6px;
          color: white;
        }
        .btn-primary {
          width: 100%;
          padding: 12px;
          border-radius: 999px;
          background: linear-gradient(to right,#facc15,#fde047);
          color: black;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}