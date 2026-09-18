"use client";

import { useState, useCallback } from "react";
import type { OceanLayerState } from "@/types/globe";

export function useGlobeLayers() {
  const [layers, setLayers] = useState<OceanLayerState>({
    argoFloats: true,
    temperatureHeatmap: false,
    salinityOverlay: false,
    currentsVector: false,
    bathymetry: false,
  });

  const toggleLayer = useCallback((layerKey: keyof OceanLayerState) => {
    setLayers((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }));
  }, []);

  const applyLayers = useCallback((newLayers: OceanLayerState) => {
    setLayers(newLayers);
  }, []);

  return {
    layers,
    setLayers,
    applyLayers,
    toggleLayer,
  };
}
