import { ARGO_FLOATS, getFloatById, getFloatsByBasin } from "@/data/argoFloats";
import { OCEAN_KNOWLEDGE } from "@/data/oceanKnowledge";
import type { ChatMessage, GeoLocation, ExplorerContext } from "@/types/globe";

// --- 4D / Historical query detection ---

interface FourDQueryMatch {
  region: string;
  parameter: "Salinity (PSU)" | "Temperature (°C)";
  startYear: number;
  endYear: number;
  maxDepth: number;
}

const REGION_KEYWORDS: Record<string, string> = {
  "bay of bengal": "Bay of Bengal",
  "bob": "Bay of Bengal",
  "north atlantic": "North Atlantic",
  "atlantic": "North Atlantic",
  "south pacific": "South Pacific",
  "pacific": "South Pacific",
  "indian ocean": "Indian Ocean",
  "arctic": "Arctic Ocean",
  "southern ocean": "Southern Ocean",
  "arabian sea": "Indian Ocean",
  "global": "Bay of Bengal",
};

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

export function processUserQuery(userQuery: string): ChatMessage {
  const queryLower = userQuery.toLowerCase().trim();

  // --- Check for 4D / historical queries FIRST ---
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

    // Find a relevant float for navigation
    const basinFloats = getFloatsByBasin(region);
    const floatObj = basinFloats.length > 0 ? basinFloats[0] : ARGO_FLOATS[0];

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
      text: `Got it! 🌊\n\nHere's the 4D visualization of ${region} ${paramLabel} from ${startYear} to ${endYear}. You can explore changes over time and depth.`,
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

  // 1. Search for matching topic in OCEAN_KNOWLEDGE
  const matchedTopic = OCEAN_KNOWLEDGE.find((topic) =>
    topic.keywords.some((kw) => queryLower.includes(kw))
  );

  if (matchedTopic) {
    const floatObj = matchedTopic.sampleFloatId
      ? getFloatById(matchedTopic.sampleFloatId)
      : ARGO_FLOATS[0];

    const targetLoc: GeoLocation | undefined = floatObj
      ? {
          latitude: floatObj.latitude,
          longitude: floatObj.longitude,
          regionName: floatObj.basin,
          wmoId: floatObj.wmoId,
        }
      : undefined;

    return {
      id: `msg-${Date.now()}`,
      sender: "assistant",
      text: `### ${matchedTopic.title}\n\n${matchedTopic.summary}\n\n${matchedTopic.details}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      targetFloatId: floatObj?.id,
      targetLocation: targetLoc,
      telemetryMetrics: {
        avgTemp: matchedTopic.avgTemp || floatObj?.surfaceTemp || 28.5,
        avgSalinity: matchedTopic.avgSalinity || floatObj?.surfaceSalinity || 34.5,
        anomaly: matchedTopic.anomalyText || "Active Hydrodynamic Sampling",
        activeFloatCount: getFloatsByBasin(matchedTopic.suggestedBasin || "Global Ocean").length,
        basinName: matchedTopic.suggestedBasin || floatObj?.basin || "Global Ocean",
      },
      chartData: floatObj?.profiles || ARGO_FLOATS[0].profiles,
    };
  }

  // 2. Check for numeric WMO ID search
  const wmoMatch = userQuery.match(/\d{7}/);
  if (wmoMatch) {
    const wmoId = parseInt(wmoMatch[0], 10);
    const floatObj = getFloatById(wmoId);
    if (floatObj) {
      return {
        id: `msg-${Date.now()}`,
        sender: "assistant",
        text: `### ARGO Float WMO #${floatObj.wmoId} (${floatObj.name})\n\nLocated in the **${floatObj.basin}** at coordinates **${floatObj.latitude}°N, ${floatObj.longitude}°E**.\n\n- **Status:** ${floatObj.status.toUpperCase()}\n- **Cycle Number:** ${floatObj.cycleNumber}\n- **Surface Temp:** ${floatObj.surfaceTemp}°C\n- **Surface Salinity:** ${floatObj.surfaceSalinity} PSU\n- **Max Reach:** ${floatObj.maxDepth} meters\n- **Institution:** ${floatObj.institution} (${floatObj.country})`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
  }

  // 3. Fallback intelligent response for general ocean questions
  const defaultFloat = ARGO_FLOATS[Math.floor(Math.random() * ARGO_FLOATS.length)];
  return {
    id: `msg-${Date.now()}`,
    sender: "assistant",
    text: `### FloatChat Ocean Telemetry Insight\n\nI analyzed your query: *"_${userQuery}_"*\n\nAcross the global network of **3,940 active ARGO floats**, ocean telemetry indicates stable thermal stratification in tropical upper layers, with active deep ocean profile cycles reaching up to 6,000 meters depth.\n\nYou can click on any glowing ARGO float pin on the 3D Earth or select suggestions like **Bay of Bengal**, **Temperature anomalies**, or **Deep ocean salinity** for detailed profiles.`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    targetFloatId: defaultFloat.id,
    targetLocation: {
      latitude: defaultFloat.latitude,
      longitude: defaultFloat.longitude,
      regionName: defaultFloat.basin,
      wmoId: defaultFloat.wmoId,
    },
    telemetryMetrics: {
      avgTemp: defaultFloat.surfaceTemp,
      avgSalinity: defaultFloat.surfaceSalinity,
      anomaly: "Global Telemetry Synchronized",
      activeFloatCount: ARGO_FLOATS.length,
      basinName: defaultFloat.basin,
    },
    chartData: defaultFloat.profiles,
  };
}
