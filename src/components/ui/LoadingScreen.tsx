"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface LoadingScreenProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

interface StepItem {
  id: string;
  label: string;
  threshold: number;
}

const STEPS: StepItem[] = [
  { id: "argo", label: "Connecting to ARGO network", threshold: 20 },
  { id: "data", label: "Loading ocean data", threshold: 45 },
  { id: "globe", label: "Initializing 3D globe", threshold: 70 },
  { id: "layers", label: "Preparing ocean layers", threshold: 100 },
];

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: `${(i * 41 + 13) % 96}%`,
  top: `${(i * 59 + 7) % 92}%`,
  size: i % 4 === 0 ? 3 : i % 2 === 0 ? 2 : 1.5,
  opacity: i % 3 === 0 ? 0.45 : 0.25,
  delay: (i % 8) * 0.6,
  duration: 8 + (i % 5) * 3,
}));

function getProgressAndStatus(elapsed: number): { progress: number; status: string } {
  if (elapsed < 800) {
    // 0.0s - 0.8s: 0% -> 20%
    const ratio = elapsed / 800;
    return {
      progress: Math.min(20, ratio * 20),
      status: "INITIALIZING...",
    };
  } else if (elapsed < 1600) {
    // 0.8s - 1.6s: 20% -> 45%
    const ratio = (elapsed - 800) / 800;
    return {
      progress: 20 + ratio * 25,
      status: "CONNECTING TO ARGO NETWORK...",
    };
  } else if (elapsed < 2500) {
    // 1.6s - 2.5s: 45% -> 70%
    const ratio = (elapsed - 1600) / 900;
    return {
      progress: 45 + ratio * 25,
      status: "LOADING OCEAN DATA...",
    };
  } else if (elapsed < 3400) {
    // 2.5s - 3.4s: 70% -> 90%
    const ratio = (elapsed - 2500) / 900;
    return {
      progress: 70 + ratio * 20,
      status: "INITIALIZING 3D GLOBE...",
    };
  } else if (elapsed < 3800) {
    // 3.4s - 3.8s: 90% -> 100%
    const ratio = (elapsed - 3400) / 400;
    return {
      progress: 90 + ratio * 10,
      status: "PREPARING OCEAN LAYERS...",
    };
  } else {
    // 3.8s+: 100% and SYSTEM READY
    return {
      progress: 100,
      status: "SYSTEM READY",
    };
  }
}

export function LoadingScreen({
  onComplete,
  minDurationMs = 4000,
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("INITIALIZING...");
  const [isReady, setIsReady] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isUnmounted, setIsUnmounted] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(
    () => typeof document !== "undefined" && document.readyState === "complete"
  );

  const startTimeRef = useRef<number | null>(null);
  const hasTriggeredExitRef = useRef(false);

  // Detect when browser resources have completed loading
  useEffect(() => {
    if (typeof window !== "undefined" && document.readyState !== "complete") {
      const handleLoad = () => setIsPageLoaded(true);
      window.addEventListener("load", handleLoad);
      return () => window.removeEventListener("load", handleLoad);
    }
  }, []);

  useEffect(() => {
    let animFrame: number;

    const tick = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;

      const current = getProgressAndStatus(elapsed);
      setProgress(current.progress);
      setStatusText(current.status);

      if (elapsed >= 3800) {
        setIsReady(true);
      }

      // Check exit threshold: minimum 4 seconds AND page resources ready
      // (max of actual critical loading time and 4 seconds)
      const isCriticalReady = isPageLoaded || elapsed >= 4500;
      if (elapsed >= minDurationMs && isCriticalReady && !hasTriggeredExitRef.current) {
        hasTriggeredExitRef.current = true;
        setProgress(100);
        setStatusText("SYSTEM READY");
        setIsReady(true);

        // Begin smooth fade transition to homepage (500–800ms)
        setIsExiting(true);

        // After 650ms fade transition, unmount cleanly
        setTimeout(() => {
          setIsUnmounted(true);
          onComplete?.();
        }, 650);

        return;
      }

      if (!hasTriggeredExitRef.current) {
        animFrame = requestAnimationFrame(tick);
      }
    };

    animFrame = requestAnimationFrame(tick);

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [minDurationMs, onComplete, isPageLoaded]);

  // Allow instant skip on click or Enter/Escape
  const handleFastSkip = () => {
    if (!hasTriggeredExitRef.current) {
      hasTriggeredExitRef.current = true;
      setProgress(100);
      setStatusText("SYSTEM READY");
      setIsReady(true);
      setIsExiting(true);
      setTimeout(() => {
        setIsUnmounted(true);
        onComplete?.();
      }, 500);
    }
  };

  if (isUnmounted) return null;

  return (
    <div
      onClick={handleFastSkip}
      role="status"
      aria-live="polite"
      aria-label="FloatChat Ocean Intelligence is initializing"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#020814] select-none transition-all duration-700 ease-out ${
        isExiting
          ? "opacity-0 scale-[1.03] pointer-events-none blur-sm"
          : "opacity-100 scale-100 pointer-events-auto"
      }`}
    >
      {/* ========================================================================
          DEEP OCEAN ENVIRONMENT BACKGROUND
          ======================================================================== */}
      {/* Underwater Rays & Seabed Rock Base */}
      <div
        className="absolute inset-0 h-full w-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/underwater-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Layered Deep Navy Vignettes & Atmospheric Light Scattering */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020814]/75 via-[#020a18]/45 to-[#01040d]/85" />
      <div className="absolute inset-0 bg-radial from-[#00d2ff]/[0.08] via-transparent to-[#01040d]/70" />

      {/* Ambient Marine Snow / Bioluminescent Particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full bg-[#00d2ff] animate-pulse"
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              boxShadow: "0 0 6px rgba(0, 210, 255, 0.6)",
            }}
          />
        ))}
      </div>

      {/* ========================================================================
          DECORATIVE CORNER HUD TELEMETRY (Inspired by Reference Image)
          ======================================================================== */}
      {/* Top Right: Exploring a Healthier Ocean Tomorrow */}
      <div className="pointer-events-none absolute right-6 top-6 sm:right-10 sm:top-10 text-right font-mono text-[8.5px] sm:text-[9.5px] tracking-widest text-[#7090b0]/70 uppercase leading-relaxed hidden sm:block">
        <div>EXPLORING</div>
        <div>A HEALTHIER</div>
        <div>OCEAN TOMORROW</div>
        <div className="mt-1 h-[1px] w-6 bg-[#1a365d]/80 ml-auto" />
      </div>

      {/* Mid Left: Data Drives Deeper Discoveries */}
      <div className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 sm:left-10 text-left font-mono text-[8.5px] sm:text-[9.5px] tracking-widest text-[#7090b0]/70 uppercase leading-relaxed hidden md:block">
        <div>DATA</div>
        <div>DRIVES</div>
        <div>DEEPER</div>
        <div>DISCOVERIES</div>
        <div className="mt-1 h-[1px] w-6 bg-[#1a365d]/80 mr-auto" />
      </div>

      {/* Bottom Left: ARGO Network Global Ocean Observation */}
      <div className="pointer-events-none absolute left-6 bottom-6 sm:left-10 sm:bottom-10 text-left font-mono text-[8.5px] sm:text-[9.5px] tracking-widest text-[#7090b0]/70 uppercase leading-relaxed hidden sm:block">
        <div className="font-semibold text-[#8ea9c7]">ARGO NETWORK</div>
        <div>GLOBAL OCEAN OBSERVATION</div>
        <div className="mt-1 h-[1px] w-6 bg-[#1a365d]/80 mr-auto" />
      </div>

      {/* Bottom Right: Ocean Intelligence For A Brighter Planet */}
      <div className="pointer-events-none absolute right-6 bottom-6 sm:right-10 sm:bottom-10 text-right font-mono text-[8.5px] sm:text-[9.5px] tracking-widest text-[#7090b0]/70 uppercase leading-relaxed hidden sm:block">
        <div className="font-semibold text-[#8ea9c7]">OCEAN INTELLIGENCE</div>
        <div>FOR A BRIGHTER PLANET</div>
        <div className="mt-1 h-[1px] w-6 bg-[#1a365d]/80 ml-auto" />
      </div>

      {/* ========================================================================
          CENTER COMPOSITION: SONAR HUD + LOGO + BRAND + CHECKLIST + PROGRESS
          ======================================================================== */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 max-w-lg w-full">
        {/* Sonar HUD Container */}
        <div className="relative flex items-center justify-center w-[230px] h-[230px] sm:w-[270px] sm:h-[270px] md:w-[290px] md:h-[290px] mb-2 sm:mb-3">
          {/* Central Radial Cyan Aura */}
          <div className="absolute inset-4 rounded-full bg-radial from-[#00d2ff]/20 via-[#0284c7]/5 to-transparent blur-2xl pointer-events-none" />

          {/* Radar Scanning Arc (Rotating Conic Gradient Beam) */}
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none p-1 sm:p-2">
            <div
              className="w-full h-full rounded-full animate-sonar-sweep"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(0, 210, 255, 0.02) 290deg, rgba(0, 210, 255, 0.16) 340deg, rgba(0, 210, 255, 0.5) 358deg, rgba(0, 210, 255, 0.95) 360deg)",
              }}
            />
          </div>

          {/* Concentric Sonar Vector HUD SVG */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 300 300"
            fill="none"
          >
            {/* Outer Crosshair Guidelines */}
            <line
              x1="10"
              y1="150"
              x2="290"
              y2="150"
              stroke="rgba(0, 210, 255, 0.18)"
              strokeWidth="0.8"
              strokeDasharray="25 250 25"
            />
            <line
              x1="150"
              y1="10"
              x2="150"
              y2="290"
              stroke="rgba(0, 210, 255, 0.18)"
              strokeWidth="0.8"
              strokeDasharray="25 250 25"
            />

            {/* Outer Ring 3: Segmented Technical Arc */}
            <circle
              cx="150"
              cy="150"
              r="138"
              stroke="rgba(0, 210, 255, 0.35)"
              strokeWidth="1.2"
              strokeDasharray="95 18 45 18 135 18 35 18"
              className="animate-sonar-pulse"
            />

            {/* Outer Cardinal Ticks */}
            <circle cx="150" cy="12" r="1.5" fill="#00d2ff" opacity="0.8" />
            <circle cx="288" cy="150" r="1.5" fill="#00d2ff" opacity="0.8" />
            <circle cx="150" cy="288" r="1.5" fill="#00d2ff" opacity="0.8" />
            <circle cx="12" cy="150" r="1.5" fill="#00d2ff" opacity="0.8" />

            {/* Middle Ring 2: Subtle Dotted Ocean Depth Horizon */}
            <circle
              cx="150"
              cy="150"
              r="102"
              stroke="rgba(0, 210, 255, 0.28)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />

            {/* Inner Ring 1: Near-Field Beacon Orbit */}
            <circle
              cx="150"
              cy="150"
              r="68"
              stroke="rgba(0, 210, 255, 0.38)"
              strokeWidth="1"
            />

            {/* Sonar Beacon Pings (Data Points along the rings) */}
            <circle
              cx="222"
              cy="78"
              r="3.2"
              fill="#00d2ff"
              className="animate-sonar-ping"
              style={{ filter: "drop-shadow(0 0 6px #00d2ff)" }}
            />
            <circle
              cx="72"
              cy="185"
              r="2.5"
              fill="#38bdf8"
              className="animate-sonar-ping"
              style={{ animationDelay: "1.2s", filter: "drop-shadow(0 0 4px #38bdf8)" }}
            />
            <circle
              cx="198"
              cy="200"
              r="2"
              fill="#00d2ff"
              className="animate-sonar-ping"
              style={{ animationDelay: "0.6s" }}
            />
          </svg>

          {/* Central 3D FloatChat Water Orb Logo */}
          <div className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center animate-logo-breathe drop-shadow-[0_0_25px_rgba(0,210,255,0.6)]">
            <Image
              src="/images/floatchat-orb.png"
              alt="FloatChat Ocean Intelligence"
              fill
              sizes="(max-width: 640px) 96px, (max-width: 768px) 112px, 128px"
              priority
              className="object-contain"
            />
          </div>
        </div>

        {/* Brand Name: Float (White) + Chat (Cyan) */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-sans text-white leading-none mb-1.5 drop-shadow-[0_0_20px_rgba(0,210,255,0.35)]">
          Float<span className="text-[#00d2ff]">Chat</span>
        </h1>

        {/* Subtitle: OCEAN INTELLIGENCE */}
        <div className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.35em] text-[#38bdf8] uppercase mb-4 sm:mb-5">
          OCEAN INTELLIGENCE
        </div>

        {/* Status Line: INITIALIZING... or SYSTEM READY */}
        <div className="flex items-center gap-1.5 font-mono text-[10px] sm:text-[11px] font-medium tracking-[0.25em] text-[#00d2ff] uppercase mb-4 sm:mb-5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00d2ff] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00d2ff]" />
          </span>
          <span>{statusText}</span>
        </div>

        {/* Loading Step Checklist (Matching Reference Image) */}
        <div className="flex flex-col gap-2 sm:gap-2.5 w-64 sm:w-72 text-left mb-6 font-sans">
          {STEPS.map((step, idx) => {
            const isCompleted = progress >= step.threshold || isReady;
            const prevStep = idx > 0 ? STEPS[idx - 1] : null;
            const isActive =
              !isCompleted &&
              (prevStep == null || progress >= prevStep.threshold);

            return (
              <div
                key={step.id}
                className="flex items-center gap-3 text-xs sm:text-[13px] transition-colors duration-200"
              >
                {/* Status Indicator Icon */}
                {isCompleted ? (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#00d2ff] text-[#020814] shadow-[0_0_8px_rgba(0,210,255,0.7)]">
                    <svg
                      className="h-2.5 w-2.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : isActive ? (
                  <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                    <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-[#00d2ff] opacity-40" />
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#00d2ff] bg-[#00d2ff]/20 shadow-[0_0_8px_rgba(0,210,255,0.8)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00d2ff]" />
                    </span>
                  </span>
                ) : (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#334155]/90 bg-transparent" />
                )}

                {/* Step Label */}
                <span
                  className={`leading-tight transition-colors duration-300 ${
                    isCompleted
                      ? "text-[#cbd5e1]"
                      : isActive
                      ? "text-white font-medium drop-shadow-[0_0_6px_rgba(0,210,255,0.5)]"
                      : "text-[#64748b]"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Thin Horizontal Progress Bar + Percentage */}
        <div className="flex items-center gap-3 w-72 sm:w-80 md:w-96 mb-3 sm:mb-4">
          <div className="relative h-1 sm:h-[3.5px] flex-1 bg-[#041122]/90 rounded-full overflow-hidden border border-[#1a365d]/70 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#00b4d8] to-[#00f2fe] rounded-full shadow-[0_0_12px_rgba(0,210,255,0.9)] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-xs sm:text-[13px] text-[#94a3b8] font-medium w-9 text-right shrink-0">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Bottom Message */}
        <div className="text-[9px] sm:text-[10px] font-mono tracking-[0.3em] text-[#64748b] uppercase">
          REAL DATA. HEALTHIER OCEANS.
        </div>
      </div>
    </div>
  );
}
