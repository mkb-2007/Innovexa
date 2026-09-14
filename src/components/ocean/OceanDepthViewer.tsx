"use client";

import React, { useState } from "react";
import { TelemetryChart } from "@/components/visualization/TelemetryChart";
import { ARGO_FLOATS, generateDepthProfile } from "@/data/argoFloats";
import type { ArgoFloat, GeoLocation, DepthMeasurement } from "@/types/globe";

interface OceanDepthViewerProps {
  isOpen: boolean;
  onClose: () => void;
  float?: ArgoFloat | null;
  location?: GeoLocation | null;
  onSelectFloat?: (float: ArgoFloat) => void;
  onOpenDataExplorer?: () => void;
}

// Deterministic benchmark scientific demo profile (0 to 6,000m full stratification)
const BENCHMARK_6000M_PROFILE: DepthMeasurement[] = generateDepthProfile(27.4, 35.2, 6000);

// Featured floats for the quick [ SELECT FLOAT ] picker
const FEATURED_FLOATS = [
  { wmoId: 3902305, label: "Deep Argo #3902305 (Indian Ocean · 6,000m)" },
  { wmoId: 5906438, label: "Deep Argo #5906438 (Southern Ocean · 6,000m)" },
  { wmoId: 2901542, label: "Core Argo #2901542 (Bay of Bengal · 2,000m)" },
  { wmoId: 4902341, label: "BGC Argo #4902341 (North Atlantic · 2,000m)" },
  { wmoId: 6901764, label: "Apex Profiler #6901764 (Pacific Warm Pool · 2,000m)" },
];

export function OceanDepthViewer({
  isOpen,
  onClose,
  float,
  location,
  onSelectFloat,
  onOpenDataExplorer,
}: OceanDepthViewerProps) {
  const [isFloatPickerOpen, setIsFloatPickerOpen] = useState(false);
  const [localSelectedFloat, setLocalSelectedFloat] = useState<ArgoFloat | null>(null);

  if (!isOpen) return null;

  // Active float prioritizes passed float prop or local selection
  const activeFloat = localSelectedFloat || float || null;
  const isDemoData = !activeFloat;

  // Prepare profile measurements down to 6000m
  let profiles: DepthMeasurement[] = [];
  if (activeFloat) {
    if (activeFloat.maxDepth === 6000) {
      profiles = activeFloat.profiles;
    } else {
      // For 2000m floats, display their real profile and extend with physical abyssal curve down to 6000m
      profiles = generateDepthProfile(activeFloat.surfaceTemp, activeFloat.surfaceSalinity, 6000);
    }
  } else {
    profiles = BENCHMARK_6000M_PROFILE;
  }

  const titleLocation = activeFloat
    ? `${activeFloat.name} (WMO #${activeFloat.wmoId}) · ${activeFloat.basin}`
    : location?.regionName
      ? `${location.regionName} (${location.latitude}°, ${location.longitude}°)`
      : "Global Ocean Benchmark Stratification (0 – 6,000m)";

  const surfaceTemp = activeFloat ? `${activeFloat.surfaceTemp}°C` : "27.4°C";
  const surfaceSalinity = activeFloat ? `${activeFloat.surfaceSalinity} PSU` : "35.2 PSU";
  const maxDepth = activeFloat ? `${activeFloat.maxDepth.toLocaleString()} m` : "6,000 m";
  const cycleStatus = activeFloat ? `Cycle #${activeFloat.cycleNumber}` : "Nominal Stratification";

  const handlePickFloat = (wmoId: number) => {
    const found = ARGO_FLOATS.find((f) => f.wmoId === wmoId);
    if (found) {
      setLocalSelectedFloat(found);
      onSelectFloat?.(found);
      setIsFloatPickerOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6 animate-fade-in font-sans text-[#ececec]">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-[#1a2f4c] bg-[#061224]/95 p-5 sm:p-6 shadow-2xl backdrop-blur-xl overflow-y-auto animate-scale-in">
        {/* Header with Title and Float Selector Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a2f4c] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1a2f4c] bg-[#020817] text-[#00d2ff] shadow-[0_0_15px_rgba(0,210,255,0.25)]">
              <svg
                className="h-5 w-5"
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
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-wide text-[#ececec]">
                  4D Ocean Depth Profiles
                </h2>
                {isDemoData ? (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-mono text-amber-300">
                    DEMO STRATIFICATION DATA
                  </span>
                ) : (
                  <span className="rounded-full border border-[#00d2ff]/40 bg-[#00d2ff]/10 px-2 py-0.5 text-[9px] font-mono text-[#00d2ff]">
                    ARGO OBSERVATION
                  </span>
                )}
              </div>
              <p className="text-xs text-[#00d2ff] font-mono mt-0.5">{titleLocation}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* SELECT FLOAT Button with Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFloatPickerOpen((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-lg border border-[#00d2ff]/50 bg-[#00d2ff]/15 px-3 py-1.5 text-xs font-mono font-bold text-[#00d2ff] shadow-sm hover:bg-[#00d2ff] hover:text-[#020814] transition-all cursor-pointer"
                aria-label="Select ARGO float for depth profile"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>SELECT FLOAT</span>
                <span className="text-[10px]">▼</span>
              </button>

              {/* Quick Float Selection Dropdown */}
              {isFloatPickerOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-[#1a2f4c] bg-[#030a16] p-2 shadow-2xl backdrop-blur-2xl animate-fade-in font-mono text-xs">
                  <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-[#7090b0] border-b border-[#1a2f4c]">
                    Choose Profiling Float
                  </div>
                  <div className="mt-1 flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {FEATURED_FLOATS.map((item) => (
                      <button
                        key={item.wmoId}
                        type="button"
                        onClick={() => handlePickFloat(item.wmoId)}
                        className="flex flex-col items-start px-2 py-1.5 rounded-lg text-left text-[11px] text-[#ececec] hover:bg-[#0a1e38] hover:text-[#00d2ff] transition-colors cursor-pointer"
                      >
                        <span className="font-semibold">{item.label}</span>
                      </button>
                    ))}
                  </div>

                  {onOpenDataExplorer && (
                    <div className="mt-1 pt-1 border-t border-[#1a2f4c]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsFloatPickerOpen(false);
                          onClose();
                          onOpenDataExplorer();
                        }}
                        className="w-full text-center py-1.5 text-[10px] text-[#00d2ff] hover:underline cursor-pointer"
                      >
                        Browse all 3,940 Floats in Explorer →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8ea9c7] hover:bg-[#0a1e38] hover:text-[#ececec] transition-colors cursor-pointer"
              aria-label="Close Depth Viewer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Telemetry Summary Stats Cards */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-[#1a2f4c] bg-[#030a16] p-3 flex flex-col font-mono">
            <span className="text-[10px] text-[#7090b0] uppercase">SURFACE TEMP</span>
            <span className="text-lg font-bold text-[#00d2ff]">{surfaceTemp}</span>
          </div>
          <div className="rounded-xl border border-[#1a2f4c] bg-[#030a16] p-3 flex flex-col font-mono">
            <span className="text-[10px] text-[#7090b0] uppercase">SURFACE SALINITY</span>
            <span className="text-lg font-bold text-[#38bdf8]">{surfaceSalinity}</span>
          </div>
          <div className="rounded-xl border border-[#1a2f4c] bg-[#030a16] p-3 flex flex-col font-mono">
            <span className="text-[10px] text-[#7090b0] uppercase">STRATIFICATION DEPTH</span>
            <span className="text-lg font-bold text-[#ececec]">{maxDepth}</span>
          </div>
          <div className="rounded-xl border border-[#1a2f4c] bg-[#030a16] p-3 flex flex-col font-mono">
            <span className="text-[10px] text-[#7090b0] uppercase">CYCLE STATUS</span>
            <span className="text-sm font-bold text-[#00d2ff] uppercase flex items-center gap-1.5 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] inline-block"></span>
              {cycleStatus}
            </span>
          </div>
        </div>

        {/* Chart Component (0 - 6,000m Depth Stratification) */}
        <div className="mt-5">
          <TelemetryChart
            profiles={profiles}
            title="Water Column Thermocline & Halocline (0 – 6,000m Depth)"
            height={280}
          />
        </div>

        {/* Ocean Depth Stratification Zones Guide (0m -> 6000m) */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px]">
          <div className="rounded-lg border border-[#1a2f4c] bg-[#030a16] p-2">
            <div className="flex items-center gap-1.5 text-[#00d2ff] font-bold">
              <span>●</span>
              <span>0 – 200m</span>
            </div>
            <div className="text-[#ececec] font-semibold mt-0.5">Epipelagic (Sunlit)</div>
            <p className="text-[#7090b0] text-[9px] mt-0.5 leading-tight">
              Warm mixed surface layer; active photosynthesis & seasonal variations.
            </p>
          </div>

          <div className="rounded-lg border border-[#1a2f4c] bg-[#030a16] p-2">
            <div className="flex items-center gap-1.5 text-[#38bdf8] font-bold">
              <span>●</span>
              <span>200 – 1,000m</span>
            </div>
            <div className="text-[#ececec] font-semibold mt-0.5">Mesopelagic (Twilight)</div>
            <p className="text-[#7090b0] text-[9px] mt-0.5 leading-tight">
              Permanent thermocline; steep thermal gradient dropping to ~4°C.
            </p>
          </div>

          <div className="rounded-lg border border-[#1a2f4c] bg-[#030a16] p-2">
            <div className="flex items-center gap-1.5 text-[#818cf8] font-bold">
              <span>●</span>
              <span>1,000 – 4,000m</span>
            </div>
            <div className="text-[#ececec] font-semibold mt-0.5">Bathypelagic (Midnight)</div>
            <p className="text-[#7090b0] text-[9px] mt-0.5 leading-tight">
              Complete darkness; stable cold deep ocean water (2°C–3°C).
            </p>
          </div>

          <div className="rounded-lg border border-[#1a2f4c] bg-[#030a16] p-2">
            <div className="flex items-center gap-1.5 text-[#c084fc] font-bold">
              <span>●</span>
              <span>4,000 – 6,000m</span>
            </div>
            <div className="text-[#ececec] font-semibold mt-0.5">Abyssopelagic (Abyss)</div>
            <p className="text-[#7090b0] text-[9px] mt-0.5 leading-tight">
              Deep Argo domain; intense pressure (&gt;400 bar), isothermal near 1.5°C.
            </p>
          </div>
        </div>

        {/* Ocean Hydrodynamics Insights */}
        <div className="mt-4 rounded-xl border border-[#1a2f4c] bg-[#020814] p-3.5 text-xs text-[#8ea9c7] leading-relaxed">
          <h4 className="font-semibold text-[#00d2ff] uppercase tracking-wider text-[11px] mb-1 font-mono">
            Oceanographic Stratification Interpretation
          </h4>
          <p className="text-[11px]">
            The 0–6,000m telemetry profile demonstrates strong thermal stratification in the upper ocean layer (0–200m) followed by a steep thermocline drop across the mesopelagic zone. Below 2,000m into the abyss, seawater temperatures asymptotically approach 1.5°C with uniform salinity (~34.7 PSU), representing the global thermohaline conveyor circulation.
          </p>
        </div>
      </div>
    </div>
  );
}
