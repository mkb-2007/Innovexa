"use client";

import type { GeoLocation } from "@/types/globe";

export interface GlobeSelectionProps {
  location?: GeoLocation | null;
  onClear?: () => void;
  onExplore?: (location: GeoLocation) => void;
  onResetGlobal?: () => void;
  onOpenDepthProfile?: () => void;
  onAskAI?: (prompt: string) => void;
}

/**
 * GlobeSelection popup has been disabled per user request.
 * Geographic selections are now routed to the LEFT FloatChat AI panel.
 */
export function GlobeSelection() {
  return null;
}
