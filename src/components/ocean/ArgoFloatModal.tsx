"use client";

import React from "react";
import type { ArgoFloat, GeoLocation } from "@/types/globe";

interface ArgoFloatModalProps {
  isOpen: boolean;
  onClose: () => void;
  float: ArgoFloat | null;
  onFlyToLocation?: (loc: GeoLocation) => void;
  onOpenDepthViewer?: () => void;
}

export function ArgoFloatModal({
  isOpen,
  onClose,
  float,
  onFlyToLocation,
  onOpenDepthViewer,
}: ArgoFloatModalProps) {
  if (!isOpen || !float) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6 animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl border border-[#383838] bg-[#212121] p-6 shadow-2xl backdrop-blur-xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#383838] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#10b981] animate-pulse" />
              <h2 className="text-xl font-bold text-[#ececec] tracking-wide font-sans">
                {float.name}
              </h2>
            </div>
            <p className="text-xs text-[#00d2ff] font-mono">
              WMO ID #{float.wmoId} • {float.basin}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8e8e] hover:bg-[#2f2f2f] hover:text-[#ececec] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Float Spec Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="rounded-xl border border-[#383838] bg-[#2f2f2f] p-3">
            <span className="text-[10px] text-[#8e8e8e] uppercase">Latitude</span>
            <div className="text-sm font-semibold text-[#ececec]">
              {Math.abs(float.latitude).toFixed(2)}° {float.latitude >= 0 ? "N" : "S"}
            </div>
          </div>
          <div className="rounded-xl border border-[#383838] bg-[#2f2f2f] p-3">
            <span className="text-[10px] text-[#8e8e8e] uppercase">Longitude</span>
            <div className="text-sm font-semibold text-[#ececec]">
              {Math.abs(float.longitude).toFixed(2)}° {float.longitude >= 0 ? "E" : "W"}
            </div>
          </div>
          <div className="rounded-xl border border-[#383838] bg-[#2f2f2f] p-3">
            <span className="text-[10px] text-[#8e8e8e] uppercase">Deployment Date</span>
            <div className="text-sm font-semibold text-[#b4b4b4]">{float.deploymentDate}</div>
          </div>
          <div className="rounded-xl border border-[#383838] bg-[#2f2f2f] p-3">
            <span className="text-[10px] text-[#8e8e8e] uppercase">Last Profile Date</span>
            <div className="text-sm font-semibold text-[#00d2ff]">{float.lastProfileDate}</div>
          </div>
          <div className="rounded-xl border border-[#383838] bg-[#2f2f2f] p-3">
            <span className="text-[10px] text-[#8e8e8e] uppercase">Institution</span>
            <div className="text-sm font-semibold text-[#ececec]">{float.institution}</div>
          </div>
          <div className="rounded-xl border border-[#383838] bg-[#2f2f2f] p-3">
            <span className="text-[10px] text-[#8e8e8e] uppercase">Country</span>
            <div className="text-sm font-semibold text-[#ececec]">{float.country}</div>
          </div>
        </div>

        {/* Battery & Health Bar */}
        <div className="mt-4 flex flex-col gap-1 rounded-xl border border-[#383838] bg-[#171717] p-3">
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-[#8e8e8e]">BATTERY POWER</span>
            <span className="text-[#00d2ff] font-bold">{float.batteryPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#2f2f2f] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#00d2ff]"
              style={{ width: `${float.batteryPercent}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          {onFlyToLocation && (
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
              className="rounded-xl border border-[#383838] bg-[#2f2f2f] px-4 py-2 text-xs font-semibold text-[#ececec] hover:bg-[#383838] transition-all cursor-pointer"
            >
              Zoom on Globe
            </button>
          )}

          {onOpenDepthViewer && (
            <button
              type="button"
              onClick={() => {
                onOpenDepthViewer();
                onClose();
              }}
              className="rounded-xl bg-[#00d2ff] px-4 py-2 text-xs font-bold text-[#020814] hover:bg-[#38bdf8] transition-all shadow-[0_0_15px_rgba(0,210,255,0.35)] cursor-pointer"
            >
              View Depth Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
