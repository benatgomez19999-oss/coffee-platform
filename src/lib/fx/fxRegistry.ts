// lib/fx/fxRegistry.ts

import { runFx } from './fxEngine'

export function coffeeFx(setPhase: (p: string) => void, onFinish: () => void) {
  return runFx([
    { at: 0, action: () => setPhase('cherry') },
    { at: 800, action: () => setPhase('green') },
    { at: 1600, action: () => setPhase('roasted') },
    { at: 2400, action: () => setPhase('done') },
    { at: 3000, action: onFinish },
  ])
}