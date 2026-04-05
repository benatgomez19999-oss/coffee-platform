"use client";

import { useState, useEffect, useRef } from "react";
import CoffeeLoader from "@/src/components/shared/CoffeeLoader";
import PlatformHeader from "@/src/components/shared/PlatformHeader";
import ProducerDashboard from "@/src/components/platform/producer/ProducerDashboard";

export default function ProducerView({ user }: { user: any }) {

  //////////////////////////////////////////////////////
  // 🧹 CLEAN NAV OVERLAY (CRÍTICO 🔥)
  //////////////////////////////////////////////////////

  useEffect(() => {
    const el = document.getElementById("nav-overlay-root");
    if (el) {
      el.innerHTML = "";
    }
  }, []);

  //////////////////////////////////////////////////////
  // 🔒 PERSISTENCIA REAL
  //////////////////////////////////////////////////////

  const hasEnteredRef = useRef(false);
  const [entered, setEntered] = useState(false);

  //////////////////////////////////////////////////////
  // 🎬 FINISH (SAFE)
  //////////////////////////////////////////////////////

  const handleFinish = () => {
    if (hasEnteredRef.current) return;

    hasEnteredRef.current = true;
    setEntered(true);
  };

  //////////////////////////////////////////////////////
  // 🧠 RENDER (SIN HARD GATE)
  //////////////////////////////////////////////////////

  return (
    <>
      {/* ☕ LOADER (se mantiene hasta fade real) */}
      {!entered && <CoffeeLoader onFinish={handleFinish} />}

      {/* 🧠 APP (fade in controlado) */}
      <div
        className={`
          transition-opacity duration-700 ease-out
          ${entered ? "opacity-100" : "opacity-0"}
        `}
      >
        <PlatformHeader user={user} />

        <div className="pt-[90px] px-6">
          <ProducerDashboard user={user} />
        </div>
      </div>
    </>
  );
}