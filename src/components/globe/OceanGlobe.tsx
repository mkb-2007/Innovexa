"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { ExplorationMode, GeoLocation, GlobeProps, ArgoFloat, OceanLayerState } from "@/types/globe";
import { getApproximateOceanRegion } from "@/lib/globe/cesium";
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
}

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
  const updateSelectionPinRef = useRef<((pos: any, colorHex?: string) => void) | null>(null);

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

  const handleResetGlobal = useCallback(() => {
    updateMode("global");
    setSelectedLocation(null);

    const viewer = viewerRef.current;
    const Cesium = cesiumModuleRef.current;

    if (viewer && Cesium) {
      if (pinEntityRef.current) {
        viewer.entities.remove(pinEntityRef.current);
        pinEntityRef.current = null;
      }

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-155.0, 14.0, 8800000.0),
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
          "/cesium";
      }

      const Cesium = await import("cesium");
      cesiumModuleRef.current = Cesium;
      if (typeof window !== "undefined") {
        (window as unknown as { Cesium: unknown }).Cesium = Cesium;
      }

      if (!isMounted || !containerRef.current) return;

      const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (ionToken) {
        Cesium.Ion.defaultAccessToken = ionToken;
      } else {
        Cesium.Ion.defaultAccessToken = "";
      }

      // Configure base imagery layer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let baseLayer: any = false;
      if (ionToken) {
        try {
          baseLayer = Cesium.ImageryLayer.fromWorldImagery({});
        } catch {
          baseLayer = false;
        }
      }

      if (!baseLayer && !googleMapsKey) {
        try {
          const esriProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            {
              enablePickFeatures: false,
            }
          );
          baseLayer = new Cesium.ImageryLayer(esriProvider);
        } catch (err) {
          console.warn("Could not load Esri World Imagery fallback:", err);
          try {
            const tmsProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
              Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
            );
            baseLayer = new Cesium.ImageryLayer(tmsProvider);
          } catch {
            baseLayer = false;
          }
        }
      }

      if (baseLayer) {
        baseLayer.brightness = 1.0;
        baseLayer.contrast = 1.15;
        baseLayer.saturation = 0.95;
        baseLayer.gamma = 0.95;
        baseLayer.hue = 0.0;
      }

      if (!isMounted || !containerRef.current) return;

      // Initialize Viewer with high-definition settings & realistic atmosphere
      const viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer,
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

      viewerRef.current = viewer;
      viewer.clock.shouldAnimate = true;
      if (typeof window !== "undefined") {
        (window as unknown as { cesiumViewer: unknown }).cesiumViewer = viewer;
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
      // - enableLighting = false: Entire Earth is clearly visible everywhere (no dark night side)
      // - showGroundAtmosphere = false: No cyan fog wash over the ocean surface
      // - skyAtmosphere = 2.2: Soft, thin, elegant outer atmospheric rim
      scene.globe.enableLighting = false;
      scene.globe.showGroundAtmosphere = false;
      scene.globe.baseColor = Cesium.Color.fromCssColorString("#062438");
      scene.globe.depthTestAgainstTerrain = true;
      (scene.globe as unknown as { wireframe: boolean }).wireframe = false;

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

      if (googleMapsKey) {
        try {
          const tileset = await Cesium.createGooglePhotorealistic3DTileset({
            key: googleMapsKey,
            onlyUsingWithGoogleGeocoder: true,
          });
          if (isMounted) {
            scene.primitives.add(tileset);
            setIsUsingGoogleTiles(true);
          }
        } catch {
          setIsUsingGoogleTiles(false);
          if (!ionToken) {
            try {
              const tmsProvider =
                await Cesium.TileMapServiceImageryProvider.fromUrl(
                  Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
                );
              scene.imageryLayers.addImageryProvider(tmsProvider);
            } catch {
              // Globe baseColor remains
            }
          }
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
          const sstLayer = viewer.imageryLayers.addImageryProvider(sstProvider);
          sstLayer.alpha = 0.55;
          sstLayer.show = initialLayers?.temperatureHeatmap === true;
          sstLayerRef.current = sstLayer;
        }

        // 2. Salinity Anomaly Overlay Layer
        const salinityDataUrl = createSalinityTexture();
        if (salinityDataUrl) {
          const salProvider = await Cesium.SingleTileImageryProvider.fromUrl(salinityDataUrl, {
            rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
          });
          const salLayer = viewer.imageryLayers.addImageryProvider(salProvider);
          salLayer.alpha = 0.55;
          salLayer.show = initialLayers?.salinityOverlay === true;
          salinityLayerRef.current = salLayer;
        }

        // 3. Bathymetry & Seafloor Relief Layer
        const bathyDataUrl = createBathymetryTexture();
        if (bathyDataUrl) {
          const bathyProvider = await Cesium.SingleTileImageryProvider.fromUrl(bathyDataUrl, {
            rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
          });
          const bathyLayer = viewer.imageryLayers.addImageryProvider(bathyProvider);
          bathyLayer.alpha = 0.65;
          bathyLayer.show = initialLayers?.bathymetry === true;
          bathymetryLayerRef.current = bathyLayer;
        }

        if (initialLayers?.bathymetry && baseImageryLayerRef.current) {
          baseImageryLayerRef.current.contrast = 1.35;
          baseImageryLayerRef.current.brightness = 0.90;
        }
      } catch (err) {
        console.warn("Could not initialize procedural ocean layers:", err);
      }

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-155.0, 14.0, 8800000.0),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-90.0),
          roll: 0.0,
        },
      });

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
        isDraggingRef.current = true;
        isInteractingRef.current = true;
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

      const onWheel = () => {
        isInteractingRef.current = true;
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
        }
        idleTimeoutRef.current = setTimeout(() => {
          isInteractingRef.current = false;
        }, 1200);
      };

      const canvas = viewer.canvas;
      canvas.addEventListener("pointerdown", pauseRotation);
      canvas.addEventListener("pointerup", scheduleResumeRotation);
      canvas.addEventListener("pointercancel", scheduleResumeRotation);
      canvas.addEventListener("mouseleave", scheduleResumeRotation);
      window.addEventListener("pointerup", scheduleResumeRotation);
      window.addEventListener("mouseup", scheduleResumeRotation);
      canvas.addEventListener("wheel", onWheel, { passive: true });
      canvas.addEventListener("touchstart", pauseRotation, { passive: true });
      canvas.addEventListener("touchend", scheduleResumeRotation, { passive: true });
      canvas.addEventListener("touchcancel", scheduleResumeRotation, { passive: true });

      cleanups.push(() => {
        canvas.removeEventListener("pointerdown", pauseRotation);
        canvas.removeEventListener("pointerup", scheduleResumeRotation);
        canvas.removeEventListener("pointercancel", scheduleResumeRotation);
        canvas.removeEventListener("mouseleave", scheduleResumeRotation);
        window.removeEventListener("pointerup", scheduleResumeRotation);
        window.removeEventListener("mouseup", scheduleResumeRotation);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("touchstart", pauseRotation);
        canvas.removeEventListener("touchend", scheduleResumeRotation);
        canvas.removeEventListener("touchcancel", scheduleResumeRotation);
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

      let lastTickTime = performance.now();
      const scratchNormal = new Cesium.Cartesian3();
      const scratchToCam = new Cesium.Cartesian3();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const occluder = new (Cesium as any).EllipsoidalOccluder(
        Cesium.Ellipsoid.WGS84,
        Cesium.Cartesian3.ZERO
      );

      // Liquid-smooth axial Earth rotation, orbital ring animation, data particle drift, and true 3D ocean label occlusion
      const removeTickListener = viewer.clock.onTick.addEventListener(() => {
        if (!viewerRef.current || viewerRef.current.isDestroyed()) return;

        const now = performance.now();
        const dt = Math.min((now - lastTickTime) / 1000, 0.1);
        lastTickTime = now;

        const camera = viewerRef.current.scene.camera;

        // Liquid-smooth axial Earth rotation in global mode
        if (modeRef.current === "global") {
          const isBusy = isDraggingRef.current || isInteractingRef.current;
          const targetIdleWeight = !isBusy ? 1.0 : 0.0;
          cursorMotionRef.current.idleWeight +=
            (targetIdleWeight - cursorMotionRef.current.idleWeight) * (1 - Math.exp(-dt * 4));

          if (cursorMotionRef.current.idleWeight > 0.005) {
            // Smooth ~2.3 degrees per second West-to-East natural Earth rotation
            const rotationAngle = -0.040 * dt * cursorMotionRef.current.idleWeight;
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

        if (isFloatsActive && floatEntitiesRef.current.length > 0) {
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

        // Selection pin horizon occlusion check
        if (pinEntityRef.current && pinEntityRef.current.position) {
          try {
            const pinPos = pinEntityRef.current.position.getValue(Cesium.JulianDate.now());
            if (pinPos) {
              const isPinVisible = occluder.isPointVisible(pinPos);
              if (!isPinVisible) {
                if (pinEntityRef.current.show) pinEntityRef.current.show = false;
              } else {
                Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(pinPos, scratchNormal);
                Cesium.Cartesian3.subtract(camera.positionWC, pinPos, scratchToCam);
                Cesium.Cartesian3.normalize(scratchToCam, scratchToCam);
                const pinDot = Cesium.Cartesian3.dot(scratchNormal, scratchToCam);
                pinEntityRef.current.show = pinDot > 0.05;
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
      });

      cleanups.push(() => {
        if (removeTickListener) {
          removeTickListener();
        }
      });

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handlerRef.current = handler;

      // 5. ENHANCED FLOAT SELECTION FEEDBACK:
      // Visually highlights the selected float with radiant beacon pin, vertical beam, and dynamic pulsing radar ring
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateSelectionPin = (position: any, colorHex = "#22d3ee") => {
        if (pinEntityRef.current) {
          viewer.entities.remove(pinEntityRef.current);
          pinEntityRef.current = null;
        }

        const pinColor = Cesium.Color.fromCssColorString(colorHex);
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);

        const startPulseTime = performance.now();
        let cachedRadius = 24000.0;
        let cachedAlpha = 0.8;
        let lastEvalMs = -1;

        const syncPulse = () => {
          const now = performance.now();
          // Synchronize evaluation within 12ms so both axes always receive identical values in the same frame
          if (lastEvalMs < 0 || now - lastEvalMs > 12) {
            lastEvalMs = now;
            const elapsed = (now - startPulseTime) / 1000;
            const cycle = (elapsed % 2.2) / 2.2;
            cachedRadius = 18000.0 + cycle * 62000.0;
            cachedAlpha = Math.max(0.0, (1.0 - cycle) * 0.85);
          }
        };

        // Guarantee semiMajorAxis >= semiMinorAxis across any async evaluation
        const semiMajorProp = new Cesium.CallbackProperty(() => {
          syncPulse();
          return cachedRadius;
        }, false);

        const semiMinorProp = new Cesium.CallbackProperty(() => {
          syncPulse();
          return cachedRadius * 0.9999;
        }, false);

        const beaconBeamPositions = Cesium.Cartesian3.fromDegreesArrayHeights([
          lon,
          lat,
          0.0,
          lon,
          lat,
          75000.0,
        ]);

        pinEntityRef.current = viewer.entities.add({
          id: "selected-pin",
          position,
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString("#22d3ee"),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2.0,
          },
          polyline: {
            positions: beaconBeamPositions,
            width: 2.2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.35,
              taperPower: 0.9,
              color: Cesium.Color.fromCssColorString("#22d3ee").withAlpha(0.9),
            }),
          },
          ellipse: {
            semiMajorAxis: semiMajorProp,
            semiMinorAxis: semiMinorProp,
            height: 0.0,
            granularity: Cesium.Math.toRadians(3.0),
            material: new Cesium.ColorMaterialProperty(
              new Cesium.CallbackProperty(() => {
                syncPulse();
                return pinColor.withAlpha(cachedAlpha * 0.2);
              }, false)
            ),
            outline: true,
            outlineColor: new Cesium.CallbackProperty(() => {
              syncPulse();
              return pinColor.withAlpha(cachedAlpha);
            }, false),
            outlineWidth: 2.0,
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
      handler.setInputAction(onWheel, Cesium.ScreenSpaceEventType.WHEEL);

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
                  const cartesian = Cesium.Cartesian3.fromDegrees(floatObj.longitude, floatObj.latitude, 25000.0);
                  updateSelectionPin(cartesian, "#22d3ee");

                  viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(floatObj.longitude, floatObj.latitude, 1200000.0),
                    duration: 1.5,
                    easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
                  });
                  handleLocationPickedRef.current(floatObj.latitude, floatObj.longitude, floatObj.wmoId);
                  return;
                }
              } else if (entityId.startsWith("ocean-label-")) {
                const oceanId = entityId.replace("ocean-label-", "");
                const oceanObj = OCEAN_REGIONS.find((o) => o.id === oceanId);
                if (oceanObj) {
                  const cartesian = Cesium.Cartesian3.fromDegrees(oceanObj.longitude, oceanObj.latitude, 0.0);
                  updateSelectionPin(cartesian, "#60a5fa");

                  viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(
                      oceanObj.longitude,
                      oceanObj.latitude,
                      oceanObj.zoomHeight || 3000000.0
                    ),
                    duration: 1.5,
                    easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
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

            updateSelectionPin(cartesian, "#00d2ff");

            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1400000.0),
              orientation: {
                heading: Cesium.Math.toRadians(0.0),
                pitch: Cesium.Math.toRadians(-60.0),
                roll: 0.0,
              },
              duration: 1.5,
              easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
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

  // Sync selectedFloatId to fly to location and trigger enhanced selection beacon
  useEffect(() => {
    if (!selectedFloatId || !viewerRef.current || !cesiumModuleRef.current) return;
    const floatObj = ARGO_FLOATS.find(
      (f) => f.id === selectedFloatId || f.wmoId === selectedFloatId
    );
    if (floatObj) {
      const Cesium = cesiumModuleRef.current;
      const viewer = viewerRef.current;
      const cartesian = Cesium.Cartesian3.fromDegrees(floatObj.longitude, floatObj.latitude, 25000.0);

      if (updateSelectionPinRef.current) {
        updateSelectionPinRef.current(cartesian, "#22d3ee");
      }

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          floatObj.longitude,
          floatObj.latitude,
          1200000.0
        ),
        duration: 1.5,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
      });
      requestAnimationFrame(() => {
        handleLocationPickedRef.current(floatObj.latitude, floatObj.longitude, floatObj.wmoId);
      });
    }
  }, [selectedFloatId]);

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
        scene.sun.show = true;
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
      aria-label="Interactive 3D Earth geospatial ocean viewer"
    >
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        style={{
          cursor: "grab",
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

      {mode === "region" && (
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
    </div>
  );
}
