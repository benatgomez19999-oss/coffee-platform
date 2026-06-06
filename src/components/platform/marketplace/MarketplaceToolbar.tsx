"use client"

import React from "react"
import { TOOLBAR_FILTERS } from "@/src/components/platform/marketplace/mock-marketplace-data"

//////////////////////////////////////////////////////
// 🔍 TOOLBAR — search + filter dropdowns + sort
//
// Visual only (Phase 1). All controls render but do not
// drive any filtering. Phase 2 will wire these to a
// shared filter state.
//////////////////////////////////////////////////////

export default function MarketplaceToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e2d6bd] bg-[#fffbf5] px-4 py-3">

      {/* Search */}
      <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-[#e2d6bd] bg-[#fcf8f0] px-3 py-2">
        <SearchIcon />
        <input
          type="text"
          placeholder="Search lots, farms, producers…"
          className="w-full bg-transparent text-[13px] text-[#2f2418] placeholder:text-[#9a8b73] focus:outline-none"
        />
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        {TOOLBAR_FILTERS.map((f) => (
          <DropdownPill key={f.id} label={f.label} icon={iconForFilter(f.id)} />
        ))}
      </div>

      {/* Sort */}
      <div className="ml-auto">
        <DropdownPill label="Sort by: Newest" variant="ghost" />
      </div>
    </div>
  )
}

// ------------------------------------------------------
// DROPDOWN PILL — visual only
// ------------------------------------------------------

function DropdownPill({
  label,
  icon,
  variant = "default",
}: {
  label: string
  icon?: React.ReactNode
  variant?: "default" | "ghost"
}) {
  const cls =
    variant === "ghost"
      ? "border-[#e2d6bd] bg-transparent text-[#5f472f] hover:bg-[#f7efdf]"
      : "border-[#e2d6bd] bg-[#fcf8f0] text-[#5f472f] hover:bg-[#f7efdf]"

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-medium transition-colors ${cls}`}
    >
      {icon && <span className="text-[#7a5230]">{icon}</span>}
      {label}
      <ChevronDown />
    </button>
  )
}

// ------------------------------------------------------
// ICONS
// ------------------------------------------------------

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a8b73" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function iconForFilter(id: string): React.ReactNode {
  switch (id) {
    case "origin":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 4 3 14 0 18M12 3c-3 4-3 14 0 18" />
        </svg>
      )
    case "process":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19c0-7 5-13 14-14-1 9-7 14-14 14z" />
        </svg>
      )
    case "variety":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3c3 4 3 11 0 18-3-7-3-14 0-18z" />
          <path d="M3 12h18" />
        </svg>
      )
    case "harvest":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      )
    case "availability":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7h11v9H3z" />
          <path d="M14 10h4l3 3v3h-7z" />
          <circle cx="7"  cy="17.5" r="1.7" />
          <circle cx="17" cy="17.5" r="1.7" />
        </svg>
      )
    case "price":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9c1.5-1 4-1 5 0s.5 2-1 2.5-2.5 1-2 2.5 2.5 1.5 4 .5" />
          <path d="M12 6v2M12 16v2" />
        </svg>
      )
    default:
      return null
  }
}
