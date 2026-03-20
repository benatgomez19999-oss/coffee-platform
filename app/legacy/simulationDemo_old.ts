import { PHYSICS } from "../../src/engine/modelPhysics";
import type { EngineState, EngineContext } from "../../src/engine/runtime";
import { engineRandom, getEngineSignals } from "../../src/engine/runtime";


const signals = getEngineSignals()


// =====================================================
// SIMULATION CORE — DETERMINISTIC PHYSICS
// =====================================================

export function stepSimulation(
  state: EngineState & Record<string, any>,
  ctx: EngineContext & Record<string, any>
) {

// =====================================================
// DEBUG TRACE — DETERMINISTIC SAFE
// Usa RNG del engine para no romper reproducibilidad
// =====================================================

if (engineRandom() < 0.01) {
  console.log("unifiedPressure:", ctx.unifiedPressure);
}
console.log("UP:", ctx.unifiedPressure)



// =====================================================
// SHOCK FIELD — STOCHASTIC DRIVER
// =====================================================

  {
    const baseProb = PHYSICS.shock.baseProbability;

    const clustering =
      state.shockActivity * PHYSICS.shock.clusteringGain;

    const probability = baseProb + clustering;

    if (engineRandom() < probability) {

// RNG determinista — permite reproducibilidad del motor 
        const amplitude =
  PHYSICS.shock.baseAmplitudeMin +
  engineRandom() *
  (PHYSICS.shock.baseAmplitudeMax - PHYSICS.shock.baseAmplitudeMin);

      state.shockLevel =
        state.shockLevel * (1 - PHYSICS.shock.smoothing) +
        amplitude * PHYSICS.shock.smoothing;

      state.shockActivity = Math.min(1, state.shockActivity + 0.1);

    } else {

      state.shockLevel *= 0.97;
      state.shockActivity *= 0.95;

    }

    if (!Number.isFinite(state.shockLevel)) state.shockLevel = 0;
    if (!Number.isFinite(state.shockActivity)) state.shockActivity = 0;
  }

// =====================================================
  // GLOBAL UTILIZATION — STRUCTURAL LOAD FACTOR
  // =====================================================

  const globalUtilization =
  state.regions.length === 0
    ? 0
    : state.regions.reduce(
        (acc: number, r) => {
          const cap = Math.max(1, r.capacityKg);
          return acc + (1 - r.availableKg / cap);
        },
        0
      ) / state.regions.length;
    

// =====================================================
// PRESSURE-INDUCED SHOCK EXCITATION
// Excitación estructural cuando la presión es alta.
// =====================================================

{
  const pressureShock =
    Math.max(0, ctx.unifiedPressure - 0.60) * 0.25;

  const next =
    state.shockLevel +
    pressureShock;

  if (Number.isFinite(next)) {
    state.shockLevel =
      Math.max(0, Math.min(1, next));
  }
}



  // =====================================================
// FATIGUE EVOLUTION
// =====================================================

{
  const shockImpact =
    state.shockLevel * PHYSICS.fatigue.shockImpact;

  const momentumImpact =
    Math.abs(state.pressureMomentum) * 0.05;


 const weights: number[] =
  state.regions.map((r) => {
    const utilization =
      r.availableKg / r.capacityKg;

    const imbalance =
      Math.abs(utilization - 0.5);

    return 1 + imbalance * 2;
  });

  const loadAmplifier =
  0.3 + globalUtilization * 0.7;

  const fatigueAccumulation =
    Math.max(0, ctx.unifiedPressure - 0.58) *
      PHYSICS.fatigue.accumulationRate *
      loadAmplifier +
    shockImpact * loadAmplifier +
    momentumImpact * loadAmplifier;

  const recovery =
    PHYSICS.fatigue.recoveryRate;

  // =====================================================
  // FATIGUE INERTIA — TIME CONSTANT MODEL
  // =====================================================

  const targetFatigue =
    Math.max(
      0,
      Math.min(
        PHYSICS.fatigue.maxFatigue,
        state.systemFatigue +
          fatigueAccumulation -
          recovery
      )
    );

  const fatigueAdaptationRate = 0.03;

  state.systemFatigue +=
    (targetFatigue - state.systemFatigue) *
    fatigueAdaptationRate;

  // -------------------------------------
  // SATURATION RELEASE BOOST
  // -------------------------------------

  if (
    state.systemFatigue > 0.98 &&
    fatigueAccumulation < recovery
  ) {
    state.systemFatigue -= 0.005;
  }

  // safety clamp
  state.systemFatigue =
    Math.max(0, Math.min(1, state.systemFatigue));
}

// =====================================================
// SYSTEM ENERGY — INTERNAL ENERGY ENVELOPE
//
// Energía dinámica total del sistema.
// Se deriva de presión, fatiga y shocks.
// Vive exclusivamente dentro del runtime.
//
// Principios:
// — Determinista
// — Bounded
// — Anti-NaN
// =====================================================

{
  const raw =
    ctx.unifiedPressure * 0.4 +
    state.systemFatigue * 0.3 +
    state.shockLevel * 0.2 +
    state.pressureMomentum * 0.2;

  if (!Number.isFinite(raw)) {
    state.systemEnergy = 0;
  } else {
    const bounded = Math.max(0, Math.min(2, raw));
    state.systemEnergy = Math.tanh(bounded * 0.8);
  }
}

// =====================================================
// LYAPUNOV INDICATOR — DYNAMIC DIVERGENCE SENSOR
// Mide aceleración energética estructural
// =====================================================

{
  const energyDelta =
    Math.abs(state.systemEnergy - state.lastEnergySample);

  state.lastEnergySample = state.systemEnergy;

  const signal =
    energyDelta * 0.7 +
    state.systemEnergy * 0.3;

  const smoothed =
    state.lyapunovIndicator * 0.9 +
    signal * 0.1;

  if (Number.isFinite(smoothed)) {
    state.lyapunovIndicator =
      Math.max(0, Math.min(1, smoothed));
  }
}

// =====================================================
// ADAPTIVE RESILIENCE — INTERNAL STRUCTURAL FIELD
// Migrated from React (Core Physics Closure)
// =====================================================

{
  const deformation =
    state.systemFatigue * PHYSICS.landscape.fatigueDeformation +
    ctx.unifiedPressure * PHYSICS.landscape.pressureDeformation +
    state.pathMemory *
      PHYSICS.landscape.memoryDeformation;

  const raw =
    (
      1 -
      ctx.unifiedPressure * 0.3 -
      state.systemFatigue * 0.2 -
      state.stressScar * 0.25 -
      ctx.structuralDrift * 0.3 -
      deformation
    ) *
    (0.7 + ctx.resilienceMemory * 0.6);

  const bounded =
    Math.max(0.25, raw);

  state.adaptiveResilience =
    Number.isFinite(bounded)
      ? Math.max(0, Math.min(1.5, bounded))
      : state.adaptiveResilience;
}


  // =====================================================
  // STOCHASTIC PRESSURE — FAST NOISE FIELD
  // Migrado desde React.
  // =====================================================

  {
    const res =
    Number.isFinite(state.adaptiveResilience)
    ? state.adaptiveResilience
    : 0.5;

    const fragility =
      Math.max(
        0,
        Math.min(
          2,
          (1 - res) +
          state.systemFatigue * 0.5
        )
      );

// RNG determinista — permite reproducibilidad del motor
  const noise =
  (engineRandom() - 0.5) * PHYSICS.regime.noise;

    const drive =
      noise * fragility;

    const decay = 0.1;

    const next =
      state.stochasticPressure +
      drive -
      state.stochasticPressure * decay;

    state.stochasticPressure =
      Number.isFinite(next)
        ? next
        : state.stochasticPressure;
  }


  // =====================================================
  // MOMENTUM EVOLUTION
  // =====================================================

  const momentum = evolveMomentum({
  prev: state.pressureMomentum,
  unifiedPressure: ctx.unifiedPressure,
  stochasticPressure: state.stochasticPressure,
  systemEnergy: state.systemEnergy,
  systemFatigue: state.systemFatigue,
  regimeDriftSignal: state.regimeDriftSignal,
  guardThrottle: state.guardThrottle 
});

  state.pressureMomentum = momentum;

  

  // =====================================================
  // REGIME DRIFT — STRUCTURAL TREND DETECTOR
  // dinámica lenta dependiente de historia
  // =====================================================

  {

  // calculo 
  const structuralTrend =
  state.regimePersistence * 0.2 +
  state.pathMemory * 0.2 +
  state.stressScar * 0.15 +
  ctx.structuralDrift * 0.15 +
  state.systemFatigue * 0.3 +
  ctx.unifiedPressure * 0.1;

    const latentPressure =
      state.regimePersistence * 0.2 +
      state.systemFatigue * 0.2;

    const stabilityGate =
      state.adaptiveResilience * 0.4 +
      (1 - state.systemFatigue) * 0.3 +
      (1 - state.shockLevel) * 0.3;

    const raw =
      structuralTrend * 0.5 +
      latentPressure * 0.5 -
      stabilityGate * 0.3;

    const convexRaw = raw + raw * raw * 0.5;

    const target =
      Math.tanh(convexRaw * 1.1) * 0.5 + 0.5;

    const next =
      state.regimeDriftSignal +
      (target - state.regimeDriftSignal) * 0.02;

    if (Number.isFinite(next)) {
      state.regimeDriftSignal = Math.max(0, Math.min(1, next));
    }
  }

// =====================================================
// REGIME SWITCHING — PHASE TRANSITION ENGINE
// dinámica no lineal con histéresis + memoria adaptativa
// =====================================================

{
  const pressure =
    ctx.unifiedPressure * PHYSICS.regime.pressureInfluence;

  const fatigue =
    state.systemFatigue * PHYSICS.regime.fatigueInfluence;

  const drift =
    state.regimeDriftSignal * 0.5;

  const noise =
    (engineRandom() - 0.5) * PHYSICS.regime.noise;

  const raw =
    pressure +
    fatigue +
    drift +
    noise +
    state.systemFatigue * 0.3;

  // suavizado — evita switching espurio
  state.regimeSwitchPressure =
    state.regimeSwitchPressure * 0.9 +
    raw * 0.1;

  const enterThreshold =
    PHYSICS.regime.enterBase +
    ctx.thresholdMemory * 0.05;

  const exitThreshold =
    PHYSICS.regime.exitBase -
    ctx.thresholdMemory * 0.05;

  // =====================================================
  // STRUCTURAL HYSTERESIS — persistence modula umbrales
  // =====================================================

  const structuralBias =
    state.regimePersistence * 0.15;

  const dynamicEnterThreshold =
    enterThreshold + structuralBias;

  const dynamicExitThreshold =
    exitThreshold - structuralBias;

  // =====================================================
  // STATE MACHINE
  // =====================================================

  if (state.systemRegime === "Steady state") {

    if (state.regimeSwitchPressure > dynamicEnterThreshold) {
      state.systemRegime = "Structural stress";
      state.regimePersistence = 0;
    }

  } else {

    if (state.regimeSwitchPressure < dynamicExitThreshold) {
      state.systemRegime = "Steady state";
      state.regimePersistence = 0;
    }

  }
}


// =====================================================
// REGIME PERSISTENCE — ADAPTIVE STRUCTURAL MEMORY
// consolidación + relajación natural
// =====================================================

{
  const consolidationSignal =
    state.regimeSwitchPressure * 0.4 +
    state.regimeDriftSignal * 0.3 +
    state.systemFatigue * 0.2 +
    (1 - state.adaptiveResilience) * 0.1;

  const target =
    Math.max(0, Math.min(1, consolidationSignal));

  const adaptationRate = 0.02;   // velocidad de consolidación
  const relaxationRate = 0.01;   // relajación natural

  const rawNext =
    state.regimePersistence +
    (target - state.regimePersistence) * adaptationRate -
    state.regimePersistence *
      relaxationRate *
      (1 - target);

  if (Number.isFinite(rawNext)) {
    state.regimePersistence =
      Math.max(0, Math.min(1, rawNext));
  }
}



// =====================================================
// THRESHOLD MEMORY — STRUCTURAL HYSTERESIS DEPTH
// Memoria lenta de rigidez en transición de régimen.
// =====================================================

{
  const structuralPressure =
    state.regimeSwitchPressure * 0.4 +
    state.regimePersistence * 0.3 +
    state.stressScar * 0.3;

  const target =
    Math.max(0, Math.min(1, structuralPressure));

  const learningRate = 0.01;
  const decayRate = 0.004;

  const next =
    state.thresholdMemory +
    (target - state.thresholdMemory) * learningRate -
    state.thresholdMemory * decayRate * (1 - target);

  if (Number.isFinite(next)) {
    state.thresholdMemory =
      Math.max(0, Math.min(1, next));
  }
}


// =====================================================
// STRUCTURAL MEMORY SCAR — SENSITIVE STRUCTURAL DAMAGE
// =====================================================

// 1️⃣ Shock significativo (más sensible)
const highShock =
  Math.max(0, state.shockLevel - 0.4);

// 2️⃣ Presión sostenida (más baja)
const sustainedPressure =
  Math.max(0, ctx.unifiedPressure - 0.6);

// 3️⃣ Utilización extrema
const capacityShock =
  Math.max(0, globalUtilization - 0.75);

// 4️⃣ Fatiga estructural acumulada
const fatigueStress =
  Math.max(0, state.systemFatigue - 0.6);

// 5️⃣ Régimen amplifica pero no bloquea
const regimeBoost =
  state.systemRegime === "Structural stress" ? 1.2 : 1;

// 6️⃣ Acumulación directa (SIN depender de collapseProximity)
const accumulation =
  (
    highShock * 0.01 +
    sustainedPressure * 0.006 +
    capacityShock * 0.012 +
    fatigueStress * 0.008
  ) * regimeBoost;

// 7️⃣ Decay más suave
const DECAY = 0.0015;

// 8️⃣ Dinámica con inercia real
state.stressScar +=
  accumulation -
  state.stressScar * DECAY;

// 9️⃣ Clamp
state.stressScar =
  Math.max(0, Math.min(0.5, state.stressScar));

// =====================================================
// SHOCK MEMORY — TEMPORAL SHOCK ACCUMULATION
// =====================================================

{
  const accumulation =
    state.shockLevel * 0.02;

  const decay = 0.01;

  const next =
    state.shockMemory +
    accumulation -
    state.shockMemory * decay;

  if (Number.isFinite(next)) {
    state.shockMemory =
      Math.max(0, Math.min(1, next));
  }
}


// =====================================================
// REFLEXIVITY LOOP — STRUCTURAL BIAS ACCUMULATION
// =====================================================

{
  if (state.systemRegime === "Structural stress") {

    const reflexBoost =
      state.regimePersistence *
      state.regimePersistence *
      0.003;

    const nextBias =
      state.structuralBias + reflexBoost;

    state.structuralBias =
      Math.max(-1, Math.min(1, nextBias));

    // =====================================================
    // CLAMP DE SEGURIDAD — evita runaway estructural
    // =====================================================

    state.pressureMomentum = Math.max(
      -0.2,
      Math.min(0.2, state.pressureMomentum)
    );
  }
}

// =====================================================
// CRITICAL SLOWING — STRUCTURAL DECELERATION
// Señal de pérdida progresiva de resiliencia dinámica.
// =====================================================

state.criticalSlowing =
  Math.min(
    1,
    state.systemFatigue * 0.4 +
    state.pathMemory * 0.3 +
    state.regimePersistence * 0.2
  );

// =====================================================
// COLLAPSE PROXIMITY — BIFURCATION INDICATOR
// Señal de cercanía a transición estructural.
// =====================================================

state.collapseProximity =
  Math.min(
    1,
    state.criticalSlowing * 0.4 +
    state.regimePersistence * 0.3 +
    state.regimeDriftSignal * 0.2 +
    state.stressScar * 0.2
  );

// =====================================================
// COLLAPSE PROBABILITY — STRUCTURAL FAILURE LIKELIHOOD
// Derivada suave de proximidad + fatiga + lyapunov
// =====================================================

state.collapseProbability =
  Math.min(
    1,
    state.collapseProximity * 0.5 +
    state.systemFatigue * 0.3 +
    state.lyapunovIndicator * 0.2
  );

// =====================================================
// EWS SCORE — EARLY WARNING SYSTEM
// Señal compuesta de inestabilidad sistémica.
// =====================================================

state.ewsScore =
  Math.min(
    1,
    state.criticalSlowing * 0.35 +
    state.collapseProximity * 0.35 +
    state.regimeDriftSignal * 0.2 +
    state.systemFatigue * 0.2
  );

// =====================================================
// RESILIENCE BUDGET — STRUCTURAL CAPACITY RESERVE
// Capacidad restante del sistema para absorber estrés.
// =====================================================

const depletion =
  state.systemFatigue * 0.4 +
  state.criticalSlowing * 0.3 +
  state.collapseProximity * 0.2 +
  state.ewsScore * 0.2;

state.resilienceBudget =
  Math.max(0, Math.min(1, 1 - depletion));


// =====================================================
// DEMO PHASE EVOLUTION — SLOW ORGANIC STATE
// =====================================================

{
  const stressSignal =
    ctx.unifiedPressure * 0.4 +
    state.systemFatigue * 0.3 +
    state.ewsScore * 0.2 +
    state.shockLevel * 0.2;

  const target =
    Math.max(0, Math.min(1, stressSignal));

  state.demoPhaseIntensity +=
    (target - state.demoPhaseIntensity) * 0.01;

  if (state.demoPhaseIntensity < 0.3) {
    state.demoPhase = "calm";
  } else if (state.demoPhaseIntensity < 0.65) {
    state.demoPhase = "normal";
  } else {
    state.demoPhase = "active";
  }
}

// =====================================================
// SIMULATION MODE ADAPTATION
// Modula comportamiento del demo
// =====================================================

let scenarioFrequencyMultiplier = 1;
let scenarioMagnitudeMultiplier = 1;
let scenarioDownBias = 0;
let scenarioDriftBoost = 0;

switch (ctx.simulationMode) {

  case "Peak demand":
    scenarioFrequencyMultiplier = 0.7;
    scenarioMagnitudeMultiplier = 1.4;
    scenarioDownBias = 0.15;
    scenarioDriftBoost = 0.2;
    break;

  case "Supply stress":
    scenarioFrequencyMultiplier = 0.8;
    scenarioMagnitudeMultiplier = 1.2;
    scenarioDownBias = 0.25;
    scenarioDriftBoost = 0.3;
    break;

  case "Expansion phase":
    scenarioFrequencyMultiplier = 1.2;
    scenarioMagnitudeMultiplier = 1.1;
    scenarioDownBias = -0.15;
    scenarioDriftBoost = -0.1;
    break;

  case "Normal":
  default:
    break;
}

// ==============================
// SUB-EVENT PROCESSING
// Ejecuta regiones de forma escalonada
// ==============================

if (
  state.pendingRegionalActivations > 0 &&
  state.engineTime >= state.nextSubEventTime
) {

  state.pendingRegionalActivations--;

  // siguiente sub-evento ocurre en 0.8–2.2s
  state.nextSubEventTime =
    state.engineTime +
    (800 + engineRandom() * 1400);

  if (state.regions.length > 0) {

    // ==============================
    // 2️⃣ REGION SELECTION (memory)
    // ==============================

    let index: number;

    const clusterChance =
      0.25 + state.activityStreak * 0.1;

    // --------------------------------------
    // 2.1️⃣ CLUSTER MEMORY (prioridad)
    // --------------------------------------

    if (
      state.lastActiveRegion !== null &&
      engineRandom() < clusterChance
    ) {

      index = state.lastActiveRegion;

    } else {
      
    
      // --------------------------------------
      // 2.2️⃣ WEIGHTED SELECTION (imbalance bias)
      // --------------------------------------

      const weights = state.regions.map(r => {
        const utilization =
          r.availableKg / r.capacityKg;

        const imbalance =
          Math.abs(utilization - 0.5);

        return 1 + imbalance * 2;
      });

      const totalWeight =
        weights.reduce((a, b) => a + b, 0);

      if (totalWeight <= 0) {

        index = Math.floor(
          engineRandom() * state.regions.length
        );

      } else {

        let pick =
          engineRandom() * totalWeight;

        let cumulative = 0;

        index = 0;

        for (let i = 0; i < weights.length; i++) {

          cumulative += weights[i];

          if (pick <= cumulative) {
            index = i;
            break;
          }
        }
      }
    }

    const region = state.regions[index];

    if (region) {

      // ==============================
      // 3️⃣ SYSTEM BIAS
      // ==============================

      const utilization =
        region.availableKg / region.capacityKg;

      const pressureBias =
        ctx.unifiedPressure * 0.5;

      const fatigueBias =
        state.systemFatigue * 0.4;

      const downProbability =
        0.4 +
        pressureBias * 0.3 +
        fatigueBias * 0.2 +
        scenarioDownBias;

      const direction =
        utilization > 0.8 ? -1 :
        utilization < 0.25 ? 1 :
        engineRandom() < downProbability ? -1 : 1;

      // ==============================
      // 4️⃣ MAGNITUDE
      // ==============================

      const baseMagnitude =
        300 + engineRandom() * 900;

      const streakAmplifier =
        1 + state.activityStreak * 0.2;

      const magnitude =
        (
          direction < 0
            ? baseMagnitude *
              (1 + state.systemFatigue * 0.4)
            : baseMagnitude * 0.8
        ) * scenarioMagnitudeMultiplier;

      // --------------------------------------
      // EDGE STABILIZATION
      // --------------------------------------

      const edgeFriction =
        utilization < 0.1 ||
        utilization > 0.9
          ? 0.5
          : 1;

      const delta =
        direction *
        magnitude *
        streakAmplifier *
        edgeFriction;

      region.availableKg = Math.max(
        0,
        Math.min(
          region.capacityKg,
          region.availableKg + delta
        )
      );

      // ==============================
      // 5️⃣ MICRO STRUCTURAL DRIFT
      // ==============================

      const structuralDriftImpact =
        (state.demoPhaseIntensity + scenarioDriftBoost) * 0.001;

      region.availableKg = Math.max(
        0,
        region.availableKg *
          (1 - structuralDriftImpact)
      );

      // ==============================
      // 6️⃣ MEMORY UPDATE
      // ==============================

      if (state.lastActiveRegion === index) {
        state.activityStreak++;
      } else {
        state.activityStreak = 1;
      }

      state.lastActiveRegion = index;

      // ==============================
      // 7️⃣ OCCASIONAL CALM PERIOD
      // ==============================

      const calmProbability =
        0.1 +
        state.demoPhaseIntensity * 0.1;

      if (engineRandom() < calmProbability) {

        state.calmUntil =
          state.engineTime +
          (20000 + engineRandom() * 20000);

        state.activityStreak =
          Math.floor(
            state.activityStreak * 0.5
          );
      }
    }
  }
}

// =====================================================
// DEMO ORGANIC ACTIVITY — ORGANIC CLUSTERED MODEL
// =====================================================

if (state.engineTime >= state.nextDemoEvent) {

  // ==============================
  // 1️⃣ CALM PERIOD
  // ==============================

  if (state.engineTime < state.calmUntil) {

    // solo programamos siguiente chequeo
    state.nextDemoEvent =
      state.engineTime +
      (12000 + engineRandom() * 8000);

  } else {

    if (state.regions.length > 0) {



            // ==============================
      // 2️⃣ REGION ACTIVATION SCHEDULING
      // ==============================

      let regionsToActivate = 1;

      if (ctx.simulationMode === "Peak demand") {
        regionsToActivate =
          engineRandom() < 0.5
            ? 1
            : engineRandom() < 0.8
              ? 2
              : 3;
      }

      if (ctx.simulationMode === "Expansion phase") {
        regionsToActivate =
          engineRandom() < 0.6 ? 1 : 2;
      }

      // ==============================
      // SCHEDULE REGIONAL ACTIVATIONS
      // ==============================

      state.pendingRegionalActivations =
        regionsToActivate;

      // primer sub-evento ocurre inmediatamente
      state.nextSubEventTime =
        state.engineTime;

    // ==============================
// 8️⃣ NEXT EVENT TIMING
// ==============================

// Base ahora 10–20 segundos
let baseInterval =
  10000 + engineRandom() * 10000;

// Ajuste por fase demo
if (state.demoPhase === "calm") {
  baseInterval *= 1.3;
}

if (state.demoPhase === "active") {
  baseInterval *= 0.8;
}

state.nextDemoEvent =
  state.engineTime +
  baseInterval * scenarioFrequencyMultiplier;
  }
}


// GLOBAL FIREWALL
// 🔥🔥🔥 ===================================================== 🔥🔥🔥
// Protección final contra inestabilidad numérica
// Reinicio de campos críticos + Contención de divergencia sistémica
// 🔥🔥🔥 ===================================================== 🔥🔥🔥

if (!Number.isFinite(state.systemEnergy)) {
  state.systemEnergy = 0;
}

if (!Number.isFinite(state.pressureMomentum)) {
  state.pressureMomentum = 0;
}

if (!Number.isFinite(state.stochasticPressure)) {
  state.stochasticPressure = 0;
}

if (!Number.isFinite(state.systemFatigue)) {
  state.systemFatigue = 0;
}

if (!Number.isFinite(state.regimeDriftSignal)) {
  state.regimeDriftSignal = 0;
}

// =====================================================
// SIGNAL EXPORT — RUNTIME ASCENSOR
// Publica estado físico al registro global de señales.
// =====================================================

signals.stochasticPressure = state.stochasticPressure;
signals.switchPressure = state.regimeSwitchPressure;
signals.momentum = state.pressureMomentum;
signals.regimeDrift = state.regimeDriftSignal;
signals.regimePersistence = state.regimePersistence;
signals.thresholdMemory = state.thresholdMemory;
signals.ewsScore = state.ewsScore;
signals.collapseProximity = state.collapseProximity;
signals.adaptiveResilience = state.adaptiveResilience;
signals.pathMemory = state.pathMemory;
signals.patternMemory = state.patternMemory;
signals.shockMemory = state.shockMemory;
signals.resilienceBudget = state.resilienceBudget;
signals.lyapunov = state.lyapunovIndicator;

}


// =====================================================
// MOMENTUM INTEGRATOR — STRUCTURAL COUPLED CORE
//
// Integra aceleración del sistema con:
// — presión unificada
// — ruido estocástico
// — desgaste (fatiga)
// — inclinación estructural (drift)
//
// Principios:
// — Determinista
// — Paso adaptativo dependiente de energía
// — Clamp estable ±0.2
// — Sin acceso directo al state global
// =====================================================

function evolveMomentum({
  prev,
  unifiedPressure,
  stochasticPressure,
  systemEnergy,
  systemFatigue,
  regimeDriftSignal,
  guardThrottle
}: {
  prev: number;
  unifiedPressure: number;
  stochasticPressure: number;
  systemEnergy: number;
  systemFatigue: number;
  regimeDriftSignal: number;
  guardThrottle: number;
}) {

  // -----------------------------------------------------
  // STRUCTURAL INFLUENCE
  // Drift > 0.5 acelera
  // Drift < 0.5 frena
  // -----------------------------------------------------

  const structuralInfluence =
    (regimeDriftSignal - 0.5) * 0.2;

// -----------------------------------------------------
// TARGET MOMENTUM — EQUILIBRIUM CENTERED
// Momentum es desviación respecto a presión neutra
// -----------------------------------------------------

const equilibrium = 0.5; // presión estructural neutra

const pressureDeviation =
  unifiedPressure - equilibrium;

const target =
  pressureDeviation * 0.8 +
  stochasticPressure * 0.3 -
  systemFatigue * 0.4 +
  structuralInfluence;
  // -----------------------------------------------------
  // ADAPTIVE STEP (energy bounded)
  // -----------------------------------------------------

  const delta = target - prev;

 const maxStep =
  (0.01 / (1 + systemEnergy + systemFatigue)) *
  guardThrottle;

  const step =
    Math.sign(delta) *
    Math.min(Math.abs(delta), maxStep);

  const next = prev + step;

  if (!Number.isFinite(next)) return prev;

  // -----------------------------------------------------
  // HARD CLAMP
  // -----------------------------------------------------

  return Math.max(-0.2, Math.min(0.2, next));
}
}


