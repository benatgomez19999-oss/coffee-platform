// =====================================================
// SYSTEM PHYSICS MODEL
// Fuente única de parámetros físicos del engine
//
// Define constantes que gobiernan:
//
// - escalas temporales
// - ruido y shocks
// - fatiga estructural
// - aprendizaje y resiliencia
// - campos de presión
// - dinámica de buffer
// - memoria sistémica
// - transición de régimen
// - paisaje dinámico
// - amortiguación emergente
//
// Este archivo NO contiene estado — solo invariantes.
// =====================================================

export const PHYSICS = {

  // =====================================================
  // TIMESCALES
  // Define velocidades relativas de procesos del sistema
  // =====================================================
  timescales: {

    fast: 1,            // shocks inmediatos, momentum
    operational: 1,     // buffers, latencias, ajustes operativos
    structural: 4,     // acumulación de fatiga
    memory: 12,        // dependencia de trayectoria
    regime: 20,        // evolución de régimen
    
  },

  // =====================================================
  // NOISE MODEL
  // Ruido estocástico y clustering de perturbaciones
  // =====================================================
  noise: {

    baseline: 0.01,        // ruido ambiental constante
    shockAmplitude: 0.15,  // magnitud típica de shocks
    clustering: 0.08,      // tendencia a agrupar shocks
    structuralNoise: 0.005 // ruido lento de fondo

  },

  // =====================================================
  // FATIGUE DYNAMICS
  // Cómo se acumula y recupera el desgaste del sistema
  // =====================================================
  fatigue: {

    accumulationRate: 0.015, // velocidad de acumulación
    recoveryRate: 0.008,     // recuperación natural
    shockImpact: 0.04,       // efecto adicional por shocks
    maxFatigue: 0.3          // saturación máxima

  },

  // =====================================================
  // RESILIENCE LEARNING
  // Adaptación frente a sorpresa y experiencia
  // =====================================================
  resilience: {

    learningRate: 0.01,          // velocidad de aprendizaje
    adaptiveGainDamping: 0.15,   // evita sobre-reacción
    erosionRate: 0.02,           // desgaste estructural
    surpriseSensitivity: 0.4,    // cuánto impacta sorpresa
    minimum: 0.25                // resiliencia mínima

  },

  // =====================================================
  // PRESSURE FIELD
  // Campo de presión sistémica y saturación
  // =====================================================
  pressure: {

    baseline: 0.04,       // presión basal del sistema
    fragilityGain: 0.2,   // amplificación por fragilidad
    saturationGain: 1.1,  // no linealidad de saturación
    smoothing: 0.98       // filtrado temporal

  },

  // =====================================================
  // PRESSURE COUPLING
  // Acoplamiento entre presión y fatiga
  // =====================================================
  pressureCoupling: {

    fatigueAmplification: 0.2, // presión aumenta desgaste
    baseline: 0.04,
    saturationSharpness: 1.1

  },

  // =====================================================
  // BUFFER DYNAMICS
  // Capacidad de absorción de perturbaciones
  // =====================================================
  buffer: {

    relaxation: 0.08,          // velocidad de relajación
    collapseSensitivity: 0.6   // vulnerabilidad a colapso

  },

  // =====================================================
  // MEMORY DYNAMICS
  // Persistencia de efectos históricos
  // =====================================================
  memory: {

    pathAccumulation: 0.02,    // acumulación de trayectoria
    healingRate: 0.01,         // recuperación estructural
    thresholdAdaptation: 0.01  // ajuste de umbrales

  },

  // =====================================================
  // REGIME PHYSICS
  // Transiciones entre estados operativos
  // =====================================================
  regime: {

    enterBase: 0.72,           // umbral entrada
    exitBase: 0.55,            // umbral salida
    fatigueInfluence: 0.25,    // efecto fatiga
    pressureInfluence: 0.35,   // efecto presión
    hysteresisWidth: 0.08,     // memoria de transición
    noise: 0.03,               // ruido de régimen
    lockInStrength: 0.15       // estabilidad del estado

  },

  // =====================================================
  // ATTRACTOR LANDSCAPE
  // Forma del paisaje dinámico del sistema
  // =====================================================
  landscape: {

    smoothing: 0.05,
    basinStrength: 0.05,
    fatigueDeformation: 0.4,
    pressureDeformation: 0.3,
    memoryDeformation: 0.2,
    criticalSlowingGain: 0.6   // ralentización cerca de bifurcación

  },

  // =====================================================
  // ADAPTIVE DAMPING
  // Fricción emergente dependiente del estado
  // =====================================================
  damping: {

    base: 0.15,
    fatigueDrag: 0.6,
    instabilityDrag: 0.5,
    memoryDrag: 0.4

  },

  // =====================================================
  // SHOCK FIELD
  // Generación y propagación de perturbaciones
  // =====================================================
  shock: {

    baseProbability: 0.01,
    clusteringGain: 0.08,
    baseAmplitudeMin: 0.05,
    baseAmplitudeMax: 0.15,
    smoothing: 0.12

  }

  

};


