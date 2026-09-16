import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { SemanticQueryResponse, MapActions } from "@/types/globe";
import { ARGO_FLOATS, getFloatsByBasin } from "@/data/argoFloats";

// Intelligent fallback generator matching real world ocean geography
function getMockOceanographicResponse(query: string): SemanticQueryResponse {
  const cleanQuery = (query || "").toLowerCase().trim();

  // 1. DYNAMIC CHAT BANTER HANDLER: Catches casual queries & questions about capabilities
  if (
    cleanQuery.startsWith("hey") ||
    cleanQuery.startsWith("hi") ||
    cleanQuery.startsWith("hello") ||
    cleanQuery.includes("help") ||
    cleanQuery.includes("what data") ||
    cleanQuery.includes("can u") ||
    cleanQuery.includes("can you") ||
    cleanQuery.includes("who are you") ||
    cleanQuery.includes("what can you") ||
    cleanQuery === "what do you do"
  ) {
    return {
      responseText: "I can process diverse parameters across global telemetry layers! Try asking me specifically to 'Analyze Bay of Bengal salinity profiles' or 'Check North Atlantic anomalies' to see my automated camera tracking and NetCDF coordinate parser in action.",
      mapActions: {
        shouldFlyTo: false,               // Do not move the camera during chat banter
        targetCoordinates: [0, 0],
        highlightVariable: "temperature", // Hold nominal visual state
        depthReach: 0,
        isAnomaly: false,
      },
    };
  }

  // 2. Specialized Basin Interceptors
  let responseText = "";
  let mapActions: MapActions;
  let detectedRegion = "Arabian Sea";
  let targetFloatId: number = ARGO_FLOATS[0].id;

  if (cleanQuery.includes("bengal") || cleanQuery.includes("bay") || cleanQuery.includes("bob")) {
    detectedRegion = "Bay of Bengal";
    const floats = getFloatsByBasin(detectedRegion);
    targetFloatId = floats.length > 0 ? floats[0].id : 2901542;
    responseText = "Parsing NetCDF layer for ARGO float profiling array. Significant low-salinity signature detected in the upper 1,500m of the Bay of Bengal, highly consistent with localized freshwater monsoonal discharge tracking across spatial coordinates.";
    mapActions = {
      shouldFlyTo: true,
      targetCoordinates: [88.5, 15.2],
      highlightVariable: "salinity",
      depthReach: 1500,
      isAnomaly: true,
    };
  } else if (cleanQuery.includes("atlantic") || cleanQuery.includes("north atlantic")) {
    detectedRegion = "North Atlantic";
    const floats = getFloatsByBasin(detectedRegion);
    targetFloatId = floats.length > 0 ? floats[0].id : 6903820;
    responseText = "Retrieving spatial-temporal profiles for the North Atlantic gyre. High-pressure telemetry matches sub-surface thermal anomalies tracking along structural thermocline boundaries between 500m and 2,000m reach.";
    mapActions = {
      shouldFlyTo: true,
      targetCoordinates: [-40.0, 38.0],
      highlightVariable: "anomalies",
      depthReach: 2000,
      isAnomaly: true,
    };
  } else {
    // Standard Default Basin Profile
    detectedRegion = "Arabian Sea";
    const floats = getFloatsByBasin(detectedRegion);
    targetFloatId = floats.length > 0 ? floats[0].id : 2901543;
    responseText = "Scanning active ARGO telemetry metrics. Spatial profiles indicate normal sea surface temperature balances down across standard hydrodynamic columns, tracking standard spatio-temporal baselines.";
    mapActions = {
      shouldFlyTo: true,
      targetCoordinates: [65.0, 16.5],
      highlightVariable: "temperature",
      depthReach: 1000,
      isAnomaly: false,
    };
  }

  const sampleFloat = ARGO_FLOATS.find((f) => f.id === targetFloatId) || ARGO_FLOATS[0];

  return {
    responseText,
    mapActions,
    targetFloatId: sampleFloat.id,
    targetLocation: {
      latitude: mapActions.targetCoordinates[1],
      longitude: mapActions.targetCoordinates[0],
      regionName: detectedRegion,
      wmoId: sampleFloat.wmoId,
    },
    explorerContext: {
      region: detectedRegion,
      parameter: mapActions.highlightVariable === "temperature" ? "Temperature (°C)" : "Salinity (PSU)",
      timeRange: "2020 – 2025",
      depthRange: `0 – ${mapActions.depthReach}m`,
      startYear: 2020,
      endYear: 2025,
      maxDepth: mapActions.depthReach,
    },
    telemetryMetrics: {
      avgTemp: sampleFloat.surfaceTemp || 28.5,
      avgSalinity: sampleFloat.surfaceSalinity || 34.2,
      anomaly: mapActions.isAnomaly ? "Active Marine Heatwave / Anomaly" : "Nominal Hydrographic Telemetry",
      activeFloatCount: getFloatsByBasin(detectedRegion).length || 3940,
      basinName: detectedRegion,
    },
    chartData: sampleFloat.profiles,
  };
}

export async function POST(req: Request) {
  let userQuery = "";
  try {
    const payload = await req.json();
    // Catch every possible field coming from frontend search bars
    userQuery = payload.message || payload.prompt || payload.query || "";

    // If key is missing entirely or placeholder, cleanly invoke our smarter mock matrix
    if (
      !process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY === "YOUR_API_KEY" ||
      process.env.GEMINI_API_KEY === "AIzaSyYourActualKeyGoesHere"
    ) {
      return NextResponse.json(getMockOceanographicResponse(userQuery));
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `
      You are ORION-PS-01: FloatChat, an advanced full-stack multi-modal semantic query engine for ARGO oceanographic data.
      Analyze the incoming prompt. If it is simple chatter, answer helpfully as a marine AI assistant and set shouldFlyTo to false.
      If it is a telemetry request, convert it into a strict JSON payload using this exact structure:
      {
        "responseText": "Your specialized ocean science description.",
        "mapActions": {
          "shouldFlyTo": true or false,
          "targetCoordinates": [longitude, latitude],
          "highlightVariable": "salinity" | "temperature" | "anomalies",
          "depthReach": number up to 2000,
          "isAnomaly": true or false
        }
      }

      Geospatial Coordinates Reference:
      - Bay of Bengal: [88.5, 15.2]
      - Arabian Sea: [65.0, 16.5]
      - North Atlantic: [-40.0, 38.0]
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "system", parts: [{ text: systemInstruction }] },
        { role: "user", parts: [{ text: userQuery }] }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed: SemanticQueryResponse = JSON.parse(response.text || "{}");

    // Enrich with fallback UI contexts if needed
    const fallback = getMockOceanographicResponse(userQuery);
    const enrichedResponse: SemanticQueryResponse = {
      responseText: parsed.responseText || fallback.responseText,
      mapActions: {
        shouldFlyTo: Boolean(parsed.mapActions?.shouldFlyTo),
        targetCoordinates: Array.isArray(parsed.mapActions?.targetCoordinates)
          ? parsed.mapActions.targetCoordinates
          : fallback.mapActions.targetCoordinates,
        highlightVariable: parsed.mapActions?.highlightVariable || fallback.mapActions.highlightVariable,
        depthReach: parsed.mapActions?.depthReach ?? fallback.mapActions.depthReach,
        isAnomaly: Boolean(parsed.mapActions?.isAnomaly),
      },
      targetFloatId: fallback.targetFloatId,
      targetLocation: fallback.targetLocation,
      explorerContext: fallback.explorerContext,
      telemetryMetrics: fallback.telemetryMetrics,
      chartData: fallback.chartData,
    };

    return NextResponse.json(enrichedResponse);

  } catch (error) {
    console.error("Gemini runtime exception, falling back to local processing loops:", error);
    return NextResponse.json(getMockOceanographicResponse(userQuery));
  }
}
