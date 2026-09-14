"use client";

import React from "react";
import Image from "next/image";

interface HeaderProps {
  onOpenLayers?: () => void;
  onOpenData?: () => void;
  onOpenAbout?: () => void;
  onOpenChat?: () => void;
  onResetGlobe?: () => void;
}

export function Header({
  onOpenLayers,
  onOpenData,
  onOpenAbout,
  onOpenChat,
  onResetGlobe,
}: HeaderProps) {
  return (
    <header className="relative z-20 flex w-full items-center justify-between px-6 py-3 sm:px-10 bg-[#020612]/40 backdrop-blur-md border-b border-[#1a2f4c]/40 transition-colors">
      {/* Left: Brand Logo + ARGO 1.0 + Live Status */}
      <div className="flex items-center gap-3 sm:gap-3.5">
        {/* FloatChat Glowing Ocean Orb Logo */}
        <div
          className="group flex items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-100"
          onClick={onOpenAbout}
          title="About FloatChat & ARGO Program"
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_0_12px_rgba(0,210,255,0.5)]">
            <Image
              src="/images/floatchat-orb.png"
              alt="FloatChat Logo"
              fill
              sizes="32px"
              priority
              className="object-contain"
            />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-[#ececec] font-sans leading-none flex items-center">
            Float<span className="text-[#00d2ff]">Chat</span>
          </span>
        </div>

        {/* Version Badge */}
        <span className="rounded border border-[#1a2f4c] bg-[#061224]/80 px-2 py-0.5 text-[10px] font-mono font-medium text-[#7090b0] tracking-wider">
          ARGO 1.0
        </span>

        {/* Live Network Status Pill Matching Reference: ● ARGO NETWORK • 3,940 Floats Live */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#1a2f4c] bg-[#061224]/80 px-3 py-0.5 text-[11px] backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10b981] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10b981]" />
          </span>
          <span className="font-semibold uppercase tracking-wider text-[#ececec] font-sans text-[10px]">
            ARGO NETWORK
          </span>
          <span className="text-[#4a5568]">•</span>
          <span className="font-mono text-[#94a3b8] text-[10px]">
            3,940 Floats Live
          </span>
        </div>
      </div>

      {/* Right: Nav Links + Globe Icon + AI Chat Launcher */}
      <div className="flex items-center gap-5 sm:gap-7">
        <nav className="hidden md:flex items-center gap-6 text-[11px] font-medium tracking-widest text-[#94a3b8] uppercase font-sans">
          <button
            type="button"
            onClick={onResetGlobe}
            className="hover:text-[#00d2ff] transition-colors cursor-pointer"
          >
            EXPLORE
          </button>
          <button
            type="button"
            onClick={onOpenLayers}
            className="hover:text-[#00d2ff] transition-colors cursor-pointer"
          >
            LAYERS
          </button>
          <button
            type="button"
            onClick={onOpenData}
            className="hover:text-[#00d2ff] transition-colors cursor-pointer"
          >
            DATA
          </button>
          <button
            type="button"
            onClick={onOpenAbout}
            className="hover:text-[#00d2ff] transition-colors cursor-pointer"
          >
            ABOUT
          </button>
        </nav>

        <div className="flex items-center gap-3">

          {/* AI Chat Launcher Badge (Cyan pill with glowing dot) */}
          <button
            type="button"
            onClick={onOpenChat}
            className="flex h-8 px-3.5 items-center gap-2 rounded-full border border-[#00d2ff]/40 bg-[#00d2ff]/10 text-xs font-mono font-semibold text-[#00d2ff] shadow-[0_0_15px_rgba(0,210,255,0.18)] cursor-pointer hover:bg-[#00d2ff] hover:text-[#020612] transition-all"
            aria-label="Open AI Chat Assistant"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00d2ff] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00d2ff]" />
            </span>
            <span>AI CHAT</span>
          </button>
        </div>
      </div>
    </header>
  );
}
