import "./globals.css";
import { Playfair_Display } from "next/font/google";
import Script from "next/script";
import RemoveInitialBg from "@/src/components/shared/general/RemoveInitialBg"

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
 return (
  <html lang="en" style={{ background: "#1a0f07" }}>
    <head>
      <link rel="preload" as="image" href="/images/coffee_bean_green_prod.png" />
      <link rel="preload" as="image" href="/images/coffee_bean_roasted_prod.png" />
      <link rel="preload" as="image" href="/images/coffee_cherry.png" />
    </head>

    <body className={`${playfair.className} app-loading`}>

      
      {/* 🧠 REMOVE SSR OVERLAY CUANDO REACT ARRANCA */}
      <RemoveInitialBg />

      {/* 🧩 APP */}
      {children}

      {/* 🔥 NAV OVERLAY ROOT (VACÍO SIEMPRE) */}
      <div id="nav-overlay-root" />

      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="afterInteractive"
      />
    </body>
  </html>
)
  
}