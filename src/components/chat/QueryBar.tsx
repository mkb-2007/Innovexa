"use client";

import React, { useState } from "react";

interface QueryBarProps {
  onSubmitQuery?: (query: string) => void;
}

const SUGGESTIONS = [
  { label: "Bay of Bengal salinity", icon: "🌊" },
  { label: "Marine heatwaves", icon: "🔥" },
  { label: "Deep ocean 6000m", icon: "🔬" },
  { label: "How ARGO floats work", icon: "🛰️" },
];

export function QueryBar({ onSubmitQuery }: QueryBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (onSubmitQuery) {
      onSubmitQuery(query);
    }
    setQuery("");
  };

  const handleSuggestionClick = (label: string) => {
    if (onSubmitQuery) {
      onSubmitQuery(label);
    }
  };

  return (
    <div className="w-full max-w-2xl px-4 animate-fade-in-delayed flex flex-col items-center">
      {/* Floating Glass Command Bar Matching Reference */}
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full items-center rounded-full border border-[#00d2ff]/35 bg-[#07162b]/80 py-2 pl-5 pr-2.5 shadow-[0_0_30px_rgba(0,180,255,0.14)] backdrop-blur-xl transition-all duration-300 hover:border-[#00d2ff]/50 focus-within:border-[#00d2ff]/75 focus-within:shadow-[0_0_40px_rgba(0,210,255,0.25)]"
      >
        {/* Left Cyan Magnifying Glass Icon */}
        <div className="flex pr-3 text-[#00d2ff] shrink-0">
          <svg
            className="h-4.5 w-4.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>

        {/* Input Field */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask FloatChat anything about ocean telemetry, salinity, floats..."
          aria-label="Ask FloatChat anything about ocean telemetry"
          className="w-full bg-transparent py-1 text-xs sm:text-[13.5px] text-[#e2e8f0] placeholder-[#64748b] focus:outline-none font-sans"
        />

        {/* Circular Send / Forward Button Matching Reference */}
        <button
          type="submit"
          aria-label="Submit query"
          disabled={!query.trim()}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${query.trim()
              ? "bg-[#00d2ff] text-[#020817] shadow-[0_0_12px_rgba(0,210,255,0.6)] hover:bg-[#38bdf8]"
              : "bg-[#1e324a] text-[#8ca8cb] hover:bg-[#284566] hover:text-[#e0f2fe]"
            }`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </form>

      {/* Suggestion Chips Matching Reference */}
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => handleSuggestionClick(s.label)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-[#162d47] bg-[#061527]/75 px-3 py-1 text-[11px] font-medium text-[#7e9bbd] backdrop-blur-md transition-all duration-200 hover:border-[#00d2ff]/40 hover:bg-[#0a1e38]/85 hover:text-[#e0f2fe] hover:shadow-[0_0_12px_rgba(0,210,255,0.12)] cursor-pointer"
          >
            <span className="text-xs opacity-90 transition-transform duration-200 group-hover:scale-110">
              {s.icon}
            </span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
