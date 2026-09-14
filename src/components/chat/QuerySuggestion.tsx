import React from "react";

interface QuerySuggestionProps {
  label: string;
  icon?: React.ReactNode;
  onClick?: (label: string) => void;
}

export function QuerySuggestion({
  label,
  icon,
  onClick,
}: QuerySuggestionProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(label)}
      className="suggestion-chip group inline-flex items-center gap-2 rounded-full border border-[#383838] bg-[#2f2f2f]/80 px-4 py-2 text-xs font-medium text-[#b4b4b4] shadow-lg backdrop-blur-md transition-all hover:border-[#00d2ff]/50 hover:bg-[#2f2f2f] hover:text-[#00d2ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d2ff]/50 active:scale-[0.98] cursor-pointer"
    >
      {icon && <span className="text-[#00d2ff]/80 text-xs transition-colors group-hover:text-[#00d2ff]">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
