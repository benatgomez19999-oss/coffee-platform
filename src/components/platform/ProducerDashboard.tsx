"use client"
import PlatformHeader from "@/components/platform/PlatformHeader"

export default function ProducerDashboard({ user }: { user: any }) {
  return (
    
    <div className="min-h-screen bg-[#f5f1e6] text-[#1f1f1f] px-6 py-12 pt-24">

      {/* HERO */}
      <div className="max-w-5xl mx-auto mb-12">

  <p className="text-xs uppercase tracking-widest text-[#7a6a52] mb-2">
    Farm Control Panel
  </p>

  <h1 className="text-3xl font-semibold tracking-tight">
    Your Farm Dashboard
  </h1>

  <p className="text-sm text-black/60 mt-2">
    Manage your coffee production in a simple and clear way
  </p>

</div>
<PlatformHeader user={user} />

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
  px-10 py-4
  rounded-full
  bg-[#3f6b3f]
  hover:bg-[#4f7d4f]
  text-white
  font-semibold
  text-lg
  transition
  shadow-md
"
          >
            + New Lot
          </button>

        </div>

        {/* EMPTY STATE */}
        <div className="rounded-2xl border border-[#e5dccf] bg-white p-10 text-center shadow-sm">

          <h3 className="text-lg font-medium mb-2">
            Start by adding your first coffee lot.
          </h3>

          <p className="text-sm text-black/60 max-w-md mx-auto">
            
It only takes a minute and allows buyers to discover your farm and start working with you.
          </p>

        </div>

        {/* CONTRACTS */}
     <div
  className="rounded-2xl border border-[#e5dccf] bg-white p-6 
             shadow-[0_4px_20px_rgba(0,0,0,0.04)] 
             hover:shadow-[0_6px_30px_rgba(0,0,0,0.06)] 
             transition"
>
        
            

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