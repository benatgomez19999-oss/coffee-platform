export default function PartnerPage() {

  //////////////////////////////////////////////////////
  // 🧩 UI
  //////////////////////////////////////////////////////

  return (
    <div className="min-h-screen bg-[#f5f1e6] px-6 py-12 pt-24">

      <div className="max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-[#7a6a52] mb-2">
            Partner
          </p>

          <h1 className="text-3xl font-semibold">
            Partner Dashboard
          </h1>

          <p className="text-sm text-black/60 mt-2">
            Review and verify incoming coffee lots
          </p>
        </div>

        {/* ACTIONS */}
        <div className="space-y-4">

          <a
            href="/platform/partner/lots"
            className="block bg-white border border-[#e5dccf] rounded-xl p-5 hover:bg-black/5 transition"
          >
            View Lot Drafts →
          </a>

        </div>

      </div>
    </div>
  )
}