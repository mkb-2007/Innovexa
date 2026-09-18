"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { processUserQuery } from "@/lib/ai/chatEngine";
import type { ChatMessage, GeoLocation, MapActions, ArgoFloat, ExplorerContext } from "@/types/globe";

export interface SavedConversation {
  id: string;
  title: string;
  timestamp: string;
  messages: ChatMessage[];
}

export interface UseOceanChatOptions {
  onGlobeAction?: (actions: MapActions) => void;
  onNavigateToLocation?: (loc: GeoLocation, floatId?: number) => void;
  selectedFloat?: ArgoFloat | null;
  onFocusFloat?: (floatId: number, coordinates?: [number, number]) => void;
  onOpen4DExplorer?: (context: ExplorerContext) => void;
}

const INITIAL_WELCOME: ChatMessage = {
  id: "welcome-1",
  sender: "assistant",
  text: "### Welcome to FloatChat Ocean AI\n\nI am your autonomous ocean telemetry assistant connected to 3,940 active ARGO floats worldwide.\n\nAsk me anything about ocean salinity, temperature anomalies, thermoclines, or select any float on the 3D globe to analyze its live profile.",
  timestamp: "10:00 AM",
};

function generateSessionId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function useOceanChat(
  onGlobeActionOrOptions?: ((actions: MapActions) => void) | UseOceanChatOptions | ((loc: GeoLocation, floatId?: number) => void),
  onNavigateToLocationParam?: (loc: GeoLocation, floatId?: number) => void
) {
  // Resolve callbacks and options from flexible argument signatures
  let resolvedGlobeAction: ((actions: MapActions) => void) | undefined;
  let resolvedNavigate: ((loc: GeoLocation, floatId?: number) => void) | undefined;
  let resolvedSelectedFloat: ArgoFloat | null = null;
  let resolvedFocusFloat: ((floatId: number, coordinates?: [number, number]) => void) | undefined;
  let resolvedOpen4DExplorer: ((context: ExplorerContext) => void) | undefined;

  if (typeof onGlobeActionOrOptions === "object" && onGlobeActionOrOptions !== null) {
    resolvedGlobeAction = onGlobeActionOrOptions.onGlobeAction;
    resolvedNavigate = onGlobeActionOrOptions.onNavigateToLocation;
    resolvedSelectedFloat = onGlobeActionOrOptions.selectedFloat || null;
    resolvedFocusFloat = onGlobeActionOrOptions.onFocusFloat;
    resolvedOpen4DExplorer = onGlobeActionOrOptions.onOpen4DExplorer;
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
  const selectedFloatRef = useRef<ArgoFloat | null>(resolvedSelectedFloat);
  const onFocusFloatRef = useRef(resolvedFocusFloat);
  const onOpen4DExplorerRef = useRef(resolvedOpen4DExplorer);

  // Keep callback refs synchronously up-to-date
  onGlobeActionRef.current = resolvedGlobeAction;
  onNavigateToLocationRef.current = resolvedNavigate;
  selectedFloatRef.current = resolvedSelectedFloat;
  onFocusFloatRef.current = resolvedFocusFloat;
  onOpen4DExplorerRef.current = resolvedOpen4DExplorer;

  useEffect(() => {
    onGlobeActionRef.current = resolvedGlobeAction;
    onNavigateToLocationRef.current = resolvedNavigate;
    selectedFloatRef.current = resolvedSelectedFloat;
    onFocusFloatRef.current = resolvedFocusFloat;
    onOpen4DExplorerRef.current = resolvedOpen4DExplorer;
  }, [resolvedGlobeAction, resolvedNavigate, resolvedSelectedFloat, resolvedFocusFloat, resolvedOpen4DExplorer]);

  // Unique session ID for isolating conversation streams
  const [sessionId, setSessionId] = useState<string>(() => generateSessionId());
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("floatchat_saved_conversations");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return [];
  });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Sync saved conversations to localStorage
  const persistSavedConversations = useCallback((convs: SavedConversation[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("floatchat_saved_conversations", JSON.stringify(convs));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // 1. Completely Fresh "New Chat" Flow
  const createNewChat = useCallback(() => {
    const currentMsgs = messagesRef.current;
    const hasUserMsg = currentMsgs.some((m) => m.sender === "user");

    // Archive current conversation if it contained user interaction
    if (hasUserMsg) {
      const firstUserMsg = currentMsgs.find((m) => m.sender === "user");
      const title = firstUserMsg
        ? firstUserMsg.text.slice(0, 36) + (firstUserMsg.text.length > 36 ? "..." : "")
        : "Ocean Telemetry Analysis";

      const archived: SavedConversation = {
        id: sessionIdRef.current,
        title,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        messages: [...currentMsgs],
      };

      setSavedConversations((prev) => {
        const updated = [archived, ...prev.filter((c) => c.id !== archived.id)].slice(0, 20);
        persistSavedConversations(updated);
        return updated;
      });
    }

    // Generate brand new session ID
    const nextSessionId = generateSessionId();
    sessionIdRef.current = nextSessionId;
    setSessionId(nextSessionId);

    // Immediately clear displayed messages and reset to clean session welcome
    const freshWelcome: ChatMessage = {
      id: `welcome-${Date.now()}`,
      sender: "assistant",
      text: "### New Conversation Started\n\nI am your autonomous ocean telemetry assistant connected to 3,940 active ARGO floats worldwide.\n\nAsk me anything about ocean salinity, temperature anomalies, thermoclines, or select any float on the 3D globe to analyze its live profile.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages([freshWelcome]);
    messagesRef.current = [freshWelcome];
    setIsTyping(false);
  }, [persistSavedConversations]);

  // Load a previously archived conversation
  const loadSavedConversation = useCallback((targetId: string) => {
    const target = savedConversations.find((c) => c.id === targetId);
    if (!target) return;

    sessionIdRef.current = target.id;
    setSessionId(target.id);
    setMessages(target.messages);
    messagesRef.current = target.messages;
    setIsChatOpen(true);
  }, [savedConversations]);

  // Send message pipeline with exact latest prompt, isolated history, and selected float context
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

      // Append immediately to active conversation
      setMessages((prev) => [...prev, userMsg]);
      setIsChatOpen(true);
      setIsTyping(true);

      // Extract isolated conversation history strictly for the CURRENT session
      const currentHistory = messagesRef.current
        .filter((m) => !String(m.id).startsWith("welcome-") && !String(m.id).startsWith("error-"))
        .slice(-8)
        .map((m) => ({
          role: (m.sender === "user" ? "user" : "assistant") as "user" | "assistant",
          text: m.text || "",
        }));

      // Current active selected float context snapshot
      const activeFloat = selectedFloatRef.current;
      const floatPayload = activeFloat
        ? {
            id: activeFloat.id,
            wmoId: activeFloat.wmoId,
            name: activeFloat.name,
            latitude: activeFloat.latitude,
            longitude: activeFloat.longitude,
            basin: activeFloat.basin,
            deploymentDate: activeFloat.deploymentDate,
            lastProfileDate: activeFloat.lastProfileDate,
            status: activeFloat.status,
            cycleNumber: activeFloat.cycleNumber,
            maxDepth: activeFloat.maxDepth,
            surfaceTemp: activeFloat.surfaceTemp,
            surfaceSalinity: activeFloat.surfaceSalinity,
            country: activeFloat.country,
            institution: activeFloat.institution,
            batteryPercent: activeFloat.batteryPercent,
            profiles: activeFloat.profiles,
          }
        : null;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmed,
            prompt: trimmed,
            query: trimmed,
            sessionId: sessionIdRef.current,
            selectedFloat: floatPayload,
            history: currentHistory,
          }),
        });

        if (!response.ok) {
          throw new Error(`API returned HTTP status ${response.status}`);
        }

        const data = await response.json();

        // Push responseText seamlessly into message array
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: "assistant",
          text: data.responseText || "Oceanographic telemetry analysis synchronized.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mapActions: data.mapActions,
          targetFloatId: data.targetFloatId,
          targetLocation: data.targetLocation,
          explorerContext: data.explorerContext,
          telemetryMetrics: data.telemetryMetrics,
          chartData: data.chartData,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Geographic navigation orchestration
        if (data.focusOnFloat && data.targetFloatId && onFocusFloatRef.current) {
          onFocusFloatRef.current(data.targetFloatId, data.mapActions?.targetCoordinates);
        } else if (data.targetLocation && onNavigateToLocationRef.current) {
          console.log("[AUTO GEO FOCUS] Received geographic target in chat response:", {
            regionName: data.targetLocation.regionName,
            latitude: data.targetLocation.latitude,
            longitude: data.targetLocation.longitude,
          });
          onNavigateToLocationRef.current(data.targetLocation, data.targetFloatId);
        } else if (data.mapActions && onGlobeActionRef.current) {
          onGlobeActionRef.current(data.mapActions);
        }

        // Auto-activate 4D Explorer when explorerContext is present
        if (data.explorerContext && onOpen4DExplorerRef.current) {
          console.log("[AUTO 4D] Opening 4D Explorer from chat response:", data.explorerContext);
          onOpen4DExplorerRef.current(data.explorerContext);
        }
      } catch (err) {
        console.error("[FloatChat] API call failed:", err);

        // Fallback to grounded local engine with activeFloat context
        try {
          const fallback = processUserQuery(trimmed, activeFloat);
          setMessages((prev) => [...prev, fallback]);

          if (fallback.focusOnFloat && fallback.targetFloatId && onFocusFloatRef.current) {
            onFocusFloatRef.current(fallback.targetFloatId, fallback.mapActions?.targetCoordinates);
          } else if (fallback.targetLocation && onNavigateToLocationRef.current) {
            console.log("[AUTO GEO FOCUS] Fallback geographic target in chat response:", {
              regionName: fallback.targetLocation.regionName,
              latitude: fallback.targetLocation.latitude,
              longitude: fallback.targetLocation.longitude,
            });
            onNavigateToLocationRef.current(fallback.targetLocation, fallback.targetFloatId);
          } else if (fallback.mapActions && onGlobeActionRef.current) {
            onGlobeActionRef.current(fallback.mapActions);
          }

          // Auto-activate 4D Explorer from fallback response
          if (fallback.explorerContext && onOpen4DExplorerRef.current) {
            console.log("[AUTO 4D] Opening 4D Explorer from fallback response:", fallback.explorerContext);
            onOpen4DExplorerRef.current(fallback.explorerContext);
          }
        } catch {
          // Clear error notification without silent irrelevant cached text
          const errorMsg: ChatMessage = {
            id: `error-${Date.now()}`,
            sender: "assistant",
            text: `### Telemetry Connection Notice\n\nUnable to process query: *"_${trimmed}_"*\n\n**Reason:** ${err instanceof Error ? err.message : "Service connection unavailable"}.\n\nPlease try again or select an ARGO float on the 3D globe.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, errorMsg]);
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
    createNewChat,
    savedConversations,
    loadSavedConversation,
    sessionId,
  };
}
