"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  getVariableColorRgb,
  VARIABLE_CONFIG,
  type OceanVariable,
} from "@/lib/globe/fourDColorScales";

interface TrajectoryCycle {
  profile_index: number;
  latitude: number;
  longitude: number;
  time: string;
  max_depth: number;
  point_count: number;
}

interface CTDPoint {
  depth: number;
  temperature: number;
  salinity: number;
}

interface FourDOceanWebGLViewProps {
  selectedYear: number;
  selectedMonth: number;
  selectedDepth: number;
  parameter: OceanVariable | string;
  region: string;
}

const BOX_WIDTH = 160;  // Longitude extent (X)
const BOX_LENGTH = 120; // Latitude extent (Z)
const BOX_HEIGHT = 90;  // Depth extent 0..2000m (Y, pointing down: 0 to -BOX_HEIGHT)
const MAX_DEPTH = 2000.0;

/**
 * Generate soft circular glow sprite for WebGL points
 */
function createPointTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.4)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function FourDOceanWebGLView({
  selectedYear,
  selectedMonth,
  selectedDepth,
  parameter,
  region,
}: FourDOceanWebGLViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Active variable normalized
  const activeVar: OceanVariable =
    parameter === "Salinity (PSU)"
      ? "Salinity (PSU)"
      : parameter === "Pressure (dbar)"
      ? "Pressure (dbar)"
      : "Temperature (°C)";

  const varConfig = VARIABLE_CONFIG[activeVar];

  // State for backend data
  const [trajectory, setTrajectory] = useState<TrajectoryCycle[]>([]);
  const [activeProfile, setActiveProfile] = useState<CTDPoint[]>([]);

  // 2. Select closest cycle for selectedYear & selectedMonth derived cleanly via useMemo
  const activeCycle = useMemo(() => {
    if (trajectory.length === 0) return null;
    const targetDate = new Date(selectedYear, selectedMonth - 1, 15).getTime();

    let closest = trajectory[0];
    let minDiff = Math.abs(new Date(closest.time).getTime() - targetDate);

    for (let i = 1; i < trajectory.length; i++) {
      const diff = Math.abs(new Date(trajectory[i].time).getTime() - targetDate);
      if (diff < minDiff) {
        minDiff = diff;
        closest = trajectory[i];
      }
    }
    return closest;
  }, [trajectory, selectedYear, selectedMonth]);

  // Hover state
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    depth: number;
    val: number;
    lat: number;
    lon: number;
    time: string;
  } | null>(null);

  // Refs for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsMeshRef = useRef<THREE.Points | null>(null);
  const depthSliceRef = useRef<THREE.Group | null>(null);
  const beaconRef = useRef<THREE.Group | null>(null);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);

  // 1. Fetch real float trajectory
  useEffect(() => {
    let isMounted = true;
    async function loadTrajectory() {
      try {
        const res = await fetch("/api/4d?type=trajectory");
        if (!res.ok) return;
        const data = await res.json();
        const rawPoints: TrajectoryCycle[] = Array.isArray(data.trajectory)
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
        console.warn("[4D WebGL] Trajectory fetch fallback:", err);
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
          setActiveProfile(data.data);
        }
      } catch (err) {
        console.warn("[4D WebGL] Profile fetch fallback:", err);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [activeCycle]);

  // Compute bounding geographic coordinates of trajectory for accurate 3D normalization
  const geoBounds = useMemo(() => {
    if (trajectory.length === 0) {
      return { minLon: 141.0, maxLon: 146.0, minLat: 7.0, maxLat: 15.0 };
    }
    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    for (const c of trajectory) {
      if (c.longitude < minLon) minLon = c.longitude;
      if (c.longitude > maxLon) maxLon = c.longitude;
      if (c.latitude < minLat) minLat = c.latitude;
      if (c.latitude > maxLat) maxLat = c.latitude;
    }
    // Padding
    const lonPad = Math.max(0.5, (maxLon - minLon) * 0.15);
    const latPad = Math.max(0.5, (maxLat - minLat) * 0.15);
    return {
      minLon: minLon - lonPad,
      maxLon: maxLon + lonPad,
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
    };
  }, [trajectory]);

  // Convert (lon, lat, depth) to 3D Three.js coordinates
  const to3DCoord = useCallback(
    (lon: number, lat: number, depth: number): [number, number, number] => {
      const { minLon, maxLon, minLat, maxLat } = geoBounds;
      const lonRange = maxLon - minLon || 1;
      const latRange = maxLat - minLat || 1;

      // X: West -> East (-BOX_WIDTH/2 to +BOX_WIDTH/2)
      const x = ((lon - minLon) / lonRange - 0.5) * BOX_WIDTH;
      // Z: South -> North (+BOX_LENGTH/2 to -BOX_LENGTH/2)
      const z = -(((lat - minLat) / latRange - 0.5) * BOX_LENGTH);
      // Y: Depth downward (0 at surface, -BOX_HEIGHT at 2000m)
      const clampedDepth = Math.max(0, Math.min(MAX_DEPTH, depth));
      const y = -(clampedDepth / MAX_DEPTH) * BOX_HEIGHT;

      return [x, y, z];
    },
    [geoBounds]
  );

  // Extract current measurement value at selectedDepth derived via useMemo
  const activeValAtDepth = useMemo(() => {
    if (activeProfile.length === 0) {
      if (activeVar === "Pressure (dbar)") {
        return Math.round(selectedDepth * 1.01);
      }
      return null;
    }

    if (activeVar === "Pressure (dbar)") {
      return Math.round(selectedDepth * 1.01);
    }

    // Find nearest depth point in CTD profile
    let nearest = activeProfile[0];
    let minDiff = Math.abs(nearest.depth - selectedDepth);
    for (let i = 1; i < activeProfile.length; i++) {
      const diff = Math.abs(activeProfile[i].depth - selectedDepth);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = activeProfile[i];
      }
    }

    return activeVar === "Salinity (PSU)" ? nearest.salinity : nearest.temperature;
  }, [activeProfile, selectedDepth, activeVar]);

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 580;
    const height = container.clientHeight || 380;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020713);
    scene.fog = new THREE.FogExp2(0x020713, 0.0018);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1200);
    camera.position.set(130, 85, 150);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 40;
    controls.maxDistance = 550;
    controls.target.set(0, -BOX_HEIGHT / 2, 0);
    controls.maxPolarAngle = Math.PI - 0.05; // allow looking from below depth
    controlsRef.current = controls;

    // 5. Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xd0e8ff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00d2ff, 1.2);
    dirLight.position.set(60, 100, 80);
    scene.add(dirLight);

    // 6. Ocean Volume Bounding Cuboid & Strata Grid
    const volumeGroup = new THREE.Group();

    // Semi-transparent surface water plane
    const surfaceGeo = new THREE.PlaneGeometry(BOX_WIDTH, BOX_LENGTH);
    const surfaceMat = new THREE.MeshBasicMaterial({
      color: 0x003355,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.rotation.x = -Math.PI / 2;
    surfaceMesh.position.y = 0;
    volumeGroup.add(surfaceMesh);

    // Surface grid lines
    const gridHelper = new THREE.GridHelper(
      Math.max(BOX_WIDTH, BOX_LENGTH),
      16,
      0x00d2ff,
      0x132a48
    );
    gridHelper.position.y = 0.1;
    volumeGroup.add(gridHelper);

    // Bounding wireframe volume
    const boxGeo = new THREE.BoxGeometry(BOX_WIDTH, BOX_HEIGHT, BOX_LENGTH);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0x1a3f6c,
      transparent: true,
      opacity: 0.6,
    });
    const boxEdges = new THREE.LineSegments(edgesGeo, edgesMat);
    boxEdges.position.y = -BOX_HEIGHT / 2;
    volumeGroup.add(boxEdges);

    // Depth Strata Reference Lines (200m, 500m, 1000m, 1500m, 2000m)
    const strataDepths = [200, 500, 1000, 1500, 2000];
    const strataColors = [0x00aaff, 0x0088cc, 0x005599, 0x003366, 0x001f44];

    strataDepths.forEach((d, idx) => {
      const strataY = -(d / MAX_DEPTH) * BOX_HEIGHT;
      const lineGeo = new THREE.BufferGeometry();
      const hw = BOX_WIDTH / 2;
      const hl = BOX_LENGTH / 2;
      const pts = [
        new THREE.Vector3(-hw, strataY, -hl),
        new THREE.Vector3(hw, strataY, -hl),
        new THREE.Vector3(hw, strataY, hl),
        new THREE.Vector3(-hw, strataY, hl),
        new THREE.Vector3(-hw, strataY, -hl),
      ];
      lineGeo.setFromPoints(pts);
      const lineMat = new THREE.LineDashedMaterial({
        color: strataColors[idx],
        dashSize: 4,
        gapSize: 3,
        transparent: true,
        opacity: 0.45,
      });
      const strataLine = new THREE.Line(lineGeo, lineMat);
      strataLine.computeLineDistances();
      volumeGroup.add(strataLine);
    });

    scene.add(volumeGroup);

    // 7. Interactive 3D Depth Slice Plane Group
    const depthSliceGroup = new THREE.Group();
    const slicePlaneGeo = new THREE.PlaneGeometry(BOX_WIDTH, BOX_LENGTH);
    const slicePlaneMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    });
    const slicePlaneMesh = new THREE.Mesh(slicePlaneGeo, slicePlaneMat);
    slicePlaneMesh.rotation.x = -Math.PI / 2;
    depthSliceGroup.add(slicePlaneMesh);

    // Perimeter edge line for depth slice
    const sliceEdgeGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(BOX_WIDTH, BOX_LENGTH));
    const sliceEdgeMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.75,
      linewidth: 2,
    });
    const sliceEdge = new THREE.LineSegments(sliceEdgeGeo, sliceEdgeMat);
    sliceEdge.rotation.x = -Math.PI / 2;
    depthSliceGroup.add(sliceEdge);

    scene.add(depthSliceGroup);
    depthSliceRef.current = depthSliceGroup;

    // 8. Active Station Beacon Group (surface ping & vertical laser sounder)
    const beaconGroup = new THREE.Group();

    // Pulse ring at surface
    const ringGeo = new THREE.RingGeometry(1.5, 3.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.5;
    beaconGroup.add(ringMesh);

    // Float marker diamond
    const diamondGeo = new THREE.OctahedronGeometry(2.2);
    const diamondMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x0088cc,
      roughness: 0.2,
      metalness: 0.8,
    });
    const diamondMesh = new THREE.Mesh(diamondGeo, diamondMat);
    diamondMesh.position.y = 2.5;
    beaconGroup.add(diamondMesh);

    // Vertical depth sounder beam line
    const sounderGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -BOX_HEIGHT, 0),
    ]);
    const sounderMat = new THREE.LineBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.65,
    });
    const sounderLine = new THREE.Line(sounderGeo, sounderMat);
    beaconGroup.add(sounderLine);

    scene.add(beaconGroup);
    beaconRef.current = beaconGroup;

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && rendererRef.current && cameraRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // 10. Animation Loop
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Controls update with damping
      controls.update();

      // Diamond float rotation and beacon pulse
      if (diamondMesh) {
        diamondMesh.rotation.y = elapsedTime * 1.5;
      }
      if (ringMesh) {
        const scale = 1.0 + 0.35 * Math.sin(elapsedTime * 4.0);
        ringMesh.scale.set(scale, scale, scale);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Depth Slice Plane position when selectedDepth changes
  useEffect(() => {
    if (!depthSliceRef.current) return;
    const targetY = -(selectedDepth / MAX_DEPTH) * BOX_HEIGHT;
    depthSliceRef.current.position.y = targetY;
  }, [selectedDepth]);

  // Update Float Trajectory 3D Track
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || trajectory.length === 0) return;

    if (trajectoryLineRef.current) {
      scene.remove(trajectoryLineRef.current);
      trajectoryLineRef.current.geometry.dispose();
      (trajectoryLineRef.current.material as THREE.Material).dispose();
      trajectoryLineRef.current = null;
    }

    // Filter trajectory points up to selected activeCycle timestamp
    const activeTime = activeCycle ? new Date(activeCycle.time).getTime() : Infinity;
    const pastCycles = trajectory.filter(
      (c) => new Date(c.time).getTime() <= activeTime
    );

    if (pastCycles.length < 2) return;

    const points: THREE.Vector3[] = pastCycles.map((c) => {
      const [x, , z] = to3DCoord(c.longitude, c.latitude, 0);
      return new THREE.Vector3(x, 0.4, z);
    });

    const pathGeo = new THREE.BufferGeometry().setFromPoints(points);
    const pathMat = new THREE.LineBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
    });
    const line = new THREE.Line(pathGeo, pathMat);
    scene.add(line);
    trajectoryLineRef.current = line;
  }, [trajectory, activeCycle, to3DCoord]);

  // Update Active Station Beacon position
  useEffect(() => {
    if (!beaconRef.current || !activeCycle) return;
    const [x, , z] = to3DCoord(activeCycle.longitude, activeCycle.latitude, 0);
    beaconRef.current.position.set(x, 0, z);
  }, [activeCycle, to3DCoord]);

  // Re-build or Update WebGL 3D Observation Points (Space X Y Z x Active Variable)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || trajectory.length === 0) return;

    // Remove existing points mesh
    if (pointsMeshRef.current) {
      scene.remove(pointsMeshRef.current);
      pointsMeshRef.current.geometry.dispose();
      (pointsMeshRef.current.material as THREE.Material).dispose();
      pointsMeshRef.current = null;
    }

    const positions: number[] = [];
    const colors: number[] = [];

    // 1. Build background spatial field across historical float cycles
    const activeTime = activeCycle ? new Date(activeCycle.time).getTime() : Infinity;
    const displayCycles = trajectory.filter(
      (c) => new Date(c.time).getTime() <= activeTime
    );

    // Standard depth steps for volumetric observation columns
    const bgDepthSteps = [
      0, 25, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1250, 1500, 1750, 2000,
    ];

    displayCycles.forEach((cycle) => {
      // Approximate background physical values based on depth profile decay
      bgDepthSteps.forEach((d) => {
        if (d > cycle.max_depth) return;
        const [x, y, z] = to3DCoord(cycle.longitude, cycle.latitude, d);
        positions.push(x, y, z);

        // Estimate variable value for historical station
        let val = 0;
        if (activeVar === "Temperature (°C)") {
          // Ocean thermocline temperature curve: 28°C surface down to 2.3°C abyss
          val = 2.2 + 26.5 * Math.exp(-d / 320);
        } else if (activeVar === "Salinity (PSU)") {
          // Halocline salinity: 33.9 surface up to 34.6 intermediate and abyss
          val = 33.8 + 0.85 * (1 - Math.exp(-d / 280));
        } else {
          // Pressure
          val = d * 1.01;
        }

        const [r, g, b] = getVariableColorRgb(activeVar, val);
        // Dim historical points slightly so active cycle stands out
        const isSelectedCycle = activeCycle && cycle.profile_index === activeCycle.profile_index;
        const dimFactor = isSelectedCycle ? 1.0 : 0.65;
        colors.push(r * dimFactor, g * dimFactor, b * dimFactor);
      });
    });

    // 2. High-density REAL vertical CTD soundings for active cycle
    if (activeCycle && activeProfile.length > 0) {
      activeProfile.forEach((ctd) => {
        const [x, y, z] = to3DCoord(activeCycle.longitude, activeCycle.latitude, ctd.depth);
        positions.push(x, y, z);

        let val = 0;
        if (activeVar === "Salinity (PSU)") {
          val = ctd.salinity;
        } else if (activeVar === "Pressure (dbar)") {
          val = ctd.depth * 1.01;
        } else {
          val = ctd.temperature;
        }

        const [r, g, b] = getVariableColorRgb(activeVar, val);
        colors.push(r, g, b);
      });
    }

    if (positions.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const pointTexture = createPointTexture();
    const material = new THREE.PointsMaterial({
      size: 4.8,
      vertexColors: true,
      map: pointTexture,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const pointsMesh = new THREE.Points(geometry, material);
    scene.add(pointsMesh);
    pointsMeshRef.current = pointsMesh;
  }, [trajectory, activeCycle, activeProfile, activeVar, to3DCoord]);

  // Raycaster hover interaction for inspecting individual ARGO observation points
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !activeCycle) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Check depth slice intersection or station coordinate
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    if (depthSliceRef.current) {
      const targetY = -(selectedDepth / MAX_DEPTH) * BOX_HEIGHT;
      const slicePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -targetY);
      const hitPoint = new THREE.Vector3();

      if (raycaster.ray.intersectPlane(slicePlane, hitPoint)) {
        if (
          Math.abs(hitPoint.x) <= BOX_WIDTH / 2 &&
          Math.abs(hitPoint.z) <= BOX_LENGTH / 2
        ) {
          // Reconstruct approximate lon, lat from 3D coords
          const { minLon, maxLon, minLat, maxLat } = geoBounds;
          const hitLon = ((hitPoint.x / BOX_WIDTH) + 0.5) * (maxLon - minLon) + minLon;
          const hitLat = -((hitPoint.z / BOX_LENGTH) + 0.5) * (maxLat - minLat) + minLat;

          const clampedX = Math.min(e.clientX - rect.left + 12, rect.width - 180);
          setHoveredPoint({
            x: Math.max(10, clampedX),
            y: e.clientY - rect.top,
            depth: selectedDepth,
            val: activeValAtDepth ?? (activeVar === "Pressure (dbar)" ? selectedDepth : 0),
            lat: hitLat,
            lon: hitLon,
            time: activeCycle.time.split("T")[0],
          });
          return;
        }
      }
    }
    setHoveredPoint(null);
  };

  // Camera preset view handlers
  const setCameraPreset = (preset: "iso" | "top" | "side" | "closeup") => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (preset === "iso") {
      camera.position.set(130, 85, 150);
      controls.target.set(0, -BOX_HEIGHT / 2, 0);
    } else if (preset === "top") {
      camera.position.set(0, 190, 0.01);
      controls.target.set(0, 0, 0);
    } else if (preset === "side") {
      camera.position.set(0, -BOX_HEIGHT / 2, 220);
      controls.target.set(0, -BOX_HEIGHT / 2, 0);
    } else if (preset === "closeup") {
      if (activeCycle) {
        const [ax, , az] = to3DCoord(activeCycle.longitude, activeCycle.latitude, 0);
        const ay = -(selectedDepth / MAX_DEPTH) * BOX_HEIGHT;
        camera.position.set(ax + 35, ay + 20, az + 45);
        controls.target.set(ax, ay, az);
      }
    }
    controls.update();
  };

  // Ocean depth strata classification
  const strataLabel = useMemo(() => {
    if (selectedDepth <= 200) return "Epipelagic • Sunlit Surface Layer";
    if (selectedDepth <= 500) return "Mesopelagic • Thermocline Zone";
    if (selectedDepth <= 1000) return "Intermediate Water Masses";
    if (selectedDepth <= 1500) return "Bathypelagic • Deep Ocean";
    return "Abyssal Plain • Ocean Abyss";
  }, [selectedDepth]);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-[360px] sm:h-[400px] lg:h-[420px] rounded-xl border border-[#1a2f4c] bg-[#020713] overflow-hidden select-none cursor-grab active:cursor-grabbing"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoveredPoint(null)}
    >
      {/* ====== HUD OVERLAY 1: TOP-LEFT 4D TELEMETRY ====== */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 pointer-events-none">
        <div className="flex items-center gap-2 bg-[#051124]/90 border border-[#1a2f4c] rounded-md px-2.5 py-1 backdrop-blur-md shadow-lg">
          <span className="w-2 h-2 rounded-full bg-[#00d2ff] animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-[#00d2ff] tracking-wider uppercase">
            4D Spatio-Temporal WebGL Model
          </span>
        </div>

        <div className="bg-[#051124]/85 border border-[#1a2f4c]/80 rounded-md px-2.5 py-1.5 backdrop-blur-md text-[10px] font-mono text-[#a5c3e5] space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[#6b8aad]">Region:</span>
            <span className="text-[#ececec] font-bold">{region}</span>
            <span className="text-[#4a6a8a]">•</span>
            <span className="text-[#6b8aad]">ARGO:</span>
            <span className="text-[#00d2ff]">#5904300</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#6b8aad]">X, Y, Z:</span>
            <span className="text-[#ececec]">
              {activeCycle
                ? `${activeCycle.longitude.toFixed(2)}°E, ${activeCycle.latitude.toFixed(2)}°N, ${selectedDepth}m`
                : `—`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#6b8aad]">Active {varConfig.name}:</span>
            <span className="text-[#00ffff] font-bold">
              {activeValAtDepth !== null ? `${activeValAtDepth} ${varConfig.unit}` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* ====== HUD OVERLAY 2: TOP-RIGHT VIEW CONTROLS ====== */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-[#051124]/90 border border-[#1a2f4c] rounded-md p-1 backdrop-blur-md shadow-lg">
        <button
          type="button"
          onClick={() => setCameraPreset("iso")}
          className="px-2 py-1 rounded text-[9px] font-mono text-[#6b8aad] hover:text-[#00d2ff] hover:bg-[#0a1b36] transition-colors cursor-pointer"
          title="Isometric 3D perspective"
        >
          3D ISO
        </button>
        <button
          type="button"
          onClick={() => setCameraPreset("top")}
          className="px-2 py-1 rounded text-[9px] font-mono text-[#6b8aad] hover:text-[#00d2ff] hover:bg-[#0a1b36] transition-colors cursor-pointer"
          title="Top-down spatial view (Lon x Lat)"
        >
          TOP
        </button>
        <button
          type="button"
          onClick={() => setCameraPreset("side")}
          className="px-2 py-1 rounded text-[9px] font-mono text-[#6b8aad] hover:text-[#00d2ff] hover:bg-[#0a1b36] transition-colors cursor-pointer"
          title="Side view (Depth structure)"
        >
          SIDE
        </button>
        <button
          type="button"
          onClick={() => setCameraPreset("closeup")}
          className="px-2 py-1 rounded text-[9px] font-mono text-[#6b8aad] hover:text-[#00d2ff] hover:bg-[#0a1b36] transition-colors cursor-pointer"
          title="Focus camera on active CTD profile sounding"
        >
          CLOSE-UP
        </button>
      </div>

      {/* ====== HUD OVERLAY 3: BOTTOM-LEFT STRATA INDICATOR ====== */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none flex flex-col gap-1">
        <div className="bg-[#051124]/80 border border-[#1a2f4c]/80 rounded-md px-2.5 py-1 backdrop-blur-md text-[9px] font-mono text-[#6b8aad]">
          <span className="text-[#a5c3e5] font-bold">{strataLabel}</span>
          <span className="text-[#4a6a8a] ml-1.5">({selectedDepth}m)</span>
        </div>
      </div>

      {/* ====== HUD OVERLAY 4: BOTTOM-RIGHT DYNAMIC COLORMAP LEGEND ====== */}
      <div className="absolute bottom-3 right-3 z-10 bg-[#051124]/90 border border-[#1a2f4c] rounded-md px-3 py-2 backdrop-blur-md shadow-xl flex flex-col gap-1 pointer-events-none">
        <div className="flex items-center justify-between gap-3 text-[9px] font-mono text-[#6b8aad]">
          <span>{varConfig.name}</span>
          <span className="text-[#00d2ff] font-bold">{varConfig.unit}</span>
        </div>

        {/* Dynamic Continuous Colormap Bar */}
        <div
          className="w-40 h-2.5 rounded-sm border border-[#1a2f4c]"
          style={{
            background:
              activeVar === "Temperature (°C)"
                ? "linear-gradient(to right, rgb(15, 50, 180), rgb(25, 190, 255), rgb(45, 225, 105), rgb(245, 215, 10), rgb(255, 50, 50))"
                : activeVar === "Salinity (PSU)"
                ? "linear-gradient(to right, rgb(6, 182, 212), rgb(14, 202, 252), rgb(134, 122, 222), rgb(219, 62, 242))"
                : "linear-gradient(to right, rgb(0, 210, 255), rgb(45, 130, 222), rgb(90, 50, 190))",
          }}
        />

        <div className="flex justify-between text-[8px] font-mono text-[#6b8aad]">
          <span>{varConfig.min} {varConfig.unit}</span>
          <span>{((varConfig.min + varConfig.max) / 2).toFixed(1)}</span>
          <span>{varConfig.max} {varConfig.unit}</span>
        </div>
      </div>

      {/* ====== HOVER TOOLTIP ====== */}
      {hoveredPoint && (
        <div
          className="absolute pointer-events-none z-20 bg-[#051124]/95 border border-[#00d2ff]/60 rounded-lg px-3 py-2 text-[10px] font-mono text-[#ececec] shadow-[0_0_15px_rgba(0,210,255,0.25)] backdrop-blur-md transition-transform duration-75"
          style={{
            left: hoveredPoint.x,
            top: Math.max(10, hoveredPoint.y - 70),
          }}
        >
          <div className="flex items-center gap-1.5 text-[#00d2ff] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff]" />
            ARGO CTD Sounding ({hoveredPoint.time})
          </div>
          <div className="text-[#a5c3e5]">
            Pos: {hoveredPoint.lon.toFixed(2)}°E, {hoveredPoint.lat.toFixed(2)}°N
          </div>
          <div className="text-[#a5c3e5]">
            Depth: <span className="text-[#ececec] font-bold">{hoveredPoint.depth}m</span>
          </div>
          <div>
            {varConfig.name}:{" "}
            <span className="text-[#00ffff] font-bold">
              {hoveredPoint.val} {varConfig.unit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
