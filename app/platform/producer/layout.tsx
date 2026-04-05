"use client";

import { useEffect } from "react";
import "@/styles/themes/producer.css"

let loaderRemoved = false;

export default function ProducerLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  useEffect(() => {
    const el = document.getElementById("initial-loader");

    if (!loaderRemoved && el) {
      loaderRemoved = true;

      el.style.opacity = "0";

      setTimeout(() => {
        if (document.body.contains(el)) {
          el.remove();
        }
      }, 300);
    }
  }, []);

  return (
  <div
    className="min-h-screen"
    style={{
      backgroundColor: "#f3efe6"
    }}
  >
    {children}
  </div>
);
}