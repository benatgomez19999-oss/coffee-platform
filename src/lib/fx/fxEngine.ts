// lib/fx/fxEngine.ts

export type FXStep = {
  at: number
  action: () => void
}

export function runFx(steps: FXStep[]) {
  const timers: NodeJS.Timeout[] = []

  steps.forEach(step => {
    const t = setTimeout(step.action, step.at)
    timers.push(t)
  })

  return () => timers.forEach(clearTimeout)
}