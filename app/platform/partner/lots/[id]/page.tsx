"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LotDraft = {
  id: string;
  name: string | null;
  variety: string;
  process: string;
  harvestYear: number;
  parchmentKg: number;
  status: string; // 
};

export default function PartnerLotDetail({ params }: { params: { id: string } }) {

  const router = useRouter();
  const [lot, setLot] = useState<LotDraft | null>(null);
  const [loading, setLoading] = useState(true);

  // lab inputs
  const [sca, setSca] = useState("");
  const [aroma, setAroma] = useState("");
  const [flavor, setFlavor] = useState("");
  const [conversion, setConversion] = useState("");

  //////////////////////////////////////////////////////
  // FETCH LOT
  //////////////////////////////////////////////////////

  useEffect(() => {
    const fetchLot = async () => {
      try {
        const res = await fetch(`/api/partner/lots/${params.id}`);
        const data = await res.json();
        setLot(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    fetchLot();
  }, [params.id]);

  //////////////////////////////////////////////////////
  // SUBMIT (placeholder)
  //////////////////////////////////////////////////////

  const handleVerify = async () => {
  try {
    await fetch(`/api/partner/lots/${params.id}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scaScore: Number(sca),
        aroma,
        flavor,
        conversionRate: Number(conversion),
      }),
    });

    alert("Lot verified ✅");

    router.push("/platform/partner/lots");

  } catch (err) {
    console.error(err);
    alert("Error verifying lot");
  }
};

  //////////////////////////////////////////////////////
  // RENDER
  //////////////////////////////////////////////////////

  if (loading) return <p className="p-10">Loading...</p>;

  if (!lot) return <p className="p-10">Lot not found</p>;

  return (
    <div className="min-h-screen bg-[#f5f1e6] px-6 py-12 pt-24">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-semibold">
            {lot.name || "Unnamed Lot"}
          </h1>

          <p className="text-sm text-black/60 mt-2">
            {lot.variety} • {lot.process} • {lot.harvestYear}
          </p>

          <p className="text-sm text-black/40">
            {lot.parchmentKg} kg
          </p>
        </div>

        {/* FORM */}
        <div className="bg-white border rounded-xl p-6 space-y-6">

          <h2 className="text-lg font-medium">
            Lab Analysis
          </h2>

          {/* SCA */}
          <div>
            <label className="text-sm">SCA Score</label>
            <input
              value={sca}
              onChange={(e) => setSca(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mt-1"
              placeholder="e.g. 87.5"
            />
          </div>

          {/* AROMA */}
          <div>
            <label className="text-sm">Aroma</label>
            <input
              value={aroma}
              onChange={(e) => setAroma(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mt-1"
              placeholder="Floral, citrus..."
            />
          </div>

          {/* FLAVOR */}
          <div>
            <label className="text-sm">Flavor Notes</label>
            <input
              value={flavor}
              onChange={(e) => setFlavor(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mt-1"
              placeholder="Chocolate, red fruits..."
            />
          </div>

          {/* CONVERSION */}
          <div>
            <label className="text-sm">Conversion Rate</label>
            <input
              value={conversion}
              onChange={(e) => setConversion(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mt-1"
              placeholder="e.g. 0.84"
            />
          </div>

          {/* BUTTON */}
          <button
            onClick={handleVerify}
            className="w-full py-3 rounded-full bg-[#3f6b3f] text-white"
          >
            Verify & Create Lot
          </button>

        </div>

      </div>
      
      {lot.status === "VERIFIED" && (
  <a
    href={`/platform/partner/lots/${params.id}/label`}
    target="_blank"
    className="bg-black text-white px-4 py-2 rounded"
  >
    Print Label
  </a>
)}

    </div>
  );
}