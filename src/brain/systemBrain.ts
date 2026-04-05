import { PHYSICS } from "@/src/engine/core/modelPhysics";
import type { EngineState, EngineContext } from "@/src/engine/core/runtime";

// =====================================================
// SYSTEM BRAIN — ENGINE OWNED
// Derivación sistémica pura.
// No React. No hooks. 100% determinista.
// =====================================================

export function computeUnifiedPressure(
  state: EngineState,
  context: EngineContext
): number {

  const regions = state.regions;
  const systemFatigue = state.systemFatigue;
  const shockLevel = state.shockLevel;

  const requestedVolume = context.requestedVolume ?? 0;

  // =====================================================
  // REGIONAL STRESS METRICS
  // =====================================================

  if (!regions || regions.length === 0) {
    return 0;
  }

  // ---- stressed regions ratio

  const stressedRegionsRatio =
    regions.filter(r =>
      r.availableKg / Math.max(1, r.capacityKg) < 0.25
    ).length / regions.length;

  // ---- regional stress field (non linear)

  const totalStress = regions.reduce((acc, r) => {

    const utilization =
      1 - r.availableKg / Math.max(1, r.capacityKg);

    return acc + utilization;

  }, 0);

  const avgStress = totalStress / regions.length;

  const regionalStressField =
    Math.pow(avgStress, 1.15)

  // =====================================================
  // PRESSURE COMPONENTS
  // =====================================================

  const volumePressure =
  Math.tanh(requestedVolume / 200);

  const basePressure =
    volumePressure * 0.35 +
    stressedRegionsRatio * 0.2 +
    systemFatigue * 0.2 +
    shockLevel * (0.15 + systemFatigue * 0.05) +
    regionalStressField * 0.25;

  // =====================================================
  // STRUCTURAL FRAGILITY
  // =====================================================

  const fragility =
    systemFatigue * 0.5;

  const adjustedPressure =
    (basePressure + PHYSICS.pressure.baseline) *
    (1 + fragility * PHYSICS.pressure.fragilityGain);

  const saturated =
    Math.tanh(adjustedPressure * PHYSICS.pressure.saturationGain);

  // =====================================================
  // PREDICTIVE ERROR ESTIMATION
  // =====================================================

  const predicted =
    regionalStressField * 0.4 +
    systemFatigue * 0.3 +
    shockLevel * 0.3;

  const predictionError =
    Math.abs(predicted - saturated);

  const surpriseGain =
    predictionError * PHYSICS.resilience.surpriseSensitivity;

  const cognitivelyAdjusted =
    saturated * (1 + surpriseGain * 0.15);

  const currentEstimate =
    Math.tanh(cognitivelyAdjusted);

  // =====================================================
  // BELIEF UPDATE — ENGINE STATE MUTATION
  // =====================================================

  const BELIEF_RATE = 0.02;

  const learningMod =
    predictionError * PHYSICS.resilience.surpriseSensitivity;

  state.brainBelief =
    state.brainBelief +
    (currentEstimate - state.brainBelief) *
    (BELIEF_RATE + learningMod * 0.02);

  const beliefMixed =
    currentEstimate * 0.8 +
    state.brainBelief * 0.2;

  // =====================================================
  // ADAPTIVE SMOOTHING
  // =====================================================

  const stabilitySignal =
    1 - Math.min(
      1,
      systemFatigue * 0.5 +
      shockLevel * 0.5
    );

  const adaptiveSmoothing =
    PHYSICS.pressure.smoothing *
    (0.7 + stabilitySignal * 0.6);

// =====================================================
// TEMPORAL SMOOTHING — STATE CONSISTENT
// =====================================================

// presión objetivo calculada por el brain
const target = beliefMixed

// suavizado temporal usando el estado previo
const smoothing = adaptiveSmoothing

const smoothedPressure =
  state.unifiedPressure +
  (target - state.unifiedPressure) * smoothing

  return smoothedPressure;
}