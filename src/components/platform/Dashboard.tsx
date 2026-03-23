"use client";


import React, { useEffect, useState, useRef, useMemo } from "react";
import ClientTradingPanel from "@/components/platform/ClientTradingPanel"
import ClientContractsPanel from "@/components/platform/ClientContractsPanel"
import ClientOverviewPanel from "@/components/platform/ClientOverviewPanel"
import { startEngineRuntime } from "@/engine/runtime"
import { useSearchParams } from "next/navigation"
import { initWebsocketClient }
from "@/websocket/websocketClient"
import OnboardingWizard from "@/components/platform/OnboardingWizard"
import { getUserFromRequest } from "@/lib/auth"
import Image from "next/image"




// ENGINE
import { stepSimulationReal } from "@/engine/simulationReal";
import {
  updateEngineContext,
  subscribeEngine,
  getInitialEngineState,
  submitOperationalRequest
} from "@/engine/runtime";

import { runDecisionPipeline } from "@/decision/decisionPipeline";
import { evaluateSystemDecision } from "@/decision/decisionBridge"
import { getSignals } from "@/signals/signalRegistry"
import { safeSignal } from "@/signals/signalFirewall";

import type { EngineState } from "@/engine/runtime";
import { useRouter } from "next/navigation"



export default function Dashboard({ user }: { user: any }) {


const router = useRouter()
const [contracts, setContracts] = useState<any[]>([])




// ======================================================
// SUCESSFULL CONTRACT
// ======================================================

const searchParams = useSearchParams()!

const contractSuccess =
  searchParams.get("contract") === "success"

const [showMessage, setShowMessage] = useState(contractSuccess)

useEffect(() => {

  if (contractSuccess) {

    const timer = setTimeout(() => {
      setShowMessage(false)
    }, 4000) // 4 segundos

    return () => clearTimeout(timer)

  }

}, [contractSuccess])

useEffect(() => {

  const loadContracts = async () => {
    try {
      const res = await fetch("/api/contracts", {
        credentials: "include"
      })

      if (!res.ok) return

      const data = await res.json()
      setContracts(data)

    } catch (err) {
      console.error("Error loading contracts", err)
    }
  }

  loadContracts()

}, [])

useEffect(() => {

  if (contractSuccess) {

    const loadContracts = async () => {
      const res = await fetch("/api/contracts", {
        credentials: "include"
      })

      if (res.ok) {
        const data = await res.json()
        setContracts(data)
      }
    }

    loadContracts()

  }

}, [contractSuccess])


  

//    const DEBUG_EFFECTS = true;
//    const renderCount = useRef(0);

// renderCount.current++;

// if (DEBUG_EFFECTS && renderCount.current % 50 === 0) {
//   console.log("renders:", renderCount.current);
// }

const [scrolled, setScrolled] = useState(false)
const [offset, setOffset] = useState(38);
const [loaded, setLoaded] = useState(false);
const [directVisible, setDirectVisible] = useState(false);
const [volume, setVolume] = useState(20);
const [effectiveVolume, setEffectiveVolume] = useState(20);
const [latency, setLatency] = useState(12);
const [signalHealth, setSignalHealth] = useState(1);
const [sliderValue, setSliderValue] = useState(0);
const [alertMemory, setAlertMemory] = useState(0);
const [isDragging, setIsDragging] = useState(false);
const [pressureSignal, setPressureSignal] = useState("Stable");
const [systemInertia, setSystemInertia] = useState(0.2);
const [structuralDrift, setStructuralDrift] = useState(0);
const [breathingPhase, setBreathingPhase] = useState(0);
const [commitmentPressure, setCommitmentPressure] = useState(0);
const [shockField, setShockField] = useState(0);
const [bufferMargin, setBufferMargin] = useState(1);
const [riskPosture, setRiskPosture] = useState("Balanced");
const [regimeCommitment, setRegimeCommitment] = useState(0);
const [driverScenario, setDriverScenario] = useState("Normal");
const [driverEarlyWarning, setDriverEarlyWarning] = useState(false);
const [resilienceMemory, setResilienceMemory] = useState(0.5);
const [thresholdMemory, setThresholdMemory] = useState(0.5);
const [attractorField, setAttractorField] = useState(0);
const [phaseSignal, setPhaseSignal] = useState(0);
const [anticipationConfidence, setAnticipationConfidence] = useState(0.5);
const [structuralSurprise, setStructuralSurprise] = useState(0);
const [metaLearningRate, setMetaLearningRate] = useState(0.3);
const [intentField, setIntentField] = useState(0.5);
const [identityField, setIdentityField] = useState(0.7);
const [meaningField, setMeaningField] = useState(0.5);
const [narrativeCoherence, setNarrativeCoherence] = useState(0.6);
const [predictiveHorizon, setPredictiveHorizon] = useState(0.5);
const [scenarioField, setScenarioField] = useState(0);
const [simulationSpeed, setSimulationSpeed] = useState(1);

// ======================================================
// ENGINE STATE SNAPSHOT — SINGLE SOURCE OF TRUTH
// ======================================================

const [engineState, setEngineState] =
  useState<EngineState>(getInitialEngineState());

const safeEngineState = engineState;

useEffect(() => {

  startEngineRuntime()

  // ======================================================
  // CONNECT REALTIME CHANNEL
  // ======================================================

  initWebsocketClient()

}, [])



// ======================================================
// ENGINE → REACT SUBSCRIPTION
// ======================================================

const lastUpdate = useRef(0)

useEffect(() => {

  const unsubscribe = subscribeEngine((snapshot) => {

    const now = performance.now()

    if (now - lastUpdate.current < 70) return
    lastUpdate.current = now

    setEngineState(prev => {

      if (
        prev.engineTime === snapshot.engineTime &&
        prev.unifiedPressure === snapshot.unifiedPressure &&
        prev.liveDecision?.semaphore === snapshot.liveDecision?.semaphore
      ) {
        return prev
      }

      return snapshot

    })

  })

  return () => {
    unsubscribe()
  }

}, [])

// ======================================================
// UI STATIC CONFIG
// ======================================================

const metricBox = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  padding: "12px"
};


// ======================================================
// CORE UI STATE
// ======================================================

const [alertLevel, setAlertLevel] =
  useState<"normal" | "watch" | "risk">("normal");

const [events, setEvents] = useState([
  "Allocation updated — 2m ago",
  "Capacity signal received",
  "Network verification complete"
]);

const [systemLoad, setSystemLoad] = useState(0.3);
const [stressProbability, setStressProbability] = useState(0);
const [trend, setTrend] =
  useState<"stable" | "rising" | "easing">("stable");
const [suggestion, setSuggestion] =
  useState("Operating within optimal parameters");

const [narrativeInsight, setNarrativeInsight] =
  useState("Network operating within expected parameters");

const [posture, setPosture] = useState("Nominal");
const [stabilityIndex, setStabilityIndex] = useState(95);
const [confidenceSignal, setConfidenceSignal] = useState("High");
const [systemMood, setSystemMood] = useState("Calm");
const [strategicOutlook, setStrategicOutlook] =
  useState("Stable trajectory");
const [operationalPriority, setOperationalPriority] =
  useState("Maintain allocation cadence");
const [supplyOutlook, setSupplyOutlook] =
  useState("Short-term supply secure");
const [confidenceVector, setConfidenceVector] = useState(0.92);
const [stressHistory, setStressHistory] =
  useState<number[]>(Array(24).fill(0.2));


// ======================================================
// BRAIN STATE
// ======================================================

const [brainState, setBrainState] = useState({
  stress: 0.2,
  coherence: 0.8,
  cognitiveLoad: 0.2,
  mode: "baseline" as "calm" | "baseline" | "alert" | "overdrive"
});


// ======================================================
// DERIVED — REGION USAGE
// ======================================================

const averageUsage = useMemo(() => {

  if (!safeEngineState.regions?.length) return 0;

  return safeEngineState.regions.reduce((acc, r) => {
    const cap = Math.max(1, r.capacityKg);
    return acc + (1 - r.availableKg / cap);
  }, 0) / safeEngineState.regions.length;

}, [safeEngineState.regions]);


// ======================================================
// REFS
// ======================================================

const directRef = useRef<HTMLDivElement | null>(null);
const renderGateRef = useRef(0);


// ======================================================
// SPATIAL FORESIGHT STATE
// ======================================================

const [cascadeRisk, setCascadeRisk] = useState(0);
const [heatmapIntensity, setHeatmapIntensity] = useState(0);
const [spatialDiffusionField, setSpatialDiffusionField] = useState(0);
const [spatialClusteringIndex, setSpatialClusteringIndex] = useState(0);


// ======================================================
// DERIVED — REGIONAL STRESS
// ======================================================

const regionalStress =
  !safeEngineState.regions?.length
    ? 0
    : safeEngineState.regions.reduce((acc, r) => {
        const cap = Math.max(1, r.capacityKg);
        return acc + (1 - r.availableKg / cap);
      }, 0) / safeEngineState.regions.length;


// ======================================================
// SHOCK PROPAGATION
// ======================================================

const propagatedShock = useMemo(() => (
  shockField * (0.7 + regionalStress * 0.3)
), [shockField, regionalStress]);




// ======================================================
// UNIFIED PRESSURE — FROM ENGINE SNAPSHOT (NO BRAIN IN REACT)
// ======================================================

const unifiedPressure =
  Number.isFinite(safeEngineState.unifiedPressure)
    ? safeEngineState.unifiedPressure
    : 0.4;


// ======================================================
// DERIVED — TOTAL AVAILABLE CAPACITY
// ======================================================

const totalAvailable = useMemo(() => {

  if (!safeEngineState.regions?.length) return 0;

  return safeEngineState.regions.reduce(
    (sum, r) => sum + r.availableKg,
    0
  );

}, [safeEngineState.regions]);


// ======================================================
// DECISION LAYER — SEMAPHORE (ENGINE DRIVEN)
// ======================================================

const semaphoreState =
  safeEngineState.liveDecision?.semaphore ?? "yellow"

// ======================================================
// DERIVED — CAPACITY CHART PATH
// ======================================================

const chartWidth = 300
const chartHeight = 80

const pathData = useMemo(() => {

  if (!stressHistory?.length) return ""

  return stressHistory
    .map((value, i) => {

      const x =
        (i / (stressHistory.length - 1)) * chartWidth

      const y =
        chartHeight - value * chartHeight

      return `${i === 0 ? "M" : "L"} ${x} ${y}`

    })
    .join(" ")

}, [stressHistory])
    


// ===== SIMULATION CLOCK (single source of time) =====

const [simTick, setSimTick] = useState(0);
const [decisionState, setDecisionState] = useState<any>(null)


// ===== BRAIN FIELD STATE =====

const [brainStress, setBrainStress] = useState(0);
const [brainConfidence, setBrainConfidence] = useState(1);
const [brainArousal, setBrainArousal] = useState(0);
const [brainNoise, setBrainNoise] = useState(0);
const [brainMode, setBrainMode] = useState<"calm" | "attentive" | "alert" | "locked">("calm");
const [brainMemory, setBrainMemory] = useState(0);
const [cognitiveHomeostasis, setCognitiveHomeostasis] = useState(0.5);
const [predictionError, setPredictionError] = useState(0);

// ===== ANTICIPATION STATE =====

const [supplyRiskForecast, setSupplyRiskForecast] = useState(0);
const [regionalStressGradient, setRegionalStressGradient] = useState(0);
const [consumptionMomentumForecast, setConsumptionMomentumForecast] = useState(0);
const [anticipatoryBuffer, setAnticipatoryBuffer] = useState(0);
const [explorationDrive, setExplorationDrive] = useState(0.3);

// ===== SCENARIO FEEDBACK STATE =====

const [anticipatoryPosture, setAnticipatoryPosture] = useState(0);
const [scenarioAlignment, setScenarioAlignment] = useState(0);
const [anticipatoryStressBias, setAnticipatoryStressBias] = useState(0);

// ===== ANTICIPATORY CONTROL STATE =====

const [preventiveBufferBias, setPreventiveBufferBias] = useState(0);
const [preventiveDampingBias, setPreventiveDampingBias] = useState(0);
const [preventiveResilienceBias, setPreventiveResilienceBias] = useState(0);
const [criticalResilienceSignal, setCriticalResilienceSignal] = useState(0);
const [metaStabilityEnergy, setMetaStabilityEnergy] = useState(0.6);
const [counterfactualSignal, setCounterfactualSignal] = useState(0);

// ===== GLOBAL COHERENCE =====
const [globalCoherence, setGlobalCoherence] = useState(0.7);

// ===== REGIONAL FORESIGHT =====

const [regionalForecast, setRegionalForecast] = useState<
  { name: string; stress: number; risk: number }[]
>([]);

// ===== LAGGED RESILIENCE REF ===== //
  const statusClass =
  semaphoreState === "green"
    ? "status-green"
    : semaphoreState === "yellow"
    ? "status-yellow"
    : "status-red"

// ======================================================
// ENGINE LOOP START
// ======================================================







// ======================================================
// ███████╗███╗   ██╗ ██████╗ ██╗███╗   ██╗███████╗
// ██╔════╝████╗  ██║██╔════╝ ██║████╗  ██║██╔════╝
// █████╗  ██╔██╗ ██║██║  ███╗██║██╔██╗ ██║█████╗
// ██╔══╝  ██║╚██╗██║██║   ██║██║██║╚██╗██║██╔══╝
// ███████╗██║ ╚████║╚██████╔╝██║██║ ╚████║███████╗
// ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝
// ======================================================
// 🔁 ENGINE BRIDGES — SINGLE SOURCE OF TRUTH LAYER
//
// Arquitectura oficial:
//
// React  ➜ Runtime   (updateEngineContext)  → INPUTS
// Runtime ➜ React    (subscribeEngine)      → SNAPSHOT
//
// El runtime es la única fuente de verdad dinámica.
// React NO evoluciona física — solo observa.
//
// ======================================================



// ======================================================
// 🔁 REACT ➜ RUNTIME — CONTEXT INJECTION
// Inyección unificada de señales externas.
// ======================================================

useEffect(() => {

  updateEngineContext({

    structuralDrift,
    thresholdMemory,
    attractorField,
    phaseSignal,

    bufferMargin,
    resilienceMemory,

    anticipatoryBuffer,
    scenarioField,
    predictiveHorizon,
    metaLearningRate,
    meaningField,
    counterfactualSignal,
    spatialClusteringIndex,

    simulationSpeed

  });

}, [])


// ===== MAIN EFFECT ===== //

useEffect(() => {

  if (typeof window === "undefined") return;

  const timeout = setTimeout(() => {
    setLoaded(true);
  }, 150);

  const handleScroll = () => {
    const y = window.scrollY;

    setScrolled(prev => {
      const next = y > 60;
      return prev === next ? prev : next;
    });

    setOffset(prev => {
      const next = 38 + y * 0.06;
      return Math.abs(prev - next) < 0.1 ? prev : next;
    });
  };

  window.addEventListener("scroll", handleScroll, { passive: true });

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        setDirectVisible(true);
      }
    },
    { threshold: 0.2 }
  );

  if (directRef.current) {
    observer.observe(directRef.current);
  }

  return () => {
    clearTimeout(timeout);
    window.removeEventListener("scroll", handleScroll);
    observer.disconnect();
  };

}, []);

  useEffect(() => {
    if (!isDragging) {
      setVolume(sliderValue);
    }
  }, [sliderValue, isDragging]);

  useEffect(() => {

  setSliderValue(0)

}, [])

const wasHighPressure = useRef(false);

useEffect(() => {

  const isHigh = unifiedPressure > 0.75;

  if (isHigh && !wasHighPressure.current) {

    setEvents(prev => [
      "High allocation pressure — balancing capacity",
      ...prev.slice(0, 4)
    ]);

  }

  wasHighPressure.current = isHigh;

}, [unifiedPressure]);

useEffect(() => {
  setSystemLoad(prev => {
    const next = averageUsage;
    return Math.abs(next - prev) > 0.0005 ? next : prev;
  });
}, [averageUsage]);


// Pressure signal narrativa
useEffect(() => {

  if (safeEngineState.pressureMomentum > 0.05) {
    setPressureSignal("Rapid escalation");
  } else if (safeEngineState.pressureMomentum > 0.02) {
    setPressureSignal("Pressure building");
  } else if (safeEngineState.pressureMomentum < -0.05) {
    setPressureSignal("Pressure easing");
  } else {
    setPressureSignal("Stabilizing");
  }

}, [safeEngineState.pressureMomentum]);


// ===== ALERT LEVEL WITH HYSTERESIS =====

useEffect(() => {

  let riskOn = 0.72;
  let riskOff = 0.65;

  let watchOn = 0.48;
  let watchOff = 0.42;

  if (riskPosture === "Defensive") {
    riskOn = 0.6;
    riskOff = 0.52;
    watchOn = 0.35;
    watchOff = 0.3;
  }

  if (riskPosture === "Expansion") {
    riskOn = 0.82;
    riskOff = 0.75;
    watchOn = 0.6;
    watchOff = 0.55;
  }

  setAlertLevel(prev => {

    // RISK state logic
    if (prev === "risk") {
      if (alertMemory < riskOff) return "watch";
      return "risk";
    }

    // WATCH state logic
    if (prev === "watch") {
      if (alertMemory >= riskOn) return "risk";
      if (alertMemory < watchOff) return "normal";
      return "watch";
    }

    // NORMAL state logic
    if (prev === "normal") {
      if (alertMemory >= riskOn) return "risk";
      if (alertMemory >= watchOn) return "watch";
      return "normal";
    }

    return prev;

  });

}, [alertMemory, riskPosture]);

useEffect(() => {
  // Stress basado en memoria real del sistema
  const probability = Math.min(
    100,
    Math.max(
      5,
      (alertMemory * 0.85 + Math.abs(safeEngineState.pressureMomentum) * 0.15) * 100
    )
  );

  setStressProbability(probability);

  // Trend basado en dinámica real
  if (safeEngineState.pressureMomentum > 0.01) {
    setTrend("rising");
    setSuggestion("Monitoring increasing demand signals");
  } else if (safeEngineState.pressureMomentum < -0.01) {
    setTrend("easing");
    setSuggestion("Supply conditions stabilizing");
  } else {
    setTrend("stable");
    setSuggestion("Operating within expected parameters");
  }

}, [alertMemory, safeEngineState.pressureMomentum]);


const lastNarrativeUpdate = useRef(0);
const lastNarrativeValue = useRef(narrativeInsight);

useEffect(() => {

  const now = Date.now();

  // no actualizar más de cada 2s
  if (now - lastNarrativeUpdate.current < 2000) return;

  let nextInsight;

  if (safeEngineState.shockLevel > 0.08) {

    nextInsight =
      "Unexpected supply disturbance detected — monitoring network resilience";

  } else if (unifiedPressure > 0.7) {

    nextInsight =
      "Elevated demand signals detected — monitoring allocation resilience";

  } else if (unifiedPressure > 0.4) {

    nextInsight =
      "Network balancing supply across regions — no immediate action required";

  } else {

    nextInsight =
      "Supply conditions remain stable with comfortable operating margins";

  }

  if (lastNarrativeValue.current !== nextInsight) {
  lastNarrativeValue.current = nextInsight;
  setNarrativeInsight(nextInsight);
}

lastNarrativeUpdate.current = now;

}, [unifiedPressure, safeEngineState.shockLevel]);



useEffect(() => {
  const stability =
    100 -
    (systemLoad * 40 +
      (latency - 9) * 2 +
      (1 - signalHealth) * 30);

  const clamped = Math.max(60, Math.min(100, stability));
  setStabilityIndex(clamped);

  if (clamped > 90) {
    setPosture("Nominal");
    setConfidenceSignal("High");
    setSystemMood("Calm");
  } else if (clamped > 75) {
    setPosture("Balanced");
    setConfidenceSignal("Moderate");
    setSystemMood("Attentive");
  } else {
    setPosture("Under pressure");
    setConfidenceSignal("Monitoring");
    setSystemMood("Focused");
  }
}, [systemLoad, latency, signalHealth]);

useEffect(() => {

  const pressureScore = unifiedPressure

  const confidence = Math.max(0.6, 1 - pressureScore)

  setConfidenceVector(prev => {
    if (Math.abs(prev - confidence) < 0.0001) return prev
    return confidence
  })

  if (pressureScore > 0.75) {

    setStrategicOutlook(prev =>
      prev === "High demand pressure detected"
        ? prev
        : "High demand pressure detected"
    )

    setOperationalPriority(prev =>
      prev === "Stabilize multi-region allocation"
        ? prev
        : "Stabilize multi-region allocation"
    )

    setSupplyOutlook(prev =>
      prev === "Short-term volatility possible"
        ? prev
        : "Short-term volatility possible"
    )

  } else if (pressureScore > 0.45) {

    setStrategicOutlook(prev =>
      prev === "Balanced expansion phase"
        ? prev
        : "Balanced expansion phase"
    )

    setOperationalPriority(prev =>
      prev === "Monitor producer responsiveness"
        ? prev
        : "Monitor producer responsiveness"
    )

    setSupplyOutlook(prev =>
      prev === "Supply steady with minor fluctuations"
        ? prev
        : "Supply steady with minor fluctuations"
    )

  } else {

    setStrategicOutlook(prev =>
      prev === "Stable trajectory"
        ? prev
        : "Stable trajectory"
    )

    setOperationalPriority(prev =>
      prev === "Maintain allocation cadence"
        ? prev
        : "Maintain allocation cadence"
    )

    setSupplyOutlook(prev =>
      prev === "Short-term supply secure"
        ? prev
        : "Short-term supply secure"
    )

  }

}, [unifiedPressure])

useEffect(() => {
  // Chart ahora sigue la memoria real del sistema
  const nextValue = Math.max(0, Math.min(1, alertMemory));

  setStressHistory(prev => [
    ...prev.slice(1),
    nextValue
  ]);

}, [alertMemory]);

// Stability memory
const systemDrift =
  unifiedPressure * 0.7 + (stressProbability / 100) * 0.3;

  




  const getSystemMessage = () => {
    if (volume <= 60) {
      return "Network stable — expansion capacity available";
    }

    if (volume <= 130) {
      return "Allocation pressure detected — monitoring producers";
    }

    return "Capacity threshold reached — routing constraints active";
  };


// ======================================================
// VISUAL STATUS — DRIVEN BY ENGINE DECISION
// ======================================================

const status = useMemo(() => {

  if (semaphoreState === "green") {
    return {
      color: "#4ade80",
      label: `${volume} kg ready for instant allocation`,
      glow: "rgba(74,222,128,0.35)"
    }
  }

  if (semaphoreState === "yellow") {
    return {
      color: "#facc15",
      label: `${volume} kg under capacity review`,
      glow: "rgba(250,204,21,0.35)"
    }
  }

  return {
    color: "#f87171",
    label: `${volume} kg exceeds safe capacity`,
    glow: "rgba(248,113,113,0.35)"
  }

}, [semaphoreState, volume])





return (
  <>

    {/* ONBOARDING */}
    {!user.onboardingCompleted && (
      <OnboardingWizard 
        user={user}
        onComplete={() => window.location.reload()}
      />
    )}

    {/* ====================================================== */}
    {/* HEADER PRO SaaS */}
    {/* ====================================================== */}
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "70px",
        background: "rgba(11,15,15,0.85)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 40px",
        zIndex: 1000
      }}
    >

     {/* LEFT */}
<div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
  
  {/* LOGO */}
  <div style={{ display: "flex", alignItems: "center" }}>
    <Image
      src="/images/logo-altura-gold-final.png"
      alt="Altura Collective"
      width={140}
      height={40}
      style={{ objectFit: "contain" }}
    />
  </div>

  {/* NAV */}
  <div style={{ display: "flex", gap: "20px", fontSize: "14px", color: "#aaa" }}>
    <span style={{ color: "white" }}>Dashboard</span>

    <span
      style={{ cursor: "pointer" }}
      onClick={() => router.push("/contracts")}
    >
      Contracts
    </span>

    <span style={{ cursor: "pointer" }}>Settings</span>
  </div>

  <span
  style={{ cursor: "pointer" }}
  onClick={() => router.push("/")}
>
  Marketplace
</span>

</div>

{/* RIGHT */}
<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
  
  <div style={{ fontSize: "14px", color: "#ccc" }}>
    {user?.email}
  </div>

  <div style={{
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#4ade80"
  }} />

  <button
    onClick={async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      })
      window.location.href = "/"
    }}
    style={{
      padding: "6px 12px",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,0.2)",
      background: "transparent",
      color: "white",
      cursor: "pointer"
    }}
  >
    Logout
  </button>

</div>

</div> {/* ← ESTE ES EL CIERRE DEL HEADER */}

{/* ====================================================== */}
{/* MAIN DASHBOARD */}
{/* ====================================================== */}
<div
  style={{
    minHeight: "100vh",
    background: "#0b0f0f",
    color: "white",
    paddingTop: "120px"
  }}
>

  {/* TITLE */}
  <div style={{ padding: "0 80px" }}>
    <h2 style={{
      fontWeight: 300,
      marginBottom: "40px"
    }}>
      Client Dashboard
    </h2>
  </div>

  {/* SUCCESS MESSAGE */}
  {showMessage && (
    <div
      style={{
        margin: "0 80px 30px 80px",
        padding: "16px 22px",
        borderRadius: 12,
        background: "rgba(74,222,128,0.1)",
        border: "1px solid rgba(74,222,128,0.3)",
        color: "#4ade80"
      }}
    >
      Contract activated successfully.
    </div>
  )}

  {/* GRID */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "2fr 1fr",
      gap: "60px",
      padding: "0 80px"
    }}
  >

    {/* LEFT */}
    <ClientTradingPanel
      key={searchParams?.toString?.() || "default"}
      engineState={engineState}
      updateContext={updateEngineContext}
    />

    {/* RIGHT */}
    <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
      <ClientOverviewPanel engineState={engineState} />
      <ClientContractsPanel contracts={contracts} />
    </div>

  </div>

</div>

</>
)
}