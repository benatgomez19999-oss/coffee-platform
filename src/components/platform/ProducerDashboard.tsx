"use client"

export default function ProducerDashboard() {
  return (
    <div className="min-h-screen text-white px-6 py-10">

      {/* ================= HERO ================= */}
      <div className="max-w-5xl mx-auto space-y-2 mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Producer Dashboard
        </h1>

        <p className="text-white/60 text-sm">
          Manage your coffee production and create new supply lots
        </p>
      </div>

      {/* ================= MAIN GRID ================= */}
      <div className="max-w-5xl mx-auto grid gap-8">

        {/* ================= PRIMARY ACTION ================= */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-green-900/20 to-black/40 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">

          <div>
            <h2 className="text-xl font-medium">
              Create a new lot
            </h2>

            <p className="text-white/60 text-sm mt-1">
              Register a new coffee batch to start receiving offers
            </p>
          </div>

          <button
            className="
              px-8 py-3
              rounded-full
              bg-green-600
              hover:bg-green-500
              transition
              font-semibold
              text-black
              shadow-lg
              shadow-green-900/30
            "
          >
            + New Lot
          </button>

        </div>

        {/* ================= EMPTY STATE ================= */}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center">

          <h3 className="text-lg font-medium mb-2">
            No lots created yet
          </h3>

          <p className="text-white/50 text-sm max-w-md mx-auto">
            Start by creating your first coffee lot. This will allow buyers to discover your production and initiate contracts.
          </p>

        </div>

        {/* ================= CONTRACT SUMMARY ================= */}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-6">

          <h3 className="text-sm uppercase tracking-widest text-white/50 mb-4">
            Contracts
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">

            <div>
              <p className="text-xl font-semibold">0</p>
              <p className="text-xs text-white/50 mt-1">Active</p>
            </div>

            <div>
              <p className="text-xl font-semibold">0</p>
              <p className="text-xs text-white/50 mt-1">Pending</p>
            </div>

            <div>
              <p className="text-xl font-semibold">0</p>
              <p className="text-xs text-white/50 mt-1">Completed</p>
            </div>

            <div>
              <p className="text-xl font-semibold">0 kg</p>
              <p className="text-xs text-white/50 mt-1">Total Volume</p>
            </div>

          </div>

        </div>

      </div>

    </div>
  )
}