// lib/fx/fxStore.ts

type FXState = {
  activeFx: string | null
  hasRun: Record<string, boolean>
}

const state: FXState = {
  activeFx: null,
  hasRun: {},
}

export function startFx(id: string) {
  if (state.hasRun[id]) return false

  state.activeFx = id
  state.hasRun[id] = true

  return true
}

export function endFx() {
  state.activeFx = null
}

export function getActiveFx() {
  return state.activeFx
}