"use client"

import { useEffect, useState } from "react"
import { DEV_CONTRACT_SCENARIO_KINDS } from "@/src/services/dev/scenarios/devContractScenario.types"

//////////////////////////////////////////////////////
// 🧪 DEV CONTRACT SCENARIO PANEL
//
// Calls the three /api/dev/scenarios/contracts routes.
// Visually consistent with DevLotScenarioPanel (cream/beige
// dev tooling). Contract scenarios DO NOT create lots —
// seed marketplace/catalog lots first via /dev/scenarios/lots.
//////////////////////////////////////////////////////

type ScenarioKind = (typeof DEV_CONTRACT_SCENARIO_KINDS)[number]

type SeedResponse = {
  ok: true
  scenario: ScenarioKind
  appliedSeed: string
  contractsCreated: Array<{
    id: string
    status: string
    monthlyVolumeKg: number
    monthlyGreenKg: number | null
    durationMonths: number
    lockedPricePerKg: number | null
  }>
  demandIntentsCreated: Array<{
    id: string
    status: string
    requestedKg: number
    deltaKg: number
    previewPricePerKg: number | null
  }>
  lotsUsed: Array<{
    greenLotId: string
    lotNumber: string
    variety: string
    scaScore: number | null
    clientB2BPricePerKg: number | null
  }>
  resetSummary?: {
    contractsDeleted: number
    demandIntentsDeleted: number
    signatureTokensDeleted: number
    ordersDeleted: number
    warnings: string[]
  } | null
}

type StatusResponse = {
  generatedAt: string
  devClient: { userEmail: string; companyName: string; companyId: string | null }
  contracts: number
  demandIntents: number
  recentContracts: Array<{
    id: string
    status: string
    monthlyVolumeKg: number
    durationMonths: number
    remainingMonths: number
    lockedPricePerKg: number | null
    greenLotId: string | null
    lotNumber: string | null
    variety: string | null
    createdAt: string
  }>
  recentDemandIntents: Array<{
    id: string
    status: string
    requestedKg: number
    deltaKg: number
    previewPricePerKg: number | null
    greenLotId: string | null
    lotNumber: string | null
    createdAt: string
  }>
}

const SCENARIO_OPTIONS: ReadonlyArray<{ value: ScenarioKind; label: string; blurb: string }> = [
  {
    value: "empty_contracts",
    label: "1. Empty contracts",
    blurb:
      "Resets all dev contract data and leaves marketplace/catalog lots untouched. Dashboard should show catalog-first state.",
  },
  {
    value: "one_pending_signature",
    label: "2. One pending signature",
    blurb:
      "Creates one AWAITING_SIGNATURE contract. Portfolio KPI shows pending signature = 1.",
  },
  {
    value: "one_active_contract",
    label: "3. One active contract",
    blurb:
      "Creates one ACTIVE monthly contract with locked B2B price, next-execution date, and a 12-month duration.",
  },
  {
    value: "mixed_contract_portfolio",
    label: "4. Mixed contract portfolio",
    blurb:
      "Creates ACTIVE + AWAITING_SIGNATURE + PAYMENT_PENDING + COMPLETED contracts so ContractPortfolioPanel cells are realistically populated.",
  },
  {
    value: "demand_intent_pending",
    label: "5. Demand intent pending",
    blurb:
      "Creates one OPEN demand intent (no signed contract) so the Pending Requests KPI fires.",
  },
]

export default function DevContractScenarioPanel() {

  const [scenario, setScenario] = useState<ScenarioKind>("one_active_contract")
  const [seedInput, setSeedInput] = useState<string>("")
  const [seeding, setSeeding] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SeedResponse | null>(null)

  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState<boolean>(true)

  const loadStatus = async () => {
    setStatusLoading(true)
    try {
      const res = await fetch("/api/dev/scenarios/contracts/status", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) return
      const body = (await res.json()) as StatusResponse
      setStatus(body)
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => { loadStatus() }, [])

  const onSeed = async () => {
    setLastMessage(null)
    setLastError(null)
    setLastResult(null)
    try {
      setSeeding(true)
      const body: Record<string, unknown> = { scenario }
      if (seedInput.trim().length > 0) body.seed = seedInput.trim()
      const res = await fetch("/api/dev/scenarios/contracts/seed", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json() as SeedResponse | { error?: string; code?: string }
      if (!res.ok) {
        const errMsg = "error" in data && typeof data.error === "string"
          ? data.error
          : `Seed failed (${res.status})`
        throw new Error(errMsg)
      }
      const seedData = data as SeedResponse
      setLastResult(seedData)
      setLastMessage(
        `Seeded ${seedData.contractsCreated.length} contract${seedData.contractsCreated.length === 1 ? "" : "s"}` +
        ` and ${seedData.demandIntentsCreated.length} intent${seedData.demandIntentsCreated.length === 1 ? "" : "s"} ` +
        `(${seedData.scenario}). Reset removed ${seedData.resetSummary?.contractsDeleted ?? 0} prior contract${(seedData.resetSummary?.contractsDeleted ?? 0) === 1 ? "" : "s"}.`
      )
      await loadStatus()
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Seed failed")
    } finally {
      setSeeding(false)
    }
  }

  const onReset = async () => {
    setLastMessage(null)
    setLastError(null)
    setLastResult(null)
    if (!confirm("Delete every dev-generated Contract + DemandIntent + SignatureToken for the dev client company? Lots/catalog stay intact.")) {
      return
    }
    try {
      setResetting(true)
      const res = await fetch("/api/dev/scenarios/contracts/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error((data && typeof data.error === "string") ? data.error : `Reset failed (${res.status})`)
      }
      const parts = Object.entries(data)
        .filter(([k, v]) => k !== "warnings" && typeof v === "number" && (v as number) > 0)
        .map(([k, v]) => `${k}: ${v}`)
      setLastMessage(parts.length > 0 ? `Reset complete — ${parts.join(", ")}` : "Reset complete — nothing to delete.")
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        setLastError(data.warnings.join(" · "))
      }
      await loadStatus()
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Reset failed")
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f1e8] px-8 py-10">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}
        <div className="mb-8">
          <p className="text-[12px] uppercase tracking-[0.22em] text-[#9a7b55]">
            Dev Tools
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#2f2418]">
            Dev Contract Scenario Factory
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-[#6b5a45]">
            Seed and reset dev-only Contract + DemandIntent rows against existing
            DEV-SCENARIO lots so <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 font-mono text-[12px]">/platform/client</code>{" "}
            states can be reproduced deterministically. <strong>Contract scenarios do not
            create lots</strong> — seed marketplace / catalog lots first via{" "}
            <a className="underline" href="/dev/scenarios/lots">/dev/scenarios/lots</a>.
          </p>
        </div>

        <div className="mb-10 flex flex-wrap gap-3">
          <a
            href="/platform/client"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#cfb48a] bg-[#f7efdf] px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#efe3ce]"
          >
            Open client dashboard
          </a>
          <a
            href="/dev/scenarios/lots"
            className="rounded-full border border-[#cfb48a] bg-[#f7efdf] px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#efe3ce]"
          >
            Open lot scenarios
          </a>
          <button
            type="button"
            onClick={loadStatus}
            className="rounded-full border border-[#cfb48a] bg-white px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#f7f2ea]"
          >
            Refresh
          </button>
        </div>

        {/* CONTROLS */}
        <Section emoji="🎛️" title="Contract scenarios">
          <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <Field label="Scenario">
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value as ScenarioKind)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]"
                >
                  {SCENARIO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Seed (optional, for traceability)">
                <input
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="Defaults to Date.now()"
                  maxLength={120}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]"
                />
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onSeed}
                disabled={seeding || resetting}
                className="rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#6f4726] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {seeding ? "Seeding…" : "Seed contracts"}
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={seeding || resetting}
                className="rounded-xl border border-[#d8a89a] bg-[#fbf0eb] px-4 py-3 text-sm font-medium text-[#8a3a25] transition hover:bg-[#fbe2da] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resetting ? "Resetting…" : "Reset dev contracts"}
              </button>
              <span className="self-center text-[11px] text-[#9a8b73]">
                Reset removes only rows owned by the dev contract company.
              </span>
            </div>

            {lastMessage && (
              <p className="mt-4 rounded-lg border border-[#b7cbb0] bg-[#f4f8f2] px-3 py-2 text-sm text-[#3a6b35]">
                {lastMessage}
              </p>
            )}
            {lastError && (
              <p className="mt-3 rounded-lg border border-[#d8a89a] bg-[#fbf0eb] px-3 py-2 text-sm text-[#8a3a25]">
                {lastError}
              </p>
            )}
          </div>
        </Section>

        {/* RECIPE EXPLANATIONS */}
        <Section emoji="📚" title="Scenario explanations">
          <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
            <ul className="space-y-3 text-sm text-[#5f472f]">
              {SCENARIO_OPTIONS.map((opt) => (
                <li key={opt.value} className="flex flex-col gap-1">
                  <span className="font-semibold text-[#2f2418]">{opt.label}</span>
                  <span className="text-[#6b5a45]">{opt.blurb}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* LAST SEED RESULT */}
        {lastResult && (
          <Section emoji="🧾" title="Last seed result">
            <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
              <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[#9a8b73]">
                Lots used by this scenario
              </div>
              {lastResult.lotsUsed.length === 0 ? (
                <p className="text-sm text-[#6b5a45]">No lots needed for this scenario.</p>
              ) : (
                <ul className="space-y-1 text-[12.5px]">
                  {lastResult.lotsUsed.map((lot) => (
                    <li key={lot.greenLotId} className="rounded border border-[#e2d6bd] bg-[#fcfaf6] px-3 py-2">
                      <span className="font-mono text-[#7a5230]">{lot.lotNumber}</span>
                      <span className="ml-2 text-[#2f2418]">{lot.variety}</span>
                      <span className="ml-2 text-[#9a8b73]">SCA {lot.scaScore != null ? lot.scaScore.toFixed(2) : "—"}</span>
                      {lot.clientB2BPricePerKg != null && (
                        <span className="ml-2 text-[#7a5230]">€{lot.clientB2BPricePerKg.toFixed(2)}/kg</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
        )}

        {/* CURRENT STATUS */}
        <Section emoji="📦" title="Current dev contract data">
          <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
            <Pill label={`Contracts: ${status?.contracts ?? 0}`} />
            <Pill label={`Demand intents: ${status?.demandIntents ?? 0}`} />
            <Pill label={`Company: ${status?.devClient.companyName ?? "—"}`} />
          </div>
          {statusLoading ? (
            <p className="text-sm text-[#6b5a45]">Loading…</p>
          ) : (status?.contracts ?? 0) === 0 && (status?.demandIntents ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-6 text-sm text-[#7b6851]">
              No dev contract scenarios seeded yet. Pick a scenario above and click <strong>Seed contracts</strong>.
            </div>
          ) : (
            <div className="space-y-6">
              {status!.recentContracts.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#9a8b73]">
                    Recent contracts ({status!.recentContracts.length} of {status!.contracts})
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-[#d8c5a8] bg-[#fbf7f0] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
                    <table className="w-full text-left text-[12.5px]">
                      <thead className="bg-[#f3e9d7] text-[10.5px] uppercase tracking-[0.16em] text-[#7a5230]">
                        <tr>
                          <Th>Status</Th>
                          <Th>Lot</Th>
                          <Th>Variety</Th>
                          <Th align="right">Monthly (roasted)</Th>
                          <Th align="right">Months left</Th>
                          <Th align="right">Locked €/kg</Th>
                          <Th>Created</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {status!.recentContracts.map((c) => (
                          <tr key={c.id} className="border-t border-[#e2d6bd] text-[#2f2418]">
                            <Td><StatusBadge status={c.status} /></Td>
                            <Td mono>{c.lotNumber ?? "—"}</Td>
                            <Td>{c.variety ?? "—"}</Td>
                            <Td align="right" mono>{Math.round(c.monthlyVolumeKg).toLocaleString()} kg</Td>
                            <Td align="right" mono>{c.remainingMonths} / {c.durationMonths}</Td>
                            <Td align="right" mono>{c.lockedPricePerKg != null ? `€${c.lockedPricePerKg.toFixed(2)}` : "—"}</Td>
                            <Td mono>{fmtDate(c.createdAt)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {status!.recentDemandIntents.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#9a8b73]">
                    Recent demand intents ({status!.recentDemandIntents.length} of {status!.demandIntents})
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-[#d8c5a8] bg-[#fbf7f0] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
                    <table className="w-full text-left text-[12.5px]">
                      <thead className="bg-[#f3e9d7] text-[10.5px] uppercase tracking-[0.16em] text-[#7a5230]">
                        <tr>
                          <Th>Status</Th>
                          <Th>Lot</Th>
                          <Th align="right">Requested (roasted)</Th>
                          <Th align="right">Δ green</Th>
                          <Th align="right">Preview €/kg</Th>
                          <Th>Created</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {status!.recentDemandIntents.map((i) => (
                          <tr key={i.id} className="border-t border-[#e2d6bd] text-[#2f2418]">
                            <Td><StatusBadge status={i.status} /></Td>
                            <Td mono>{i.lotNumber ?? "—"}</Td>
                            <Td align="right" mono>{Math.round(i.requestedKg).toLocaleString()} kg</Td>
                            <Td align="right" mono>{Math.round(i.deltaKg).toLocaleString()} kg</Td>
                            <Td align="right" mono>{i.previewPricePerKg != null ? `€${i.previewPricePerKg.toFixed(2)}` : "—"}</Td>
                            <Td mono>{fmtDate(i.createdAt)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}

// ------------------------------------------------------
// SUBCOMPONENTS
// ------------------------------------------------------

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-[#5f472f]">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[#9a8b73]">{label}</span>
      {children}
    </label>
  )
}

function Pill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[#c4b28e] bg-[#f3e9d7] px-2.5 py-1 font-medium text-[#7a5230]">
      {label}
    </span>
  )
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>
  )
}

function Td({ children, align, mono, title }: { children: React.ReactNode; align?: "right"; mono?: boolean; title?: string }) {
  return (
    <td
      title={title}
      className={[
        "px-3 py-2",
        align === "right" ? "text-right" : "",
        mono ? "tabular-nums font-mono text-[12px]" : "",
      ].join(" ").trim()}
    >
      {children}
    </td>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ACTIVE"             ? "bg-[#e8f0e6] text-[#3a6b35] border-[#b7cbb0]" :
    status === "AWAITING_SIGNATURE" ? "bg-[#fef3d7] text-[#7a5c0a] border-[#d8c89a]" :
    status === "PAYMENT_PENDING"    ? "bg-[#f7efdf] text-[#5f472f] border-[#cfb48a]" :
    status === "COMPLETED"          ? "bg-[#e2d6bd] text-[#5f472f] border-[#cfb48a]" :
    status === "OPEN"               ? "bg-[#e8f0e6] text-[#3a6b35] border-[#b7cbb0]" :
    status === "WAITING"            ? "bg-[#fef3d7] text-[#7a5c0a] border-[#d8c89a]" :
                                       "bg-[#efe7da] text-[#7a5c2e] border-[#cfb48a]"
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${cls}`}>
      {status}
    </span>
  )
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "—"
  return new Date(t).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}
