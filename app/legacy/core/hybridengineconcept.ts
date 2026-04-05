// // ===============================================================
// // 🔒 REACT ENGINE LOOP — DISABLED (Detox Phase 1)
// // ===============================================================

// // useEffect(() => {

// //   unstable_batchedUpdates(() => {
// //     ...
// //   });

// // }, [simTick]);
// // ===============================================================
// // ███████╗███╗   ██╗ ██████╗ ██╗███╗   ██╗███████╗
// // ██╔════╝████╗  ██║██╔════╝ ██║████╗  ██║██╔════╝
// // █████╗  ██╔██╗ ██║██║  ███╗██║██╔██╗ ██║█████╗
// // ██╔══╝  ██║╚██╗██║██║   ██║██║██║╚██╗██║██╔══╝
// // ███████╗██║ ╚████║╚██████╔╝██║██║ ╚████║███████╗
// // ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝
// // =============================== ENGINE LOOP ===================
// // ===============================================================

// useEffect(() => {

// // 🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀
// // ╔══════════════════════════════════════════════════════════════════════╗
// // ║        RENDER GATE — ENGINE EXECUTION SINGULARITY GATE             ║
// // ║   Umbral de activación y control antes de entrar al ENGINE LOOP    ║
// // ║        Filtro de frecuencia + Visibilidad + Protección runtime     ║
// // ╚══════════════════════════════════════════════════════════════════════╝
// // 🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀🌀

// renderGateRef.current++;

// // ===============================
// // FRAME SKIP CONTROL (ANTI-STORM)
// // ===============================

// if (renderGateRef.current % 2 !== 0) {
//   return;
// }

// // ====================
// // TAB VISIBILITY GUARD
// // ====================
// if (document.hidden) {
//   return;
// }

// // ========================
// // BATCHED ENGINE EXECUTION
// // ========================
// unstable_batchedUpdates(() => {

// // ==============================================================
// // SOFT START FACTOR — PROGRESSIVE ENGINE ACTIVATION (STABILIZED)
// // Ramp-up temporal + Atenuación inicial de energía
// // ==============================================================

//     const elapsed =
//       performance.now() - startupRef.current;

//     const WARMUP_MS = 4000;

//     startupFactorRef.current =
//       Math.min(1, elapsed / WARMUP_MS);

//     const startup = startupFactorRef.current;

//     const softGain = 0.2 + 0.8 * startup;

// // =====================================================
// // GLOBAL WARMUP ENVELOPE — STARTUP ENERGY MODULATION (STABILIZED)
// // Control global de energía durante fase de arranque
// // =====================================================

// const warmupEnvelope =
//   0.1 + 0.9 * startup; // arranca al 10%
  
// // =======================================================
// // INERTIA RAMP — TEMPORAL MASS NORMALIZATION (STABILIZED)
// // Ajuste progresivo de masa dinámica estructural
// // =======================================================

// const inertiaRamp =
//   1.5 - 0.5 * startup; // empieza pesada → normaliza

// // ENGINE

//   globalCoherenceLag.current = globalCoherence;

// // ===== CAUSAL PHASE MARKERS ===== //
// // organiza evolución del sistema en capas temporales

// // ===================================================================
// // RUNTIME STABILITY GUARD — DIVERGENCE & UPDATE CONTROL (STABILIZED)
// // Detección de tormentas de actualización + Energía fuera de control
// // ===================================================================

// const now = Date.now();

// const dtMs =
//   now - lastTickTimeRef.current;

// lastTickTimeRef.current = now;

// // frecuencia anómala
// const tickInstability =
//   dtMs < 40 ? 1 : 0;

// // energía fuera de control
// const energyInstability =
//   Math.max(0, systemEnergy - metaStabilityEnergy);

// // divergencia dinámica
// const divergence =
//   lyapunovIndicator;

// // score compuesto
// const instability =
//   tickInstability * 0.3 +
//   energyInstability * 0.4 +
//   divergence * 0.3;

// // suavizado
// instabilityScoreRef.current =
//   instabilityScoreRef.current * 0.9 +
//   instability * 0.1;

// // throttle adaptativo
// guardThrottleRef.current =
//   1 - Math.min(0.7, instabilityScoreRef.current);

// // opcional log debug
// if (instabilityScoreRef.current > 0.6) {
//   console.warn("⚠️ Runtime instability detected");
// }


// // =============================================================================================
// // ======================================== PHASE 1 ============================================
// // ================= EXTERNAL DRIVERS — Impulsores externos: shock y ruido exógeno =============
// // =============================================================================================

// // =======================================================================
// // SHOCK EVOLUTION — Activación exógena y propagación inicial (STABILIZED)
// // Protección anti-NaN + Smoothing adaptativo + Anti-oscillation
// // =======================================================================


// setShockLevel(prev => {

//   const baseProb = 0.01;
//   const clusteringBoost = shockActivity * 0.08;

//   const prob =
//   Math.min(
//     0.25,
//     (baseProb + clusteringBoost) * softGain * warmupEnvelope
//   );

// const shockEvent =
//   Math.random() < prob;

//   const baseShock =
//   shockEvent
//     ? 0.05 + Math.random() * 0.15
//     : 0;

// const shockTarget =
//   baseShock *
//   (1 + shockAmplification * 1.5) *
//   warmupEnvelope /
//   adaptiveCriticalDamping;

//   const SMOOTHING = 0.12;

//  const adjustedSmoothing =
//   Math.max(0, SMOOTHING * (1 - recoveryHalfLife * 0.6));

// const next =
//   prev + (shockTarget - prev) * adjustedSmoothing;

//   return Math.abs(next - prev) < 0.0005 ? prev : next;

// });

//  // ⚠️ SHADOW BLOCK — DO NOT DELETE
//  // ===== MIGRATED TO ENGINE RUNTIME =====
//  // ----- STOCHASTIC PRESSURE FIELD ----- //

// // setStochasticPressure(prev => {

// // const res =
// //   Number.isFinite(adaptiveResilienceRef.current)
// //     ? adaptiveResilienceRef.current
// //     : 0.5;

// // const fragility =
// //   Math.max(0, Math.min(2,
// //     (1 - res) +
// //     systemFatigue * 0.5 +
// //     criticalSlowing * 0.8
// //   ));

// //   const noise =
// //     (Math.random() - 0.5) * 0.01;

// //   const drive =
// //   noise * fragility * softGain * warmupEnvelope;

// //   const decay = 0.1;

// //   const next =
// //     prev + drive - prev * decay;

// //    if (!Number.isFinite(next)) return prev;


// //   return Math.abs(next - prev) < 0.0001 ? prev : next;

// // });


// // ⚠️ SHADOW BLOCK — DO NOT DELETE
// // Original momentum integrator preserved for validation.
// // Runtime now drives momentum evolution.

// // =============================================================================================
// // ======================================== PHASE 2 ============================================
// // ================= FAST DYNAMICS — Dinámica rápida: momentum y propagación ===================
// // =============================================================================================

// //  // ----- MOMENTUM EVOLUTION ----- //

// // setPressureMomentum(prev => {

// //   const momentumTarget =
// //     (unifiedPressure - alertMemory + breathingSignal) *
// //     sensitivityFactor *
// //     stabilityClamp *
// //     temporalCoherence
// //     + attractorField * 0.2
// //     + cycleSignal * phaseDamping
// //     + stochasticPressure

// //     if (!Number.isFinite(momentumTarget)) return prev;

// //     // --- ENERGY AWARE LIMITER ---
// // // evita amplificación oculta bajo baja disipación

// // const gainLimiter =
// //   1 / (1 + Math.max(0, systemEnergy - metaStabilityEnergy) * 2);

// //   const MAX_STEP_BASE = 0.015 * guardThrottleRef.current;
// //   const dampingFactor =
// //   1 / (1 + adaptiveDamping);

// //   const energySlowdown = 1 + systemEnergy * 0.8;
// //   const fatigueSlowdown = 1 + systemFatigue * 1.2;

// // const rawMaxStep =
// //   (
// //     MAX_STEP_BASE *
// //     adaptiveResilience *
// //     globalDamping *
// //     dampingFactor
// //   ) /
// //   (
// //     inertiaRamp *
// //     adaptiveCriticalDamping *
// //     energySlowdown *
// //     structuralInertia *
// //     fatigueSlowdown
// //   ) *
// //   energyBudget *
// //   (1 - congestionFactor * 0.6) *
// //   (1 - phaseSignal * 0.4) *
// //   (1 - criticalSlowing * 0.5);

// // const MAX_STEP =
// //   Number.isFinite(rawMaxStep)
// //     ? Math.max(0.0005, Math.min(0.05, rawMaxStep)) * softGain
// //     : 0.001 * softGain;

// // const delta = momentumTarget - prev;

// // if (Math.abs(delta) < 0.0007) return prev;

// //   const step =
// //     Math.sign(delta) *
// //     Math.min(Math.abs(delta), MAX_STEP);

// //   const next = prev + step;

// //   if (!Number.isFinite(next)) return prev;

// //   return Math.max(-0.2, Math.min(0.2, next));

// // });


// // =============================================================================================
// // ======================================== PHASE 3 ============================================
// // ================= STRUCTURAL STATE — Estado estructural: fatiga y buffers ===================
// // =============================================================================================


// // ⚠️ SHADOW BLOCK — DO NOT DELETE
// // ===== MIGRATED TO ENGINE RUNTIME =====
// // // fatigue evolution now computed in simulationCore
// // // ----- FATIGUE EVOLUTION -----

// // setSystemFatigue(prev => {

// //   const shockImpact = shockLevel * PHYSICS.fatigue.shockImpact;

// //   const accumulation =
// //     Math.max(0, unifiedPressure - 0.45) * PHYSICS.fatigue.accumulationRate +
// //     shockImpact;

// //   const recovery = PHYSICS.fatigue.recoveryRate;

// //   const raw =
// //     Math.max(
// //       0,
// //       Math.min(
// //         PHYSICS.fatigue.maxFatigue,
// //         prev + accumulation - recovery
// //       )
// //     );

// //   const next = raw * 0.98 + prev * 0.02;

// //   if (Math.abs(next - prev) < 0.002) return prev;

// //   return next;

// // });

// // =============================================================================================
// // ======================================== PHASE 4 ============================================
// // ===================== MEMORY UPDATE — Actualización de memoria y cicatrices =================
// // =============================================================================================

// // // ⚠️ SHADOW BLOCK — DO NOT DELETE
// // // ===== MIGRATED TO SIMULATION CORE =====
// // // ----- PATH DEPENDENCE MEMORY ----- //

// // setPathMemory(prev => {

// //   const stressExposure =
// //     unifiedPressure * 0.01 +
// //     systemFatigue * 0.015 +
// //     phaseSignal * 0.02;

// //   const shockExposure =
// //     shockLevel * 0.02 +
// //     shockActivity * 0.01;

// //   const healing =
// //     bufferMargin * 0.01 +
// //     resilienceMemory * 0.01;

// //   const next =
// //     Math.max(0, Math.min(1,
// //       prev + stressExposure + shockExposure - healing
// //     ));

// //   return Math.abs(next - prev) < 0.0005 ? prev : next;

// // });

// // =========================================================================
// // STRUCTURAL MEMORY DECAY — Decaimiento de memoria estructural (STABILIZED)
// // Protección anti-NaN + Decay controlado + Anti-oscillation
// // =========================================================================

// setStressScar(prev => {

//   const shockImprint = shockLevel * 0.01;
//   const pressureImprint = Math.max(0, unifiedPressure - 0.65) * 0.005;

//   const accumulation = shockImprint + pressureImprint;

//   const DECAY = 0.0015;

//   const next =
//     Math.max(0, Math.min(0.5,
//       prev + accumulation - prev * DECAY
//     ));

//   return Math.abs(next - prev) < 0.00001 ? prev : next;

// });

// setStructuralDrift(prev => {

//   const DECAY_RATE = 0.001;

//   const next = prev * (1 - DECAY_RATE);

//   return Math.abs(next - prev) < 0.00001 ? prev : next;

// });

// // =============================================================================================
// // ======================================== PHASE 5 ============================================
// // ================= LANDSCAPE FIELD — Campo de paisaje y meta-estabilidad =====================
// // =============================================================================================

// // ================================================================================
// // META-STABILITY ATTRACTOR FIELD — Campo atractor de meta-estabilidad (STABILIZED)
// // Protección anti-NaN + Smoothing estable + Anti-oscillation
// // ================================================================================

// setAttractorField(prev => {

//   const centers = [0.25, 0.5, 0.75];

//   const attraction = centers.reduce((acc, c) => {
//     const distance = unifiedPressure - c;
//     return acc - distance * Math.exp(-distance * distance * 20);
//   }, 0);

//   const SMOOTH = 0.05;

//   const next = prev + (attraction - prev) * SMOOTH;

//   return Math.abs(next - prev) < 0.0005 ? prev : next;

// });


// // // ⚠️ SHADOW BLOCK — DO NOT DELETE
// // // ===== MIGRATED TO ENGINE RUNTIME =====

// // =============================================================================================
// // ======================================== PHASE 6 ============================================
// // ================= COGNITIVE & META-DYNAMICS — Capa cognitiva y meta-dinámica ================
// // =============================================================================================

// // // ⚠️ SHADOW BLOCK — DO NOT DELETE
// // // ===== MIGRATED TO ENGINE RUNTIME =====
// // // ----- REGIME SWITCH PRESSURE ----- //

// // setRegimeSwitchPressure(prev => {

// //   const structuralStress =
// //     unifiedPressure * PHYSICS.regime.pressureInfluence +
// //     systemFatigue * PHYSICS.regime.fatigueInfluence +
// //     stressScar * 0.2 +
// //     pathMemory * 0.2;

// //   const volatility =
// //     phaseSignal * 0.3 +
// //     flickerIndex * 0.3;

// //   const raw =
// //     structuralStress + volatility;

// //   const smoothing =
// //     PHYSICS.regime.lockInStrength;

// //   const next =
// //     prev + (raw - prev) * smoothing;

// //   return Math.min(1, next);

// // });


// // // ----- ENDOGENOUS REGIME PROBABILITY ----- //

// // const switchProb =
// //   Math.max(0,
// //     regimeSwitchPressure - 0.55
// //   ) * 0.25;


// // // ----- HYSTERETIC REGIME ENGINE ----- //

// // setSystemRegime(prev => {

// //   // stochastic endogenous switch
// // if (Math.random() < switchProb) {

// //   return prev === "Steady state"
// //     ? "Structural stress"
// //     : "Steady state";

// // }

// //   const baseEnter =
// //     0.72 - regimeCommitment * 0.1;

// //   const baseExit =
// //     0.55 + regimeCommitment * 0.1;

// //   const memoryShift =
// //     thresholdMemory * 0.08 +
// //     pathMemory * 0.05;

// //   const attractorBias =
// //     attractorField * 0.05;

// //   const phaseBias =
// //     phaseSignal * 0.04;

// //   const ENTER =
// //   baseEnter
// //   - memoryShift
// //   - attractorBias
// //   + phaseBias
// //   + regimePersistence * 0.05;

// //   const EXIT =
// //   baseExit
// //   + memoryShift
// //   + attractorBias
// //   - phaseBias
// //   - regimePersistence * 0.05;

// //   if (prev === "Structural stress") {

// //     if (unifiedPressure < EXIT) {
// //       return "Steady state";
// //     }

// //     return prev;

// //   }

// //   if (unifiedPressure > ENTER) {
// //     return "Structural stress";
// //   }

// //   return prev;

// // });


// // // ----- REGIME STICKINESS ----- //

// // setRegimePersistence(prev => {

// //   const buildUp =
// //     systemRegime === "Structural stress"
// //       ? 0.01 + unifiedPressure * 0.01
// //       : 0.008;

// //   const decay =
// //     systemRegime === "Steady state"
// //       ? 0.02
// //       : 0.005;

// //   const next =
// //     Math.max(0, Math.min(1,
// //       prev + buildUp - decay
// //     ));

// //   return Math.abs(next - prev) < 0.0005 ? prev : next;

// // });

// // 🧠🧠🧠 =============================================================== 🧠🧠🧠
// // ========================== BRAIN FIELD ================================
// // ===== Integración perceptiva del estado sistémico (STABILIZED) ========  🧠🧠🧠
// // Firewall cognitivo + Bounding + Regulación dinámica + Anti-oscillation
// // 🧠🧠🧠 =============================================================== 🧠🧠🧠



// // ======================================================================
// // BRAIN STRESS — Carga perceptiva integrada (STABILIZED)
// // Protección anti-NaN + Firewall cognitivo + Bounding + Anti-oscillation
// // ======================================================================

// setBrainStress(prev => {

  
//   // PERCEPTUAL INPUT
//   // ================

//   const perceptualInput =
//     unifiedPressure
//     + systemFatigue * 0.6
//     + collapseProbability * 0.8
//     + ewsScore * 0.7
//     + flickerIndex * 0.5
//     + landscapeCurvature * 0.4;

//   const target =
//     Math.max(0, Math.min(1, perceptualInput));

//   const rawNext =
//     prev + (target - prev) * 0.05;

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.05,
//     previous: prev
//   });

//   if (Math.abs(safeNext - prev) < 0.002) {
//     return prev;
//   }

//   return safeNext;

// });


// // ======================================================================
// // BRAIN CONFIDENCE — Inferencia de estabilidad sistémica (STABILIZED)
// // Protección anti-NaN + Firewall cognitivo + Bounding + Anti-oscillation
// // ======================================================================

// setBrainConfidence(prev => {

//   // =================
//   // CONFIDENCE TARGET
//   // =================

//   const rawTarget =
//     1
//     - criticalSlowing * 0.5
//     - flickerIndex * 0.4
//     - collapseProbability * 0.4;

//   const target =
//     Math.max(0, Math.min(1, rawTarget));

//   const rawNext =
//     prev + (target - prev) * 0.03;

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.04,
//     previous: prev
//   });

//   if (Math.abs(safeNext - prev) < 0.002) {
//     return prev;
//   }

//   return safeNext;

// });



// // ======================================================================
// // BRAIN AROUSAL — Nivel de activación sistémica (STABILIZED)
// // Protección anti-NaN + Firewall cognitivo + Bounding + Anti-oscillation
// // ======================================================================

// setBrainArousal(prev => {


//   // AROUSAL TARGET
//   // ==============

//   const rawTarget =
//     Math.abs(pressureMomentum) * 0.6
//     + shockLevel * 0.4
//     + ewsScore * 0.3;

//   const target =
//     Math.max(0, Math.min(1, rawTarget));

//   const rawNext =
//     prev + (target - prev) * 0.08;

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.06, // arousal puede reaccionar más rápido
//     previous: prev
//   });

//   if (Math.abs(safeNext - prev) < 0.003) {
//     return prev;
//   }

//   return safeNext;

// });



// // ======================================================================
// // BRAIN NOISE — Variabilidad estructural interna (STABILIZED)
// // Protección anti-NaN + Firewall cognitivo + Bounding + Anti-oscillation
// // ======================================================================

// setBrainNoise(prev => {

  
//   // NOISE TARGET
//   // ============

//   const rawTarget =
//     PHYSICS.noise.structuralNoise * (1 - brainConfidence);

//   const target =
//     Math.max(0, Math.min(1, rawTarget));

//   const rawNext =
//     prev + (target - prev) * 0.1;

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.07,
//     previous: prev
//   });

//   if (Math.abs(safeNext - prev) < 0.002) {
//     return prev;
//   }

//   return safeNext;

// });



// // ======================================================================
// // BRAIN MEMORY — Huella de shock y consolidación adaptativa (STABILIZED)
// // Protección anti-NaN + Bounding dinámico + Anti-oscillation
// // ======================================================================

// setBrainMemory(prev => {

  
//   // IMPRINT ACCUMULATION
//   // ====================

//   const imprint =
//     shockLevel * 0.02 +
//     collapseProbability * 0.01;

//   const rawTarget =
//     prev + imprint - 0.002;

//   const target =
//     Math.max(0, Math.min(1, rawTarget));

//   if (!Number.isFinite(target)) {
//     return prev;
//   }

//   const safeNext = safeSignal(target, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.03,
//     previous: prev
//   });

//   if (Math.abs(safeNext - prev) < 0.001) {
//     return prev;
//   }

//   return safeNext;

// });



// // ======================================================================
// // PREDICTION ERROR — Señal de discrepancia predictiva (STABILIZED)
// // Protección anti-NaN + Firewall cognitivo + Bounding + Anti-oscillation
// // ======================================================================

// setPredictionError(prev => {


//   // EXPECTED VS OBSERVED
//   // ====================

//   const expected =
//     anticipatoryBuffer * 0.4 +
//     scenarioField * 0.3 +
//     predictiveHorizon * 0.3;

//   const observed =
//     unifiedPressure * 0.5 +
//     systemFatigue * 0.3 +
//     collapseProbability * 0.2;

//   const rawError =
//     Math.abs(observed - expected);

//   const target =
//     Math.max(0, Math.min(1, rawError));

//   const rawNext =
//     prev + (target - prev) * 0.05;

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.05,
//     previous: prev
//   });

//   if (Math.abs(safeNext - prev) < 0.002) {
//     return prev;
//   }

//   return safeNext;

// });



// // =======================================================================
// // BRAIN MODE — Clasificador de estado cognitivo (LOGIC LAYER)
// // Lógica determinista + Sin dinámica acumulativa + Sin firewall requerido
// // =======================================================================

// setBrainMode(prev => {

//   if (brainStress > 0.75 || collapseProbability > 0.6)
//     return "alert";

//   if (regimePersistence > 0.7)
//     return "locked";

//   if (brainStress > 0.4 || ewsScore > 0.3)
//     return "attentive";

//   return "calm";

// });

// // ============================================================================
// // COGNITIVE HOMEOSTASIS — Regulación de excitabilidad del sistema (STABILIZED)
// // Protección anti-NaN + Bounding adaptativo + Anti-oscillation
// // ============================================================================

// setCognitiveHomeostasis(prev => {

//   // carga cognitiva total
//   const cognitiveLoad =
//     brainStress * 0.4 +
//     brainArousal * 0.3 +
//     (1 - brainConfidence) * 0.3
//     + (1 - metaStabilityEnergy) * 0.2
//     + predictionError * 0.25;

//   // estabilidad estructural
//   const stability =
//     metaConfidence * 0.4 +
//     (1 - flickerIndex) * 0.3 +
//     (1 - criticalSlowing) * 0.3;

//   // tendencia homeostática: mantener equilibrio
//   const target =
//     0.5 +
//     stability * 0.2 -
//     cognitiveLoad * 0.3;

//   const next =
//     prev + (target - prev) * 0.03;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0.2, Math.min(0.8, next));

// });

// // =====================================================================================
// // STRUCTURAL PLASTICITY — Adaptación lenta de parámetros con meta-learning (STABILIZED)
// // Protección anti-NaN + Bounding progresivo + Anti-oscillation
// // =====================================================================================

// setPlasticResilienceShift(prev => {

//   // experiencia acumulada
//   const experience =
//     patternMemory * 0.4 +
//     regimePersistence * 0.3 +
//     (1 - collapseProbability) * 0.3;

//   // estrés crónico reduce capacidad
//   const chronicStress =
//     systemFatigue * 0.5 +
//     stressScar * 0.5;

//   // ========================= //
//   // ===== LEARNING BOOST ==== //

//   const learningBoost =
//     predictionError * 0.4 +
//     structuralSurprise * 0.4 +
//     metaLearningRate * 0.2;

//   const target =
//     experience * 0.2
//     - chronicStress * 0.2
//     + learningBoost * 0.1;

//   const next =
//     prev + (target - prev) * 0.005 * (0.7 + metaLearningRate * 0.6);

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(-0.3, Math.min(0.3, next));

// });

// setPlasticDampingShift(prev => {

//   const volatility =
//     flickerIndex * 0.4 +
//     stochasticPressure * 0.3 +
//     criticalSlowing * 0.3;

//   const recoveryCapacity =
//     adaptiveResilienceRef.current;

//   // ========================= //
//   // ===== LEARNING BOOST ==== //

//   const learningBoost =
//     predictionError * 0.5 +
//     structuralSurprise * 0.3 +
//     metaLearningRate * 0.2;

//   const target =
//     volatility * 0.2
//     - recoveryCapacity * 0.1
//     - predictionError * 0.15
//     + learningBoost * 0.05;

//   const next =
//     prev + (target - prev) * 0.005 * (0.7 + metaLearningRate * 0.6);

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(-0.2, Math.min(0.2, next));

// });

// // ======================================================================
// // COGNITIVE FATIGUE — Acumulación de carga de procesamiento (STABILIZED)
// // Protección anti-NaN + Bounding adaptativo + Anti-oscillation
// // ======================================================================

// setCognitiveFatigue(prev => {

//   const load =
//     brainStress * 0.3 +
//     brainArousal * 0.25 +
//     predictionError * 0.2 +
//     structuralSurprise * 0.15 +
//     criticalSlowing * 0.1;

//   const recovery =
//     globalCoherence * 0.2 +
//     metaStabilityEnergy * 0.2 +
//     resilienceBudget * 0.2;

//   const target =
//     load - recovery * 0.5;

//   const next =
//     prev + (target - prev) * 0.03;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // ==========================================================================
// // GLOBAL COHERENCE — Sincronización global cognitiva y dinámica (STABILIZED)
// // Protección anti-NaN + Bounding estructural + Anti-oscillation
// // ==========================================================================

// setGlobalCoherence(prev => {

//   // coherencia cognitiva
//   const cognitive =
//     brainConfidence * 0.4 +
//     (1 - brainNoise) * 0.3 +
//     cognitiveHomeostasis * 0.3;

//   // coherencia predictiva
//   const predictive =
//     anticipationConfidence * 0.4 +
//     scenarioAlignment * 0.3 +
//     metaConfidence * 0.3;

//   // coherencia dinámica
//   const dynamic =
//     adaptiveResilienceRef.current * (0.7 + globalCoherenceLag.current * 0.3) * 0.4 +
//     (1 - flickerIndex) * 0.3 +
//     (1 - criticalSlowing) * 0.3;

//   const target =
//     cognitive * 0.4 +
//     predictive * 0.3 +
//     dynamic * 0.3
//     + intentField * 0.1;

//   const next =
//     prev + (target - prev) * 0.02;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0.3, Math.min(1, next));

// });

// // ==================================================================================================
// // CRITICAL RESILIENCE SENSOR — Detección de pérdida silenciosa de capacidad adaptativa (STABILIZED)
// // Protección anti-NaN + Bounding dinámico + Anti-oscillation
// // ==================================================================================================

// setCriticalResilienceSignal(prev => {

//   // fragilidad estructural
//   const structuralFragility =
//     criticalSlowing * 0.3 +
//     flickerIndex * 0.25 +
//     landscapeCurvature * 0.2 +
//     stressScar * 0.25;

//   // degradación adaptativa
//   const adaptiveLoss =
//     (1 - adaptiveResilienceRef.current) * 0.5 +
//     collapseProbability * 0.5;

//   // incoherencia global
//   const coherenceLoss =
//     1 - globalCoherence;

//   const target =
//     structuralFragility * 0.5 +
//     adaptiveLoss * 0.3 +
//     coherenceLoss * 0.2;

//   const next =
//     prev + (target - prev) * 0.03;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // ===============================================================================
// // META-STABILITY ENERGY — Regulación de capacidad dinámica sistémica (STABILIZED)
// // Protección anti-NaN + Bounding energético + Anti-oscillation
// // ===============================================================================

// setMetaStabilityEnergy(prev => {

//   // energía dinámica presente
//   // usar misma base energética del sistema — coherencia física

// const dynamicEnergy =
//   systemEnergy * 0.7 +
//   Math.abs(pressureMomentum) * 0.3;

//   // capacidad estructural
//   const structuralCapacity =
//     adaptiveResilienceRef.current * 0.4 +
//     globalCoherence * 0.3 +
//     (1 - criticalResilienceSignal) * 0.3
//     + identityField * 0.2
//     + narrativeCoherence * 0.2;

//   // margen energético
//   const margin =
//     structuralCapacity - dynamicEnergy;

//   // tendencia a equilibrio
//   const boundedMargin = Math.tanh(margin * 1.5);

//   const target =
//   0.5 + boundedMargin * 0.35;

//   const next =
//     prev + (target - prev) * 0.02;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0.2, Math.min(1, next));

// });

// // ====================================================================================
// // LYAPUNOV STABILITY GUARD — Detección de divergencia dinámica silenciosa (STABILIZED)
// // Protección anti-NaN + Bounding dinámico + Anti-oscillation
// // ====================================================================================

// setLyapunovIndicator(prev => {

//   const energy =
//     Math.abs(pressureMomentum) * 0.4 +
//     stochasticPressure * 0.2 +
//     shockLevel * 0.2 +
//     cascadeRisk * 0.2;

//   const growth =
//     energy - lastEnergyRef.current;

//   lastEnergyRef.current = energy;

//   const signal =
//     Math.max(0, growth * 0.7 + energy * 0.3);

//   const next =
//     prev + (signal - prev) * 0.05;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // ===============================================================================================
// // STRUCTURAL SURPRISE FIELD — Detección de desviaciones profundas del modelo interno (STABILIZED)
// // Protección anti-NaN + Compresión tanh + Anti-oscillation
// // ===============================================================================================

// setStructuralSurprise(prev => {

//   // inconsistencia entre señales
//   const mismatch =
//     Math.abs(predictionError - regimeDriftSignal);

//   // desalineación dinámica
//   const dynamicMismatch =
//     Math.abs(lyapunovIndicator - globalCoherence);

//   // incoherencia cognitiva
//   const cognitiveMismatch =
//     Math.abs(metaConfidence - anticipationConfidence);

//   // señal compuesta
//   const raw =
//     mismatch * 0.4 +
//     dynamicMismatch * 0.3 +
//     cognitiveMismatch * 0.3;

//   // compresión segura
//   const target =
//     Math.tanh(raw * 1.5);

//   const next =
//     prev + (target - prev) * 0.02;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // ============================================================================
// // META LEARNING RATE — Ajuste de velocidad adaptativa del sistema (STABILIZED)
// // Protección anti-NaN + Bounding adaptativo + Anti-oscillation
// // ============================================================================

// setMetaLearningRate(prev => {

//   // presión de adaptación
//   const adaptationPressure =
//     structuralSurprise * 0.4 +
//     predictionError * 0.3 +
//     regimeDriftSignal * 0.3
//     + (1 - meaningField) * 0.2;

//   // estabilidad reduce velocidad
//   const stabilization =
//     globalCoherence * 0.4 +
//     metaStabilityEnergy * 0.3 +
//     adaptiveResilienceRef.current * 0.3
//     + identityField * 0.3
//     + narrativeCoherence * 0.2;

//   const raw =
//     adaptationPressure - stabilization * 0.5;

//   const fatigueMod =
//   1 - cognitiveFatigue * 0.4
  
//   const target =
//     Math.tanh(raw * 1.5) * 0.4 + 0.4;

//  const next =
//   prev + (target - prev) * 0.02 * warmupEnvelope * fatigueMod;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0.1, Math.min(0.8, next));

// });

// // =============================================================
// // INTENT FIELD — Orientación emergente del sistema (STABILIZED)
// // Protección anti-NaN + Bounding adaptativo + Anti-oscillation
// // =============================================================

// setIntentField(prev => {

//   // alineamiento interno
//   const alignment =
//     globalCoherence * 0.4 +
//     anticipationConfidence * 0.3 +
//     metaConfidence * 0.3;

//   // presión de reorganización
//   const reorganization =
//     structuralSurprise * 0.4 +
//     regimeDriftSignal * 0.3 +
//     predictionError * 0.3;

//   // capacidad de sostener dirección
//   const capacity =
//     adaptiveResilienceRef.current * 0.4 +
//     metaStabilityEnergy * 0.3 +
//     (1 - collapseProbability) * 0.3;

//   const raw =
//     alignment * 0.5 +
//     capacity * 0.3 -
//     reorganization * 0.4;

//   const target =
//     Math.tanh(raw * 1.5) * 0.5 + 0.5;

//   const next =
//     prev + (target - prev) * 0.02;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // ============================================================================
// // IDENTITY FIELD — Invariantes internas y continuidad del sistema (STABILIZED)
// // Protección anti-NaN + Bounding estructural + Anti-oscillation
// // ============================================================================

// setIdentityField(prev => {

//   // coherencia profunda
//   const deepCoherence =
//     globalCoherence * 0.4 +
//     intentField * 0.3 +
//     metaConfidence * 0.3;

//   // estabilidad estructural
//   const structuralStability =
//     adaptiveResilienceRef.current * 0.4 +
//     metaStabilityEnergy * 0.3 +
//     (1 - collapseProbability) * 0.3;

//   // perturbación que intenta erosionar identidad
//   const erosion =
//     structuralSurprise * 0.4 +
//     regimeDriftSignal * 0.3 +
//     predictionError * 0.3;

//   const raw =
//     deepCoherence * 0.5 +
//     structuralStability * 0.4 -
//     erosion * 0.4;

//   const target =
//     Math.tanh(raw * 1.5) * 0.5 + 0.5;

//   const next =
//     prev + (target - prev) * 0.015; // muy lento

//   // NAN guard lvl 1

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0.3, Math.min(1, next));

// });

// // ========================================================================
// // MEANING FIELD — Relevancia adaptativa de señales sistémicas (STABILIZED)
// // Protección anti-NaN + Bounding interpretativo + Anti-oscillation
// // ========================================================================

// setMeaningField(prev => {

//   // claridad del estado
//   const clarity =
//     globalCoherence * 0.4 +
//     identityField * 0.3 +
//     intentField * 0.3;

//   // complejidad del entorno
//   const complexity =
//     structuralSurprise * 0.4 +
//     scenarioField * 0.3 +
//     stochasticPressure * 0.3;

//   // estabilidad interpretativa
//   const interpretiveStability =
//     metaConfidence * 0.4 +
//     anticipationConfidence * 0.3 +
//     metaStabilityEnergy * 0.3;

//   const raw =
//     clarity * 0.4 +
//     interpretiveStability * 0.4 -
//     complexity * 0.3;

//   const target =
//     Math.tanh(raw * 1.5) * 0.5 + 0.5;

//   const next =
//     prev + (target - prev) * 0.02;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // ====================================================================================
// // NARRATIVE COHERENCE FIELD — Consistencia temporal profunda del sistema (STABILIZED)
// // Protección anti-NaN + Bounding estructural + Anti-oscillation
// // ====================================================================================

// setNarrativeCoherence(prev => {

//   // estabilidad dinámica
//   const dynamicConsistency =
//     (1 - flickerIndex) * 0.3 +
//     (1 - criticalSlowing) * 0.3 +
//     globalCoherence * 0.4;

//   // coherencia cognitiva
//   const cognitiveConsistency =
//     identityField * 0.3 +
//     intentField * 0.3 +
//     meaningField * 0.4;

//   // incoherencia estructural
//   const disruption =
//     structuralSurprise * 0.4 +
//     regimeDriftSignal * 0.3 +
//     predictionError * 0.3;

//   const raw =
//     dynamicConsistency * 0.4 +
//     cognitiveConsistency * 0.4 -
//     disruption * 0.3;

//   const target =
//     Math.tanh(raw * 1.5) * 0.5 + 0.5;

//   const next =
//     prev + (target - prev) * 0.015;

//   // NAN guard lvl 1

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0.3, Math.min(1, next));

// });

// // ============================================================================
// // META CONTROL SUPERVISOR — Supervisión sistémica de segundo orden (STABILIZED)
// // Protección anti-NaN + Bounding de control + Anti-oscillation
// // =============================================================================

// setMetaControlSignal(prev => {

//   // presión adaptativa global
//   const adaptationPressure =
//     structuralSurprise * 0.3 +
//     predictionError * 0.25 +
//     regimeDriftSignal * 0.25 +
//     lyapunovIndicator * 0.2;

//   // estabilidad interna
//   const internalStability =
//     globalCoherence * 0.3 +
//     metaStabilityEnergy * 0.3 +
//     identityField * 0.2 +
//     narrativeCoherence * 0.2;

//   const raw =
//     internalStability - adaptationPressure;

//   const target =
//     Math.tanh(raw * 1.5) * 0.5 + 0.5;

//   const next =
//     prev + (target - prev) * 0.02;

//   // NAN guard lvl 1

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // ================================================================================
// // RUNAWAY DETECTOR — Detección de riesgo de dinámica fuera de control (STABILIZED)
// // Protección anti-NaN + Bounding preventivo + Anti-oscillation
// // ================================================================================

// setRunawayRisk(prev => {

//   const instability =
//     lyapunovIndicator * 0.4 +
//     structuralSurprise * 0.3 +
//     predictionError * 0.3;

//   const containment =
//     metaControlSignal * 0.5 +
//     metaStabilityEnergy * 0.5;

//   const target =
//     Math.max(0, instability - containment * 0.5);

//   const next =
//     prev + (target - prev) * 0.03;

//   // NAN guard lvl 1

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // ====================================================================================
// // STRESS ACCELERATION SENSOR — Sensor de aceleración del estrés sistémico (STABILIZED)
// // Protección anti-NaN + Normalización dinámica + Anti-oscillation
// // ====================================================================================

// const stressDelta =
//   Math.abs(systemEnergy - lastEnergyRef.current);

// stressAccelerationRef.current =
//   stressAccelerationRef.current * 0.9 +
//   stressDelta * 0.1;

// // =========================================================================
// // ADAPTIVE CRITICAL DAMPING — Amortiguación crítica adaptativa (STABILIZED)
// // Protección anti-NaN + Normalización dinámica + Anti-oscillation
// // =========================================================================

// const adaptiveCriticalDamping =
//   1 + Math.min(1, stressAccelerationRef.current * 5);

// // ========================================================================
// // SUPERVISORY STRESS — Estrés de supervisión de segundo orden (STABILIZED)
// // Protección anti-NaN + Bounding adaptativo + Anti-oscillation
// // ===================================================== ==================

// setSupervisoryStress(prev => {

//   const load =
//     runawayRisk * 0.4 +
//     structuralSurprise * 0.3 +
//     regimeDriftSignal * 0.3;

//   const relief =
//     globalCoherence * 0.5 +
//     narrativeCoherence * 0.5;

//   const target =
//     load - relief * 0.5 + 0.5;

//   const next =
//     prev + (target - prev) * 0.02;

//   // NAN guard lvl 1

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // =======================================================
// // PHASE 6.78: ANTICIPATORY FIELD
// // Previsión adaptativa del sistema — updates desacoplados
// // =======================================================


// // ---------------------------------------------------------
// // SUPPLY RISK FORECAST — Proyección de riesgo de suministro
// // ---------------------------------------------------------

// setSupplyRiskForecast(prev => {

//   const structuralRisk =
//     unifiedPressure * 0.4 +
//     systemFatigue * 0.3 +
//     collapseProbability * 0.3;

//   const signalRisk =
//     ewsScore * 0.4 +
//     criticalSlowing * 0.3 +
//     flickerIndex * 0.3;

//   const target = structuralRisk + signalRisk;

//   return prev + (target - prev) * 0.05;

// });

// // -----------------------------------------------------------------
// // REGIONAL STRESS GRADIENT — Gradiente regional de estrés sistémico
// // -----------------------------------------------------------------

// setRegionalStressGradient(prev => {

//   const gradient =
//     regionalStress * 0.6 +
//     stochasticPressure * 0.4;

//   return prev + (gradient - prev) * 0.05;

// });

// // -----------------------------------------------------
// // CONSUMPTION MOMENTUM — Momentum proyectado de consumo
// // -----------------------------------------------------

// setConsumptionMomentumForecast(prev => {

//   const demandSignal =
//     pressureMomentum * 0.7 +
//     unifiedPressure * 0.3;

//   return prev + (demandSignal - prev) * 0.06;

// });

// // -------------------------------------------------------------------
// // ANTICIPATORY BUFFER — Buffer anticipatorio de preparación sistémica
// // -------------------------------------------------------------------

// setAnticipatoryBuffer(prev => {

//   const preparation =
//     supplyRiskForecast * 0.4 +
//     regionalStressGradient * 0.25 +
//     consumptionMomentumForecast * 0.15 +
//     spatialClusteringIndex * 0.1 +
//     anticipationConfidence * 0.1 +
//     scenarioSampleRisk * 0.1;

//   return Math.max(0, Math.min(1,
//     prev + (preparation - prev) * 0.04
//   ));

// });

// // ======================================================================
// // ANTICIPATION CONFIDENCE — PREDICTIVE STABILITY (STABILIZED)
// // Protección anti-NaN + Firewall cognitivo + Bounding + Anti-oscillation
// // ======================================================================

// setAnticipationConfidence(prev => {

  
//   // ERROR PENALTY — incertidumbre predictiva
//   // ========================================

//   const errorPenalty =
//     predictionError * 0.5;

  
//   // COHERENCE BOOST — integración global
//   // ====================================

//   const coherenceBoost =
//     globalCoherence * 0.3;

  
//   // STABILITY BOOST — energía meta-estable
//   // ======================================

//   const stabilityBoost =
//     metaStabilityEnergy * 0.2;

//   // ===============
//   // Target dinámico
//   // ===============

//   const rawTarget =
//     0.5 + coherenceBoost + stabilityBoost - errorPenalty;

//   const target =
//     Math.max(0, Math.min(1, rawTarget));

  
//   // Suavizado temporal
//   // ==================

//   const rawNext =
//     prev + (target - prev) * 0.04;

  
//   // Anti-NaN lvl 1 
//   // ==============

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

  
//   // Firewall cognitivo
//   // ==================

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.05,   // similar a metaConfidence
//     previous: prev
//   });

  
//   // Micro-jitter guard
//   // ==================

//   if (Math.abs(safeNext - prev) < 0.002) {
//     return prev;
//   }

//   return safeNext;

// });

// // ================================================================
// // EXPLORATION DRIVE — Impulso exploratorio adaptativo (STABILIZED)
// // Protección anti-NaN + Bounding dinámico + Anti-oscillation
// // ================================================================

// setExplorationDrive(prev => {

//   const fatiguePenalty =
//   cognitiveFatigue * 0.3

//   const uncertainty =
//     stochasticPressure * 0.3 +
//     scenarioField * 0.3 +
//     collapseProbability * 0.2 +
//     flickerIndex * 0.2 +
//     structuralSurprise * 0.3;

//   const epistemicNeed =
//     predictionError * 0.5 +
//     (1 - anticipationConfidence) * 0.3 +
//     (1 - globalCoherence) * 0.2 +
//     (1 - meaningField) * 0.3;

//   const stabilization =
//     metaStabilityEnergy * 0.4 +
//     adaptiveResilienceRef.current * 0.3 +
//     anticipationConfidence * 0.3 +
//     intentField * 0.2 +
//     identityField * 0.2 +
//     narrativeCoherence * 0.3;

//   const target =
//     uncertainty * 0.4 +
//     epistemicNeed * 0.4 -
//     stabilization * 0.3 -
//     fatiguePenalty;


//   const next =
//     prev + (target - prev) * 0.03;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // =============================================================================
// // SCENARIO SAMPLE RISK — Riesgo simulado por muestreo de escenarios (STABILIZED)
// // Protección anti-NaN + Bounding preventivo + Anti-oscillation
// // ==============================================================================

// setScenarioSampleRisk(prev => {

//   const simulatedShock =
//     shockLevel * 0.5 +
//     explorationDrive * 0.3 +
//     stochasticPressure * 0.2;

//   const simulatedPressure =
//     unifiedPressure +
//     simulatedShock * 0.4 -
//     adaptiveResilienceRef.current * 0.2;

//   const simulatedRisk =
//     simulatedPressure * 0.6 +
//     collapseProbability * 0.4;

//   const target =
//     Math.max(0, Math.min(1, simulatedRisk));

//   const next =
//     prev + (target - prev) * 0.04 * guardThrottleRef.current;

//   if (!Number.isFinite(next)) return prev;

//   return next;

// });

// // ======================================================================
// // PREDICTIVE HORIZON — Horizonte adaptativo de previsión (STABILIZED)
// // Protección anti-NaN + Firewall cognitivo + Bounding + Anti-oscillation
// // =======================================================================

// setPredictiveHorizon(prev => {

  
//   // VOLATILITY SIGNAL
//   // =================

//   const volatility =
//     ewsScore * 0.4 +
//     criticalSlowing * 0.3 +
//     flickerIndex * 0.3;

  
//   // SURPRISE SIGNAL
//   // ===============

//   const surprise =
//     Math.abs(cascadeEarlySignal - scenarioField);

  
//   // MEMORY STABILITY
//   // ================

//   const stability =
//     metaConfidence * 0.6 +
//     anticipationConfidence * 0.4;

//   // =================
//   // Target adaptativo
//   // =================

//   const rawTarget =
//     0.35 +
//     stability * 0.4 +
//     volatility * 0.15 -
//     surprise * 0.25 -
//     regimeDriftSignal * 0.1;

//   const target =
//     Math.max(0.2, Math.min(0.9, rawTarget));

  
//   // Suavizado temporal
//   // ==================

//   const rawNext =
//     prev + (target - prev) * 0.03;

  
//   // Anti-NaN lvl 1 
//   // ==============

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

  
//   // Firewall cognitivo
//   // ==================

//   const safeNext = safeSignal(rawNext, {
//     min: 0.2,
//     max: 0.9,
//     fallback: prev,
//     maxStep: 0.04,  // horizonte cambia lentamente
//     previous: prev
//   });

  
//   // Micro-jitter guard
//   // ==================

//   if (Math.abs(safeNext - prev) < 0.002) {
//     return prev;
//   }

//   return safeNext;

// });

// // ======================================================================
// // SCENARIO FIELD — Espacio adaptativo de futuros plausibles (STABILIZED)
// // Protección anti-NaN + Firewall cognitivo + Bounding + Anti-oscillation
// // ======================================================================

// setScenarioField(prev => {

  
//   // UNCERTAINTY SIGNAL
//   // ==================

//   const rawUncertainty =
//     stochasticPressure * 0.4 +
//     collapseProbability * 0.3 +
//     cascadeRisk * 0.3;

//   const target =
//     Math.max(0, Math.min(1, rawUncertainty));

  
//   // Suavizado temporal
//   // ==================

//   const rawNext =
//     prev + (target - prev) * 0.04;

  
//   // Anti-NaN lvl 1 
//   // ==============

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

//   // ================================
//   // Firewall cognitivo
//   // ================================

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.05,   // escenario puede cambiar moderadamente
//     previous: prev
//   });

  
//   // Micro-jitter guard
//   // ==================

//   if (Math.abs(safeNext - prev) < 0.002) {
//     return prev;
//   }

//   return safeNext;

// });

// // =================================================================================
// // CASCADE EARLY SIGNAL — Detección anticipada de propagación sistémica (STABILIZED)
// // Protección anti-NaN + Bounding dinámico + Anti-oscillation
// // =================================================================================

// setCascadeEarlySignal(prev => {

//   const signal =
//     cascadeRisk * 0.6 +
//     heatmapIntensity * 0.4;

//   return prev + (signal - prev) * 0.05;

// });

// // =======================================================================
// // META CONFIDENCE — Autocalibración cognitiva protegida (STABILIZED)
// // Protección anti-NaN + Firewall avanzado + Bounding + Micro-jitter guard
// // =======================================================================

// setMetaConfidence(prev => {

  
//   // Consistency signal
//   // ==================

//   const rawConsistency =
//     (1 - flickerIndex) * 0.4 +
//     anticipationConfidence * 0.3 +
//     (1 - collapseProbability) * 0.3
//     - predictionError * 0.3;

//   // Bound preventivo
//   const consistency =
//     Math.max(0, Math.min(1, rawConsistency));

//   // Suavizado temporal
//   const rawNext =
//     prev + (consistency - prev) * 0.03;

  
//   // Anti-NaN lvl 1 
//   // ==============

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

//   // =================
//   // Firewall avanzado
//   // =================

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.05,      // meta confidence puede reaccionar moderadamente
//     previous: prev
//   });

  
//   // Micro jitter guard
//   // ==================

//   if (Math.abs(safeNext - prev) < 0.002) {
//     return prev;
//   }

//   return safeNext;

// });

// // ===============================================================================
// // SCENARIO FEEDBACK — Ajuste adaptativo basado en futuros plausibles (STABILIZED)
// // Protección anti-NaN + Bounding dinámico + Anti-oscillation
// // ===============================================================================

// // posture

// setAnticipatoryPosture(prev => {

//   const foresightPressure =
//     scenarioField * 0.4 +
//     cascadeEarlySignal * 0.3 +
//     supplyRiskForecast * 0.3;

//   const horizonFactor =
//     predictiveHorizon * 0.5 +
//     anticipationConfidence * 0.5;

//   const target =
//     foresightPressure * horizonFactor;

//     if (!Number.isFinite(target)) return prev;

//   return prev + (target - prev) * 0.05;

// });

// // alignment
// setScenarioAlignment(prev => {

//   const alignmentSignal =
//     brainState.coherence * 0.4 +
//     (1 - flickerIndex) * 0.3 +
//     metaConfidence * 0.3;

//   return prev + (alignmentSignal - prev) * 0.04;

// });

// // stress bias
// setAnticipatoryStressBias(prev => {

//   const bias =
//     anticipatoryPosture * 0.6 -
//     scenarioAlignment * 0.4;

//   return prev + (bias - prev) * 0.05;

// });

// // =================================================================
// // REGIONAL FORESIGHT — Proyección espacial del riesgo (STABILIZED)
// // Protección anti-NaN + Endurecimiento numérico + Bounding seguro
// // =================================================================

// setRegionalForecast(prev => {

//   return regions.map(region => {

//     // ===== SAFE INPUTS ===== //
//     // evita divisiones inválidas o datos incompletos

//     const capacity =
//       Number.isFinite(region.capacityKg)
//         ? Math.max(1, region.capacityKg)
//         : 1;

//     const available =
//       Number.isFinite(region.availableKg)
//         ? region.availableKg
//         : 0;

//     const utilization =
//       1 - available / capacity;

//     // ===== LOCAL STRUCTURAL PRESSURE ===== //

//     const structural =
//       utilization * 0.5 +
//       unifiedPressure * 0.3 +
//       systemFatigue * 0.2;

//     // ===== GLOBAL EARLY SIGNALS ===== //

//     const earlySignals =
//       ewsScore * 0.4 +
//       criticalSlowing * 0.3 +
//       flickerIndex * 0.3;

//     // ===== SPATIAL PROPAGATION ===== //

//     const propagation =
//       regionalStressGradient * 0.5 +
//       stochasticPressure * 0.5;

//     // ===== STRESS FORECAST ===== //

//     const rawStress =
//       structural +
//       earlySignals +
//       propagation +
//       spatialDiffusionField * 0.3 +
//       spatialClusteringIndex * 0.2;

//     const stressForecast =
//       Number.isFinite(rawStress) ? rawStress : 0;

//     // ===== SUPPLY RISK ===== //

//     const rawRisk =
//       stressForecast * 0.8 +
//       collapseProbability * 0.2;

//     const supplyRisk =
//       Number.isFinite(rawRisk)
//         ? Math.max(0, Math.min(1, rawRisk))
//         : 0;

//     return {
//       name: region.name,
//       stress: stressForecast,
//       risk: supplyRisk
//     };

//   });

// });

// // ================================================================
// // SPATIAL HEATMAP — Campo agregado de riesgo espacial (STABILIZED)
// // Protección anti-NaN + Bounding agregado + Anti-oscillation
// // ================================================================

// setHeatmapIntensity(prev => {

//   if (!regionalForecast.length) return prev;

//   const avgRisk =
//     regionalForecast.reduce((a, r) => a + r.risk, 0) /
//     regionalForecast.length;

//   const spatialVariance =
//     regionalForecast.reduce((acc, r) =>
//       acc + Math.pow(r.risk - avgRisk, 2), 0
//     ) / regionalForecast.length;

//   const heterogeneity =
//     Math.sqrt(spatialVariance);

//   const raw =
//     avgRisk * 0.7 +
//     heterogeneity * 0.3;

//   const next =
//     prev + (raw - prev) * 0.06;

//     if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // =====================================================================
// // SPATIAL DIFFUSION — Propagación de riesgo entre regiones (STABILIZED)
// // Protección anti-NaN + Bounding dinámico + Anti-oscillation
// // =====================================================================

// setSpatialDiffusionField(prev => {

//   // riesgo medio regional
//   const avgRegionalRisk =
//     regionalForecast.length > 0
//       ? regionalForecast.reduce((a, r) => a + r.risk, 0) / regionalForecast.length
//       : 0;

//   // gradiente espacial
//   const gradient =
//     avgRegionalRisk - prev;

//   // intensidad de difusión
//   const diffusionRate =
//     0.08 + cascadeRisk * 0.05;

//   // amortiguación
//   const damping =
//     0.02 + bufferMargin * 0.02;

//   const next =
//     prev + gradient * diffusionRate - prev * damping;

//   if (Math.abs(next - prev) < 0.0005) return prev;

//   return Math.max(0, Math.min(1, next));

// });

// // ======================================================================
// // SPATIAL CLUSTERING — Sincronización y coherencia regional (STABILIZED)
// // Protección anti-NaN + Bounding estadístico + Anti-oscillation
// // ======================================================================

// setSpatialClusteringIndex(prev => {

//   if (regionalForecast.length < 2) return prev;

//   // media de riesgo
//   const meanRisk =
//     regionalForecast.reduce((a, r) => a + r.risk, 0) /
//     regionalForecast.length;

//   // dispersión (varianza)
//   const variance =
//     regionalForecast.reduce((acc, r) => {
//       const d = r.risk - meanRisk;
//       return acc + d * d;
//     }, 0) / regionalForecast.length;

//   // clustering = baja varianza → alta sincronización
//   const clusteringSignal =
//     1 - Math.min(1, variance * 5);

//   // suavizado
//   const next =
//     prev + (clusteringSignal - prev) * 0.08;

//   if (Math.abs(next - prev) < 0.0005) return prev;

//   return Math.max(0, Math.min(1, next));

// });



// // =================================================================================
// // CASCADE DETECTION — Identificación de propagación sistémica regional (STABILIZED)
// // Protección anti-NaN + Endurecimiento numérico + Bounding seguro
// // =================================================================================

// setCascadeRisk(prev => {

//   // ===== GUARD: evitar división por cero ===== //
//   if (!regionalForecast.length) return prev;

//   // ===== SAFE AVERAGE ===== //
//   const avgRisk =
//     regionalForecast.reduce((a, r) => {
//       const safeRisk = Number.isFinite(r.risk) ? r.risk : 0;
//       return a + safeRisk;
//     }, 0) / regionalForecast.length;

//   // ===== SAFE INPUTS ===== //
//   const safePressure =
//     Number.isFinite(unifiedPressure) ? unifiedPressure : 0;

//   const safeDiffusion =
//     Number.isFinite(spatialDiffusionField) ? spatialDiffusionField : 0;

//   const safeClustering =
//     Number.isFinite(spatialClusteringIndex) ? spatialClusteringIndex : 0;

//   // ======
//   // TARGET
//   // ======

//   const target =
//     avgRisk * 0.4 +
//     safePressure * 0.3 +
//     safeDiffusion * 0.2 +
//     safeClustering * 0.1;

//   if (!Number.isFinite(target)) return prev;

//   // =========
//   // DEAD ZONE 
//   // =========

//   if (Math.abs(target - prev) < 0.002) return prev;

//   const next = prev + (target - prev) * 0.1;

//   return Math.max(0, Math.min(1, next));

// });

// // =================================================================================================
// // COUNTERFACTUAL LEARNING — Comparación entre resultado observado y escenario simulado (STABILIZED)
// // Protección anti-NaN + Bounding adaptativo + Anti-oscillation
// // =================================================================================================

// setCounterfactualSignal(prev => {

//   const observedOutcome =
//     unifiedPressure * 0.5 +
//     collapseProbability * 0.5;

//   const simulatedOutcome =
//     scenarioSampleRisk;

//   const regret =
//     Math.abs(observedOutcome - simulatedOutcome);

//   const learningContext =
//     predictionError * 0.4 +
//     explorationDrive * 0.3 +
//     (1 - globalCoherence) * 0.3;

//   const target =
//     regret * 0.6 + learningContext * 0.4;

//   const next =
//     prev + (target - prev) * 0.04;

//   if (!Number.isFinite(next)) return prev;

//   return Math.max(0, Math.min(1, next));

// });


// // // ⚠️ SHADOW BLOCK — DO NOT DELETE
// // // ===== MIGRATED TO SIMULATION CORE =====
// // // patternMemory evoluciona en runtime determinista
// // // React ahora solo observa snapshot del engine

// // setPatternMemory(prev => {

// //   const expected =
// //     anticipatoryBuffer * 0.4 +
// //     scenarioField * 0.3 +
// //     predictiveHorizon * 0.3;

// //   const observed =
// //     unifiedPressure * 0.4 +
// //     systemFatigue * 0.3 +
// //     collapseProbability * 0.3;

// //   const surprise =
// //     Math.abs(observed - expected);

// //   const exposure =
// //     unifiedPressure * 0.25 +
// //     systemFatigue * 0.2 +
// //     collapseProbability * 0.25 +
// //     spatialClusteringIndex * 0.15 +
// //     ewsScore * 0.15;

// //   const consolidation =
// //     anticipatoryBuffer * 0.1;

// //   const learningBoost =
// //     surprise * (0.03 + metaLearningRate * 0.05) * (0.7 + meaningField * 0.6);

// //   const adaptiveDecay =
// //     0.001 + surprise * 0.002 * (1 - metaLearningRate);

// //   const next =
// //     prev
// //     + exposure * 0.01
// //     + consolidation
// //     + learningBoost
// //     + counterfactualSignal * 0.02
// //     - adaptiveDecay;

// //   return Math.max(0, Math.min(1, next));

// // });

// // // ⚠️ SHADOW BLOCK — DO NOT DELETE
// // // --- PHASE 6.955: LATENT TRANSITION SENSOR ---
// // // detecta reorganización estructural antes del cambio de régimen

// // setLatentTransitionSignal(prev => {

// //   // señales de reorganización interna
// //   const structuralTension =
// //     criticalSlowing * 0.35 +
// //     flickerIndex * 0.25 +
// //     landscapeCurvature * 0.2 +
// //     regimePersistence * 0.2;

// //   // inconsistencia cognitiva
// //   const cognitiveMismatch =
// //     Math.abs(metaConfidence - anticipationConfidence);

// //   // presión sistémica emergente
// //   const stressGradient =
// //     Math.abs(cascadeRisk - spatialDiffusionField);

// //   const target =
// //     structuralTension * 0.6 +
// //     cognitiveMismatch * 0.2 +
// //     stressGradient * 0.2;

// //   const next =
// //     prev + (target - prev) * 0.04;

// //   if (!Number.isFinite(next)) return prev;

// //   return Math.max(0, Math.min(1, next));

// // });





// // =======================================================================
// // ANTICIPATORY CONTROL — Intervención preventiva del sistema (STABILIZED)
// // Protección anti-NaN + Bounding adaptativo + Anti-oscillation
// // =======================================================================

// // buffer reinforcement
// setPreventiveBufferBias(prev => {

//   const threatSignal =
//     cascadeEarlySignal * 0.4 +
//     scenarioField * 0.3 +
//     supplyRiskForecast * 0.3;

//   const confidenceMod =
//     anticipationConfidence * 0.5 +
//     metaConfidence * 0.5;

//   const target =
//     threatSignal * confidenceMod;

//   return prev + (target - prev) * 0.05;

// });

// // damping adjustment
// setPreventiveDampingBias(prev => {

//   const volatility =
//     flickerIndex * 0.4 +
//     stochasticPressure * 0.3 +
//     criticalSlowing * 0.3;

//   return prev + (volatility - prev) * 0.05;

// });

// // resilience preparation
// setPreventiveResilienceBias(prev => {

//   const preparation =
//     anticipatoryPosture * 0.4 +
//     scenarioAlignment * 0.3 +
//     anticipationConfidence * 0.3;

//   return prev + (preparation - prev) * 0.05;

// });

// // =============================================================================================
// // ======================================== PHASE 7 ============================================
// // ================= OBSERVABLE SIGNALS — Señales observables y alertas tempranas ==============
// // =============================================================================================


// // ================================================================================
// // EARLY WARNING SIGNALS — Señales tempranas detrendadas y endurecidas (STABILIZED)
// // Protección anti-NaN + Detrending dinámico + Bounding seguro
// // ================================================================================

// setEwsScore(prev => {

//   // ===== UPDATE HISTORY FIRST =====  //

//   if (Number.isFinite(unifiedPressure)) {

//     const history = pressureHistoryRef.current;

//     history.push(unifiedPressure);

//     // limitar memoria
//     if (history.length > 300) {
//       history.shift();
//     }

//     // baseline lento
//     const mean =
//       history.reduce((a, b) => a + b, 0) / history.length;

//     // detrend — centrado en fluctuaciones
//     pressureHistoryRef.current =
//       history.map(v => v - mean);

//   }

//   const history = pressureHistoryRef.current;

//   if (history.length < 20) return prev;

//   // ===== STATISTICS =====  //

//  // running mean — sin recrear historial

// let sum = 0;

// for (let i = 0; i < history.length; i++) {
//   sum += history[i];
// }

// const mean = sum / history.length;

// // restar suavemente drift

// for (let i = 0; i < history.length; i++) {
//   history[i] -= mean * 0.02;
// }

//   const variance =
//     history.reduce((acc, v) =>
//       acc + (v - mean) * (v - mean), 0) / history.length;

//   const autocorr =
//     Math.abs(history[history.length - 1] - history[history.length - 2]);

//   const slowingSignal =
//     criticalSlowing;

//   // ===== RAW SIGNAL =====  //

//   const raw =
//     variance * 2 +
//     (1 - autocorr) * 0.5 +
//     slowingSignal * 1.5;

//   const next =
//     Math.max(0, Math.min(1, raw));

//   if (!Number.isFinite(next)) return prev;

//   return Math.abs(next - prev) < 0.01 ? prev : next;

// });

// // ===============================================================================
// // FLICKERING DETECTOR — Detector de reversión y oscilación sistémica (STABILIZED)
// // Protección anti-NaN + Bounding estadístico + Anti-oscillation
// // ===============================================================================

// setFlickerIndex(prev => {

//   const history = pressureHistoryRef.current;

//   if (history.length < 20) return prev;

//   let reversals = 0;

//   for (let i = 2; i < history.length; i++) {

//     const d1 = history[i - 1] - history[i - 2];
//     const d2 = history[i] - history[i - 1];

//     if (Math.sign(d1) !== Math.sign(d2)) {
//       reversals++;
//     }

//   }

//   const rate = reversals / history.length;

//   const next = Math.min(1, rate * 3);

//   return Math.abs(next - prev) < 0.01 ? prev : next;

// });


// // ==================================================================================
// // CRITICAL SLOWING DOWN — Indicador de desaceleración crítica sistémica (STABILIZED)
// // Protección anti-NaN + Firewall avanzado + Bounding + Micro-jitter guard
// // ==================================================================================


// setCriticalSlowing(prev => {

//   const history = pressureHistoryRef.current;

//   // si no hay suficiente historia → mantener valor previo
//   if (history.length < 15) {
//     return prev;
//   }

  
//   // Estadística básica
//   // ==================

//   const mean =
//     history.reduce((a, b) => a + b, 0) / history.length;

//   const variance =
//     history.reduce((acc, v) =>
//       acc + (v - mean) * (v - mean), 0) / history.length;

//   const volatility = Math.sqrt(variance);

//   const persistence =
//     Math.abs(history[history.length - 1] - history[history.length - 5]);

//   const fatigueFactor =
//     systemFatigue * 0.6 + stressScar * 0.4;

//   const slowingSignal =
//     volatility * 0.5 +
//     persistence * 0.4 +
//     fatigueFactor * 0.6;

  
//   // Señal cruda
//   // ===========

//   const rawNext =
//     Math.max(0, Math.min(1, slowingSignal));

 
//   // Protección anti-NaN lvl 1
//   // =========================

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

//   // =================
//   // Firewall avanzado
//   // =================

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.05,
//     previous: prev
//   });

  
//   // Micro jitter guard 
//   // ==================

//   if (Math.abs(safeNext - prev) < 0.01) {
//     return prev;
//   }

//   return safeNext;

// });

// // ==========================================================================
// // RESILIENCE BUDGET — Capacidad de absorción estructural (STABILIZED)
// // Protección anti-NaN + Firewall avanzado + Drain acotado + Anti-oscillation
// // ==========================================================================

// setResilienceBudget(prev => {

  
//   // DRAIN — carga estructural
//   // =========================

//   const drain =
//     criticalSlowing * 0.35 +
//     flickerIndex * 0.2 +
//     stressScar * 0.2 +
//     shockLevel * 0.15 +
//     collapseProbability * 0.1;

  
//   // RECOVERY — capacidad regenerativa
//   // =================================

//   const recovery =
//     0.01 +
//     globalCoherence * 0.02 +
//     adaptiveResilienceRef.current * 0.02;

//   // ===============
//   // Target dinámico
//   // ===============

//   const rawTarget =
//     prev - drain * 0.04 + recovery;

//   // Bound preventivo del target
//   const target =
//     Math.max(0, Math.min(1, rawTarget));

//   // Suavizado temporal
//   const rawNext =
//     prev + (target - prev) * 0.05;

  
//   // Anti-NaN lvl 1
//   // ==============

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

//   // =================
//   // Firewall avanzado
//   // =================

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.04,      // resiliencia cambia lentamente
//     previous: prev
//   });

  
//   // Micro-jitter guard
//   // ==================

//   if (Math.abs(safeNext - prev) < 0.003) {
//     return prev;
//   }

//   return safeNext;

// });

// // ===========================================================================
// // LANDSCAPE CURVATURE — Curvatura dinámica del paisaje sistémico (STABILIZED)
// // Protección anti-NaN + Bounding geométrico + Anti-oscillation
// // ===========================================================================

// setLandscapeCurvature(prev => {

//   const h = pressureHistoryRef.current;

//   if (h.length < 5) return prev;

//   const n = h.length;

//   const secondDerivative =
//     h[n - 1] - 2 * h[n - 2] + h[n - 3];

//   const curvature = Math.abs(secondDerivative) * 10;

//   const next = Math.min(1, curvature);

//   return Math.abs(next - prev) < 0.01 ? prev : next;

// });

// // =======================================================================
// // COLLAPSE PROXIMITY DETECTOR — Riesgo estructural de colapso (STABILIZED)
// // Protección anti-NaN + Firewall avanzado + Bounding + Micro-jitter guard
// // ========================================================================


// setCollapseProximity(prev => {

  
//   // Fragilidad estructural
//   // ======================

//   const structuralFragility =
//     criticalSlowing * 0.3 +
//     structuralSurprise * 0.25 +
//     cascadeRisk * 0.2 +
//     collapseProbability * 0.15 +
//     (1 - resilienceBudget) * 0.1;

  
//   // Estabilizadores
//   // ===============

//   const stabilizers =
//     globalCoherence * 0.3 +
//     metaStabilityEnergy * 0.3 +
//     adaptiveResilienceRef.current * 0.4;

//   const raw =
//     structuralFragility - stabilizers * 0.5;

  
//   // Señal objetivo (bounded tanh)
//   // =============================

//   const target =
//     Math.tanh(raw * 2) * 0.5 + 0.5;

//   // suavizado temporal
//   const rawNext =
//     prev + (target - prev) * 0.04;

//   // ================================
//   // Anti-NaN original
//   // ================================

//   if (!Number.isFinite(rawNext)) {
//     return prev;
//   }

//   // =================
//   // Firewall avanzado
//   // =================

//   const safeNext = safeSignal(rawNext, {
//     min: 0,
//     max: 1,
//     fallback: prev,
//     maxStep: 0.06,      // ligeramente mayor que critical slowing
//     previous: prev
//   });

  
//   // Micro jitter guard
//   // ==================

//   if (Math.abs(safeNext - prev) < 0.005) {
//     return prev;
//   }

//   return safeNext;

// });
//                         // GLOBAL FIREWALL
// // 🔥🔥🔥 ===================================================== 🔥🔥🔥
// // Protección final contra inestabilidad numérica
// // Reinicio de campos críticos + Contención de divergencia sistémica
// // 🔥🔥🔥 ===================================================== 🔥🔥🔥

// if (!Number.isFinite(systemEnergy)) {
//   console.warn("⚠️ Numerical instability — resetting fields");

//   setPressureMomentum(0);
//   setStochasticPressure(0);
//   setCascadeRisk(0);
// }
 
// });

// // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// // COLLAPSE PROXIMITY — Signal Export to Decision Pipeline
// // Puente estructural entre motor dinámico y capa decisional
// // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
              


// }, [simTick]);

// // =================================================================================================
// // ███████╗███╗   ██╗ ██████╗ ██╗███╗   ██╗███████╗     ███████╗███╗   ██╗██████╗
// // ██╔════╝████╗  ██║██╔════╝ ██║████╗  ██║██╔════╝     ██╔════╝████╗  ██║██╔══██╗
// // █████╗  ██╔██╗ ██║██║  ███╗██║██╔██╗ ██║█████╗       █████╗  ██╔██╗ ██║██║  ██║
// // ██╔══╝  ██║╚██╗██║██║   ██║██║██║╚██╗██║██╔══╝       ██╔══╝  ██║╚██╗██║██║  ██║
// // ███████╗██║ ╚████║╚██████╔╝██║██║ ╚████║███████╗     ███████╗██║ ╚████║██████╔╝
// // ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝     ╚══════╝╚═╝  ╚═══╝╚═════╝
// // -------------------------------------------------------------------------------------------------
// // ENGINE LOOP TERMINATED — SYSTEM STATE STABILIZED
// // Dinámica integrada · Señales sincronizadas · Protección activa
// // =================================================================================================
