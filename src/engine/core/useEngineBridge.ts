"use client";

import { useEffect, useRef, useState } from "react";
import {
  subscribeEngine,
  updateEngineContext,
  getInitialEngineState,
  type EngineState
} from "./runtime";

type BridgeInputs = {
  unifiedPressure: number;
  adaptiveResilience: number;
  structuralDrift: number;
  stressScar: number;
  thresholdMemory: number;
  attractorField: number;
  phaseSignal: number;
  bufferMargin: number;
  resilienceMemory: number;
  collapseProbability: number;
  anticipatoryBuffer: number;
  scenarioField: number;
  predictiveHorizon: number;
  metaLearningRate: number;
  meaningField: number;
  counterfactualSignal: number;
  spatialClusteringIndex: number;
  ewsScore: number;
};

type BridgeOutputs = {
  onEngineTick?: (state: EngineState) => void;
};

export function useEngineBridge(
  inputs: BridgeInputs,
  outputs?: BridgeOutputs
) {

  const [engineState, setEngineState] =
    useState<EngineState>(getInitialEngineState());

  const startedRef = useRef(false);

  // =====================================================
  // CONTEXT BRIDGE — React → Runtime
  // =====================================================

  useEffect(() => {

    updateEngineContext({
      adaptiveResilience: inputs.adaptiveResilience,
      structuralDrift: inputs.structuralDrift,
      thresholdMemory: inputs.thresholdMemory,
      attractorField: inputs.attractorField,
      phaseSignal: inputs.phaseSignal,
      bufferMargin: inputs.bufferMargin,
      resilienceMemory: inputs.resilienceMemory,
      collapseProbability: inputs.collapseProbability,
      anticipatoryBuffer: inputs.anticipatoryBuffer,
      scenarioField: inputs.scenarioField,
      predictiveHorizon: inputs.predictiveHorizon,
      metaLearningRate: inputs.metaLearningRate,
      meaningField: inputs.meaningField,
      counterfactualSignal: inputs.counterfactualSignal,
      spatialClusteringIndex: inputs.spatialClusteringIndex,
      ewsScore: inputs.ewsScore
    });

  }, [
    inputs.adaptiveResilience,
    inputs.structuralDrift,
    inputs.thresholdMemory,
    inputs.attractorField,
    inputs.phaseSignal,
    inputs.bufferMargin,
    inputs.resilienceMemory,
    inputs.collapseProbability,
    inputs.anticipatoryBuffer,
    inputs.scenarioField,
    inputs.predictiveHorizon,
    inputs.metaLearningRate,
    inputs.meaningField,
    inputs.counterfactualSignal,
    inputs.spatialClusteringIndex,
    inputs.ewsScore
  ]);

  // =====================================================
  // RUNTIME → REACT SUBSCRIPTION
  // =====================================================

  useEffect(() => {

  const unsubscribe = subscribeEngine((snapshot) => {

    setEngineState(prev => {

      if (prev.engineTime === snapshot.engineTime) {
        return prev;
      }

      return snapshot;

    });

  });

  return () => {
    unsubscribe();
  };

}, []);
}