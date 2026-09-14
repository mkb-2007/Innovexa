"use client";

import { useState, useCallback } from "react";
import { processUserQuery } from "@/lib/ai/chatEngine";
import type { ChatMessage, GeoLocation } from "@/types/globe";

export function useOceanChat(onNavigateToLocation?: (loc: GeoLocation, floatId?: number) => void) {
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
    (promptText: string) => {
      if (!promptText.trim()) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: promptText.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsChatOpen(true);
      setIsTyping(true);

      // Simulate rapid AI response generation
      setTimeout(() => {
        const assistantResponse = processUserQuery(promptText);
        setMessages((prev) => [...prev, assistantResponse]);
        setIsTyping(false);

        // If response includes target location, fly globe camera to location
        if (assistantResponse.targetLocation && onNavigateToLocation) {
          onNavigateToLocation(assistantResponse.targetLocation, assistantResponse.targetFloatId);
        }
      }, 500);
    },
    [onNavigateToLocation]
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
    isChatOpen,
    isTyping,
    toggleChat,
    openChat,
    closeChat,
  };
}
