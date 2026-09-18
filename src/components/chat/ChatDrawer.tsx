"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
import type { ChatMessage, GeoLocation, ExplorerContext, ArgoFloat } from "@/types/globe";
import { TelemetryChart } from "@/components/visualization/TelemetryChart";

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isTyping: boolean;
  onNavigateToLocation?: (loc: GeoLocation, floatId?: number) => void;
  onOpen4DExplorer?: (context: ExplorerContext) => void;
  onNewChat?: () => void;
  selectedFloat?: ArgoFloat | null;
}

const SUGGESTED_QUESTIONS = [
  "Show temperature instead",
  "Compare 2022 vs 2025",
  "Go to 1000 meters depth",
  "Show only ARGO floats",
  "Explain this trend",
];

export function ChatDrawer({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isTyping,
  onNavigateToLocation,
  onOpen4DExplorer,
  onNewChat,
  selectedFloat,
}: ChatDrawerProps) {
  const [input, setInput] = React.useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping]);

  // Auto-focus 3D globe immediately upon arrival of any assistant message with a detected geographic target
  const lastAutoNavMsgIdRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (!onNavigateToLocation || messages.length === 0) return;
    const latestMsg = messages[messages.length - 1];
    if (
      latestMsg &&
      latestMsg.sender === "assistant" &&
      latestMsg.targetLocation &&
      lastAutoNavMsgIdRef.current !== latestMsg.id
    ) {
      lastAutoNavMsgIdRef.current = latestMsg.id;
      console.log("[ChatDrawer AUTO-FOCUS] Navigating globe to detected target:", {
        regionName: latestMsg.targetLocation.regionName,
        latitude: latestMsg.targetLocation.latitude,
        longitude: latestMsg.targetLocation.longitude,
      });
      onNavigateToLocation(latestMsg.targetLocation, latestMsg.targetFloatId);
    }
  }, [messages, onNavigateToLocation]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <>
      {/* Backdrop overlay — Mobile only (< lg), removed on desktop per Requirement 8 */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Chat Panel: Fixed slide-over drawer on mobile, static in-flow panel on desktop */}
      <div className="fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col border-r border-[#163258] bg-[#041021]/95 shadow-2xl backdrop-blur-xl animate-slide-from-left
                      lg:relative lg:inset-auto lg:z-10 lg:w-full lg:max-w-none lg:h-full lg:rounded-2xl lg:border lg:border-[#163258] lg:bg-[#041021]/95 lg:shadow-[0_8px_32px_rgba(0,0,0,0.5)] lg:backdrop-blur-md lg:animate-fade-in p-3.5 sm:p-4 overflow-hidden">
        
        {/* ====== HEADER ====== */}
        <div className="flex items-center justify-between border-b border-[#163258] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center drop-shadow-[0_0_12px_rgba(0,210,255,0.5)]">
              <Image
                src="/images/floatchat-orb.png"
                alt="FloatChat Logo"
                fill
                sizes="32px"
                className="object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#ececec] tracking-wide font-sans leading-snug">
                Float<span className="text-[#00d2ff]">Chat</span> Ocean AI
              </span>
              <span className="text-[10px] font-mono text-[#00d2ff] flex items-center gap-1.5 leading-none">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d2ff] inline-block animate-pulse" />
                CONNECTED TO ARGO NETWORK
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onNewChat && (
              <button
                type="button"
                onClick={onNewChat}
                title="Start a new isolated conversation"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-[#00d2ff] bg-[#00d2ff]/10 border border-[#00d2ff]/30 hover:bg-[#00d2ff]/20 hover:border-[#00d2ff]/60 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,210,255,0.1)]"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>New Chat</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close AI Chat"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#7090b0] hover:bg-[#0c2242] hover:text-[#00d2ff] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Selected Float Active Context Indicator */}
        {selectedFloat && (
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#00d2ff]/10 border border-[#00d2ff]/25 rounded-lg mt-2.5 mb-1 text-[11px] font-mono text-[#7090b0] shrink-0 animate-fade-in">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-[#00d2ff] animate-pulse shrink-0" />
              <span className="text-[#ececec] font-bold">Float #{selectedFloat.wmoId}</span>
              <span className="text-[#41658a] truncate">({selectedFloat.basin})</span>
            </div>
            <span className="text-[#00d2ff] shrink-0 font-medium">{selectedFloat.surfaceTemp}°C</span>
          </div>
        )}

        {/* ====== BODY: MESSAGES FEED (Scrolls independently) ====== */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-start gap-2 max-w-[95%]">
                {/* Assistant Orb Avatar */}
                {msg.sender === "assistant" && (
                  <div className="relative flex h-6 w-6 shrink-0 items-center justify-center mt-1 drop-shadow-[0_0_8px_rgba(0,210,255,0.4)]">
                    <Image
                      src="/images/floatchat-orb.png"
                      alt="AI"
                      fill
                      sizes="24px"
                      className="object-contain"
                    />
                  </div>
                )}

                <div
                  className={`flex-1 rounded-2xl p-3.5 text-xs leading-relaxed shadow-md font-sans ${
                    msg.sender === "user"
                      ? "bg-[#0c2242] text-[#ececec] border border-[#163c6e] rounded-tr-none ml-auto"
                      : "bg-[#06152b] text-[#ececec] border border-[#0f2d52] rounded-tl-none"
                  }`}
                >
                  {/* Message Header */}
                  <div className="mb-1.5 flex items-center justify-between gap-3 font-mono text-[10px] text-[#7090b0]">
                    <span>{msg.sender === "user" ? "You" : "FloatChat AI"}</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Text / Markdown Render */}
                  <div className="whitespace-pre-wrap font-sans space-y-2">
                    {msg.text.split("\n\n").map((paragraph, idx) => {
                      if (paragraph.startsWith("### ")) {
                        return (
                          <h4
                            key={idx}
                            className="text-xs font-bold text-[#00d2ff] font-sans"
                          >
                            {paragraph.replace("### ", "")}
                          </h4>
                        );
                      }
                      return <p key={idx}>{paragraph}</p>;
                    })}
                  </div>

                  {/* ====== 4D Ocean Explorer Card ====== */}
                  {msg.explorerContext && (
                    <div className="mt-3 rounded-xl border border-[#00d2ff]/35 bg-[#071933] p-3 space-y-2.5 shadow-[0_0_20px_rgba(0,210,255,0.08)]">
                      {/* Card Header */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-[#00d2ff]/15">
                          <svg className="w-3.5 h-3.5 text-[#00d2ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M3 9h18" />
                            <path d="M9 21V9" />
                          </svg>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-[#ececec]">
                          4D Ocean Explorer
                        </span>
                      </div>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-[#6b8aad]">Region:</span>
                          <span className="text-[#ececec] font-medium">{msg.explorerContext.region}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6b8aad]">Parameter:</span>
                          <span className="text-[#ececec] font-medium">{msg.explorerContext.parameter}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6b8aad]">Time Range:</span>
                          <span className="text-[#ececec] font-medium">{msg.explorerContext.timeRange}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6b8aad]">Depth:</span>
                          <span className="text-[#ececec] font-medium">{msg.explorerContext.depthRange}</span>
                        </div>
                      </div>

                      {/* Open Visualization Button */}
                      <button
                        type="button"
                        onClick={() => onOpen4DExplorer?.(msg.explorerContext!)}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#00d2ff] text-[#020814] px-3 py-2 text-[11px] font-mono font-bold hover:bg-[#38bdf8] shadow-[0_0_15px_rgba(0,210,255,0.25)] transition-all cursor-pointer"
                      >
                        Open Visualization
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Telemetry Metrics Pill Box */}
                  {msg.telemetryMetrics && !msg.explorerContext && (
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[#0f2d52] bg-[#071933] p-2.5 font-mono text-[10px]">
                      <div>
                        <span className="text-[#7090b0] block text-[9px] uppercase">
                          BASIN
                        </span>
                        <span className="text-[#00d2ff] font-bold">
                          {msg.telemetryMetrics.basinName}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#7090b0] block text-[9px] uppercase">
                          TEMP / SALINITY
                        </span>
                        <span className="text-[#ececec] font-bold">
                          {msg.telemetryMetrics.avgTemp}°C / {msg.telemetryMetrics.avgSalinity} PSU
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Chart if available */}
                  {msg.chartData && msg.chartData.length > 0 && !msg.explorerContext && (
                    <div className="mt-3">
                      <TelemetryChart profiles={msg.chartData} height={160} />
                    </div>
                  )}

                  {/* Target Location Routing Action */}
                  {msg.targetLocation && onNavigateToLocation && (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToLocation(msg.targetLocation!, msg.targetFloatId)
                      }
                      className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#00d2ff]/40 bg-[#00d2ff]/10 px-2.5 py-1.5 text-[10px] font-mono font-medium text-[#00d2ff] hover:bg-[#00d2ff] hover:text-[#020814] shadow-[0_0_12px_rgba(0,210,255,0.15)] transition-all cursor-pointer"
                    >
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="12 8 8 12 12 16 12 8" />
                      </svg>
                      <span>
                        Focus Globe on {msg.targetLocation.regionName || "Coordinates"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start gap-2 p-1">
              <div className="relative flex h-5 w-5 shrink-0 items-center justify-center mt-1">
                <Image
                  src="/images/floatchat-orb.png"
                  alt="AI"
                  fill
                  sizes="20px"
                  className="object-contain"
                />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none bg-[#06152b] border border-[#0f2d52] px-3.5 py-2.5 shadow-md">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d2ff] typing-dot-1" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d2ff] typing-dot-2" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d2ff] typing-dot-3" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ====== FOOTER: SUGGESTED QUESTIONS ====== */}
        <div className="border-t border-[#163258] pt-2 pb-1 space-y-1 shrink-0">
          <span className="text-[9px] font-mono text-[#7090b0] uppercase tracking-wider block">
            Suggested questions
          </span>
          <div className="flex flex-wrap gap-1 max-h-18 overflow-y-auto">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onSendMessage(q)}
                className="flex items-center gap-1 rounded-lg border border-[#133560] bg-[#071933] px-2 py-0.5 text-[9.5px] font-mono text-[#88a8cc] hover:text-[#ececec] hover:border-[#00d2ff]/60 hover:bg-[#00d2ff]/10 transition-all cursor-pointer"
              >
                <svg className="w-2.5 h-2.5 text-[#00d2ff]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* ====== FOOTER: CHAT INPUT FORM ====== */}
        <form onSubmit={handleSubmit} className="mt-1.5 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about ocean data..."
            className="flex-1 rounded-xl border border-[#133560] bg-[#071933] px-3.5 py-2 text-xs text-[#ececec] placeholder-[#5a7b9f] focus:border-[#00d2ff] focus:outline-none transition-colors font-sans"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send message"
            className={`flex h-8 w-8 items-center justify-center rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
              input.trim()
                ? "bg-[#00d2ff] text-[#020814] hover:bg-[#38bdf8] shadow-[0_0_12px_rgba(0,210,255,0.35)]"
                : "bg-[#0a1f3a] text-[#4a6b8f] cursor-not-allowed"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
