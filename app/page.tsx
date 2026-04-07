"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRef } from "react"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import { showNavOverlay } from "@/src/lib/navigationOverlay"



export default function Home() {

const [scrolled, setScrolled] = useState(false)
const [loaded, setLoaded] = useState(false)
const [offset, setOffset] = useState(50)
const pathname = usePathname()
const router = useRouter()


useEffect(() => {
  setLoaded(true)

  const handleScroll = () => {
    setScrolled(window.scrollY > 10)
    setOffset(50 + window.scrollY * 0.05)
  }

  window.addEventListener("scroll", handleScroll)
  return () => window.removeEventListener("scroll", handleScroll)
}, [])

  // ======================================================
  // SESSION (LIGHT — SOLO HEADER)
  // ======================================================

  const [user, setUser] = useState<any | null>(null)
  const firstName = user?.name?.split(" ")[0] || "there"

 useEffect(() => {
  const fetchUser = async () => {
    try {
      
     const res = await fetch("/api/auth/me", {
  cache: "no-store",
  credentials: "include", // 🔥 añadir esto
})

      if (!res.ok) {
        setUser(null)
      } else {
        const data = await res.json()
        setUser(data.user)
      }
    } catch {
      setUser(null)
    }
  }

  fetchUser()
}, [pathname])



  const directRef = useRef(null)
  const directVisible = true 

  const goToPlatform = () => {
  const el = document.getElementById("nav-overlay-root")

 

 if (el) {
  el.innerHTML = `
  <div style="
    position:fixed;
    inset:0;
    z-index:9999;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#1a0f07;
  ">

    <div style="
      position:relative;
      width:clamp(320px, 30vw, 420px);
      height:clamp(320px, 30vw, 420px);
      display:flex;
      align-items:center;
      justify-content:center;
    ">

      <!-- 🍒 PRE-GLOW -->
      <div style="
        position:absolute;
        width:70%;
        height:70%;
        border-radius:9999px;
        filter:blur(100px);
        opacity:0.45;
        transform:scale(0.95);
        background:radial-gradient(circle, rgba(255,180,100,0.12), transparent 70%);
      "></div>

      <!-- 🍒 CHERRY -->
      <img 
        src="/images/coffee_cherry.png"
        style="
          position:absolute;
          width:75%;
          max-width:300px;
          transform:scale(0.96) translateY(10px);
          opacity:0;
          filter:
            brightness(1.05)
            contrast(1.05)
            saturate(1.1);
          animation: cherryIn 600ms cubic-bezier(0.22,1,0.36,1) forwards;
        "
      />

      <!-- ✨ INNER GLOW -->
      <div style="
        position:absolute;
        width:80px;
        height:80px;
        top:30%;
        left:50%;
        transform:translateX(-50%);
        background:radial-gradient(circle, rgba(255,255,255,0.15), transparent);
        filter:blur(20px);
        opacity:0.25;
      "></div>

    </div>

    <!-- 💨 ANIMATION DEFINIDA AQUÍ -->
    <style>
      @keyframes cherryIn {
        0% {
          opacity:0;
          transform:scale(0.94) translateY(14px);
        }
        60% {
          opacity:1;
          transform:scale(1.03) translateY(-2px);
        }
        100% {
          opacity:1;
          transform:scale(1.02) translateY(0px);
        }
      }
    </style>

  </div>
  `
}

  router.push("/platform")
}

  return (
  <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column"
    }}>


      <header
        style={{
          position: "fixed",
          top: 0,
          width: "100%",
          display: "flex",
          justifyContent: "space-between", // 🔥 ESTO ES CLAVE
          alignItems: "center",
          padding: scrolled ? "10px 60px" : "12px 60px",

          background: scrolled
            ? "rgba(10,10,10,0.95)"
            : "rgba(10,10,10,0.45)",

          backdropFilter: scrolled ? "blur(4px)" : "blur(12px)",
          zIndex: 1000,
          color: "white",
          borderBottom: scrolled
            ? "1px solid rgba(255,255,255,0.15)"
            : "1px solid rgba(255,255,255,0.08)",

          transition: "all 0.3s ease",
        }}
      >
        {/* LEFT SIDE – LOGO */}
        <div
          style={{
            width: "170px",   // tamaño fijo del espacio
            height: "48px",   // altura fija para que el header no crezca
            display: "flex",
            alignItems: "center",
            overflow: "visible"
          }}
        >
          <img
            src="/images/logo-altura-gold-final.png"
            alt="Altura Collective"
            style={{
              width: "110px",   // tamaño real del logo (más pequeño que el contenedor)
              height: "auto",
              transition: "transform 0.35s ease, filter 0.35s ease",
              transformOrigin: "left center",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.08)";
              e.currentTarget.style.filter =
                "brightness(1.1) drop-shadow(0 0 6px rgba(212,175,55,0.35))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.filter = "none";
            }}
          />
        </div>

        {/* RIGHT SIDE — NAV */}
<div style={{ display: "flex", gap: "30px", alignItems: "center" }}>

  {/* CLIENT NAME */}
  {user && (
  <div
    onClick={() => {
  showNavOverlay()
  router.push("/platform")
   }}
    style={{
      fontSize: "0.8rem",
      color: "#d4af37",
      opacity: 0.9,
      whiteSpace: "nowrap",
      cursor: "pointer",
      transition: "opacity 0.2s ease"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.opacity = "1"
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.opacity = "0.9"
    }}
  >
    Welcome back, {firstName}
  </div>
)}

  {/* LOGIN (ONLY IF NOT LOGGED) */}
{!user && (
  <Link
    href="/login"
    style={{
      position: "relative",
      color: "white",
      textDecoration: "none",
      fontWeight: 400,
      letterSpacing: "0.5px",
      padding: "6px 0",
      display: "inline-block",
      transition: "color 0.35s ease, text-shadow 0.35s ease"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = "#f3d27a";
      e.currentTarget.style.textShadow = "0 0 8px rgba(212,175,55,0.4)";

      const underline = e.currentTarget.querySelector("span");
      if (underline) {
        underline.style.width = "100%";
        underline.style.left = "0";
      }
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = "white";
      e.currentTarget.style.textShadow = "none";

      const underline = e.currentTarget.querySelector("span");
      if (underline) {
        underline.style.width = "0%";
        underline.style.left = "50%";
      }
    }}
  >
    Login

    <span
      style={{
        position: "absolute",
        bottom: "0",
        left: "50%",
        width: "0%",
        height: "1px",
        background: "linear-gradient(90deg, #d4af37, #f3d27a, #d4af37)",
        transition: "all 0.35s ease"
      }}
    />
  </Link>
)}

  {/* LOGOUT */}
  {user && (
    <button
    onClick={async () => {
  await fetch("/api/auth/logout", { method: "POST" })

  // 🔥 limpieza inmediata
  setUser(null)

  // 🔥 invalida todo (server + cache)
  router.refresh()

  // 🔥 navegación limpia
  router.push("/")
}}
      style={{
        fontSize: "0.7rem",
        letterSpacing: "1px",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.35)",
        background: "none",
        border: "none",
        cursor: "pointer",
        transition: "color 0.3s ease"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#d4af37";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "rgba(255,255,255,0.35)";
      }}
    >
      Logout
    </button>
  )}

  {/* LAB — discreto */}
  <Link
    href="/lab"
    style={{
      fontSize: "0.7rem",
      letterSpacing: "1px",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.35)",
      textDecoration: "none",
      transition: "color 0.3s ease"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = "#d4af37";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = "rgba(255,255,255,0.35)";
    }}
  >
    Lab
  </Link>



{user ? (
  <button
    onClick={goToPlatform}
    style={{
      padding: "10px 24px",
      borderRadius: "999px",
      border: "1px solid rgba(212,175,55,0.6)",
      backgroundColor: "rgba(0,0,0,0.4)",
      color: "#fff",
      fontSize: "0.9rem",
      letterSpacing: "0.5px",
      textDecoration: "none",
      transition: "all 0.35s ease",
      backdropFilter: "blur(6px)",
      cursor: "pointer"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "rgba(212,175,55,0.85)";
      e.currentTarget.style.color = "#111";
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "0 10px 25px rgba(212,175,55,0.25)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.4)";
      e.currentTarget.style.color = "#fff";
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    Dashboard
  </button>
) : (

  <Link
    href="/signup"
    style={{
      padding: "10px 24px",
      borderRadius: "999px",
      border: "1px solid rgba(212,175,55,0.6)",
      backgroundColor: "rgba(0,0,0,0.4)",
      color: "#fff",
      fontSize: "0.9rem",
      letterSpacing: "0.5px",
      textDecoration: "none",
      transition: "all 0.35s ease",
      backdropFilter: "blur(6px)"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "rgba(212,175,55,0.85)";
      e.currentTarget.style.color = "#111";
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "0 10px 25px rgba(212,175,55,0.25)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.4)";
      e.currentTarget.style.color = "#fff";
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    Get Started
  </Link>
)}

</div>
      </header>



      {/* ================= HERO SECTION ================= */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          color: "white",
          overflow: "hidden",
         background:
  "radial-gradient(circle at 20% 20%, rgba(198,168,90,0.06), transparent 30%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.03), transparent 40%), linear-gradient(180deg, #050607 0%, #07090A 55%, #0A0D0E 100%)",
        }}
      >
        {/* SOFT ATMOSPHERE */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.16) 45%, rgba(0,0,0,0.08) 100%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "22%",
            right: "-120px",
            width: "420px",
            height: "420px",
            borderRadius: "999px",
            background: "rgba(212,175,55,0.05)",
            filter: "blur(70px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            bottom: "-120px",
            left: "-80px",
            width: "360px",
            height: "360px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.04)",
            filter: "blur(80px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "150px 80px 110px 80px",
          }}
        >
          <div
            style={{
              maxWidth: "760px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                color: "rgba(230,214,176,0.92)",
                fontSize: "0.82rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                opacity: loaded ? 1 : 0,
                transform: loaded ? "translateY(0px)" : "translateY(14px)",
                transition:
                  "opacity 1.1s cubic-bezier(0.22,1,0.36,1), transform 1.1s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <span
                style={{
                  width: "42px",
                  height: "1px",
                  background: "rgba(212,175,55,0.7)",
                  display: "inline-block",
                }}
              />
              Colombian Direct Trade
            </div>

            <h1
              style={{
                marginTop: "28px",
                fontSize: "clamp(3.8rem, 7vw, 6.6rem)",
                lineHeight: "0.96",
                fontWeight: 300,
                letterSpacing: "-0.05em",
                maxWidth: "900px",
                color: "#EDE8DF",
                opacity: loaded ? 1 : 0,
                transform: loaded ? "translateY(0px)" : "translateY(16px)",
                transition:
                  "opacity 1.2s cubic-bezier(0.22,1,0.36,1) 0.08s, transform 1.2s cubic-bezier(0.22,1,0.36,1) 0.08s",
              }}
            >
              Coffee sourcing
              <br />
              with structure,
              <br />
              not noise.
            </h1>

            <p
              style={{
                marginTop: "30px",
                maxWidth: "650px",
                fontSize: "1.12rem",
                lineHeight: "1.9",
                fontWeight: 300,
                color: "rgba(255,255,255,0.78)",
                opacity: loaded ? 1 : 0,
                transform: loaded ? "translateY(0px)" : "translateY(16px)",
                transition:
                  "opacity 1.2s cubic-bezier(0.22,1,0.36,1) 0.18s, transform 1.2s cubic-bezier(0.22,1,0.36,1) 0.18s",
              }}
            >
              We connect premium hospitality partners with Colombian specialty
              farms through direct relationships, stable pricing and long-term
              supply coordination.
            </p>

            <div
              style={{
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
                marginTop: "38px",
                opacity: loaded ? 1 : 0,
                transform: loaded ? "translateY(0px)" : "translateY(16px)",
                transition:
                  "opacity 1.2s cubic-bezier(0.22,1,0.36,1) 0.28s, transform 1.2s cubic-bezier(0.22,1,0.36,1) 0.28s",
              }}
            >
              <a
                href="#contact"
                style={{
                  padding: "14px 28px",
                  borderRadius: "999px",
                  background: "#d4af37",
                  color: "#111",
                  textDecoration: "none",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  border: "1px solid rgba(212,175,55,0.95)",
                  boxShadow: "0 12px 30px rgba(212,175,55,0.18)",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)"
                  e.currentTarget.style.boxShadow =
                    "0 18px 40px rgba(212,175,55,0.26)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow =
                    "0 12px 30px rgba(212,175,55,0.18)"
                }}
              >
                Request Sample
              </a>

              <a
                href="#direct-trade"
                style={{
                  padding: "14px 28px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.03)",
                  color: "#f5efe3",
                  textDecoration: "none",
                  fontSize: "0.95rem",
                  fontWeight: 400,
                  letterSpacing: "0.02em",
                  border: "1px solid rgba(255,255,255,0.14)",
                  backdropFilter: "blur(8px)",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)"
                  e.currentTarget.style.border =
                    "1px solid rgba(212,175,55,0.45)"
                  e.currentTarget.style.color = "#fff"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.14)"
                  e.currentTarget.style.color = "#f5efe3"
                }}
              >
                Discover the model
              </a>
            </div>

            <div
              style={{
                marginTop: "58px",
                paddingTop: "24px",
                borderTop: "1px solid rgba(255,255,255,0.12)",
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "28px",
                maxWidth: "860px",
                opacity: loaded ? 1 : 0,
                transform: loaded ? "translateY(0px)" : "translateY(16px)",
                transition:
                  "opacity 1.2s cubic-bezier(0.22,1,0.36,1) 0.38s, transform 1.2s cubic-bezier(0.22,1,0.36,1) 0.38s",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(212,175,55,0.88)",
                    marginBottom: "8px",
                  }}
                >
                  Direct Relationships
                </div>
                <div
                  style={{
                    fontSize: "0.98rem",
                    lineHeight: "1.7",
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  Structured sourcing directly at origin.
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(212,175,55,0.88)",
                    marginBottom: "8px",
                  }}
                >
                  Stable Pricing
                </div>
                <div
                  style={{
                    fontSize: "0.98rem",
                    lineHeight: "1.7",
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  Clear pricing frameworks designed for continuity.
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(212,175,55,0.88)",
                    marginBottom: "8px",
                  }}
                >
                  Hospitality Focus
                </div>
                <div
                  style={{
                    fontSize: "0.98rem",
                    lineHeight: "1.7",
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  Built for premium hotels, restaurants and curated groups.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= DIRECT TRADE SECTION ================= */}
      <section
        id="direct-trade"
        ref={directRef}
        style={{
          padding: "130px 80px",
          background: "linear-gradient(180deg, #0f1a1a 0%, #0c1414 60%, #0a1010 100%)",
          color: "white"
        }}
      >
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          paddingTop: "20px"
        }}>

          {/* TITULO */}

          <h2
            className={`reveal ${directVisible ? "reveal-visible delay-1" : ""}`}
            style={{
              fontSize: "3.3rem",
              fontWeight: "300",
              letterSpacing: "-0.6",
              lineHeight: "1.05",
              marginBottom: "24px"
            }}
          >
            Direct Trade. Reinvented.
          </h2>
          <div
            className={`reveal ${directVisible ? "reveal-visible delay-2" : ""}`}
            style={{
              width: "80px",
              opacity: 0.6,
              height: "1px",
              backgroundColor: "rgba(255,255,255,0.3)",
              margin: "30px 0 60px 0"
            }}
          />

          {/* SUBTITULO */}
          <p
            className={`reveal ${directVisible ? "reveal-visible delay-3" : ""}`}
            style={{
              fontSize: "1.05rem",
              fontWeight: "300",
              lineHeight: "1.8",
              letterSpacing: "0.2px",
              opacity: 0.85,
              maxWidth: "620px",
            }}
          >
            A structured, transparent sourcing model connecting Colombian specialty farms with premium hospitality partners.
          </p>


          {/* LINEA FINA PREMIUM */}
          <div
            className={`reveal ${directVisible ? "reveal-visible delay-2" : ""}`}
            style={{
              width: "100px",
              height: "1px",
              background: "linear-gradient(to right, transparent, rgba(255,255,255,0.6), transparent)",
              margin: "30px 0 60px 0",
            }}
          />



          {/* 3 COLUMNAS */}
          <div
            className={`reveal ${directVisible ? "reveal-visible delay-4" : ""}`}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "80px"
            }}
          >

            {/* BLOQUE 1 */}
            <div
              className={`direct-card reveal ${directVisible ? "reveal-visible delay-3" : ""}`}
              style={{
                flex: 1,
                minWidth: "260px",
              }}
            >
              <h4
                style={{
                  fontSize: "0.85rem",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  fontWeight: "500",
                  marginBottom: "16px",
                  opacity: 0.7,
                }}
              >
                FARM DIRECT
              </h4>

              <p
                style={{
                  fontSize: "1rem",
                  fontWeight: "300",
                  lineHeight: "1.7",
                  opacity: 0.85,
                }}
              >
                Direct agreements with origin producers.
                No intermediaries. No margin stacking.
              </p>
            </div>

            {/* BLOQUE 2 */}
            <div
              className={`reveal ${directVisible ? "reveal-visible delay-4" : ""}`}
              style={{
                flex: 1,
                minWidth: "260px",
              }}
            >
              <h4
                style={{
                  fontSize: "0.85rem",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  fontWeight: "500",
                  marginBottom: "16px",
                  opacity: 0.7,
                }}
              >
                TRANSPARENT PRICING
              </h4>

              <p
                style={{
                  fontSize: "1rem",
                  fontWeight: "300",
                  lineHeight: "1.7",
                  opacity: 0.85,
                }}
              >
                Pre-agreed pricing structures built for stability.
                No speculative volatility. No hidden layers.
              </p>
            </div>
            <div
              className={`reveal ${directVisible ? "reveal-visible delay-5" : ""}`}
              style={{
                flex: 1,
                minWidth: "260px",
              }}
            >
              <h4
                style={{
                  fontSize: "0.85rem",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  fontWeight: "500",
                  marginBottom: "16px",
                  opacity: 0.7,
                }}
              >
                LONG-TERM PARTNERSHIPS
              </h4>

              <p
                style={{
                  fontSize: "1rem",
                  fontWeight: "300",
                  lineHeight: "1.7",
                  opacity: 0.85,
                }}
              >
                Multi-season supply commitments designed for continuity —
                not transactional sourcing cycles.
              </p>
            </div>

          </div>
        </div>

      </section>


      {/* ================= HOW IT WORKS — TIMELINE ================= */}

      <section
        style={{
          padding: "160px 80px",
          backgroundColor: "#f8f7f4",
          color: "#111",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto", position: "relative" }}>

          {/* LINEA VERTICAL */}
          <div
            style={{
              position: "absolute",
              left: "28px",
              top: 0,
              bottom: 0,
              width: "1px",
              background: "rgba(0,0,0,0.15)"
            }}
          />

          {/* TITULO */}
          <h2
            className="reveal reveal-visible delay-1"
            style={{
              fontSize: "3rem",
              fontWeight: "300",
              marginBottom: "100px"
            }}
          >
            How It Works
          </h2>

          {/* STEP */}
          {[
            {
              number: "01",
              title: "Define Supply",
              text:
                "Clients define volume targets, time horizon and sourcing objectives. We align capacity with origin partners."
            },
            {
              number: "02",
              title: "Structure Contract",
              text:
                "Transparent pricing and multi-season agreements are structured and reviewed before digital execution."
            },
            {
              number: "03",
              title: "Activate Delivery",
              text:
                "Logistics, quality tracking and supply visibility ensure continuity and scalable growth."
            }
          ].map((step, i) => (
            <div
              key={i}
              className="reveal reveal-visible"
              style={{
                display: "flex",
                gap: "40px",
                marginBottom: "80px",
                alignItems: "flex-start"
              }}
            >
              {/* NUMERO */}
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: "500",
                  opacity: 0.5,
                  minWidth: "56px"
                }}
              >
                {step.number}
              </div>

              {/* CONTENIDO */}
              <div>
                <h3
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: "400",
                    marginBottom: "12px"
                  }}
                >
                  {step.title}
                </h3>

                <p
                  style={{
                    lineHeight: "1.8",
                    opacity: 0.8,
                    maxWidth: "600px"
                  }}
                >
                  {step.text}
                </p>
              </div>
            </div>
          ))}

        </div>

      </section>

      {/* ================= PLATFORM PREVIEW ================= */}

      <section
        style={{
          padding: "160px 80px",
          background: "#0b0f0f",
          color: "white"
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

          {/* HEADER */}
          <div style={{ maxWidth: "640px", marginBottom: "80px" }}>
            <h2
              className="reveal reveal-visible"
              style={{
                fontSize: "3rem",
                fontWeight: "300",
                marginBottom: "20px"
              }}
            >
              Built for Long-Term Supply.
            </h2>

            <p
              className="reveal reveal-visible delay-1"
              style={{
                lineHeight: "1.8",
                opacity: 0.8
              }}
            >
              Manage contracts, monitor supply availability and coordinate deliveries
              through a dedicated sourcing platform designed for stability and scale.
            </p>
          </div>

          {/* MOCK DASHBOARD */}
          <div
            className="reveal reveal-visible delay-2"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(180deg,#0f1515,#0b0f0f)",
              borderRadius: "16px",
              padding: "60px",
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: "40px"
            }}
          >

            {/* CARD */}
            <div>
              <div style={{ opacity: 0.5, marginBottom: "8px" }}>
                Active Contracts
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "300" }}>04</div>
            </div>

            <div>
              <div style={{ opacity: 0.5, marginBottom: "8px" }}>
                Monthly Volume
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "300" }}>
                1,250 kg
              </div>
            </div>

            <div>
              <div style={{ opacity: 0.5, marginBottom: "8px" }}>
                Supply Status
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "300", color: "#9fe3b0" }}>
                Stable
              </div>
            </div>

            <div>
              <div style={{ opacity: 0.5, marginBottom: "8px" }}>
                Next Shipment
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: "300" }}>
                May 12
              </div>
            </div>

            <div>
              <div style={{ opacity: 0.5, marginBottom: "8px" }}>
                Available Upside
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: "300" }}>
                +320 kg
              </div>
            </div>

            <div>
              <div style={{ opacity: 0.5, marginBottom: "8px" }}>
                Contract Health
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: "300" }}>
                On Track
              </div>
            </div>

          </div>

        </div>

      </section>

      {/* ================= CONTRACT LIFECYCLE ================= */}

      <section
        style={{
          padding: "160px 80px",
          background: "#f6f5f2",
          color: "#111"
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>

          {/* HEADER */}
          <h2
            style={{
              fontSize: "3rem",
              fontWeight: "300",
              marginBottom: "20px"
            }}
          >
            Contract Lifecycle
          </h2>

          <p style={{ opacity: 0.7, marginBottom: "80px", lineHeight: "1.8" }}>
            Every partnership follows a structured supply framework designed to ensure
            alignment, transparency and long-term stability.
          </p>

          {/* TIMELINE */}
          <div style={{ position: "relative", paddingLeft: "40px" }}>

            {/* LINE */}
            <div
              style={{
                position: "absolute",
                left: "10px",
                top: 0,
                bottom: 0,
                width: "1px",
                background: "#ddd"
              }}
            />

            {/* STEP */}
            {[
              {
                title: "Define Volume",
                text: "Clients select initial monthly volume and supply duration aligned with operational needs."
              },
              {
                title: "Pilot Period",
                text: "A structured trial phase allows both sides to validate logistics, quality and cadence."
              },
              {
                title: "Internal Review",
                text: "Supply availability and producer allocation are confirmed before activation."
              },
              {
                title: "Contract Activation",
                text: "Digital agreements are issued and executed securely between all parties."
              },
              {
                title: "Scale & Adjust",
                text: "Volume adjustments can be requested dynamically based on available capacity."
              }
            ].map((step, i) => (
              <div key={i} style={{ marginBottom: "60px" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "4px",
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#111"
                  }}
                />

                <h4 style={{ fontWeight: "500", marginBottom: "8px" }}>
                  {step.title}
                </h4>

                <p style={{ opacity: 0.7, lineHeight: "1.7" }}>
                  {step.text}
                </p>
              </div>
            ))}

          </div>
        </div>

      </section>

      {/* ================= SUPPLY VISIBILITY ================= */}

      <section
        style={{
          padding: "160px 80px",
          background: "#0c1414",
          color: "white"
        }}
      >

        <div style={{ width: "100%" }}>

          {/* HEADER */}
          <h2
            className="data-grid"
            style={{
              fontSize: "3rem",
              fontWeight: "300",
              marginBottom: "20px"
            }}
          >
            Supply Visibility
          </h2>

          <p
            style={{
              opacity: 0.75,
              maxWidth: "700px",
              marginBottom: "80px",
              lineHeight: "1.8"
            }}
          >
            Registered partners gain access to real-time supply signals indicating
            available production capacity and expansion opportunities across our network.
          </p>

          {/* GRID */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "60px"
            }}
          >

            {/* GREEN */}
            <div>
              <div style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: "#3ecf8e",
                marginBottom: "16px"
              }} />

              <h4 style={{ marginBottom: "10px", fontWeight: "500" }}>
                Green — Immediate Expansion
              </h4>

              <p style={{ opacity: 0.75, lineHeight: "1.7" }}>
                Additional volume is available. Contract adjustments can be issued instantly.
              </p>
            </div>

            {/* YELLOW */}
            <div>
              <div style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: "#f5c542",
                marginBottom: "16px"
              }} />

              <h4 style={{ marginBottom: "10px", fontWeight: "500" }}>
                Yellow — Review Required
              </h4>

              <p style={{ opacity: 0.75, lineHeight: "1.7" }}>
                Capacity may be available pending internal review and producer confirmation.
              </p>
            </div>

            {/* RED */}
            <div>
              <div style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: "#ff5a5a",
                marginBottom: "16px"
              }} />

              <h4 style={{ marginBottom: "10px", fontWeight: "500" }}>
                Red — Fully Allocated
              </h4>

              <p style={{ opacity: 0.75, lineHeight: "1.7" }}>
                No additional supply is currently available within the network.
              </p>
            </div>

          </div>



          {/* ===== DEMO ===== */}
          <div style={{
            display: "flex",
            gap: "60px",
            alignItems: "flex-start",
            padding: "40px 60px",
            width: "100%"
          }}>


           

          
          </div>
          </div>

      

      </section>

      {/* ================= CONTACT SECTION ================= */}
      <section
        id="contact"
        style={{
          padding: "120px 20px",
          textAlign: "center",
          backgroundColor: "#111",
          color: "white",
        }}

      >
        <h2
          style={{ fontSize: "36px", marginBottom: "30px" }}>
          Elevate Your Coffee Program
        </h2>


        <a
          href="/signup"
          style={{
            padding: "16px 32px",
            backgroundColor: "white",
            color: "black",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "600",
          }}
        >
          CONTACT OUR TEAM
        </a>
      </section>
    </div>


  )
   
}

    