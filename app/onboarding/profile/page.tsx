"use client"

declare global {
  interface Window {
    google: any
  }
}

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Select from "react-select"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"

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

  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)

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

  // ================= GOOGLE AUTOCOMPLETE =================
  useEffect(() => {
  let interval: any

  interval = setInterval(() => {
    if (window.google?.maps?.places && inputRef.current && !autocompleteRef.current) {
      
      const autocomplete = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["address"],
          fields: ["address_components", "formatted_address"]
        }
      )

      autocompleteRef.current = autocomplete

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (!place?.address_components) return

        const components = place.address_components

        const get = (type: string) =>
          components.find((c: any) => c.types.includes(type))?.long_name || ""

        const getShort = (type: string) =>
          components.find((c: any) => c.types.includes(type))?.short_name || ""

        const street = get("route")
        const streetNumber = get("street_number")

        setForm(prev => ({
          ...prev,
          address: place.formatted_address || "",
          street,
          streetNumber,
          city: get("locality") || get("postal_town"),
          region: get("administrative_area_level_1"),
          postalCode: get("postal_code"),
          country: getShort("country") || prev.country
        }))
      })

      clearInterval(interval)
    }
  }, 300)

  return () => clearInterval(interval)
}, [])

  // ================= HANDLERS =================
  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
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

        {step === 2 && (
          <>
          <input
  ref={inputRef}
  value={form.address}
  onChange={(e) => handleChange("address", e.target.value)}
  className="input"
  placeholder="Start typing your address..."
/>



            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Street"
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
        .pac-container { z-index: 9999 !important; }
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
