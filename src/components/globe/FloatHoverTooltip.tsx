"use client";

import React from "react";
import type { ArgoFloat } from "@/types/globe";

interface FloatHoverTooltipProps {
  float: ArgoFloat | null;
  position: { x: number; y: number } | null;
  visible: boolean;
}

export function FloatHoverTooltip({
  float,
  position,
  visible,
}: FloatHoverTooltipProps) {
  if (!float || !position) return null;

  const latText =
    float.latitude >= 0
      ? `${float.latitude.toFixed(1)}° N`
      : `${Math.abs(float.latitude).toFixed(1)}° S`;

  const lonText =
    float.longitude >= 0
      ? `${float.longitude.toFixed(1)}° E`
      : `${Math.abs(float.longitude).toFixed(1)}° W`;

  const isDeep = float.maxDepth === 6000;
  const statusColor = isDeep ? "bg-purple-400" : "bg-emerald-400";
  const badgeBorder = isDeep
    ? "border-purple-500/30 text-purple-300"
    : "border-cyan-500/30 text-cyan-300";

  return (
    <div
      className={`pointer-events-none absolute z-40 transition-all duration-150 ease-out ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      style={{
        left: `${Math.round(position.x)}px`,
        top: `${Math.round(position.y - 12)}px`,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div className="relative min-w-[170px] max-w-[220px] rounded-xl border border-[#1a2a40]/90 bg-[#060d1a]/95 px-3 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.7)] backdrop-blur-md">
        {/* Glow indicator line */}
        <div
          className={`absolute -top-px left-3 right-3 h-[1.5px] ${isDeep
            ? "bg-gradient-to-r from-transparent via-purple-500 to-transparent"
            : "bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
            }`}
        />

        {/* Top row: Name/WMO & status tag */}
        <div className="flex items-center justify-between gap-1.5 pb-1">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${statusColor}`}
              />
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${statusColor}`}
              />
            </span>
            <span className="font-mono text-[11px] font-bold tracking-tight text-[#ececec]">
              ARGO {float.wmoId}
            </span>
          </div>

          <span
            className={`rounded-full border px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-wider ${badgeBorder}`}
          >
            {isDeep ? "Deep" : "Active"}
          </span>
        </div>

        {/* Coordinates line */}
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#93c5fd]">
          <span>{latText}</span>
          <span className="text-[#384a60]">,</span>
          <span>{lonText}</span>
        </div>

        {/* Depth & Telemetry stats */}
        <div className="mt-1.5 flex items-center justify-between border-t border-[#1a2a40]/70 pt-1.5 font-mono text-[10px]">
          <span className="text-[#8e8e8e]">Depth</span>
          <span className="font-semibold text-[#ececec]">
            {float.maxDepth.toLocaleString()} m
          </span>
        </div>

        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-[#8e8e8e]">Temp / Sal</span>
          <span className="text-[#00d2ff]">
            {float.surfaceTemp.toFixed(1)}°C · {float.surfaceSalinity.toFixed(1)}
          </span>
        </div>

        {/* Tooltip pointer arrow pointing down */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 border-b border-r border-[#1a2a40] bg-[#060d1a]" />
      </div>
    </div>
  );
}
