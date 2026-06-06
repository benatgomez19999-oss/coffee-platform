"use client"

import React from "react"
import {
  FILTER_ORIGINS,
  FILTER_PROCESSES,
  FILTER_CERTIFICATIONS,
  FILTER_HARVEST_YEARS,
  type FilterGroup,
} from "@/src/components/platform/marketplace/mock-marketplace-data"

//////////////////////////////////////////////////////
// 🎚️ FILTERS SIDEBAR — visual only (Phase 1)
//
// Sticky on desktop. Phase 2 will lift this state into
// a shared filter store.
//////////////////////////////////////////////////////

export default function MarketplaceFiltersSidebar() {
  return (
    <aside className="rounded-2xl border border-[#e2d6bd] bg-[#fffbf5]">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e2d6bd] px-5 py-4">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#9a8b73]">
          Filters
        </span>
        <button
          type="button"
          className="text-[11.5px] font-medium text-[#7a5230] hover:text-[#5f3920]"
        >
          Clear all
        </button>
      </div>

      <div className="px-5 py-4">

        {/* Origin */}
        <CheckboxGroup group={FILTER_ORIGINS} expanded showAllAt={5} />

        <Divider />

        {/* Process */}
        <CheckboxGroup group={FILTER_PROCESSES} expanded />

        <Divider />

        {/* SCA score range */}
        <RangeGroup
          label="SCA score"
          min={82}
          max={95}
          unitSuffix="+"
          leftValue="82"
          rightValue="95+"
        />

        <Divider />

        {/* Available kg */}
        <RangeGroup
          label="Available kg"
          min={100}
          max={10000}
          leftValue="100 kg"
          rightValue="10,000+ kg"
        />

        <Divider />

        {/* Certifications */}
        <CheckboxGroup group={FILTER_CERTIFICATIONS} expanded={false} />

        <Divider />

        {/* Harvest year */}
        <CheckboxGroup group={FILTER_HARVEST_YEARS} expanded={false} />
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 border-t border-[#e2d6bd] px-5 py-4">
        <button
          type="button"
          className="flex-1 rounded-xl border border-[#8d6641] bg-[#7a5230] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#5f3920]"
        >
          Apply filters
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#e2d6bd] bg-transparent px-3 py-2.5 text-[12.5px] font-medium text-[#7a5230] transition-colors hover:bg-[#f7efdf]"
        >
          Reset
        </button>
      </div>
    </aside>
  )
}

// ------------------------------------------------------
// CHECKBOX GROUP
// ------------------------------------------------------

function CheckboxGroup({
  group,
  expanded = true,
  showAllAt,
}: {
  group: FilterGroup
  expanded?: boolean
  showAllAt?: number
}) {
  const items = group.options
  const moreCount = showAllAt && items.length >= showAllAt ? items.length : 0

  return (
    <div className="py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#5f472f]"
      >
        {group.label}
        <ChevronDown className={expanded ? "rotate-180" : ""} />
      </button>

      {expanded && (
        <ul className="mt-3 space-y-2">
          {items.map((opt) => (
            <li key={opt.value}>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#2f2418]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#cfb48a] accent-[#7a5230]"
                />
                {/* Counts hidden — the static `(84)` / `(120)` numbers
                    were Phase-1 mock values, not real marketplace
                    counts. Bring back when the API ships per-filter
                    aggregations. */}
                <span>{opt.label}</span>
              </label>
            </li>
          ))}
          {moreCount > 0 && (
            <li>
              <button
                type="button"
                className="text-[11.5px] font-medium text-[#7a5230] hover:text-[#5f3920]"
              >
                Show all ({moreCount})
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

// ------------------------------------------------------
// RANGE GROUP — dual-track slider visual (no real logic)
// ------------------------------------------------------

function RangeGroup({
  label,
  leftValue,
  rightValue,
}: {
  label: string
  min: number
  max: number
  leftValue: string
  rightValue: string
  unitSuffix?: string
}) {
  return (
    <div className="py-2">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#5f472f]">
        {label}
      </div>

      {/* Visual dual slider */}
      <div className="mt-4 mb-2 flex items-center gap-2">
        <span className="text-[12px] tabular-nums text-[#5f472f]">{leftValue}</span>
        <div className="relative flex-1">
          <div className="h-1 rounded-full bg-[#e2d6bd]" />
          <div className="absolute left-[15%] right-[15%] top-0 h-1 rounded-full bg-[#7a5230]" />
          <div className="absolute left-[15%] top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#7a5230] bg-[#fffbf5] shadow-sm" />
          <div className="absolute right-[15%] top-1/2 h-3 w-3 translate-x-1/2 -translate-y-1/2 rounded-full border border-[#7a5230] bg-[#fffbf5] shadow-sm" />
        </div>
        <span className="text-[12px] tabular-nums text-[#5f472f]">{rightValue}</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

function Divider() {
  return <div className="my-1 h-px bg-[#e2d6bd]" />
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${className}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
