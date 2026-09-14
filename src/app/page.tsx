"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/Header";
import { Hero } from "@/components/layout/Hero";
import { TelemetrySidebar } from "@/components/layout/TelemetrySidebar";
import { QueryBar } from "@/components/chat/QueryBar";
import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { OceanLayerControl } from "@/components/visualization/OceanLayerControl";
import { DataExplorerModal } from "@/components/visualization/DataExplorerModal";
import { FourDExplorer } from "@/components/visualization/FourDExplorer";
import { OceanDepthViewer } from "@/components/ocean/OceanDepthViewer";
import { ArgoFloatModal } from "@/components/ocean/ArgoFloatModal";
import { AboutModal } from "@/components/layout/AboutModal";
import { RealTimeTelemetryModal } from "@/components/ocean/RealTimeTelemetryModal";
import { DeepOceanEnvironment } from "@/components/environment/DeepOceanEnvironment";
import { useOceanChat } from "@/hooks/useOceanChat";
import { useArgoFloats } from "@/hooks/useArgoFloats";
import { useGlobeLayers } from "@/hooks/useGlobeLayers";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import type { ExplorationMode, GeoLocation, ArgoFloat, ExplorerContext } from "@/types/globe";

const OceanGlobe = dynamic(
  () => import("@/components/globe/OceanGlobe").then((mod) => mod.OceanGlobe),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-3 font-mono text-xs text-[#00d2ff]">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00d2ff] opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#00d2ff]" />
          </span>
          <span className="tracking-widest uppercase text-[11px] text-[#8e8e8e]">
            INITIALIZING 3D GEOSPATIAL EARTH...
          </span>
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  const [, setMode] = useState<ExplorationMode>("global");
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);

  // Modal open states
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isDataExplorerOpen, setIsDataExplorerOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isDepthViewerOpen, setIsDepthViewerOpen] = useState(false);
  const [isFloatModalOpen, setIsFloatModalOpen] = useState(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [atmosphericLighting, setAtmosphericLighting] = useState(false);
  const [is4DExplorerOpen, setIs4DExplorerOpen] = useState(false);
  const [explorerContext, setExplorerContext] = useState<ExplorerContext | null>(null);
  const [resetGlobeCounter, setResetGlobeCounter] = useState(0);

  const { selectedFloat, selectedFloatId, selectFloat } = useArgoFloats();
  const { layers, toggleLayer } = useGlobeLayers();

  const handleNavigateToLocation = useCallback((loc: GeoLocation, floatId?: number) => {
    setSelectedLocation(loc);
    if (floatId) {
      selectFloat(floatId);
    }
  }, [selectFloat]);

  const {
    messages,
    sendMessage,
    isChatOpen,
    isTyping,
    openChat,
    closeChat,
  } = useOceanChat(handleNavigateToLocation);

  const handleLocationSelect = useCallback((loc: GeoLocation) => {
    setSelectedLocation(loc);
    if (loc.wmoId) {
      selectFloat(loc.wmoId);
    }
    // Send selected geographic location / ARGO float query directly to LEFT FloatChat AI assistant
    const prompt = loc.wmoId
      ? `Provide telemetry for ARGO float #${loc.wmoId} in ${loc.regionName || "this region"}`
      : `What are the current ocean conditions and salinity in ${loc.regionName || "this region"}?`;
    sendMessage(prompt);
    openChat();
  }, [selectFloat, sendMessage, openChat]);

  const handleModeChange = useCallback((newMode: ExplorationMode) => {
    setMode(newMode);
    if (newMode === "global") {
      setSelectedLocation(null);
    }
  }, []);

  const handleResetGlobe = useCallback(() => {
    // Close data panels / popups (do NOT modify ABOUT or CHAT)
    setIsDataExplorerOpen(false);
    setIsLayersOpen(false);
    setIsDepthViewerOpen(false);
    setIsFloatModalOpen(false);
    setIsTelemetryOpen(false);
    setIs4DExplorerOpen(false);
    
    // Clear selections and trigger 3D camera reset
    handleModeChange("global");
    selectFloat(null);
    setResetGlobeCounter((prev) => prev + 1);
  }, [handleModeChange, selectFloat]);

  const handleOpen4DProfiles = useCallback(() => {
    // If the user has already selected an ocean/sea/ARGO float, use that selection; otherwise default to "Bay of Bengal"
    const region = selectedFloat?.basin || selectedLocation?.regionName || "Bay of Bengal";
    const context: ExplorerContext = {
      region,
      parameter: "Salinity (PSU)",
      timeRange: "2020 – 2025",
      depthRange: "0 – 2,000m",
      startYear: 2020,
      endYear: 2025,
      maxDepth: 2000,
    };
    setExplorerContext(context);
    setIs4DExplorerOpen(true);
    openChat();

    if (region === "Bay of Bengal" || region.toLowerCase().includes("bengal")) {
      handleNavigateToLocation({
        latitude: 15.0,
        longitude: 88.0,
        regionName: "Bay of Bengal",
      });
    } else if (selectedLocation) {
      handleNavigateToLocation(selectedLocation, selectedFloatId || undefined);
    }
  }, [selectedFloat, selectedLocation, selectedFloatId, openChat, handleNavigateToLocation]);

  const handleExploreOcean = (loc: GeoLocation) => {
    setSelectedLocation(loc);
    setIsDepthViewerOpen(true);
  };

  const handleSelectFloatFromExplorer = (float: ArgoFloat) => {
    selectFloat(float.id);
    setSelectedLocation({
      latitude: float.latitude,
      longitude: float.longitude,
      regionName: float.basin,
      wmoId: float.wmoId,
    });
    setIsFloatModalOpen(true);
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#030810] text-[#ececec] flex flex-col justify-between">
      {/* Full-Screen Initial Loading Experience Matching Reference Image */}
      <LoadingScreen />

      {/* Cinematic Deep-Ocean Environment Background */}
      <DeepOceanEnvironment />

      {/* Top Navigation Header */}
      <div className="relative z-20 w-full shrink-0 pointer-events-auto">
        <Header
          onOpenLayers={() => setIsLayersOpen(true)}
          onOpenData={() => setIsDataExplorerOpen(true)}
          onOpenAbout={() => setIsAboutOpen(true)}
          onOpenChat={isChatOpen ? closeChat : openChat}
          onResetGlobe={handleResetGlobe}
        />
      </div>

      {/* Main Content Area: Case 1 Homepage or Case 2 Scientific 3-Panel Workstation */}
      <main className="relative z-10 flex-1 min-h-0 w-full px-3 sm:px-5 lg:px-6 py-1 sm:py-2 flex flex-col justify-center items-center overflow-hidden">
        {!isChatOpen && !is4DExplorerOpen ? (
          /* Case 1: Standard Homepage when both Chat and 4D Explorer are closed */
          <div className="mx-auto flex h-full w-full max-w-[1420px] flex-col lg:flex-row items-center justify-center lg:justify-between gap-4 lg:gap-6 xl:gap-8 my-auto">
            {/* Left Side: Hero Text & Feature Badges */}
            <div className="w-full lg:w-[42%] xl:w-[40%] shrink-0 flex flex-col justify-center pointer-events-auto">
              <Hero
                onOpenTelemetry={() => setIsTelemetryOpen(true)}
                onOpenProfiles={handleOpen4DProfiles}
                onToggleLighting={() => setAtmosphericLighting((prev) => !prev)}
                isTelemetryActive={isTelemetryOpen}
                isProfilesActive={is4DExplorerOpen}
                isLightingActive={atmosphericLighting}
              />
            </div>

            {/* Right Side: Large 3D Globe + Connected Stats */}
            <div className="w-full lg:w-[58%] xl:w-[60%] flex-1 lg:flex-initial flex flex-col lg:flex-row items-center justify-center lg:justify-end gap-3 lg:gap-4 xl:gap-5 pointer-events-auto">
              <div className={`globe-atmosphere relative w-[85vw] sm:w-[65vw] lg:w-[38vw] xl:w-[41vw] max-w-[560px] xl:max-w-[620px] 2xl:max-w-[660px] aspect-square max-h-[calc(100dvh-180px)] shrink-0 flex items-center justify-center ${atmosphericLighting ? "atmospheric-glow-active" : ""}`}>
                <OceanGlobe
                  onLocationSelect={handleLocationSelect}
                  onModeChange={handleModeChange}
                  onExploreOcean={handleExploreOcean}
                  onOpenDepthViewer={() => setIsDepthViewerOpen(true)}
                  onAskAI={(prompt) => {
                    sendMessage(prompt);
                    openChat();
                  }}
                  selectedFloatId={selectedFloatId}
                  activeLayers={layers}
                  atmosphericLighting={atmosphericLighting}
                  resetTrigger={resetGlobeCounter}
                />
              </div>

              <div className="hidden lg:flex shrink-0">
                <TelemetrySidebar
                  onOpenDepthViewer={handleOpen4DProfiles}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Case 2: 3-Panel Scientific Workstation: [ AI CHAT ] [ 3D GLOBE ] [ 4D DATA ] */
          <div className="mx-auto flex h-full w-full max-w-[1740px] flex-col lg:flex-row items-stretch justify-between gap-3 lg:gap-4 xl:gap-5 my-auto">
            {/* Panel 1 (LEFT, ~25–28%): FloatChat AI Ocean Assistant */}
            <div className={`${isChatOpen ? "w-full lg:w-[26%] xl:w-[27%] min-w-[310px] max-w-[410px]" : "w-full lg:w-[38%] xl:w-[36%] shrink-0"} h-full shrink-0 flex flex-col`}>
              {isChatOpen ? (
                <ChatDrawer
                  isOpen={isChatOpen}
                  onClose={closeChat}
                  messages={messages}
                  onSendMessage={sendMessage}
                  isTyping={isTyping}
                  onNavigateToLocation={handleNavigateToLocation}
                  onOpen4DExplorer={(ctx) => {
                    setExplorerContext(ctx);
                    setIs4DExplorerOpen(true);
                    if (ctx.region === "Bay of Bengal" || ctx.region.toLowerCase().includes("bengal")) {
                      handleNavigateToLocation({
                        latitude: 15.0,
                        longitude: 88.0,
                        regionName: "Bay of Bengal",
                      });
                    }
                  }}
                />
              ) : (
                <div className="h-full flex flex-col justify-center pointer-events-auto">
                  <Hero
                    onOpenTelemetry={() => setIsTelemetryOpen(true)}
                    onOpenProfiles={handleOpen4DProfiles}
                    onToggleLighting={() => setAtmosphericLighting((prev) => !prev)}
                    isTelemetryActive={isTelemetryOpen}
                    isProfilesActive={is4DExplorerOpen}
                    isLightingActive={atmosphericLighting}
                  />
                </div>
              )}
            </div>

            {/* Panel 2 (CENTER): Main 3D Earth Visualization */}
            <div className="flex-1 min-w-0 h-full flex items-center justify-center relative pointer-events-auto">
              <div className={`globe-atmosphere relative w-full max-w-[480px] xl:max-w-[560px] 2xl:max-w-[620px] aspect-square max-h-[calc(100dvh-120px)] shrink-0 flex items-center justify-center ${atmosphericLighting ? "atmospheric-glow-active" : ""}`}>
                <OceanGlobe
                  onLocationSelect={handleLocationSelect}
                  onModeChange={handleModeChange}
                  onExploreOcean={handleExploreOcean}
                  onOpenDepthViewer={() => setIsDepthViewerOpen(true)}
                  onAskAI={(prompt) => {
                    sendMessage(prompt);
                    openChat();
                  }}
                  selectedFloatId={selectedFloatId}
                  activeLayers={layers}
                  atmosphericLighting={atmosphericLighting}
                  resetTrigger={resetGlobeCounter}
                />
              </div>
            </div>

            {/* Panel 3 (RIGHT, ~28–33%): 4D Ocean Explorer OR Telemetry Sidebar */}
            {is4DExplorerOpen && explorerContext ? (
              <div className="w-full lg:w-[32%] xl:w-[33%] min-w-[360px] max-w-[520px] h-full shrink-0 flex flex-col">
                <FourDExplorer
                  isOpen={is4DExplorerOpen}
                  onClose={() => setIs4DExplorerOpen(false)}
                  context={explorerContext}
                />
              </div>
            ) : (
              <div className="hidden lg:flex shrink-0 items-center">
                <TelemetrySidebar
                  onOpenDepthViewer={handleOpen4DProfiles}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Floating Query Container (only on homepage when chat is closed) */}
      {!isChatOpen && (
        <footer className="relative z-20 w-full shrink-0 flex flex-col items-center pb-2 pt-0 -mt-2 sm:-mt-4 lg:-mt-6 pointer-events-auto">
          <QueryBar
            onSubmitQuery={(query) => {
              sendMessage(query);
              openChat();
            }}
          />
        </footer>
      )}

      {/* Real-Time Telemetry Modal (Hero Feature Card 1) */}
      <RealTimeTelemetryModal
        isOpen={isTelemetryOpen}
        onClose={() => setIsTelemetryOpen(false)}
        onOpenDataExplorer={() => setIsDataExplorerOpen(true)}
        onOpenDepthProfiles={() => setIsDepthViewerOpen(true)}
      />

      {/* Ocean Layer Control Modal */}
      <OceanLayerControl
        isOpen={isLayersOpen}
        onClose={() => setIsLayersOpen(false)}
        layers={layers}
        onToggleLayer={toggleLayer}
      />

      {/* Global Data Explorer Modal */}
      <DataExplorerModal
        isOpen={isDataExplorerOpen}
        onClose={() => setIsDataExplorerOpen(false)}
        onSelectFloat={handleSelectFloatFromExplorer}
        onFlyToLocation={handleNavigateToLocation}
      />

      {/* 4D Depth Telemetry Viewer Modal (Hero Feature Card 2 & Depth Analysis) */}
      <OceanDepthViewer
        isOpen={isDepthViewerOpen}
        onClose={() => setIsDepthViewerOpen(false)}
        float={selectedFloat}
        location={selectedLocation}
        onSelectFloat={handleSelectFloatFromExplorer}
        onOpenDataExplorer={() => setIsDataExplorerOpen(true)}
      />

      {/* ARGO Float Technical Specs Modal */}
      <ArgoFloatModal
        isOpen={isFloatModalOpen}
        onClose={() => setIsFloatModalOpen(false)}
        float={selectedFloat}
        onFlyToLocation={handleNavigateToLocation}
        onOpenDepthViewer={() => setIsDepthViewerOpen(true)}
      />

      {/* About & ARGO Overview Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}
