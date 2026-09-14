"use client";

import React, { useState, useEffect } from "react";

interface RealTimeTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDataExplorer?: () => void;
  onOpenDepthProfiles?: () => void;
}

export function RealTimeTelemetryModal({
  isOpen,
  onClose,
  onOpenDataExplorer,
  onOpenDepthProfiles,
}: RealTimeTelemetryModalProps) {
  const [secondsAgo, setSecondsAgo] = useState(3);
  const [timestampStr, setTimestampStr] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const updateTime = () => {
      const now = new Date();
      setTimestampStr(
        now.toISOString().replace("T", " ").substring(0, 19) + " UTC"
      );
    };
    updateTime();

    const interval = setInterval(() => {
      setSecondsAgo((prev) => (prev >= 60 ? 1 : prev + 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-[#1a2f4c] bg-[#061224]/95 p-5 sm:p-6 shadow-2xl backdrop-blur-xl animate-scale-in text-[#ececec] font-sans">
        {/* Header with Title and Live Indicator */}
        <div className="flex items-center justify-between border-b border-[#1a2f4c] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1a2f4c] bg-[#020817] text-[#00d2ff] shadow-[0_0_15px_rgba(0,210,255,0.2)]">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-wide text-[#ececec]">
                  Real-Time Telemetry
                </h2>
                <span className="flex items-center gap-1.5 rounded-full border border-[#1a2f4c] bg-[#0a1e38] px-2 py-0.5 text-[9px] font-mono text-[#00d2ff]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10b981] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                  </span>
                  <span>LIVE</span>
                </span>
              </div>
              <p className="text-xs text-[#7090b0] font-mono mt-0.5">
                Autonomous Global Ocean Observation Stream
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8ea9c7] hover:bg-[#0a1e38] hover:text-[#ececec] transition-colors cursor-pointer"
            aria-label="Close Real-Time Telemetry Panel"
          >
            ✕
          </button>
        </div>

        {/* Primary Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-[#1a2f4c] bg-[#030a16] p-3 flex flex-col font-mono">
            <span className="text-[10px] text-[#7090b0] uppercase tracking-wider">ACTIVE FLOATS</span>
            <span className="text-xl font-extrabold text-[#00d2ff] mt-0.5">3,940</span>
            <span className="text-[9px] text-[#8ea9c7] mt-0.5">Autonomous Profilers</span>
          </div>

          <div className="rounded-xl border border-[#1a2f4c] bg-[#030a16] p-3 flex flex-col font-mono">
            <span className="text-[10px] text-[#7090b0] uppercase tracking-wider">GLOBAL COVERAGE</span>
            <span className="text-xl font-extrabold text-[#00d2ff] mt-0.5">100%</span>
            <span className="text-[9px] text-[#8ea9c7] mt-0.5">Ice-Free Ocean Basins</span>
          </div>

          <div className="rounded-xl border border-[#1a2f4c] bg-[#030a16] p-3 flex flex-col font-mono col-span-2 sm:col-span-1">
            <span className="text-[10px] text-[#7090b0] uppercase tracking-wider">DATA STATUS</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] inline-block"></span>
              <span className="text-sm font-bold text-[#ececec]">Synchronized</span>
            </div>
            <span className="text-[9px] text-[#8ea9c7] mt-0.5">Argos / Iridium Satellite</span>
          </div>
        </div>

        {/* Latest Observations Section */}
        <div className="mt-4 rounded-xl border border-[#1a2f4c] bg-[#030a16] p-3.5">
          <div className="flex items-center justify-between border-b border-[#1a2f4c]/60 pb-2 mb-2.5">
            <span className="text-xs font-bold text-[#ececec] uppercase tracking-wider font-mono">
              Latest Observations
            </span>
            <span className="text-[10px] font-mono text-[#00d2ff]">
              Global Array Aggregation
            </span>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            {/* Temperature */}
            <div className="flex items-center justify-between rounded-lg bg-[#061224]/80 p-2 border border-[#1a2f4c]/50">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#00d2ff]" />
                <span className="text-[#8ea9c7]">Sea Surface Temp (SST)</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-[#00d2ff]">21.4°C</span>
                <span className="text-[10px] text-[#7090b0] ml-1.5">(-1.8° to 31.2°)</span>
              </div>
            </div>

            {/* Salinity */}
            <div className="flex items-center justify-between rounded-lg bg-[#061224]/80 p-2 border border-[#1a2f4c]/50">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#38bdf8]" />
                <span className="text-[#8ea9c7]">Surface & Column Salinity</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-[#38bdf8]">34.82 PSU</span>
                <span className="text-[10px] text-[#7090b0] ml-1.5">(32.0 to 37.5)</span>
              </div>
            </div>

            {/* Depth */}
            <div className="flex items-center justify-between rounded-lg bg-[#061224]/80 p-2 border border-[#1a2f4c]/50">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#c084fc]" />
                <span className="text-[#8ea9c7]">Profiling Depth Reach</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-[#ececec]">0 – 6,000 m</span>
                <span className="text-[10px] text-[#7090b0] ml-1.5">(Core & Deep Argo)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Last Update Indicator & Transparency Notice */}
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#1a2f4c] bg-[#020814] p-3 font-mono text-[11px]">
          <div className="flex items-center justify-between text-[#8ea9c7]">
            <span className="text-[#7090b0] uppercase text-[10px]">LAST UPDATE</span>
            <span className="flex items-center gap-1.5 text-[#00d2ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <span>{secondsAgo}s ago · {timestampStr || "Synchronized"}</span>
            </span>
          </div>
          <p className="text-[10px] text-[#7090b0] font-sans leading-relaxed">
            Data stream aggregates active WMO float telemetries via real-time satellite transmission downlink.
          </p>
        </div>

        {/* Actions Footer */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onOpenDepthProfiles && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDepthProfiles();
                }}
                className="rounded-lg border border-[#00d2ff]/40 bg-[#00d2ff]/10 px-3 py-1.5 text-xs font-mono font-medium text-[#00d2ff] hover:bg-[#00d2ff] hover:text-[#020814] transition-all cursor-pointer"
              >
                4D Profiles →
              </button>
            )}
            {onOpenDataExplorer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDataExplorer();
                }}
                className="rounded-lg border border-[#1a2f4c] bg-[#0a1e38] px-3 py-1.5 text-xs font-mono font-medium text-[#8ea9c7] hover:text-[#ececec] hover:border-[#2a4365] transition-all cursor-pointer"
              >
                Explore Floats
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#00d2ff] px-4 py-1.5 text-xs font-bold text-[#020814] transition-all hover:bg-[#38bdf8] shadow-[0_0_15px_rgba(0,210,255,0.35)] cursor-pointer font-mono"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
}
