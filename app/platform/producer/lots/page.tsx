"use client";

import { useEffect, useState } from "react";

type LotDraft = {
  id: string;
  name: string | null;
  variety: string;
  process: string;
  harvestYear: number;
  parchmentKg: number;
  status: string;
};

export default function ProducerLotsPage() {
  const [lots, setLots] = useState<LotDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLots = async () => {
      try {
        const res = await fetch("/api/producer/lot-draft");
        const data = await res.json();
        setLots(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    fetchLots();
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f1e6] px-6 py-12 pt-24">
      <div className="max-w-4xl mx-auto">

        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-semibold">Your Lots</h1>
            <p className="text-sm text-black/60">
              Drafts and submitted lots
            </p>
          </div>

          <a
            href="/platform/producer/lots/new"
            className="px-5 py-2 rounded-full bg-[#3f6b3f] text-white"
          >
            + New Lot
          </a>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : lots.length === 0 ? (
          <p>No lots yet</p>
        ) : (
          <div className="space-y-4">
            {lots.map((lot) => (
              <div
                key={lot.id}
                className="bg-white border rounded-xl p-4 flex justify-between"
              >
                <div>
                  <p className="font-medium">
                    {lot.name || "Unnamed Lot"}
                  </p>

                  <p className="text-sm text-black/60">
                    {lot.variety} • {lot.process} • {lot.harvestYear}
                  </p>

                  <p className="text-sm text-black/40">
                    {lot.parchmentKg} kg
                  </p>
                </div>

                <StatusBadge status={lot.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    SENT_TO_LAB: "bg-blue-100 text-blue-800",
    VERIFIED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs ${styles[status]}`}>
      {status}
    </span>
  );
}