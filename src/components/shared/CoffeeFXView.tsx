"use client"

export default function CoffeeFXView({ phase }: { phase: number }) {
  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#1a0f07] transition-opacity duration-700 ${
        phase >= 4 ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className="relative w-[320px] h-[320px] md:w-[420px] md:h-[420px] flex items-center justify-center"
        style={{
          animation: "heat 4s ease-in-out infinite"
        }}
      >
        {/* HEAT DISTORSSION */}

        <div
          className={`
            absolute inset-0 pointer-events-none
            ${phase >= 2 ? "opacity-100" : "opacity-0"}
          `}
          style={{
            backdropFilter: phase >= 2 ? "blur(6px)" : "blur(2px)",
            WebkitBackdropFilter: phase >= 2 ? "blur(6px)" : "blur(2px)",
            maskImage:
              "radial-gradient(circle at center, rgba(0,0,0,0.4), transparent 70%)",
          }}
        />

        <div
          className={`
            steam transition-opacity duration-700
            ${phase >= 3 ? "opacity-100" : phase >= 2 ? "opacity-30" : "opacity-0"}
          `}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>

        {/* 🍒 PRE-GLOW */}
        <div
          className={`
            absolute z-0 rounded-full blur-[100px] transition-all duration-700
            ${phase === 1 ? "opacity-50 scale-95" : "opacity-0 scale-50"}
          `}
          style={{
            background:
              "radial-gradient(circle, rgba(255,180,100,0.15), transparent 70%)",
            animation: phase === 1 ? "glowBreath 4s ease-in-out infinite" : "none"
          }}
        />

        {/* 🔥 GLOW BASE UNIFICADO */}
        <div
          className={`
            absolute z-0 rounded-full blur-[140px] transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] transition-opacity duration-200
            ${
              phase >= 2
                ? "w-[480px] h-[480px] opacity-80 scale-100"
                : "w-[300px] h-[300px] opacity-0 scale-50"
            }
          `}
          style={{
            background:
              phase >= 3
                ? "radial-gradient(circle, rgba(255,160,60,0.35), transparent 70%)"
                : "radial-gradient(circle, rgba(212,175,55,0.25), transparent 70%)",
            animation: phase >= 2 ? "glowBreath 3.5s ease-in-out infinite" : "none"
          }}
        />

        {/* ⚡ GLOW INTENSO */}
        <div
          className={`
            absolute z-0 rounded-full blur-[80px] transition-all duration-700 ease-in-out 
            ${
              phase >= 3
                ? "w-[420px] h-[420px] opacity-70 scale-110"
                : "opacity-0 scale-90"
            }
          `}
          style={{
            background:
              "radial-gradient(circle, rgba(255,140,50,0.4), transparent 70%)",
          }}
        />

        {/* 🍒 CHERRY */}
        <img
          src="/images/coffee_cherry.png"
          className={`
            absolute z-20 w-[240px] md:w-[300px] object-contain
            transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${
              phase >= 2
                ? "opacity-0 scale-[0.9] blur-[4px]"
                : "opacity-100 scale-[1.02] blur-0"
            }
          `}
          style={{
            filter: `
              brightness(${phase >= 2 ? 1.1 : 1.05})
              contrast(1.05)
              saturate(${phase >= 2 ? 0.9 : 1.1})
            `,
          }}
        />

        <div
          className={`
            absolute z-10 rounded-full blur-[20px]
            ${phase === 1 ? "opacity-30" : "opacity-0"}
          `}
          style={{
            width: "80px",
            height: "80px",
            top: "30%",
            left: "50%",
            transform: "translateX(-50%)",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.2), transparent)",
          }}
        />

        {/* ⚡ ENERGY BURST */}
        <div
          className={`
            absolute z-0 rounded-full blur-[40px]
            ${phase === 2 ? "animate-energyBurst" : "opacity-0"}
          `}
          style={{
            background:
              "radial-gradient(circle, rgba(255,220,120,0.6), transparent 70%)",
            width: "260px",
            height: "260px",
          }}
        />

        {/* 🟢 GREEN */}
        <img
          src="/images/coffee_bean_green_prod.png"
          className={`
            absolute z-10 w-[240px] md:w-[300px] object-contain
            transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${
              phase >= 3
                ? "opacity-0 scale-96 blur-[2px]"
                : phase >= 2
                  ? "opacity-100 scale-100 blur-0 delay-100"
                  : "opacity-0 scale-[0.92] blur-[3px]"
            }
          `}
          style={{
            filter:
              phase >= 3
                ? "brightness(1.1) contrast(1.1) saturate(0.8)"
                : "brightness(1.25) contrast(1.1)",
          }}
        />

        {/* ☕ ROASTED */}
        <img
          src="/images/coffee_bean_roasted_prod.png"
          className={`
            absolute z-10 w-[240px] md:w-[300px] object-contain
            transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${
              phase >= 3
                ? "opacity-100 scale-100 blur-0"
                : phase >= 2
                  ? "opacity-0 scale-[0.94] blur-[3px]"
                  : "opacity-0 scale-[0.9] blur-[6px]"
            }
          `}
          style={{
            animation: phase >= 3 ? "pulseGlow 2s ease-in-out infinite" : "none",
            filter:
              phase >= 3
                ? "brightness(1.3) contrast(1.15) saturate(1.1)"
                : "brightness(1.2) contrast(1.1)",
          }}
        />

        {/* 🌫️ ATMOSPHERE */}
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${
            phase >= 2 ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background: `
              radial-gradient(circle at center, rgba(255,200,120,0.08), transparent 60%),
              radial-gradient(circle at 60% 40%, rgba(255,140,60,0.06), transparent 70%)
            `,
          }}
        />
      </div>

      {/* 💨 HEAT ANIMATION */}
      <style jsx>{`
        @keyframes heat {
          0% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-6px) scale(1.01);
          }
          100% {
            transform: translateY(0px) scale(1);
          }
        }
      `}</style>
    </div>
  )
}