"use client"

import { useEffect, useState } from "react"
import { SCENARIO_LIMITS } from "@/src/services/dev/scenarios/devLotScenario.types"

//////////////////////////////////////////////////////
// 🧪 DEV LOT SCENARIO FACTORY — UI
//
// Calls the three /api/dev/scenarios/lots routes and
// renders a calm dev-tool layout matching app/dev/logistics.
// No charts, no fancy visuals — controls + summary table.
//////////////////////////////////////////////////////

type ScenarioKind =
  | "allocation_engine_decides"
  | "marketplace_mix"
  | "contract_catalog_mix"
  | "exclusive_microlots"
  | "large_split_lots"
  | "logistics_ready"
  | "stress_25_lots"

type TargetStage = "published" | "destination_received"

type DevLot = {
  id: string
  lotNumber: string
  name: string | null
  status: string
  greenLotStatus: string
  availableKg: number
  scaScore: number | null
  variety: string
  process: string
  farmName: string
  shipmentReference: string | null
}

type ListResponse = {
  lots: DevLot[]
  counts: { drafts: number; greenLots: number; shipments: number }
}

type VariationMode = "deterministic" | "jittered"

type SeedResponse = {
  scenario: ScenarioKind
  targetStage: TargetStage
  variationMode: VariationMode
  appliedSeed: string | null
  created: {
    producerLotDrafts: number
    greenLots: number
    pricingSnapshots: number
    shipments: number
  }
  greenLots: DevLot[]
  shipment: { reference: string } | null
}

type ResetResponse = {
  deleted: {
    demandIntents: number
    contracts: number
    producerFulfilments: number
    pricingSnapshots: number
    shipments: number
    greenLots: number
    producerLotDrafts: number
  }
  warnings: string[]
}

const SCENARIO_OPTIONS: ReadonlyArray<{
  value: ScenarioKind
  label: string
  blurb: string
}> = [
  {
    value: "allocation_engine_decides",
    label: "1. Allocation engine decides",
    blurb:
      "Mixed boundary dataset. Creates real published lots and lets the allocation engine decide whether each lot belongs in marketplace, contract catalog, exclusive microlot, split, or hold.",
  },
  {
    value: "marketplace_mix",
    label: "2. Marketplace mix",
    blurb:
      "Open-marketplace residuals — small premium and short-volume lots that won't sustain monthly contracts.",
  },
  {
    value: "contract_catalog_mix",
    label: "3. Contract catalog mix",
    blurb:
      "Volume-rich lots that the engine should favour for monthly contracts; minimal marketplace residual expected.",
  },
  {
    value: "exclusive_microlots",
    label: "4. Exclusive microlots",
    blurb:
      "High-end rare lots (Geisha, Pink Bourbon, Wush Wush, Sudan Rume). Engine should classify as exclusive.",
  },
  {
    value: "large_split_lots",
    label: "5. Large split lots",
    blurb:
      "Very large lots (22–35 t) intended to surface SPLIT decisions — contract reserve plus marketplace residual.",
  },
  {
    value: "logistics_ready",
    label: "6. Logistics ready",
    blurb:
      "A handful of mid-volume PUBLISHED lots ready to be moved into Shipment + destination tracking.",
  },
  {
    value: "stress_25_lots",
    label: "7. Stress (25 lots)",
    blurb:
      "Mixed dataset of 25 lots covering every category — for UI density and engine throughput checks.",
  },
]

const STAGE_OPTIONS: ReadonlyArray<{ value: TargetStage; label: string }> = [
  { value: "published",            label: "PUBLISHED (default)" },
  { value: "destination_received", label: "DESTINATION RECEIVED (creates Shipment + RECEIVED_BY_CLIENT)" },
]

// All count values the dropdown can ever offer. The actual options
// rendered are filtered per-scenario via SCENARIO_LIMITS so a developer
// can't pick 25 for a preset that only ships 10 curated recipes.
const ALL_COUNT_OPTIONS = [3, 5, 8, 10, 15, 20, 25] as const

//////////////////////////////////////////////////////
// MAIN PANEL
//////////////////////////////////////////////////////

export default function DevLotScenarioPanel() {

  const [scenario, setScenario] = useState<ScenarioKind>("allocation_engine_decides")
  const [targetStage, setTargetStage] = useState<TargetStage>("published")
  const [count, setCount] = useState<number>(10)
  const [destinationCountry, setDestinationCountry] = useState<string>("")
  const [jitterMode, setJitterMode] = useState<boolean>(false)
  const [seedInput, setSeedInput] = useState<string>("")

  const [list, setList] = useState<DevLot[]>([])
  const [counts, setCounts] = useState<ListResponse["counts"]>({
    drafts: 0,
    greenLots: 0,
    shipments: 0,
  })

  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastAppliedSeed, setLastAppliedSeed] = useState<string | null>(null)
  const [lastVariationMode, setLastVariationMode] = useState<VariationMode | null>(null)

  const isJitterableScenario = scenario !== "allocation_engine_decides"

  // Force off when scenario is the regression preset.
  useEffect(() => {
    if (!isJitterableScenario && jitterMode) {
      setJitterMode(false)
    }
  }, [isJitterableScenario, jitterMode])

  //////////////////////////////////////////////////////
  // 🎚️ COUNT OPTIONS  (derived from current scenario)
  //
  // Each scenario ships a curated recipe set with a
  // hard maximum (see SCENARIO_LIMITS). The select hides
  // any option that would silently clamp on the server.
  //////////////////////////////////////////////////////

  const currentMax = SCENARIO_LIMITS[scenario].max
  const countOptions = ALL_COUNT_OPTIONS.filter((n) => n <= currentMax)

  // Clamp the selected count when scenario changes — e.g. picking
  // 25 under stress_25_lots and then switching to allocation_engine_decides
  // (max=10) would otherwise leave 25 in state and be silently capped.
  useEffect(() => {
    setCount((prev) => Math.min(prev, currentMax))
  }, [currentMax])

  // ─── LOAD ──────────────────────────────────────────
  const loadAll = async () => {
    try {
      const res = await fetch("/api/dev/scenarios/lots", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`Load failed (${res.status})`)
      const data = (await res.json()) as ListResponse
      setList(data.lots)
      setCounts(data.counts)
    } catch (error) {
      console.error(error)
      setLastError(error instanceof Error ? error.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // ─── SEED ─────────────────────────────────────────
  const onSeed = async () => {
    setLastMessage(null)
    setLastError(null)
    setLastAppliedSeed(null)
    setLastVariationMode(null)
    try {
      setSeeding(true)
      // Only forward variation fields when the user opted in. Empty seed is
      // omitted so the server resolves it (Date.now()) and echoes it back.
      const variationMode: VariationMode =
        jitterMode && isJitterableScenario ? "jittered" : "deterministic"
      const trimmedSeed = seedInput.trim()
      const seedField =
        variationMode === "jittered" && trimmedSeed.length > 0
          ? trimmedSeed
          : undefined

      const res = await fetch("/api/dev/scenarios/lots/seed", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          targetStage,
          count,
          destinationCountry: destinationCountry.trim() || undefined,
          variationMode,
          seed: seedField,
        }),
      })
      const data = (await res.json()) as SeedResponse | { error?: string }
      if (!res.ok) {
        const errMsg =
          "error" in data && typeof data.error === "string"
            ? data.error
            : `Seed failed (${res.status})`
        throw new Error(errMsg)
      }
      const seedData = data as SeedResponse
      const shipmentNote = seedData.shipment
        ? ` + Shipment ${seedData.shipment.reference}`
        : ""
      setLastMessage(
        `Seeded ${seedData.created.greenLots} GreenLot${seedData.created.greenLots === 1 ? "" : "s"} (${seedData.scenario} → ${seedData.targetStage})${shipmentNote}`
      )
      setLastVariationMode(seedData.variationMode)
      setLastAppliedSeed(seedData.appliedSeed)
      await loadAll()
    } catch (error) {
      console.error(error)
      setLastError(error instanceof Error ? error.message : "Seed failed")
    } finally {
      setSeeding(false)
    }
  }

  // ─── RESET ────────────────────────────────────────
  const onReset = async () => {
    setLastMessage(null)
    setLastError(null)
    if (!confirm("Delete every DEV-SCENARIO row? Producer + dev farms will stay intact.")) {
      return
    }
    try {
      setResetting(true)
      const res = await fetch("/api/dev/scenarios/lots/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
      const data = (await res.json()) as ResetResponse | { error?: string }
      if (!res.ok) {
        const errMsg =
          "error" in data && typeof data.error === "string"
            ? data.error
            : `Reset failed (${res.status})`
        throw new Error(errMsg)
      }
      const reset = data as ResetResponse
      const parts = Object.entries(reset.deleted)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k}: ${n}`)
      setLastMessage(
        parts.length > 0
          ? `Reset complete — ${parts.join(", ")}`
          : "Reset complete — nothing to delete."
      )
      if (reset.warnings.length > 0) {
        setLastError(reset.warnings.join(" · "))
      }
      await loadAll()
    } catch (error) {
      console.error(error)
      setLastError(error instanceof Error ? error.message : "Reset failed")
    } finally {
      setResetting(false)
    }
  }

  const stageDisabledForScenario =
    scenario === "allocation_engine_decides" ? "destination_received" : null

  return (
    <div className="min-h-screen bg-[#f6f1e8] px-8 py-10">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}
        <div className="mb-8">
          <p className="text-[12px] uppercase tracking-[0.22em] text-[#9a7b55]">
            Dev Tools
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#2f2418]">
            Dev Lot Scenario Factory
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[#6b5a45]">
            Seed real DB lots (ProducerLotDraft, GreenLot, PricingSnapshot,
            optionally Shipment) so marketplace, allocation engine, future
            contract catalog and logistics tracking can be exercised against
            realistic data.
          </p>
        </div>

        <div className="mb-10 flex flex-wrap gap-3">
          <a
            href="/platform/marketplace"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#cfb48a] bg-[#f7efdf] px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#efe3ce]"
          >
            Open marketplace
          </a>
          <a
            href="/api/internal/allocation/run"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#cfb48a] bg-[#f7efdf] px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#efe3ce]"
          >
            Open allocation dry run (JSON)
          </a>
          <a
            href="/dev/logistics"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#cfb48a] bg-[#f7efdf] px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#efe3ce]"
          >
            Open dev logistics
          </a>
          <button
            type="button"
            onClick={loadAll}
            className="rounded-full border border-[#cfb48a] bg-white px-4 py-2 text-sm font-medium text-[#5f472f] transition hover:bg-[#f7f2ea]"
          >
            Refresh
          </button>
        </div>

        {/* CONTROLS */}
        <Section emoji="🎛️" title="Controls">
          <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">

              {/* Scenario */}
              <Field label="Scenario">
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value as ScenarioKind)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]"
                >
                  {SCENARIO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Target stage */}
              <Field label="Target stage">
                <select
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value as TargetStage)}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]"
                >
                  {STAGE_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.value === stageDisabledForScenario}
                    >
                      {opt.label}
                      {opt.value === stageDisabledForScenario
                        ? " — blocked for this scenario"
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Count */}
              <Field label="Count">
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]"
                >
                  {countOptions.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <p className="text-[11px] text-[#9a8b73]">
                  This preset is capped at {currentMax} curated lot
                  {currentMax === 1 ? "" : "s"}.
                </p>
              </Field>

              {/* Destination country (optional) */}
              <Field label="Destination country (optional, only for DESTINATION RECEIVED)">
                <input
                  type="text"
                  value={destinationCountry}
                  onChange={(e) => setDestinationCountry(e.target.value)}
                  placeholder="Norway / Netherlands / …"
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418]"
                />
              </Field>

              {/* Variation mode (jitter toggle) */}
              <Field label="Variation mode">
                <label className="flex items-center gap-2 text-sm text-[#2f2418]">
                  <input
                    type="checkbox"
                    checked={jitterMode}
                    disabled={!isJitterableScenario}
                    onChange={(e) => setJitterMode(e.target.checked)}
                  />
                  <span>Jittered variant</span>
                </label>
                {!isJitterableScenario ? (
                  <p className="text-[11px] text-[#9a8b73]">
                    This preset is fixed for regression coverage — jitter is
                    intentionally disabled.
                  </p>
                ) : (
                  <p className="text-[11px] text-[#9a8b73]">
                    Adds reproducible per-seed variation to SCA, greenKg, and
                    farm. Variety + process are preserved.
                  </p>
                )}
              </Field>

              {/* Seed (only for jittered) */}
              <Field label="Seed (optional, jittered only)">
                <input
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="Leave empty to generate one"
                  disabled={!jitterMode || !isJitterableScenario}
                  maxLength={120}
                  className="w-full rounded-lg border border-[#cfb48a] bg-[#fffaf2] px-3 py-2 text-sm text-[#2f2418] disabled:bg-[#f1ead9] disabled:text-[#9a8b73]"
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
                {seeding ? "Seeding..." : "Seed scenario"}
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={seeding || resetting}
                className="rounded-xl border border-[#d8a89a] bg-[#fbf0eb] px-4 py-3 text-sm font-medium text-[#8a3a25] transition hover:bg-[#fbe2da] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resetting ? "Resetting..." : "Reset dev scenarios"}
              </button>
            </div>

            {lastMessage && (
              <p className="mt-4 rounded-lg border border-[#b7cbb0] bg-[#f4f8f2] px-3 py-2 text-sm text-[#3a6b35]">
                {lastMessage}
              </p>
            )}
            {lastVariationMode && (
              <p className="mt-3 rounded-lg border border-[#cfb48a] bg-[#f7efdf] px-3 py-2 text-xs text-[#5f472f]">
                <span className="font-semibold">Variation:</span>{" "}
                <span className="font-mono">{lastVariationMode}</span>
                {lastAppliedSeed != null && (
                  <>
                    {" · "}
                    <span className="font-semibold">Applied seed:</span>{" "}
                    <span className="select-all font-mono">{lastAppliedSeed}</span>
                  </>
                )}
              </p>
            )}
            {lastError && (
              <p className="mt-3 rounded-lg border border-[#d8a89a] bg-[#fbf0eb] px-3 py-2 text-sm text-[#8a3a25]">
                {lastError}
              </p>
            )}
          </div>
        </Section>

        {/* PRESET EXPLANATIONS */}
        <Section emoji="📚" title="Preset explanations">
          <div className="rounded-2xl border-2 border-[#d8c5a8] bg-[#fbf7f0] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
            <ul className="space-y-3 text-sm text-[#5f472f]">
              {SCENARIO_OPTIONS.map((opt) => (
                <li key={opt.value} className="flex flex-col gap-1">
                  <span className="font-semibold text-[#2f2418]">
                    {opt.label}
                  </span>
                  <span className="text-[#6b5a45]">{opt.blurb}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-lg border border-dashed border-[#cdb89a] bg-[#fcfaf6] px-3 py-2 text-[12px] text-[#7b6851]">
              <strong>Note:</strong> recipes describe lot SHAPES — volume, SCA,
              variety, process. They never pre-decide the allocation surface.
              Open <code className="rounded bg-[#ede4d4] px-1.5 py-0.5 font-mono">/api/internal/allocation/run</code>{" "}
              to see what the engine concludes.
            </p>
          </div>
        </Section>

        {/* CURRENT DEV DATA */}
        <Section emoji="📦" title="Current dev scenario data">
          <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
            <Pill label={`Drafts: ${counts.drafts}`} />
            <Pill label={`GreenLots: ${counts.greenLots}`} />
            <Pill label={`Shipments: ${counts.shipments}`} />
          </div>

          {loading ? (
            <p className="text-sm text-[#6b5a45]">Loading…</p>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cdb89a] bg-[#fcfaf6] p-8 text-sm text-[#7b6851]">
              No DEV-SCENARIO lots in the database yet. Pick a scenario above
              and click <strong>Seed scenario</strong>.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#d8c5a8] bg-[#fbf7f0] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f3e9d7] text-[11px] uppercase tracking-[0.18em] text-[#7a5230]">
                  <tr>
                    <Th>Lot #</Th>
                    <Th>Name</Th>
                    <Th>Farm</Th>
                    <Th>Variety</Th>
                    <Th>Process</Th>
                    <Th align="right">SCA</Th>
                    <Th align="right">Available</Th>
                    <Th>Status</Th>
                    <Th>Shipment</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((lot) => (
                    <tr key={lot.id} className="border-t border-[#e2d6bd] text-[#2f2418]">
                      <Td mono title={lot.lotNumber}>
                        <span className="block max-w-[260px] truncate">{lot.lotNumber}</span>
                      </Td>
                      <Td>{lot.name ?? "—"}</Td>
                      <Td>{lot.farmName}</Td>
                      <Td>{lot.variety}</Td>
                      <Td>{lot.process}</Td>
                      <Td align="right" mono>
                        {lot.scaScore != null ? lot.scaScore.toFixed(1) : "—"}
                      </Td>
                      <Td align="right" mono>
                        {lot.availableKg.toLocaleString()} kg
                      </Td>
                      <Td>
                        <StatusBadge status={lot.status} />
                      </Td>
                      <Td mono>
                        {lot.shipmentReference ?? "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}

//////////////////////////////////////////////////////
// SUBCOMPONENTS
//////////////////////////////////////////////////////

function Section({
  emoji,
  title,
  children,
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-[#5f472f]">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[#9a8b73]">
        {label}
      </span>
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

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  )
}

function Td({
  children,
  align,
  mono,
  title,
}: {
  children: React.ReactNode
  align?: "right"
  mono?: boolean
  title?: string
}) {
  return (
    <td
      title={title}
      className={[
        "px-3 py-2",
        align === "right" ? "text-right" : "",
        mono ? "tabular-nums font-mono text-[12.5px]" : "",
      ]
        .join(" ")
        .trim()}
    >
      {children}
    </td>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "PUBLISHED" ? "bg-[#e8f0e6] text-[#3a6b35] border-[#b7cbb0]" :
    status === "RESERVED"  ? "bg-[#fef3d7] text-[#7a5c0a] border-[#d8c89a]" :
    status === "SOLD"      ? "bg-[#f3e9d7] text-[#7a5230] border-[#cfb48a]" :
                             "bg-[#efe7da] text-[#7a5c2e] border-[#cfb48a]"
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  )
}
