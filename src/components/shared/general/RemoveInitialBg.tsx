"use client"

import { useEffect } from "react"

export default function RemoveInitialBg() {
  useEffect(() => {
    const remove = () => {
      const el = document.getElementById("initial-cherry")
      if (el) {
        el.style.transition = "opacity 0.4s ease"
        el.style.opacity = "0"

        setTimeout(() => el.remove(), 400)
      }

      document.body.classList.remove("app-loading")
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(remove)
    })
  }, [])

  return null
}