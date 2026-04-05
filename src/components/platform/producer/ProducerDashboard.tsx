"use client"

import { useEffect, useState } from "react"
import "@/styles/themes/producer.css"
import React from "react"

type ColumnVariant = "preparing" | "lab" | "ready" | "sold" | "default"

const variants: Record<ColumnVariant, string> = {
  preparing: "bg-[#f3eee6] border-[#bfae92] hover:border-[#a89574]",
  lab: "bg-[#f2efe9] border-[#d8cebb] hover:border-[#cfc4ad]",
  ready: "bg-[#f6f9f5] border-[#dbe6d7] hover:border-[#b7cbb0]",
  sold: "bg-[#f6f2ec] border-[#e2d4c2] hover:border-[#d6c3ad] opacity-90",
  default: "bg-[#f3eee6] border-[#bfae92]"
}

export default function ProducerDashboard({ user }: any) {
const [data, setData] = useState<any>(null)
const [loading, setLoading] = useState(true)
const isNew = true
const [story, setStory] = useState<string | null>(null)
const [storyReady, setStoryReady] = useState(false)
const [isStoryExpanded, setIsStoryExpanded] = useState(false)
const [isGeneratingStory, setIsGeneratingStory] = useState(false)
const [isStoryOpen, setIsStoryOpen] = useState(false)
const storySectionRef = React.useRef<HTMLDivElement | null>(null)
const [isUnrollFinished, setIsUnrollFinished] = useState(false)
const [isTopRolled] = useState(true)

const scrollToStory = () => {
  const element = storySectionRef.current
  if (!element) return

  const targetY = element.getBoundingClientRect().top + window.scrollY - 120
  const startY = window.scrollY
  const distance = targetY - startY
  const duration = 900 // ⬅️ controla velocidad aquí
  let startTime: number | null = null

  const ease = (t: number) => 1 - Math.pow(1 - t, 3)

  const animation = (currentTime: number) => {
    if (!startTime) startTime = currentTime
    const time = Math.min(1, (currentTime - startTime) / duration)

    window.scrollTo(0, startY + distance * ease(time))

    if (time < 1) requestAnimationFrame(animation)
  }

  requestAnimationFrame(animation)
}



useEffect(() => {
  const generatingHandler = () => {
    setIsGeneratingStory(true)
    setStoryReady(false)
  }

  const generatedHandler = (e: any) => {
    setStory(e.detail)
    localStorage.setItem("farmStory", e.detail)

    setTimeout(() => {
      setIsGeneratingStory(false)
      setStoryReady(true)
    }, 10000)
  }

  window.addEventListener("storyGenerating", generatingHandler)
  window.addEventListener("storyGenerated", generatedHandler)

  return () => {
    window.removeEventListener("storyGenerating", generatingHandler)
    window.removeEventListener("storyGenerated", generatedHandler)
  }
}, [])

/* ////////////////////////////////////////////////////// */
/* 💾 LOAD STORY FROM LOCAL STORAGE */
/* ////////////////////////////////////////////////////// */

useEffect(() => {
  const savedStory = localStorage.getItem("farmStory")

  if (savedStory) {
    setStory(savedStory)
    setStoryReady(true)
  }
}, [])

  {/* ////////////////////////////////////////////////////// */}
  {/* // LOAD DATA */}
  {/* ////////////////////////////////////////////////////// */}

  useEffect(() => {
    fetch("/api/producer/dashboard", {
      credentials: "include",
    })
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-10 text-white">Loading...</div>
  }

  if (!data) {
    return <div className="p-10 text-red-400">Error loading data</div>
  }



{/* ////////////////////////////////////////////////////// */}
{/* // UI */}
{/* ////////////////////////////////////////////////////// */}

const debugLot = {
  id: "debug-1",
  name: "Finca El Paraíso",
  variety: "Geisha",
  process: "Washed",
  availableKg: 120
}







return (
  <>

  <div className="relative h-[420px] w-screen left-1/2 -translate-x-1/2 overflow-hidden">

  {/* 🌄 IMAGE BASE */}
  <div className="absolute inset-0">
    <div className="hero-image animate-heroDrift">
      <img
        src="/images/hero_producer.png"
        alt="Coffee farm"
        loading="eager"
        decoding="async"
        className="hero-img"
      />
    </div>
  </div>

  {/* 🌫️ BLEND */}
  <div className="absolute inset-0 hero-blend" />

  {/* 📝 TEXTO (LIBRE TOTAL) */}
  <div className="absolute z-10 left-44 md:left-50 top-12 md:top-16 max-w-xl">
    
    <h1 className="text-3xl md:text-4xl text-[#eae4d8]/95 font-semibold mb-3 tracking-tight drop-shadow-sm">
      Your Coffee Operations
    </h1>

  </div>

 {/* NEW LOT CTA PRO */}
<div className="absolute z-20 left-[270px] md:left-[310px] bottom-29 md:bottom-31">
  <button
    onClick={() => window.location.href = "/platform/producer/lots/new"}
    className="
  relative
  bg-[#8b5e34] text-white
  px-10 py-4 text-base font-medium
  rounded-full

  border border-[#d4af37]/60 hover:border-[#d4af37]

  shadow-[0_14px_40px_rgba(139,94,52,0.45)]
  hover:bg-[#6f4726]
  hover:scale-[1.06]
  active:scale-[0.98]

  transition-all duration-300
  animate-[ctaFloat_4s_ease-in-out_infinite]

  cursor-pointer
"
    style={{
      backdropFilter: "blur(6px)",
      boxShadow: `
        0 18px 50px rgba(139,94,52,0.5),
        inset 0 1px 0 rgba(255,255,255,0.15)
      `
    }}
  >
    + New Coffee Lot
  </button>
</div>

</div>


{/* ////////////////////////////////////////////////////// */}
{/* // 📊 DASHBOARD (BASE LIMPIA FINAL) */}
{/* ////////////////////////////////////////////////////// */}

<div className="relative z-20 -mt-24 pt-32 pb-16 w-screen left-1/2 -translate-x-1/2">

  {/* CONTENIDO CENTRADO */}
  <div className="max-w-[1400px] mx-auto px-6 lg:px-10 xl:px-16">

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 md:gap-10 xl:gap-12">

      {/* <Column
        title="📝 Preparing"
        subtitle="Coffee you're working on"
        count={data.drafts.length}
      >
        {data.drafts.map((lot: any) => (
          <LotCard
            key={lot.id}
            lot={lot}
            actionLabel="Send Sample"
            onAction={() => sendSample(lot.id)}
          />
        ))}

      </Column>

      <Column
        title="🔬 In the Lab"
        subtitle="Being analyzed"
        count={data.inLab.length}
      >
        {data.inLab.map((lot: any) => (
          <LotCard
            key={lot.id}
            lot={lot}
            status="Waiting analysis"
          />
        ))}
      </Column>

      <Column
        title="🌿 Ready"
        subtitle="Approved for sale"
        count={data.verified.length}
      >
        {data.verified.map((lot: any) => (
          <LotCard
            key={lot.id}
            lot={lot}
            status={`${lot.availableKg} kg available`}
          />
        ))}
      </Column>

      <Column
        title="💰 Sold"
        subtitle="Already purchased"
        count={data.sold.length}
      >
        {data.sold.map((lot: any) => (
          <LotCard
            key={lot.id}
            lot={lot}
            status="Sold"
          />
        ))}
      </Column> */}

 <Column
  title="📝 Preparing"
  subtitle="Coffee you're working on"
  count={data.drafts.length}
  variant="preparing"
>
  <LotCard
    lot={debugLot}
    actionLabel="Send Sample"
    onAction={() => {}}
  />
</Column>

<Column
  title="🔬 In the Lab"
  subtitle="Being analyzed"
  count={data.inLab.length}
  variant="lab"
>
  <LotCard
    lot={debugLot}
    status="Waiting analysis"
  />
</Column>

<Column
  title="🌿 Ready"
  subtitle="Approved for sale"
  count={data.verified.length}
  variant="ready"
>
  <LotCard
  lot={debugLot}
  status="120 kg available"
  variant="ready"
  isNew={true}
/>
  </Column>

<Column
  title="💰 Sold"
  subtitle="Already purchased"
  count={data.sold.length}
  variant="sold"
>
  <LotCard
    lot={debugLot}
    status="Sold"
  />
</Column>

  </div>

  {/* FULL WIDTH WRAPPER */}
<div className="w-screen left-1/2 -translate-x-1/2 relative mt-14">

  <div className="max-w-[1400px] mx-auto px-6 lg:px-10 xl:px-16">

    {/* TU CARD AQUÍ */}
    <div className="relative bg-[#f3eee6]">
    

{/* ////////////////////////////////////////////////////// */}
{/* // 🌿 FARM PROFILE (HORIZONTAL PRO CLEAN) */}
{/* ////////////////////////////////////////////////////// */}


 <div className="
  relative
  bg-[#f3eee6]

  border-2 border-[#bfae92]
  rounded-2xl

  px-10 py-8

  flex items-center
  gap-10

  min-h-[140px]
  overflow-visible

  shadow-[0_2px_6px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(0,0,0,0.05)]
  transition-all duration-300
">

    {/* ////////////////////////////////////////////////////// */}
    {/* // 📝 LEFT: STORY CONTENT */}
    {/* ////////////////////////////////////////////////////// */}

    <div className="max-w-xl">

      {/* EYEBROW */}
      <p className="text-[12px] tracking-[0.2em] text-[#a08b6b] uppercase">
        Farm Profile
      </p>

      {/* TITLE */}
      <p className="text-[20px] font-semibold text-[#2f2418] mt-2">
        Tell the story behind your coffee
      </p>

      {/* ////////////////////////////////////////////////////// */}
{/* // 🧠 STORY LOGIC */}
{/* ////////////////////////////////////////////////////// */}

{!isStoryExpanded ? (
  <>
    {/* DEFAULT */}
    {!story && !isGeneratingStory && (
      <p className="text-[14px] text-[#6b5a45] mt-3 leading-relaxed">
        Add photos and generate a story your buyers will see when they scan your lots.
      </p>
    )}

    {/* GENERATING */}
    {isGeneratingStory && (
      <p className="text-[14px] text-[#7a5c2e] mt-3 leading-relaxed animate-pulse">
        Creating your farm story...
      </p>
    )}

    {/* SECONDARY CTA */}
    {!storyReady && (
      <button className="text-[#7a5c2e] text-sm mt-3 hover:underline">
        Write it manually
      </button>
    )}
  </>
) : (
  <>
    {/* ////////////////////////////////////////////////////// */}
    {/* // 📖 EXPANDED STORY */}
    {/* ////////////////////////////////////////////////////// */}

    <div className="flex items-center justify-between mt-4">
      <h2 className="text-[20px] font-semibold text-[#2f2418]">
        Your farm story
      </h2>

      

      <button
        onClick={() => setIsStoryExpanded(false)}
        className="text-[#7a5c2e] text-sm hover:opacity-70"
      >
        Close
      </button>
    </div>

    <p className="text-[#4a3a2a] text-[15px] leading-relaxed mt-4 whitespace-pre-line">
      {story}
    </p>
  </>
)}

    </div>

    {/* ////////////////////////////////////////////////////// */}
    {/* // 🎯 CTA */}
    {/* ////////////////////////////////////////////////////// */}

    <div className="flex-1 flex justify-end">
      <button
        onClick={() => {
          window.dispatchEvent(new Event("startStoryFlow"))
        }}
        className="
          bg-[#8b5e34] text-white
          px-7 py-3 rounded-full text-sm font-medium
          border border-[#d4af37]/50
          hover:bg-[#6f4726]
          hover:scale-[1.05]
          transition-all duration-200
          cursor-pointer
        "
      >
        {storyReady ? "Improve story" : "Generate story with AI"}
      </button>
    </div>

    {storyReady && !isStoryExpanded && (
  <div className="flex-1 flex justify-center">

    <button
    onClick={() => {
  setIsStoryOpen(true)
  setIsUnrollFinished(false)

  setTimeout(scrollToStory, 100)

  setTimeout(() => {
    setIsUnrollFinished(true)
  }, 2800) // ⬅️ mismo tiempo que tu animación
}}
      className="
        group
        flex items-center gap-4

        px-6 py-4
        rounded-2xl

        bg-[#efe7da]
        border border-[#d4af37]/40

        hover:bg-[#e6dccb]
        hover:scale-[1.02]

        transition-all duration-200
      "
    >
      <div className="
        w-2.5 h-2.5 rounded-full
        bg-[#8b5e34]
        group-hover:scale-125
        transition
      " />

      <div className="flex flex-col text-left">
        <span className="text-[11px] text-[#a08b6b] uppercase tracking-wide">
          Story
        </span>
        <span className="text-[15px] text-[#2f2418] font-medium">
          View your story
        </span>
      </div>
    </button>

  </div>
)}

    {/* ////////////////////////////////////////////////////// */}
    {/* // 🖼 RIGHT: VISUAL */}
    {/* ////////////////////////////////////////////////////// */}

    <div className="hidden md:block w-[260px] h-[120px] relative">

  {/* BASE */}
  <div className="
    absolute inset-0 rounded-xl
    bg-gradient-to-br from-[#e8dfd1] to-[#d6c7b2]
    opacity-60
  " />

  {/* PLACEHOLDER SIEMPRE */}
  <>
    <div className="absolute top-3 left-3 w-20 h-14 bg-white/40 rounded-md" />
    <div className="absolute bottom-3 right-4 w-24 h-16 bg-white/30 rounded-md" />
  </>

</div>

  </div>
</div>
</div>
</div> {/* FIN CARD WRAPPER */}

{/* ////////////////////////////////////////////////////// */}
{/* // 📖 STORY SECTION (EXPANDABLE BELOW) */}
{/* ////////////////////////////////////////////////////// */}

<div
  ref={storySectionRef}
  className={`
    relative
    [perspective:1200px]
    [transform-style:preserve-3d]

    transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
    overflow-visible

    ${isStoryOpen 
      ? "mt-14 pt-4 opacity-100" 
      : "mt-0 opacity-0 pointer-events-none"
    }
  `}
>

  {/* 🧾 STORY CARD */}

  
  <div

    className={`
      relative

      parchment
      parchment-unroll
      [transform-style:preserve-3d]
      ${isStoryOpen ? "active" : ""}
      ${isUnrollFinished ? "finished" : ""}

      border border-[#bfae92]/60
      rounded-2xl
      transform-gpu origin-top

      px-8 md:px-10 py-10

      shadow-[0_12px_40px_rgba(0,0,0,0.08)]

      transition-all duration-800 ease-[cubic-bezier(0.22,1,0.36,1)]
    `}
  >

   

    {/* 🔥 INNER CURL (IMPORTANTE AQUÍ) */}
    
    <div className="inner-curl" />
    

    {/* ✨ LIGHT OVERLAY */}
    <div className="absolute inset-0 rounded-2xl pointer-events-none border border-white/40 opacity-40 z-[1]" />

    {/* HEADER */}
    <div className="flex items-center justify-between mb-6 relative z-[3]">
      <h2 className="text-[22px] font-semibold text-[#2f2418]">
        Your farm story
      </h2>

      <button
        onClick={() => {
  setIsStoryOpen(false)
  setIsUnrollFinished(false)
}}
      >
        Close
      </button>
    </div>
    

    {/* DIVIDER */}
    <div className="h-[1px] bg-[#e6dccb] mb-6 relative z-[3]" />

    {/* CONTENT */}
    <div className="relative z-[3]">
      <p className="
        text-[#4a3a2a]
        text-[16px]
        leading-relaxed
        whitespace-pre-line
        max-w-3xl
      ">
        {story}
      </p>

     
    </div>

  </div>
  </div>
  </div>
  </div>

  </>
)







{/* ////////////////////////////////////////////////////// */}
{/* // COLUMN (RURAL STYLE) */}
{/* ////////////////////////////////////////////////////// */}

function Column({ title, subtitle, count, children, variant = "default", className }: {
  title: string
  subtitle: string
  count: number
  children?: React.ReactNode
  variant?: ColumnVariant
  className?: string
}) {
  return (
    <div
 className={`
  relative
  ${variants[variant]}

  p-5
  rounded-2xl

  border-2

  overflow-hidden

  

  /* CAPA LUZ SUAVE */
  before:absolute before:inset-0 before:rounded-2xl
  before:pointer-events-none
  before:border before:border-[#e6dccb]
  before:opacity-60

  /* LIGHT SWEEP (MUY SUTIL) */
  after:absolute after:inset-0 after:rounded-2xl
  after:pointer-events-none
  after:bg-[linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.25)_50%,transparent_70%)]
  after:opacity-0
  after:transition-opacity after:duration-500

  hover:after:opacity-40

  /* MATERIAL DEPTH */
  shadow-[0_2px_6px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(0,0,0,0.05)]

  hover:-translate-y-[4px]
  hover:shadow-[0_20px_45px_rgba(0,0,0,0.12)]

  transition-all duration-300

  ${className || ""}
`}
    >
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold text-[#2f2418]">
  {title}
</h2>

<p className="text-sm text-[#6b5a45] mt-1">
  {subtitle}
</p>

<div className="mb-4 text-sm text-[#a67c52] font-medium">
  {count} lots
</div>

{/* <div className="flex flex-col gap-3">
  {Array.isArray(children) && children.length > 0 ? children : (
    <p className="text-[#8a7a65] text-[12px] mt-2">
  No lots yet
</p>
  )}
</div> */}

<div className="flex flex-col gap-3">
  {React.Children.count(children) > 0 ? children : (
    <p className="text-[#8a7a65] text-[12px] mt-2">
      No lots yet
    </p>
  )}
</div>
    </div>
    </div>

  )
}


{/* ////////////////////////////////////////////////////// */}
{/* // LOT CARD (WARM / ORGANIC STYLE) */}
{/* ////////////////////////////////////////////////////// */}

function LotCard({ lot, actionLabel, onAction, status, variant = "default", isNew = false }: any) {
  return (
   <div className={`
  producer-card
  ${isNew ? "producer-card--active" : ""}
`}>
 {isNew && (
  <div className="notification-dot">
    <span className="ping"></span>
    <span className="dot"></span>
  </div>
)}
      {/* 🔹 TOP: NAME */}
      <div className="mb-2">
        <p className="font-semibold text-[14px] text-[#2f2418] leading-tight">
          {lot.name || "Unnamed Lot"}
        </p>
      </div>

      {/* 🔹 META INFO */}
      <p className="text-[12px] text-[#6b5a45]">
        {lot.variety} · {lot.process}
      </p>

      {/* 🔹 STATUS (MUCHO MÁS IMPORTANTE AHORA) */}
      {status && (
        <div className="mt-3">
          <span className="inline-block text-[11px] px-2 py-[3px] rounded-full 
                           bg-[#efe7da] text-[#7a5c2e] font-medium">
            {status}
          </span>
        </div>
      )}

      {/* 🔹 ACTION */}
      {actionLabel && (
        <button
          onClick={onAction}
          className="
mt-4 w-full

bg-[#7a5230] text-white
py-2 rounded-lg text-xs font-medium

transition-all duration-200
cursor-pointer

hover:bg-[#6f4726]
hover:scale-[1.01]
hover:shadow-[0_6px_18px_rgba(139,94,52,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]

active:scale-[0.96]
active:shadow-[inset_0_3px_8px_rgba(0,0,0,0.25)]
"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

{/* ////////////////////////////////////////////////////// */}
{/* // ACTION */}
{/* ////////////////////////////////////////////////////// */}

async function sendSample(lotId: string) {
  try {
    await fetch(`/api/producer/lot/${lotId}/send-to-lab`, {
      method: "POST",
      credentials: "include"
    })

    window.location.reload()

  } catch (err) {
    alert("Error sending sample")
  }
}


}

    