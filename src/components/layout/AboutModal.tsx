"use client";

import React from "react";
import Image from "next/image";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6 animate-fade-in">
      <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-[#383838] bg-[#212121] p-6 shadow-2xl backdrop-blur-xl overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#383838] pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center drop-shadow-[0_0_12px_rgba(0,210,255,0.45)]">
              <Image
                src="/images/floatchat-orb.png"
                alt="FloatChat Logo"
                fill
                sizes="40px"
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#ececec] tracking-wide font-sans">
                About Float<span className="text-[#00d2ff]">Chat</span> & ARGO Network
              </h2>
              <p className="text-xs text-[#00d2ff] font-mono">
                OCEAN INTELLIGENCE FOR A BRIGHTER TOMORROW
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8e8e] hover:bg-[#2f2f2f] hover:text-[#ececec] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 font-sans text-xs text-[#b4b4b4] leading-relaxed">
          {/* Brand Emblem Hero Card */}
          <div className="relative flex w-full flex-col items-center justify-center rounded-xl border border-[#00d2ff]/20 bg-gradient-to-b from-[#011425] to-[#171717] p-6 shadow-lg overflow-hidden">
            <div className="relative h-32 w-32 drop-shadow-[0_0_20px_rgba(0,210,255,0.5)]">
              <Image
                src="/images/floatchat-orb.png"
                alt="FloatChat - Ocean Intelligence for a Brighter Tomorrow"
                fill
                className="object-contain"
                priority
              />
            </div>
            <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-white font-sans">
              Float<span className="text-[#00d2ff]">Chat</span>
            </h3>
            <p className="mt-1 text-[11px] font-mono tracking-widest text-[#00d2ff] uppercase">
              Ocean Intelligence for a Brighter Tomorrow
            </p>
          </div>

          <section className="rounded-xl border border-[#383838] bg-[#171717] p-4">
            <h3 className="text-sm font-bold text-[#ececec] font-sans uppercase tracking-wider mb-2">
              What is the ARGO Program?
            </h3>
            <p>
              ARGO is an international oceanographic observation network comprising over 3,900 autonomous profiling floats drifting across global oceans. Every 10 days, each float dives down to 2,000 meters (or up to 6,000 meters for Deep ARGO), measuring temperature, salinity, and oxygen profiles as it surfaces, and transmitting real-time satellite telemetry to global science centers.
            </p>
          </section>

          <section className="rounded-xl border border-[#383838] bg-[#171717] p-4">
            <h3 className="text-sm font-bold text-[#ececec] font-sans uppercase tracking-wider mb-2">
              FloatChat Features
            </h3>
            <ul className="list-disc pl-4 space-y-1.5 text-[#b4b4b4]">
              <li>
                <strong className="text-[#00d2ff]">Interactive 3D Earth:</strong> Full 3D geospatial rendering of active floats powered by Cesium WebGL.
              </li>
              <li>
                <strong className="text-[#00d2ff]">AI Telemetry Assistant:</strong> Ask natural questions about salinity anomalies, marine heatwaves, or ocean basin dynamics.
              </li>
              <li>
                <strong className="text-[#00d2ff]">4D Depth Profiles:</strong> High-resolution thermocline and halocline depth series visualizer (0–2000m).
              </li>
              <li>
                <strong className="text-[#00d2ff]">Global Data Explorer:</strong> Tabular search, filter by basin, WMO ID lookup, and technical float specs.
              </li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#00d2ff] px-5 py-2 text-xs font-bold text-[#020814] hover:bg-[#38bdf8] transition-all shadow-[0_0_15px_rgba(0,210,255,0.35)] cursor-pointer"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
}
