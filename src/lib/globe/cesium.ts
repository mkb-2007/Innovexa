if (typeof window !== "undefined") {
  (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium/";
}

/**
 * Identify broad ocean basin / sea from lat/lon coordinates
 */
export function getApproximateOceanRegion(lat: number, lon: number): string {
  // Normalize lon to -180..180
  let normLon = lon;
  while (normLon > 180) normLon -= 360;
  while (normLon < -180) normLon += 360;

  if (lat < -50) return "Southern Ocean";
  if (lat > 66) return "Arctic Ocean";

  // Red Sea
  if (lat >= 12 && lat <= 28 && normLon >= 32 && normLon <= 44) {
    return "Red Sea";
  }

  // Persian Gulf
  if (lat >= 23 && lat <= 30 && normLon >= 47 && normLon <= 57) {
    return "Persian Gulf";
  }

  // Mediterranean & Black Sea
  if (lat >= 30 && lat <= 46 && normLon >= -6 && normLon <= 42) {
    if (lat >= 40 && normLon >= 27 && normLon <= 42) {
      return "Black Sea";
    }
    return "Mediterranean Sea";
  }

  // Indian Ocean & marginal seas
  if (lat >= -50 && lat <= 30 && normLon >= 20 && normLon <= 100) {
    if (lat >= 5 && lat <= 23 && normLon >= 80 && normLon <= 100) {
      if (lat >= 6 && lat <= 15 && normLon >= 93 && normLon <= 99) {
        return "Andaman Sea";
      }
      return "Bay of Bengal";
    }
    if (lat >= 8 && lat <= 26 && normLon >= 50 && normLon <= 78) {
      return "Arabian Sea";
    }
    return "Indian Ocean";
  }

  // Caribbean Sea & Gulf of Mexico
  if (lat >= 9 && lat <= 31 && normLon >= -98 && normLon <= -60) {
    if (lat >= 18 && normLon <= -80) {
      return "Gulf of Mexico";
    }
    return "Caribbean Sea";
  }

  // Atlantic
  if (normLon >= -75 && normLon <= 20) {
    if (lat >= 55 && lat <= 66 && normLon >= -15 && normLon <= 15) {
      return "Norwegian Sea";
    }
    return lat >= 0 ? "North Atlantic Ocean" : "South Atlantic Ocean";
  }

  // South China Sea & East Asian Marginal Seas
  if (lat >= -10 && lat <= 25 && normLon >= 100 && normLon <= 130) {
    if (lat >= 0 && lat <= 25 && normLon >= 105 && normLon <= 122) {
      return "South China Sea";
    }
    return "East Asian Marginal Seas";
  }

  // Coral & Tasman Seas
  if (lat >= -50 && lat <= -10 && normLon >= 142 && normLon <= 178) {
    if (lat <= -28) {
      return "Tasman Sea";
    }
    return "Coral Sea";
  }

  // Pacific
  if (normLon > 100 || normLon < -70) {
    if (lat >= 50 && (normLon >= 160 || normLon <= -155)) {
      return "Bering Sea";
    }
    return lat >= 0 ? "North Pacific Ocean" : "South Pacific Ocean";
  }

  return "Global Ocean";
}

/**
 * Format coordinates into standard navigation representation
 */
export function formatCoordinates(lat: number, lon: number): {
  latFormatted: string;
  lonFormatted: string;
} {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";

  return {
    latFormatted: `${Math.abs(lat).toFixed(2)}° ${latDir}`,
    lonFormatted: `${Math.abs(lon).toFixed(2)}° ${lonDir}`,
  };
}

import { FlyToOptions } from "@/types/globe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let globalViewerInstance: any = null;

/**
 * Registers the active Cesium Viewer instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setCesiumViewer(viewer: any): void {
  globalViewerInstance = viewer;
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).cesiumViewer = viewer;
  }
}

/**
 * Retrieves the currently active Cesium Viewer instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCesiumViewer(): any {
  if (globalViewerInstance && !globalViewerInstance.isDestroyed?.()) {
    return globalViewerInstance;
  }
  if (typeof window !== "undefined" && typeof (window as unknown as { cesiumViewer: unknown }).cesiumViewer !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winViewer = (window as any).cesiumViewer;
    if (winViewer && !winViewer.isDestroyed?.()) {
      return winViewer;
    }
  }
  return null;
}

export interface FocusGlobeOptions {
  altitude?: number;
  duration?: number;
  label?: string;
  floatId?: number;
  wmoId?: number;
  colorHex?: string;
}

type FocusLocationHandler = (
  latitude: number,
  longitude: number,
  options?: FocusGlobeOptions
) => void;

let globalFocusHandler: FocusLocationHandler | null = null;
let pendingGlobalFocus: { latitude: number; longitude: number; options?: FocusGlobeOptions } | null = null;

/**
 * Registers the active OceanGlobe focus location handler
 */
export function registerFocusLocationHandler(handler: FocusLocationHandler | null): void {
  globalFocusHandler = handler;
  if (handler && pendingGlobalFocus) {
    const pending = pendingGlobalFocus;
    pendingGlobalFocus = null;
    handler(pending.latitude, pending.longitude, pending.options);
  }
}

/**
 * Single universal geographic focus function conceptually required:
 * focusGlobeOnLocation(latitude, longitude, options)
 *
 * Mathematically guarantees that (latitude, longitude) reaches the EXACT optical
 * dead center of the visible 3D globe viewport with a visible target beacon marker.
 */
export function focusGlobeOnLocation(
  latitude: number,
  longitude: number,
  options?: FocusGlobeOptions
): void {
  console.log("[AUTO GEO FOCUS]", {
    name: options?.label || "Location",
    latitude,
    longitude,
  });

  if (globalFocusHandler) {
    globalFocusHandler(latitude, longitude, options);
    return;
  }

  // Queue pending geographic focus so it is never lost if requested before handler mounts
  pendingGlobalFocus = { latitude, longitude, options };

  // Fallback if OceanGlobe has not yet attached handler
  const viewer = getCesiumViewer();
  if (!viewer || viewer.isDestroyed?.()) {
    console.warn("[AUTO GEO FOCUS] Viewer uninitialized, queued pending focus request.");
    return;
  }

  let normLon = ((longitude + 180) % 360 + 360) % 360 - 180;
  if (normLon === -180 && longitude > 0) normLon = 180;
  const clampLat = Math.max(-89.999, Math.min(89.999, latitude));
  const altitude = options?.altitude ?? 3500000.0;
  const duration = options?.duration ?? 2.0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Cesium = typeof window !== "undefined" && (window as any).Cesium ? (window as any).Cesium : null;
  if (Cesium) {
    if (typeof viewer.camera.cancelFlight === "function") {
      viewer.camera.cancelFlight();
    }

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(normLon, clampLat, altitude),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-90.0), // Nadir: straight down along geodetic surface normal
        roll: 0.0,
      },
      duration,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
    });
  }
}

/**
 * Backward compatibility wrapper for flyCameraToCoordinates routing into focusGlobeOnLocation
 */
export function flyCameraToCoordinates(
  coordinates: [number, number] | { longitude: number; latitude: number },
  options?: FlyToOptions
): void {
  const lon = Array.isArray(coordinates) ? coordinates[0] : coordinates.longitude;
  const lat = Array.isArray(coordinates) ? coordinates[1] : coordinates.latitude;
  focusGlobeOnLocation(lat, lon, {
    altitude: options?.altitude ?? options?.height ?? 3500000.0,
    duration: options?.duration ?? 2.0,
  });
}


