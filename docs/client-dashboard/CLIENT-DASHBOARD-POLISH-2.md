# CLIENT-DASHBOARD-POLISH-2

Catalog-first visual polish of `/platform/client`. Pixel-matches the
target editorial mock without changing data, schema, or allocation.

## Scope

- Read-only. No new dependencies. No Prisma changes.
- Every CTA stays non-mutating. The "Configure monthly supply" primary
  button remains disabled with a `Contract request flow lands next.`
  tooltip so QA can verify zero `DemandIntent` writes from this page.

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ HERO  — "Your Coffee Supply Desk" + 5-cell KPI strip             │
├──────────────────────────────────────────────────────────────────┤
│ RECOMMENDED FOR MONTHLY SUPPLY — 3 large editorial cards         │
├──────────────────────────────────────────────────────────────────┤
│ MONTHLY CONTRACT CATALOG (2/3)    │  CONTRACT PORTFOLIO (1/3)    │
│ toolbar + 6 compact cards         │  2×2 cells + recent list     │
├──────────────────────────────────────────────────────────────────┤
│ SOURCING RELATIONSHIP  │  SUPPLY CONTRACTS  │  NEED HELP          │
└──────────────────────────────────────────────────────────────────┘
```

## Components touched

| File | Change |
|---|---|
| `src/components/platform/client/dashboardTokens.ts` | Added `goldFill/goldFillHover/goldFillText`, `emeraldDot`, `badgeFilled/Outline` variants, `bgDeep`, `formatDaysUntil()` helper. |
| `src/components/platform/client/ClientDashboardHero.tsx` | New title + subtitle; replaced 5-cell glass strip with 5 bordered KPI cards. Replaced `availableRoastedKg` with `catalogLotsAvailable` so the client never reads global figures as their own. |
| `src/components/platform/client/SupplyDeskPanel.tsx` | Rewritten as a 3-card "Recommended for monthly supply" row. Each card: tonal-gradient image, badge stack (HIGH SCA / EXCLUSIVE / HIGH ALTITUDE / FRESH), serif name, region with pin icon, 2×3 stat grid (Variety / Process / SCA / Altitude / Available / Price), primary gold-fill `Configure monthly supply` CTA (disabled), outlined `View details` (disabled). |
| `src/components/platform/client/ContractPortfolioPanel.tsx` | Rewritten as a compact right-column sidebar. 2×2 summary cells (Active / Pending / Monthly Volume / Next Delivery) + "Recent Contracts" list via `pickRecentActiveContracts` (max 3) with status badge + footer `View all contracts →`. Now expects a `contracts` prop. |
| `src/components/platform/client/ClientContractCatalogPanel.tsx` | New "Monthly Contract Catalog" eyebrow + toolbar (Origin/Variety/Process/SCA/Price/More filters chip-dropdowns + Sort by + grid/list view toggle — all non-functional with `"Filters coming soon"` tooltips), denser card grid (200px min), one corner badge per card. |
| `src/components/platform/client/SupplyContractsPanel.tsx` | Title now "Built for consistency and trust."; CTA "Create a pilot contract →"; empty-state body refreshed. |
| `src/components/platform/client/Dashboard.tsx` | New hero kpi prop shape (`catalogLotsAvailable`), refreshed sourcing + need-help copy, dropped the `hasActivity` two-branch layout in favor of a single catalog-first grid (the column ratio still narrows the catalog slightly when the user has active contracts so the portfolio has room to breathe). |

## Pure selector + tests

`src/services/client-dashboard/recentActiveContracts.ts` filters the
contracts feed to `ACTIVE / AWAITING_SIGNATURE / PAYMENT_PENDING`,
excludes `COMPLETED / CANCELLED`, orders by tier and `createdAt` desc,
and projects a small dashboard row view-model (title / subtitle /
volume / locked price / next-execution iso).

Tests live in `src/services/client-dashboard/__tests__/recentActiveContracts.test.ts`
and run under `node --test --experimental-strip-types`.

## Copy replacements

| Before | After |
|---|---|
| `Indicative B2B Price` | `Price/kg` (recommended card) · `Price/kg` (catalog card) |
| `Assignable` | `Available` |
| `Request contract soon` | `Configure monthly supply` (recommended cards) · "+" inline icon (catalog cards) |
| `Published lots` | `Catalog lots` |
| `Available supply` | `Catalog supply` |
| `No supply contract yet.` | `Built for consistency and trust.` |
| `Create pilot contract` | `Create a pilot contract` |

## Gates

- `npx tsc --noEmit`
- `node --test --experimental-strip-types src/services/client-dashboard/__tests__/recentActiveContracts.test.ts`
- `npm run test:allocation`
- `npm run build`
