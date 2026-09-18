"use client";

import React, { useState } from "react";
import type { OceanLayerState } from "@/types/globe";

export type LayerId = "argo" | "sst" | "salinity" | "currents" | "bathymetry";

interface LayerItemDef {
  id: LayerId;
  key: keyof OceanLayerState;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const LAYER_CONFIG: LayerItemDef[] = [
  {
    id: "argo",
    key: "argoFloats",
    title: "Active ARGO Float Pins",
    desc: "3D interactive markers for autonomous ocean profiling floats",
    icon: (
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00d2ff] opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-[#00d2ff]" />
      </span>
    ),
  },
  {
    id: "sst",
    key: "temperatureHeatmap",
    title: "Sea Surface Temperature (SST)",
    desc: "Global ocean thermal gradient overlay (°C)",
    icon: <span className="h-3 w-3 rounded-full bg-amber-400" />,
  },
  {
    id: "salinity",
    key: "salinityOverlay",
    title: "Salinity Anomaly Overlay",
    desc: "Surface freshwater vs saline concentration zones (PSU)",
    icon: <span className="h-3 w-3 rounded-full bg-cyan-400" />,
  },
  {
    id: "currents",
    key: "currentsVector",
    title: "Geostrophic Currents Vectors",
    desc: "Surface current velocity vectors and oceanic gyres",
    icon: <span className="h-3 w-3 rounded-full bg-sky-400" />,
  },
  {
    id: "bathymetry",
    key: "bathymetry",
    title: "Bathymetry & Seafloor Relief",
    desc: "3D oceanic ridge and trench relief shading",
    icon: <span className="h-3 w-3 rounded-full bg-indigo-400" />,
  },
];

interface OceanLayerControlProps {
  isOpen: boolean;
  onClose: () => void;
  layers: OceanLayerState;
  onToggleLayer?: (layerKey: keyof OceanLayerState) => void;
  onApplyLayers?: (appliedLayers: OceanLayerState) => void;
}

export function OceanLayerControl({
  isOpen,
  onClose,
  layers,
  onToggleLayer,
  onApplyLayers,
}: OceanLayerControlProps) {
  // Local draft state initialized strictly from applied layers
  const [prevLayers, setPrevLayers] = useState(layers);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [draftLayers, setDraftLayers] = useState<OceanLayerState>(layers);

  // Sync draft state with currently applied layers when opened or when layers prop changes
  if (isOpen !== prevIsOpen || layers !== prevLayers) {
    setPrevIsOpen(isOpen);
    setPrevLayers(layers);
    if (isOpen) {
      setDraftLayers(layers);
    }
  }

  if (!isOpen) return null;

  const handleToggle = (id: LayerId) => {
    const item = LAYER_CONFIG.find((l) => l.id === id);
    if (!item) return;
    setDraftLayers((prev) => ({
      ...prev,
      [item.key]: !prev[item.key],
    }));
  };

  const handleApply = () => {
    if (onApplyLayers) {
      onApplyLayers(draftLayers);
    } else if (onToggleLayer) {
      (Object.keys(draftLayers) as (keyof OceanLayerState)[]).forEach((key) => {
        if (draftLayers[key] !== layers[key]) {
          onToggleLayer(key);
        }
      });
    }
    onClose();
  };

  const handleClose = () => {
    // Discard any unapplied toggles and restore to active layers
    setDraftLayers(layers);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[#1a2f4c] bg-[#061224]/95 p-6 shadow-2xl backdrop-blur-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="flex items-center justify-between border-b border-[#1a2f4c] pb-4">
          <div className="flex items-center gap-2.5">
            <svg
              className="h-5 w-5 text-[#00d2ff]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <h2 className="text-lg font-bold text-[#ececec] tracking-wide font-sans">
              Ocean Data Layers
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8e8e] hover:bg-[#0a1e38] hover:text-[#ececec] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Layer Toggles List */}
        <div className="mt-4 flex flex-col gap-3">
          {LAYER_CONFIG.map((item) => {
            const isActive = draftLayers[item.key] === true;
            return (
              <div
                key={item.id}
                id={`layer-toggle-${item.id}`}
                onClick={() => handleToggle(item.id)}
                className={`flex items-center justify-between rounded-xl border p-3.5 transition-all cursor-pointer ${
                  isActive
                    ? "border-[#00d2ff]/50 bg-[#0a1e38]/80 shadow-[0_0_15px_rgba(0,210,255,0.08)]"
                    : "border-[#1a2f4c] bg-[#030a16] hover:border-[#2a4365]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{item.icon}</div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[#ececec]">
                      {item.title}
                    </span>
                    <span className="text-xs text-[#8ea9c7] leading-tight">
                      {item.desc}
                    </span>
                  </div>
                </div>

                {/* Switch Toggle UI */}
                <div
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    isActive ? "bg-[#00d2ff]" : "bg-[#1e293b]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            id="btn-apply-layers"
            onClick={handleApply}
            className="rounded-lg bg-[#00d2ff] px-5 py-2 text-xs font-bold text-[#020814] transition-all hover:bg-[#38bdf8] shadow-[0_0_15px_rgba(0,210,255,0.4)] cursor-pointer"
          >
            Apply Layers
          </button>
        </div>
      </div>
    </div>
  );
}
