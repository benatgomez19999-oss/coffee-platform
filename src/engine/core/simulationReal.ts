// =====================================================
// SIMULATION REAL — STRUCTURAL ENGINE
//
// Motor determinista multi-escala.
// Basado estrictamente en PHYSICS.
//
// Estratificación causal:
//
// 1. Drivers exógenos
// 2. Energy field
// 3. Fast dynamics
// 4. Structural dynamics
// 5. Landscape
// 6. Regime
// 7. Observables
//
// =====================================================

import { PHYSICS } from "@/src/engine/core/modelPhysics"
import type { EngineState, EngineContext } from "@/src/engine/core/runtime"
import { engineRandom } from "@/src/engine/core/runtime"
import { getEngineCalibration } from "@/src/engine/core/runtime"

export function stepSimulationReal(
  state: EngineState,
  ctx: EngineContext,
  dt: number
)
{

// =====================================================
// ENGINE CALIBRATION 
// =====================================================
const calib = getEngineCalibration()


// =====================================================
// TIME NORMALIZATION
// Base física calibrada a 60fps
// =====================================================

const baseStep = 1 / 60;

// El runtime ya aplica simulationSpeed y substepping.

const dtNorm = dt / baseStep;

  // =====================================================
  // LAYER 1 — EXOGENOUS DRIVERS
  // =====================================================

  // =====================================================
  // SCENARIO DRIVER FIELD — EXOGENOUS MODULATION
  //
  // Modula el sistema según modo seleccionado.
  // =====================================================

  {
    const mode =
      ctx.simulationMode ?? "Normal";

    let pressureBias = 0;
    let fatigueBias = 0;
    let noiseGain = 1;
    let energyBias = 0;

    switch (mode) {

      case "Peak demand":
        pressureBias = 0.08;
        fatigueBias = 0.02;
        noiseGain = 1.2;
        break;

      case "Supply stress":
        pressureBias = 0.05;
        fatigueBias = 0.05;
        noiseGain = 1.4;
        energyBias = 0.05;
        break;

      case "Expansion phase":
        pressureBias = -0.05;
        fatigueBias = -0.02;
        noiseGain = 0.8;
        break;

      case "Normal":
      default:
        break;
    }

    // Guardar en estado para uso en capas siguientes
    state._scenarioPressureBias = pressureBias;
    state._scenarioFatigueBias = fatigueBias;
    state._scenarioNoiseGain = noiseGain;
    state._scenarioEnergyBias = energyBias;
  }



  // =====================================================
  // LAYER 2 — ENERGY FIELD
  // =====================================================

  // =====================================================
  // SYSTEM ENERGY — STRUCTURAL ENVELOPE
  //
  // Energía global del sistema.
  // Modula dinámicas lentas y plasticidad.
  // =====================================================

  {
    const pressureComponent =
      (state.unifiedPressure ?? 0) * PHYSICS.pressure.saturationGain;

    const fatigueComponent =
      state.systemFatigue ?? 0;

    const shockComponent =
      state.shockLevel ?? 0;

    const momentumComponent =
      Math.abs(state.pressureMomentum ?? 0);

    const rawEnergy =
    pressureComponent * 0.30 +
    fatigueComponent * 0.30 +
    shockComponent * 0.25 +
    momentumComponent * 0.15;

    if (!Number.isFinite(rawEnergy)) {

      state.systemEnergy = 0;

    } else {

      const bounded =
        Math.max(0, Math.min(2, rawEnergy));

      // Saturación física suave
      state.systemEnergy =
        Math.tanh(bounded * 0.7);

    }
  }



  // =====================================================
  // LAYER 3 — FAST DYNAMICS
  // =====================================================

  // =====================================================
  // EVENT-DRIVEN RESOURCE FIELD — DISCRETE IMPULSES
  //
  // Reemplaza flujo continuo por dinámica episódica.
  //
  // Eventos discretos:
  // — activación regional escalonada
  // — magnitudes impulsivas
  // — clustering dependiente de memoria
  //
  // Totalmente acoplado a física estructural.
  // =====================================================

  {
    if (
      state.engineTime >= (state.nextDemoEvent ?? 0)
    ) {

      // ---------------------------------------------
      // CALM PERIOD
      // ---------------------------------------------

      if (
        state.engineTime <
        (state.calmUntil ?? 0)
      ) {

        state.nextDemoEvent =
          state.engineTime +
          (12000 + engineRandom() * 8000);

      } else if (
        (state.regions ?? []).length > 0
      ) {

        // ---------------------------------------------
        // REGION ACTIVATION SCHEDULING
        // ---------------------------------------------

        let regionsToActivate = 1;

        const pressure =
          state.unifiedPressure ?? 0;

        const fatigue =
          state.systemFatigue ?? 0;

        const scenario =
          ctx.simulationMode ?? "Normal";

        if (scenario === "Peak demand") {

          regionsToActivate =
            engineRandom() < 0.5 ? 1 :
            engineRandom() < 0.8 ? 2 : 3;

        }

        if (scenario === "Expansion phase") {

          regionsToActivate =
            engineRandom() < 0.6 ? 1 : 2;

        }

        state.pendingRegionalActivations =
          regionsToActivate;

        state.nextSubEventTime =
          state.engineTime;

        // ---------------------------------------------
        // NEXT EVENT TIMING
        // ---------------------------------------------

        let baseInterval =
          10000 + engineRandom() * 10000;

        // presión alta → más frecuencia
        baseInterval *=
          1 - pressure * 0.3;

        state.nextDemoEvent =
          state.engineTime +
          Math.max(4000, baseInterval);
      }
    }

    // ==================================================
    // SUB-EVENT EXECUTION (DISCRETE IMPULSE)
    // ==================================================

    if (
      (state.pendingRegionalActivations ?? 0) > 0 &&
      state.engineTime >= (state.nextSubEventTime ?? 0)
    ) {

      state.pendingRegionalActivations--;

      state.nextSubEventTime =
        state.engineTime +
        (800 + engineRandom() * 1400);

      const regions =
  state.regions ?? [];

if (regions.length > 0) {

  // ---------------------------------------------
  // REGION SELECTION (bounded cluster memory)
  // ---------------------------------------------

  let index = Math.floor(
    engineRandom() * regions.length
  );

  const last =
    state.lastActiveRegion ?? null;

  const streak =
    state.activityStreak ?? 0;

  const clusterProbability =
    Math.min(
      0.6,
      0.25 + streak * 0.08
    );

  if (
    last !== null &&
    engineRandom() < clusterProbability
  ) {
    index = last;
  }

  const region = regions[index];

  if (region) {

    const capacity =
      Math.max(1, region.capacityKg);

    const utilization =
      region.availableKg / capacity;

    // ---------------------------------------------
    // DIRECTION
    // ---------------------------------------------

    const pressure =
      state.unifiedPressure ?? 0;

    const fatigue =
      state.systemFatigue ?? 0;

    const scenario =
      ctx.simulationMode ?? "Normal";

    let downProbability =
      0.4 +
      pressure * 0.3 +
      fatigue * 0.2;

    if (scenario === "Peak demand") {
      downProbability += 0.2;
    }

    if (scenario === "Expansion phase") {
      downProbability -= 0.2;
    }

    downProbability =
      Math.max(0, Math.min(1, downProbability));

    const direction =
      utilization > 0.85 ? -1 :
      utilization < 0.2 ? 1 :
      engineRandom() < downProbability
        ? -1
        : 1;

    // ---------------------------------------------
    // MAGNITUDE
    // ---------------------------------------------

    const baseMagnitude =
      300 + engineRandom() * 900;

    const energy =
      state.systemEnergy ?? 0;

    const magnitude =
      baseMagnitude *
      (1 + pressure * 0.5) *
      (1 + energy * 0.3);

    const delta =
      direction * magnitude;

    let nextVolume =
      region.availableKg + delta;

    nextVolume =
      Math.max(
        0,
        Math.min(capacity, nextVolume)
      );

    region.availableKg =
      Number.isFinite(nextVolume)
        ? nextVolume
        : capacity * 0.5;

    // ---------------------------------------------
    // CLUSTER MEMORY UPDATE
    // ---------------------------------------------

    if (state.lastActiveRegion === index) {
      state.activityStreak =
        (state.activityStreak ?? 0) + 1;
    } else {
      state.activityStreak = 1;
    }

    state.lastActiveRegion = index;

  }
}
  }
  }


  // =====================================================
  // STOCHASTIC PRESSURE — FAST NOISE FIELD
  //
  // Ruido estructural dependiente de:
  // — Resiliencia adaptativa
  // — Fatiga acumulada
  // =====================================================

  {
    const resilience =
      Number.isFinite(state.adaptiveResilience)
        ? state.adaptiveResilience
        : 0.5;

    const fatigue =
      state.systemFatigue ?? 0;

    const fragility =
      Math.max(
        0,
        Math.min(
          2,
          (1 - resilience) +
          fatigue * 0.5
        )
      );

    const noise =
    (engineRandom() - 0.5) *
    PHYSICS.regime.noise *
    calib.noiseGain;

    const drive =
      noise * fragility;

    const decay = 0.1;

    const rate = decay;
const target = drive / Math.max(0.0001, decay);

const current = state.stochasticPressure ?? 0;
const alpha = 1 - Math.exp(-rate * dtNorm);

const next =
  current +
  (target - current) * alpha;

    if (!Number.isFinite(next)) {
      state.stochasticPressure = 0;
    } else {
      state.stochasticPressure = next;
    }
  }



  // =====================================================
  // MOMENTUM EVOLUTION — STRUCTURAL COUPLED CORE
  //
  // Integra aceleración estructural considerando:
  // — presión unificada
  // — ruido estocástico
  // — desgaste (fatiga)
  // — inclinación estructural futura (drift)
  //
  // Propiedades:
  // — Determinista
  // — Paso adaptativo dependiente de energía
  // — Clamp duro ±0.2
  // — Anti-NaN
  // =====================================================

  {
    const prev =
      state.pressureMomentum ?? 0;

    const unifiedPressure =
      state.unifiedPressure ?? 0;

    const stochastic =
      state.stochasticPressure ?? 0;

    const systemEnergy =
      state.systemEnergy ?? 0;

    const fatigue =
      state.systemFatigue ?? 0;

    const drift =
    (state.regimeDriftSignal ?? 0.5) - 0.5;

   const structuralInfluence =
   drift * 0.2;

    const guardThrottle =
      state.guardThrottle ?? 1;

    // -----------------------------------------------------
    // TARGET MOMENTUM — EQUILIBRIUM CENTERED
    // -----------------------------------------------------

    const equilibrium = 0.5;

    const pressureDeviation =
      unifiedPressure - equilibrium;

    const target =
      pressureDeviation * 0.8 +
      stochastic * 0.3 -
      fatigue * 0.4 +
      structuralInfluence;

    // -----------------------------------------------------
    // ADAPTIVE STEP
    // -----------------------------------------------------

    const delta = target - prev;

    const maxStep =
    (0.02 / (1 + systemEnergy + fatigue)) *
     guardThrottle;

    const step =
      Math.sign(delta) *
      Math.min(Math.abs(delta), maxStep);

    const next = prev + step;

    if (!Number.isFinite(next)) {
      state.pressureMomentum = 0;
    } else {
      state.pressureMomentum =
        Math.max(-0.2, Math.min(0.2, next));
    }
  }

  // =====================================================
  // SHOCK FIELD — ENDOGENOUS PERTURBATIONS
  //
  // Generación de shocks dependiente de:
  // — Energía
  // — Fragilidad
  // — Clustering
  //
  // Propiedades:
  // — Suavizado físico
  // — No explosivo
  // — Bounded
  // =====================================================

  {
    const baseProb =
      PHYSICS.shock.baseProbability;

    const clusteringGain =
      PHYSICS.shock.clusteringGain;

    const fragility =
      state.systemFatigue * 0.5 +
      state.systemEnergy * 0.5;

    const shockActivity =
      state.shockActivity ?? 0;

    // Probabilidad modulada por energía y clustering previo
    const probability =
    baseProb +
    fragility * 0.05 * calib.shockGain +
    shockActivity * clusteringGain;

    let shockImpulse = 0;

    if (engineRandom() < probability) {

      const amplitude =
        PHYSICS.shock.baseAmplitudeMin +
        engineRandom() *
        (PHYSICS.shock.baseAmplitudeMax -
         PHYSICS.shock.baseAmplitudeMin);

      shockImpulse =
        amplitude * (1 + fragility * 0.5);
    }

    // Integración suave (absorción física)
    const smoothing =
      PHYSICS.shock.smoothing;

    // Integración temporal coherente
   const shockDelta =
   (shockImpulse -
   (state.shockLevel ?? 0)) *
    smoothing;

   const nextShockLevel =
   (state.shockLevel ?? 0) +
    shockDelta * dtNorm;

    // Actualizar actividad para clustering
    const nextShockActivity =
      Math.max(0,
        shockActivity * 0.9 +
        shockImpulse * 2
      );

    if (!Number.isFinite(nextShockLevel)) {
      state.shockLevel = 0;
    } else {
      state.shockLevel =
        Math.max(0, Math.min(1.5, nextShockLevel));
    }

    state.shockActivity =
      Math.max(0, Math.min(1, nextShockActivity));
  }



  // =====================================================
  // LAYER 4 — STRUCTURAL DYNAMICS
  // =====================================================

  // =====================================================
  // FATIGUE — STRUCTURAL ACCUMULATION
  //
  // Evolución lenta.
  // Depende de presión, shocks y energía.
  // Moderada por estado energético global.
  // =====================================================

  {
    const currentFatigue =
      state.systemFatigue ?? 0;

// -----------------------------------------------------
// SATURATION — NON-LINEAR ACCUMULATION DAMPING
//
// Evita aceleración explosiva cerca del límite.
// A mayor fatiga acumulada,
// menor capacidad de seguir acumulando.
// -----------------------------------------------------

const fatigueLevel = currentFatigue;

const saturation =
  1 -
  Math.min(
    1,
    fatigueLevel /
    PHYSICS.fatigue.maxFatigue
  );

    const pressure =
      state.unifiedPressure ?? 0;

    const shock =
      state.shockLevel ?? 0;

    const energy =
      state.systemEnergy ?? 0;

    
// -----------------------------------------------------
// BASE ACCUMULATION (ENERGY MODULATED)
// -----------------------------------------------------


const accumulation =
(
  (
    (pressure + (state._scenarioPressureBias ?? 0)) *
      PHYSICS.fatigue.accumulationRate *
      calib.fatigueGain +

    shock *
      PHYSICS.fatigue.shockImpact +

    (state._scenarioFatigueBias ?? 0) *
      PHYSICS.fatigue.accumulationRate *
      calib.fatigueGain
  ) *
  (1 - energy * 0.6)
) *
saturation;   // saturación progresiva

    // Recuperación natural
    const recovery =
    PHYSICS.fatigue.recoveryRate; // menor recuperación bajo alta energía

    // Moderación energética:
    // cuanto mayor energía, menor tasa efectiva de cambio
    const moderation =
  1 - Math.min(0.6, energy * 0.7);

    const delta =
    (accumulation - recovery) *
    moderation *
    dtNorm;

    let nextFatigue =
      currentFatigue + delta;

    // Bound físico
    nextFatigue =
      Math.max(0,
        Math.min(
          PHYSICS.fatigue.maxFatigue,
          nextFatigue
        )
      );

    if (!Number.isFinite(nextFatigue)) {
      state.systemFatigue = 0;
    } else {
      state.systemFatigue = nextFatigue;
    }
  }

  // =====================================================
  // REGIME DRIFT SIGNAL — SLOW STRUCTURAL INCLINATION
  //
  // Representa la inclinación lenta del sistema.
  // Depende de:
  // — energía
  // — memoria estructural
  // — fatiga
  // =====================================================

  {
    const current =
      state.regimeDriftSignal ?? 0.5;

    const energy =
      state.systemEnergy ?? 0;

    const fatigue =
      state.systemFatigue ?? 0;

    const memory =
      state.pathMemory ?? 0;

    const structuralPressure =
      energy * 0.4 +
      fatigue * 0.3 +
      memory * 0.3;

    // Inclinación alrededor de 0.5
    const target =
      0.5 +
      (structuralPressure - 0.5) * 0.4;

    const smoothing = 0.01;

    const rate = smoothing;
const alpha = 1 - Math.exp(-rate * dtNorm);

const next =
  current +
  (target - current) * alpha;

    if (!Number.isFinite(next)) {
      state.regimeDriftSignal = 0.5;
    } else {
      state.regimeDriftSignal =
        Math.max(0, Math.min(1, next));
    }
  }

  // =====================================================
  // ADAPTIVE RESILIENCE — STRUCTURAL PLASTICITY
  //
  // Evolución lenta dependiente de:
  // — sorpresa estructural (shock + presión)
  // — energía global
  // — fatiga acumulada
  // =====================================================

  {
    const currentResilience =
      state.adaptiveResilience ?? 0.5;

    const pressure =
      state.unifiedPressure ?? 0;

    const shock =
      state.shockLevel ?? 0;

    const fatigue =
      state.systemFatigue ?? 0;

    const energy =
      state.systemEnergy ?? 0;

    // Señal de sorpresa estructural
    const surprise =
      Math.abs(pressure - (state.pressureMomentum ?? 0)) * 0.5 +
      shock * 0.5;

    // Aprendizaje dependiente de sorpresa
    const learning =
      surprise *
      PHYSICS.resilience.learningRate *
      (1 - energy * PHYSICS.resilience.adaptiveGainDamping);

    // Erosión bajo energía elevada
    const erosion =
      energy *
      PHYSICS.resilience.erosionRate *
      (1 + fatigue);

    let nextResilience =
    currentResilience +
    (learning - erosion) *
    dtNorm;

    // Bound inferior estructural
    nextResilience =
      Math.max(
        PHYSICS.resilience.minimum,
        Math.min(1, nextResilience)
      );

    if (!Number.isFinite(nextResilience)) {
      state.adaptiveResilience =
        PHYSICS.resilience.minimum;
    } else {
      state.adaptiveResilience =
        nextResilience;
    }
  }

  // =====================================================
  // PATH MEMORY — STRUCTURAL TRAJECTORY
  //
  // Acumula exposición prolongada a:
  // — energía elevada
  // — fatiga
  // — shocks persistentes
  // =====================================================

  {
    const currentMemory =
      state.pathMemory ?? 0;

    const energy =
      state.systemEnergy ?? 0;

    const fatigue =
      state.systemFatigue ?? 0;

    const shock =
      state.shockLevel ?? 0;

    // Exposición estructural combinada
    const exposure =
      energy * 0.4 +
      fatigue * 0.3 +
      shock * 0.3;

    // Acumulación lenta
    const accumulation =
      exposure *
      PHYSICS.memory.pathAccumulation;

    // Disipación estructural lenta
    const healing =
      PHYSICS.memory.healingRate *
      (1 - energy);

    // Moderación energética:
    // bajo alta energía la memoria consolida más lento
    const moderation =
      1 - Math.min(1, energy * 0.6);

    let nextMemory =
    currentMemory +
    (accumulation - healing) *
    moderation *
    dtNorm;

    // Bound físico
    nextMemory =
      Math.max(0, Math.min(1, nextMemory));

    if (!Number.isFinite(nextMemory)) {
      state.pathMemory = 0;
    } else {
      state.pathMemory = nextMemory;
    }
  }

  // =====================================================
  // RESILIENCE BUDGET — STRUCTURAL CAPACITY LIMIT
  //
  // Representa el capital estructural disponible
  // para absorber estrés sin degradarse.
  // =====================================================

  {
    const current =
      state.resilienceBudget ?? 0.8;

    const resilience =
      state.adaptiveResilience ?? 0.5;

      

    const fatigue =
      state.systemFatigue ?? 0;

    const energy =
      state.systemEnergy ?? 0;

    // Consumo bajo estrés
    // la resiliencia protege el presupuesto estructural

    const depletion =
    (energy * 0.4 + fatigue * 0.6) *
    (1 - resilience * 0.6) *
    0.02;

    // Recuperación bajo estabilidad
    const recovery =
    PHYSICS.fatigue.recoveryRate *
    (1 - energy * 0.5);

    let next =
    current +
    (-depletion + recovery) *
    dtNorm;
    
    next =
      Math.max(0, Math.min(1, next));

    if (!Number.isFinite(next)) {
      state.resilienceBudget = 0.5;
    } else {
      state.resilienceBudget = next;
    }
  }

  // =====================================================
  // STRESS SCAR — DEEP STRUCTURAL MEMORY
  //
  // Memoria estructural lenta del sistema.
  //
  // Se integra coherentemente con:
  // — PHYSICS.memory
  // — PHYSICS.timescales.memory
  // =====================================================

  {
    const current =
      state.stressScar ?? 0;

    const energy =
      state.systemEnergy ?? 0;

    const collapse =
      state.collapseProximity ?? 0;

    const slowing =
      state.criticalSlowing ?? 0;

    // -----------------------------------------------------
    // MEMORY TIMESCALE
    // -----------------------------------------------------

    const memoryScale =
      1 / PHYSICS.timescales.memory;

    // -----------------------------------------------------
    // STRUCTURAL STRESS DRIVER
    // -----------------------------------------------------

    const stressDriver =
      energy * 0.5 +
      collapse * 0.5;

    // -----------------------------------------------------
    // NON-LINEAR ACCUMULATION
    //
    // Acumula más cuando:
    // — estrés sostenido
    // — cicatriz aún baja
    // -----------------------------------------------------

    const accumulation =
      (1 - current) *
      stressDriver *
      PHYSICS.memory.pathAccumulation *
      memoryScale;

    // -----------------------------------------------------
    // STRUCTURAL STABILITY FIELD
    //
    // Healing solo bajo:
    // — baja proximidad a colapso
    // — baja desaceleración crítica
    // -----------------------------------------------------

    const structuralStability =
      1 - (
        collapse * 0.5 +
        slowing * 0.5
      );

    const healing =
      structuralStability *
      PHYSICS.memory.healingRate *
      memoryScale;

    let next =
    current +
    (accumulation - healing) *
    dtNorm;

    // Bound físico más realista
    next =
      Math.max(0, Math.min(0.3, next));

    if (!Number.isFinite(next)) {
      state.stressScar = 0;
    } else {
      state.stressScar = next;
    }
  }
  
  // =====================================================
  // ATTRACTOR FIELD — STRUCTURAL LANDSCAPE
  //
  // Representa la geometría dinámica del sistema.
  // Define cuencas metaestables.
  // =====================================================

  {
    const currentAttractor =
      state.attractorField ?? 0.5;

    const memory =
      state.pathMemory ?? 0;

    const fatigue =
      state.systemFatigue ?? 0;

    const energy =
      state.systemEnergy ?? 0;

    // Deformación estructural
    const deformation =
      memory * PHYSICS.landscape.memoryDeformation +
      fatigue * PHYSICS.landscape.fatigueDeformation +
      energy * PHYSICS.landscape.pressureDeformation;

    // Consolidación hacia cuencas
    const basinPull =
      (0.5 - currentAttractor) *
      PHYSICS.landscape.basinStrength;

    // Moderación energética
    const moderation =
      1 - Math.min(1, energy * 0.5);

    let nextAttractor =
    currentAttractor +
    (deformation + basinPull) *
    PHYSICS.landscape.smoothing *
    moderation *
    dtNorm;

    // Bound físico
    nextAttractor =
      Math.max(0, Math.min(1, nextAttractor));

    if (!Number.isFinite(nextAttractor)) {
      state.attractorField = 0.5;
    } else {
      state.attractorField = nextAttractor;
    }
  }



  // =====================================================
  // LAYER 5 — LANDSCAPE
  // =====================================================



  // =====================================================
  // LAYER 6 — REGIME
  // =====================================================

// =====================================================
  // REGIME ENGINE — ENDOGENOUS SWITCHING
  //
  // El régimen emerge de:
  // — energía
  // — fatiga
  // — attractor
  // — memoria estructural
  // =====================================================

  {
  const energy = state.systemEnergy ?? 0;
  const fatigue = state.systemFatigue ?? 0;
  const attractor = state.attractorField ?? 0.5;
  const memory = state.pathMemory ?? 0;

  // -----------------------------------------------------
  // STRUCTURAL PRESSURE FIELD
  // -----------------------------------------------------

  const structuralPressure =
    energy * PHYSICS.regime.pressureInfluence +
    fatigue * PHYSICS.regime.fatigueInfluence +
    memory * 0.2 +
    attractor * 0.2;

  // -----------------------------------------------------
  // TEMPORAL SMOOTHING (dt integrated)
  // -----------------------------------------------------

  state.regimeSwitchPressure =
    state.regimeSwitchPressure +
    (structuralPressure -
     state.regimeSwitchPressure) *
    0.05 *
    dtNorm;

  // -----------------------------------------------------
  // DYNAMIC THRESHOLDS
  // -----------------------------------------------------

  const enterThreshold =
    PHYSICS.regime.enterBase +
    memory * PHYSICS.regime.hysteresisWidth;

  const exitThreshold =
    PHYSICS.regime.exitBase -
    memory * PHYSICS.regime.hysteresisWidth;

  const moderation =
    1 - Math.min(1, energy * 0.4);

  // -----------------------------------------------------
  // SWITCHING LOGIC (no dt)
  // -----------------------------------------------------

  if (
    state.systemRegime === "Steady state" &&
    state.regimeSwitchPressure > enterThreshold * moderation
  ) {
    state.systemRegime = "Structural stress";
    state.regimePersistence = 0;
  }

  if (
    state.systemRegime === "Structural stress" &&
    state.regimeSwitchPressure < exitThreshold
  ) {
    state.systemRegime = "Steady state";
    state.regimePersistence = 0;
  }

  // -----------------------------------------------------
  // REGIME PERSISTENCE (dt integrated)
  // -----------------------------------------------------

  state.regimePersistence =
    Math.min(
      1,
      state.regimePersistence +
      PHYSICS.regime.lockInStrength *
      dtNorm
    );
}

  // =====================================================
// SUPPLY STRESS FIELD — PHYSICAL STOCK RISK
//
// Mide riesgo real de desabastecimiento basado en:
// — utilización media
// — región más vacía
// — desigualdad entre regiones
//
// No sustituye el riesgo estructural.
// Lo complementa.
// =====================================================

{
  const regions = state.regions ?? [];

  if (regions.length > 0) {

    let totalUtilization = 0;
    let minUtilization = 1;
    let maxUtilization = 0;

    for (const r of regions) {

      const capacity =
        Math.max(1, r.capacityKg);

      const utilization =
        1 - (r.availableKg / capacity);

      totalUtilization += utilization;

      minUtilization =
        Math.min(minUtilization, utilization);

      maxUtilization =
        Math.max(maxUtilization, utilization);
    }

    const avgUtilization =
      totalUtilization / regions.length;

    const imbalance =
      maxUtilization - minUtilization;

    // Peso principal: riesgo por vaciado
    const depletionRisk =
      avgUtilization * 0.6 +
      maxUtilization * 0.4;

    // Penalización por desbalance
    const imbalancePenalty =
      imbalance * 0.3;

    const rawSupplyStress =
      depletionRisk + imbalancePenalty;

    state.supplyStressField =
      Math.max(0, Math.min(1, rawSupplyStress));

  } else {

    state.supplyStressField = 0;

  }
}

// =====================================================
// CRITICAL FIELD — SLOWING + COLLAPSE PROXIMITY
//
// Modela pérdida progresiva de estabilidad
// antes de transición estructural.
// =====================================================

{
  const energy = state.systemEnergy ?? 0;
  const fatigue = state.systemFatigue ?? 0;
  const switchPressure = state.regimeSwitchPressure ?? 0;
  const memory = state.pathMemory ?? 0;

  // -----------------------------------------------------
  // DISTANCE TO CRITICAL THRESHOLD
  // -----------------------------------------------------

  const distanceToCritical =
    Math.abs(
      switchPressure - PHYSICS.regime.enterBase
    );

  const slowingRaw =
    1 - Math.min(1, distanceToCritical * 3);

  const moderation =
    1 - Math.min(1, energy * 0.5);

  // -----------------------------------------------------
  // CRITICAL SLOWING (dt-stable integration)
  // -----------------------------------------------------

  const slowingRate = 0.1;

  const slowingAlpha =
    1 - Math.exp(-slowingRate * dtNorm);

  const slowingTarget =
    slowingRaw * moderation;

  const slowingNext =
    state.criticalSlowing +
    (slowingTarget - state.criticalSlowing) * slowingAlpha;

  state.criticalSlowing =
    Math.max(0, Math.min(1, slowingNext));

  // -----------------------------------------------------
  // COLLAPSE PROXIMITY FIELD
  // -----------------------------------------------------

  const supplyStress =
    state.supplyStressField ?? 0;

  const collapseField =
    (
      energy * 0.25 +
      fatigue * 0.2 +
      memory * 0.15 +
      supplyStress * 0.4
    ) * calib.collapseGain;

  const collapseRate = 0.12;

  const collapseAlpha =
    1 - Math.exp(-collapseRate * dtNorm);

  state.collapseProximity =
    state.collapseProximity +
    (collapseField - state.collapseProximity) * collapseAlpha;

  // -----------------------------------------------------
  // CONTINUOUS COLLAPSE PROBABILITY
  // -----------------------------------------------------

  const collapseRaw =
    state.collapseProximity *
    state.criticalSlowing;

  state.collapseProbability =
    Math.max(
      0,
      Math.min(1, collapseRaw)
    );
}

  // -----------------------------------------------------
  // CONTINUOUS COLLAPSE PROBABILITY
  // -----------------------------------------------------

  const collapseRaw =
    state.collapseProximity *
    state.criticalSlowing;

  state.collapseProbability =
    Math.max(
      0,
      Math.min(1, collapseRaw)
    );

// --------------------------------------
// COLLAPSE VELOCITY
// Detecta aceleración hacia bifurcación
// --------------------------------------

const prevCollapse =
  state._lastCollapseSample ?? state.collapseProximity

const collapseVelocity =
  state.collapseProximity - prevCollapse

state.collapseVelocity =
  Math.max(-1, Math.min(1, collapseVelocity))

state._lastCollapseSample =
  state.collapseProximity

// -----------------------------------------------------
// SYSTEM EVENT MEMORY
// -----------------------------------------------------

if (state.collapseProbability > 0.8) {

  state.history.collapseEvents++

}

if (state.regimePersistence === 0) {

  state.history.regimeSwitches++

}

if (state.criticalSlowing > 0.6) {

  state.history.stressAlerts++

}



  // =====================================================
  // LAYER 7 — OBSERVABLES
  // =====================================================

  // =====================================================
  // LYAPUNOV INDICATOR — DYNAMIC DIVERGENCE SENSOR
  //
  // Mide aceleración energética estructural.
  // Detecta pérdida progresiva de estabilidad dinámica.
  // =====================================================

  {
    const currentEnergy =
      state.systemEnergy ?? 0;

    const previousEnergy =
      state.lastEnergySample ?? 0;

    const energyDelta =
      Math.abs(currentEnergy - previousEnergy);

    // actualizar muestra histórica
    state.lastEnergySample =
      currentEnergy;

    const fatigue =
    state.systemFatigue ?? 0;

   const rawSignal =
   energyDelta * 0.6 +
   currentEnergy * 0.25 +
   fatigue * 0.15;

    const rate = 0.1;

    const current = state.lyapunovIndicator ?? 0;
    const alpha = 1 - Math.exp(-rate * dtNorm);

    const smoothed =
  current +
  (rawSignal - current) * alpha;

    if (!Number.isFinite(smoothed)) {
      state.lyapunovIndicator = 0;
    } else {
      state.lyapunovIndicator =
        Math.max(0, Math.min(1, smoothed));
    }
  }



}