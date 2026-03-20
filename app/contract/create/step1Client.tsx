"use client"

import { useState } from "react"

type Client = {
  country: string
  businessName: string
  legalCompanyName: string
  vat: string
  address: string
  contactName: string
  email: string
  phone: string
}

type Props = {
  client: Client
  onNext: (data: Client) => void
}

export default function Step1Client({ client, onNext }: Props) {

  const [form, setForm] = useState<Client>(client)

  function update(field: keyof Client, value: string) {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onNext(form)
  }

return (

  <form
    onSubmit={submit}
    className="space-y-10 p-12 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur"
  >

    {/* ======================================================
       WIZARD HEADER
    ====================================================== */}

    <div className="space-y-2">

      <h2 className="text-2xl font-semibold tracking-tight">
        Client Information
      </h2>

      <p className="text-sm text-white/60">
        Legal and contact details for the contracting entity
      </p>

      {/* subtle divider */}

      <div className="h-px bg-white/10 mt-4" />

    </div>


    {/* ======================================================
       COMPANY DETAILS CARD
    ====================================================== */}

    <div className="p-6 rounded-xl border border-white/10 bg-black/30 space-y-6">

      <div className="text-xs uppercase tracking-widest text-white/50">
        Company Details
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-6">

        {/* COUNTRY */}

        <div className="space-y-2">

          <label className="text-sm text-white/70">
            Country
          </label>

          <input
            className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md focus:outline-none focus:border-yellow-400 transition"
            value={form.country}
            onChange={(e) => update("country", e.target.value)}
          />

        </div>


        {/* BUSINESS NAME */}

        <div className="space-y-2">

          <label className="text-sm text-white/70">
            Business Name
          </label>

          <input
            className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md focus:outline-none focus:border-yellow-400 transition"
            value={form.businessName}
            onChange={(e) => update("businessName", e.target.value)}
          />

        </div>


        {/* LEGAL COMPANY NAME */}

        <div className="space-y-2">

          <label className="text-sm text-white/70">
            Legal Company Name
          </label>

          <input
            className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md focus:outline-none focus:border-yellow-400 transition"
            value={form.legalCompanyName}
            onChange={(e) => update("legalCompanyName", e.target.value)}
          />

        </div>


        {/* VAT */}

        <div className="space-y-2">

          <label className="text-sm text-white/70">
            CIF / VAT
          </label>

          <input
            className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md focus:outline-none focus:border-yellow-400 transition"
            value={form.vat}
            onChange={(e) => update("vat", e.target.value)}
          />

        </div>

      </div>

    </div>


    {/* ======================================================
       CONTACT INFORMATION CARD
    ====================================================== */}

    <div className="p-6 rounded-xl border border-white/10 bg-black/30 space-y-6">

      <div className="text-xs uppercase tracking-widest text-white/50">
        Contact Information
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-6">

        {/* ADDRESS */}

        <div className="space-y-2 col-span-2">

          <label className="text-sm text-white/70">
            Business Address
          </label>

          <input
            className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md focus:outline-none focus:border-yellow-400 transition"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />

        </div>


        {/* CONTACT NAME */}

        <div className="space-y-2">

          <label className="text-sm text-white/70">
            Contact Name
          </label>

          <input
            className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md focus:outline-none focus:border-yellow-400 transition"
            value={form.contactName}
            onChange={(e) => update("contactName", e.target.value)}
          />

        </div>


        {/* EMAIL */}

        <div className="space-y-2">

          <label className="text-sm text-white/70">
            Email
          </label>

          <input
            className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md focus:outline-none focus:border-yellow-400 transition"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />

        </div>


        {/* PHONE */}

        <div className="space-y-2">

          <label className="text-sm text-white/70">
            Phone
          </label>

          <input
            className="w-full bg-black/40 border border-white/10 px-4 py-2.5 rounded-md focus:outline-none focus:border-yellow-400 transition"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />

        </div>

      </div>

    </div>


    {/* ======================================================
       ACTION
    ====================================================== */}

    <div className="flex justify-end pt-2">

      {/* ======================================================
   CONTINUE ACTION
   Primary wizard action
====================================================== */}

<button
  type="submit"
  className="
  group
  px-12
  py-3
  rounded-full
  bg-gradient-to-r
  from-yellow-500
  to-yellow-300
  text-black
  font-semibold
  tracking-wide
  flex
  items-center
  gap-2
  hover:scale-[1.03]
  transition
  duration-200
  shadow-lg
  shadow-yellow-500/30
  "
>

  Continue

  <span className="transition group-hover:translate-x-1">
    →
  </span>

</button>

    </div>

  </form>

)

}