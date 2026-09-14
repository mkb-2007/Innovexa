import React from "react";

interface StatusIndicatorProps {
  label?: string;
  status?: "active" | "standby" | "syncing";
  detail?: string;
  className?: string;
}

export function StatusIndicator({
  label = "ARGO NETWORK",
  status = "active",
  detail = "3,940 Floats Live",
  className = "",
}: StatusIndicatorProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[#383838] bg-[#2f2f2f]/80 px-2.5 py-1 text-xs font-mono text-[#ececec] shadow-sm backdrop-blur-sm ${className}`}
      aria-label={`${label} status: ${status}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span className="font-medium tracking-wide text-[#ececec]">
        {label}
      </span>
      {detail && (
        <>
          <span className="text-[#555]">•</span>
          <span className="text-[#8e8e8e] hidden sm:inline">{detail}</span>
        </>
      )}
    </div>
  );
}
