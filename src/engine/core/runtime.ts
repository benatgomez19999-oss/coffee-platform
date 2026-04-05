import { stepSimulationReal } from "@/src/engine/core/simulationReal";
import { stepOperationalLayer } from "@/src/engine/core/engineOperational"
import { computeUnifiedPressure } from "@/src/brain/systemBrain";
import { computeLiveDecision } from "@/src/decision/liveDecision"
import { stepContracts } from "@/src/clientLayer/layer/contractScheduler"
import { updateCommodityPrices }
from "@/src/AI/market/CommodityPriceEngine"
import { runAISystem } from "@/src/AI/orchestration/runAISystem"
import { runSpatialMarket }
from "@/src/spatialMarket/RunSpatialMarkets/runSpatialMarket"
import { propagateCommodityShock }
from "@/src/spatialMarket/cascade/commodityShockPropagation"
import { decayCommodityShocks }
from "@/src/spatialMarket/cascade/shockDecayEngine"
import { updateGlobalShockMemory }
from "@/src/spatialMarket/cascade/globalShockMemory"
import type { SupplyContract }
from "@/src/clientLayer/layer/contractTypes"
import { generateMarketSignals }
from "@/src/signals/marketSignals"
import { computeStrategyLeaderboard }
from "@/src/AI/analytics/StrategyLeaderboard"



export function getEngineContext(): EngineContext {
  return context
}



// =====================================================
// ENGINE RUNTIME CLOCK + STATE — HARDENED
//
// Runtime determinista desacoplado de React.
// El engine evoluciona aquí — React solo observa.
//
// Principios:
// — Single source of time
// — Step mutativo (sin retorno)
// — Protección contra loops múltiples
// — Protección contra spikes de tiempo
// — Snapshot estable para observers
// =====================================================


// =====================================================
// ENGINE STATE — SINGLE SOURCE OF TRUTH
// =====================================================

export type EngineState = {

  // brain 
  unifiedPressure: number;
  brainBelief: number

  // energía dinámica total
  systemEnergy: number

  // runtime stability guard
  instabilityScore: number
  guardThrottle: number

  // dynamic stability sensor
  lyapunovIndicator: number
  lastEnergySample: number

  // resilencia adaptativa
  adaptiveResilience: number

  // dinámica rápida
  pressureMomentum: number
  stochasticPressure: number

  // shocks
  shockLevel: number
  shockActivity: number

  // fatiga
  systemFatigue: number

  // memoria
  patternMemory: number
  pathMemory: number


  // campo de atracción estructural GLOBAL
  attractorField: number

  // probabilidad estructural de colapso
  collapseProbability: number
  collapseVelocity: number
_lastCollapseSample: number

  // campo de estres de abastecimiento
  supplyStressField: number;
  
  // scenario internal fields (drivers de pulsador "estados")
  _scenarioPressureBias: number
  _scenarioFatigueBias: number
  _scenarioNoiseGain: number
  _scenarioEnergyBias: number

  // régimen
  systemRegime: "Steady state" | "Structural stress"
  regimePersistence: number
  regimeSwitchPressure: number

  // deriva estructural del régimen
  regimeDriftSignal: number

  // inclinación estructural del régimen
  structuralBias: number

  // memoria estructural profunda
  stressScar: number

  // memoria acumulativa de shocks
  shockMemory: number

  // memoria lenta de transición
  thresholdMemory: number

  // desaceleración crítica estructural
  criticalSlowing: number

  // proximidad a bifurcación estructural
  collapseProximity: number

  // early warning system score
  ewsScore: number

  // presupuesto dinámico de resiliencia
  resilienceBudget: number


// SYSTEM HISTORY
// Memoria de eventos estructurales

  history: {
  collapseEvents: number
  regimeSwitches: number
  stressAlerts: number
}

  // tiempo acumulado del motor (ms)
  engineTime: number

  // demo dynamics (GLOBAL)
  nextDemoEvent: number
  calmUntil: number
  lastActiveRegion: number | null
  activityStreak: number

  // demo phase
  demoPhase: "calm" | "normal" | "active"
  demoPhaseIntensity: number

  // sub-event scheduling
  pendingRegionalActivations: number
  nextSubEventTime: number

  // regiones (SIN attractor dentro)
  regions: {
    name: string
    capacityKg: number
    availableKg: number
  }[]

// OPERATIONAL MEMORY
// Solicitudes comerciales pendientes de evaluación

pending: {
  requests: {
    id: string
    originalVolume: number
    remainingVolume: number
    status: "active" | "partial-filled"

    // SOURCE OF REQUEST
    // manual → UI / wizard
    // contract → scheduler / contratos activos
    // ========================================

    source: "manual" | "contract"

    autoExecute: boolean
    offerOpen: boolean
    offerExpiry: number | null
    suggestedVolume?: number
    timestamp: number
  }[]
}

// TRANSACTION HISTORY
// Historial de ejecuciones reales

transactions: {
  id: string
  volume: number
  timestamp: number
  region: string
}[]

// decision en tiempo real 
liveDecision: {
  semaphore: "green" | "yellow" | "red"
  riskScore: number
  coverageRatio: number
  explanation: string[]

  decisionZones?: {
    greenLimit: number
    yellowLimit: number
    maxLimit: number
  }
}
 
  // STRATEGIC VECTOR — DERIVED SNAPSHOT LAYER
  // snapshots de panel derecho lab 

  strategicVector: {
    pressureIndex: number
    stabilityDrift: number
    entropyGradient: number
    transitionForce: number
    interventionIndex: number
  }

// sistema de contratos 

contracts: {
  id: string
  monthlyVolumeKg: number
  durationMonths: number
  remainingMonths: number
  nextExecution: number
  status: "active" | "completed"
}[]

// DEMAND FORECAST
// Predicción agregada de demanda contractuals

demandForecast?: {

  // demanda agregada del próximo ciclo mensual
  nextMonth: number

  // proyección simple a 3 meses
  nextQuarter: number

  // indicador de tensión oferta / demanda
  stressIndex: number

}

// =====================================================
// SPATIAL MARKET STATE
//
// Mercado global derivado del estado físico del sistema.
// Se calcula después del stepSimulationReal.
// =====================================================

spatialMarket?: {

  // REGIONAL MARKETS

  regions: any[]

  // GLOBAL PRICE SURFACE

  prices: any


  // GLOBAL TRADE FLOWS


  flows: any[]

  
  // LOGISTICS NETWORK

  logistics: any

  // EXPORT OPPORTUNITIES

  exportOpportunities: any[]

  // CASCADE STRESS
   cascadeStress?: any

  // COMODITY GRAPH
  graph?: any

}

  // COMODITY OPORTUNITIES

  commodityOpportunities?: {
  commodity: string
  opportunityScore: number
  systemicRisk: number

}[]
  
  // COMODITY SHOCK

  commodityShockSignals?: {

  commodity: string
  shockPressure: number

}[]

  // COMODITY MARKET 
  commodityMarketRegime?:
  | "stable-market"
  | "supply-crunch"
  | "demand-boom"
  | "logistics-shock"
  | "supercycle"


  // =====================================================
// COMMODITY STRATEGY (ENHANCED)
//
// Estrategia ejecutable con identidad y métricas.
//
// =====================================================

commodityStrategies?: {

  // -------------------------------------------------
  // IDENTITY
  // -------------------------------------------------

  id?: string

  source?: "ai" | "evolution"

  // -------------------------------------------------
  // CORE STRATEGY
  // -------------------------------------------------

  commodity: string

  action:
    | "enter"
    | "increase"
    | "hold"
    | "reduce"
    | "avoid"

  confidence: number

  // -------------------------------------------------
  // PERFORMANCE TRACKING
  // -------------------------------------------------

  fitness?: number

  lastPnL?: number

  successRate?: number

  // -------------------------------------------------
  // CAPITAL CONTROL
  // -------------------------------------------------

  capitalWeight?: number

}[]

// STRATEGY LADDERBOARD 
strategyLeaderboard?: {
  strategyId: string
  trades: number
  totalPnL: number
  avgPnL: number
}[]

// GLOBAL TRADE ROUTES
globalTradeRoutes?: {

  commodity: string
  origin: string
  destination: string
  expectedMargin: number
  logisticsCost: number

}[]

// SUPPLY CHAIN EVENTS 
supplyChainEvents?: {

  type:
    | "port-congestion"
    | "shipping-delay"
    | "trade-restriction"
    | "weather-disruption"

  region: string
  severity: number

}[]

// COMODITY PORTFOLIO
commodityPortfolio?: {

  commodity: string
  weight: number
  riskScore: number

}[]

// GLOBAL RISK DASHBOARD 
globalRiskDashboard?: {

  globalSupplyStress: number
  logisticsDisruptionIndex: number
  commoditySupercycleProbability: number
  systemicRiskLevel: number
  portfolioFragility: number

}

// TRADE HISTORY
tradeHistory?: {
  id: string
  commodity: string
  volume: number
  entryPrice: number
  exitPrice?: number
  pnl?: number
  strategyId?: string
}[]

// ACTIVE SCENARIO
activeScenario?:

  | "china-demand-shock"
  | "el-nino"
  | "suez-blockage"
  | "opec-cut"
  | "global-recession"

  // STRATEGIC ADVISOR 
  strategicInsights?: {

  type:
    | "opportunity"
    | "risk"
    | "logistics"
    | "portfolio"

  message: string

}[]


// GLOBAL SHOCK MEMORY
// proteccion ante crisis mundiales 

globalShockMemory?: {

  energyStress: number
  logisticsStress: number
  foodStress: number
  climateStress: number
  systemicFragility: number

}

// GLOBAL SYSTEM FRAGILITY
systemFragility: number



}





// =====================================================
// ENGINE CONTEXT — INPUT PIPELINE
// Entradas externas que alimentan el núcleo determinista.
// =====================================================

export type EngineContext = {

  // CORE SYSTEM SIGNALS

  // resiliencia adaptativa — aún calculada en React
  adaptiveResilience: number

  // PATTERN MEMORY INPUTS — aprendizaje cognitivo
  
  collapseProbability: number
  anticipatoryBuffer: number
  scenarioField: number
  predictiveHorizon: number
  metaLearningRate: number
  meaningField: number
  counterfactualSignal: number
  spatialClusteringIndex: number
  ewsScore: number

  // AI STRATEGIC SIGNALS
  // Señales derivadas del forecast sistémico

  strategicRisk: number
  interventionUrgency: number
  decisionRobustness: number
  systemFragility: number
  

  // PATH MEMORY INPUTS — historia estructural

  bufferMargin: number
  resilienceMemory: number
 
  // REGIME ENGINE INPUTS — switching estructural

  thresholdMemory: number
  attractorField: number
  phaseSignal: number

  // REGIME DRIFT INPUT — tendencia estructural lenta
  // Señal externa que alimenta la deriva interna.

  structuralDrift: number

  // SIMULATION MODE — external scenario driver
  
  simulationMode: 
    | "Normal"
    | "Peak demand"
    | "Supply stress"
    | "Expansion phase";

// volumen requerido
requestedVolume: number


// STRATEGIC FORECAST SIGNALS
// Señales estratégicas derivadas del AI forecast


systemStability: number
strategicConfidence: number
marketRegime: "stable" | "transition" | "stress"


// SIMULATION CONTROL
// Control externo de velocidad temporal

  simulationSpeed?: number; // opcional

// ACTIVAR / DESACTIVAR AI AGENT 
autonomousMode?: boolean

};




// =====================================================
// ENGINE CALIBRATION (runtime mutable tuning)
// Solo usado por LAB
// =====================================================

export type EngineCalibration = {

  shockGain: number
  fatigueGain: number
  regimeSensitivity: number
  noiseGain: number
  collapseGain: number

}

let calibration: EngineCalibration = {

  shockGain: 1,
  fatigueGain: 1,
  regimeSensitivity: 1,
  noiseGain: 1,
  collapseGain: 1

}

export function updateEngineCalibration(
  partial: Partial<EngineCalibration>
) {

  calibration = {
    ...calibration,
    ...partial
  }

}

export function getEngineCalibration(): EngineCalibration {
  return calibration
}
  

// =====================================================
// LISTENERS (OBSERVERS)
// =====================================================

let listeners = new Set<(state: EngineState) => void>();

// =====================================================
// RUNTIME FLAGS
// =====================================================

let running = false;

// =====================================================
// DETERMINISTIC RANDOM — SEEDED GENERATOR
// Permite reproducibilidad del motor.
// =====================================================

let rngSeed = 123456789;

export function setEngineSeed(seed: number) {
  rngSeed = seed >>> 0;
}

// =====================================================
// UTIL — Clamp 0..1
// =====================================================

const clamp01 = (x: number) =>
  Math.max(0, Math.min(1, x));

// =====================================================
// RUNTIME STABILITY GUARD
// Detecta exceso de energía dinámica y reduce velocidad
//
// Filosofía:
// — Si systemEnergy > capacidad estructural
// — Se activa freno progresivo
// — Nunca bloquea totalmente (máx 70%)
// =====================================================

function computeGuardThrottle(state: EngineState) {

  // exceso energético estructural
  const energyInstability =
  Math.max(0,
    state.systemEnergy -
    (Number.isFinite(state.resilienceBudget) ? state.resilienceBudget : 0)
  );

  // suavizado exponencial
  const smoothed =
    state.instabilityScore * 0.9 +
    energyInstability * 0.1;

  // freno máximo 70%
  const throttle =
    1 - Math.min(0.7, smoothed);

  return {
    instabilityScore: smoothed,
    guardThrottle: throttle
  };
}

export function engineRandom() {
  // xorshift32 — rápido y estable
  rngSeed ^= rngSeed << 13;
  rngSeed ^= rngSeed >> 17;
  rngSeed ^= rngSeed << 5;

  return ((rngSeed >>> 0) / 4294967296);
}

// =====================================================
// DERIVE STRATEGIC VECTOR
// Capa de agregación de señales para UI avanzada.
// No afecta al núcleo físico.
// =====================================================

function deriveStrategicVector(state: EngineState) {


  // -----------------------------------------------------
  // 1️⃣ PRESSURE INDEX — bias dinámico agregado
  // -----------------------------------------------------

  const pressureIndex =
    clamp01(
      Math.abs(state.pressureMomentum) * 0.4 +
      state.shockLevel * 0.3 +
      state.systemFatigue * 0.2
    );

  // -----------------------------------------------------
  // 2️⃣ ENTROPY GRADIENT — inestabilidad estructural
  // -----------------------------------------------------

  const entropyGradient =
    clamp01(
      state.lyapunovIndicator * 0.5 +
      state.shockMemory * 0.3 +
      state.criticalSlowing * 0.2
    );

  // -----------------------------------------------------
  // 3️⃣ TRANSITION FORCE — presión de cambio de régimen
  // -----------------------------------------------------

  const transitionForce =
    clamp01(
      state.regimeDriftSignal * 0.6 +
      state.collapseProximity * 0.4
    );

  // -----------------------------------------------------
  // 4️⃣ INTERVENTION INDEX — necesidad sistémica
  // -----------------------------------------------------

  const interventionIndex =
    clamp01(
      state.collapseProbability * 0.5 +
      state.ewsScore * 0.3 -
      state.resilienceBudget * 0.3
    );

  // -----------------------------------------------------
  // 5️⃣ STABILITY DRIFT — desplazamiento estructural
  // -----------------------------------------------------

  const stabilityDrift =
    clamp01(
      state.structuralBias * 0.5 +
      state.regimePersistence * 0.3 +
      state.stressScar * 0.2
    );

  return {
    pressureIndex,
    entropyGradient,
    transitionForce,
    interventionIndex,
    stabilityDrift
  };

  
}

// =====================================================
// CONTRACT SYSTEM
// Capa de agregación registro de contratos  
// =====================================================

export function registerEngineContract(
  contract: SupplyContract
) {

  state.contracts.push({
    id: contract.id,
    monthlyVolumeKg: contract.monthlyVolumeKg,
    durationMonths: contract.durationMonths,
    remainingMonths: contract.remainingMonths,
    nextExecution: contract.nextExecution,
    status: contract.status === "active" ? "active" : "completed"
  })

}




// =====================================================
// ENGINE STATE INSTANCE
// Contenedor interno mutable del runtime.
// Evoluciona exclusivamente mediante stepSimulation.
// =====================================================

let state: EngineState = {

  // brain
  unifiedPressure: 0.4,
  brainBelief: 0.3,

  // energía dinámica
  systemEnergy: 0,

  // runtime stability guard
  instabilityScore: 0,
  guardThrottle: 1,

  // dynamic stability sensor
  lyapunovIndicator: 0,
  lastEnergySample: 0,

  // resilencia adaptativa
  adaptiveResilience: 0.5,

  // dinámica rápida
  pressureMomentum: 0,
  stochasticPressure: 0,

  // shocks
  shockLevel: 0,
  shockActivity: 0,

  // fatiga estructural
  systemFatigue: 0,

  // memorias
  patternMemory: 0,
  pathMemory: 0,


  // campo de atracción estructural global
  attractorField: 0.5,

  // probabilidad estructural de colapso
  collapseProbability: 0,
  collapseVelocity: 0,
_lastCollapseSample: 0,

  // campo de estres de abastecimiento
  supplyStressField: 0,

  // scenario internal fields (drivers de pulsador "estados")
  _scenarioPressureBias: 0,
  _scenarioFatigueBias: 0,
  _scenarioNoiseGain: 1,
  _scenarioEnergyBias: 0,

  // régimen
  systemRegime: "Steady state",
  regimePersistence: 0,
  regimeSwitchPressure: 0,

  // deriva estructural del régimen
  regimeDriftSignal: 0,

  // structural BIAS
  structuralBias: 0,

  // cicatrices acumuladas del sistema
  stressScar: 0,

  // memoria acumulativa de shocks
  shockMemory: 0,

  // memoria lenta de transicion
  thresholdMemory: 0.5,

  // desaceleración crítica estructural
  criticalSlowing: 0,

  // proximidad a bifurcación estructural
  collapseProximity: 0,

  // early warning system score
  ewsScore: 0,

  // presupuesto dinámico de resiliencia
  resilienceBudget: 0.8,

  // SYSTEM HISTORY
  // Memoria de eventos estructurales

  history: {
  collapseEvents: 0,
  regimeSwitches: 0,
  stressAlerts: 0
},

  // engine time
  engineTime: 0,

  // demo dynamics
  nextDemoEvent: 15000,
  calmUntil: 0,
  lastActiveRegion: null,
  activityStreak: 0,

  // demo phase
  demoPhase: "normal",
  demoPhaseIntensity: 0,

  // sub-event scheduling
  pendingRegionalActivations: 0,
  nextSubEventTime: 0,

  // regions
  regions: [
    {
      name: "Huila",
      capacityKg: 20000,
      availableKg: 7000,
    },
    {
      name: "Antioquia",
      capacityKg: 20000,
      availableKg: 9000,
    },
    {
      name: "Nariño",
      capacityKg: 20000,
      availableKg: 3000,
    },
    {
      name: "Tolima",
      capacityKg: 20000,
      availableKg: 16000,
    },
  ],

// OPERATIONAL MEMORY
// Solicitudes comerciales pendientes de evaluación
  pending: {
  requests: []
},

// TRANSACTION HISTORY
// Historial de ejecuciones reales
transactions: [],

// decision en tiempo real
liveDecision: {
  semaphore: "green",
  riskScore: 0,
  coverageRatio: 1,
  explanation: ["Initializing decision engine"]
},

// STRATEGIC VECTOR — DERIVED SNAPSHOT LAYER
// snapshots de panel derecho lab 

 strategicVector: {
    pressureIndex: 0,
    stabilityDrift: 0,
    entropyGradient: 0,
    transitionForce: 0,
    interventionIndex: 0,
  },

// sistema de contratos

contracts: [],

// DEMAND FORECAST STATE
// Inicializado vacío — se calcula en runtime

demandForecast: {
  nextMonth: 0,
  nextQuarter: 0,
  stressIndex: 0
},


// spatial markets 
spatialMarket: {
  regions: [],
  prices: {},
  flows: [],
  logistics: {},
  exportOpportunities: []
},

// GLOBAL SYSTEM FRAGILITY
systemFragility: 0,




}


// =====================================================
// INITIAL ENGINE STATE SNAPSHOT
// Permite a React inicializar con estado consistente
// antes del primer tick.
// =====================================================

export function getInitialEngineState(): EngineState {
  return { ...state };
}

// =====================================================
// REGION ALLOCATION — CONTROLLED RUNTIME MUTATION
// Ahora genera impulso físico sistémico
// =====================================================

export function allocateFromRegion(volume: number) {

  if (!state.regions || state.regions.length === 0) return;
  if (!Number.isFinite(volume) || volume <= 0) return;

  const regions = state.regions;
  



  // =====================================================
  // Selecciona región con mayor disponibilidad
  // =====================================================

  const targetIndex = regions.reduce(
    (bestIdx, region, i, arr) =>
      region.availableKg > arr[bestIdx].availableKg ? i : bestIdx,
    0
  );

  const targetRegion = regions[targetIndex];
  if (!targetRegion) return;

  const allocation = Math.min(volume, targetRegion.availableKg);
  if (allocation <= 0) return;

  // =====================================================
  // Mutación regional
  // =====================================================

  targetRegion.availableKg =
    Math.max(0, targetRegion.availableKg - allocation);

  // =====================================================
  // 🔥 FÍSICA SISTÉMICA — IMPULSE INJECTION
  // =====================================================

  const totalCapacity = regions.reduce(
    (acc, r) => acc + r.capacityKg,
    0
  );

  const impulse = allocation / Math.max(1, totalCapacity);

  // Momentum reacciona
state.pressureMomentum =
  Math.max(-0.2, Math.min(0.2,
    state.pressureMomentum + impulse * 0.4
  ));

  // Fatigue aumenta levemente
  state.systemFatigue =
    clamp01(state.systemFatigue + impulse * 0.2);

  // Shock físico solo si impulso es significativo
  if (impulse > 0.02) {
    state.shockLevel =
      clamp01(state.shockLevel + impulse * 0.6);
  }

// =====================================================
// RECORD TRANSACTION
// =====================================================

state.transactions.unshift({
  id: Math.random().toString(36).slice(2),
  volume: allocation,
  timestamp: state.engineTime,
  region: targetRegion.name
})

// mantener solo últimas 20
if (state.transactions.length > 20) {
  state.transactions.pop()
}
}

// =====================================================
// TEST SUPPLY INJECTION — LAB ONLY
// Permite añadir stock artificial para testing.
// =====================================================

export function injectSupply(volume: number) {

  if (!Number.isFinite(volume) || volume <= 0) return

  const regions = state.regions
  if (!regions.length) return

  const perRegion = volume / regions.length

  regions.forEach(region => {

    region.availableKg =
      Math.min(
        region.capacityKg,
        region.availableKg + perRegion
      )

  })

}



// =====================================================
// ENGINE CONTEXT INSTANCE
// Valores iniciales seguros para evitar undefined.
// Mantiene estabilidad durante migración progresiva.
//
// Representa un estado neutro del sistema durante el
// arranque del runtime — evita transientes no físicos.
// =====================================================

let context: EngineContext = {

  // =====================================================
  // CORE SIGNALS
  // =====================================================

  

  // resiliencia adaptativa calculada temporalmente en React
  adaptiveResilience: 0.5,

  // PATTERN MEMORY DEFAULTS — aprendizaje cognitivo

  collapseProbability: 0,
  anticipatoryBuffer: 0,
  scenarioField: 0,
  predictiveHorizon: 0.5,
  metaLearningRate: 0.3,
  meaningField: 0.5,
  counterfactualSignal: 0,
  spatialClusteringIndex: 0,
  ewsScore: 0,

  // AI strategic signals
  strategicRisk: 0,
  interventionUrgency: 0,
  decisionRobustness: 1,
  systemFragility: 0,

  // PATH MEMORY DEFAULTS — historia estructural

  // margen de buffer disponible
  bufferMargin: 1,

  // memoria lenta de resiliencia acumulada
  resilienceMemory: 0.5,

  // =====================================================
  // REGIME ENGINE DEFAULTS — switching estructural
  // =====================================================

  // cicatrices acumuladas del sistema
  

  // adaptación histórica de umbrales
  thresholdMemory: 0.5,

  // campo atractor del paisaje dinámico
  attractorField: 0,

  // señal de fase — introduce variabilidad cíclica
  phaseSignal: 0,


  // =====================================================
  // REGIME DRIFT INPUTS — tendencia estructural lenta
  // =====================================================

  // deriva externa lenta (inyectada desde React)
  structuralDrift: 0,

  // =====================================
  // SIMULATION CONTROL
  // Control externo de velocidad temporal
  // =====================================

  simulationSpeed: 1, // select 

  // =====================================================
  // SIMULATION MODE — external scenario driver
  // =====================================================
  simulationMode: "Normal",

  // =====================================================
  // REQUEST VOLUME  — propuesta de volumen 
  // =====================================================
  requestedVolume: 0,

  // =====================================================
  // STRATEGIC FORECAST DEFAULTS
  // =====================================================

systemStability: 1,
strategicConfidence: 1,
marketRegime: "stable",

  // ACTIVAR / DESACTIVAR AI AGENT 
autonomousMode: false

};

// =====================================================
// SIGNAL STATE — RUNTIME OWNERSHIP
// Single source of truth
// =====================================================

export type SignalState = {
  stochasticPressure: number
  switchPressure: number
  momentum: number
  regimeDrift: number
  regimePersistence: number
  thresholdMemory: number
  ewsScore: number
  collapseProximity: number
  adaptiveResilience: number
  pathMemory: number
  patternMemory: number
  confidenceHorizon: number
  shockMemory: number
  phaseRisk: number
  resilienceBudget: number
  patienceField: number
  lyapunov: number 
}

// =====================================================
// SIGNAL INIZIALIZATION
// =====================================================

const signals: SignalState = {
  stochasticPressure: 0,
  switchPressure: 0,
  momentum: 0,
  regimeDrift: 0,
  regimePersistence: 0,
  thresholdMemory: 0.5,
  ewsScore: 0,
  collapseProximity: 0,
  adaptiveResilience: 0.5,
  pathMemory: 0,
  patternMemory: 0,
  confidenceHorizon: 0.5,
  shockMemory: 0,
  phaseRisk: 0,
  resilienceBudget: 1,
  patienceField: 0,
  lyapunov: 0,
}

// =====================================================
// ACCESSOR
// =====================================================

export function getEngineSignals(): SignalState {
  return signals
}

// =====================================================
// ENGINE RUNTIME CONTAINER (PREPARATION PHASE)
// =====================================================

const runtime = {
  getState: () => state,
  getContext: () => context
};


// =====================================================
// UPDATE CONTEXT — INPUT PIPELINE
// Permite inyectar señales desde React sin mutar
// directamente el objeto state del runtime.
// =====================================================

export function updateEngineContext(partial: Partial<EngineContext>) {
  context = {
    ...context,
    ...Object.fromEntries(
      Object.entries(partial).filter(([_, v]) => v !== undefined)
    )
  };
}


// =====================================================
// SUBSCRIBE — OBSERVE ENGINE STATE
// React observa snapshots del motor.
// =====================================================

export function subscribeEngine(listener: (state: EngineState) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}





// =====================================================
// EMIT SNAPSHOT — SAFE DEEP COPY
// React recibe snapshot inmutable.
// Blindaje estructural contra mutaciones externas.
// =====================================================

function emitTick() {

  const snapshot: EngineState = {

    // -------------------------------------------------
    // SHALLOW BASE COPY
    // -------------------------------------------------

    ...state,

    // -------------------------------------------------
    // REGIONS — deep copy
    // -------------------------------------------------

    regions: state.regions.map(region => ({
      ...region
    })),

    // -------------------------------------------------
    // PENDING REQUESTS — deep copy
    // -------------------------------------------------

    pending: {
      ...state.pending,
      requests: state.pending.requests.map(req => ({
        ...req
      }))
    },

    // -------------------------------------------------
    // SPATIAL MARKET — SAFE SNAPSHOT
    // -------------------------------------------------

    spatialMarket: state.spatialMarket
      ? {
          regions: [
            ...(state.spatialMarket.regions ?? [])
          ],

          prices: {
            ...(state.spatialMarket.prices ?? {})
          },

          flows: [
            ...(state.spatialMarket.flows ?? [])
          ],

          logistics: {
            ...(state.spatialMarket.logistics ?? {})
          },

          exportOpportunities: [
            ...(state.spatialMarket.exportOpportunities ?? [])
          ],

          cascadeStress: state.spatialMarket.cascadeStress,
          graph: state.spatialMarket.graph
        }
      : {
          regions: [],
          prices: {},
          flows: [],
          logistics: {},
          exportOpportunities: []
        }

  };

  listeners.forEach(listener => listener(snapshot));
}

// =====================================================
// ENGINE LOOP — RAF DRIVER
// Loop determinista desacoplado de React.
// Integración física desacoplada de FPS.
// Incluye:
// — Simulation speed dinámico
// — Clamp de velocidad
// — Substepping proporcional
// — Estabilidad numérica en high speed
// =====================================================



// =====================================================
// START ENGINE RUNTIME — PUBLIC ENTRY POINT
// React inicia el motor.
// Loop determinista con substepping controlado.
// Soporta simulationSpeed hasta x16.
// =====================================================

export function startEngineRuntime() {
  console.log("RUNTIME VERSION X1", context);

  if (running) return;
  running = true;

  let lastTime = performance.now();
  let nextAITick = 0

  function loop(now: number) {

    const dtMs = now - lastTime;
    lastTime = now;

    // -----------------------------------------------------
    // PROTECCIÓN — Ignorar spikes grandes de tiempo
    // Evita explosiones tras tab inactive o lag fuerte
    // -----------------------------------------------------

    if (dtMs > 200) {
      requestAnimationFrame(loop);
      return;
    }

    // -----------------------------------------------------
    // FREEZE EN BACKGROUND
    // Evita integración cuando el tab no está visible
    // -----------------------------------------------------

    if (typeof document !== "undefined" && document.hidden) {
      requestAnimationFrame(loop);
      return;
    }

    // -----------------------------------------------------
    // TIME NORMALIZATION (seconds)
    // -----------------------------------------------------

    const dtSeconds = dtMs / 1000;

    // -----------------------------------------------------
    // SIMULATION SPEED CONTROL (React → Runtime)
    // Clamp defensivo hasta x16
    // -----------------------------------------------------

   const rawSpeed = context.simulationSpeed ?? 1;

   // aplicar guard throttle dinámico
   const guardedSpeed =
  rawSpeed * state.guardThrottle;

   const clampedSpeed =
   Math.max(0, Math.min(16, guardedSpeed));
    
    

// -----------------------------------------------------
// SUBSTEPPING PROFESIONAL — 1:1 TIME RELATION
//
// Filosofía:
// - Nunca truncamos tiempo físico
// - simulationSpeed mantiene relación exacta
// - Limitamos tiempo máximo físico por frame (seguridad)
// - Garantizamos estabilidad numérica
// -----------------------------------------------------

const MAX_DT = 0.02;        // paso físico máximo estable (20ms)
const MAX_FRAME_DT = 0.5;   // máximo tiempo físico procesable por frame (seguridad)

// -----------------------------------------------------
// TIEMPO FÍSICO TOTAL A INTEGRAR ESTE FRAME
// -----------------------------------------------------

let totalDt = dtSeconds * clampedSpeed;

// Protección contra frames anómalos (tab lag, freeze, etc.)
if (totalDt > MAX_FRAME_DT) {
  totalDt = MAX_FRAME_DT;
}

let remainingDt = totalDt;

// -----------------------------------------------------
// ACTUALIZAR RELOJ INTERNO (real time ms)
// Mantiene referencia experimental real.
// -----------------------------------------------------

state.engineTime += dtMs * clampedSpeed;


// =====================================================
// PHYSICS SUBSTEPPED INTEGRATION
// Cada paso nunca supera MAX_DT
// No hay truncamiento por número de pasos
// =====================================================

while (remainingDt > 0) {

  const dtStep = Math.min(remainingDt, MAX_DT);

  //  STEP FÍSICO ENCAPSULADO
  stepSimulationReal(state, context, dtStep);

  remainingDt -= dtStep;
}

// =====================================================
// SYSTEM BRAIN — ENGINE OWNED
// Derivación sistémica interna.
// React NO participa.
// =====================================================

state.unifiedPressure =
  computeUnifiedPressure(state, context);

  

// =====================================================
// LIVE DECISION — EXTERNAL DECISION MODULE
// =====================================================

state.liveDecision =
  computeLiveDecision(state, context)



// =====================================================
// OPERATIONAL LAYER
// =====================================================

stepOperationalLayer(state);

// =====================================================
// AI SYSTEM (scheduled)
// =====================================================

if (state.engineTime >= nextAITick) {

  runAISystem(state, context, {
    weather: {
      rainfallAnomaly: 0.2,
      temperatureAnomaly: 0.1,
      droughtIndex: 0.1,
      frostRisk: 0
    },
    demand: {
      consumptionTrend: 0.3,
      priceElasticityShift: 0.1,
      orderVolatility: 0.2
    },
    supply: {
      portCongestion: 0.2,
      shippingDelay: 0.1,
      geopoliticalRisk: 0.05
    }
  });

  nextAITick = state.engineTime + 5000; // cada 5 segundos
}

// -----------------------------------------------------
// STRATEGY LEADERBOARD
// -----------------------------------------------------

const leaderboard =
  computeStrategyLeaderboard()

state.strategyLeaderboard = leaderboard

// =====================================================
// COMMODITY SHOCK PROPAGATION
// =====================================================

propagateCommodityShock(state)

// =====================================================
// GLOBAL SHOCK MEMORY
// =====================================================
updateGlobalShockMemory(state)


// =====================================================
// SPATIAL MARKET SIMULATION
// =====================================================

runSpatialMarket(state)

// =====================================================
// SHOCK NORMALIZATION
// =====================================================
decayCommodityShocks(state)


// =====================================================
// COMMODITY PRICE ENGINE
// =====================================================

updateCommodityPrices(state);


// =====================================================
// MARKET SIGNAL GENERATOR
// =====================================================

const marketSignals = generateMarketSignals({

  tick: state.engineTime,

  // -------------------------------------------------
  // PRICE (desde commodity engine)
  // -------------------------------------------------

  price: {
    arabicaTrend: state.commodityMarketRegime === "demand-boom" ? 0.1 : 0
  },

  // -------------------------------------------------
  // SUPPLY (desde sistema físico)
  // -------------------------------------------------

  supply: {
    brazil:
      state.regions.reduce((acc, r) => acc + r.availableKg, 0) /
      state.regions.reduce((acc, r) => acc + r.capacityKg, 0)
  },

  // -------------------------------------------------
  // DEMAND (desde forecast)
  // -------------------------------------------------

  demand: {
    global: state.demandForecast?.stressIndex ?? 1
  },

  // -------------------------------------------------
  // RISK (desde sistema global)
  // -------------------------------------------------

  risk: {
    cascadeProbability:
      state.globalRiskDashboard?.systemicRiskLevel ?? 0
  }

})

// =====================================================
// MERGE INTO ENGINE SIGNALS
//
// NO rompe arquitectura:
// seguimos usando el contenedor oficial `signals`
//
// =====================================================

;(signals as any).market = marketSignals

// =====================================================
// RUNTIME STABILITY GUARD
// Control estructural externo al núcleo físico
// =====================================================

const guard = computeGuardThrottle(state);

state.instabilityScore = guard.instabilityScore;
state.guardThrottle = guard.guardThrottle;

// =====================================================
// STRATEGIC SNAPSHOT DERIVATION
// Se actualiza justo antes de emitir snapshot.
// =====================================================

state.strategicVector =
  deriveStrategicVector(state);

// =====================================================
// CONTRACT EXECUTION 
// ejecuta contratos de clientes 
// =====================================================

stepContracts(state)

// =====================================================
// DEMAND FORECAST UPDATE
// =====================================================

computeDemandForecast(state)


// =====================================================
// EMIT SNAPSHOT (React observa)
// =====================================================

emitTick();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// =====================================================
// DEMAND FORECAST ENGINE
//
// Calcula demanda futura basada en contratos activos.
// No afecta física — solo genera observables.
// =====================================================

function computeDemandForecast(
  state: EngineState
) {

  const activeContracts =
    state.contracts.filter(
      c => c.status === "active"
    )

  // -------------------------------------------------
  // NEXT MONTH DEMAND
  // -------------------------------------------------

  const nextMonthDemand =
    activeContracts.reduce(
      (sum, c) => sum + c.monthlyVolumeKg,
      0
    )

  // -------------------------------------------------
  // NEXT QUARTER PROJECTION
  // -------------------------------------------------

  const nextQuarterDemand =
    nextMonthDemand * 3

  // -------------------------------------------------
  // AVAILABLE STOCK
  // -------------------------------------------------

  const availableStock =
    state.regions.reduce(
      (sum, r) => sum + r.availableKg,
      0
    )

  // -------------------------------------------------
  // SUPPLY / DEMAND STRESS
  // -------------------------------------------------

  const stressIndex =
    nextMonthDemand /
    Math.max(1, availableStock)

  state.demandForecast = {

    nextMonth: nextMonthDemand,

    nextQuarter: nextQuarterDemand,

    stressIndex

  }

}


// =====================================================
// OPERATIONAL REQUEST ENTRY POINT
// Inserta intención comercial estructural persistente
//
// TODAS las solicitudes pasan por la capa operacional.
// La ejecución depende exclusivamente del semáforo.
// =====================================================

export function submitOperationalRequest(
  volume: number,
  source: "manual" | "contract" = "manual"
) {

  if (!Number.isFinite(volume) || volume <= 0) return;

  const id = Math.random().toString(36).slice(2);

  state.pending.requests.push({
    id,

    originalVolume: volume,
    remainingVolume: volume,
    status: "active",

    // =====================================================
    // SOURCE OF REQUEST
    // manual → UI / wizard
    // contract → contract scheduler
    // =====================================================

    source,

    // Nunca autoExecute al crear
    autoExecute: false,

    offerOpen: false,
    offerExpiry: null,
    suggestedVolume: undefined,

    timestamp: state.engineTime
  });

}


// =====================================================
// ACCEPT SUGGESTED VOLUME
// Usuario acepta volumen alternativo ofrecido.
// Ejecuta asignación parcial.
// =====================================================

export function acceptSuggestedVolume(requestId: string) {

  const request = state.pending.requests.find(r => r.id === requestId);
  if (!request) return;

  if (!request.suggestedVolume || request.suggestedVolume <= 0) return;

  const volumeToAllocate = request.suggestedVolume;

  // =====================================================
  // EJECUCIÓN FÍSICA
  // =====================================================

  allocateFromRegion(volumeToAllocate);

  // Reducir volumen pendiente
  request.remainingVolume =
    Math.max(0, request.remainingVolume - volumeToAllocate);

  // Cerrar ventana de oferta
  request.offerOpen = false;
  request.offerExpiry = null;
  request.suggestedVolume = undefined;

  // =====================================================
  // Si ya está completamente cubierta → eliminar request
  // =====================================================

  if (request.remainingVolume <= 0) {

    state.pending.requests =
      state.pending.requests.filter(r => r.id !== requestId);

  }

}