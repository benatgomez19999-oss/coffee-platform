// =====================================================
// PERSISTENCE
//
// THE ONLY FILE IN THIS MODULE ALLOWED TO WRITE.
//
// Append-only. Writes one CommitmentHealthSnapshot row
// per successful run. Never updates, never deletes.
//
// Persistence failure does NOT swallow the report —
// it propagates to the caller, which is responsible
// for surfacing the persistenceFailed flag in its own
// response shape.
// =====================================================

import { prisma } from "@/src/database/prisma"

import type { CommitmentHealthReport } from "./types.ts"

export async function persistReport(
  report: CommitmentHealthReport,
  triggeredBy: string | null
): Promise<void> {

  await prisma.commitmentHealthSnapshot.create({
    data: {
      runId: report.meta.runId,
      monitorVersion: report.meta.monitorVersion,
      runStartedAt: new Date(report.meta.runStartedAt),
      runFinishedAt: new Date(report.meta.runFinishedAt),
      durationMs: report.meta.durationMs,
      inputFingerprint: report.meta.inputFingerprint,

      overallHealth: report.healthAxes.overallHealth,
      supplyHealth: report.healthAxes.supplyHealth,
      demandHealth: report.healthAxes.demandHealth,
      commitmentHealth: report.healthAxes.commitmentHealth,
      fulfilmentHealth: report.healthAxes.fulfilmentHealth,

      metrics: report.metrics as unknown as object,
      detectors: report.detectors as unknown as object,
      attribution: report.attribution as unknown as object,
      inputCounts: report.inputCounts as unknown as object,

      triggeredBy: triggeredBy ?? null,
    },
  })
}
