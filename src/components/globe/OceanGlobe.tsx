"use client";

import React, { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { ExplorationMode, GeoLocation, GlobeProps, ArgoFloat, OceanLayerState } from "@/types/globe";
import { getApproximateOceanRegion, setCesiumViewer, registerFocusLocationHandler, FocusGlobeOptions } from "@/lib/globe/cesium";
import { ARGO_FLOATS } from "@/data/argoFloats";
import { OCEAN_REGIONS } from "@/data/oceanRegions";
import { MAJOR_OCEAN_CURRENTS } from "@/data/oceanCurrents";
import { createSSTTexture, createSalinityTexture, createBathymetryTexture } from "@/lib/globe/layerTextures";
import { FloatHoverTooltip } from "./FloatHoverTooltip";
import "cesium/Build/Cesium/Widgets/widgets.css";

interface OceanGlobeExtendedProps extends GlobeProps {
  onOpenDepthViewer?: () => void;
  onAskAI?: (prompt: string) => void;
  atmosphericLighting?: boolean;
  resetTrigger?: number;
  isChatOpen?: boolean;
  is4DExplorerOpen?: boolean;
  focusTarget?: { floatId: number; timestamp: number } | null;
  navigationTarget?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    label?: string;
    floatId?: number;
    timestamp: number;
  } | null;
}

const MIN_CAMERA_ALTITUDE = 250000.0;   // 250 km: Close-up ocean inspection, ARGO float profiles in high detail
const MAX_CAMERA_ALTITUDE = 9200000.0;  // 9,200 km: Full spherical Earth global view with atmosphere
const INITIAL_CAMERA_ALTITUDE = 8800000.0; // 8,800 km: Default India / Indian Ocean perspective
const ZOOM_DAMPING_RATE = 8.5; // Smooth exponential deceleration

export function OceanGlobe({
  onLocationSelect,
  onModeChange,
  onExploreOcean: _onExploreOcean,
  onOpenDepthViewer: _onOpenDepthViewer,
  onAskAI: _onAskAI,
  selectedFloatId,
  activeLayers,
  atmosphericLighting = false,
  resetTrigger = 0,
  isChatOpen = false,
  is4DExplorerOpen = false,
  focusTarget = null,
  navigationTarget = null,
  className = "",
}: OceanGlobeExtendedProps) {
  void _onOpenDepthViewer;
  void _onAskAI;
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cesiumModuleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinEntityRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const radarRingEntityRef = useRef<any>(null);
  const floatEntitiesRef = useRef<
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entity: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cartesianPos: any;
      floatId: number;
      isDeep: boolean;
      colorHex: string;
    }[]
  >([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const floatDataSourceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentEntitiesRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const particleCollectionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oceanLabelsRef = useRef<{ entity: any; isMajor: boolean; cartesianPos: any }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateSelectionPinRef = useRef<((pos: any, colorHex?: string, labelText?: string) => void) | null>(null);

  // Ocean Data Layer References
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sstLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const salinityLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bathymetryLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseImageryLayerRef = useRef<any>(null);
  const activeLayersRef = useRef<OceanLayerState | undefined>(activeLayers);
  useEffect(() => {
    activeLayersRef.current = activeLayers;
  }, [activeLayers]);

  const isInteractingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modeRef = useRef<ExplorationMode>("global");
  const prefersReducedMotionRef = useRef(false);
  const cursorMotionRef = useRef({
    currentX: 0,
    currentY: 0,
    targetX: 0,
    targetY: 0,
    idleWeight: 1.0,
    isMouseOver: false,
    lastMouseMoveTime: 0,
  });

  const [mode, setMode] = useState<ExplorationMode>("global");
  const [, setSelectedLocation] = useState<GeoLocation | null>(null);
  const [, setIsTilesLoaded] = useState(false);
  const [, setIsUsingGoogleTiles] = useState(false);

  // ARGO Float Hover Tooltip State
  const [hoveredFloat, setHoveredFloat] = useState<ArgoFloat | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const isZoomedInRef = useRef(false);

  // Viewport-safe sun DOM reference and coordinate tracker
  const sunElRef = useRef<HTMLDivElement>(null);
  const sunPosRef = useRef<{ x: number; y: number }>({ x: -999, y: -999 });
  const atmosphericLightingRef = useRef(atmosphericLighting);
  useEffect(() => {
    atmosphericLightingRef.current = atmosphericLighting;
    if (!atmosphericLighting) {
      sunPosRef.current = { x: -999, y: -999 };
    }
  }, [atmosphericLighting]);

  const isClientMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Force Cesium viewer & camera to recalculate dimensions, aspect ratio, and WebGL viewport
  // Synchronize WebGL / Cesium canvas dimensions & camera aspect ratio with container bounding client rect
  const forceViewerResize = useCallback(() => {
    const viewer = viewerRef.current;
    const container = containerRef.current;
    if (!viewer || viewer.isDestroyed() || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width <= 0 || height <= 0) return;

    if (typeof window !== "undefined") {
      const dpr = Math.min(window.devicePixelRatio || 1.0, 2.0);
      if (viewer.resolutionScale !== dpr) {
        viewer.resolutionScale = dpr;
      }
    }

    // Force Cesium widget to acknowledge resize even if dimensions changed within sub-pixels
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const widgetAny = (viewer as any).cesiumWidget || (viewer as any)._cesiumWidget;
    if (widgetAny) {
      widgetAny._forceResize = true;
    }

    viewer.resize();

    const scene = viewer.scene;
    if (scene) {
      if (scene.camera?.frustum && "aspectRatio" in scene.camera.frustum) {
        (scene.camera.frustum as unknown as { aspectRatio: number }).aspectRatio = width / height;
      }
      scene.requestRender();
    }
  }, []);

  const forceViewerResizeRef = useRef(forceViewerResize);
  useEffect(() => {
    forceViewerResizeRef.current = forceViewerResize;
  }, [forceViewerResize]);

  // Continuous animation frame resize synchronization during side panel open/close flex animations
  useEffect(() => {
    let animId: number;
    const startTime = performance.now();
    const duration = 650; // ms (covers full CSS animation duration)

    const syncResize = () => {
      forceViewerResize();
      if (performance.now() - startTime < duration) {
        animId = requestAnimationFrame(syncResize);
      }
    };

    animId = requestAnimationFrame(syncResize);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isChatOpen, is4DExplorerOpen, forceViewerResize]);

  // Cinematic 3D camera zoom state with sub-pixel exponential damping
  const zoomStateRef = useRef<{
    currentAltitude: number;
    targetAltitude: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    targetPivot: any | null;
    isZooming: boolean;
    lastWheelTime: number;
  }>({
    currentAltitude: INITIAL_CAMERA_ALTITUDE,
    targetAltitude: INITIAL_CAMERA_ALTITUDE,
    targetPivot: null,
    isZooming: false,
    lastWheelTime: 0,
  });

  const updateMode = useCallback(
    (newMode: ExplorationMode) => {
      modeRef.current = newMode;
      setMode(newMode);
      onModeChange?.(newMode);
    },
    [onModeChange]
  );

  const handleLocationPicked = useCallback(
    (lat: number, lon: number, wmoId?: number) => {
      const floatObj = wmoId
        ? ARGO_FLOATS.find((f) => f.wmoId === wmoId || f.id === wmoId)
        : null;
      const regionName = floatObj ? floatObj.basin : getApproximateOceanRegion(lat, lon);
      const loc: GeoLocation = {
        latitude: parseFloat(lat.toFixed(4)),
        longitude: parseFloat(lon.toFixed(4)),
        regionName,
        wmoId,
      };
      setSelectedLocation(loc);
      updateMode("region");
      onLocationSelect?.(loc);
    },
    [onLocationSelect, updateMode]
  );

  const pendingFocusFloatRef = useRef<ArgoFloat | null>(null);
  const pendingFocusLocationRef = useRef<{
    latitude: number;
    longitude: number;
    options?: FocusGlobeOptions;
  } | null>(null);
  const lastFocusedFloatIdRef = useRef<number | null>(null);
  const lastFlightTargetRef = useRef<{ lat: number; lon: number; time: number } | null>(null);

  // Core universal geographic navigation function:
  // Focuses the 3D Earth camera on ANY (latitude, longitude) worldwide,
  // guaranteeing the target location reaches the OPTICAL DEAD CENTER of the screen
  // with a temporary radiant target beacon marker and North-up orientation.
  const focusGlobeOnLocation = useCallback(
    (latitude: number, longitude: number, options?: FocusGlobeOptions) => {
      const viewer = viewerRef.current;
      const Cesium = cesiumModuleRef.current;
      if (!viewer || viewer.isDestroyed?.() || !Cesium) {
        console.log("[AUTO GEO FOCUS] Cesium viewer uninitialized, queuing pending focus:", {
          name: options?.label || "Location",
          latitude,
          longitude,
        });
        pendingFocusLocationRef.current = { latitude, longitude, options };
        if (options?.floatId) {
          const sFloat = ARGO_FLOATS.find((f) => f.id === options.floatId || f.wmoId === options.floatId);
          if (sFloat) pendingFocusFloatRef.current = sFloat;
        }
        return;
      }

      if (typeof latitude !== "number" || typeof longitude !== "number" || isNaN(latitude) || isNaN(longitude)) {
        return;
      }

      // 1. Strict angle normalization: longitude to [-180, 180], latitude clamped to [-89.999, 89.999]
      let normLon = ((longitude + 180) % 360 + 360) % 360 - 180;
      if (normLon === -180 && longitude > 0) normLon = 180;
      const clampLat = Math.max(-89.999, Math.min(89.999, latitude));

      // 2. Exact pin coordinate conversion (WGS84 Ellipsoid)
      const pinAltitude = 25000.0;
      const pinPos = Cesium.Cartesian3.fromDegrees(normLon, clampLat, pinAltitude);

      // 3. Highlight pin beacon with radiant pulse & label
      const isFloat = !!options?.floatId;
      const colorHex = options?.colorHex || (isFloat ? "#22d3ee" : "#00d2ff");
      if (updateSelectionPinRef.current) {
        updateSelectionPinRef.current(pinPos, colorHex, options?.label);
      }

      // 4. Set mode to 'region' immediately to pause idle axial rotation
      updateMode("region");

      // 5. Calculate camera destination:
      // Cesium.Cartesian3.fromDegrees takes (longitude, latitude, altitude)
      const targetAltitude = options?.altitude || 3500000.0;
      const destination = Cesium.Cartesian3.fromDegrees(
        normLon,
        clampLat,
        targetAltitude
      );

      console.log("[AUTO GEO FOCUS]", {
        name: options?.label || "Location",
        latitude,
        longitude,
        normalizedLongitude: normLon,
        clampedLatitude: clampLat,
        altitude: targetAltitude,
      });

      // Prevent redundant camera flight abort & restart if called synchronously for the same coordinates
      const now = Date.now();
      if (
        lastFlightTargetRef.current &&
        Math.abs(lastFlightTargetRef.current.lat - latitude) < 1e-4 &&
        Math.abs(lastFlightTargetRef.current.lon - longitude) < 1e-4 &&
        now - lastFlightTargetRef.current.time < 350
      ) {
        return;
      }
      lastFlightTargetRef.current = { lat: latitude, lon: longitude, time: now };

      // 6. Re-sync zoomStateRef so manual mouse zoom and orbit controls continue seamlessly
      zoomStateRef.current.isZooming = false;
      zoomStateRef.current.targetPivot = null;
      zoomStateRef.current.currentAltitude = targetAltitude;
      zoomStateRef.current.targetAltitude = targetAltitude;

      // Cancel any ongoing flight before starting new flight to prevent tween collision
      if (typeof viewer.camera.cancelFlight === "function") {
        viewer.camera.cancelFlight();
      }

      const duration = options?.duration ?? 2.0;

      viewer.camera.flyTo({
        destination,
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-90.0), // Nadir: straight down along surface normal
          roll: 0.0,
        },
        duration,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        complete: () => {
          if (viewer && !viewer.isDestroyed?.()) {
            zoomStateRef.current.currentAltitude = targetAltitude;
            zoomStateRef.current.targetAltitude = targetAltitude;
            zoomStateRef.current.isZooming = false;
            zoomStateRef.current.targetPivot = null;

            // Mathematical center verification
            try {
              const targetSurface = Cesium.Cartesian3.fromDegrees(normLon, clampLat, 0.0);
              const winPos = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, targetSurface);
              const canvas = viewer.canvas;
              if (winPos && canvas) {
                const cx = canvas.clientWidth / 2;
                const cy = canvas.clientHeight / 2;
                const offset = Math.hypot(winPos.x - cx, winPos.y - cy);
                console.log(`[GlobeFocus Complete] Target: "${options?.label || 'Target'}" | Canvas: (${cx.toFixed(1)}, ${cy.toFixed(1)}) | Projected: (${winPos.x.toFixed(1)}, ${winPos.y.toFixed(1)}) | Offset: ${offset.toFixed(2)}px`);
              }
            } catch (e) {
              console.warn("[GlobeFocus Verification]", e);
            }
          }
        },
      });
    },
    [updateMode]
  );

  const focusGlobeOnLocationRef = useRef(focusGlobeOnLocation);
  useEffect(() => {
    focusGlobeOnLocationRef.current = focusGlobeOnLocation;
  }, [focusGlobeOnLocation]);

  // Register focus handler with cesium module bridge
  useEffect(() => {
    registerFocusLocationHandler((lat, lon, opts) => {
      focusGlobeOnLocationRef.current(lat, lon, opts);
    });
    return () => {
      registerFocusLocationHandler(null);
    };
  }, []);

  // React effect for navigationTarget prop
  const lastProcessedNavTargetRef = useRef<number>(0);
  useEffect(() => {
    if (navigationTarget && navigationTarget.timestamp !== lastProcessedNavTargetRef.current) {
      lastProcessedNavTargetRef.current = navigationTarget.timestamp;
      focusGlobeOnLocation(navigationTarget.latitude, navigationTarget.longitude, {
        altitude: navigationTarget.altitude,
        label: navigationTarget.label,
        floatId: navigationTarget.floatId,
      });
    }
  }, [navigationTarget, focusGlobeOnLocation]);

  // Core unified function to focus the globe camera directly on any float anywhere on Earth
  const focusOnFloat = useCallback(
    (floatObj: ArgoFloat) => {
      focusGlobeOnLocation(floatObj.latitude, floatObj.longitude, {
        altitude: 3500000.0,
        label: `Float #${floatObj.wmoId}`,
        floatId: floatObj.id,
        wmoId: floatObj.wmoId,
        colorHex: "#22d3ee",
      });
    },
    [focusGlobeOnLocation]
  );
  const focusOnFloatRef = useRef(focusOnFloat);
  const selectedFloatIdRef = useRef(selectedFloatId);
  useEffect(() => {
    focusOnFloatRef.current = focusOnFloat;
    selectedFloatIdRef.current = selectedFloatId;
  }, [focusOnFloat, selectedFloatId]);

  const handleResetGlobal = useCallback(() => {
    updateMode("global");
    setSelectedLocation(null);

    const viewer = viewerRef.current;
    const Cesium = cesiumModuleRef.current;

    if (viewer && Cesium) {
      if (pinEntityRef.current) {
        try {
          viewer.entities.remove(pinEntityRef.current);
        } catch {
          // Ignore removal error
        }
        pinEntityRef.current = null;
      }
      if (radarRingEntityRef.current) {
        try {
          viewer.entities.remove(radarRingEntityRef.current);
        } catch {
          // Ignore removal error
        }
        radarRingEntityRef.current = null;
      }

      // Smoothly reset camera zoom state
      zoomStateRef.current.isZooming = false;
      zoomStateRef.current.targetPivot = null;
      zoomStateRef.current.currentAltitude = INITIAL_CAMERA_ALTITUDE;
      zoomStateRef.current.targetAltitude = INITIAL_CAMERA_ALTITUDE;
      isZoomedInRef.current = false;
      setIsZoomedIn(false);

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(78.0, 20.0, INITIAL_CAMERA_ALTITUDE),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-90.0),
          roll: 0.0,
        },
        duration: 1.5,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
      });
    }
  }, [updateMode]);

  const _handleExplore = useCallback(
    (loc: GeoLocation) => {
      if (_onExploreOcean) {
        _onExploreOcean(loc);
      }
    },
    [_onExploreOcean]
  );
  void _handleExplore;

  const handleLocationPickedRef = useRef(handleLocationPicked);
  const handleResetGlobalRef = useRef(handleResetGlobal);

  useEffect(() => {
    handleLocationPickedRef.current = handleLocationPicked;
    handleResetGlobalRef.current = handleResetGlobal;
  }, [handleLocationPicked, handleResetGlobal]);

  useEffect(() => {
    if (resetTrigger > 0) {
      handleResetGlobalRef.current();
    }
  }, [resetTrigger]);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    let isMounted = true;
    const cleanups: (() => void)[] = [];

    async function initCesium() {
      if (typeof window !== "undefined") {
        (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL =
          "/cesium/";
      }

      const Cesium = await import("cesium");
      cesiumModuleRef.current = Cesium;
      if (typeof window !== "undefined") {
        (window as unknown as { Cesium: unknown }).Cesium = Cesium;
      }

      // Explicitly set the base URL in Cesium's internal resource resolver
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buildModuleUrlAny = (Cesium as any)?.buildModuleUrl;
      if (typeof buildModuleUrlAny?.setBaseUrl === "function") {
        buildModuleUrlAny.setBaseUrl("/cesium/");
      }

      if (!isMounted || !containerRef.current) return;

      const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (ionToken && ionToken.trim().length > 0) {
        Cesium.Ion.defaultAccessToken = ionToken.trim();
      } else {
        Cesium.Ion.defaultAccessToken = "";
      }

      // Resilient multi-tier base imagery fallback hierarchy:
      // Tier 1: Cesium Ion World Imagery (if valid ionToken provided)
      // Tier 2: ArcGIS World Imagery (high-resolution global satellite, free & robust)
      // Tier 3: Cesium Local NaturalEarthII Asset (offline/local fallback)
      let baseProvider: any = null;
      let imageryType = "none";

      if (ionToken && ionToken.trim().length > 0) {
        try {
          baseProvider = await Cesium.createWorldImageryAsync({});
          imageryType = "cesium-ion";
        } catch (ionErr) {
          console.warn("[Cesium Production] Cesium Ion World Imagery unavailable, falling back to ArcGIS:", ionErr);
          baseProvider = null;
        }
      }

      if (!baseProvider) {
        try {
          baseProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            {
              enablePickFeatures: false,
            }
          );
          imageryType = "arcgis";
        } catch (esriErr) {
          console.warn("[Cesium Production] ArcGIS World Imagery fallback unavailable, falling back to local NaturalEarthII:", esriErr);
          baseProvider = null;
        }
      }

      if (!baseProvider) {
        try {
          const naturalEarthUrl = Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII");
          baseProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(naturalEarthUrl);
          imageryType = "natural-earth-local";
        } catch (tmsErr) {
          console.warn("[Cesium Production] Local NaturalEarthII imagery fallback failed:", tmsErr);
          baseProvider = null;
        }
      }

      let baseLayer: any = false;
      if (baseProvider) {
        baseLayer = new Cesium.ImageryLayer(baseProvider);
        baseLayer.brightness = 1.0;
        baseLayer.contrast = 1.15;
        baseLayer.saturation = 0.95;
        baseLayer.gamma = 0.95;
        baseLayer.hue = 0.0;
      }

      if (!isMounted || !containerRef.current) return;

      // Initialize Viewer with high-definition settings & realistic atmosphere
      let viewer: any = null;
      try {
        viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer: baseLayer || false,
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          navigationInstructionsInitiallyVisible: false,
          skyAtmosphere: new Cesium.SkyAtmosphere(),
          orderIndependentTranslucency: false,
          contextOptions: {
            webgl: {
              alpha: true,
              preserveDrawingBuffer: true,
            },
          },
        });
      } catch (viewerErr) {
        console.error("[Cesium Production] Fatal error initializing Cesium.Viewer:", viewerErr);
        return;
      }

      viewerRef.current = viewer;
      viewer.clock.shouldAnimate = true;
      setCesiumViewer(viewer);
      if (typeof window !== "undefined") {
        (window as unknown as { cesiumViewer: unknown }).cesiumViewer = viewer;
      }

      // Sizing diagnostic logging & verification
      const containerRect = containerRef.current.getBoundingClientRect();
      const canvasEl = viewer.scene?.canvas;
      console.log("[Cesium Production]", {
        baseUrl: typeof window !== "undefined" ? (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL : undefined,
        hasIonToken: Boolean(ionToken && ionToken.trim().length > 0),
        hasGoogleKey: Boolean(googleMapsKey && googleMapsKey.trim().length > 0),
        activeImageryType: imageryType,
        globeCreated: Boolean(viewer?.scene?.globe),
        globeVisible: viewer?.scene?.globe?.show === true,
        imageryLayers: viewer?.imageryLayers?.length ?? 0,
        containerSize: {
          width: Math.round(containerRect.width),
          height: Math.round(containerRect.height),
        },
        canvasSize: {
          clientWidth: canvasEl?.clientWidth ?? 0,
          clientHeight: canvasEl?.clientHeight ?? 0,
        },
      });

      // Synchronize container & canvas dimensions immediately across initial layout frame ticks
      forceViewerResize();
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(forceViewerResize);
      }
      setTimeout(forceViewerResize, 50);
      setTimeout(forceViewerResize, 250);

      // Attach runtime fallback handler if the base provider encounters subsequent streaming errors
      if (baseLayer && baseLayer.imageryProvider && baseLayer.imageryProvider.errorEvent) {
        let runtimeFallbackAttempted = false;
        baseLayer.imageryProvider.errorEvent.addEventListener(async (err: unknown) => {
          if (runtimeFallbackAttempted || !viewer || viewer.isDestroyed?.()) return;
          runtimeFallbackAttempted = true;
          console.warn("[Cesium Production] Active base imagery provider encountered runtime error, adding local NaturalEarthII fallback:", err);
          try {
            const fbProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
              Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
            );
            if (!viewer.isDestroyed?.() && fbProvider) {
              const fbLayer = new Cesium.ImageryLayer(fbProvider);
              viewer.imageryLayers.add(fbLayer, 0);
            }
          } catch (e) {
            console.warn("[Cesium Production] Emergency local fallback failed:", e);
          }
        });
      }

      if (viewer.imageryLayers && viewer.imageryLayers.length > 0) {
        const topLayer = viewer.imageryLayers.get(0);
        if (topLayer) {
          baseImageryLayerRef.current = topLayer;
          topLayer.brightness = 1.0;
          topLayer.contrast = 1.15;
          topLayer.saturation = 0.95;
          topLayer.gamma = 0.95;
          topLayer.hue = 0.0;
        }
      }

      // High-resolution tile loading and device pixel scaling
      viewer.scene.globe.maximumScreenSpaceError = 1.25;
      if (typeof window !== "undefined") {
        viewer.resolutionScale = Math.min(window.devicePixelRatio || 1.0, 2.0);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const viewerAny = viewer as any;
      if (viewerAny.creditContainer && viewerAny.creditContainer instanceof HTMLElement) {
        viewerAny.creditContainer.style.display = "none";
      }

      const scene = viewer.scene;
      scene.backgroundColor = Cesium.Color.TRANSPARENT;

      // Clean, fully visible Earth texture with soft atmospheric rim
      // - show = true: Globe is guaranteed visible
      // - enableLighting = false: Entire Earth is clearly visible everywhere (no dark night side)
      // - showGroundAtmosphere = false: No cyan fog wash over the ocean surface
      // - skyAtmosphere = 2.2: Soft, thin, elegant outer atmospheric rim
      scene.globe.show = true;
      scene.globe.enableLighting = false;
      scene.globe.showGroundAtmosphere = false;
      scene.globe.baseColor = Cesium.Color.fromCssColorString("#062438");
      scene.globe.depthTestAgainstTerrain = true;
      (scene.globe as unknown as { wireframe: boolean }).wireframe = false;

      // Configure screen space camera controller for smooth spherical Earth interaction
      const sscController = scene.screenSpaceCameraController;
      sscController.enableZoom = false; // Zoom is managed exclusively by our cinematic smooth 3D camera zoom engine
      sscController.enableTranslate = false; // Prevent translating the globe off-screen into void space
      sscController.enableTilt = false; // Maintain top-down scientific perspective
      sscController.enableLook = false;
      sscController.enableRotate = true; // Silky-smooth left-drag orbital rotation
      sscController.inertiaSpin = 0.88; // Natural, cinematic rotation damping

      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = true;
        scene.skyAtmosphere.atmosphereLightIntensity = 2.2;
        scene.skyAtmosphere.hueShift = -0.02;
        scene.skyAtmosphere.saturationShift = 0.0;
        scene.skyAtmosphere.brightnessShift = 0.0;
      }

      if (scene.skyBox) scene.skyBox.show = false;
      if (scene.sun) scene.sun.show = false;
      if (scene.moon) scene.moon.show = false;

      // Google Photorealistic 3D Tiles: OPTIONAL enhancement only
      // Failure to load Google 3D Tiles will NEVER abort or obscure the Cesium globe
      if (googleMapsKey && googleMapsKey.trim().length > 0) {
        try {
          const tileset = await Cesium.createGooglePhotorealistic3DTileset({
            key: googleMapsKey.trim(),
            onlyUsingWithGoogleGeocoder: true,
          });
          if (isMounted && viewer && !viewer.isDestroyed?.()) {
            scene.primitives.add(tileset);
            setIsUsingGoogleTiles(true);
            console.log("[Cesium Production] Google Photorealistic 3D Tileset loaded successfully.");
          }
        } catch (googleErr) {
          console.warn(
            "[Cesium Production] Google 3D Tiles optional enhancement failed (continuing with standard Cesium Earth):",
            googleErr
          );
          setIsUsingGoogleTiles(false);
        }
      }


      // Initialize Functional Ocean Data Imagery Layers (SST, Salinity Anomaly, Bathymetry)
      try {
        const initialLayers = activeLayersRef.current;

        // 1. Sea Surface Temperature (SST) Thermal Gradient Layer
        const sstDataUrl = createSSTTexture();
        if (sstDataUrl) {
          const sstProvider = await Cesium.SingleTileImageryProvider.fromUrl(sstDataUrl, {
            rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
          });
          const sstLayer = new Cesium.ImageryLayer(sstProvider, {
            show: initialLayers?.temperatureHeatmap === true,
            alpha: 0.55,
          });
          viewer.imageryLayers.add(sstLayer);
          sstLayerRef.current = sstLayer;
        }

        // 2. Salinity Anomaly Overlay Layer
        const salinityDataUrl = createSalinityTexture();
        if (salinityDataUrl) {
          const salProvider = await Cesium.SingleTileImageryProvider.fromUrl(salinityDataUrl, {
            rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
          });
          const salLayer = new Cesium.ImageryLayer(salProvider, {
            show: initialLayers?.salinityOverlay === true,
            alpha: 0.55,
          });
          viewer.imageryLayers.add(salLayer);
          salinityLayerRef.current = salLayer;
        }

        // 3. Bathymetry & Seafloor Relief Layer
        const bathyDataUrl = createBathymetryTexture();
        if (bathyDataUrl) {
          const bathyProvider = await Cesium.SingleTileImageryProvider.fromUrl(bathyDataUrl, {
            rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
          });
          const bathyLayer = new Cesium.ImageryLayer(bathyProvider, {
            show: initialLayers?.bathymetry === true,
            alpha: 0.65,
          });
          viewer.imageryLayers.add(bathyLayer);
          bathymetryLayerRef.current = bathyLayer;
        }

        if (initialLayers?.bathymetry === true && baseImageryLayerRef.current) {
          baseImageryLayerRef.current.contrast = 1.35;
          baseImageryLayerRef.current.brightness = 0.90;
        }
      } catch (err) {
        console.warn("Could not initialize procedural ocean layers:", err);
      }

      if (pendingFocusLocationRef.current) {
        const pending = pendingFocusLocationRef.current;
        pendingFocusLocationRef.current = null;
        focusGlobeOnLocationRef.current(pending.latitude, pending.longitude, pending.options);
      } else if (pendingFocusFloatRef.current) {
        const pFloat = pendingFocusFloatRef.current;
        pendingFocusFloatRef.current = null;
        focusOnFloatRef.current(pFloat);
      } else if (selectedFloatIdRef.current) {
        const selId = selectedFloatIdRef.current;
        const sFloat = ARGO_FLOATS.find((f) => f.id === selId || f.wmoId === selId);
        if (sFloat) {
          focusOnFloatRef.current(sFloat);
        } else {
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(78.0, 20.0, 8800000.0),
            orientation: {
              heading: Cesium.Math.toRadians(0.0),
              pitch: Cesium.Math.toRadians(-90.0),
              roll: 0.0,
            },
          });
        }
      } else {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(78.0, 20.0, 8800000.0),
          orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-90.0),
            roll: 0.0,
          },
        });
      }

      // 2. ARGO FLOAT BEACON MARKERS:
      // Grouped inside a dedicated Cesium CustomDataSource for immediate, zero-lag show/hide layer control.
      const floatDataSource = new Cesium.CustomDataSource("argoFloats");
      await viewer.dataSources.add(floatDataSource);
      floatDataSourceRef.current = floatDataSource;
      floatDataSource.show = activeLayersRef.current ? activeLayersRef.current.argoFloats !== false : true;

      const floatAltitude = 25000.0;
      floatEntitiesRef.current = [];
      ARGO_FLOATS.forEach((float) => {
        const isDeep = float.maxDepth === 6000;
        const isPolar = float.surfaceTemp < 5;
        const colorHex = isDeep ? "#c084fc" : isPolar ? "#38bdf8" : "#14b8a6";
        const primaryColor = Cesium.Color.fromCssColorString(colorHex);

        const cartesianPos = Cesium.Cartesian3.fromDegrees(
          float.longitude,
          float.latitude,
          floatAltitude
        );

        const entity = floatDataSource.entities.add({
          id: `float-${float.id}`,
          name: float.name,
          position: cartesianPos,
          point: {
            pixelSize: isDeep ? 6.0 : 5.0,
            color: primaryColor,
            outlineColor: Cesium.Color.WHITE.withAlpha(0.95),
            outlineWidth: 1.2,
            disableDepthTestDistance: 0.0,
            scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.2, 2.5e7, 0.72),
          },
        });

        floatEntitiesRef.current.push({
          entity,
          cartesianPos,
          floatId: float.id,
          isDeep,
          colorHex,
        });
      });

      // 3. AUTHENTIC OCEAN CURRENT FLOW VISUALIZATION:
      // Scientifically accurate major planetary currents (Gulf Stream, Kuroshio, Antarctic Circumpolar, etc.)
      currentEntitiesRef.current = [];
      MAJOR_OCEAN_CURRENTS.forEach((current) => {
        const positions = current.points.map(([lon, lat]) =>
          Cesium.Cartesian3.fromDegrees(lon, lat, 2000.0)
        );

        const currentEntity = viewer.entities.add({
          id: `ocean-current-${current.id}`,
          name: current.name,
          show: false, // Strictly hidden by default for a clean, natural Earth
          polyline: {
            positions,
            width: 1.8,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.22,
              taperPower: 0.9,
              color: Cesium.Color.fromCssColorString("#00d2ff").withAlpha(0.38),
            }),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 3.5e7),
          },
        });
        currentEntitiesRef.current.push(currentEntity);
      });

      // Populate 3D ocean and sea names anchored strictly to Earth's surface
      // Offset slightly (~32,000m altitude = R * 1.005) to visually hug the globe without terrain z-fighting
      const labelAltitude = 32000.0;
      oceanLabelsRef.current = [];
      OCEAN_REGIONS.forEach((ocean) => {
        const entityId = `ocean-label-${ocean.id}`;
        if (viewer.entities.getById(entityId)) return;

        const cartesianPos = Cesium.Cartesian3.fromDegrees(
          ocean.longitude,
          ocean.latitude,
          labelAltitude
        );

        const entity = viewer.entities.add({
          id: entityId,
          name: ocean.name,
          position: cartesianPos,
          label: {
            text: ocean.displayText || ocean.name,
            font: ocean.isMajor
              ? "500 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
              : "500 12.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: ocean.isMajor
              ? Cesium.Color.fromCssColorString("#f8fafc").withAlpha(0.95)
              : Cesium.Color.fromCssColorString("#e0f2fe").withAlpha(0.90),
            outlineColor: Cesium.Color.fromCssColorString("#020617").withAlpha(0.95),
            outlineWidth: 2.0,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            pixelOffset: Cesium.Cartesian2.ZERO,
            disableDepthTestDistance: 0.0,
            scaleByDistance: ocean.isMajor
              ? new Cesium.NearFarScalar(2.0e6, 1.05, 2.0e7, 0.82)
              : new Cesium.NearFarScalar(2.0e6, 1.00, 1.8e7, 0.78),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
              0.0,
              ocean.isMajor ? 3.8e7 : 2.4e7
            ),
          },
        });
        oceanLabelsRef.current.push({
          entity,
          isMajor: ocean.isMajor,
          cartesianPos,
        });
      });

      const pauseRotation = () => {
        forceViewerResizeRef.current();
        isDraggingRef.current = true;
        isInteractingRef.current = true;
        zoomStateRef.current.isZooming = false;
        zoomStateRef.current.targetPivot = null;
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
          idleTimeoutRef.current = null;
        }
      };

      const scheduleResumeRotation = () => {
        isDraggingRef.current = false;
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
        }
        idleTimeoutRef.current = setTimeout(() => {
          isInteractingRef.current = false;
        }, 1200);
      };

      // Multiplicative raycast zoom targeting the exact geographic surface coordinate under cursor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const triggerSmoothZoom = (delta: number, mousePos: any) => {
        const viewerInstance = viewerRef.current;
        const CesiumMod = cesiumModuleRef.current;
        if (!viewerInstance || viewerInstance.isDestroyed() || !CesiumMod) return;

        const sc = viewerInstance.scene;
        const cam = sc.camera;
        const zoomState = zoomStateRef.current;
        const now = performance.now();

        isInteractingRef.current = true;
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
        }
        idleTimeoutRef.current = setTimeout(() => {
          isInteractingRef.current = false;
        }, 1200);

        // Get actual camera altitude from Cartographic position
        const currentCarto = cam.positionCartographic;
        const actualAlt = currentCarto ? currentCarto.height : zoomState.currentAltitude;

        // If starting a fresh zoom sequence or idle for > 350ms, re-sync altitude and re-acquire raycast target pivot
        if (!zoomState.isZooming || now - zoomState.lastWheelTime > 350 || !zoomState.targetPivot) {
          zoomState.currentAltitude = actualAlt;
          zoomState.targetAltitude = actualAlt;

          // Raycast to find the Earth surface point under cursor
          const ray = cam.getPickRay(mousePos);
          let surfacePoint = ray ? sc.globe.pick(ray, sc) : null;

          // If mouse is off the globe, pick center of the canvas
          if (!surfacePoint) {
            const centerRay = cam.getPickRay(
              new CesiumMod.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
            );
            surfacePoint = centerRay ? sc.globe.pick(centerRay, sc) : null;
          }

          // Fallback to sub-satellite point on ellipsoid surface
          if (!surfacePoint && currentCarto) {
            surfacePoint = CesiumMod.Cartesian3.fromRadians(
              currentCarto.longitude,
              currentCarto.latitude,
              0.0
            );
          }

          if (surfacePoint) {
            // Check horizon grazing angle to ensure comfortable viewing angle
            const surfaceNormal = CesiumMod.Ellipsoid.WGS84.geodeticSurfaceNormal(surfacePoint);
            const toCam = CesiumMod.Cartesian3.subtract(
              cam.positionWC,
              surfacePoint,
              new CesiumMod.Cartesian3()
            );
            CesiumMod.Cartesian3.normalize(toCam, toCam);
            const cosAngle = CesiumMod.Cartesian3.dot(surfaceNormal, toCam);

            // If pointing near the far limb, soften toward sub-camera point
            if (cosAngle < 0.35 && currentCarto) {
              const subPoint = CesiumMod.Cartesian3.fromRadians(
                currentCarto.longitude,
                currentCarto.latitude,
                0.0
              );
              CesiumMod.Cartesian3.lerp(surfacePoint, subPoint, 0.55, surfacePoint);
            }
            zoomState.targetPivot = surfacePoint;
          }
        }

        zoomState.isZooming = true;
        zoomState.lastWheelTime = now;

        // Multiplicative zoom step: delta < 0 (scroll up) zooms IN, delta > 0 (scroll down) zooms OUT
        const clampedDelta = Math.max(-160, Math.min(160, delta));
        const zoomFactor = Math.exp(clampedDelta * 0.0018);
        const nextTarget = zoomState.targetAltitude * zoomFactor;

        // Clamp strictly between minimum (close ocean surface) and maximum (global view)
        zoomState.targetAltitude = Math.max(
          MIN_CAMERA_ALTITUDE,
          Math.min(MAX_CAMERA_ALTITUDE, nextTarget)
        );
      };

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();

        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 33;
        else if (e.deltaMode === 2) delta *= 100;
        if (e.ctrlKey) delta *= 2.0;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const CesiumMod = cesiumModuleRef.current;
        if (!CesiumMod) return;
        const mousePos = new CesiumMod.Cartesian2(mouseX, mouseY);

        triggerSmoothZoom(delta, mousePos);
      };

      let pinchStartDist: number | null = null;
      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchStartDist = Math.hypot(dx, dy);
          pauseRotation();
        } else if (e.touches.length === 1) {
          pauseRotation();
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && pinchStartDist !== null) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const currentDist = Math.hypot(dx, dy);
          const delta = (pinchStartDist - currentDist) * 3.5;
          pinchStartDist = currentDist;

          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const rect = canvas.getBoundingClientRect();
          const CesiumMod = cesiumModuleRef.current;
          if (!CesiumMod) return;
          const mousePos = new CesiumMod.Cartesian2(midX - rect.left, midY - rect.top);

          triggerSmoothZoom(delta, mousePos);
        }
      };

      const handleTouchEnd = () => {
        pinchStartDist = null;
        scheduleResumeRotation();
      };

      const canvas = viewer.canvas;
      canvas.addEventListener("pointerdown", pauseRotation);
      canvas.addEventListener("pointerup", scheduleResumeRotation);
      canvas.addEventListener("pointercancel", scheduleResumeRotation);
      canvas.addEventListener("mouseleave", scheduleResumeRotation);
      window.addEventListener("pointerup", scheduleResumeRotation);
      window.addEventListener("mouseup", scheduleResumeRotation);
      canvas.addEventListener("wheel", handleWheel, { passive: false });
      canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
      canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
      canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
      canvas.addEventListener("touchcancel", handleTouchEnd, { passive: true });

      cleanups.push(() => {
        canvas.removeEventListener("pointerdown", pauseRotation);
        canvas.removeEventListener("pointerup", scheduleResumeRotation);
        canvas.removeEventListener("pointercancel", scheduleResumeRotation);
        canvas.removeEventListener("mouseleave", scheduleResumeRotation);
        window.removeEventListener("pointerup", scheduleResumeRotation);
        window.removeEventListener("mouseup", scheduleResumeRotation);
        canvas.removeEventListener("wheel", handleWheel);
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchmove", handleTouchMove);
        canvas.removeEventListener("touchend", handleTouchEnd);
        canvas.removeEventListener("touchcancel", handleTouchEnd);
      });

      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      prefersReducedMotionRef.current = motionQuery.matches;
      const onMotionQueryChange = (e: MediaQueryListEvent) => {
        prefersReducedMotionRef.current = e.matches;
      };
      motionQuery.addEventListener("change", onMotionQueryChange);
      cleanups.push(() => {
        motionQuery.removeEventListener("change", onMotionQueryChange);
      });

      // Native ResizeObserver for seamless automatic WebGL viewport recalculation
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        const resizeObserver = new ResizeObserver(() => {
          forceViewerResizeRef.current();
        });
        resizeObserver.observe(containerRef.current);
        if (containerRef.current.parentElement) {
          resizeObserver.observe(containerRef.current.parentElement);
        }
        cleanups.push(() => {
          resizeObserver.disconnect();
        });
      }

      let lastObservedWidth = 0;
      let lastObservedHeight = 0;
      let lastTickTime = performance.now();
      const scratchNormal = new Cesium.Cartesian3();
      const scratchToCam = new Cesium.Cartesian3();
      const scratchZoomDelta = new Cesium.Cartesian3();
      const scratchZoomPos = new Cesium.Cartesian3();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const occluder = new (Cesium as any).EllipsoidalOccluder(
        Cesium.Ellipsoid.WGS84,
        Cesium.Cartesian3.ZERO
      );

      let lastFloatOcclusionTime = 0;
      let lastRectMeasureTime = 0;
      let cachedHeroRect = {
        left: 0,
        top: 60,
        right: typeof window !== "undefined" ? window.innerWidth : 1200,
        bottom: typeof window !== "undefined" ? window.innerHeight : 800,
        width: typeof window !== "undefined" ? window.innerWidth : 1200,
        height: typeof window !== "undefined" ? window.innerHeight - 60 : 740,
      };
      let cachedGlobeRect = cachedHeroRect;
      let cachedCanvasRect = { left: 0, top: 0 };

      // Liquid-smooth axial Earth rotation, orbital ring animation, data particle drift, and true 3D ocean label occlusion
      const removeTickListener = viewer.clock.onTick.addEventListener(() => {
        if (!viewerRef.current || viewerRef.current.isDestroyed()) return;

        // Dynamic WebGL canvas dimensions & camera frustum aspect ratio continuous synchronization
        const containerEl = containerRef.current;
        if (containerEl) {
          const curW = containerEl.clientWidth;
          const curH = containerEl.clientHeight;
          if (curW > 0 && curH > 0 && (curW !== lastObservedWidth || curH !== lastObservedHeight)) {
            lastObservedWidth = curW;
            lastObservedHeight = curH;
            forceViewerResizeRef.current();
          }
        }

        const now = performance.now();
        const dt = Math.min((now - lastTickTime) / 1000, 0.1);
        lastTickTime = now;

        const camera = viewerRef.current.scene.camera;

        // 1. Cinematic smooth camera damped zoom interpolation
        const zoomState = zoomStateRef.current;
        if (zoomState.isZooming && zoomState.targetPivot) {
          const diff = zoomState.targetAltitude - zoomState.currentAltitude;
          if (Math.abs(diff) > 2.0) {
            const decay = 1.0 - Math.exp(-ZOOM_DAMPING_RATE * dt);
            const step = diff * decay;
            const prevAlt = zoomState.currentAltitude;
            zoomState.currentAltitude += step;

            const pivot = zoomState.targetPivot;
            const toCamera = Cesium.Cartesian3.subtract(camera.positionWC, pivot, scratchZoomDelta);
            const curDist = Cesium.Cartesian3.magnitude(toCamera);

            if (curDist > 1000.0 && prevAlt > 1000.0) {
              const ratio = zoomState.currentAltitude / prevAlt;
              const newPos = Cesium.Cartesian3.add(
                pivot,
                Cesium.Cartesian3.multiplyByScalar(toCamera, ratio, scratchZoomPos),
                scratchZoomPos
              );

              const carto = Cesium.Cartographic.fromCartesian(newPos);
              if (carto) {
                carto.height = Math.max(
                  MIN_CAMERA_ALTITUDE,
                  Math.min(MAX_CAMERA_ALTITUDE, zoomState.currentAltitude)
                );
                const finalPos = Cesium.Cartesian3.fromRadians(
                  carto.longitude,
                  carto.latitude,
                  carto.height
                );

                camera.setView({
                  destination: finalPos,
                  orientation: {
                    heading: camera.heading,
                    pitch: camera.pitch,
                    roll: 0.0,
                  },
                });
              }
            }
          } else {
            zoomState.currentAltitude = zoomState.targetAltitude;
            if (now - zoomState.lastWheelTime > 450) {
              zoomState.isZooming = false;
              zoomState.targetPivot = null;
            }
          }
        } else if (!isDraggingRef.current) {
          const carto = camera.positionCartographic;
          if (carto) {
            zoomState.currentAltitude = carto.height;
            zoomState.targetAltitude = carto.height;
          }
        }

        const isCurrentlyZoomedIn = zoomState.currentAltitude < 6500000.0;
        if (isCurrentlyZoomedIn !== isZoomedInRef.current) {
          isZoomedInRef.current = isCurrentlyZoomedIn;
          setIsZoomedIn(isCurrentlyZoomedIn);
        }

        // 2. Liquid-smooth axial Earth rotation in global mode
        if (modeRef.current === "global") {
          const isBusy = isDraggingRef.current || isInteractingRef.current || zoomState.isZooming;
          const targetIdleWeight = !isBusy ? 1.0 : 0.0;
          cursorMotionRef.current.idleWeight +=
            (targetIdleWeight - cursorMotionRef.current.idleWeight) * (1 - Math.exp(-dt * 4));

          // Taper rotation smoothly when zoomed in close so the close-up view stays steady
          const alt = zoomState.currentAltitude;
          const altitudeScale = Math.max(0.0, Math.min(1.0, (alt - 3500000.0) / 3500000.0));

          if (cursorMotionRef.current.idleWeight > 0.005 && altitudeScale > 0.05) {
            // Smooth ~2.3 degrees per second West-to-East natural Earth rotation
            const rotationAngle = -0.040 * dt * cursorMotionRef.current.idleWeight * altitudeScale;
            camera.rotate(Cesium.Cartesian3.UNIT_Z, rotationAngle);
          }
        }

        // Dynamic ARGO float marker horizon occlusion & limb culling:
        // Anchored strictly to Earth's 3D ocean surface. Floats on the far side of Earth
        // or beyond the visible horizon limb are geometrically occluded and hidden.
        const isFloatsActive = activeLayersRef.current ? activeLayersRef.current.argoFloats !== false : true;
        if (floatDataSourceRef.current && floatDataSourceRef.current.show !== isFloatsActive) {
          floatDataSourceRef.current.show = isFloatsActive;
        }

        if (isFloatsActive && floatEntitiesRef.current.length > 0 && now - lastFloatOcclusionTime > 80) {
          lastFloatOcclusionTime = now;
          try {
            const cameraPos = camera.positionWC;
            occluder.cameraPosition = cameraPos;

            for (let i = 0; i < floatEntitiesRef.current.length; i++) {
              const item = floatEntitiesRef.current[i];
              const entity = item.entity;
              const pos = item.cartesianPos;

              // 1. Exact geometric horizon occlusion test using Cesium's EllipsoidalOccluder
              const isVisibleHorizon = occluder.isPointVisible(pos);
              if (!isVisibleHorizon) {
                if (entity.show) entity.show = false;
                continue;
              }

              // 2. Geodetic surface normal dot product to camera ray
              Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(pos, scratchNormal);
              Cesium.Cartesian3.subtract(cameraPos, pos, scratchToCam);
              Cesium.Cartesian3.normalize(scratchToCam, scratchToCam);
              const dot = Cesium.Cartesian3.dot(scratchNormal, scratchToCam);

              // Strict limb threshold (0.05): hides marker before it can protrude into space outside the globe boundary
              const minThreshold = 0.05;
              if (dot <= minThreshold) {
                if (entity.show) entity.show = false;
              } else {
                if (!entity.show) entity.show = true;
              }
            }
          } catch {
            // Guard against transient geometry calculation anomalies
          }
        }

        // Selection pin & radar ring horizon occlusion check
        if (pinEntityRef.current && pinEntityRef.current.position) {
          try {
            const pinPos = pinEntityRef.current.position.getValue(Cesium.JulianDate.now());
            if (pinPos) {
              const isPinVisible = occluder.isPointVisible(pinPos);
              if (!isPinVisible) {
                if (pinEntityRef.current.show) pinEntityRef.current.show = false;
                if (radarRingEntityRef.current && radarRingEntityRef.current.show) radarRingEntityRef.current.show = false;
              } else {
                Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(pinPos, scratchNormal);
                Cesium.Cartesian3.subtract(camera.positionWC, pinPos, scratchToCam);
                Cesium.Cartesian3.normalize(scratchToCam, scratchToCam);
                const pinDot = Cesium.Cartesian3.dot(scratchNormal, scratchToCam);
                const showPin = pinDot > 0.05;
                pinEntityRef.current.show = showPin;
                if (radarRingEntityRef.current) {
                  radarRingEntityRef.current.show = showPin;
                }
              }
            }
          } catch {
            // Guard against transient pin geometry calculation anomalies
          }
        }

        // Dynamic 3D ocean label horizon occlusion & limb culling:
        // Anchored strictly to Earth's 3D geographic coordinates. Labels on the far side of Earth
        // are geometrically occluded and hidden. Visible labels smoothly fade near the horizon limb.
        if (oceanLabelsRef.current.length > 0) {
          try {
            const cameraPos = camera.positionWC;
            occluder.cameraPosition = cameraPos;

            for (let i = 0; i < oceanLabelsRef.current.length; i++) {
              const item = oceanLabelsRef.current[i];
              const entity = item.entity;
              const pos = item.cartesianPos;

              // 1. Exact geometric horizon occlusion test using Cesium's EllipsoidalOccluder
              const isVisibleHorizon = occluder.isPointVisible(pos);
              if (!isVisibleHorizon) {
                if (entity.show) entity.show = false;
                continue;
              }

              // 2. Geodetic surface normal dot product to camera ray
              Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(pos, scratchNormal);
              Cesium.Cartesian3.subtract(cameraPos, pos, scratchToCam);
              Cesium.Cartesian3.normalize(scratchToCam, scratchToCam);
              const dot = Cesium.Cartesian3.dot(scratchNormal, scratchToCam);

              // Hide when approaching the limb so text NEVER breaches the circular Earth boundary
              const minThreshold = 0.28;
              if (dot <= minThreshold) {
                if (entity.show) entity.show = false;
              } else {
                if (!entity.show) entity.show = true;
                // Smooth fade factor between 0.28 and 0.46 for seamless limb dissolution
                const alphaFactor = Math.min(1.0, (dot - minThreshold) / 0.18);
                if (entity.label) {
                  const baseAlpha = item.isMajor ? 0.95 : 0.90;
                  const currentAlpha = baseAlpha * alphaFactor;
                  const baseHex = item.isMajor ? "#f8fafc" : "#e0f2fe";
                  entity.label.fillColor = Cesium.Color.fromCssColorString(baseHex).withAlpha(currentAlpha);
                  entity.label.outlineColor = Cesium.Color.fromCssColorString("#020617").withAlpha(0.95 * alphaFactor);
                }
              }
            }
          } catch {
            // Guard against transient geometry calculation anomalies
          }
        }

        // Dynamic Viewport-Safe Sun Positioning Engine & Viewport Clamp
        const updateSunPosition = (deltaTime: number) => {
          if (!atmosphericLightingRef.current || !viewerRef.current || viewerRef.current.isDestroyed() || !sunElRef.current) return;
          const currentViewer = viewerRef.current;
          const currentScene = currentViewer.scene;
          const currentCam = currentScene.camera;
          const currentCanvas = currentScene.canvas;
          if (!currentCanvas) return;

          // 1. Measure visible hero viewport bounds at throttled interval to prevent forced reflows every frame
          if (now - lastRectMeasureTime > 350) {
            lastRectMeasureTime = now;
            const heroEl = document.getElementById("hero-main-viewport") || document.querySelector("main");
            if (heroEl) {
              cachedHeroRect = heroEl.getBoundingClientRect();
            }
            if (containerRef.current) {
              cachedGlobeRect = containerRef.current.getBoundingClientRect();
            } else {
              cachedGlobeRect = cachedHeroRect;
            }
            if (currentCanvas) {
              const cr = currentCanvas.getBoundingClientRect();
              cachedCanvasRect = { left: cr.left, top: cr.top };
            }
          }

          const heroRect = cachedHeroRect;
          const globeRect = cachedGlobeRect;

          // 2. Safe margins so the sun never touches or clips against edges:
          // Top: comfortably below the header navigation bar (~64px)
          const safeMarginTop = Math.max(heroRect.top + 24, 76);
          // Bottom: comfortably above bottom telemetry & legends
          const safeMarginBottom = Math.max(safeMarginTop + 80, heroRect.bottom - 44);
          // Left & Right: safe bounds
          const safeMarginLeft = heroRect.left + 28;
          const safeMarginRight = Math.max(safeMarginLeft + 80, heroRect.right - 28);

          // 3. Determine Earth center on screen
          let earthCenterX = globeRect.left + globeRect.width / 2;
          let earthCenterY = globeRect.top + globeRect.height / 2;

          if (cesiumModuleRef.current) {
            try {
              const CesiumMod = cesiumModuleRef.current;
              const centerWC = CesiumMod.SceneTransforms.worldToWindowCoordinates(currentScene, CesiumMod.Cartesian3.ZERO);
              if (centerWC && typeof centerWC.x === "number" && !isNaN(centerWC.x)) {
                earthCenterX = cachedCanvasRect.left + centerWC.x;
                earthCenterY = cachedCanvasRect.top + centerWC.y;
              }
            } catch {
              // fallback to globeRect center
            }
          }

          // 4. Calculate orbital solar angle synchronized with camera orientation & Earth rotation
          const carto = currentCam.positionCartographic;
          const cameraLon = carto ? carto.longitude : 0;
          const heading = currentCam.heading || 0;
          const altitude = carto ? carto.height : INITIAL_CAMERA_ALTITUDE;

          // Orbit angle: natural motion coupled with globe axial rotation and camera heading
          const orbitAngle = -cameraLon - heading + Math.PI * 0.65;

          // Altitude-responsive scaling: contracts gently when zoomed in close so the sun remains naturally framed
          const zoomNorm = Math.max(0.0, Math.min(1.0, (altitude - MIN_CAMERA_ALTITUDE) / (MAX_CAMERA_ALTITUDE - MIN_CAMERA_ALTITUDE)));
          const baseRadiusX = globeRect.width * (0.36 + 0.16 * zoomNorm);
          const baseRadiusY = globeRect.height * (0.28 + 0.14 * zoomNorm);

          const cosA = Math.cos(orbitAngle);
          const sinA = Math.sin(orbitAngle);

          // Unconstrained celestial position in upper orbital dome
          const rawX = earthCenterX + baseRadiusX * cosA;
          const rawY = earthCenterY - baseRadiusY * 0.70 - Math.abs(sinA) * (baseRadiusY * 0.40) - (globeRect.height * 0.10);

          // 5. VIEWPORT-SAFE POSITIONING CONSTRAINT / CLAMP:
          // Strictly guarantees the sun never leaves the visible hero viewport
          const targetX = Math.max(safeMarginLeft, Math.min(safeMarginRight, rawX));
          const targetY = Math.max(safeMarginTop, Math.min(safeMarginBottom, rawY));

          // 6. Smooth physics interpolation
          if (sunPosRef.current.x === -999) {
            sunPosRef.current.x = targetX;
            sunPosRef.current.y = targetY;
          } else {
            const lerpFactor = 1.0 - Math.exp(-7.0 * deltaTime);
            sunPosRef.current.x += (targetX - sunPosRef.current.x) * lerpFactor;
            sunPosRef.current.y += (targetY - sunPosRef.current.y) * lerpFactor;

            // Hard safety clamp during abrupt window resizing
            sunPosRef.current.x = Math.max(safeMarginLeft, Math.min(safeMarginRight, sunPosRef.current.x));
            sunPosRef.current.y = Math.max(safeMarginTop, Math.min(safeMarginBottom, sunPosRef.current.y));
          }

          // 7. GPU hardware-accelerated style update
          const el = sunElRef.current;
          el.style.transform = `translate3d(${sunPosRef.current.x}px, ${sunPosRef.current.y}px, 0px) translate(-50%, -50%)`;
          if (el.style.opacity !== "1") {
            el.style.opacity = "1";
          }
        };

        // Frame-rate synchronized sun position update
        updateSunPosition(dt);
      });

      const handleWindowResize = () => {
        lastRectMeasureTime = 0;
        forceViewerResizeRef.current();
        // Immediate safe boundary re-clamp upon browser viewport resize
        if (!atmosphericLightingRef.current) return;
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          const camera = viewerRef.current.scene.camera;
          const carto = camera.positionCartographic;
          const cameraLon = carto ? carto.longitude : 0;
          const heading = camera.heading || 0;
          const altitude = carto ? carto.height : INITIAL_CAMERA_ALTITUDE;
          const heroEl = document.getElementById("hero-main-viewport") || document.querySelector("main");
          const heroRect = heroEl ? heroEl.getBoundingClientRect() : {
            left: 0,
            top: 60,
            right: window.innerWidth,
            bottom: window.innerHeight,
            width: window.innerWidth,
            height: window.innerHeight - 60,
          };
          const safeMarginTop = Math.max(heroRect.top + 24, 76);
          const safeMarginBottom = Math.max(safeMarginTop + 80, heroRect.bottom - 44);
          const safeMarginLeft = heroRect.left + 28;
          const safeMarginRight = Math.max(safeMarginLeft + 80, heroRect.right - 28);
          const globeRect = containerRef.current ? containerRef.current.getBoundingClientRect() : heroRect;
          const earthCenterX = globeRect.left + globeRect.width / 2;
          const earthCenterY = globeRect.top + globeRect.height / 2;
          const orbitAngle = -cameraLon - heading + Math.PI * 0.65;
          const zoomNorm = Math.max(0.0, Math.min(1.0, (altitude - MIN_CAMERA_ALTITUDE) / (MAX_CAMERA_ALTITUDE - MIN_CAMERA_ALTITUDE)));
          const baseRadiusX = globeRect.width * (0.36 + 0.16 * zoomNorm);
          const baseRadiusY = globeRect.height * (0.28 + 0.14 * zoomNorm);
          const rawX = earthCenterX + baseRadiusX * Math.cos(orbitAngle);
          const rawY = earthCenterY - baseRadiusY * 0.70 - Math.abs(Math.sin(orbitAngle)) * (baseRadiusY * 0.40) - (globeRect.height * 0.10);
          sunPosRef.current.x = Math.max(safeMarginLeft, Math.min(safeMarginRight, rawX));
          sunPosRef.current.y = Math.max(safeMarginTop, Math.min(safeMarginBottom, rawY));
          if (sunElRef.current) {
            sunElRef.current.style.transform = `translate3d(${sunPosRef.current.x}px, ${sunPosRef.current.y}px, 0px) translate(-50%, -50%)`;
          }
        }
      };
      window.addEventListener("resize", handleWindowResize);

      cleanups.push(() => {
        window.removeEventListener("resize", handleWindowResize);
        if (removeTickListener) {
          removeTickListener();
        }
      });

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handlerRef.current = handler;

      // 5. ENHANCED FLOAT SELECTION FEEDBACK:
      // Visually highlights the selected float or geographic location with radiant beacon pin, vertical beam, dynamic polyline radar ring, and label
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateSelectionPin = (position: any, colorHex = "#22d3ee", labelText?: string) => {
        if (pinEntityRef.current) {
          try {
            viewer.entities.remove(pinEntityRef.current);
          } catch {
            // Ignore removal errors
          }
          pinEntityRef.current = null;
        }
        if (radarRingEntityRef.current) {
          try {
            viewer.entities.remove(radarRingEntityRef.current);
          } catch {
            // Ignore removal errors
          }
          radarRingEntityRef.current = null;
        }

        const pinColor = Cesium.Color.fromCssColorString(colorHex);
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);

        const beaconBeamPositions = Cesium.Cartesian3.fromDegreesArrayHeights([
          lon,
          lat,
          0.0,
          lon,
          lat,
          75000.0,
        ]);

        // Selection pin: glowing center point, vertical glowing beam, and label
        pinEntityRef.current = viewer.entities.add({
          id: "selected-pin",
          position,
          point: {
            pixelSize: 8,
            color: pinColor,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2.0,
          },
          label: labelText
            ? {
                text: labelText,
                font: "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.fromCssColorString("#ffffff"),
                outlineColor: Cesium.Color.fromCssColorString("#020617"),
                outlineWidth: 3.0,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -16),
                disableDepthTestDistance: 0.0,
                scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.1, 2.5e7, 0.75),
              }
            : undefined,
          polyline: {
            positions: beaconBeamPositions,
            width: 2.2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.35,
              taperPower: 0.9,
              color: pinColor.withAlpha(0.9),
            }),
          },
        });

        // Pulsing radar ring: implemented as a dynamic POLYLINE CIRCLE with 64 points.
        // Completely eliminates EllipseGeometry and guarantees ZERO DeveloperError occurrences.
        const numPoints = 64;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const circlePositions: any[] = [];
        for (let i = 0; i <= numPoints; i++) {
          circlePositions.push(new Cesium.Cartesian3());
        }

        const cosBeta: number[] = [];
        const sinBeta: number[] = [];
        for (let i = 0; i <= numPoints; i++) {
          const beta = (i * 2 * Math.PI) / numPoints;
          cosBeta.push(Math.cos(beta));
          sinBeta.push(Math.sin(beta));
        }

        const lat1 = Cesium.Math.toRadians(lat);
        const lon1 = Cesium.Math.toRadians(lon);
        const sinLat1 = Math.sin(lat1);
        const cosLat1 = Math.cos(lat1);
        const EARTH_RADIUS = 6378137.0;
        const RAD_TO_DEG = 180.0 / Math.PI;
        const startPulseTime = performance.now();

        const pulsePositionsProperty = new Cesium.CallbackProperty(() => {
          const elapsed = (performance.now() - startPulseTime) / 1000;
          const cycle = (elapsed % 2.2) / 2.2;
          const radius = 18000.0 + cycle * 62000.0;
          const delta = radius / EARTH_RADIUS;
          const cosDelta = Math.cos(delta);
          const sinDelta = Math.sin(delta);

          for (let i = 0; i <= numPoints; i++) {
            const sinLat2 = sinLat1 * cosDelta + cosLat1 * sinDelta * cosBeta[i];
            const clampedSinLat2 = Math.max(-1.0, Math.min(1.0, sinLat2));
            const lat2 = Math.asin(clampedSinLat2);
            const y = sinBeta[i] * sinDelta * cosLat1;
            const x = cosDelta - sinLat1 * clampedSinLat2;
            const lon2 = lon1 + Math.atan2(y, x);

            Cesium.Cartesian3.fromDegrees(
              lon2 * RAD_TO_DEG,
              lat2 * RAD_TO_DEG,
              150.0,
              Cesium.Ellipsoid.WGS84,
              circlePositions[i]
            );
          }
          return circlePositions;
        }, false);

        radarRingEntityRef.current = viewer.entities.add({
          id: "selected-pin-radar-ring",
          polyline: {
            positions: pulsePositionsProperty,
            width: 2.4,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.32,
              taperPower: 0.95,
              color: pinColor.withAlpha(0.85),
            }),
          },
        });
      };
      updateSelectionPinRef.current = updateSelectionPin;

      // 4. FLOAT HOVER TOOLTIP & CURSOR FEEDBACK:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hoveredEntity: any = null;
      handler.setInputAction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (movement: any) => {
          if (activeLayersRef.current && activeLayersRef.current.argoFloats === false) {
            if (hoveredEntity) {
              if (hoveredEntity.point) {
                const prevId = parseInt(hoveredEntity.id.replace("float-", ""), 10);
                const prevFloat = ARGO_FLOATS.find((f) => f.id === prevId);
                hoveredEntity.point.pixelSize = prevFloat?.maxDepth === 6000 ? 6.0 : 5.0;
              }
              hoveredEntity = null;
            }
            setIsTooltipVisible(false);
            if (containerRef.current) {
              containerRef.current.style.cursor = "default";
            }
            return;
          }

          const pickedObject = scene.pick(movement.endPosition);
          if (
            Cesium.defined(pickedObject) &&
            pickedObject.id &&
            typeof pickedObject.id.id === "string"
          ) {
            const entId = pickedObject.id.id;
            if (entId.startsWith("float-")) {
              const floatId = parseInt(entId.replace("float-", ""), 10);
              const floatObj = ARGO_FLOATS.find((f) => f.id === floatId || f.wmoId === floatId);

              if (floatObj) {
                if (hoveredEntity !== pickedObject.id) {
                  if (hoveredEntity && hoveredEntity.point) {
                    const prevId = parseInt(hoveredEntity.id.replace("float-", ""), 10);
                    const prevFloat = ARGO_FLOATS.find((f) => f.id === prevId);
                    hoveredEntity.point.pixelSize = prevFloat?.maxDepth === 6000 ? 6.0 : 5.0;
                  }
                  hoveredEntity = pickedObject.id;
                  if (hoveredEntity.point) {
                    hoveredEntity.point.pixelSize = 8.0;
                  }
                }

                setHoveredFloat(floatObj);
                setTooltipPos({ x: movement.endPosition.x, y: movement.endPosition.y });
                setIsTooltipVisible(true);

                if (containerRef.current) {
                  containerRef.current.style.cursor = "pointer";
                }
                return;
              }
            } else if (entId.startsWith("ocean-label-")) {
              setIsTooltipVisible(false);
              if (containerRef.current) {
                containerRef.current.style.cursor = "pointer";
              }
              return;
            }
          }

          if (hoveredEntity && hoveredEntity.point) {
            const prevId = parseInt(hoveredEntity.id.replace("float-", ""), 10);
            const prevFloat = ARGO_FLOATS.find((f) => f.id === prevId);
            hoveredEntity.point.pixelSize = prevFloat?.maxDepth === 6000 ? 6.0 : 5.0;
            hoveredEntity = null;
          }

          setIsTooltipVisible(false);
          if (containerRef.current) {
            containerRef.current.style.cursor = isDraggingRef.current ? "grabbing" : "grab";
          }
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE
      );

      // ScreenSpaceEventHandler input bindings for seamless rotation pause & resume
      handler.setInputAction(pauseRotation, Cesium.ScreenSpaceEventType.LEFT_DOWN);
      handler.setInputAction(scheduleResumeRotation, Cesium.ScreenSpaceEventType.LEFT_UP);
      handler.setInputAction(pauseRotation, Cesium.ScreenSpaceEventType.RIGHT_DOWN);
      handler.setInputAction(scheduleResumeRotation, Cesium.ScreenSpaceEventType.RIGHT_UP);
      handler.setInputAction(pauseRotation, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
      handler.setInputAction(scheduleResumeRotation, Cesium.ScreenSpaceEventType.MIDDLE_UP);
      handler.setInputAction(pauseRotation, Cesium.ScreenSpaceEventType.PINCH_START);
      handler.setInputAction(scheduleResumeRotation, Cesium.ScreenSpaceEventType.PINCH_END);

      // LEFT CLICK SELECTION
      handler.setInputAction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (movement: any) => {
          scheduleResumeRotation();

          const pickedObject = scene.pick(movement.position);
          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entityId = pickedObject.id.id;
            if (typeof entityId === "string") {
              if (entityId.startsWith("float-")) {
                if (activeLayersRef.current && activeLayersRef.current.argoFloats === false) {
                  return;
                }
                const floatId = parseInt(entityId.replace("float-", ""), 10);
                const floatObj = ARGO_FLOATS.find((f) => f.id === floatId || f.wmoId === floatId);
                if (floatObj) {
                  lastFocusedFloatIdRef.current = floatObj.id;
                  focusOnFloatRef.current(floatObj);
                  handleLocationPickedRef.current(floatObj.latitude, floatObj.longitude, floatObj.wmoId);
                  return;
                }
              } else if (entityId.startsWith("ocean-label-")) {
                const oceanId = entityId.replace("ocean-label-", "");
                const oceanObj = OCEAN_REGIONS.find((o) => o.id === oceanId);
                if (oceanObj) {
                  focusGlobeOnLocationRef.current(oceanObj.latitude, oceanObj.longitude, {
                    altitude: oceanObj.zoomHeight || 3000000.0,
                    label: oceanObj.name,
                    colorHex: "#60a5fa",
                  });
                  handleLocationPickedRef.current(oceanObj.latitude, oceanObj.longitude);
                  return;
                }
              }
            }
          }

          let cartesian = null;
          if (scene.pickPositionSupported) {
            cartesian = scene.pickPosition(movement.position);
          }
          if (!cartesian) {
            cartesian = viewer.camera.pickEllipsoid(
              movement.position,
              scene.globe.ellipsoid
            );
          }

          if (cartesian) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);

            focusGlobeOnLocationRef.current(lat, lon, {
              altitude: 1800000.0,
              label: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`,
              colorHex: "#00d2ff",
            });

            handleLocationPickedRef.current(lat, lon);
          }
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      );

      if (isMounted) {
        setIsTilesLoaded(true);
      }
    }

    initCesium();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modeRef.current === "region") {
        handleResetGlobalRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    cleanups.push(() => window.removeEventListener("keydown", handleKeyDown));

    return () => {
      isMounted = false;
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {
          // Ignore cleanup errors
        }
      });
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      oceanLabelsRef.current = [];
      floatEntitiesRef.current = [];
      currentEntitiesRef.current = [];
      if (pinEntityRef.current && viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.entities.remove(pinEntityRef.current);
        } catch {
          // Ignore removal errors
        }
        pinEntityRef.current = null;
      }
      if (radarRingEntityRef.current && viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.entities.remove(radarRingEntityRef.current);
        } catch {
          // Ignore removal errors
        }
        radarRingEntityRef.current = null;
      }
      if (floatDataSourceRef.current && viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.dataSources.remove(floatDataSourceRef.current);
        } catch {
          // Ignore removal errors
        }
        floatDataSourceRef.current = null;
      }
      if (particleCollectionRef.current && viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.scene.primitives.remove(particleCollectionRef.current);
        } catch {
          // Ignore removal errors
        }
        particleCollectionRef.current = null;
      }
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        setCesiumViewer(null);
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Sync all 5 functional ocean data layers with activeLayers state
  useEffect(() => {
    if (!activeLayers) return;

    // 1. Active ARGO Float Pins
    const isFloatsActive = activeLayers.argoFloats !== false;
    if (floatDataSourceRef.current) {
      floatDataSourceRef.current.show = isFloatsActive;
    }
    if (floatEntitiesRef.current) {
      floatEntitiesRef.current.forEach((item) => {
        if (item.entity) {
          item.entity.show = isFloatsActive;
          if (item.entity.point) {
            item.entity.point.show = isFloatsActive;
          }
        }
      });
    }
    if (!isFloatsActive && pinEntityRef.current) {
      pinEntityRef.current.show = false;
    }

    // 2. Sea Surface Temperature (SST)
    if (sstLayerRef.current) {
      sstLayerRef.current.show = activeLayers.temperatureHeatmap === true;
    }

    // 3. Salinity Anomaly Overlay
    if (salinityLayerRef.current) {
      salinityLayerRef.current.show = activeLayers.salinityOverlay === true;
    }

    // 4. Geostrophic Currents Vectors
    if (currentEntitiesRef.current.length > 0) {
      const isCurrentsActive = activeLayers.currentsVector === true;
      currentEntitiesRef.current.forEach((entity) => {
        entity.show = isCurrentsActive;
        if (entity.polyline && isCurrentsActive && cesiumModuleRef.current) {
          const Cesium = cesiumModuleRef.current;
          entity.polyline.width = 2.0;
          entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            taperPower: 0.85,
            color: Cesium.Color.fromCssColorString("#00d2ff").withAlpha(0.65),
          });
        }
      });
    }

    // 5. Bathymetry & Seafloor Relief
    const isBathymetryActive = activeLayers.bathymetry === true;
    if (bathymetryLayerRef.current) {
      bathymetryLayerRef.current.show = isBathymetryActive;
    }
    if (baseImageryLayerRef.current) {
      if (isBathymetryActive) {
        baseImageryLayerRef.current.contrast = 1.35;
        baseImageryLayerRef.current.brightness = 0.90;
      } else {
        baseImageryLayerRef.current.contrast = 1.15;
        baseImageryLayerRef.current.brightness = 1.0;
      }
    }
  }, [activeLayers]);

  // Unified Argo Float Focus Effect
  useEffect(() => {
    const targetId = focusTarget?.floatId ?? selectedFloatId;
    if (!targetId) {
      lastFocusedFloatIdRef.current = null;
      return;
    }

    // If already focused on this float and this was not an explicit new focusTarget trigger, skip
    if (lastFocusedFloatIdRef.current === targetId && !focusTarget) {
      return;
    }
    lastFocusedFloatIdRef.current = targetId;

    const floatObj = ARGO_FLOATS.find((f) => f.id === targetId || f.wmoId === targetId);
    if (floatObj) {
      focusOnFloatRef.current(floatObj);
    }
  }, [focusTarget, selectedFloatId]);

  // Atmospheric Solar Hydrodynamic Lighting Toggle
  useEffect(() => {
    if (!viewerRef.current || !cesiumModuleRef.current) return;
    const viewer = viewerRef.current;
    const Cesium = cesiumModuleRef.current;
    const scene = viewer.scene;
    if (!scene || !scene.globe) return;

    if (atmosphericLighting) {
      scene.globe.enableLighting = true;
      scene.globe.showGroundAtmosphere = true;
      scene.globe.dynamicAtmosphereLighting = true;
      scene.globe.dynamicAtmosphereLightingFromSun = true;
      scene.globe.nightColor = Cesium.Color.fromCssColorString("#020b18");

      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = true;
        scene.skyAtmosphere.atmosphereLightIntensity = 3.6;
        scene.skyAtmosphere.brightnessShift = 0.04;
        scene.skyAtmosphere.hueShift = -0.04;
        scene.skyAtmosphere.saturationShift = 0.08;
      }
      if (scene.sun) {
        scene.sun.show = false;
      }
      if (baseImageryLayerRef.current) {
        baseImageryLayerRef.current.contrast = 1.25;
        baseImageryLayerRef.current.brightness = 1.05;
      }
    } else {
      scene.globe.enableLighting = false;
      scene.globe.showGroundAtmosphere = false;
      scene.globe.dynamicAtmosphereLighting = false;
      scene.globe.dynamicAtmosphereLightingFromSun = false;

      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = true;
        scene.skyAtmosphere.atmosphereLightIntensity = 2.2;
        scene.skyAtmosphere.brightnessShift = 0.0;
        scene.skyAtmosphere.hueShift = -0.02;
        scene.skyAtmosphere.saturationShift = 0.0;
      }
      if (scene.sun) {
        scene.sun.show = false;
      }
      if (baseImageryLayerRef.current) {
        baseImageryLayerRef.current.contrast = 1.15;
        baseImageryLayerRef.current.brightness = 1.0;
      }
    }
  }, [atmosphericLighting]);

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ minHeight: "100%", minWidth: "100%" }}
      aria-label="Interactive 3D Earth geospatial ocean viewer"
    >
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        style={{
          cursor: "grab",
          width: "100%",
          height: "100%",
        }}
      />

      {/* Floating scientific tooltip on float hover */}
      <FloatHoverTooltip
        float={hoveredFloat}
        position={tooltipPos}
        visible={isTooltipVisible}
      />

      {/* GlobeSelection HUD removed per user request — geolocation info is now routed directly to Left AI Chat / 4D Explorer */}

      {/* Understated Salinity Anomaly HUD Legend */}
      {activeLayers?.salinityOverlay && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-30 flex flex-col gap-1 rounded-xl border border-[#1a2f4c] bg-[#061224]/85 p-2 px-3 backdrop-blur-md font-mono text-[9px] text-[#ececec] shadow-xl animate-fade-in">
          <div className="flex items-center justify-between gap-3 font-semibold tracking-wider text-[#c084fc] uppercase">
            <span>SALINITY ANOMALY</span>
            <span className="text-[8px] text-[#7090b0]">PSU</span>
          </div>
          <div className="h-1.5 w-36 rounded-full bg-gradient-to-r from-[#06b6d4] via-[#0284c7]/50 to-[#c084fc]" />
          <div className="flex items-center justify-between text-[7.5px] text-[#8ea9c7]">
            <span>Low (32)</span>
            <span>Normal (35)</span>
            <span>High (38)</span>
          </div>
        </div>
      )}

      {/* Understated Sea Surface Temperature HUD Legend */}
      {activeLayers?.temperatureHeatmap && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-30 flex flex-col gap-1 rounded-xl border border-[#1a2f4c] bg-[#061224]/85 p-2 px-3 backdrop-blur-md font-mono text-[9px] text-[#ececec] shadow-xl animate-fade-in">
          <div className="flex items-center justify-between gap-3 font-semibold tracking-wider text-[#00d2ff] uppercase">
            <span>SEA SURFACE TEMP</span>
            <span className="text-[8px] text-[#7090b0]">SST (°C)</span>
          </div>
          <div className="h-1.5 w-36 rounded-full bg-gradient-to-r from-[#041e44] via-[#0ea5e9] to-[#f59e0b]" />
          <div className="flex items-center justify-between text-[7.5px] text-[#8ea9c7]">
            <span>Polar (0°C)</span>
            <span>Temperate</span>
            <span>Tropics (30°C)</span>
          </div>
        </div>
      )}

      {(mode === "region" || isZoomedIn) && (
        <button
          type="button"
          onClick={handleResetGlobal}
          className="pointer-events-auto absolute top-3 right-3 z-30 flex items-center gap-1.5 rounded-full border border-[#1a2f4c] bg-[#061224]/90 px-3.5 py-1.5 text-xs font-mono font-medium text-[#ececec] shadow-xl backdrop-blur-md transition-all hover:bg-[#0a1e3a] hover:text-[#00d2ff] hover:border-[#00d2ff]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d2ff]/40 cursor-pointer"
          aria-label="Return to Global View"
        >
          <svg
            className="h-3.5 w-3.5 text-[#00d2ff]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <span>Global View</span>
        </button>
      )}

      {/* Viewport-Safe Atmospheric Solar Body (Strictly clamped within visible hero viewport, layered behind UI) */}
      {atmosphericLighting && isClientMounted && typeof document !== "undefined" && createPortal(
        <div
          ref={sunElRef}
          className="pointer-events-none fixed top-0 left-0 select-none transition-opacity duration-500 opacity-0"
          style={{
            zIndex: 5, // Behind Header (z-20), Hero text (z-10), Telemetry panels (z-20), Modals (z-50)
            willChange: "transform",
          }}
          aria-hidden="true"
        >
          {/* Layer 1: Ambient Atmospheric Solar Bloom */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-700"
            style={{
              width: atmosphericLighting ? "148px" : "132px",
              height: atmosphericLighting ? "148px" : "132px",
              background: atmosphericLighting
                ? "radial-gradient(circle, rgba(255, 205, 110, 0.28) 0%, rgba(255, 160, 50, 0.12) 42%, rgba(0, 210, 255, 0.05) 68%, transparent 100%)"
                : "radial-gradient(circle, rgba(255, 215, 125, 0.20) 0%, rgba(255, 170, 60, 0.08) 42%, transparent 75%)",
              filter: "blur(14px)",
            }}
          />

          {/* Layer 2: Subtle Horizontal Anamorphic Solar Streak (Diffraction Flare) */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              width: "128px",
              height: "2px",
              background: "linear-gradient(90deg, transparent 0%, rgba(255, 245, 220, 0.5) 50%, transparent 100%)",
              filter: "blur(0.5px)",
              opacity: atmosphericLighting ? 0.9 : 0.75,
            }}
          />

          {/* Layer 3: Radiant Atmospheric Corona Halo */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              width: "52px",
              height: "52px",
              background: "radial-gradient(circle, rgba(255, 245, 215, 0.8) 0%, rgba(255, 200, 95, 0.42) 38%, rgba(255, 140, 30, 0.14) 68%, transparent 100%)",
              filter: "blur(3.5px)",
            }}
          />

          {/* Layer 4: Brilliant Inner Golden Glow */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              width: "32px",
              height: "32px",
              background: "radial-gradient(circle, #ffffff 0%, rgba(255, 240, 185, 0.9) 45%, rgba(255, 190, 70, 0.35) 80%, transparent 100%)",
              filter: "blur(1.2px)",
            }}
          />

          {/* Layer 5: Small, realistic, subtle celestial sun core (20px) */}
          <div
            className="relative rounded-full pointer-events-none"
            style={{
              width: "20px",
              height: "20px",
              background: "radial-gradient(circle at 45% 45%, #ffffff 20%, #fffdf4 50%, #ffeaa8 80%, #f59e0b 100%)",
              boxShadow: "0 0 14px rgba(255, 235, 160, 0.95), 0 0 28px rgba(255, 180, 50, 0.5)",
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

export default OceanGlobe;
