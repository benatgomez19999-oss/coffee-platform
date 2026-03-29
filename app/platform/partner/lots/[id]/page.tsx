"use client";

import { useState } from "react";

export default function AnalyzeLotPage({ params }: any) {
  const [form, setForm] = useState({
    scaScore: "",
    aroma: "",
    flavor: "",
    conversionRate: "",
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    await fetch(`/api/partner/lots/${params.id}/verify`, {
      method: "POST",
      body: JSON.stringify(form),
    });

    alert("Lot verified");
  };

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-xl font-semibold">Analyze Lot</h1>

      <input
        placeholder="SCA Score"
        onChange={(e) => handleChange("scaScore", e.target.value)}
      />

      <input
        placeholder="Aroma"
        onChange={(e) => handleChange("aroma", e.target.value)}
      />

      <input
        placeholder="Flavor"
        onChange={(e) => handleChange("flavor", e.target.value)}
      />

      <input
        placeholder="Conversion Rate"
        onChange={(e) => handleChange("conversionRate", e.target.value)}
      />

      <button onClick={handleSubmit}>
        Create Green Lot
      </button>
    </div>
  );
}