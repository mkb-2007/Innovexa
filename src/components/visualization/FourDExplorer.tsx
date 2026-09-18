"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ExplorerContext } from "@/types/globe";

const FourDOceanWebGLView = dynamic(
  () => import("./FourDOceanWebGLView").then((mod) => mod.FourDOceanWebGLView),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[360px] rounded-xl border border-[#1a2f4c] bg-[#020713] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#00d2ff] border-t-transparent animate-spin" />
        <span className="text-[11px] font-mono text-[#6b8aad]">Initializing 4D WebGL Ocean Model...</span>
      </div>
    ),
  }
);
import {
  generate4DGrid,
  getHeatmapGrid,
  getDepthProfile,
  getTimeSeries,
  scientificColorScale,
  monthName,
} from "@/data/fourDData";

type TabKey = "map" | "depth" | "timeseries" | "profile";

interface FourDExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  context: ExplorerContext;
}

export function FourDExplorer({ isOpen, onClose, context }: FourDExplorerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("map");
  const [parameter, setParameter] = useState(context.parameter);
  const [selectedYear, setSelectedYear] = useState(context.startYear + Math.floor((context.endYear - context.startYear) / 2));
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDepth, setSelectedDepth] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate data grid
  const grid = useMemo(
    () => generate4DGrid(context.region, context.startYear, context.endYear, context.maxDepth),
    [context.region, context.startYear, context.endYear, context.maxDepth]
  );



  // Depth profile data
  const depthProfileData = useMemo(
    () => getDepthProfile(grid, selectedYear, selectedMonth, parameter),
    [grid, selectedYear, selectedMonth, parameter]
  );

  // Time series data
  const timeSeriesData = useMemo(
    () => getTimeSeries(grid, selectedDepth, parameter),
    [grid, selectedDepth, parameter]
  );

  // Current value at selected point
  const currentValue = useMemo(() => {
    const point = grid.data.find(
      (d) => d.year === selectedYear && d.month === selectedMonth && d.depth === (grid.depths.reduce((prev, curr) =>
        Math.abs(curr - selectedDepth) < Math.abs(prev - selectedDepth) ? curr : prev
      ))
    );
    if (parameter === "Pressure (dbar)") return Math.round(selectedDepth * 1.01);
    if (!point) return null;
    return parameter === "Salinity (PSU)" ? point.salinity : point.temperature;
  }, [grid, selectedYear, selectedMonth, selectedDepth, parameter]);

  // Playback animation
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      if (playRef.current) clearInterval(playRef.current);
      playRef.current = null;
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playRef.current = setInterval(() => {
        setSelectedMonth((prev) => {
          if (prev >= 12) {
            setSelectedYear((y) => {
              if (y >= context.endYear) return context.startYear;
              return y + 1;
            });
            return 1;
          }
          return prev + 1;
        });
      }, 300);
    }
  }, [isPlaying, context.startYear, context.endYear]);

  useEffect(() => {
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, []);

  // Reset parameter when context changes
  const [prevContext, setPrevContext] = useState(context);
  if (context !== prevContext) {
    setPrevContext(context);
    setParameter(context.parameter);
    setSelectedYear(context.startYear + Math.floor((context.endYear - context.startYear) / 2));
    setSelectedMonth(1);
    setSelectedDepth(0);
  }

  if (!isOpen) return null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "map", label: "Map View" },
    { key: "depth", label: "Depth View" },
    { key: "timeseries", label: "Time Series" },
    { key: "profile", label: "Profile" },
  ];

  const unit = parameter === "Salinity (PSU)" ? "PSU" : parameter === "Pressure (dbar)" ? "dbar" : "°C";

  // Timeline: total months from startYear to endYear
  const totalMonths = (context.endYear - context.startYear + 1) * 12;
  const currentMonthIdx = (selectedYear - context.startYear) * 12 + (selectedMonth - 1);
  const timelinePercent = totalMonths > 1 ? (currentMonthIdx / (totalMonths - 1)) * 100 : 0;

  // Depth slider
  const maxDepthVal = grid.depths[grid.depths.length - 1] || 2000;

  return (
    <>
      {/* Backdrop — Mobile only (< lg) */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Explorer Panel: Right drawer on mobile, static in-flow panel on desktop */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col border-l border-[#1a2f4c] bg-[#030810]/95 backdrop-blur-2xl shadow-2xl animate-explorer-slide-in lg:relative lg:inset-auto lg:z-10 lg:w-full lg:max-w-none lg:h-full lg:rounded-2xl lg:border lg:border-[#163258] lg:shadow-[0_8px_32px_rgba(0,0,0,0.5)] lg:backdrop-blur-md overflow-hidden">
        {/* ====== HEADER ====== */}
        <div className="flex items-center justify-between border-b border-[#1a2f4c] px-5 py-3.5 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-[#ececec] tracking-wide">
              4D Ocean Explorer
            </h2>
            <span className="text-[10px] font-mono text-[#6b8aad] tracking-widest">
              Space • Depth • Time
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#6b8aad] bg-[#0a1628] border border-[#1a2f4c] rounded-md px-2.5 py-1">
              <svg className="w-3 h-3 text-[#00d2ff]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              {context.region}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6b8aad] hover:bg-[#1a2f4c] hover:text-[#ececec] transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ====== TABS + PARAMETER ====== */}
        <div className="flex items-center justify-between border-b border-[#1a2f4c] px-5 py-2 shrink-0 gap-2">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-[#00d2ff] text-[#020814] shadow-[0_0_10px_rgba(0,210,255,0.3)]"
                    : "text-[#6b8aad] hover:text-[#ececec] hover:bg-[#0a1628]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select
            value={parameter}
            onChange={(e) => setParameter(e.target.value as typeof parameter)}
            className="text-[11px] font-mono bg-[#0a1628] border border-[#1a2f4c] text-[#ececec] rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#00d2ff] cursor-pointer appearance-none"
          >
            <option value="Salinity (PSU)">Salinity (PSU)</option>
            <option value="Temperature (°C)">Temperature (°C)</option>
            <option value="Pressure (dbar)">Pressure (dbar)</option>
          </select>
        </div>

        {/* ====== SCROLLABLE CONTENT ====== */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* --- TAB: MAP VIEW (4D Spatio-Temporal WebGL Ocean Model) --- */}
          {activeTab === "map" && (
            <FourDOceanWebGLView
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              selectedDepth={selectedDepth}
              parameter={parameter}
              region={context.region}
            />
          )}

          {/* --- TAB: DEPTH VIEW --- */}
          {activeTab === "depth" && (
            <DepthProfileView
              data={depthProfileData}
              parameter={parameter}
              unit={unit}
              year={selectedYear}
              month={selectedMonth}
            />
          )}

          {/* --- TAB: TIME SERIES --- */}
          {activeTab === "timeseries" && (
            <TimeSeriesView
              data={timeSeriesData}
              parameter={parameter}
              unit={unit}
              depth={selectedDepth}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          )}

          {/* --- TAB: PROFILE (T-S combined) --- */}
          {activeTab === "profile" && (
            <CombinedProfileView
              grid={grid}
              year={selectedYear}
              month={selectedMonth}
            />
          )}

          {/* ====== TIMELINE CONTROLS ====== */}
          <div className="space-y-3">
            {/* Play + Timeline */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a1628] border border-[#1a2f4c] text-[#00d2ff] hover:bg-[#00d2ff] hover:text-[#020814] transition-all cursor-pointer shrink-0"
              >
                {isPlaying ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                )}
              </button>
              <div className="flex-1 relative">
                <div className="h-1.5 bg-[#0a1628] rounded-full border border-[#1a2f4c] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00d2ff] to-[#38bdf8] rounded-full transition-all duration-200"
                    style={{ width: `${timelinePercent}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={totalMonths - 1}
                  value={currentMonthIdx}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    const y = context.startYear + Math.floor(idx / 12);
                    const m = (idx % 12) + 1;
                    setSelectedYear(y);
                    setSelectedMonth(m);
                  }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                />
                {/* Year labels */}
                <div className="flex justify-between mt-1">
                  {grid.years.map((y) => (
                    <span key={y} className="text-[9px] font-mono text-[#4a6a8a]">{y}</span>
                  ))}
                </div>
              </div>
              <span className="text-[10px] font-mono bg-[#0a1628] border border-[#1a2f4c] text-[#00d2ff] rounded-md px-2 py-1 whitespace-nowrap shrink-0">
                {monthName(selectedMonth)} {selectedYear}
              </span>
            </div>

            {/* Depth Slider */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-[#6b8aad] w-10 shrink-0">Depth</span>
              <div className="flex-1 relative">
                <div className="h-1.5 bg-[#0a1628] rounded-full border border-[#1a2f4c] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00d2ff]/60 to-[#0a3666] rounded-full transition-all duration-200"
                    style={{ width: `${maxDepthVal > 0 ? (selectedDepth / maxDepthVal) * 100 : 0}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxDepthVal}
                  step={10}
                  value={selectedDepth}
                  onChange={(e) => setSelectedDepth(parseInt(e.target.value, 10))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] font-mono text-[#4a6a8a]">0 m</span>
                  {maxDepthVal >= 1000 && (
                    <span className="text-[9px] font-mono text-[#4a6a8a]">{Math.round(maxDepthVal / 2)} m</span>
                  )}
                  <span className="text-[9px] font-mono text-[#4a6a8a]">{maxDepthVal.toLocaleString()} m</span>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-[#0a1628] border border-[#1a2f4c] text-[#00d2ff] rounded-md px-2 py-1 whitespace-nowrap shrink-0">
                {selectedDepth.toLocaleString()} m
              </span>
            </div>
          </div>

          {/* ====== TREND CHART (Bottom) ====== */}
          <TrendChart
            data={timeSeriesData}
            parameter={parameter}
            unit={unit}
            region={context.region}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />

          {/* ====== CURRENT SELECTION ====== */}
          <div className="grid grid-cols-3 gap-2 pb-2">
            <div className="bg-[#0a1628] border border-[#1a2f4c] rounded-lg p-2.5 text-center">
              <span className="text-[9px] font-mono text-[#4a6a8a] block uppercase">Date</span>
              <span className="text-xs font-mono text-[#ececec] font-bold">{monthName(selectedMonth)} {selectedYear}</span>
            </div>
            <div className="bg-[#0a1628] border border-[#1a2f4c] rounded-lg p-2.5 text-center">
              <span className="text-[9px] font-mono text-[#4a6a8a] block uppercase">Depth</span>
              <span className="text-xs font-mono text-[#ececec] font-bold">{selectedDepth} m{selectedDepth === 0 ? " (Surface)" : ""}</span>
            </div>
            <div className="bg-[#0a1628] border border-[#1a2f4c] rounded-lg p-2.5 text-center">
              <span className="text-[9px] font-mono text-[#4a6a8a] block uppercase">{parameter.split(" ")[0]}</span>
              <span className="text-xs font-mono text-[#00d2ff] font-bold">
                {currentValue !== null ? `${currentValue} ${unit}` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


/* ========================================================================
   SUB-COMPONENTS
   ======================================================================== */

/**
 * Heatmap View — Canvas-rendered depth × time grid
 */
export function HeatmapView({
  heatmap,
  parameter,
  unit,
  selectedYear,
  selectedMonth,
}: {
  heatmap: ReturnType<typeof getHeatmapGrid>;
  parameter: string;
  unit: string;
  selectedYear: number;
  selectedMonth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; depth: number; time: string; value: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { depthLabels, timeLabels, values, min, max } = heatmap;
    const rows = depthLabels.length;
    const cols = timeLabels.length;

    const padLeft = 55;
    const padRight = 45;
    const padTop = 10;
    const padBottom = 10;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 220 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `220px`;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 220;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    ctx.clearRect(0, 0, w, h);

    // Draw heatmap cells
    const cellW = plotW / cols;
    const cellH = plotH / rows;
    const range = max - min || 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = (values[r][c] - min) / range;
        ctx.fillStyle = scientificColorScale(t);
        ctx.fillRect(padLeft + c * cellW, padTop + r * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // Selected time indicator line
    const selIdx = timeLabels.findIndex(
      (t) => t.year === selectedYear && t.month === selectedMonth
    );
    if (selIdx >= 0) {
      const lineX = padLeft + (selIdx + 0.5) * cellW;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(lineX, padTop);
      ctx.lineTo(lineX, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Y-axis labels (depth)
    ctx.fillStyle = "#6b8aad";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let r = 0; r < rows; r++) {
      const y = padTop + (r + 0.5) * cellH;
      const label = depthLabels[r] === 0 ? "0 m\n(Surface)" : `${depthLabels[r].toLocaleString()} m`;
      if (r % Math.max(1, Math.floor(rows / 6)) === 0 || r === rows - 1) {
        ctx.fillText(label, padLeft - 5, y);
      }
    }

    // Color scale legend (right side)
    const legendW = 12;
    const legendH = plotH;
    const legendX = w - padRight + 10;
    const legendY = padTop;
    for (let i = 0; i < legendH; i++) {
      const t = i / legendH;
      ctx.fillStyle = scientificColorScale(t);
      ctx.fillRect(legendX, legendY + i, legendW, 1.5);
    }
    ctx.fillStyle = "#6b8aad";
    ctx.font = "8px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${max.toFixed(1)}`, legendX + legendW + 3, legendY);
    ctx.textBaseline = "bottom";
    ctx.fillText(`${min.toFixed(1)}`, legendX + legendW + 3, legendY + legendH);
    ctx.textBaseline = "top";
    ctx.fillText(unit, legendX, legendY - 12);

  }, [heatmap, selectedYear, selectedMonth, unit]);

  const handleCanvasHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 55;
    const padRight = 45;
    const padTop = 10;
    const padBottom = 10;

    const w = rect.width;
    const h = 220;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const col = Math.floor(((x - padLeft) / plotW) * heatmap.timeLabels.length);
    const row = Math.floor(((y - padTop) / plotH) * heatmap.depthLabels.length);

    if (col >= 0 && col < heatmap.timeLabels.length && row >= 0 && row < heatmap.depthLabels.length) {
      const tl = heatmap.timeLabels[col];
      const tooltipX = Math.min(x + 10, (container.clientWidth || 400) - 140);
      setTooltip({
        x: tooltipX,
        y: y,
        depth: heatmap.depthLabels[row],
        time: `${monthName(tl.month)} ${tl.year}`,
        value: heatmap.values[row][col],
      });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-[#1a2f4c] cursor-crosshair"
        onMouseMove={handleCanvasHover}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-[#0a1628]/95 border border-[#1a2f4c] rounded-md px-2.5 py-1.5 text-[10px] font-mono text-[#ececec] shadow-lg backdrop-blur-sm"
          style={{
            left: tooltip.x,
            top: tooltip.y - 50,
          }}
        >
          <div className="text-[#6b8aad]">{tooltip.time}</div>
          <div>Depth: <span className="text-[#00d2ff]">{tooltip.depth.toLocaleString()} m</span></div>
          <div>{parameter.split(" ")[0]}: <span className="text-[#00d2ff]">{tooltip.value.toFixed(2)} {unit}</span></div>
        </div>
      )}
    </div>
  );
}


/**
 * Depth Profile View — SVG line chart (depth vs value)
 */
function DepthProfileView({
  data,
  parameter,
  unit: _unit,
  year,
  month,
}: {
  data: { depth: number; value: number }[];
  parameter: string;
  unit?: string;
  year: number;
  month: number;
}) {
  void _unit;
  if (data.length === 0) return <div className="text-center text-[#6b8aad] py-10 text-xs font-mono">No data</div>;

  const w = 560, h = 280;
  const pad = { top: 25, right: 30, bottom: 35, left: 55 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const maxDepth = Math.max(...data.map((d) => d.depth));
  const vals = data.map((d) => d.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const valRange = maxVal - minVal || 1;

  const xScale = (v: number) => pad.left + ((v - minVal) / valRange) * plotW;
  const yScale = (d: number) => pad.top + (d / (maxDepth || 1)) * plotH;

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${xScale(d.value).toFixed(1)},${yScale(d.depth).toFixed(1)}`).join(" ");

  // Area fill
  const areaD = pathD + ` L${pad.left},${yScale(data[data.length - 1].depth).toFixed(1)} L${pad.left},${yScale(data[0].depth).toFixed(1)} Z`;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full" style={{ minHeight: 200 }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad.left}
            y1={pad.top + f * plotH}
            x2={pad.left + plotW}
            y2={pad.top + f * plotH}
            stroke="#1a2f4c"
            strokeWidth={0.5}
          />
        ))}
        {/* Area */}
        <path d={areaD} fill="url(#depthAreaGrad)" opacity={0.3} />
        <defs>
          <linearGradient id="depthAreaGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00d2ff" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* Line */}
        <path d={pathD} fill="none" stroke="#00d2ff" strokeWidth={2} />
        {/* Data points */}
        {data.map((d, i) => (
          <circle key={i} cx={xScale(d.value)} cy={yScale(d.depth)} r={3} fill="#00d2ff" stroke="#030810" strokeWidth={1.5} />
        ))}
        {/* Y-axis labels (depth) */}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0 || i === data.length - 1).map((d) => (
          <text key={d.depth} x={pad.left - 8} y={yScale(d.depth)} fill="#6b8aad" fontSize={9} fontFamily="monospace" textAnchor="end" dominantBaseline="middle">
            {d.depth}m
          </text>
        ))}
        {/* X-axis labels (value) */}
        {[minVal, (minVal + maxVal) / 2, maxVal].map((v) => (
          <text key={v} x={xScale(v)} y={h - 8} fill="#6b8aad" fontSize={9} fontFamily="monospace" textAnchor="middle">
            {v.toFixed(1)}
          </text>
        ))}
        {/* Axis labels */}
        <text x={pad.left - 40} y={pad.top + plotH / 2} fill="#4a6a8a" fontSize={9} fontFamily="monospace" textAnchor="middle" transform={`rotate(-90, ${pad.left - 40}, ${pad.top + plotH / 2})`}>
          Depth (m)
        </text>
        <text x={pad.left + plotW / 2} y={h - 1} fill="#4a6a8a" fontSize={9} fontFamily="monospace" textAnchor="middle">
          {parameter} — {monthName(month)} {year}
        </text>
      </svg>
    </div>
  );
}


/**
 * Time Series View — SVG line chart (time vs value)
 */
function TimeSeriesView({
  data,
  parameter,
  unit,
  depth,
  selectedYear,
  selectedMonth,
}: {
  data: { year: number; month: number; value: number }[];
  parameter: string;
  unit: string;
  depth: number;
  selectedYear: number;
  selectedMonth: number;
}) {
  if (data.length === 0) return <div className="text-center text-[#6b8aad] py-10 text-xs font-mono">No data</div>;

  const w = 560, h = 260;
  const pad = { top: 20, right: 20, bottom: 35, left: 50 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const vals = data.map((d) => d.value);
  const minVal = Math.min(...vals) - 0.5;
  const maxVal = Math.max(...vals) + 0.5;
  const valRange = maxVal - minVal || 1;

  const xScale = (i: number) => pad.left + (i / Math.max(1, data.length - 1)) * plotW;
  const yScale = (v: number) => pad.top + plotH - ((v - minVal) / valRange) * plotH;

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(d.value).toFixed(1)}`).join(" ");

  // Find selected index
  const selIdx = data.findIndex((d) => d.year === selectedYear && d.month === selectedMonth);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full" style={{ minHeight: 200 }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = pad.top + (1 - f) * plotH;
          const val = minVal + f * valRange;
          return (
            <g key={f}>
              <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#1a2f4c" strokeWidth={0.5} />
              <text x={pad.left - 5} y={y} fill="#6b8aad" fontSize={9} fontFamily="monospace" textAnchor="end" dominantBaseline="middle">
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}
        {/* Line */}
        <path d={pathD} fill="none" stroke="#00d2ff" strokeWidth={1.5} />
        {/* Selected point */}
        {selIdx >= 0 && (
          <>
            <line x1={xScale(selIdx)} y1={pad.top} x2={xScale(selIdx)} y2={pad.top + plotH} stroke="#00d2ff" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
            <circle cx={xScale(selIdx)} cy={yScale(data[selIdx].value)} r={5} fill="#00d2ff" stroke="#030810" strokeWidth={2} />
            <text x={xScale(selIdx)} y={yScale(data[selIdx].value) - 10} fill="#ececec" fontSize={10} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              {data[selIdx].value.toFixed(2)} {unit}
            </text>
          </>
        )}
        {/* X-axis year labels */}
        {data.filter((d) => d.month === 1).map((d) => {
          const idx = data.indexOf(d);
          return (
            <text key={d.year} x={xScale(idx)} y={h - 8} fill="#6b8aad" fontSize={9} fontFamily="monospace" textAnchor="middle">
              {d.year}
            </text>
          );
        })}
        {/* Labels */}
        <text x={pad.left + plotW / 2} y={h - 1} fill="#4a6a8a" fontSize={9} fontFamily="monospace" textAnchor="middle">
          {parameter} at {depth}m depth
        </text>
      </svg>
    </div>
  );
}


/**
 * Combined T-S Profile View
 */
function CombinedProfileView({
  grid,
  year,
  month,
}: {
  grid: ReturnType<typeof generate4DGrid>;
  year: number;
  month: number;
}) {
  const tempProfile = getDepthProfile(grid, year, month, "Temperature (°C)");
  const salProfile = getDepthProfile(grid, year, month, "Salinity (PSU)");

  if (tempProfile.length === 0) return <div className="text-center text-[#6b8aad] py-10 text-xs font-mono">No data</div>;

  const w = 560, h = 300;
  const pad = { top: 30, right: 50, bottom: 35, left: 55 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const maxDepth = Math.max(...tempProfile.map((d) => d.depth));
  const yScale = (d: number) => pad.top + (d / (maxDepth || 1)) * plotH;

  // Temperature scale
  const tempVals = tempProfile.map((d) => d.value);
  const tempMin = Math.min(...tempVals);
  const tempMax = Math.max(...tempVals);
  const tempRange = tempMax - tempMin || 1;
  const tempXScale = (v: number) => pad.left + ((v - tempMin) / tempRange) * plotW;

  // Salinity scale (mapped to same x range)
  const salVals = salProfile.map((d) => d.value);
  const salMin = Math.min(...salVals);
  const salMax = Math.max(...salVals);
  const salRange = salMax - salMin || 1;
  const salXScale = (v: number) => pad.left + ((v - salMin) / salRange) * plotW;

  const tempPath = tempProfile.map((d, i) => `${i === 0 ? "M" : "L"}${tempXScale(d.value).toFixed(1)},${yScale(d.depth).toFixed(1)}`).join(" ");
  const salPath = salProfile.map((d, i) => `${i === 0 ? "M" : "L"}${salXScale(d.value).toFixed(1)},${yScale(d.depth).toFixed(1)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full" style={{ minHeight: 220 }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.left} y1={pad.top + f * plotH} x2={pad.left + plotW} y2={pad.top + f * plotH} stroke="#1a2f4c" strokeWidth={0.5} />
        ))}
        {/* Temperature line */}
        <path d={tempPath} fill="none" stroke="#ff6b6b" strokeWidth={2} />
        {tempProfile.map((d, i) => (
          <circle key={`t${i}`} cx={tempXScale(d.value)} cy={yScale(d.depth)} r={2.5} fill="#ff6b6b" />
        ))}
        {/* Salinity line */}
        <path d={salPath} fill="none" stroke="#00d2ff" strokeWidth={2} />
        {salProfile.map((d, i) => (
          <circle key={`s${i}`} cx={salXScale(d.value)} cy={yScale(d.depth)} r={2.5} fill="#00d2ff" />
        ))}
        {/* Y-axis (depth) */}
        {tempProfile.filter((_, i) => i % Math.max(1, Math.floor(tempProfile.length / 6)) === 0 || i === tempProfile.length - 1).map((d) => (
          <text key={d.depth} x={pad.left - 8} y={yScale(d.depth)} fill="#6b8aad" fontSize={9} fontFamily="monospace" textAnchor="end" dominantBaseline="middle">
            {d.depth}m
          </text>
        ))}
        {/* Legend */}
        <rect x={pad.left + 10} y={pad.top - 20} width={8} height={8} rx={2} fill="#ff6b6b" />
        <text x={pad.left + 22} y={pad.top - 13} fill="#ff6b6b" fontSize={9} fontFamily="monospace">Temperature (°C)</text>
        <rect x={pad.left + 140} y={pad.top - 20} width={8} height={8} rx={2} fill="#00d2ff" />
        <text x={pad.left + 152} y={pad.top - 13} fill="#00d2ff" fontSize={9} fontFamily="monospace">Salinity (PSU)</text>
        {/* Title */}
        <text x={pad.left + plotW / 2} y={h - 5} fill="#4a6a8a" fontSize={9} fontFamily="monospace" textAnchor="middle">
          Combined T-S Profile — {monthName(month)} {year}
        </text>
      </svg>
    </div>
  );
}


/**
 * Trend Chart — Bottom area chart with trend line
 */
function TrendChart({
  data,
  parameter,
  unit,
  region,
  selectedYear,
  selectedMonth,
}: {
  data: { year: number; month: number; value: number }[];
  parameter: string;
  unit: string;
  region: string;
  selectedYear: number;
  selectedMonth: number;
}) {
  if (data.length === 0) return null;

  const w = 560, h = 150;
  const pad = { top: 25, right: 15, bottom: 25, left: 45 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const vals = data.map((d) => d.value);
  const minVal = Math.min(...vals) - 0.3;
  const maxVal = Math.max(...vals) + 0.3;
  const valRange = maxVal - minVal || 1;

  const xScale = (i: number) => pad.left + (i / Math.max(1, data.length - 1)) * plotW;
  const yScale = (v: number) => pad.top + plotH - ((v - minVal) / valRange) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(d.value).toFixed(1)}`).join(" ");
  const areaPath = linePath + ` L${xScale(data.length - 1).toFixed(1)},${(pad.top + plotH).toFixed(1)} L${pad.left},${(pad.top + plotH).toFixed(1)} Z`;

  const selIdx = data.findIndex((d) => d.year === selectedYear && d.month === selectedMonth);
  const selVal = selIdx >= 0 ? data[selIdx].value : null;

  return (
    <div className="bg-[#0a1628]/50 border border-[#1a2f4c] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-mono text-[#ececec] font-medium">
          {parameter.split("(")[0].trim()} Trend ({region})
        </span>
        {selVal !== null && (
          <span className="text-[10px] font-mono text-[#00d2ff] bg-[#0a1628] border border-[#1a2f4c] rounded px-2 py-0.5">
            {monthName(selectedMonth)} {selectedYear}: <span className="font-bold">{selVal.toFixed(2)} {unit}</span>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minHeight: 100 }}>
        <defs>
          <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#00d2ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {[0, 0.5, 1].map((f) => {
          const y = pad.top + (1 - f) * plotH;
          const val = minVal + f * valRange;
          return (
            <g key={f}>
              <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#1a2f4c" strokeWidth={0.5} />
              <text x={pad.left - 4} y={y} fill="#4a6a8a" fontSize={8} fontFamily="monospace" textAnchor="end" dominantBaseline="middle">
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}
        {/* Area */}
        <path d={areaPath} fill="url(#trendAreaGrad)" />
        {/* Line */}
        <path d={linePath} fill="none" stroke="#00d2ff" strokeWidth={1.5} />
        {/* Selected indicator */}
        {selIdx >= 0 && (
          <>
            <line x1={xScale(selIdx)} y1={pad.top} x2={xScale(selIdx)} y2={pad.top + plotH} stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="3 2" />
            <circle cx={xScale(selIdx)} cy={yScale(data[selIdx].value)} r={4} fill="#00d2ff" stroke="#030810" strokeWidth={1.5} />
          </>
        )}
        {/* X-axis year labels */}
        {data.filter((d) => d.month === 1).map((d) => {
          const idx = data.indexOf(d);
          return (
            <text key={d.year} x={xScale(idx)} y={h - 5} fill="#4a6a8a" fontSize={8} fontFamily="monospace" textAnchor="middle">
              {d.year}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
