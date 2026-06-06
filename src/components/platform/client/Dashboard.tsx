"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import PlatformHeader from "@/src/components/shared/general/PlatformHeader"
import CoffeeLoader from "@/src/components/shared/general/CoffeeLoader"
import { hideNavOverlay } from "@/src/lib/navigationOverlay"
import { initWebsocketClient } from "@/src/websocket/websocketClient"

import ClientDashboardHero from "@/src/components/platform/client/ClientDashboardHero"
import SupplyDeskPanel from "@/src/components/platform/client/SupplyDeskPanel"
import ContractPortfolioPanel from "@/src/components/platform/client/ContractPortfolioPanel"
import ContractCatalogStrip, {
  type ContractCatalogStripLot,
} from "@/src/components/platform/client/ClientContractCatalogPanel"
import SupplyContractsPanel from "@/src/components/platform/client/SupplyContractsPanel"
import ConfigureMonthlySupplyModal, {
  type ContractRequestLot,
} from "@/src/components/platform/client/ConfigureMonthlySupplyModal"
import { hasPendingRequestForLot } from "@/src/services/contract-request/contractRequest.pure"

import { COLORS, RADII, SPACING } from "@/src/components/platform/client/dashboardTokens"
import { computePortfolioMetrics } from "@/src/services/client-dashboard/contractPortfolioMetrics"
import {
  pickRecommendedContractLots,
  type RecommendedContractLot,
} from "@/src/services/client-dashboard/recommendedContractLots"
import { hasClientActivity } from "@/src/services/dev/scenarios/devContractScenario.pure"
import type { ContractCatalogLotDto } from "@/src/services/allocation/contracts/contractCatalog.mapper"

//////////////////////////////////////////////////////
// 🪟 CLIENT DASHBOARD
//
// Editorial dark UI built on the existing data feeds:
//   /api/contracts            — owned contracts list
//   /api/demand-intent        — pending intents
//   /api/market               — market totals (roasted available, lot count)
//   /api/contracts/catalog    — allocation-driven monthly catalog
//
// Layout:
//   - PlatformHeader
//   - ClientDashboardHero (KPI strip)
//   - 2-col: SupplyDeskPanel | ContractPortfolioPanel
//   - ContractCatalogStrip
//   - 3-col: SourcingRelationship · SupplyContracts · NeedHelp
//////////////////////////////////////////////////////

type CatalogResponse = {
  generatedAt: string
  policyVersion: string
  count: number
  lots: ContractCatalogLotDto[]
  metrics: {
    totalLots: number
    totalAssignableGreenKg: number
    totalAssignableRoastedKg: number
    avgScaScore: number | null
    origins: Array<{ country: string; roastedKg: number; percentage: number }>
    topProfiles: Array<{ profileId: string; lots: number }>
  }
}

export default function Dashboard({ user }: { user: any }) {

  // ─── DATA ─────────────────────────────────────────
  const [contracts, setContracts] = useState<any[]>([])
  const [marketData, setMarketData] = useState<any>(null)
  const [intents, setIntents] = useState<any[]>([])
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  const searchParams = useSearchParams()!
  const contractSuccess = searchParams.get("contract") === "success"
  const [showMessage, setShowMessage] = useState(contractSuccess)

  // ─── EFFECTS ─────────────────────────────────────

  useEffect(() => {
    if (!contractSuccess) return
    const t = setTimeout(() => setShowMessage(false), 4000)
    return () => clearTimeout(t)
  }, [contractSuccess])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/contracts", { credentials: "include" })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setContracts(data)
      } catch (err) {
        console.error("Error loading contracts", err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [contractSuccess])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/market")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setMarketData(data)
      } catch (err) {
        console.error("Error loading market", err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Lifted out of useEffect so the modal can trigger a refresh
  // after a request is created. State setters are stable across
  // renders, so the function reference stays useful.
  const refreshIntents = React.useCallback(async () => {
    try {
      const res = await fetch("/api/demand-intent")
      if (!res.ok) return
      const data = await res.json()
      setIntents(data.intents ?? [])
    } catch (err) {
      console.error("Error loading intents", err)
    }
  }, [])

  useEffect(() => {
    refreshIntents()
  }, [refreshIntents])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/contracts/catalog", {
          credentials: "include",
          cache: "no-store",
        })
        if (!res.ok) {
          throw new Error(`Catalog load failed (${res.status})`)
        }
        const data = (await res.json()) as CatalogResponse
        if (!cancelled) setCatalog(data)
      } catch (err) {
        console.error("Error loading catalog", err)
        if (!cancelled) {
          setCatalogError(err instanceof Error ? err.message : "Catalog load failed")
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => { initWebsocketClient() }, [])
  useEffect(() => { hideNavOverlay() }, [])

  // ─── LOADER ANIMATION ────────────────────────────

  const hasEnteredRef = useRef(false)
  const [entered, setEntered] = useState(false)
  const handleFinish = () => {
    if (hasEnteredRef.current) return
    hasEnteredRef.current = true
    setEntered(true)
  }

  // ─── DERIVED ─────────────────────────────────────

  const metrics = useMemo(
    () =>
      computePortfolioMetrics({
        contracts,
        intents,
        market: marketData,
        catalog: catalog?.metrics ?? null,
      }),
    [contracts, intents, marketData, catalog]
  )

  // DEV-CONTRACTS-1 / CLIENT-DASHBOARD-DATA-1: pivot dashboard
  // layout into catalog-first mode when the user has no active
  // or pending contracts / requests.
  const hasActivity = hasClientActivity(metrics)

  const recommendedLots: RecommendedContractLot[] = useMemo(
    () => pickRecommendedContractLots(catalog?.lots ?? [], 3),
    [catalog]
  )

  const catalogStripLots = useMemo(() => {
    if (!catalog) return []
    return catalog.lots.slice(0, 8).map((dto) => ({
      id: dto.id,
      lotNumber: dto.lotNumber,
      name: dto.name,
      producerName: dto.producerName,
      farmName: dto.farmName,
      region: dto.region,
      country: dto.country,
      process: dto.process,
      variety: dto.variety,
      scaScore: dto.scaScore,
      altitude: dto.altitude,
      contractAssignableRoastedKg: dto.contractAssignableRoastedKg,
      pricePerKgRoasted: dto.pricePerKgRoasted,
      currency: dto.currency,
      recommendedSurface: dto.recommendedSurface,
      badges: dto.badges,
      // DASHBOARD-IMAGES-1 — pass-through public media. DTO mapper
      // already filters PUBLIC_MARKET; the strip never re-filters.
      media: dto.media,
      primaryMedia: dto.primaryMedia,
      mediaSummary: dto.mediaSummary,
    }))
  }, [catalog])

  const catalogRef = useRef<HTMLDivElement | null>(null)
  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // ─── CONTRACT-REQUEST-1 — modal state ─────────────
  //
  // pendingRequestLotIds is rebuilt on every intents update so
  // CTAs grey out the moment a pending request appears.
  const pendingRequestLotIds = useMemo(() => {
    const set = new Set<string>()
    for (const i of intents ?? []) {
      if (i?.greenLotId && hasPendingRequestForLot([i], i.greenLotId)) {
        set.add(i.greenLotId)
      }
    }
    return set
  }, [intents])

  const [requestLot, setRequestLot] = useState<ContractRequestLot | null>(null)
  const openConfigureModal = (lot: ContractRequestLot) => setRequestLot(lot)
  const closeConfigureModal = () => setRequestLot(null)

  const recommendedToRequestLot = (lot: RecommendedContractLot): ContractRequestLot => ({
    id: lot.id,
    name: lot.name,
    producerName: null,
    region: lot.origin || null,
    country: null,
    variety: lot.variety,
    process: lot.process,
    scaScore: lot.scaScore,
    altitude: lot.altitude,
    pricePerKgRoasted: lot.pricePerKgRoasted,
    contractAssignableRoastedKg: lot.assignableRoastedKg,
    currency: lot.currency,
    media: lot.media,
    primaryMedia: lot.primaryMedia,
    mediaSummary: lot.mediaSummary,
  })

  const catalogStripToRequestLot = (lot: ContractCatalogStripLot): ContractRequestLot => ({
    id: lot.id,
    name: lot.name,
    producerName: lot.producerName ?? null,
    region: lot.region ?? null,
    country: lot.country ?? null,
    variety: lot.variety,
    process: lot.process,
    scaScore: lot.scaScore,
    altitude: lot.altitude,
    pricePerKgRoasted: lot.pricePerKgRoasted,
    contractAssignableRoastedKg: lot.contractAssignableRoastedKg,
    currency: lot.currency,
    media: lot.media,
    primaryMedia: lot.primaryMedia ?? null,
    mediaSummary: lot.mediaSummary,
  })

  return (
    <>
      {!entered && <CoffeeLoader onFinish={handleFinish} />}

      <div className={`transition-opacity duration-700 ease-out ${entered ? "opacity-100" : "opacity-0"}`}>

        <PlatformHeader user={user} />

        <div
          style={{
            minHeight: "100vh",
            background: `radial-gradient(ellipse at 0% 0%, rgba(214,176,79,0.04), transparent 55%), ${COLORS.bg}`,
            color: COLORS.textPrimary,
            paddingTop: "100px",
          }}
        >
          {/* HERO */}
          <section
            style={{
              maxWidth: SPACING.pageMaxWidth,
              margin: "0 auto",
              padding: `0 ${SPACING.pagePaddingX}px`,
            }}
          >
            <ClientDashboardHero
              userName={user?.name ?? null}
              kpis={{
                activeContracts: metrics.activeContracts,
                uniqueOrigins: metrics.uniqueOrigins,
                monthlyGreenKg: metrics.monthlyGreenKg,
                pendingRequests: metrics.pendingRequests,
                nextShipmentIso: metrics.nextShipment.dateIso,
                nextShipmentCountry: metrics.nextShipment.country,
                catalogLotsAvailable: metrics.contractCatalogLots,
              }}
            />
          </section>

          {/* SUCCESS BANNER */}
          {showMessage && (
            <div
              style={{
                maxWidth: SPACING.pageMaxWidth,
                margin: "20px auto 0",
                padding: `0 ${SPACING.pagePaddingX}px`,
              }}
            >
              <div
                style={{
                  padding: "14px 22px",
                  borderRadius: 12,
                  background: COLORS.emeraldBg,
                  border: `1px solid ${COLORS.emeraldLine}`,
                  color: "#9be8b3",
                  fontSize: 13,
                  letterSpacing: "0.02em",
                }}
              >
                Contract activated successfully.
              </div>
            </div>
          )}

          {/* RECOMMENDED FOR MONTHLY SUPPLY — full-width 3-card row */}
          <div
            style={{
              maxWidth: SPACING.pageMaxWidth,
              margin: "0 auto",
              padding: `28px ${SPACING.pagePaddingX}px 0`,
            }}
          >
            <SupplyDeskPanel
              lots={recommendedLots}
              loading={catalogLoading}
              errorMsg={catalogError}
              onScrollToCatalog={scrollToCatalog}
              onConfigureMonthlySupply={(lot) =>
                openConfigureModal(recommendedToRequestLot(lot))
              }
              pendingRequestLotIds={pendingRequestLotIds}
            />
          </div>

          {/* CATALOG (2/3) + PORTFOLIO SIDEBAR (1/3) — catalog-first hierarchy.
              When the client has no activity yet, the portfolio still renders
              with zeros and an empty-recent-contracts placeholder so the column
              isn't blank. */}
          <div
            style={{
              maxWidth: SPACING.pageMaxWidth,
              margin: "24px auto 0",
              padding: `0 ${SPACING.pagePaddingX}px`,
              display: "grid",
              gridTemplateColumns: hasActivity
                ? "minmax(0, 1.9fr) minmax(0, 1fr)"
                : "minmax(0, 2.3fr) minmax(0, 1fr)",
              gap: 24,
              alignItems: "stretch",
            }}
          >
            <ContractCatalogStrip
              ref={catalogRef}
              lots={catalogStripLots}
              loading={catalogLoading}
              errorMsg={catalogError}
              onConfigureMonthlySupply={(lot) =>
                openConfigureModal(catalogStripToRequestLot(lot))
              }
              pendingRequestLotIds={pendingRequestLotIds}
            />
            <ContractPortfolioPanel
              metrics={metrics}
              contracts={contracts}
              loading={catalogLoading}
            />
          </div>

          {/* BOTTOM ROW */}
          <div
            style={{
              maxWidth: SPACING.pageMaxWidth,
              margin: "0 auto",
              padding: `24px ${SPACING.pagePaddingX}px 80px`,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr)",
              gap: 24,
            }}
          >
            <SourcingRelationshipCard />
            <SupplyContractsPanel contracts={contracts as any} />
            <NeedHelpCard />
          </div>
        </div>
      </div>

      {/* CONTRACT-REQUEST-1 — configure monthly supply modal */}
      <ConfigureMonthlySupplyModal
        open={requestLot != null}
        lot={requestLot}
        onClose={closeConfigureModal}
        onRequestCreated={refreshIntents}
      />
    </>
  )
}

// ------------------------------------------------------
// SOURCING RELATIONSHIP — improved trust card
// ------------------------------------------------------

function SourcingRelationshipCard() {
  return (
    <div
      style={{
        padding: 24,
        borderRadius: RADII.card,
        background: COLORS.panelBg,
        border: COLORS.borderSoft,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: COLORS.gold,
            opacity: 0.85,
            marginBottom: 6,
          }}
        >
          Sourcing Relationship
        </div>
        <div
          style={{
            fontSize: 17,
            color: COLORS.textPrimary,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
          }}
        >
          Direct relationships. Verified quality.
        </div>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          lineHeight: 1.7,
          color: COLORS.textMuted,
          fontWeight: 300,
        }}
      >
        We partner directly with producers across premier origins to deliver
        exceptional coffees with full transparency — every lot is verified,
        every relationship is long-term.
      </p>
      <a
        href="/platform/marketplace"
        style={{
          alignSelf: "flex-start",
          padding: "9px 14px",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.04em",
          borderRadius: 10,
          color: COLORS.gold,
          textDecoration: "none",
          background: COLORS.goldFaint,
          border: `1px solid ${COLORS.goldSoft}`,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        Learn more about our approach <ArrowRight />
      </a>
    </div>
  )
}

// ------------------------------------------------------
// NEED HELP
// ------------------------------------------------------

function NeedHelpCard() {
  function handleSupportClick() {
    alert("Please reach out to your account manager directly.")
  }
  return (
    <div
      style={{
        padding: 24,
        borderRadius: RADII.card,
        background: COLORS.panelBg,
        border: COLORS.borderSoft,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: RADII.pill,
            background: COLORS.goldFaint,
            border: `1px solid ${COLORS.goldSoft}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: COLORS.gold,
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1v-7h3z" />
            <path d="M3 19a2 2 0 0 0 2 2h1v-7H3z" />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: COLORS.gold,
              opacity: 0.85,
              marginBottom: 6,
            }}
          >
            Need help?
          </div>
          <div
            style={{
              fontSize: 14,
              color: COLORS.textPrimary,
              fontWeight: 400,
              lineHeight: 1.5,
            }}
          >
            Your account manager is here to support — questions about lots,
            contracts or logistics, we're here to help you succeed.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSupportClick}
        style={{
          alignSelf: "flex-start",
          padding: "9px 14px",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.04em",
          borderRadius: 10,
          color: COLORS.gold,
          background: COLORS.goldFaint,
          border: `1px solid ${COLORS.goldSoft}`,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        Contact support <ArrowRight />
      </button>
    </div>
  )
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12,5 19,12 12,19" />
    </svg>
  )
}
