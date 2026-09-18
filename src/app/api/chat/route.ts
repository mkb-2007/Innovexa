import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { SemanticQueryResponse, ArgoFloat, ExplorerContext } from "@/types/globe";
import { ARGO_FLOATS, getFloatsByBasin, getFloatById, findNearestFloat } from "@/data/argoFloats";
import { OCEAN_KNOWLEDGE } from "@/data/oceanKnowledge";
import { resolveLocationFromText } from "@/lib/geo/locationResolver";
import { detectOceanParameter, mapToFourDRegion, parseOceanQuery } from "@/lib/ai/chatEngine";

interface HistoryMessage {
  role?: "user" | "assistant" | string;
  sender?: string;
  text?: string;
  content?: string;
}

interface IncomingPayload {
  message?: string;
  prompt?: string;
  query?: string;
  sessionId?: string;
  selectedFloat?: ArgoFloat | null;
  history?: HistoryMessage[];
  messages?: HistoryMessage[];
}

// In-memory session registry to ensure strict session isolation
interface SessionState {
  id: string;
  lastActiveFloatId?: number;
  lastRegion?: string;
  lastParameter?: "Salinity (PSU)" | "Temperature (\u00b0C)" | "Pressure (dbar)";
  lastUpdated: number;
}
const sessionStore = new Map<string, SessionState>();

/**
 * Cleanly build response for a specific target ARGO float
 */
function buildFloatResponse(
  float: ArgoFloat,
  questionType: "temperature" | "location" | "salinity" | "depth" | "thermocline" | "anomaly" | "overview",
  requestedDepth: number | null = null,
  focusOnFloat = true,
  isCoordinateSearch = false,
  searchedCoords?: { lat: number; lon: number }
): SemanticQueryResponse {
  const profiles = float.profiles || [];
  const maxDepth = float.maxDepth;

  let responseText = "";
  let isAnomaly = false;

  if (isCoordinateSearch && searchedCoords) {
    const latStr = searchedCoords.lat >= 0 ? `${searchedCoords.lat.toFixed(1)}°N` : `${Math.abs(searchedCoords.lat).toFixed(1)}°S`;
    const lonStr = searchedCoords.lon >= 0 ? `${searchedCoords.lon.toFixed(1)}°E` : `${Math.abs(searchedCoords.lon).toFixed(1)}°W`;
    responseText = `### ARGO Float Near ${latStr}, ${lonStr} — Float #${float.wmoId}\n\nIdentified active ARGO Float **#${float.wmoId}** (${float.name}) in the **${float.basin}** closest to the queried coordinates:\n\n- **Exact Coordinates:** ${float.latitude.toFixed(4)}°N, ${float.longitude.toFixed(4)}°E\n- **Surface Temperature:** ${float.surfaceTemp}°C\n- **Surface Salinity:** ${float.surfaceSalinity} PSU\n- **Operational Status:** ${float.status.toUpperCase()} (Cycle #${float.cycleNumber})\n- **Max Depth Sampled:** ${maxDepth}m\n- **Institution / Country:** ${float.institution} (${float.country})\n\nThe 3D globe has centered on Float #${float.wmoId}.`;
  } else if (requestedDepth !== null) {
    if (requestedDepth > maxDepth) {
      const deepest = profiles[profiles.length - 1] || { depth: maxDepth, temperature: 1.2, salinity: 34.8 };
      responseText = `### Depth Measurement Unavailable at ${requestedDepth}m\n\nARGO Float **#${float.wmoId}** in the **${float.basin}** profiles down to a maximum recorded depth of **${maxDepth} meters**.\n\nNo physical CTD observations exist at **${requestedDepth}m** for this float. The deepest recorded valid level in this profile is **${maxDepth}m** with an observed temperature of **${deepest.temperature}°C** and salinity of **${deepest.salinity} PSU**.`;
    } else {
      const closest = profiles.reduce((prev, curr) =>
        Math.abs(curr.depth - requestedDepth) < Math.abs(prev.depth - requestedDepth) ? curr : prev
      );
      responseText = `### ARGO Observation at ${closest.depth}m Depth — Float #${float.wmoId}\n\nCTD hydrographic sounding from Float **#${float.wmoId}** in the **${float.basin}** at **${closest.depth}m** depth:\n\n- **Temperature:** **${closest.temperature}°C**\n- **Salinity:** **${closest.salinity} PSU**\n- **Pressure:** ${closest.pressure} dbar\n- **Surface Baseline:** ${float.surfaceTemp}°C / ${float.surfaceSalinity} PSU\n- **Coordinates:** ${float.latitude.toFixed(4)}°N, ${float.longitude.toFixed(4)}°E\n- **Profile Date:** ${float.lastProfileDate}`;
    }
  } else if (questionType === "location") {
    responseText = `### Geographic Location — ARGO Float #${float.wmoId}\n\nARGO Float **#${float.wmoId}** (${float.name}) is located in the **${float.basin}**:\n\n- **Latitude:** ${float.latitude.toFixed(4)}°N\n- **Longitude:** ${float.longitude.toFixed(4)}°E\n- **Ocean Basin:** ${float.basin}\n- **Institution / Country:** ${float.institution} (${float.country})\n- **Last Profile Date:** ${float.lastProfileDate}\n- **Cycle Number:** #${float.cycleNumber} (${float.status.toUpperCase()})\n- **Max Depth Sampled:** ${maxDepth}m`;
  } else if (questionType === "temperature") {
    responseText = `### Temperature Telemetry — ARGO Float #${float.wmoId}\n\nLive thermal observation recorded by Float **#${float.wmoId}** in the **${float.basin}**:\n\n- **Surface Temperature:** **${float.surfaceTemp}°C**\n- **Basin / Region:** ${float.basin}\n- **Coordinates:** ${float.latitude.toFixed(4)}°N, ${float.longitude.toFixed(4)}°E\n- **Operational Status:** ${float.status.toUpperCase()} (Cycle #${float.cycleNumber})\n- **Max Depth Sampled:** ${maxDepth}m\n- **Last Profile Date:** ${float.lastProfileDate}\n\nThermal stratification exhibits a standard oceanic mixed-layer profile descending to ${profiles[profiles.length - 1]?.temperature || "1.5"}°C at ${maxDepth}m.`;
  } else if (questionType === "salinity") {
    responseText = `### Salinity Measurement — ARGO Float #${float.wmoId}\n\nHydrographic salinity observation from Float **#${float.wmoId}** in the **${float.basin}**:\n\n- **Observed Surface Salinity:** **${float.surfaceSalinity} PSU**\n- **Basin / Region:** ${float.basin}\n- **Coordinates:** ${float.latitude.toFixed(4)}°N, ${float.longitude.toFixed(4)}°E\n- **Associated Surface Temperature:** ${float.surfaceTemp}°C\n- **Sampling Range:** Surface to ${maxDepth}m\n- **Last Profile Date:** ${float.lastProfileDate}`;
  } else if (questionType === "thermocline") {
    let maxGrad = 0;
    let tDepth = 150;
    for (let i = 1; i < profiles.length; i++) {
      const dDepth = profiles[i].depth - profiles[i - 1].depth;
      if (dDepth > 0) {
        const grad = Math.abs((profiles[i].temperature - profiles[i - 1].temperature) / dDepth);
        if (grad > maxGrad) {
          maxGrad = grad;
          tDepth = profiles[i].depth;
        }
      }
    }
    responseText = `### Thermocline Analysis — ARGO Float #${float.wmoId}\n\nCTD vertical gradient analysis for Float **#${float.wmoId}** in the **${float.basin}**:\n\n- **Strongest Thermocline Depth:** Around **${tDepth} meters**\n- **Surface Temperature:** ${float.surfaceTemp}°C\n- **Surface Salinity:** ${float.surfaceSalinity} PSU\n- **Deepest Sampled Level:** ${maxDepth}m (${profiles[profiles.length - 1]?.temperature}°C)\n- **Float Coordinates:** ${float.latitude.toFixed(4)}°N, ${float.longitude.toFixed(4)}°E\n\nThe thermocline marks the rapid transition zone decoupling warm surface waters from deeper ocean layers.`;
  } else if (questionType === "anomaly") {
    isAnomaly = true;
    responseText = `### Ocean Anomaly Analysis — ARGO Float #${float.wmoId}\n\nHydrographic telemetry check in the **${float.basin}**:\n\n- **Float WMO ID:** #${float.wmoId} (${float.name})\n- **Coordinates:** ${float.latitude.toFixed(4)}°N, ${float.longitude.toFixed(4)}°E\n- **Observed Surface Temp:** ${float.surfaceTemp}°C\n- **Observed Salinity:** ${float.surfaceSalinity} PSU\n- **Stratification:** Stratified water column with nominal salinity halocline.\n- **Cycle Number:** #${float.cycleNumber}`;
  } else {
    responseText = `### ARGO Float #${float.wmoId} Hydrographic Overview — ${float.basin}\n\nActive telemetry loaded for float **#${float.wmoId}** (${float.institution || float.country}):\n\n- **Basin:** ${float.basin} (${float.latitude.toFixed(4)}°N, ${float.longitude.toFixed(4)}°E)\n- **Surface Temperature:** ${float.surfaceTemp}°C\n- **Surface Salinity:** ${float.surfaceSalinity} PSU\n- **Max Depth Sampled:** ${maxDepth}m\n- **Status:** ${float.status.toUpperCase()} (Cycle #${float.cycleNumber})\n- **Last Profile Date:** ${float.lastProfileDate}\n\nYou can ask specific questions like *"Where is this float located?"*, *"What is its temperature?"*, or *"Show salinity at 500m"*.`;
  }

  const basinFloats = getFloatsByBasin(float.basin);
  const isSal = questionType === "salinity";

  return {
    responseText,
    focusOnFloat,
    mapActions: {
      shouldFlyTo: focusOnFloat,
      targetCoordinates: [float.longitude, float.latitude],
      highlightVariable: isSal ? "salinity" : "temperature",
      depthReach: requestedDepth ? Math.min(requestedDepth, maxDepth) : maxDepth,
      isAnomaly,
    },
    targetFloatId: float.id,
    targetLocation: {
      latitude: float.latitude,
      longitude: float.longitude,
      regionName: float.basin,
      wmoId: float.wmoId,
    },
    explorerContext: {
      region: float.basin,
      parameter: isSal ? "Salinity (PSU)" : "Temperature (°C)",
      timeRange: "2020 – 2025",
      depthRange: `0 – ${maxDepth}m`,
      startYear: 2020,
      endYear: 2025,
      maxDepth,
    },
    telemetryMetrics: {
      avgTemp: float.surfaceTemp,
      avgSalinity: float.surfaceSalinity,
      anomaly: isAnomaly ? "Active Marine Heatwave / Anomaly" : "Nominal Hydrographic Telemetry",
      activeFloatCount: basinFloats.length || 1,
      basinName: float.basin,
    },
    chartData: profiles,
  };
}

export async function POST(req: Request) {
  let userQuery = "";
  try {
    const payload: IncomingPayload = await req.json();
    const rawMsg =
      payload.message ||
      payload.prompt ||
      payload.query ||
      (Array.isArray(payload.messages) && payload.messages.length > 0
        ? payload.messages[payload.messages.length - 1]?.content || payload.messages[payload.messages.length - 1]?.text
        : "") ||
      "";
    userQuery = String(rawMsg).trim();
    const sessionId = payload.sessionId || `session-${Date.now()}`;
    const selectedFloat = payload.selectedFloat || null;
    const history = Array.isArray(payload.history) ? payload.history : [];

    const q = userQuery.toLowerCase();

    // 0. Update session state
    if (!sessionStore.has(sessionId)) {
      sessionStore.set(sessionId, {
        id: sessionId,
        lastActiveFloatId: selectedFloat?.wmoId || undefined,
        lastUpdated: Date.now(),
      });
    } else {
      const state = sessionStore.get(sessionId)!;
      if (selectedFloat?.wmoId) {
        state.lastActiveFloatId = selectedFloat.wmoId;
      }
      state.lastUpdated = Date.now();
    }

    // 1. Explicit Float ID in query (e.g. "float #2901542", "#2901542", "float 2901234", "argo float 2901234", "2901234")
    let targetFloat: ArgoFloat | null = null;
    let isSpecificFloatQuery = false;
    let isCoordinateSearch = false;
    let searchedCoords: { lat: number; lon: number } | undefined;

    const explicitFloatMatch =
      q.match(/\b(?:argo\s+float|float)\s*#?\s*(\d{5,7})\b/i) ||
      q.match(/#(\d{5,7})\b/) ||
      q.match(/\b(\d{7})\b/);

    if (explicitFloatMatch) {
      const explicitId = parseInt(explicitFloatMatch[1], 10);
      const matched = getFloatById(explicitId);
      if (!matched) {
        return NextResponse.json({
          responseText: `### ARGO Float Not Found\n\nNo active ARGO float with WMO ID **#${explicitId}** was found in the global dataset.\n\nPlease verify the 7-digit WMO ID or click on any active glowing float pin on the 3D globe to view verified telemetry.`,
          focusOnFloat: false,
          mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
        });
      }
      targetFloat = matched;
      isSpecificFloatQuery = true;
    }

    // 2. Check for Coordinate Proximity Query (e.g. "Show me the Argo float near 10°N, 80°E" or "near 10, -150")
    if (!targetFloat) {
      const coordRegex = /(-?\d+(?:\.\d+)?)\s*°?\s*([nsNS])\s*[,/ ]+\s*(-?\d+(?:\.\d+)?)\s*°?\s*([ewEW])/;
      const namedCoordMatch = q.match(coordRegex);

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
          q.match(/(?:lat|latitude)\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*[,/ ]+\s*(?:lon|long|longitude)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i) ||
          q.match(/(?:near|around|at|coordinates?|coords?)\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i) ||
          q.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);

        if (rawCoordMatch && !q.includes("year") && !q.includes("202")) {
          const lat = parseFloat(rawCoordMatch[1]);
          const lon = parseFloat(rawCoordMatch[2]);
          if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            parsedLat = lat;
            parsedLon = lon;
          }
        }
      }

      if (parsedLat !== null && parsedLon !== null) {
        const nearest = findNearestFloat(parsedLat, parsedLon);
        if (nearest) {
          targetFloat = nearest;
          isSpecificFloatQuery = true;
          isCoordinateSearch = true;
          searchedCoords = { lat: parsedLat, lon: parsedLon };
        }
      }
    }

    // 3. Depth extraction (with strict word boundaries so 'float' does not match 'at')
    let requestedDepth: number | null = null;
    const depthMatch =
      q.match(/\b(?:at|around)\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters|dbar)?\b/) ||
      q.match(/\bdepth\s*(?:of)?\s*(\d+(?:\.\d+)?)\b/) ||
      q.match(/\b(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\s*(?:depth)?\b/);
    if (depthMatch && !explicitFloatMatch) {
      requestedDepth = parseFloat(depthMatch[1]);
    }

    // 4. Truthful Rejection for Unphysical / Out-of-Bounds Depth (> 6000m)
    if (requestedDepth !== null && requestedDepth > 6000 && !explicitFloatMatch) {
      return NextResponse.json({
        responseText: `### Data Unavailable at ${requestedDepth}m Depth\n\nARGO autonomous profiling floats operate to standard mission depths of **2,000 meters** (with specialized Deep ARGO floats descending up to **6,000 meters**).\n\nNo physical CTD (Conductivity, Temperature, Depth) observations exist at **${requestedDepth} meters** in this dataset. Abyssal depths beyond 6,000m are outside the operational profiling envelope of the global ARGO array.`,
        focusOnFloat: false,
        mapActions: {
          shouldFlyTo: false,
          highlightVariable: "temperature",
          depthReach: 2000,
          isAnomaly: false,
        },
        telemetryMetrics: {
          avgTemp: 0,
          avgSalinity: 0,
          anomaly: "Out-of-Range Query Rejection",
          activeFloatCount: ARGO_FLOATS.length,
          basinName: "Global Ocean",
        },
      });
    }

    // 5. Conversational Banter / Greeting -> NEVER move the globe
    const isBanter =
      q === "hi" ||
      q === "hello" ||
      q.startsWith("hello ") ||
      q.startsWith("hey ") ||
      q === "hey" ||
      q.includes("who are you") ||
      q.includes("what can you do");

    if (isBanter) {
      return NextResponse.json({
        responseText:
          "Hello! I am **FloatChat AI**, your autonomous oceanographic telemetry assistant connected to 3,940 active ARGO floats worldwide.\n\nAsk me anything about real ocean telemetry:\n- **Geographic Navigation:** Ask *\"Bay of Bengal\"*, *\"Pacific Ocean\"*, *\"Japan\"*, or *\"10°N 80°E\"*\n- **Selected Float Analysis:** Ask *\"Tell me about Argo float 2901542\"* or *\"Where is this float located?\"*\n- **Ocean Concepts:** Ask *\"What is SST?\"*, *\"Explain thermoclines\"*, or *\"How do ARGO floats work?\"*\n- **Depth Profiles:** Ask *\"What is the temperature at 500m?\"*",
        focusOnFloat: false,
        mapActions: {
          shouldFlyTo: false,
          highlightVariable: "temperature",
          depthReach: 2000,
          isAnomaly: false,
        },
      });
    }

    // --- 5b. Broad location + parameter query detection ("Show salinity of Bay of Bengal") ---
    // This runs BEFORE the generic geo resolver to catch parameter-bearing location queries
    const oceanQuery = parseOceanQuery(q);
    if (oceanQuery && !oceanQuery.isArgoQuery) {
      const { region, parameter, depth, startYear, endYear, maxDepth } = oceanQuery;

      // Update session context
      const session = sessionStore.get(sessionId);
      if (session) {
        session.lastRegion = region;
        session.lastParameter = parameter;
        session.lastUpdated = Date.now();
      }

      const fourDRegion = mapToFourDRegion(region);
      const explorerCtx: ExplorerContext = {
        region: fourDRegion,
        parameter,
        timeRange: `${startYear} \u2013 ${endYear}`,
        depthRange: depth ? `0 \u2013 ${Math.max(depth, maxDepth)} m` : `0 \u2013 ${maxDepth} m`,
        startYear,
        endYear,
        maxDepth: depth ? Math.max(depth, maxDepth) : maxDepth,
      };

      // Resolve geographic coordinates
      const resolvedGeo = resolveLocationFromText(userQuery);
      const basinFloats = getFloatsByBasin(region);
      const nearbyFloats = basinFloats.length > 0 ? basinFloats : ARGO_FLOATS.filter((f) => {
        if (!resolvedGeo) return false;
        const dLat = f.latitude - resolvedGeo.latitude;
        const dLon = f.longitude - resolvedGeo.longitude;
        return Math.hypot(dLat, dLon) < 35.0;
      });
      const floatObj = selectedFloat || (nearbyFloats.length > 0 ? nearbyFloats[0] : ARGO_FLOATS[0]);

      const targetLat = resolvedGeo && !resolvedGeo.isFloat ? resolvedGeo.latitude : floatObj.latitude;
      const targetLon = resolvedGeo && !resolvedGeo.isFloat ? resolvedGeo.longitude : floatObj.longitude;
      const targetAlt = resolvedGeo && !resolvedGeo.isFloat ? resolvedGeo.zoomAltitude : 3500000.0;

      const paramLabel = parameter === "Salinity (PSU)" ? "salinity" : parameter === "Temperature (\u00b0C)" ? "temperature" : "pressure";
      const depthNote = depth ? ` at **${depth}m** depth` : "";
      const activeCount = nearbyFloats.length;
      const avgTemp = activeCount > 0 ? (nearbyFloats.reduce((acc, f) => acc + f.surfaceTemp, 0) / activeCount).toFixed(1) : "24.5";
      const avgSal = activeCount > 0 ? (nearbyFloats.reduce((acc, f) => acc + f.surfaceSalinity, 0) / activeCount).toFixed(1) : "34.8";

      let responseText = `### 4D Ocean Visualization \u2014 ${fourDRegion}\n\nNavigating to **${fourDRegion}** and activating the 4D ${paramLabel} visualization${depthNote}.\n\n- **Region:** ${fourDRegion}\n- **Parameter:** ${paramLabel.charAt(0).toUpperCase() + paramLabel.slice(1)}\n- **Active ARGO Floats:** ${activeCount} in region\n- **Mean Surface Temperature:** ${avgTemp}\u00b0C\n- **Mean Surface Salinity:** ${avgSal} PSU\n- **Time Range:** ${startYear} \u2013 ${endYear}\n- **Depth Range:** 0 \u2013 ${maxDepth}m\n\nExplore changes over time, depth, and space in the 4D Explorer panel.`;

      // Optional Gemini enhancement
      if (
        process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== "YOUR_API_KEY" &&
        process.env.GEMINI_API_KEY !== "AIzaSyYourActualKeyGoesHere"
      ) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const aiPrompt = `
            You are FloatChat's Oceanographic Telemetry Assistant.
            User asked: "${userQuery}"
            You are showing a 4D ${paramLabel} visualization for ${fourDRegion}${depthNote}.
            Active ARGO Floats in region: ${activeCount}, Avg Temp: ${avgTemp}\u00b0C, Avg Salinity: ${avgSal} PSU.
            Time range: ${startYear}-${endYear}, Depth range: 0-${maxDepth}m.

            Provide a concise, knowledgeable response about the ${paramLabel} conditions in ${fourDRegion}.
            Mention that the 3D Earth has navigated to this region and the 4D Explorer is now active.
            Use clean Markdown formatting.
          `;
          const aiResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: aiPrompt }] }],
          });
          if (aiResponse.text && aiResponse.text.trim().length > 40) {
            responseText = aiResponse.text.trim();
          }
        } catch (e) {
          console.warn("[FloatChat] Gemini 4D generation skipped:", e);
        }
      }

      return NextResponse.json({
        responseText,
        focusOnFloat: false,
        targetLocation: {
          latitude: targetLat,
          longitude: targetLon,
          regionName: fourDRegion,
          height: targetAlt,
        },
        mapActions: {
          shouldFlyTo: true,
          targetCoordinates: [targetLon, targetLat],
          highlightVariable: paramLabel === "salinity" ? "salinity" : "temperature",
          depthReach: depth || maxDepth,
          isAnomaly: false,
        },
        explorerContext: explorerCtx,
        telemetryMetrics: {
          avgTemp: parseFloat(avgTemp),
          avgSalinity: parseFloat(avgSal),
          anomaly: "4D Exploration Active",
          activeFloatCount: activeCount,
          basinName: fourDRegion,
        },
        chartData: floatObj.profiles,
      });
    }

    // 6. Universal Geographic Location Resolution (Oceans, Seas, Countries, Cities, Coordinates, Argo Floats)
    const resolvedGeo = resolveLocationFromText(userQuery);
    if (resolvedGeo) {
      if (resolvedGeo.isFloat && resolvedGeo.floatId) {
        const floatObj = getFloatById(resolvedGeo.floatId) || ARGO_FLOATS.find((f) => f.id === resolvedGeo.floatId || f.wmoId === resolvedGeo.wmoId);
        if (floatObj) {
          targetFloat = floatObj;
          isSpecificFloatQuery = true;
        }
      } else if (resolvedGeo.isCoordinate) {
        const nearest = findNearestFloat(resolvedGeo.latitude, resolvedGeo.longitude);
        const latStr = resolvedGeo.latitude >= 0 ? `${resolvedGeo.latitude.toFixed(2)}\u00b0N` : `${Math.abs(resolvedGeo.latitude).toFixed(2)}\u00b0S`;
        const lonStr = resolvedGeo.longitude >= 0 ? `${resolvedGeo.longitude.toFixed(2)}\u00b0E` : `${Math.abs(resolvedGeo.longitude).toFixed(2)}\u00b0W`;

        const nearbyInfo = nearest
          ? `\n\n**Nearest Active ARGO Float:**\n- **Float WMO:** #${nearest.wmoId} (${nearest.name})\n- **Basin:** ${nearest.basin}\n- **Coordinates:** ${nearest.latitude.toFixed(4)}\u00b0N, ${nearest.longitude.toFixed(4)}\u00b0E\n- **Surface Temp / Salinity:** ${nearest.surfaceTemp}\u00b0C / ${nearest.surfaceSalinity} PSU\n- **Last Profile Date:** ${nearest.lastProfileDate}`
          : "";

        return NextResponse.json({
          responseText: `### Geographic Target: ${resolvedGeo.name}\n\nThe 3D Earth has smoothly rotated to center on coordinates **${latStr}, ${lonStr}** with an optical focal point marker.${nearbyInfo}\n\nYou can click on any surrounding glowing float marker to inspect vertical CTD soundings.`,
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
        });
      } else {
        // Generic ocean, sea, country, city, island, or landmark
        // Also detect if user asked about a specific parameter
        const detectedParam = detectOceanParameter(q);
        const nearestFloats = ARGO_FLOATS.filter((f) => {
          const dLat = f.latitude - resolvedGeo.latitude;
          const dLon = f.longitude - resolvedGeo.longitude;
          return Math.hypot(dLat, dLon) < 35.0;
        });
        const activeCount = nearestFloats.length;
        const avgTemp = activeCount > 0 ? (nearestFloats.reduce((acc, f) => acc + f.surfaceTemp, 0) / activeCount).toFixed(1) : "24.5";
        const avgSal = activeCount > 0 ? (nearestFloats.reduce((acc, f) => acc + f.surfaceSalinity, 0) / activeCount).toFixed(1) : "34.8";

        // Update session context with the resolved region
        const session = sessionStore.get(sessionId);
        if (session) {
          session.lastRegion = mapToFourDRegion(resolvedGeo.name);
          if (detectedParam && detectedParam !== "argo") {
            session.lastParameter = detectedParam;
          }
          session.lastUpdated = Date.now();
        }

        // Build explorerContext if a parameter was detected
        let explorerCtx: ExplorerContext | undefined;
        if (detectedParam && detectedParam !== "argo") {
          const fourDRegion = mapToFourDRegion(resolvedGeo.name);
          explorerCtx = {
            region: fourDRegion,
            parameter: detectedParam,
            timeRange: "2020 \u2013 2025",
            depthRange: `0 \u2013 ${requestedDepth ? Math.max(requestedDepth, 2000) : 2000} m`,
            startYear: 2020,
            endYear: 2025,
            maxDepth: requestedDepth ? Math.max(requestedDepth, 2000) : 2000,
          };
        }

        let responseText = `### Geographic Focus: ${resolvedGeo.name}\n\nThe 3D globe has navigated to center **${resolvedGeo.name}** (${resolvedGeo.latitude.toFixed(2)}\u00b0, ${resolvedGeo.longitude.toFixed(2)}\u00b0) with a visual navigation target marker.\n\n- **Entity Type:** ${resolvedGeo.type.toUpperCase()}\n- **Active Regional ARGO Floats:** ${activeCount} floats within observation perimeter\n- **Mean Regional Surface Temperature:** ${avgTemp}\u00b0C\n- **Mean Regional Salinity:** ${avgSal} PSU`;

        // Optional Gemini enhancement for natural answers to questions like "What is the Bay of Bengal?"
        if (
          process.env.GEMINI_API_KEY &&
          process.env.GEMINI_API_KEY !== "YOUR_API_KEY" &&
          process.env.GEMINI_API_KEY !== "AIzaSyYourActualKeyGoesHere"
        ) {
          try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const aiPrompt = `
              You are FloatChat's Oceanographic Telemetry Assistant.
              User asked: "${userQuery}"
              Target Location: ${resolvedGeo.name} (${resolvedGeo.latitude}\u00b0N, ${resolvedGeo.longitude}\u00b0E, type: ${resolvedGeo.type})
              Active Regional Floats: ${activeCount}, Average Surface Temp: ${avgTemp}\u00b0C, Average Salinity: ${avgSal} PSU.

              Answer the user's question about this geographic location knowledgeably with clean Markdown bullet points.
              Mention that the 3D Earth has centered on this location.
            `;
            const aiResponse = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [{ role: "user", parts: [{ text: aiPrompt }] }],
            });
            if (aiResponse.text && aiResponse.text.trim().length > 40) {
              responseText = aiResponse.text.trim();
            }
          } catch (e) {
            console.warn("[FloatChat] Gemini location generation skipped:", e);
          }
        }

        return NextResponse.json({
          responseText,
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
            highlightVariable: detectedParam === "Salinity (PSU)" ? "salinity" : "temperature",
            depthReach: requestedDepth || 2000,
            isAnomaly: false,
          },
          ...(explorerCtx ? { explorerContext: explorerCtx } : {}),
          telemetryMetrics: {
            avgTemp: parseFloat(avgTemp),
            avgSalinity: parseFloat(avgSal),
            anomaly: explorerCtx ? "4D Exploration Active" : "Nominal Regional Baseline",
            activeFloatCount: activeCount,
            basinName: resolvedGeo.name,
          },
        });
      }
    }

    // 7. Reference to "this float", "the float", "its location", "where is this float", etc.
    const refersToSelectedFloat =
      q.includes("this float") ||
      q.includes("the float") ||
      q.includes("its location") ||
      q.includes("its temp") ||
      q.includes("its salinit") ||
      q.includes("its depth") ||
      q.includes("where is it") ||
      q.includes("where is this") ||
      q.includes("temperature of this") ||
      q.includes("salinity at this location") ||
      q.includes("salinity here") ||
      q.includes("temperature here") ||
      (selectedFloat && (
        q.includes("what is the temperature") ||
        q.includes("what is its temperature") ||
        q.includes("where is this float located") ||
        q.includes("what is the salinity") ||
        q.includes("show its profile") ||
        q.includes("analyze this specific argo float")
      ));

    if (!targetFloat && refersToSelectedFloat) {
      if (selectedFloat) {
        targetFloat = getFloatById(selectedFloat.wmoId || selectedFloat.id) || selectedFloat;
        isSpecificFloatQuery = true;
      } else {
        return NextResponse.json({
          responseText: `### No Float Currently Selected\n\nNo ARGO float is currently selected on the 3D globe.\n\nPlease click on any glowing float marker on the 3D globe or search for a float ID (e.g. *Float #2901542*) to inspect its live temperature, salinity, and depth profile.`,
          focusOnFloat: false,
          mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
        });
      }
    }

    // 6b. Follow-up queries: parameter-only or depth-only (e.g. "Now show temperature", "Show 1000m depth")
    if (!targetFloat) {
      const session = sessionStore.get(sessionId);
      const detectedParam = detectOceanParameter(q);
      const isParameterSwitch = detectedParam && detectedParam !== "argo" && session?.lastRegion;
      const isDepthOnly = requestedDepth !== null && !detectedParam && session?.lastRegion;
      const isShowOnly = /^\s*(show|display|switch|change)\s+(temperature|temp|salinity|sst|pressure)\s*$/i.test(q.trim());

      if ((isParameterSwitch || isDepthOnly || isShowOnly) && session?.lastRegion) {
        const fourDRegion = session.lastRegion;
        const param = (detectedParam && detectedParam !== "argo" ? detectedParam : session.lastParameter) || "Salinity (PSU)";
        const depth = requestedDepth;
        const maxDepth = depth ? Math.max(depth, 2000) : 2000;

        // Update session
        if (detectedParam && detectedParam !== "argo") {
          session.lastParameter = detectedParam;
        }
        session.lastUpdated = Date.now();

        const resolvedRegionGeo = resolveLocationFromText(fourDRegion);
        const basinFloats = getFloatsByBasin(fourDRegion);
        const floatObj = selectedFloat || (basinFloats.length > 0 ? basinFloats[0] : ARGO_FLOATS[0]);

        const targetLat = resolvedRegionGeo ? resolvedRegionGeo.latitude : floatObj.latitude;
        const targetLon = resolvedRegionGeo ? resolvedRegionGeo.longitude : floatObj.longitude;
        const targetAlt = resolvedRegionGeo ? resolvedRegionGeo.zoomAltitude : 3500000.0;

        const paramLabel = param === "Salinity (PSU)" ? "salinity" : param === "Temperature (\u00b0C)" ? "temperature" : "pressure";
        const depthNote = depth ? ` at **${depth}m** depth` : "";

        const explorerCtx: ExplorerContext = {
          region: fourDRegion,
          parameter: param,
          timeRange: "2020 \u2013 2025",
          depthRange: `0 \u2013 ${maxDepth} m`,
          startYear: 2020,
          endYear: 2025,
          maxDepth,
        };

        return NextResponse.json({
          responseText: `### Updated Visualization \u2014 ${fourDRegion}\n\nSwitching to **${paramLabel}**${depthNote} for **${fourDRegion}**.\n\nThe 4D Explorer has been updated with the new parameter. Continue exploring changes across time, depth, and space.`,
          focusOnFloat: false,
          targetLocation: {
            latitude: targetLat,
            longitude: targetLon,
            regionName: fourDRegion,
            height: targetAlt,
          },
          mapActions: {
            shouldFlyTo: true,
            targetCoordinates: [targetLon, targetLat],
            highlightVariable: paramLabel === "salinity" ? "salinity" : "temperature",
            depthReach: depth || maxDepth,
            isAnomaly: false,
          },
          explorerContext: explorerCtx,
          telemetryMetrics: {
            avgTemp: floatObj.surfaceTemp,
            avgSalinity: floatObj.surfaceSalinity,
            anomaly: "4D Exploration Active",
            activeFloatCount: basinFloats.length || 1,
            basinName: fourDRegion,
          },
          chartData: floatObj.profiles,
        });
      }
    }

    // 7. Check for Ocean Basin Mention (if no float explicitly selected yet)
    let basinMatch: string | null = null;
    if (!targetFloat) {
      if (q.includes("bengal") || q.includes("bob")) basinMatch = "Bay of Bengal";
      else if (q.includes("arabian")) basinMatch = "Arabian Sea";
      else if (q.includes("north atlantic") || q.includes("atlantic")) basinMatch = "North Atlantic";
      else if (q.includes("equatorial pacific")) basinMatch = "Equatorial Pacific";
      else if (q.includes("western tropical pacific") || q.includes("philippine")) basinMatch = "Western Tropical Pacific";
      else if (q.includes("southern ocean")) basinMatch = "Southern Ocean";
      else if (q.includes("mediterranean")) basinMatch = "Mediterranean Sea";
      else if (q.includes("arctic")) basinMatch = "Arctic Ocean";

      if (basinMatch) {
        const basinFloats = getFloatsByBasin(basinMatch);
        if (basinFloats.length > 0) {
          targetFloat = basinFloats[0];
          isSpecificFloatQuery = q.includes("float");
        }
      }
    }

    // 8. If Target Float Resolved -> Build Float-Specific Response
    if (targetFloat) {
      let questionType: "temperature" | "location" | "salinity" | "depth" | "thermocline" | "anomaly" | "overview" = "overview";
      if (q.includes("where") || q.includes("locat") || q.includes("position") || q.includes("coordinate")) {
        questionType = "location";
      } else if (q.includes("salinit") || q.includes("salt") || q.includes("psu") || q.includes("halocline")) {
        questionType = "salinity";
      } else if (q.includes("thermocline") || q.includes("gradient")) {
        questionType = "thermocline";
      } else if (q.includes("anomal") || q.includes("heatwave")) {
        questionType = "anomaly";
      } else if (q.includes("temp") || q.includes("thermal") || q.includes("warm") || q.includes("cold")) {
        questionType = "temperature";
      } else if (requestedDepth !== null) {
        questionType = "depth";
      }

      const response = buildFloatResponse(
        targetFloat,
        questionType,
        requestedDepth,
        isSpecificFloatQuery,
        isCoordinateSearch,
        searchedCoords
      );

      // Optional Gemini enhancement for rich formatting
      if (
        process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== "YOUR_API_KEY" &&
        process.env.GEMINI_API_KEY !== "AIzaSyYourActualKeyGoesHere"
      ) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const aiPrompt = `
            You are FloatChat's Oceanographic Telemetry Assistant.
            User asked: "${userQuery}"

            REAL VERIFIED TELEMETRY FOR TARGET FLOAT:
            - Float WMO ID: #${targetFloat.wmoId} (${targetFloat.name})
            - Basin: ${targetFloat.basin}
            - Coordinates: ${targetFloat.latitude.toFixed(4)}°N, ${targetFloat.longitude.toFixed(4)}°E
            - Surface Temp: ${targetFloat.surfaceTemp}°C
            - Surface Salinity: ${targetFloat.surfaceSalinity} PSU
            - Max Depth: ${targetFloat.maxDepth}m
            - Cycle Number: #${targetFloat.cycleNumber} (${targetFloat.status.toUpperCase()})
            - Institution: ${targetFloat.institution} (${targetFloat.country})
            - Last Profile Date: ${targetFloat.lastProfileDate}
            ${requestedDepth !== null ? `- Requested Depth: ${requestedDepth}m` : ""}
            ${history.length > 0 ? `\nRecent conversation context:\n${history.slice(-4).map((h) => `${h.role || "user"}: ${h.text || h.content}`).join("\n")}` : ""}

            Answer ONLY the user's specific question using these exact numbers.
            DO NOT invent other numbers or floats. Use clean Markdown bullet points.
          `;
          const aiResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: aiPrompt }] }],
          });
          if (aiResponse.text && aiResponse.text.trim().length > 40) {
            response.responseText = aiResponse.text.trim();
          }
        } catch (e) {
          console.warn("[FloatChat] Gemini generation skipped:", e);
        }
      }

      return NextResponse.json(response);
    }

    // 9. Handle General Oceanographic Science Questions (SST, Thermocline, Halocline, ARGO Cycle) -> NEVER move globe
    if (q === "what is sst" || q.includes("what is sst") || q.includes("sea surface temperature")) {
      return NextResponse.json({
        responseText:
          "### Sea Surface Temperature (SST)\n\n**Sea Surface Temperature (SST)** is the water temperature measured close to the ocean's surface (typically within the upper few meters).\n\n- **Scientific Significance:** SST is a primary driver of global weather systems, atmospheric circulation, monsoons, and tropical cyclone genesis.\n- **Measurement Methods:** Measured by satellite infrared/microwave radiometers and in-situ ARGO profiling floats during their surface intervals.\n- **Climatological Range:** Ranges from -1.8°C in polar regions to over 30°C in equatorial warm pools (e.g., Western Pacific and Bay of Bengal).\n\nYou can select any ARGO float on the 3D globe to view its real-time surface temperature observation.",
        focusOnFloat: false,
        mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
      });
    }

    if (q.includes("thermocline")) {
      return NextResponse.json({
        responseText:
          "### Thermocline Dynamics\n\nThe **thermocline** is the oceanic layer in which water temperature decreases rapidly with increasing depth, separating the warm upper mixed layer from the cold deep ocean.\n\n- **Vertical Structure:** In tropical and subtropical oceans, the permanent thermocline typically extends between **100m and 500m** depth.\n- **Temperature Gradient:** Gradients can exceed **-0.4°C per meter**, creating a strong thermal density barrier that restricts vertical mixing.\n- **ARGO CTD Observation:** ARGO floats record vertical temperature profiles every 10 days, allowing precise tracking of thermocline depth shifts and internal waves.",
        focusOnFloat: false,
        mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
      });
    }

    if (q.includes("halocline")) {
      return NextResponse.json({
        responseText:
          "### Halocline Dynamics\n\nA **halocline** is a vertical zone in the oceanic water column where salinity changes rapidly with depth.\n\n- **Role in Stratification:** Because salinity strongly affects water density, a sharp halocline creates pronounced density stratification (pycnocline), even when temperatures are uniform.\n- **Regional Examples:** The Bay of Bengal has a pronounced shallow halocline due to massive monsoon river discharge, while the Arctic Ocean has a cold, low-salinity halocline layer insulating surface ice from warmer deep Atlantic waters.",
        focusOnFloat: false,
        mapActions: { shouldFlyTo: false, highlightVariable: "salinity", depthReach: 2000, isAnomaly: false },
      });
    }

    // Check knowledge topics in OCEAN_KNOWLEDGE (e.g. "Explain Argo floats", "How ARGO floats work") -> NEVER move globe
    const matchedTopic = OCEAN_KNOWLEDGE.find((topic) =>
      topic.keywords.some((kw) => q.includes(kw))
    );

    if (matchedTopic) {
      return NextResponse.json({
        responseText: `### ${matchedTopic.title}\n\n${matchedTopic.summary}\n\n${matchedTopic.details}`,
        focusOnFloat: false,
        mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
      });
    }

    // 10. General Fallback Telemetry Insight -> NEVER move globe
    return NextResponse.json({
      responseText: `### FloatChat Ocean Telemetry Insight\n\nI analyzed your query: *"_${userQuery}_"*\n\nAcross the global network of **3,940 active ARGO floats**, ocean telemetry indicates stable thermal stratification in tropical upper layers, with active deep ocean profile cycles reaching up to 6,000 meters depth.\n\nYou can ask specific questions like:\n- *\"Tell me about Argo float 2901542\"*\n- *\"Show me the Argo float near 10°N, 80°E\"*\n- *\"Where is this float located?\"*\n- *\"What is SST?\"*`,
      focusOnFloat: false,
      mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[FloatChat] Error in /api/chat:", errorMsg);

    return NextResponse.json(
      {
        responseText: `### Telemetry Processing Notice\n\nUnable to process query: *"_${userQuery}_"*\n\n**Reason:** ${errorMsg}.\n\nPlease try again or select an ARGO float on the 3D globe.`,
        error: errorMsg,
        focusOnFloat: false,
        mapActions: { shouldFlyTo: false, highlightVariable: "temperature", depthReach: 2000, isAnomaly: false },
      },
      { status: 500 }
    );
  }
}
