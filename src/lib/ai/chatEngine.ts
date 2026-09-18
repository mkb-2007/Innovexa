import { ARGO_FLOATS, getFloatById, getFloatsByBasin, findNearestFloat } from "@/data/argoFloats";
import { OCEAN_KNOWLEDGE } from "@/data/oceanKnowledge";
import { resolveLocationFromText } from "@/lib/geo/locationResolver";
import type { ChatMessage, GeoLocation, ExplorerContext, ArgoFloat } from "@/types/globe";

// --- 4D / Historical query detection ---

interface FourDQueryMatch {
  region: string;
  parameter: "Salinity (PSU)" | "Temperature (°C)";
  startYear: number;
  endYear: number;
  maxDepth: number;
}

export const REGION_KEYWORDS: Record<string, string> = {
  "bay of bengal": "Bay of Bengal",
  "bengal bay": "Bay of Bengal",
  "bengal": "Bay of Bengal",
  "bob": "Bay of Bengal",
  "north atlantic": "North Atlantic",
  "atlantic": "North Atlantic",
  "south pacific": "South Pacific",
  "north pacific": "North Pacific",
  "pacific": "South Pacific",
  "indian ocean": "Indian Ocean",
  "arctic": "Arctic Ocean",
  "southern ocean": "Southern Ocean",
  "arabian sea": "Arabian Sea",
  "andaman sea": "Indian Ocean",
  "mediterranean": "Mediterranean Sea",
  "caribbean": "Caribbean Sea",
  "red sea": "Red Sea",
  "south china sea": "South China Sea",
  "gulf of mexico": "Gulf of Mexico",
  "persian gulf": "Persian Gulf",
  "coral sea": "South Pacific",
  "tasman sea": "South Pacific",
  "norwegian sea": "North Atlantic",
  "bering sea": "North Pacific",
  "global": "Bay of Bengal",
};

/**
 * Maps a resolved geographic location name to a 4D data region profile key.
 * Falls back to "Bay of Bengal" for unknown regions.
 */
export function mapToFourDRegion(locationName: string): string {
  const lower = locationName.toLowerCase();
  // Direct match from REGION_KEYWORDS
  for (const [keyword, regionName] of Object.entries(REGION_KEYWORDS)) {
    if (lower.includes(keyword)) return regionName;
  }
  // Known 4D region profile keys
  const knownRegions = ["Bay of Bengal", "North Atlantic", "South Pacific", "Indian Ocean", "Arctic Ocean", "Southern Ocean"];
  for (const r of knownRegions) {
    if (lower.includes(r.toLowerCase())) return r;
  }
  return "Bay of Bengal";
}

/**
 * Detects the ocean parameter from a user query string.
 * Returns the parameter type or null if no parameter is detected.
 */
export function detectOceanParameter(query: string): "Salinity (PSU)" | "Temperature (°C)" | "Pressure (dbar)" | "argo" | null {
  const q = query.toLowerCase();
  const salKeywords = ["salinity", "psu", "salt", "halocline", "freshwater"];
  const tempKeywords = ["temperature", "temp", "sst", "warming", "heat", "thermal", "thermocline"];
  const pressureKeywords = ["pressure", "dbar"];
  const argoKeywords = ["argo float", "argo floats", "show floats", "show argo"];

  const isSalinity = salKeywords.some((kw) => q.includes(kw));
  const isTemperature = tempKeywords.some((kw) => q.includes(kw));
  const isPressure = pressureKeywords.some((kw) => q.includes(kw));
  const isArgo = argoKeywords.some((kw) => q.includes(kw));

  if (isArgo) return "argo";
  if (isPressure) return "Pressure (dbar)";
  if (isSalinity && !isTemperature) return "Salinity (PSU)";
  if (isTemperature && !isSalinity) return "Temperature (°C)";
  if (isSalinity) return "Salinity (PSU)";
  if (isTemperature) return "Temperature (°C)";
  return null;
}

/**
 * Broad ocean query parser — works for ANY "Show X of Y" pattern.
 * Does NOT require temporal keywords.
 * Returns null if no location+parameter combination is detected.
 */
export interface ParsedOceanQuery {
  region: string;
  parameter: "Salinity (PSU)" | "Temperature (°C)" | "Pressure (dbar)";
  depth: number | null;
  startYear: number;
  endYear: number;
  maxDepth: number;
  isArgoQuery: boolean;
}

export function parseOceanQuery(query: string): ParsedOceanQuery | null {
  const q = query.toLowerCase().trim();

  // Detect parameter
  const paramResult = detectOceanParameter(q);
  const isArgoQuery = paramResult === "argo";
  // If no parameter and no "show" intent, skip
  const hasShowIntent = /\b(show|display|visuali[sz]e|explore|view|map|plot|graph|see|reveal|open)\b/.test(q);
  if (!paramResult && !hasShowIntent) return null;

  // Detect region from REGION_KEYWORDS
  let region: string | null = null;
  // Sort by keyword length descending to match most specific first
  const sortedKeywords = Object.entries(REGION_KEYWORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, regionName] of sortedKeywords) {
    if (q.includes(keyword)) {
      region = regionName;
      break;
    }
  }

  // If no region detected, return null (we need at least a region)
  if (!region) return null;

  // Default parameter to salinity if we have a region but no explicit parameter
  const parameter: "Salinity (PSU)" | "Temperature (°C)" | "Pressure (dbar)" =
    paramResult && paramResult !== "argo" ? paramResult : "Salinity (PSU)";

  // Detect depth
  let depth: number | null = null;
  let maxDepth = 2000;
  const depthMatch = q.match(/(\d+)\s*(?:m|meters?|metre?s?)\b/);
  if (depthMatch) {
    const d = parseInt(depthMatch[1], 10);
    if (d >= 10 && d <= 6000) {
      depth = d;
      maxDepth = Math.max(d, 2000);
    }
  }
  if (q.includes("deep") || q.includes("abyssal")) {
    maxDepth = 6000;
  }

  // Detect time range
  let startYear = 2020;
  let endYear = 2025;
  const yearRangeMatch = q.match(/(\d{4})\s*(?:to|–|-|through)\s*(\d{4})/);
  if (yearRangeMatch) {
    startYear = parseInt(yearRangeMatch[1], 10);
    endYear = parseInt(yearRangeMatch[2], 10);
  } else {
    const lastNYears = q.match(/last\s+(\d+)\s+years?/);
    if (lastNYears) {
      const n = parseInt(lastNYears[1], 10);
      endYear = 2025;
      startYear = endYear - n;
    }
  }

  return { region, parameter, depth, startYear, endYear, maxDepth, isArgoQuery };
}

function detect4DQuery(query: string): FourDQueryMatch | null {
  const q = query.toLowerCase();

  // Must contain temporal or visualization keywords
  const temporalKeywords = [
    "last", "years", "year", "historical", "history", "trend", "over time",
    "time series", "4d", "visualization", "visualize", "show me", "explore",
    "compare", "change", "evolution", "from 20", "since 20",
  ];

  const hasTemporalIntent = temporalKeywords.some((kw) => q.includes(kw));
  if (!hasTemporalIntent) return null;

  // Detect parameter
  const salKeywords = ["salinity", "psu", "salt", "halocline", "freshwater"];
  const tempKeywords = ["temperature", "temp", "sst", "warming", "heat", "thermal", "thermocline"];
  const isSalinity = salKeywords.some((kw) => q.includes(kw));
  const isTemperature = tempKeywords.some((kw) => q.includes(kw));
  const parameter: "Salinity (PSU)" | "Temperature (°C)" = isSalinity && !isTemperature
    ? "Salinity (PSU)"
    : isTemperature && !isSalinity
      ? "Temperature (°C)"
      : "Salinity (PSU)"; // Default to salinity

  // Detect region
  let region = "Bay of Bengal"; // Default
  for (const [keyword, regionName] of Object.entries(REGION_KEYWORDS)) {
    if (q.includes(keyword)) {
      region = regionName;
      break;
    }
  }

  // Detect time range
  let startYear = 2020;
  let endYear = 2025;
  const yearRangeMatch = q.match(/(\d{4})\s*(?:to|–|-|through)\s*(\d{4})/);
  if (yearRangeMatch) {
    startYear = parseInt(yearRangeMatch[1], 10);
    endYear = parseInt(yearRangeMatch[2], 10);
  } else {
    const lastNYears = q.match(/last\s+(\d+)\s+years?/);
    if (lastNYears) {
      const n = parseInt(lastNYears[1], 10);
      endYear = 2025;
      startYear = endYear - n;
    }
  }

  // Detect depth
  let maxDepth = 2000;
  const depthMatch = q.match(/(\d+)\s*(?:m|meters?|metre?s?)\s*(?:depth)?/);
  if (depthMatch) {
    const d = parseInt(depthMatch[1], 10);
    if (d >= 100 && d <= 6000) maxDepth = d;
  }
  if (q.includes("deep") || q.includes("6000") || q.includes("abyssal")) {
    maxDepth = 6000;
  }

  return { region, parameter, startYear, endYear, maxDepth };
}

export function processUserQuery(userQuery: string, selectedFloat?: ArgoFloat | null): ChatMessage {
  const queryLower = userQuery.toLowerCase().trim();

  // --- 1. Check for Explicit Float WMO ID Search FIRST ---
  const explicitFloatMatch =
    queryLower.match(/\b(?:argo\s+float|float)\s*#?\s*(\d{5,7})\b/i) ||
    queryLower.match(/#(\d{5,7})\b/) ||
    queryLower.match(/\b(\d{7})\b/);

  if (explicitFloatMatch) {
    const wmoId = parseInt(explicitFloatMatch[1], 10);
    const floatObj = getFloatById(wmoId);
    if (floatObj) {
      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### ARGO Float WMO #${floatObj.wmoId} (${floatObj.name})\n\nLocated in the **${floatObj.basin}** at coordinates **${floatObj.latitude.toFixed(4)}°N, ${floatObj.longitude.toFixed(4)}°E**:\n\n- **Surface Temperature:** ${floatObj.surfaceTemp}°C\n- **Surface Salinity:** ${floatObj.surfaceSalinity} PSU\n- **Max Profiling Depth:** ${floatObj.maxDepth} meters\n- **Status:** ${floatObj.status.toUpperCase()} (Cycle #${floatObj.cycleNumber})\n- **Institution:** ${floatObj.institution} (${floatObj.country})\n- **Last Profile Date:** ${floatObj.lastProfileDate}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        focusOnFloat: true,
        mapActions: {
          shouldFlyTo: true,
          targetCoordinates: [floatObj.longitude, floatObj.latitude],
          highlightVariable: "temperature",
          depthReach: floatObj.maxDepth,
          isAnomaly: false,
        },
        targetFloatId: floatObj.id,
        targetLocation: {
          latitude: floatObj.latitude,
          longitude: floatObj.longitude,
          regionName: floatObj.basin,
          wmoId: floatObj.wmoId,
        },
        telemetryMetrics: {
          avgTemp: floatObj.surfaceTemp,
          avgSalinity: floatObj.surfaceSalinity,
          anomaly: "Nominal 10-day CTD Profile Cycle",
          activeFloatCount: 1,
          basinName: floatObj.basin,
        },
        chartData: floatObj.profiles,
      };
    } else {
      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### ARGO Float Not Found\n\nNo active ARGO float with WMO ID **#${wmoId}** was found in the global dataset.\n\nPlease verify the 7-digit WMO ID or click on any active glowing float pin on the 3D globe to view verified telemetry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        focusOnFloat: false,
        mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
      };
    }
  }

  // --- 1b. Check for Coordinate Proximity Query (e.g. "Show me the Argo float near 10°N, 80°E" or "near 10, -150") ---
  const coordRegex = /(-?\d+(?:\.\d+)?)\s*°?\s*([nsNS])\s*[,/ ]+\s*(-?\d+(?:\.\d+)?)\s*°?\s*([ewEW])/;
  const namedCoordMatch = queryLower.match(coordRegex);

  let parsedLat: number | null = null;
  let parsedLon: number | null = null;

  if (namedCoordMatch) {
    let lat = parseFloat(namedCoordMatch[1]);
    if (namedCoordMatch[2].toUpperCase() === "S" && lat > 0) lat = -lat;
    let lon = parseFloat(namedCoordMatch[3]);
    if (namedCoordMatch[4].toUpperCase() === "W" && lon > 0) lon = -lon;
    parsedLat = lat;
    parsedLon = lon;
  } else {
    const rawCoordMatch =
      queryLower.match(/(?:lat|latitude)\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*[,/ ]+\s*(?:lon|long|longitude)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i) ||
      queryLower.match(/(?:near|around|at|coordinates?|coords?)\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i) ||
      queryLower.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);

    if (rawCoordMatch && !queryLower.includes("year") && !queryLower.includes("202")) {
      const lat = parseFloat(rawCoordMatch[1]);
      const lon = parseFloat(rawCoordMatch[2]);
      if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        parsedLat = lat;
        parsedLon = lon;
      }
    }
  }

  if (parsedLat !== null && parsedLon !== null && (queryLower.includes("float") || queryLower.includes("argo"))) {
    const nearest = findNearestFloat(parsedLat, parsedLon);
    if (nearest) {
      const latStr = parsedLat >= 0 ? `${parsedLat.toFixed(1)}°N` : `${Math.abs(parsedLat).toFixed(1)}°S`;
      const lonStr = parsedLon >= 0 ? `${parsedLon.toFixed(1)}°E` : `${Math.abs(parsedLon).toFixed(1)}°W`;
      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### ARGO Float Near ${latStr}, ${lonStr} — Float #${nearest.wmoId}\n\nIdentified active ARGO Float **#${nearest.wmoId}** (${nearest.name}) in the **${nearest.basin}** closest to the queried coordinates:\n\n- **Exact Coordinates:** ${nearest.latitude.toFixed(4)}°N, ${nearest.longitude.toFixed(4)}°E\n- **Surface Temperature:** ${nearest.surfaceTemp}°C\n- **Surface Salinity:** ${nearest.surfaceSalinity} PSU\n- **Operational Status:** ${nearest.status.toUpperCase()} (Cycle #${nearest.cycleNumber})\n- **Max Depth Sampled:** ${nearest.maxDepth}m\n- **Institution / Country:** ${nearest.institution} (${nearest.country})\n\nThe 3D globe has centered on Float #${nearest.wmoId}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        focusOnFloat: true,
        mapActions: {
          shouldFlyTo: true,
          targetCoordinates: [nearest.longitude, nearest.latitude],
          highlightVariable: "temperature",
          depthReach: nearest.maxDepth,
          isAnomaly: false,
        },
        targetFloatId: nearest.id,
        targetLocation: {
          latitude: nearest.latitude,
          longitude: nearest.longitude,
          regionName: nearest.basin,
          wmoId: nearest.wmoId,
        },
        telemetryMetrics: {
          avgTemp: nearest.surfaceTemp,
          avgSalinity: nearest.surfaceSalinity,
          anomaly: "Nominal 10-day CTD Profile Cycle",
          activeFloatCount: 1,
          basinName: nearest.basin,
        },
        chartData: nearest.profiles,
      };
    }
  }

  // --- 2. Check for Out-of-Bounds Depth Queries (> 6000m or unphysical) ---
  const depthMatch =
    queryLower.match(/\b(?:at|around)\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters|dbar)?\b/) ||
    queryLower.match(/\bdepth\s*(?:of)?\s*(\d+(?:\.\d+)?)\b/) ||
    queryLower.match(/\b(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\s*(?:depth)?\b/);

  if (depthMatch) {
    const requestedDepth = parseFloat(depthMatch[1]);
    if (requestedDepth > 6000) {
      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### Data Unavailable at ${requestedDepth}m Depth\n\nARGO autonomous profiling floats operate to standard mission depths of **2,000 meters** (with specialized Deep ARGO floats descending up to **6,000 meters**).\n\nNo physical CTD (Conductivity, Temperature, Depth) observations exist at **${requestedDepth} meters** in this dataset. Abyssal depths beyond 6,000m are outside the operational profiling envelope of the global ARGO array.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        telemetryMetrics: {
          avgTemp: 0,
          avgSalinity: 0,
          anomaly: "Out-of-Range Rejection",
          activeFloatCount: ARGO_FLOATS.length,
          basinName: "Global Ocean",
        },
      };
    }
  }

  // --- 2. Check for 4D / Historical Queries ---
  const fourDMatch = detect4DQuery(queryLower);
  if (fourDMatch) {
    const { region, parameter, startYear, endYear, maxDepth } = fourDMatch;
    const explorerContext: ExplorerContext = {
      region,
      parameter,
      timeRange: `${startYear} – ${endYear}`,
      depthRange: `0 – ${maxDepth} m`,
      startYear,
      endYear,
      maxDepth,
    };

    const basinFloats = getFloatsByBasin(region);
    const floatObj = selectedFloat || (basinFloats.length > 0 ? basinFloats[0] : ARGO_FLOATS[0]);

    const targetLoc: GeoLocation = {
      latitude: floatObj.latitude,
      longitude: floatObj.longitude,
      regionName: region,
      wmoId: floatObj.wmoId,
    };

    const paramLabel = parameter === "Salinity (PSU)" ? "salinity" : "temperature";

    return {
      id: `msg-${Date.now()}`,
      sender: "assistant",
      text: `Got it! 🌊\n\nHere's the 4D visualization of **${region}** ${paramLabel} from ${startYear} to ${endYear}. You can explore changes over time and depth in the right explorer panel.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      targetFloatId: floatObj.id,
      targetLocation: targetLoc,
      explorerContext,
      telemetryMetrics: {
        avgTemp: floatObj.surfaceTemp,
        avgSalinity: floatObj.surfaceSalinity,
        anomaly: "4D Exploration Active",
        activeFloatCount: basinFloats.length || ARGO_FLOATS.length,
        basinName: region,
      },
      chartData: floatObj.profiles,
    };
  }

  // --- 2b. Broad location + parameter queries ("Show salinity of Bay of Bengal") ---
  const oceanQuery = parseOceanQuery(queryLower);
  if (oceanQuery && !oceanQuery.isArgoQuery) {
    const { region, parameter, depth, startYear, endYear, maxDepth } = oceanQuery;
    const explorerContext: ExplorerContext = {
      region,
      parameter,
      timeRange: `${startYear} – ${endYear}`,
      depthRange: depth ? `0 – ${Math.max(depth, maxDepth)} m` : `0 – ${maxDepth} m`,
      startYear,
      endYear,
      maxDepth: depth ? Math.max(depth, maxDepth) : maxDepth,
    };

    const resolvedGeo = resolveLocationFromText(userQuery);
    const basinFloats = getFloatsByBasin(region);
    const floatObj = selectedFloat || (basinFloats.length > 0 ? basinFloats[0] : ARGO_FLOATS[0]);

    // Use resolved coordinates if available, otherwise use float coordinates
    const targetLat = resolvedGeo && !resolvedGeo.isFloat ? resolvedGeo.latitude : floatObj.latitude;
    const targetLon = resolvedGeo && !resolvedGeo.isFloat ? resolvedGeo.longitude : floatObj.longitude;
    const targetAlt = resolvedGeo && !resolvedGeo.isFloat ? resolvedGeo.zoomAltitude : 3500000.0;

    const targetLoc: GeoLocation = {
      latitude: targetLat,
      longitude: targetLon,
      regionName: region,
      height: targetAlt,
      wmoId: floatObj.wmoId,
    };

    const paramLabel = parameter === "Salinity (PSU)" ? "salinity" : parameter === "Temperature (°C)" ? "temperature" : "pressure";
    const depthNote = depth ? ` at **${depth}m** depth` : "";
    const floatCount = basinFloats.length || ARGO_FLOATS.filter((f) => {
      const dLat = f.latitude - targetLat;
      const dLon = f.longitude - targetLon;
      return Math.hypot(dLat, dLon) < 35.0;
    }).length;

    return {
      id: `msg-${Date.now()}`,
      sender: "assistant",
      text: `### 4D Ocean Visualization — ${region}\n\nNavigating to **${region}** and activating the 4D ${paramLabel} visualization${depthNote}.\n\n- **Region:** ${region}\n- **Parameter:** ${paramLabel.charAt(0).toUpperCase() + paramLabel.slice(1)}\n- **Active ARGO Floats:** ${floatCount} in region\n- **Time Range:** ${startYear} – ${endYear}\n- **Depth Range:** 0 – ${maxDepth}m\n\nExplore changes over time, depth, and space in the 4D Explorer panel.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      targetFloatId: floatObj.id,
      targetLocation: targetLoc,
      explorerContext,
      mapActions: {
        shouldFlyTo: true,
        targetCoordinates: [targetLon, targetLat],
        highlightVariable: paramLabel === "salinity" ? "salinity" : "temperature",
        depthReach: depth || maxDepth,
        isAnomaly: false,
      },
      telemetryMetrics: {
        avgTemp: floatObj.surfaceTemp,
        avgSalinity: floatObj.surfaceSalinity,
        anomaly: "4D Exploration Active",
        activeFloatCount: floatCount,
        basinName: region,
      },
      chartData: floatObj.profiles,
    };
  }

  // --- 3. Check for Selected Float / "This Float" Grounded Queries ---
  const isQueryAboutSelectedFloat =
    queryLower.includes("this float") ||
    queryLower.includes("the float") ||
    queryLower.includes("its temp") ||
    queryLower.includes("its location") ||
    queryLower.includes("where is it") ||
    queryLower.includes("where is this") ||
    queryLower.includes("salinity at this location") ||
    queryLower.includes("salinity here") ||
    queryLower.includes("temperature here") ||
    (selectedFloat && (
      queryLower.includes("temperature of this") ||
      queryLower.includes("where is this float located") ||
      queryLower.includes("what is the temperature") ||
      queryLower.includes("what is the salinity") ||
      queryLower.includes("what is its depth") ||
      queryLower.includes("show its profile")
    ));

  if (isQueryAboutSelectedFloat) {
    if (!selectedFloat) {
      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### No Float Currently Selected\n\nNo ARGO float is currently selected on the 3D globe.\n\nPlease click on any glowing float pin on the 3D globe or search for a specific float (e.g. *\"Float #2901542\"*) to inspect its live temperature, salinity, and depth profile.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
    }

    // Grounded in the selectedFloat's actual data
    if (queryLower.includes("temp")) {
      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### Temperature Telemetry — ARGO Float #${selectedFloat.wmoId}\n\nLive CTD observation for Float **#${selectedFloat.wmoId}** in the **${selectedFloat.basin}**:\n\n- **Surface Temperature:** **${selectedFloat.surfaceTemp}°C**\n- **Basin / Region:** ${selectedFloat.basin}\n- **Coordinates:** ${selectedFloat.latitude.toFixed(4)}°N, ${selectedFloat.longitude.toFixed(4)}°E\n- **Max Depth Sampled:** ${selectedFloat.maxDepth}m\n- **Cycle Number:** #${selectedFloat.cycleNumber} (${selectedFloat.status.toUpperCase()})\n- **Last Profile Date:** ${selectedFloat.lastProfileDate}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        focusOnFloat: true,
        mapActions: {
          shouldFlyTo: true,
          targetCoordinates: [selectedFloat.longitude, selectedFloat.latitude],
          highlightVariable: "temperature",
          depthReach: selectedFloat.maxDepth,
          isAnomaly: false,
        },
        targetFloatId: selectedFloat.id,
        targetLocation: {
          latitude: selectedFloat.latitude,
          longitude: selectedFloat.longitude,
          regionName: selectedFloat.basin,
          wmoId: selectedFloat.wmoId,
        },
        telemetryMetrics: {
          avgTemp: selectedFloat.surfaceTemp,
          avgSalinity: selectedFloat.surfaceSalinity,
          anomaly: "Live Selected Float Telemetry",
          activeFloatCount: 1,
          basinName: selectedFloat.basin,
        },
        chartData: selectedFloat.profiles,
      };
    }

    if (queryLower.includes("where") || queryLower.includes("locat")) {
      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### Location Coordinates — ARGO Float #${selectedFloat.wmoId}\n\nFloat **#${selectedFloat.wmoId}** is deployed in the **${selectedFloat.basin}**:\n\n- **Latitude:** ${selectedFloat.latitude.toFixed(4)}°N\n- **Longitude:** ${selectedFloat.longitude.toFixed(4)}°E\n- **Ocean Basin:** ${selectedFloat.basin}\n- **Operating Country / Institution:** ${selectedFloat.institution} (${selectedFloat.country})\n- **Last Profiling Date:** ${selectedFloat.lastProfileDate}\n- **Operational Status:** ${selectedFloat.status.toUpperCase()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        focusOnFloat: true,
        mapActions: {
          shouldFlyTo: true,
          targetCoordinates: [selectedFloat.longitude, selectedFloat.latitude],
          highlightVariable: "temperature",
          depthReach: selectedFloat.maxDepth,
          isAnomaly: false,
        },
        targetFloatId: selectedFloat.id,
        targetLocation: {
          latitude: selectedFloat.latitude,
          longitude: selectedFloat.longitude,
          regionName: selectedFloat.basin,
          wmoId: selectedFloat.wmoId,
        },
        telemetryMetrics: {
          avgTemp: selectedFloat.surfaceTemp,
          avgSalinity: selectedFloat.surfaceSalinity,
          anomaly: "Live Selected Float Telemetry",
          activeFloatCount: 1,
          basinName: selectedFloat.basin,
        },
        chartData: selectedFloat.profiles,
      };
    }

    if (queryLower.includes("salinit") || queryLower.includes("salt")) {
      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### Salinity Measurement — ARGO Float #${selectedFloat.wmoId}\n\nSalinity reading from Float **#${selectedFloat.wmoId}** in the **${selectedFloat.basin}**:\n\n- **Observed Surface Salinity:** **${selectedFloat.surfaceSalinity} PSU**\n- **Coordinates:** ${selectedFloat.latitude.toFixed(4)}°N, ${selectedFloat.longitude.toFixed(4)}°E\n- **Surface Temperature:** ${selectedFloat.surfaceTemp}°C\n- **Vertical Profiling Depth:** Down to ${selectedFloat.maxDepth}m\n- **Profile Date:** ${selectedFloat.lastProfileDate}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        focusOnFloat: true,
        mapActions: {
          shouldFlyTo: true,
          targetCoordinates: [selectedFloat.longitude, selectedFloat.latitude],
          highlightVariable: "salinity",
          depthReach: selectedFloat.maxDepth,
          isAnomaly: false,
        },
        targetFloatId: selectedFloat.id,
        targetLocation: {
          latitude: selectedFloat.latitude,
          longitude: selectedFloat.longitude,
          regionName: selectedFloat.basin,
          wmoId: selectedFloat.wmoId,
        },
        telemetryMetrics: {
          avgTemp: selectedFloat.surfaceTemp,
          avgSalinity: selectedFloat.surfaceSalinity,
          anomaly: "Live Selected Float Telemetry",
          activeFloatCount: 1,
          basinName: selectedFloat.basin,
        },
        chartData: selectedFloat.profiles,
      };
    }

    // Default overview for selected float
    return {
      id: `msg-${Date.now()}`,
      sender: "assistant",
      text: `### ARGO Float #${selectedFloat.wmoId} Telemetry Overview\n\n- **Float Name:** ${selectedFloat.name}\n- **Basin:** ${selectedFloat.basin}\n- **Coordinates:** ${selectedFloat.latitude.toFixed(4)}°N, ${selectedFloat.longitude.toFixed(4)}°E\n- **Surface Temperature:** ${selectedFloat.surfaceTemp}°C\n- **Surface Salinity:** ${selectedFloat.surfaceSalinity} PSU\n- **Max Profiling Reach:** ${selectedFloat.maxDepth}m\n- **Cycle Number:** #${selectedFloat.cycleNumber} (${selectedFloat.status.toUpperCase()})\n- **Institution:** ${selectedFloat.institution} (${selectedFloat.country})\n- **Last Profile Date:** ${selectedFloat.lastProfileDate}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      focusOnFloat: true,
      mapActions: {
        shouldFlyTo: true,
        targetCoordinates: [selectedFloat.longitude, selectedFloat.latitude],
        highlightVariable: "temperature",
        depthReach: selectedFloat.maxDepth,
        isAnomaly: false,
      },
      targetFloatId: selectedFloat.id,
      targetLocation: {
        latitude: selectedFloat.latitude,
        longitude: selectedFloat.longitude,
        regionName: selectedFloat.basin,
        wmoId: selectedFloat.wmoId,
      },
      telemetryMetrics: {
        avgTemp: selectedFloat.surfaceTemp,
        avgSalinity: selectedFloat.surfaceSalinity,
        anomaly: "Live Selected Float Telemetry",
        activeFloatCount: 1,
        basinName: selectedFloat.basin,
      },
      chartData: selectedFloat.profiles,
    };
  }

  // --- 4. Universal Geographic Location Resolution (Oceans, Seas, Countries, Cities, Coordinates) ---
  const resolvedGeo = resolveLocationFromText(userQuery);
  if (resolvedGeo) {
    if (resolvedGeo.isFloat && resolvedGeo.floatId) {
      const floatObj = getFloatById(resolvedGeo.floatId) || ARGO_FLOATS.find((f) => f.id === resolvedGeo.floatId || f.wmoId === resolvedGeo.wmoId);
      if (floatObj) {
        return {
          id: `msg-${Date.now()}`,
          sender: "assistant",
          text: `### ARGO Float WMO #${floatObj.wmoId} (${floatObj.name})\n\nLocated in the **${floatObj.basin}** at coordinates **${floatObj.latitude.toFixed(4)}°N, ${floatObj.longitude.toFixed(4)}°E**:\n\n- **Surface Temperature:** ${floatObj.surfaceTemp}°C\n- **Surface Salinity:** ${floatObj.surfaceSalinity} PSU\n- **Max Profiling Depth:** ${floatObj.maxDepth} meters\n- **Status:** ${floatObj.status.toUpperCase()} (Cycle #${floatObj.cycleNumber})\n- **Institution:** ${floatObj.institution} (${floatObj.country})\n- **Last Profile Date:** ${floatObj.lastProfileDate}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          focusOnFloat: true,
          mapActions: {
            shouldFlyTo: true,
            targetCoordinates: [floatObj.longitude, floatObj.latitude],
            highlightVariable: "temperature",
            depthReach: floatObj.maxDepth,
            isAnomaly: false,
          },
          targetFloatId: floatObj.id,
          targetLocation: {
            latitude: floatObj.latitude,
            longitude: floatObj.longitude,
            regionName: floatObj.basin,
            wmoId: floatObj.wmoId,
          },
          telemetryMetrics: {
            avgTemp: floatObj.surfaceTemp,
            avgSalinity: floatObj.surfaceSalinity,
            anomaly: "Nominal 10-day CTD Profile Cycle",
            activeFloatCount: 1,
            basinName: floatObj.basin,
          },
          chartData: floatObj.profiles,
        };
      }
    } else if (resolvedGeo.isCoordinate) {
      const nearest = findNearestFloat(resolvedGeo.latitude, resolvedGeo.longitude);
      const latStr = resolvedGeo.latitude >= 0 ? `${resolvedGeo.latitude.toFixed(2)}°N` : `${Math.abs(resolvedGeo.latitude).toFixed(2)}°S`;
      const lonStr = resolvedGeo.longitude >= 0 ? `${resolvedGeo.longitude.toFixed(2)}°E` : `${Math.abs(resolvedGeo.longitude).toFixed(2)}°W`;

      const nearbyInfo = nearest
        ? `\n\n**Nearest Active ARGO Float:**\n- **Float WMO:** #${nearest.wmoId} (${nearest.name})\n- **Basin:** ${nearest.basin}\n- **Coordinates:** ${nearest.latitude.toFixed(4)}°N, ${nearest.longitude.toFixed(4)}°E\n- **Surface Temp / Salinity:** ${nearest.surfaceTemp}°C / ${nearest.surfaceSalinity} PSU\n- **Last Profile Date:** ${nearest.lastProfileDate}`
        : "";

      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### Geographic Target: ${resolvedGeo.name}\n\nThe 3D Earth has smoothly rotated to center on coordinates **${latStr}, ${lonStr}** with an optical focal point marker.${nearbyInfo}\n\nYou can click on any surrounding glowing float marker to inspect vertical CTD soundings.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        focusOnFloat: false,
        targetLocation: {
          latitude: resolvedGeo.latitude,
          longitude: resolvedGeo.longitude,
          regionName: resolvedGeo.name,
          height: resolvedGeo.zoomAltitude,
        },
        mapActions: {
          shouldFlyTo: true,
          targetCoordinates: [resolvedGeo.longitude, resolvedGeo.latitude],
          highlightVariable: "temperature",
          depthReach: 2000,
          isAnomaly: false,
        },
      };
    } else {
      const nearestFloats = ARGO_FLOATS.filter((f) => {
        const dLat = f.latitude - resolvedGeo.latitude;
        const dLon = f.longitude - resolvedGeo.longitude;
        return Math.hypot(dLat, dLon) < 35.0;
      });
      const activeCount = nearestFloats.length;
      const avgTemp = activeCount > 0 ? (nearestFloats.reduce((acc, f) => acc + f.surfaceTemp, 0) / activeCount).toFixed(1) : "24.5";
      const avgSal = activeCount > 0 ? (nearestFloats.reduce((acc, f) => acc + f.surfaceSalinity, 0) / activeCount).toFixed(1) : "34.8";

      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### Geographic Focus: ${resolvedGeo.name}\n\nThe 3D globe has navigated to center **${resolvedGeo.name}** (${resolvedGeo.latitude.toFixed(2)}°, ${resolvedGeo.longitude.toFixed(2)}°) with a visual navigation target marker.\n\n- **Entity Type:** ${resolvedGeo.type.toUpperCase()}\n- **Active Regional ARGO Floats:** ${activeCount} floats within observation perimeter\n- **Mean Regional Surface Temperature:** ${avgTemp}°C\n- **Mean Regional Salinity:** ${avgSal} PSU`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        focusOnFloat: false,
        targetLocation: {
          latitude: resolvedGeo.latitude,
          longitude: resolvedGeo.longitude,
          regionName: resolvedGeo.name,
          height: resolvedGeo.zoomAltitude,
        },
        mapActions: {
          shouldFlyTo: true,
          targetCoordinates: [resolvedGeo.longitude, resolvedGeo.latitude],
          highlightVariable: "temperature",
          depthReach: 2000,
          isAnomaly: false,
        },
        telemetryMetrics: {
          avgTemp: parseFloat(avgTemp),
          avgSalinity: parseFloat(avgSal),
          anomaly: "Nominal Regional Baseline",
          activeFloatCount: activeCount,
          basinName: resolvedGeo.name,
        },
      };
    }
  }

  // --- 5. General Ocean Science Questions (SST, Thermocline, Halocline, ARGO, etc.) ---
  if (queryLower === "what is sst" || queryLower.includes("what is sst") || queryLower.includes("sea surface temperature")) {
    return {
      id: `msg-${Date.now()}`,
      sender: "assistant",
      text: `### Sea Surface Temperature (SST)\n\n**Sea Surface Temperature (SST)** is the water temperature measured close to the ocean's surface (typically within the upper few meters).\n\n- **Scientific Significance:** SST is a primary driver of global weather systems, atmospheric circulation, monsoons, and tropical cyclone genesis.\n- **Measurement Methods:** Measured by satellite infrared/microwave radiometers and in-situ ARGO profiling floats during their surface intervals.\n- **Climatological Range:** Ranges from -1.8°C in polar regions to over 30°C in equatorial warm pools (e.g., Western Pacific and Bay of Bengal).`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      focusOnFloat: false,
      mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
    };
  }

  if (queryLower.includes("thermocline")) {
    return {
      id: `msg-${Date.now()}`,
      sender: "assistant",
      text: `### Thermocline Dynamics\n\nThe **thermocline** is the oceanic layer in which water temperature decreases rapidly with increasing depth, separating the warm upper mixed layer from the cold deep ocean.\n\n- **Vertical Structure:** In tropical and subtropical oceans, the permanent thermocline typically extends between **100m and 500m** depth.\n- **Temperature Gradient:** Gradients can exceed **-0.4°C per meter**, creating a strong thermal density barrier that restricts vertical mixing.\n- **ARGO CTD Observation:** ARGO floats record vertical temperature profiles every 10 days, allowing precise tracking of thermocline depth shifts and internal waves.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      focusOnFloat: false,
      mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
    };
  }

  if (queryLower.includes("halocline")) {
    return {
      id: `msg-${Date.now()}`,
      sender: "assistant",
      text: `### Halocline Dynamics\n\nA **halocline** is a vertical zone in the oceanic water column where salinity changes rapidly with depth.\n\n- **Role in Stratification:** Because salinity strongly affects water density, a sharp halocline creates pronounced density stratification (pycnocline), even when temperatures are uniform.\n- **Regional Examples:** The Bay of Bengal has a pronounced shallow halocline due to massive monsoon river discharge, while the Arctic Ocean has a cold, low-salinity halocline layer insulating surface ice from warmer deep Atlantic waters.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      focusOnFloat: false,
      mapActions: { shouldFlyTo: false, highlightVariable: "salinity", depthReach: 2000, isAnomaly: false },
    };
  }

  // Search for matching topic in OCEAN_KNOWLEDGE (do NOT move globe for general ocean knowledge)
  const matchedTopic = OCEAN_KNOWLEDGE.find((topic) =>
    topic.keywords.some((kw) => queryLower.includes(kw))
  );

  if (matchedTopic) {
    return {
      id: `msg-${Date.now()}`,
      sender: "assistant",
      text: `### ${matchedTopic.title}\n\n${matchedTopic.summary}\n\n${matchedTopic.details}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      focusOnFloat: false,
      mapActions: {
        shouldFlyTo: false,
        highlightVariable: "temperature",
        depthReach: 2000,
        isAnomaly: false,
      },
      telemetryMetrics: {
        avgTemp: matchedTopic.avgTemp || 28.5,
        avgSalinity: matchedTopic.avgSalinity || 34.5,
        anomaly: matchedTopic.anomalyText || "Active Hydrodynamic Sampling",
        activeFloatCount: getFloatsByBasin(matchedTopic.suggestedBasin || "Global Ocean").length,
        basinName: matchedTopic.suggestedBasin || "Global Ocean",
      },
      chartData: ARGO_FLOATS[0].profiles,
    };
  }

  // General oceanographic insight
  return {
    id: `msg-${Date.now()}`,
    sender: "assistant",
    text: `### FloatChat Ocean Telemetry Insight\n\nI analyzed your query: *"_${userQuery}_"*\n\nAcross the global network of **3,940 active ARGO floats**, ocean telemetry indicates stable thermal stratification in tropical upper layers, with active deep ocean profile cycles reaching up to 6,000 meters depth.\n\nYou can click on any glowing ARGO float pin on the 3D Earth or ask specific questions like:\n- *\"Where is this float located?\"*\n- *\"What is the temperature of this float?\"*\n- *\"What is SST?\"*\n- *\"Explain the thermocline in Bay of Bengal\"*`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    focusOnFloat: false,
    mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
  };
}
