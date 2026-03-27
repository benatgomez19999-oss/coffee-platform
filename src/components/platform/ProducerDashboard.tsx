"use client"

export default function ProducerDashboard() {
  return (
    <div className="min-h-screen bg-[#f5f1e6] text-[#1f1f1f] px-6 py-12">

      {/* HERO */}
      <div className="max-w-5xl mx-auto mb-12">
        <h1 className="text-3xl font-semibold tracking-tight">
          Your Farm Dashboard
        </h1>

        <p className="text-sm text-black/60 mt-2">
          Manage your coffee production in a simple and clear way
        </p>
      </div>

      {/* CONTENT */}
      <div className="max-w-5xl mx-auto space-y-8">

        {/* CTA */}
        <div className="rounded-2xl border border-[#e5dccf] bg-[#f8f4ec] p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 shadow-sm">

          <div>
            <h2 className="text-xl font-medium">
              Create a new lot
            </h2>

            <p className="text-sm text-black/60 mt-1">
              Add a new coffee batch from your farm to start selling
            </p>
          </div>

          <button
            className="
              px-8 py-3
              rounded-full
              bg-[#3f6b3f]
              hover:bg-[#4f7d4f]
              text-white
              font-semibold
              transition
            "
          >
            + New Lot
          </button>

        </div>

        {/* EMPTY STATE */}
        <div className="rounded-2xl border border-[#e5dccf] bg-white p-10 text-center shadow-sm">

          <h3 className="text-lg font-medium mb-2">
            No lots yet
          </h3>

          <p className="text-sm text-black/60 max-w-md mx-auto">
            Once you create your first lot, buyers will be able to see your coffee and start contracts with you.
          </p>

        </div>

        {/* CONTRACTS */}
        <div className="rounded-2xl border border-[#e5dccf] bg-white p-6 shadow-sm">

          <h3 className="text-xs uppercase tracking-widest text-black/50 mb-4">
            Contracts
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">

            <div>
              <p className="text-xl font-semibold">0</p>
              <p className="text-xs text-black/50 mt-1">Active</p>
            </div>

            <div>
              <p className="text-xl font-semibold">0</p>
              <p className="text-xs text-black/50 mt-1">Pending</p>
            </div>

            <div>
              <p className="text-xl font-semibold">0</p>
              <p className="text-xs text-black/50 mt-1">Completed</p>
            </div>

            <div>
              <p className="text-xl font-semibold">0 kg</p>
              <p className="text-xs text-black/50 mt-1">Volume</p>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}