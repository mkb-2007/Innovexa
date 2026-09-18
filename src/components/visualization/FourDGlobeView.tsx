"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  OceanVariable,
  VARIABLE_CONFIG,
  getVariableColor,
} from "@/lib/globe/fourDColorScales";

interface TrajectoryPoint {
  profile_index: number;
  latitude: number;
  longitude: number;
  time: string;
  max_depth: number | null;
  point_count: number;
}

interface DepthMeasurement {
  depth: number;
  temperature: number;
  salinity: number;
}

interface FourDGlobeViewProps {
  selectedYear: number;
  selectedMonth: number;
  selectedDepth: number;
  parameter: OceanVariable;
  region: string;
}

export function FourDGlobeView({
  selectedYear,
  selectedMonth,
  selectedDepth,
  parameter,
  region,
}: FourDGlobeViewProps) {
  void region;
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cesiumRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([]);
  const [activeProfileData, setActiveProfileData] = useState<DepthMeasurement[]>([]);
  // 2. Determine active cycle based on selectedYear and selectedMonth derived via useMemo
  const activeCycle = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return null;

    // Target date from slider
    const targetDate = new Date(selectedYear, selectedMonth - 1, 15).getTime();

    // Find cycle with closest timestamp
    let closest = trajectory[0];
    let minDiff = Infinity;

    for (const point of trajectory) {
      const ptTime = new Date(point.time).getTime();
      const diff = Math.abs(ptTime - targetDate);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }

    return closest;
  }, [trajectory, selectedYear, selectedMonth]);

  // Entities references for fast dynamic updates without destroying scene
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trajectoryEntityRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeBeaconEntityRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const depthColumnEntitiesRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const depthSliceEntityRef = useRef<any>(null);

  // 1. Fetch real ARGO trajectory on mount
  useEffect(() => {
    let isMounted = true;
    async function loadTrajectory() {
      try {
        const res = await fetch("/api/4d?type=trajectory");
        if (!res.ok) return;
        const data = await res.json();
        const rawPoints: TrajectoryPoint[] = Array.isArray(data.trajectory)
          ? data.trajectory
          : Array.isArray(data.trajectory?.points)
          ? data.trajectory.points
          : Array.isArray(data.points)
          ? data.points
          : [];
        if (isMounted && rawPoints.length > 0) {
          setTrajectory(rawPoints);
        }
      } catch (err) {
        console.warn("[FourDGlobeView] Trajectory fetch fallback:", err);
      }
    }
    loadTrajectory();
    return () => {
      isMounted = false;
    };
  }, []);



  // 3. Fetch real vertical CTD depth profile for active cycle
  useEffect(() => {
    if (!activeCycle) return;
    const cycle = activeCycle;
    let isMounted = true;

    async function loadProfile() {
      try {
        const res = await fetch(`/api/4d?type=profile&index=${cycle.profile_index}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.data) {
          setActiveProfileData(data.data);
        }
      } catch (err) {
        console.warn("[FourDGlobeView] Profile fetch fallback:", err);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [activeCycle]);

  // 4. Initialize Cesium 3D Globe inside the 4D Explorer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    let isMounted = true;
    const cleanups: (() => void)[] = [];

    async function initCesium() {
      try {
        if (typeof window !== "undefined") {
          (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium/";
        }
        const Cesium = await import("cesium");
        if (!isMounted || !containerRef.current) return;
        cesiumRef.current = Cesium;

        // Lightweight, high-performance Cesium Viewer for 4D sub-view
        const viewer = new Cesium.Viewer(containerRef.current, {
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
          contextOptions: {
            webgl: {
              alpha: true,
              preserveDrawingBuffer: true,
            },
          },
        });

        viewerRef.current = viewer;
        viewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
        viewer.scene.globe.enableLighting = false;
        viewer.scene.globe.showGroundAtmosphere = false;
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#062438");
        viewer.scene.globe.depthTestAgainstTerrain = false;

        const ssc = viewer.scene.screenSpaceCameraController;
        ssc.enableRotate = true;
        ssc.enableZoom = true;
        ssc.enableTilt = false;
        ssc.enableTranslate = false;
        ssc.minimumZoomDistance = 350000.0;
        ssc.maximumZoomDistance = 14000000.0;

        // Set initial camera view centered on the ARGO float ocean basin (Western Tropical Pacific / Indian Ocean)
        const initialLon = 135.0;
        const initialLat = 7.5;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(initialLon, initialLat, 5500000.0),
          orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-90.0),
            roll: 0.0,
          },
        });

        const resizeSubGlobe = () => {
          if (!viewerRef.current || viewerRef.current.isDestroyed() || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          if (w <= 0 || h <= 0) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const widgetAny = (viewerRef.current as any).cesiumWidget || (viewerRef.current as any)._cesiumWidget;
          if (widgetAny) widgetAny._forceResize = true;
          viewerRef.current.resize();
          if (viewerRef.current.scene?.camera?.frustum && "aspectRatio" in viewerRef.current.scene.camera.frustum) {
            viewerRef.current.scene.camera.frustum.aspectRatio = w / h;
          }
          viewerRef.current.scene.requestRender();
        };

        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          const resizeObserver = new ResizeObserver(() => {
            resizeSubGlobe();
          });
          resizeObserver.observe(containerRef.current);
          if (containerRef.current.parentElement) {
            resizeObserver.observe(containerRef.current.parentElement);
          }
          cleanups.push(() => resizeObserver.disconnect());
        }

        window.addEventListener("resize", resizeSubGlobe);
        cleanups.push(() => window.removeEventListener("resize", resizeSubGlobe));

        setIsLoading(false);
      } catch (err) {
        console.error("[FourDGlobeView] Failed to initialize Cesium:", err);
      }
    }

    initCesium();

    return () => {
      isMounted = false;
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {
          // Ignore cleanup error
        }
      });
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.destroy();
        } catch {
          // Ignore destruction error
        }
        viewerRef.current = null;
      }
    };
  }, []);

  // 5. Update 3D Trajectory & Observation Entities when data or active variable changes
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || viewer.isDestroyed() || !Cesium) return;

    // A. Render 3D ARGO Float Trajectory Polyline
    if (trajectory.length > 1) {
      if (trajectoryEntityRef.current) {
        viewer.entities.remove(trajectoryEntityRef.current);
      }

      const positions = trajectory.map((p) =>
        Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, 2000.0)
      );

      trajectoryEntityRef.current = viewer.entities.add({
        id: "argo-4d-trajectory",
        polyline: {
          positions,
          width: 2.2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            taperPower: 0.85,
            color: Cesium.Color.fromCssColorString("#00d2ff").withAlpha(0.75),
          }),
        },
      });
    }

    // B. Render Active Cycle 3D Beacon and Ocean Depth Column
    if (activeCycle) {
      if (activeBeaconEntityRef.current) {
        viewer.entities.remove(activeBeaconEntityRef.current);
      }

      const surfacePos = Cesium.Cartesian3.fromDegrees(
        activeCycle.longitude,
        activeCycle.latitude,
        15000.0
      );

      // Active float beacon pin with radar ring
      activeBeaconEntityRef.current = viewer.entities.add({
        id: "argo-4d-active-float",
        position: surfacePos,
        point: {
          pixelSize: 9.0,
          color: Cesium.Color.fromCssColorString("#00d2ff"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2.0,
        },
        ellipse: {
          semiMajorAxis: 45000.0,
          semiMinorAxis: 45000.0,
          height: 500.0,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString("#00d2ff").withAlpha(0.2)
          ),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString("#00d2ff").withAlpha(0.8),
          outlineWidth: 1.5,
        },
      });

      // Clear previous depth column entities
      depthColumnEntitiesRef.current.forEach((e) => {
        try {
          viewer.entities.remove(e);
        } catch {
          // Ignore removal error
        }
      });
      depthColumnEntitiesRef.current = [];

      // C. Render 3D Subsurface Ocean Depth Column (0m to 2000m)
      // Visual depth magnification factor so vertical ocean strata are clearly readable in 3D
      const DEPTH_VISUAL_SCALE = 350.0;

      // 3D Depth Central Guide Beam
      const depthBeam = viewer.entities.add({
        id: "depth-guide-beam",
        polyline: {
          positions: [
            Cesium.Cartesian3.fromDegrees(activeCycle.longitude, activeCycle.latitude, 0.0),
            Cesium.Cartesian3.fromDegrees(
              activeCycle.longitude,
              activeCycle.latitude,
              2000.0 * DEPTH_VISUAL_SCALE
            ),
          ],
          width: 2.0,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString("#64748b").withAlpha(0.6),
            dashLength: 12.0,
          }),
        },
      });
      depthColumnEntitiesRef.current.push(depthBeam);

      // Depth Level Strata Ticks: 0m, 200m (Thermocline), 500m, 1000m, 2000m
      const strataDepths = [0, 200, 500, 1000, 2000];
      strataDepths.forEach((d) => {
        const strataTick = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(
            activeCycle.longitude,
            activeCycle.latitude,
            d * DEPTH_VISUAL_SCALE
          ),
          ellipse: {
            semiMajorAxis: 22000.0,
            semiMinorAxis: 22000.0,
            height: d * DEPTH_VISUAL_SCALE,
            material: new Cesium.ColorMaterialProperty(
              Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.08)
            ),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.35),
            outlineWidth: 1.0,
          },
        });
        depthColumnEntitiesRef.current.push(strataTick);
      });

      // Sample ~25 representative depth levels from real profile data
      if (activeProfileData && activeProfileData.length > 0) {
        const step = Math.max(1, Math.floor(activeProfileData.length / 25));
        for (let i = 0; i < activeProfileData.length; i += step) {
          const pt = activeProfileData[i];
          const val =
            parameter === "Salinity (PSU)"
              ? pt.salinity
              : parameter === "Pressure (dbar)"
              ? pt.depth
              : pt.temperature;

          const colorHex = getVariableColor(parameter, val);
          const ptEntity = viewer.entities.add({
            id: `depth-point-${i}`,
            position: Cesium.Cartesian3.fromDegrees(
              activeCycle.longitude,
              activeCycle.latitude,
              pt.depth * DEPTH_VISUAL_SCALE
            ),
            point: {
              pixelSize: 6.0,
              color: Cesium.Color.fromCssColorString(colorHex),
              outlineColor: Cesium.Color.WHITE.withAlpha(0.85),
              outlineWidth: 1.0,
            },
          });
          depthColumnEntitiesRef.current.push(ptEntity);
        }
      }

      // D. Interactive 3D Depth Slice Ring at selectedDepth
      if (depthSliceEntityRef.current) {
        viewer.entities.remove(depthSliceEntityRef.current);
      }

      const activeDepthAlt = selectedDepth * DEPTH_VISUAL_SCALE;

      // Find closest measurement for selectedDepth
      let closestMeasurement: DepthMeasurement | null = null;
      if (activeProfileData && activeProfileData.length > 0) {
        closestMeasurement = activeProfileData.reduce((prev, curr) =>
          Math.abs(curr.depth - selectedDepth) < Math.abs(prev.depth - selectedDepth) ? curr : prev
        );
      }

      const activeVal = closestMeasurement
        ? parameter === "Salinity (PSU)"
          ? closestMeasurement.salinity
          : parameter === "Pressure (dbar)"
          ? closestMeasurement.depth
          : closestMeasurement.temperature
        : selectedDepth;

      const activeColorHex = getVariableColor(parameter, activeVal);

      depthSliceEntityRef.current = viewer.entities.add({
        id: "active-depth-slice",
        position: Cesium.Cartesian3.fromDegrees(
          activeCycle.longitude,
          activeCycle.latitude,
          activeDepthAlt
        ),
        ellipse: {
          semiMajorAxis: 38000.0,
          semiMinorAxis: 38000.0,
          height: activeDepthAlt,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString(activeColorHex).withAlpha(0.35)
          ),
          outline: true,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.95),
          outlineWidth: 2.0,
        },
        point: {
          pixelSize: 10.0,
          color: Cesium.Color.fromCssColorString(activeColorHex),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2.5,
        },
      });
    }
  }, [trajectory, activeCycle, activeProfileData, selectedDepth, parameter]);

  // Re-center camera on the active float cycle
  const handleFocusFloat = useCallback(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || !activeCycle) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        activeCycle.longitude,
        activeCycle.latitude,
        3800000.0
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-75.0),
        roll: 0.0,
      },
      duration: 1.2,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
    });
  }, [activeCycle]);

  // Zoom in helper
  const handleZoomIn = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.35);
  };

  // Zoom out helper
  const handleZoomOut = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.35);
  };

  const config = VARIABLE_CONFIG[parameter];

  // Current measured value at selectedDepth
  let measuredValueAtDepth = 0;
  if (activeProfileData && activeProfileData.length > 0) {
    const pt = activeProfileData.reduce((prev, curr) =>
      Math.abs(curr.depth - selectedDepth) < Math.abs(prev.depth - selectedDepth) ? curr : prev
    );
    measuredValueAtDepth =
      parameter === "Salinity (PSU)"
        ? pt.salinity
        : parameter === "Pressure (dbar)"
        ? pt.depth
        : pt.temperature;
  }

  return (
    <div className="relative w-full rounded-xl border border-[#1a2f4c] bg-[#020814] overflow-hidden">
      {/* 3D Earth Globe Viewport */}
      <div
        ref={containerRef}
        className="relative w-full h-[290px] cursor-grab active:cursor-grabbing select-none"
      />

      {/* Loading Experience */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030810]/90 backdrop-blur-sm z-20">
          <div className="relative flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00d2ff] opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-[#00d2ff]" />
          </div>
          <span className="mt-3 font-mono text-[10px] text-[#00d2ff] tracking-widest uppercase">
            INITIALIZING 3D OCEAN EARTH...
          </span>
        </div>
      )}

      {/* Top Controls Overlay */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-[#1a2f4c] bg-[#061224]/85 px-2.5 py-1 font-mono text-[9px] text-[#ececec] backdrop-blur-md shadow-md">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
          ARGO #5904300
        </span>
        <button
          type="button"
          onClick={handleFocusFloat}
          className="rounded-full border border-[#1a2f4c] bg-[#061224]/85 px-2.5 py-1 font-mono text-[9px] text-[#00d2ff] hover:bg-[#00d2ff] hover:text-[#020814] transition-colors backdrop-blur-md shadow-md cursor-pointer"
          title="Center 3D View on Float"
        >
          Target Float
        </button>
      </div>

      {/* Zoom In/Out Floating Pill Buttons */}
      <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={handleZoomIn}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#1a2f4c] bg-[#061224]/90 font-mono text-xs font-bold text-[#ececec] hover:border-[#00d2ff] hover:text-[#00d2ff] transition-all cursor-pointer shadow-md"
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#1a2f4c] bg-[#061224]/90 font-mono text-xs font-bold text-[#ececec] hover:border-[#00d2ff] hover:text-[#00d2ff] transition-all cursor-pointer shadow-md"
          title="Zoom Out"
        >
          −
        </button>
      </div>

      {/* Active Variable Real-time Depth HUD Banner */}
      <div className="absolute top-2.5 right-2.5 z-10 flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 rounded-lg border border-[#1a2f4c] bg-[#061224]/90 px-2.5 py-1 font-mono text-[10px] text-[#ececec] backdrop-blur-md shadow-lg">
          <span className="text-[#6b8aad]">{config.name} @ {selectedDepth}m:</span>
          <span className="font-bold text-[#00d2ff]">
            {measuredValueAtDepth.toFixed(2)} {config.unit}
          </span>
        </div>
      </div>

      {/* Dynamic Scientific Colorbar Legend (Bottom Right) */}
      <div className="absolute bottom-2.5 right-2.5 z-10 flex flex-col gap-1 rounded-lg border border-[#1a2f4c] bg-[#061224]/90 p-2 px-2.5 font-mono text-[8px] text-[#ececec] backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between gap-2 font-semibold text-[#8ea9c7]">
          <span>{parameter.split(" ")[0]}</span>
          <span>{config.unit}</span>
        </div>
        <div
          className="h-2 w-32 rounded-full border border-white/10"
          style={{
            background:
              parameter === "Salinity (PSU)"
                ? "linear-gradient(to right, #06b6d4, #0ea5e9, #8b5cf6, #c084fc)"
                : parameter === "Pressure (dbar)"
                ? "linear-gradient(to right, #00d2ff, #0284c7, #1e3a8a, #030712)"
                : "linear-gradient(to right, #0f32b4, #14b8a6, #22c55e, #f59e0b, #ef4444)",
          }}
        />
        <div className="flex items-center justify-between text-[7px] text-[#6b8aad]">
          <span>{config.min} {config.unit}</span>
          <span>{config.max} {config.unit}</span>
        </div>
      </div>
    </div>
  );
}
