"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { processUserQuery } from "@/lib/ai/chatEngine";
import type { ChatMessage, GeoLocation, MapActions } from "@/types/globe";

export interface UseOceanChatOptions {
  onGlobeAction?: (actions: MapActions) => void;
  onNavigateToLocation?: (loc: GeoLocation, floatId?: number) => void;
}

export function useOceanChat(
  onGlobeActionOrOptions?: ((actions: MapActions) => void) | UseOceanChatOptions | ((loc: GeoLocation, floatId?: number) => void),
  onNavigateToLocationParam?: (loc: GeoLocation, floatId?: number) => void
) {
  // Resolve callbacks from flexible argument signatures
  let resolvedGlobeAction: ((actions: MapActions) => void) | undefined;
  let resolvedNavigate: ((loc: GeoLocation, floatId?: number) => void) | undefined;

  if (typeof onGlobeActionOrOptions === "object" && onGlobeActionOrOptions !== null) {
    resolvedGlobeAction = onGlobeActionOrOptions.onGlobeAction;
    resolvedNavigate = onGlobeActionOrOptions.onNavigateToLocation;
  } else if (typeof onGlobeActionOrOptions === "function") {
    if (typeof onNavigateToLocationParam === "function") {
      resolvedGlobeAction = onGlobeActionOrOptions as (actions: MapActions) => void;
      resolvedNavigate = onNavigateToLocationParam;
    } else {
      resolvedGlobeAction = onGlobeActionOrOptions as (actions: MapActions) => void;
    }
  }

  const onGlobeActionRef = useRef(resolvedGlobeAction);
  const onNavigateToLocationRef = useRef(resolvedNavigate);

  useEffect(() => {
    onGlobeActionRef.current = resolvedGlobeAction;
    onNavigateToLocationRef.current = resolvedNavigate;
  }, [resolvedGlobeAction, resolvedNavigate]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "### Welcome to FloatChat Ocean AI\n\nI am your autonomous ocean telemetry assistant connected to 3,940 active ARGO floats worldwide.\n\nAsk me anything about ocean salinity, temperature anomalies, thermoclines, or specific ocean basins!",
      timestamp: "10:00 AM",
    },
  ]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsChatOpen(true);
      setIsTyping(true);

      try {
        // Dispatch to Next.js API Route Handler (Multi-Modal Semantic Query Engine)
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmed,
            prompt: trimmed,
            query: trimmed,
          }),
        });

        if (!response.ok) {
          throw new Error(`API server returned HTTP ${response.status}`);
        }

        const data = await response.json();

        // Push responseText seamlessly into layout message array
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: "assistant",
          text: data.responseText || "Oceanographic analysis synchronized.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mapActions: data.mapActions,
          targetFloatId: data.targetFloatId,
          targetLocation: data.targetLocation,
          explorerContext: data.explorerContext,
          telemetryMetrics: data.telemetryMetrics,
          chartData: data.chartData,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Extract nested mapActions block and pipe immediately into onGlobeAction callback
        if (data.mapActions && onGlobeActionRef.current) {
          onGlobeActionRef.current(data.mapActions);
        }

        // Secondary camera navigation if targetLocation is present
        if (data.targetLocation && onNavigateToLocationRef.current) {
          onNavigateToLocationRef.current(data.targetLocation, data.targetFloatId);
        }
      } catch (err) {
        console.warn("[FloatChat] API call failed, falling back to local chat engine:", err);
        const fallback = processUserQuery(trimmed);

        const synthesizedActions: MapActions = {
          shouldFlyTo: true,
          targetCoordinates: fallback.targetLocation
            ? [fallback.targetLocation.longitude, fallback.targetLocation.latitude]
            : [88.5, 15.2],
          highlightVariable: trimmed.toLowerCase().includes("temp") ? "temperature" : "salinity",
          depthReach: fallback.explorerContext?.maxDepth || 2000,
          isAnomaly: false,
        };

        fallback.mapActions = synthesizedActions;
        setMessages((prev) => [...prev, fallback]);

        if (onGlobeActionRef.current) {
          onGlobeActionRef.current(synthesizedActions);
        }

        if (fallback.targetLocation && onNavigateToLocationRef.current) {
          onNavigateToLocationRef.current(fallback.targetLocation, fallback.targetFloatId);
        }
      } finally {
        setIsTyping(false);
      }
    },
    []
  );

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  return {
    messages,
    sendMessage,
    loading: isTyping,
    isTyping,
    isChatOpen,
    toggleChat,
    openChat,
    closeChat,
  };
}
