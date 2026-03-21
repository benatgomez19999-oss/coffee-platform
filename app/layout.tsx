// =====================================================
// GLOBAL STYLES
// =====================================================

import "./globals.css";

// =====================================================
// FONTS (COMPATIBLE NEXT 14)
// =====================================================

import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// =====================================================
// METADATA
// =====================================================

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coffee Platform",
  description: "Professional coffee trading platform",
};

// =====================================================
// ROOT LAYOUT
// =====================================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={playfair.className}>
        {children}
      </body>
    </html>
  );
}