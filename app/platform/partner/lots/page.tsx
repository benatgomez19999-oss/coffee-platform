"use client";

import { useEffect, useState } from "react";

type LotDraft = {
  id: string;
  name: string | null;
  variety: string;
  process: string;
  harvestYear: number;
  parchmentKg: number;
};

export default function PartnerLotsPage() {
  const [lots, setLots] = useState<LotDraft[]>([]);

  useEffect(() => {
    const fetchLots = async () => {
      const res = await fetch("/api/partner/lots");
      const data = await res.json();
      setLots(data);
    };

    fetchLots();
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-semibold mb-6">
        Lots Pending Analysis
      </h1>

      <div className="space-y-4">
        {lots.map((lot) => (
          <div
            key={lot.id}
            className="border p-4 rounded flex justify-between"
          >
            <div>
              <p>{lot.name || "Unnamed Lot"}</p>
              <p className="text-sm text-gray-500">
                {lot.variety} • {lot.process}
              </p>
            </div>

            <a
              href={`/platform/partner/lots/${lot.id}`}
              className="bg-black text-white px-4 py-2 rounded"
            >
              Analyze
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}