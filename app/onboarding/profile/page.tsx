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
  const [role, setRole] = useState<"BUYER" | "PRODUCER" | null>(null)
  const [predictions, setPredictions] = useState<any[]>([])
  const [debounceTimeout, setDebounceTimeout] = useState<any>(null)
  const streetRef = useRef<HTMLInputElement>(null)
  const [isAutofilled, setIsAutofilled] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)

  

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

 // ================= LOAD ROLE =================
useEffect(() => {
  const storedRole = localStorage.getItem("user_role")

  if (storedRole === "BUYER" || storedRole === "PRODUCER") {
    setRole(storedRole)
  } else {
    // fallback a backend si no existe
    fetch("/api/auth/me", {
      credentials: "include",
    })
      .then(res => res.json())
      .then(data => {
        setRole(data.user?.role)
      })
      .catch(console.error)
  }
}, [])
console.log("ROLE 👉", role)

// ================= TYPES =================
type RoleConfig = {
  businessName: string
  legalCompanyName: string
  loadingText: string
  redirect: string
  fields: {
    vat: boolean
    contactName: boolean
  }
}

// ================= ROLE CONFIG =================
const roleConfigs: Record<"BUYER" | "PRODUCER", RoleConfig> = {
  BUYER: {
    businessName: "Business Name",
    legalCompanyName: "Legal Company Name",
    loadingText: "Setting up your workspace...",
    redirect: "/platform",
    fields: {
      vat: true,
      contactName: true,
    },
  },

  PRODUCER: {
    businessName: "Farm Name",
    legalCompanyName: "Legal Farm Name",
    loadingText: "Setting up your farm...",
    redirect: "/platform/producer",
    fields: {
      vat: false,
      contactName: true,
    },
  },
}
// ================= ACTIVE CONFIG =================
const config = roleConfigs[role || "BUYER"]

 // ================= HANDLERS =================
const handleChange = (field: string, value: string) => {
  setForm(prev => ({ ...prev, [field]: value }))
}




const handleAddressChange = (e: any) => {
  const value = e.target.value

  handleChange("address", value)

  // 🔥 DETECTAR AUTOFILL REAL (clave)
  const isFastFill = value.length > 10 && !e.nativeEvent?.data

  if (isFastFill) {
    setIsAutofilled(true)
    setPredictions([])
    return
  }

  setIsAutofilled(false)

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
        setPredictions(data?.suggestions || [])
      })
      .catch(console.error)
  }, 300)

  setDebounceTimeout(timeout)
}

const handleSubmit = async () => {
  setIsFinishing(true) // 🔥 show loader

  try {
    const res = await fetch("/api/company/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    })

    if (!res.ok) throw new Error()

    // 🔥 pequeño delay para efecto pro
    setTimeout(() => {
      router.push(config.redirect)
    }, 1200)

  } catch (err) {
    alert("Error saving profile")
    setIsFinishing(false)
  }
}

  return (

     <>
    {/* 🔥 LOADER OVERLAY */}
    {isFinishing && (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[99999]">
        <div className="flex flex-col items-center gap-4">
          
          <img
            src="/images/logo-altura-gold-final.png"
            className="w-40 md:w-56 opacity-90 animate-[pulse_1.8s_ease-in-out_infinite] select-none"
          />
          <div className="w-40 h-[1px] bg-white/10 animate-pulse" />

          <p className="text-white/50 text-sm tracking-wide">
            Setting up your workspace...
          </p>

        </div>
      </div>
    )}

    
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black to-neutral-950 text-white px-4">
      <div className="w-full max-w-md bg-neutral-900 p-8 rounded-xl space-y-5">
        <h2 className="text-xl font-semibold">Complete your profile</h2>
          {/* 🔥 STEP INDICATOR */}
  <div className="text-xs text-white/40 -mt-2 mb-2">
    Step {step} of 2
  </div>

        {/* ================= STEP 1 (NO TOCADO) ================= */}
       {step === 1 && (
  <div className="transition-all duration-300 opacity-100">
    <>
      <input
        className="input"
        placeholder={config.businessName}
        value={form.businessName}
        onChange={e => handleChange("businessName", e.target.value)}
      />

      <input
        className="input"
        placeholder={config.legalCompanyName}
        value={form.legalCompanyName}
        onChange={e => handleChange("legalCompanyName", e.target.value)}
      />
      <input
  className="input"
  placeholder="Contact Name"
  value={form.contactName}
  onChange={e => handleChange("contactName", e.target.value)}
/>
      {config.fields.vat && (
  <input
    className="input"
    placeholder="VAT / CIF"
    value={form.vat}
    onChange={e => handleChange("vat", e.target.value)}
  />
)}

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
        onChange={(value) => handleChange("phone", `+${value}`)}
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

      <button onClick={() => setStep(2)} className="btn-primary mt-4">
        Continue
      </button>
    </>
  </div>
)}

        {/* ================= STEP 2 ================= */}
       {step === 2 && (
  <div className="transition-all duration-300 opacity-100">
    <>
      <div className="relative">
        <input
          value={form.address}
          onChange={(e) => handleAddressChange(e)} // 🔥 wrapper
          className="input"
          placeholder="Start typing your address..."
        />

        {predictions.length > 0 && !isAutofilled && (
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

                    
                    const res = await fetch("/api/place-details", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                        placeId,
                        language: navigator.language || "en"
                      })
                    })

                    const data = await res.json()

                    // ================= VALIDATE ADDRESS =================
                    if (!data.city || !data.country) {
                      console.error("Invalid address", data)
                      return
                    }

                    // ================= ADVANCED VALIDATION =================

                    const addressLower = (data.address || "").toLowerCase()

                    if (
                      addressLower.includes("po box") ||
                      addressLower.includes("apartado") ||
                      addressLower.includes("p.o.")
                    ) {
                      console.error("PO Box not allowed", data)
                      return
                    }

                    const isOnlyCity = !data.street && data.city

                    if (isOnlyCity) {
                      console.warn("City selected without street", data)
                    }

                    console.log("DETAILS DATA 👉", data)

                    // ================= APPLY ADDRESS (Stripe style) =================
                    handleChange("address", data.addressLine1 || data.address || "")
                    handleChange("street", data.street || "")
                    handleChange("streetNumber", data.streetNumber || "")
                    handleChange("city", data.city || "")

                    // 🔥 SMART REGION
                    handleChange("region", data.region || data.subregion || "")

                    handleChange("postalCode", data.postalCode || "")

                    // 🔥 AUTO FOCUS
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
        disabled={isFinishing}
        className="btn-primary mt-4"
      >
        {loading ? "Saving..." : "Finish"}
      </button>
    </>
  </div>
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
          .input:focus {
  outline: none;
  border-color: #facc15;
  box-shadow: 0 0 0 1px #facc15;
}
        .btn-primary {
          width: 100%;
          padding: 12px;
          border-radius: 999px;
          background: linear-gradient(to right,#facc15,#fde047);
          color: black;
          font-weight: 600;
        }
          .btn-primary {
  transition: all 0.15s ease;
}

.btn-primary:hover {
  transform: scale(1.02);
}

.btn-primary:active {
  transform: scale(0.98);
}
      `}</style>
    </div>
  </>
)
}