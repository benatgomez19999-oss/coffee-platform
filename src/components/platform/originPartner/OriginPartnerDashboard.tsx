"use client"

import { useEffect, useState } from "react"
import "@/styles/themes/producer.css"
import React from "react"
import PlatformHeader from "@/src/components/shared/general/PlatformHeader"

type ColumnVariant = "incoming" | "review" | "verified" | "orders" | "preparing" | "ready" | "default"

const variants: Record<ColumnVariant, string> = {
  incoming:  "bg-[#f3eee6] border-[#bfae92] hover:border-[#a89574]",
  review:    "bg-[#f2efe9] border-[#d8cebb] hover:border-[#cfc4ad]",
  verified:  "bg-[#f6f9f5] border-[#dbe6d7] hover:border-[#b7cbb0]",
  orders:    "bg-[#f3eee6] border-[#bfae92] hover:border-[#a89574]",
  preparing: "bg-[#f2efe9] border-[#d8cebb] hover:border-[#cfc4ad]",
  ready:     "bg-[#f6f9f5] border-[#dbe6d7] hover:border-[#b7cbb0]",
  default:   "bg-[#f3eee6] border-[#bfae92]",
}

export default function PartnerDashboard({ user }: { user?: any } = {}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // LOAD DATA
  useEffect(() => {
    fetch("/api/partner/dashboard", {
      credentials: "include"
    })
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-10 text-white">Loading...</div>
  }

  if (!data) {
    return <div className="p-10 text-red-400">Error loading</div>
  }

  return (
    <>

      {/* ////////////////////////////////////////////////////// */}
      {/* // 🔝 SHARED HEADER */}
      {/* ////////////////////////////////////////////////////// */}

      <PlatformHeader user={user ?? { role: "PARTNER", onboardingCompleted: true }} />

      <div className="pt-[70px]">

        {/* ////////////////////////////////////////////////////// */}
        {/* // 🌄 HERO (GRADIENT — NO IMAGE) */}
        {/* ////////////////////////////////////////////////////// */}

        <div className="relative h-[420px] w-screen left-1/2 -translate-x-1/2 overflow-hidden">

          {/* BACKGROUND GRADIENT */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f1208] via-[#161510] to-[#1e1a12]" />

          {/* SUBTLE GOLD GLOW */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(212,175,55,0.06)_0%,transparent_60%)]" />

          {/* BOTTOM FADE INTO PAGE BG */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f3efe6] via-transparent to-transparent" />

          {/* TITLE */}
          <div className="absolute z-10 left-44 md:left-50 top-12 md:top-16 max-w-xl">

            <p className="text-[11px] tracking-[0.25em] text-[#d4af37]/70 uppercase mb-3">
              Origin Partner
            </p>

            <h1 className="text-3xl md:text-4xl text-[#eae4d8]/95 font-semibold mb-3 tracking-tight drop-shadow-sm">
              Partner Operations
            </h1>

            <p className="text-[#eae4d8]/60 text-[15px] tracking-wide">
              Lab processing · Export preparation
            </p>

          </div>

          {/* CTA */}
          <div className="absolute z-20 left-[270px] md:left-[310px] bottom-29 md:bottom-31">
            <button
              onClick={() => window.location.href = "/platform/partner/lots"}
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
              View All Lots
            </button>
          </div>

        </div>


        {/* ////////////////////////////////////////////////////// */}
        {/* // 📊 DASHBOARD */}
        {/* ////////////////////////////////////////////////////// */}

        <div className="relative z-20 -mt-24 pt-32 pb-16 w-screen left-1/2 -translate-x-1/2">

          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 xl:px-16">


            {/* ===== 🧪 LAB ===== */}

            <div className="flex items-center gap-3 mb-8">
              <span className="text-[18px]">🧪</span>
              <h2 className="text-[18px] font-semibold text-[#2f2418] tracking-tight">
                Lab
              </h2>
              <div className="flex-1 h-[1px] bg-[#bfae92]/40 ml-2" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-10 xl:gap-12 mb-16">

              <Column
                title="📦 Incoming"
                subtitle="Lots arriving for analysis"
                count={data.incoming.length}
                variant="incoming"
                emptyText="No incoming lots"
                moreCount={Math.max(data.incoming.length - 1, 0)}
                ctaLabel="View lots"
                ctaHref="/platform/partner/lots"
              >
                {data.incoming.slice(0, 1).map((lot: any) => (
                  <LotCard
                    key={lot.id}
                    lot={lot}
                    actionLabel="Analyze"
                    onAction={() => openAnalyze(lot.id)}
                  />
                ))}
              </Column>

              <Column
                title="🔬 Ready to Verify"
                subtitle="Analysis complete, pending verification"
                count={data.readyToVerify.length}
                variant="review"
                emptyText="No lots ready to verify"
                moreCount={Math.max(data.readyToVerify.length - 1, 0)}
                ctaLabel="View lots"
                ctaHref="/platform/partner/lots"
              >
                {data.readyToVerify.slice(0, 1).map((lot: any) => (
                  <LotCard
                    key={lot.id}
                    lot={lot}
                    actionLabel="Create Lot"
                    onAction={() => verifyLot(lot.id)}
                  />
                ))}
              </Column>

              <Column
                title="🌿 Verified"
                subtitle="Approved and listed"
                count={data.verified?.length || 0}
                variant="verified"
                emptyText="No verified lots yet"
                moreCount={Math.max((data.verified?.length || 0) - 1, 0)}
                ctaLabel="View lots"
                ctaHref="/platform/partner/lots"
              >
                {data.verified?.slice(0, 1).map((lot: any) => (
                  <LotCard
                    key={lot.id}
                    lot={lot}
                    status="Listed"
                  />
                ))}
              </Column>

            </div>


            {/* ===== 📦 EXPORT PREPARATION ===== */}

            <div className="flex items-center gap-3 mb-8">
              <span className="text-[18px]">📦</span>
              <h2 className="text-[18px] font-semibold text-[#2f2418] tracking-tight">
                Export Preparation
              </h2>
              <div className="flex-1 h-[1px] bg-[#bfae92]/40 ml-2" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-10 xl:gap-12 mb-16">

              <Column
                title="📋 Orders"
                subtitle="New orders to prepare"
                count={data.orders.length}
                variant="orders"
                emptyText="No pending orders"
                moreCount={Math.max(data.orders.length - 1, 0)}
                ctaLabel="View orders"
                ctaHref="/platform/partner/orders"
              >
                {data.orders.slice(0, 1).map((order: any) => (
                  <LotCard
                    key={order.id}
                    lot={order}
                    actionLabel="Prepare"
                    onAction={() => prepareOrder(order.id)}
                  />
                ))}
              </Column>

              <Column
                title="⚙️ Preparing"
                subtitle="Being packed and processed"
                count={data.preparing.length}
                variant="preparing"
                emptyText="Nothing being prepared"
                moreCount={Math.max(data.preparing.length - 1, 0)}
                ctaLabel="View orders"
                ctaHref="/platform/partner/orders"
              >
                {data.preparing.slice(0, 1).map((order: any) => (
                  <LotCard
                    key={order.id}
                    lot={order}
                    actionLabel="Mark Ready"
                    onAction={() => markReady(order.id)}
                  />
                ))}
              </Column>

              <Column
                title="✅ Ready"
                subtitle="Awaiting pickup"
                count={data.ready.length}
                variant="ready"
                emptyText="No shipments ready"
                moreCount={Math.max(data.ready.length - 1, 0)}
                ctaLabel="View orders"
                ctaHref="/platform/partner/orders"
              >
                {data.ready.slice(0, 1).map((order: any) => (
                  <LotCard
                    key={order.id}
                    lot={order}
                    status="Waiting pickup"
                  />
                ))}
              </Column>

            </div>


            {/* ////////////////////////////////////////////////////// */}
            {/* // 🏷 PARTNER PROFILE CARD */}
            {/* ////////////////////////////////////////////////////// */}

            <div className="w-screen left-1/2 -translate-x-1/2 relative mt-2">
              <div className="max-w-[1400px] mx-auto px-6 lg:px-10 xl:px-16">

                <div className="relative bg-[#f3eee6]">

                  <div
                    className="
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
                    "
                  >

                    {/* LEFT: CONTENT */}
                    <div className="max-w-xl">

                      <p className="text-[12px] tracking-[0.2em] text-[#a08b6b] uppercase">
                        Partner Profile
                      </p>

                      <p className="text-[20px] font-semibold text-[#2f2418] mt-2">
                        Complete your lab and export credentials
                      </p>

                      <p className="text-[14px] text-[#6b5a45] mt-3 leading-relaxed">
                        Add your certifications, processing capacities and export details so producers and buyers can trust your operations.
                      </p>

                    </div>

                    {/* CTA */}
                    <div className="flex-1 flex justify-end">
                      <button
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
                        Edit profile
                      </button>
                    </div>

                    {/* RIGHT: VISUAL PLACEHOLDER */}
                    <div className="hidden md:block w-[260px] h-[120px] relative">

                      <div className="
                        absolute inset-0 rounded-xl
                        bg-gradient-to-br from-[#e8dfd1] to-[#d6c7b2]
                        opacity-60
                      " />

                      <div className="absolute top-3 left-3 w-20 h-14 bg-white/40 rounded-md" />
                      <div className="absolute bottom-3 right-4 w-24 h-16 bg-white/30 rounded-md" />

                    </div>

                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>

      </div>

    </>
  )
}


// //////////////////////////////////////////////////////
// COLUMN
// //////////////////////////////////////////////////////

function Column({
  title,
  subtitle,
  count,
  children,
  variant = "default",
  emptyText = "No items",
  moreCount = 0,
  ctaLabel,
  ctaHref,
}: {
  title: string
  subtitle: string
  count: number
  children?: React.ReactNode
  variant?: ColumnVariant
  emptyText?: string
  moreCount?: number
  ctaLabel?: string
  ctaHref?: string
}) {
  const hasChildren = React.Children.count(children) > 0

  return (
    <div
      className={`
        relative
        ${variants[variant]}

        min-h-[238px]
        p-6
        rounded-2xl
        border-2
        overflow-hidden

        before:absolute before:inset-0 before:rounded-2xl
        before:pointer-events-none
        before:border before:border-[#e6dccb]
        before:opacity-60

        after:absolute after:inset-0 after:rounded-2xl
        after:pointer-events-none
        after:bg-[linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.25)_50%,transparent_70%)]
        after:opacity-0
        after:transition-opacity after:duration-500

        hover:after:opacity-40

        shadow-[0_2px_6px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(0,0,0,0.05)]

        hover:-translate-y-[4px]
        hover:shadow-[0_20px_45px_rgba(0,0,0,0.12)]

        transition-all duration-300
      `}
    >
      <div className="relative z-[1] flex h-full flex-col">

        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-[#2f2418]">
            {title}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6b5a45]">
            {subtitle}
          </p>
          <div className="mt-4 text-[15px] font-semibold text-[#9a6f3e]">
            {count} {count === 1 ? "lot" : "lots"}
          </div>
        </div>

        <div className="mt-5 flex flex-1 flex-col justify-between">
          <div className="flex flex-col gap-3">
            {hasChildren ? (
              children
            ) : (
              <p className="text-[12px] leading-relaxed text-[#8a7a65]">
                {emptyText}
              </p>
            )}

            {moreCount > 0 && (
              <p className="text-[12px] font-medium text-[#8c6c47]">
                + {moreCount} more {moreCount === 1 ? "lot" : "lots"}
              </p>
            )}
          </div>

          {ctaLabel && ctaHref && (
            <a
              href={ctaHref}
              className="mt-5 inline-flex w-fit items-center rounded-full border border-[#cfb48a] bg-[#f7efdf] px-4 py-2 text-[12px] font-medium text-[#5f472f] transition-all duration-200 hover:bg-[#efe3ce] hover:text-[#3f2e1d]"
            >
              {ctaLabel}
            </a>
          )}
        </div>

      </div>
    </div>
  )
}


// //////////////////////////////////////////////////////
// LOT CARD
// //////////////////////////////////////////////////////

function LotCard({ lot, actionLabel, onAction, status }: any) {
  return (
    <div
      className="
        rounded-[18px]
        border border-[#dbcab2]
        bg-[linear-gradient(180deg,rgba(255,251,244,0.88)_0%,rgba(247,239,223,0.92)_100%)]
        px-4 py-4
        shadow-[0_8px_18px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.55)]
      "
    >
      <div className="mb-2">
        <p className="text-[15px] font-semibold leading-tight text-[#2f2418]">
          {lot.name || lot.lot?.name || "Unnamed"}
        </p>
      </div>

      <p className="text-[12px] leading-relaxed text-[#6b5a45]">
        {lot.variety || ""}
      </p>

      {status && (
        <div className="mt-3">
          <span className="inline-flex rounded-full bg-[#efe7da] px-2.5 py-1 text-[11px] font-medium text-[#7a5c2e]">
            {status}
          </span>
        </div>
      )}

      {actionLabel && (
        <button
          onClick={onAction}
          className="
            mt-4 inline-flex w-full items-center justify-center
            rounded-xl
            border border-[#8d6641]
            bg-[#7a5230] text-white
            py-2.5 text-[12px] font-medium

            transition-all duration-200
            cursor-pointer

            hover:bg-[#6f4726]
            hover:shadow-[0_6px_18px_rgba(139,94,52,0.22)]
            active:scale-[0.98]
          "
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}


// //////////////////////////////////////////////////////
// ACTIONS
// //////////////////////////////////////////////////////

function openAnalyze(id: string) {
  window.location.href = `/platform/partner/lots/${id}`
}

async function verifyLot(id: string) {
  await fetch(`/api/partner/lots/${id}/verify`, {
    method: "POST",
    credentials: "include"
  })

  window.location.reload()
}

async function prepareOrder(id: string) {
  await fetch(`/api/partner/orders/${id}/prepare`, {
    method: "POST",
    credentials: "include"
  })

  window.location.reload()
}

async function markReady(id: string) {
  await fetch(`/api/partner/orders/${id}/ready`, {
    method: "POST",
    credentials: "include"
  })

  window.location.reload()
}
