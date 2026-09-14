import React from "react";

interface HeroProps {
  onOpenTelemetry?: () => void;
  onOpenProfiles?: () => void;
  onToggleLighting?: () => void;
  isTelemetryActive?: boolean;
  isProfilesActive?: boolean;
  isLightingActive?: boolean;
}

export function Hero({
  onOpenTelemetry,
  onOpenProfiles,
  onToggleLighting,
  isTelemetryActive = false,
  isProfilesActive = false,
  isLightingActive = false,
}: HeroProps = {}) {
  return (
    <div className="pointer-events-none relative z-10 flex flex-col items-start max-w-lg lg:max-w-xl animate-fade-in">
      {/* Uppercase Badge Tag Matching Reference: ● AUTONOMOUS OCEAN INTELLIGENCE */}
      <div className="mb-4 flex items-center gap-2 font-mono text-[10px] font-semibold tracking-widest text-[#00d2ff] uppercase bg-[#061224]/80 border border-[#1a2f4c] px-3 py-1 rounded-full backdrop-blur-md shadow-sm">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10b981] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10b981]" />
        </span>
        <span>AUTONOMOUS OCEAN INTELLIGENCE</span>
      </div>

      {/* Main Display Headline with Reference Cyan/Teal Gradient */}
      <h1 className="text-4xl font-extrabold tracking-tight text-[#ececec] drop-shadow-md sm:text-5xl md:text-[52px] lg:text-[56px] leading-[1.06]">
        What ocean data <br />
        can I help you <br />
        <span className="text-gradient-cyan-teal">
          explore <span className="whitespace-nowrap">today<span style={{ display: "inline", paddingLeft: "0.12em" }}>?</span></span>
        </span>
      </h1>

      {/* Subtitle */}
      <p className="mt-3.5 text-xs sm:text-[13px] text-[#94a3b8] leading-relaxed max-w-md font-sans">
        Analyze global ARGO float observations, sea surface temperature anomalies, and geospatial hydrodynamic telemetry.
      </p>

      {/* Three Feature Cards with Technical Icons and Right Arrow */}
      <div className="mt-5 flex flex-col gap-2.5 w-full max-w-[390px] pointer-events-auto">
        {/* Feature 1: Real-Time Telemetry */}
        <button
          type="button"
          onClick={onOpenTelemetry}
          aria-label="Open Real-Time Telemetry panel"
          className={`group flex w-full items-center justify-between gap-3 rounded-xl border p-2 px-3.5 backdrop-blur-md shadow-md transition-all duration-300 hover:translate-x-1 cursor-pointer text-left ${
            isTelemetryActive
              ? "border-[#00d2ff] bg-[#0a1e38]/90 shadow-[0_0_20px_rgba(0,210,255,0.22)] ring-1 ring-[#00d2ff]/40"
              : "border-[#1a2f4c] bg-[#061224]/75 hover:border-[#00d2ff]/50 hover:shadow-[0_0_20px_rgba(0,210,255,0.12)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all ${
                isTelemetryActive
                  ? "border-[#00d2ff] bg-[#020817] text-[#00d2ff] shadow-[0_0_12px_rgba(0,210,255,0.35)]"
                  : "border-[#1a2f4c] bg-[#020817] text-[#00d2ff] group-hover:border-[#00d2ff]/50"
              }`}
            >
              <svg
                className="h-4.5 w-4.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wider text-[#ececec] uppercase">
                  REAL-TIME TELEMETRY
                </span>
                {isTelemetryActive && (
                  <span className="rounded-full bg-[#00d2ff]/20 px-1.5 py-0.5 text-[8.5px] font-mono font-bold text-[#00d2ff]">
                    OPEN
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#94a3b8] font-mono">
                3,940 Floats Synchronized
              </span>
            </div>
          </div>

          <svg
            className={`h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 ${
              isTelemetryActive ? "text-[#00d2ff] translate-x-0.5" : "text-[#4a5568] group-hover:text-[#00d2ff]"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Feature 2: 4D Ocean Profiles */}
        <button
          type="button"
          onClick={onOpenProfiles}
          aria-label="Open 4D Ocean Profiles explorer"
          className={`group flex w-full items-center justify-between gap-3 rounded-xl border p-2 px-3.5 backdrop-blur-md shadow-md transition-all duration-300 hover:translate-x-1 cursor-pointer text-left ${
            isProfilesActive
              ? "border-[#00d2ff] bg-[#0a1e38]/90 shadow-[0_0_20px_rgba(0,210,255,0.22)] ring-1 ring-[#00d2ff]/40"
              : "border-[#1a2f4c] bg-[#061224]/75 hover:border-[#00d2ff]/60 hover:bg-[#071933]/90 hover:shadow-[0_0_22px_rgba(0,210,255,0.18)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all ${
                isProfilesActive
                  ? "border-[#00d2ff] bg-[#020817] text-[#00d2ff] shadow-[0_0_12px_rgba(0,210,255,0.35)]"
                  : "border-[#1a2f4c] bg-[#020817] text-[#00d2ff] group-hover:border-[#00d2ff]/50"
              }`}
            >
              <svg
                className="h-4.5 w-4.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wider text-[#ececec] uppercase">
                  4D OCEAN PROFILES
                </span>
                {isProfilesActive && (
                  <span className="rounded-full bg-[#00d2ff]/20 px-1.5 py-0.5 text-[8.5px] font-mono font-bold text-[#00d2ff]">
                    OPEN
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#94a3b8] font-mono">
                0 – 6,000m Depth Stratification
              </span>
            </div>
          </div>

          <svg
            className={`h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 ${
              isProfilesActive ? "text-[#00d2ff] translate-x-0.5" : "text-[#4a5568] group-hover:text-[#00d2ff]"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Feature 3: Atmospheric Lighting */}
        <button
          type="button"
          onClick={onToggleLighting}
          aria-label="Toggle atmospheric solar hydrodynamic rendering on the Earth"
          className={`group flex w-full items-center justify-between gap-3 rounded-xl border p-2 px-3.5 backdrop-blur-md shadow-md transition-all duration-300 hover:translate-x-1 cursor-pointer text-left ${
            isLightingActive
              ? "border-[#00d2ff] bg-[#0a1e38]/90 shadow-[0_0_20px_rgba(0,210,255,0.22)] ring-1 ring-[#00d2ff]/40"
              : "border-[#1a2f4c] bg-[#061224]/75 hover:border-[#00d2ff]/50 hover:shadow-[0_0_20px_rgba(0,210,255,0.12)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all ${
                isLightingActive
                  ? "border-[#00d2ff] bg-[#020817] text-[#00d2ff] shadow-[0_0_12px_rgba(0,210,255,0.35)]"
                  : "border-[#1a2f4c] bg-[#020817] text-[#00d2ff] group-hover:border-[#00d2ff]/50"
              }`}
            >
              <svg
                className="h-4.5 w-4.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wider text-[#ececec] uppercase">
                  ATMOSPHERIC LIGHTING
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-mono font-bold transition-colors ${
                    isLightingActive
                      ? "bg-[#00d2ff] text-[#020814] shadow-[0_0_8px_rgba(0,210,255,0.4)]"
                      : "bg-[#1a2f4c] text-[#7090b0]"
                  }`}
                >
                  {isLightingActive ? "ON" : "OFF"}
                </span>
              </div>
              <span className="text-[11px] text-[#94a3b8] font-mono">
                Solar Hydrodynamic Rendering
              </span>
            </div>
          </div>

          <svg
            className={`h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 ${
              isLightingActive ? "text-[#00d2ff] translate-x-0.5" : "text-[#4a5568] group-hover:text-[#00d2ff]"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
