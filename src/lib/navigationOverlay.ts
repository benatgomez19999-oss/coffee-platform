//////////////////////////////////////////////////////
// 🔥 GLOBAL NAV OVERLAY (NEUTRO)
//////////////////////////////////////////////////////

export function showNavOverlay() {
  if (typeof document === "undefined") return

  const el = document.getElementById("nav-overlay-root")
  if (!el) return

  el.innerHTML = `
    <div style="
      position:fixed;
      inset:0;
      background:#1a0f07;
      z-index:9999;
    "></div>
  `
}

export function hideNavOverlay() {
  if (typeof document === "undefined") return

  const el = document.getElementById("nav-overlay-root")
  if (!el) return

  el.innerHTML = ""
}