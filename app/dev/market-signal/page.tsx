import MarketSignalIngestionPanel from "@/src/components/dev/pricing/MarketSignalIngestionPanel"

export const dynamic = "force-dynamic"

//////////////////////////////////////////////////////
// 📡 /dev/market-signal
//
// Dev-only ingestion UI for MarketSignalSnapshot. All
// reads + writes go through /api/internal/pricing/market-signal
// which is guarded by requireDevRoute.
//////////////////////////////////////////////////////

export default function DevMarketSignalPage() {
  return <MarketSignalIngestionPanel />
}
