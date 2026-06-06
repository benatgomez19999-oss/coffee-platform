//////////////////////////////////////////////////////
// 📈 MARKET SIGNAL — read-only adapter for marketplace pricing
//
// Reads the latest active MarketSignalSnapshot for use by
// the marketplace adaptive pricing pipeline. Mirrors the
// validation rules in src/services/partner/lotVerification.service.ts
// so the same band of {cPrice, demandIndex} triggers — or
// fails — both code paths consistently.
//
// SAFETY: read-only. No writes, no events, no external API.
// Returns null when no usable snapshot exists; the caller
// must treat that as "deterministic pricing only" and the
// pricing engine will skip the cPrice/demand modifiers.
//////////////////////////////////////////////////////

import { prisma } from "@/src/database/prisma"

export type MarketSignalForPricing = {
  cPrice: number
  demandIndex: number
}

export async function getLatestMarketSignalForPricing(): Promise<
  MarketSignalForPricing | null
> {
  try {
    const snap = await prisma.marketSignalSnapshot.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    })

    if (!snap) return null
    if (snap.expiresAt && snap.expiresAt <= new Date()) return null

    // Range validation copied from lotVerification.service so both
    // paths reject out-of-band snapshots identically.
    if (
      !Number.isFinite(snap.cPrice) ||
      snap.cPrice < 50 ||
      snap.cPrice > 600
    ) {
      return null
    }
    if (
      !Number.isFinite(snap.demandIndex) ||
      snap.demandIndex < 0.8 ||
      snap.demandIndex > 1.2
    ) {
      return null
    }

    return {
      cPrice: snap.cPrice,
      demandIndex: snap.demandIndex,
    }
  } catch (err) {
    console.warn("[MARKET_SIGNAL] read failed — falling back to deterministic pricing", err)
    return null
  }
}
