"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function InitialLoaderRemover() {
  const pathname = usePathname();

  useEffect(() => {
    // ❌ NO actuar en producer
    if (pathname.startsWith("/platform/producer")) return;

    const el = document.getElementById("initial-loader");
    if (!el) return;

    const timeout = setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 400);
    }, 300); // ⬅️ más rápido ahora

    return () => clearTimeout(timeout);
  }, [pathname]);

  return null;
}