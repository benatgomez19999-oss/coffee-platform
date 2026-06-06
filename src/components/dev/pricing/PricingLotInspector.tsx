"use client"

import { useEffect, useState } from "react"

//////////////////////////////////////////////////////
// 🔬 PRICING LOT INSPECTOR — read-only
//
// Detail view for one GreenLot. Fetches
//   GET /api/internal/pricing/lot/[id]
// and renders the structured ClientB2BPricingInspection
// payload as audit-friendly cards/tables.
//
// No edit / apply / override — strictly read-only.
//////////////////////////////////////////////////////

type Inspection = {
  generatedAt: string
  lot: {
    id: string
    lotNumber: string
    name: string | null
    status: string
    variety: string
    process: string
    harvestYear: number | null
    scaScore: number | null
    altitude: number | null
    country: string | null
    region: string | null
    producerName: string | null
    farmName: string | null
    availableGreenKg: number
    availableRoastedKg: number
    roastYield: number
    currency: string
  }
  persisted: {
    producerGreenPricePerKg: number | null
    legacyClientGreenPricePerKg: number | null
    clientB2BPricePerKg: number | null
    clientB2BPricingVersion: string | null
    clientB2BPricingMode: string | null
    clientB2BPriceComputedAt: string | null
    pricingSource: string
  }
  recomputed: {
    clientB2BPricePerKg: number | null
    pricingVersion: string | null
    pricingMode: string | null
    commercialModel: string | null
    pricingSource: string
    warnings: string[]
  }
  delta: {
    absolute: number | null
    percent: number | null
    status: "MATCH" | "DRIFT_LOW" | "DRIFT_HIGH" | "NO_PERSISTED" | "NO_RECOMPUTE"
  }
  producer: {
    greenPricePerKg: number | null
    originEquivalentRoastedPricePerKg: number | null
    breakdown: unknown[]
  }
  target: {
    ok: boolean
    sourceVersion: string | null
    pricingClass: string | null
    low: number | null
    expected: number | null
    high: number | null
    scaBucket: string | null
    altitudeBucket: string | null
    countryGroup: string | null
    reasons: string[]
  }
  commercial: {
    costPlusFinal: number | null
    marketAnchoredPrice: number | null
    finalBeforeClamp: number | null
    clampMin: number | null
    clampMax: number | null
    clampApplied: boolean | null
    softScarcityModifier: number | null
    softMarketSignalModifier: number | null
    softPrestigeModifier: number | null
  }
  marketSignal: {
    id: string | null
    cPrice: number | null
    demandIndex: number | null
    source: string | null
    validFrom: string | null
    expiresAt: string | null
    used: boolean
  }
  allocation: {
    recommendedSurface: string | null
    contractAssignableGreenKg: number | null
    contractAssignableRoastedKg: number | null
    marketplaceGreenKg: number | null
    marketplaceRoastedKg: number | null
    exclusiveMicrolotGreenKg: number | null
    blockedGreenKg: number | null
    reasons: Array<{ code: string; severity: string; message: string }>
  }
  visibility: {
    appearsInMarketplace: boolean
    appearsInContractCatalog: boolean
    pricingSourceMarketplace: string | null
    pricingSourceContractCatalog: string | null
  }
  breakdown: {
    persistedClientB2B: unknown | null
    recomputedClientB2B: unknown[]
    producerGreen: unknown[]
    raw?: unknown
  }
}

export default function PricingLotInspector({ greenLotId }: { greenLotId: string }) {

  const [data, setData] = useState<Inspection | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/internal/pricing/lot/${encodeURIComponent(greenLotId)}`, {
          credentials: "include",
          cache: "no-store",
        })
        if (res.status === 404) {
          if (!cancelled) setErrorMsg("Lot not found.")
          return
        }
        if (!res.ok) throw new Error(`Inspector failed (${res.status})`)
        const body = (await res.json()) as Inspection
        if (!cancelled) setData(body)
      } catch (err) {
        if (!cancelled) setErrorMsg(err instanceof Error ? err.message : "Inspector failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [greenLotId])

  return (
    <div className="min-h-screen bg-[#f6f1e8] px-8 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <a
            href="/dev/pricing"
            className="text-[12px] uppercase tracking-[0.18em] text-[#9a7b55] hover:text-[#7a5230]"
          >
            ← Pricing inspector
          </a>
        </div>

        {loading ? (
          <p className="text-sm text-[#6b5a45]">Loading…</p>
        ) : errorMsg ? (
          <ErrorBlock message={errorMsg} />
        ) : data ? (
          <Body data={data} />
        ) : (
          <p className="text-sm text-[#6b5a45]">No data.</p>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------
// BODY
// ------------------------------------------------------

function Body({ data }: { data: Inspection }) {
  return (
    <>
      {/* HEADER */}
      <div className="mb-8">
        <p className="text-[12px] uppercase tracking-[0.22em] text-[#9a7b55]">
          Lot inspector · {data.lot.status}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[#2f2418]">
          {data.lot.name ?? data.lot.lotNumber}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[#6b5a45]">
          <span className="font-mono text-[12.5px] text-[#7a5230]">{data.lot.lotNumber}</span>
          {" · "}
          {data.lot.variety} · {data.lot.process} ·{" "}
          SCA {data.lot.scaScore != null ? data.lot.scaScore.toFixed(2) : "—"} ·{" "}
          {data.lot.altitude != null ? `${data.lot.altitude.toLocaleString()} m` : "—"} ·{" "}
          {[data.lot.region, data.lot.country].filter(Boolean).join(", ") || "—"}
        </p>
      </div>

      {/* PRICE SUMMARY */}
      <Section emoji="💰" title="Price summary">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PriceCard
            label="Persisted B2B"
            value={fmtPrice(data.persisted.clientB2BPricePerKg, data.lot.currency)}
            source={data.persisted.pricingSource}
            footer={
              data.persisted.clientB2BPriceComputedAt
                ? `Computed ${fmtDate(data.persisted.clientB2BPriceComputedAt)}`
                : "Never persisted"
            }
          />
          <PriceCard
            label="Recomputed B2B"
            value={fmtPrice(data.recomputed.clientB2BPricePerKg, data.lot.currency)}
            source={data.recomputed.pricingSource}
            footer={
              data.recomputed.pricingMode
                ? `${data.recomputed.commercialModel ?? "—"} · ${data.recomputed.pricingMode}`
                : data.recomputed.warnings[0] ?? "—"
            }
          />
          <PriceCard
            label={`Delta (${data.delta.status})`}
            value={
              data.delta.absolute != null
                ? `${data.delta.absolute > 0 ? "+" : ""}${data.delta.absolute.toFixed(2)} ${data.lot.currency}`
                : "—"
            }
            source={
              data.delta.percent != null
                ? `${data.delta.percent > 0 ? "+" : ""}${data.delta.percent.toFixed(2)}%`
                : "—"
            }
            tone={deltaTone(data.delta.status)}
            footer={`Recomputed − Persisted`}
          />
          <PriceCard
            label="Legacy green-equivalent"
            value={fmtPrice(data.producer.originEquivalentRoastedPricePerKg, data.lot.currency)}
            source="LEGACY_GREEN_EQUIVALENT"
            footer={`Yield ${data.lot.roastYield.toFixed(2)} · clientPricePerKg ${fmtPrice(data.persisted.legacyClientGreenPricePerKg, data.lot.currency)} (GREEN)`}
          />
          <PriceCard
            label="Producer green"
            value={fmtPrice(data.producer.greenPricePerKg, data.lot.currency)}
            source={null}
            footer={
              data.persisted.producerGreenPricePerKg != null
                ? `Persisted ${fmtPrice(data.persisted.producerGreenPricePerKg, data.lot.currency)}`
                : "—"
            }
          />
          <PriceCard
            label="Available volume"
            value={`${data.lot.availableRoastedKg.toLocaleString()} kg roasted`}
            source={null}
            footer={`${data.lot.availableGreenKg.toLocaleString()} kg green`}
          />
        </div>
      </Section>

      {/* TARGET TABLE */}
      <Section emoji="🎯" title="Target table">
        <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
          {data.target.ok ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Cell label="Pricing class"   value={data.target.pricingClass ?? "—"} mono />
              <Cell label="Source version"  value={data.target.sourceVersion ?? "—"} mono />
              <Cell label="Country group"   value={data.target.countryGroup ?? "—"} mono />
              <Cell label="SCA bucket"      value={data.target.scaBucket ?? "—"} mono />
              <Cell label="Altitude bucket" value={data.target.altitudeBucket ?? "—"} mono />
              <Cell label="Expected"        value={fmtPrice(data.target.expected, data.lot.currency)} mono accent />
              <Cell label="Low"             value={fmtPrice(data.target.low, data.lot.currency)} mono />
              <Cell label="High"            value={fmtPrice(data.target.high, data.lot.currency)} mono />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#d8a89a] bg-[#fbf0eb] p-4 text-sm text-[#7a3a18]">
              Target row not applied. Reasons:{" "}
              {data.target.reasons.length > 0
                ? data.target.reasons.join(" · ")
                : "(none surfaced — recompute may have skipped)"}
            </div>
          )}
        </div>
      </Section>

      {/* COMMERCIAL MODEL */}
      <Section emoji="🏷️" title="Commercial model">
        <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
          <div className="grid gap-4 sm:grid-cols-3">
            <Cell label="Commercial model"           value={data.recomputed.commercialModel ?? "—"} mono />
            <Cell label="Cost-plus final"            value={fmtPrice(data.commercial.costPlusFinal, data.lot.currency)} mono />
            <Cell label="Market-anchored price"      value={fmtPrice(data.commercial.marketAnchoredPrice, data.lot.currency)} mono />
            <Cell label="Final before clamp"         value={fmtPrice(data.commercial.finalBeforeClamp, data.lot.currency)} mono />
            <Cell label="Clamp min"                  value={fmtPrice(data.commercial.clampMin, data.lot.currency)} mono />
            <Cell label="Clamp max"                  value={fmtPrice(data.commercial.clampMax, data.lot.currency)} mono />
            <Cell label="Clamp applied"              value={data.commercial.clampApplied == null ? "—" : data.commercial.clampApplied ? "Yes" : "No"} mono />
            <Cell label="Soft · scarcity modifier"   value={fmtRatio(data.commercial.softScarcityModifier)} mono />
            <Cell label="Soft · market signal mod"   value={fmtRatio(data.commercial.softMarketSignalModifier)} mono />
            <Cell label="Soft · prestige modifier"   value={fmtRatio(data.commercial.softPrestigeModifier)} mono />
          </div>
        </div>
      </Section>

      {/* MARKET SIGNAL */}
      <Section emoji="📡" title="Market signal">
        <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
          {data.marketSignal.id ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Cell label="cPrice (¢/lb)"   value={data.marketSignal.cPrice != null ? data.marketSignal.cPrice.toFixed(1) : "—"} mono />
              <Cell label="Demand index"    value={data.marketSignal.demandIndex != null ? data.marketSignal.demandIndex.toFixed(3) : "—"} mono />
              <Cell label="Source"          value={data.marketSignal.source ?? "—"} mono />
              <Cell label="Valid from"      value={fmtDate(data.marketSignal.validFrom)} mono />
              <Cell label="Expires"         value={fmtDate(data.marketSignal.expiresAt)} mono />
              <Cell label="Used by engine?" value={data.marketSignal.used ? "Yes" : "No"} mono accent={data.marketSignal.used} />
            </div>
          ) : (
            <p className="text-sm text-[#7b6851]">
              No active <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 font-mono">MarketSignalSnapshot</code>.
              Recompute ran deterministic.
            </p>
          )}
        </div>
      </Section>

      {/* ALLOCATION + VISIBILITY */}
      <Section emoji="🛰️" title="Allocation & visibility">
        <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
          <div className="grid gap-4 sm:grid-cols-3">
            <Cell label="Recommended surface" value={data.allocation.recommendedSurface ?? "—"} mono accent />
            <Cell label="Marketplace?"        value={data.visibility.appearsInMarketplace ? "Yes" : "No"} mono />
            <Cell label="Contract catalog?"   value={data.visibility.appearsInContractCatalog ? "Yes" : "No"} mono />

            <Cell label="Contract green kg"   value={fmtKg(data.allocation.contractAssignableGreenKg)} mono />
            <Cell label="Contract roasted kg" value={fmtKg(data.allocation.contractAssignableRoastedKg)} mono />
            <Cell label="Blocked green kg"    value={fmtKg(data.allocation.blockedGreenKg)} mono />

            <Cell label="Marketplace green kg"  value={fmtKg(data.allocation.marketplaceGreenKg)} mono />
            <Cell label="Marketplace roasted kg" value={fmtKg(data.allocation.marketplaceRoastedKg)} mono />
            <Cell label="Exclusive microlot kg" value={fmtKg(data.allocation.exclusiveMicrolotGreenKg)} mono />

            <Cell label="Pricing source · marketplace"
                  value={data.visibility.pricingSourceMarketplace ?? "—"} mono />
            <Cell label="Pricing source · catalog"
                  value={data.visibility.pricingSourceContractCatalog ?? "—"} mono />
            <Cell label="Yield"
                  value={data.lot.roastYield.toFixed(3)} mono />
          </div>

          {data.allocation.reasons.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a8b73]">
                Allocation reasons
              </div>
              <ul className="space-y-1 text-[12.5px]">
                {data.allocation.reasons.map((r, i) => (
                  <li key={i} className="rounded border border-[#e2d6bd] bg-[#fcfaf6] px-3 py-2">
                    <span className="font-mono text-[11.5px] text-[#7a5230]">{r.code}</span>
                    <span className="ml-2 rounded-full border border-[#cfb48a] bg-[#f3e9d7] px-2 py-0.5 text-[10px] text-[#7a5230]">
                      {r.severity}
                    </span>
                    <span className="ml-2 text-[#2f2418]">{r.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {/* RECOMPUTE WARNINGS */}
      {data.recomputed.warnings.length > 0 && (
        <Section emoji="⚠️" title="Recompute warnings">
          <div className="rounded-2xl border border-[#d8a89a] bg-[#fbf0eb] p-4">
            <ul className="space-y-1 text-[13px] text-[#8a3a25]">
              {data.recomputed.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* BREAKDOWNS */}
      <Section emoji="🧾" title="Breakdowns">
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownCard
            title="Recomputed B2B"
            data={data.breakdown.recomputedClientB2B}
          />
          <BreakdownCard
            title="Producer green"
            data={data.breakdown.producerGreen}
          />
          <BreakdownCard
            title="Persisted client B2B (DB)"
            data={data.breakdown.persistedClientB2B}
          />
          <BreakdownCard
            title="Persisted raw breakdown (DB)"
            data={data.breakdown.raw ?? null}
          />
        </div>
      </Section>
    </>
  )
}

// ------------------------------------------------------
// SUBCOMPONENTS
// ------------------------------------------------------

function Section({
  emoji, title, children,
}: {
  emoji: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-12">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[15px]">{emoji}</span>
        <h2 className="text-[16px] font-semibold text-[#2f2418]">{title}</h2>
        <div className="ml-2 h-[1px] flex-1 bg-[#bfae92]/40" />
      </div>
      {children}
    </div>
  )
}

function PriceCard({
  label, value, source, footer, tone,
}: {
  label: string
  value: string
  source: string | null
  footer: string
  tone?: "amber" | "emerald" | "bronze" | "danger"
}) {
  const toneStyle =
    tone === "emerald" ? { borderColor: "#b7cbb0", background: "#f4f8f2", color: "#3a6b35" } :
    tone === "amber"   ? { borderColor: "#d8c89a", background: "#fef3d7", color: "#7a5c0a" } :
    tone === "danger"  ? { borderColor: "#d8a89a", background: "#fbf0eb", color: "#8a3a25" } :
                         { borderColor: "#d8c5a8", background: "#fbf7f0", color: "#7a5230" }
  return (
    <div
      className="rounded-2xl border-2 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
      style={{ borderColor: toneStyle.borderColor, background: toneStyle.background }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a8b73]">
        {label}
      </div>
      <div
        className="mt-2 text-[24px] font-semibold tabular-nums"
        style={{ color: toneStyle.color, letterSpacing: "-0.015em" }}
        title={value}
      >
        {value}
      </div>
      {source && (
        <div className="mt-1 text-[10.5px] uppercase tracking-[0.16em] text-[#9a8b73]">
          {source}
        </div>
      )}
      <div className="mt-3 text-[11.5px] text-[#7b6851]">{footer}</div>
    </div>
  )
}

function Cell({
  label, value, mono, accent,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a8b73]">
        {label}
      </div>
      <div
        className={`mt-1 text-[14px] ${accent ? "font-semibold text-[#7a5230]" : "text-[#2f2418]"} ${mono ? "tabular-nums font-mono text-[13px]" : ""}`}
        title={value}
      >
        {value}
      </div>
    </div>
  )
}

function BreakdownCard({
  title, data,
}: {
  title: string
  data: unknown
}) {
  return (
    <details
      className="rounded-2xl border border-[#d8c5a8] bg-[#fbf7f0] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)]"
    >
      <summary className="cursor-pointer text-[12px] uppercase tracking-[0.18em] text-[#7a5230]">
        {title}
      </summary>
      <pre className="mt-3 max-h-[420px] overflow-auto rounded bg-[#f3ead7] p-3 text-[11.5px] leading-relaxed text-[#2f2418]">
        {data == null
          ? "— null —"
          : Array.isArray(data) && data.length === 0
            ? "— empty —"
            : JSON.stringify(data, null, 2)}
      </pre>
    </details>
  )
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-[#d8a89a] bg-[#fbf0eb] p-6">
      <div className="text-[14px] font-semibold text-[#8a3a25]">Inspector error</div>
      <p className="mt-2 text-[12.5px] text-[#7b6851]">{message}</p>
      <a
        href="/dev/pricing"
        className="mt-4 inline-block rounded-lg border border-[#cfb48a] bg-white px-3 py-2 text-[12px] font-medium text-[#5f472f] hover:bg-[#f7f2ea]"
      >
        ← Back to pricing inspector
      </a>
    </div>
  )
}

// ------------------------------------------------------
// FORMATTERS
// ------------------------------------------------------

function deltaTone(status: Inspection["delta"]["status"]):
  | "amber" | "emerald" | "bronze" | "danger" | undefined {
  switch (status) {
    case "MATCH":         return "emerald"
    case "DRIFT_HIGH":    return "amber"
    case "DRIFT_LOW":     return "danger"
    case "NO_PERSISTED":  return "bronze"
    case "NO_RECOMPUTE":  return "bronze"
    default:              return undefined
  }
}

function fmtPrice(value: number | null | undefined, currency: string): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€"
  return `${symbol}${value.toFixed(2)}`
}

function fmtRatio(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `×${value.toFixed(3)}`
}

function fmtKg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${Math.round(value).toLocaleString()} kg`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "—"
  return new Date(t).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}
