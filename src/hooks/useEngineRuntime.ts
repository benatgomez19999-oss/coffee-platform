"use client"

import { useEffect, useRef, useState } from "react"

import {
  startEngineRuntime,
  subscribeEngine,
  updateEngineContext,
  getInitialEngineState,
  type EngineState
} from "@/engine/runtime"

import { getEngineContext } from "@/engine/runtime"
import { updateCommodityPrices }
from "@/AI/market/CommodityPriceEngine"

// =====================================================
// AI SYSTEM
// =====================================================

import { runAISystem } from "@/AI/orchestration/runAISystem"

// =====================================================
// ENGINE ↔ REACT BRIDGE (SINGLE ENTRY POINT)
// =====================================================

export function useEngineRuntime() {

  // -----------------------------------------------------
  // REACT SNAPSHOT STATE
  // -----------------------------------------------------

  const [engineState, setEngineState] =
    useState<EngineState>(getInitialEngineState())

  // -----------------------------------------------------
  // ENGINE START GUARD
  // -----------------------------------------------------

  const startedRef = useRef(false)

  // -----------------------------------------------------
  // STATE REF
  // Permite acceder al último estado dentro de intervals
  // -----------------------------------------------------

  const stateRef = useRef<EngineState>(engineState)

  useEffect(() => {

    stateRef.current = engineState

  }, [engineState])


  useEffect(() => {

    // -----------------------------------------------------
    // START ENGINE (ONLY ONCE)
    // -----------------------------------------------------

    if (!startedRef.current) {

      startEngineRuntime()
      startedRef.current = true

    }

    // -----------------------------------------------------
    // ENGINE SNAPSHOT SUBSCRIPTION
    // -----------------------------------------------------

    const unsubscribe = subscribeEngine((snapshot) => {

      setEngineState(snapshot)

    })

    // -----------------------------------------------------
// AI SYSTEM LOOP
// Ejecuta inteligencia externa periódicamente
// -----------------------------------------------------

const aiInterval = setInterval(() => {

  const currentState = stateRef.current

  if (!currentState) return

  const input = {

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

  }

  runAISystem(
  currentState,
  getEngineContext(),
  input
)

setEngineState({ ...currentState })

}, 5000)

    // -----------------------------------------------------
    // CLEANUP
    // -----------------------------------------------------

    return () => {

      unsubscribe()
      clearInterval(aiInterval)

    }

  }, [])


  // -----------------------------------------------------
  // EXPOSE ENGINE
  // -----------------------------------------------------

  return {

    state: engineState,
    updateContext: updateEngineContext

  }

}