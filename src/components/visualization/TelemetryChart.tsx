"use client";

import React, { useState } from "react";
import type { DepthMeasurement } from "@/types/globe";

interface TelemetryChartProps {
  profiles: DepthMeasurement[];
  title?: string;
  height?: number;
}

export function TelemetryChart({
  profiles,
  title = "Depth Telemetry Profile (0 - 2000m)",
  height = 240,
}: TelemetryChartProps) {
  const [activeTab, setActiveTab] = useState<"temp" | "salinity">("temp");
  const [hoveredPoint, setHoveredPoint] = useState<DepthMeasurement | null>(null);

  if (!profiles || profiles.length === 0) return null;

  const width = 500;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 40;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const maxDepth = Math.max(...profiles.map((p) => p.depth), 2000);
  const minDepth = 0;

  const values = profiles.map((p) =>
    activeTab === "temp" ? p.temperature : p.salinity
  );
  const minVal = Math.floor(Math.min(...values) - 1);
  const maxVal = Math.ceil(Math.max(...values) + 1);

  const getX = (val: number) => {
    return paddingLeft + ((val - minVal) / (maxVal - minVal)) * chartW;
  };
  const getY = (depth: number) => {
    return paddingTop + ((depth - minDepth) / (maxDepth - minDepth)) * chartH;
  };

  const pointsString = profiles
    .map((p) => {
      const val = activeTab === "temp" ? p.temperature : p.salinity;
      return `${getX(val)},${getY(p.depth)}`;
    })
    .join(" ");

  const colorHex = activeTab === "temp" ? "#00d2ff" : "#38bdf8";

  const depthTicks =
    maxDepth > 2000
      ? [0, 500, 1000, 2000, 4000, 6000]
      : [0, 500, 1000, 1500, 2000];

  return (
    <div className="flex flex-col w-full rounded-xl border border-[#1a2f4c] bg-[#061224]/90 p-4 shadow-xl backdrop-blur-md">
      {/* Header & Metric Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold tracking-wider text-[#ececec] uppercase font-mono">
          {title}
        </span>
        <div className="flex items-center rounded-lg bg-[#020817] p-0.5 border border-[#1a2f4c]">
          <button
            type="button"
            onClick={() => setActiveTab("temp")}
            className={`px-3 py-1 text-[11px] font-mono font-medium rounded-md transition-all cursor-pointer ${activeTab === "temp"
                ? "bg-[#00d2ff] text-[#020814] shadow-sm font-bold"
                : "text-[#8ea9c7] hover:text-[#ececec]"
              }`}
          >
            Temperature (°C)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("salinity")}
            className={`px-3 py-1 text-[11px] font-mono font-medium rounded-md transition-all cursor-pointer ${activeTab === "salinity"
                ? "bg-[#38bdf8] text-[#020814] shadow-sm font-bold"
                : "text-[#8ea9c7] hover:text-[#ececec]"
              }`}
          >
            Salinity (PSU)
          </button>
        </div>
      </div>

      {/* SVG Depth Curve Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible font-mono text-[10px]"
        >
          {/* Depth Grid Lines */}
          {depthTicks.map((d) => {
            const y = getY(d);
            return (
              <g key={d}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#162942"
                  strokeDasharray="3 3"
                />
                <text x={paddingLeft - 8} y={y + 3} textAnchor="end" fill="#8ea9c7">
                  {d}m
                </text>
              </g>
            );
          })}

          {/* Metric Value X-Axis Labels */}
          {Array.from({ length: 5 }).map((_, i) => {
            const val = minVal + (i * (maxVal - minVal)) / 4;
            const x = getX(val);
            return (
              <text
                key={i}
                x={x}
                y={height - 10}
                textAnchor="middle"
                fill="#8e8e8e"
              >
                {val.toFixed(1)}
              </text>
            );
          })}

          {/* Polyline Path */}
          <polyline
            fill="none"
            stroke={colorHex}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsString}
          />

          {/* Data Points */}
          {profiles.map((p) => {
            const val = activeTab === "temp" ? p.temperature : p.salinity;
            const cx = getX(val);
            const cy = getY(p.depth);
            const isHovered = hoveredPoint?.depth === p.depth;

            return (
              <circle
                key={p.depth}
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 3.5}
                fill={colorHex}
                stroke="#212121"
                strokeWidth="1.5"
                className="cursor-pointer transition-all hover:scale-125"
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-2 right-2 rounded-lg border border-[#1a2f4c] bg-[#061224]/95 p-2 font-mono text-[11px] text-[#ececec] shadow-xl backdrop-blur-md">
            <div>Depth: <span className="text-[#00d2ff] font-bold">{hoveredPoint.depth}m</span></div>
            <div>Temp: <span className="text-[#00d2ff] font-bold">{hoveredPoint.temperature}°C</span></div>
            <div>Salinity: <span className="text-[#38bdf8] font-bold">{hoveredPoint.salinity} PSU</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
