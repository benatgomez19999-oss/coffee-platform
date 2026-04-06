"use client"

import { useEffect, useState } from "react"
import CoffeeFXView from "./CoffeeFXView"

export default function CoffeeLoader({ onFinish }: { onFinish?: () => void }) {
  const [phase, setPhase] = useState(1)

  useEffect(() => {
    //////////////////////////////////////////////////////
    // 🔥 REMOVE SSR LOADER (handoff correcto)
    //////////////////////////////////////////////////////

    const ssrLoader = document.getElementById("initial-loader")

    if (ssrLoader) {
      ssrLoader.style.opacity = "0"

      setTimeout(() => {
        if (document.body.contains(ssrLoader)) {
          ssrLoader.remove()
        }
      }, 400)
    }

    //////////////////////////////////////////////////////
    // 🎬 TIMELINE
    //////////////////////////////////////////////////////

    const timeouts: NodeJS.Timeout[] = []

    const timeline = [
      { t: 300, p: 1 },   // 🍒 cherry
      { t: 900, p: 2 },   // 🟢 green
      { t: 2800, p: 3 },  // ☕ roasted
      { t: 5200, p: 4 },  // fade out
    ]

    timeline.forEach(step => {
      const t = setTimeout(() => {
        setPhase(step.p)
      }, step.t)

      timeouts.push(t)
    })

    //////////////////////////////////////////////////////
    // 🏁 FINISH
    //////////////////////////////////////////////////////

    const FINISH_TIME = 5800

    const finishTimeout = setTimeout(() => {
      onFinish?.()
    }, FINISH_TIME)

    timeouts.push(finishTimeout)

    //////////////////////////////////////////////////////
    // 🧹 CLEANUP
    //////////////////////////////////////////////////////

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [onFinish])

  //////////////////////////////////////////////////////
  // 🎨 VIEW
  //////////////////////////////////////////////////////

  return <CoffeeFXView phase={phase} />
}