"use client";

import React, { useState } from "react";
import { ARGO_FLOATS } from "@/data/argoFloats";
import type { ArgoFloat, GeoLocation } from "@/types/globe";

interface DataExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFloat: (float: ArgoFloat) => void;
  onFlyToLocation: (loc: GeoLocation) => void;
}

export function DataExplorerModal({
  isOpen,
  onClose,
  onSelectFloat,
  onFlyToLocation,
}: DataExplorerModalProps) {
  const [search, setSearch] = useState("");
  const [basinFilter, setBasinFilter] = useState("all");

  if (!isOpen) return null;

  const basins = [
    "all",
    "Bay of Bengal",
    "Andaman Sea",
    "Arabian Sea",
    "Indian Ocean",
    "North Pacific Ocean",
    "South Pacific Ocean",
    "South China Sea",
    "Coral Sea",
    "Tasman Sea",
    "Bering Sea",
    "North Atlantic Ocean",
    "South Atlantic Ocean",
    "Caribbean Sea",
    "Gulf of Mexico",
    "Mediterranean Sea",
    "Red Sea",
    "Norwegian Sea",
    "Southern Ocean",
    "Arctic Ocean",
  ];

  const filtered = ARGO_FLOATS.filter((f) => {
    const matchesBasin = basinFilter === "all" || f.basin === basinFilter;
    const matchesSearch =
      !search ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.wmoId.toString().includes(search) ||
      f.basin.toLowerCase().includes(search.toLowerCase()) ||
      f.institution.toLowerCase().includes(search.toLowerCase());

    return matchesBasin && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6 animate-fade-in">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-[#383838] bg-[#212121] p-6 shadow-2xl backdrop-blur-xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#383838] pb-4">
          <div className="flex items-center gap-3">
            <svg
              className="h-6 w-6 text-[#00d2ff]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            <div>
              <h2 className="text-xl font-bold text-[#ececec] tracking-wide font-sans">
                ARGO Global Telemetry Data Explorer
              </h2>
              <p className="text-xs text-[#8e8e8e]">
                Displaying {filtered.length} active profiling floats worldwide
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

        {/* Search & Basin Filter Controls */}
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search float WMO ID, ocean basin, institution..."
            className="w-full sm:flex-1 rounded-xl border border-[#383838] bg-[#2f2f2f] px-4 py-2 text-sm text-[#ececec] placeholder-[#8e8e8e] focus:border-[#00d2ff] focus:outline-none font-mono"
          />
          <select
            value={basinFilter}
            onChange={(e) => setBasinFilter(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-[#383838] bg-[#2f2f2f] px-4 py-2 text-sm text-[#ececec] focus:border-[#00d2ff] focus:outline-none font-mono cursor-pointer"
          >
            {basins.map((b) => (
              <option key={b} value={b} className="bg-[#212121]">
                {b === "all" ? "All Ocean Basins" : b}
              </option>
            ))}
          </select>
        </div>

        {/* Float Data Table */}
        <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-[#383838] bg-[#171717]">
          <table className="w-full text-left font-mono text-xs text-[#ececec]">
            <thead className="sticky top-0 bg-[#212121] text-[11px] uppercase tracking-wider text-[#00d2ff] border-b border-[#383838]">
              <tr>
                <th className="p-3">WMO ID</th>
                <th className="p-3">Basin</th>
                <th className="p-3">Lat / Lon</th>
                <th className="p-3">SST (°C)</th>
                <th className="p-3">Salinity (PSU)</th>
                <th className="p-3">Max Depth</th>
                <th className="p-3">Institution</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2f2f2f]">
              {filtered.map((float) => (
                <tr
                  key={float.id}
                  className="hover:bg-[#2f2f2f]/60 transition-colors"
                >
                  <td className="p-3 font-semibold text-[#ececec]">
                    #{float.wmoId}
                  </td>
                  <td className="p-3 text-[#00d2ff]">{float.basin}</td>
                  <td className="p-3 text-[#8e8e8e]">
                    {float.latitude}°, {float.longitude}°
                  </td>
                  <td className="p-3 text-[#ececec]">{float.surfaceTemp}°C</td>
                  <td className="p-3 text-[#60a5fa]">{float.surfaceSalinity} PSU</td>
                  <td className="p-3 text-[#b4b4b4]">{float.maxDepth}m</td>
                  <td className="p-3 text-[#8e8e8e]">{float.institution}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectFloat(float);
                          onClose();
                        }}
                        className="rounded-md border border-[#00d2ff]/40 bg-[#00d2ff]/10 px-2.5 py-1 text-[11px] text-[#00d2ff] hover:bg-[#00d2ff] hover:text-[#020814] transition-all cursor-pointer"
                      >
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onFlyToLocation({
                            latitude: float.latitude,
                            longitude: float.longitude,
                            regionName: float.basin,
                            wmoId: float.wmoId,
                          });
                          onClose();
                        }}
                        className="rounded-md border border-[#383838] bg-[#2f2f2f] px-2.5 py-1 text-[11px] text-[#ececec] hover:bg-[#383838] transition-all cursor-pointer"
                      >
                        Fly To
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
