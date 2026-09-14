"use client";

import React, { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface TelemetrySidebarProps {
  onOpenDepthViewer?: () => void;
  activeCount?: number;
}

export function TelemetrySidebar({
  onOpenDepthViewer,
  activeCount = 3940,
}: TelemetrySidebarProps) {
  const mounted = useMounted();

  return (
    <div className="pointer-events-none z-10 flex flex-col items-start w-[175px] xl:w-[195px] shrink-0 animate-fade-in pl-3.5 border-l border-[#1a2f4c]/60 -translate-x-1.5 xl:-translate-x-2.5">
      <div className="pointer-events-auto flex flex-col gap-5 xl:gap-6 w-full">
        {/* Understated Header: Title + Subtle LIVE Pulse */}
        <div className="flex items-center justify-between w-full">
          <span className="font-mono text-[10.5px] xl:text-[11px] font-semibold tracking-wider text-[#9bb2ce] uppercase">
            OCEAN TELEMETRY
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[9px] font-medium tracking-wider text-[#00d2ff]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00d2ff] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00d2ff]" />
            </span>
            <span>LIVE</span>
          </div>
        </div>

        {/* Metric 1: Global Coverage */}
        <div className="flex flex-col gap-1 w-full">
          <span className="font-mono text-[10px] xl:text-[10.5px] tracking-wider text-[#8ea9c7] uppercase">
            GLOBAL COVERAGE
          </span>
          <span className="text-lg xl:text-xl font-bold tracking-tight text-white font-sans">
            100%
          </span>
          <div className="h-[2px] w-full bg-[#1a2f4c]/70 rounded-full overflow-hidden">
            <div
              className={`h-full bg-[#00d2ff] rounded-full transition-all duration-1000 ease-out ${
                mounted ? "w-full" : "w-0"
              }`}
            />
          </div>
        </div>

        {/* Metric 2: Active Floats */}
        <div className="flex flex-col gap-1 w-full">
          <span className="font-mono text-[10px] xl:text-[10.5px] tracking-wider text-[#8ea9c7] uppercase">
            ACTIVE FLOATS
          </span>
          <span className="text-lg xl:text-xl font-bold tracking-tight text-white font-sans">
            {activeCount.toLocaleString()}
          </span>
          <div className="h-[2px] w-full bg-[#1a2f4c]/70 rounded-full overflow-hidden">
            <div
              className={`h-full bg-[#00d2ff] rounded-full transition-all duration-1000 ease-out ${
                mounted ? "w-[85%]" : "w-0"
              }`}
            />
          </div>
        </div>

        {/* Metric 3: Ocean Depth Reach */}
        <div
          onClick={onOpenDepthViewer}
          role={onOpenDepthViewer ? "button" : undefined}
          tabIndex={onOpenDepthViewer ? 0 : undefined}
          onKeyDown={(e) => {
            if (onOpenDepthViewer && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onOpenDepthViewer();
            }
          }}
          className={`flex flex-col gap-1 w-full ${
            onOpenDepthViewer ? "cursor-pointer group/depth" : ""
          }`}
          title={onOpenDepthViewer ? "Click to explore 4D ocean depth profile" : undefined}
          aria-label="Ocean depth reach: 6,000 meters. Click to explore 4D depth profile."
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] xl:text-[10.5px] tracking-wider text-[#8ea9c7] uppercase group-hover/depth:text-[#00d2ff] transition-colors">
              OCEAN DEPTH REACH
            </span>
            {onOpenDepthViewer && (
              <svg
                className="h-2.5 w-2.5 text-[#8ea9c7] opacity-0 group-hover/depth:opacity-100 group-hover/depth:translate-x-0.5 transition-all"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </div>
          <span className="text-lg xl:text-xl font-bold tracking-tight text-white font-sans">
            6,000 m
          </span>
          <div className="h-[2px] w-full bg-[#1a2f4c]/70 rounded-full overflow-hidden">
            <div
              className={`h-full bg-[#00d2ff] rounded-full transition-all duration-1000 ease-out ${
                mounted ? "w-[72%]" : "w-0"
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
