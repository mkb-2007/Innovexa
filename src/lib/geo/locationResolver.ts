import { GEOGRAPHIC_LOCATIONS, GeographicLocation } from "@/data/geographicLocations";
import { ARGO_FLOATS, getFloatById, findNearestFloat } from "@/data/argoFloats";
import type { ArgoFloat } from "@/types/globe";

export interface ResolvedLocation {
  name: string;
  latitude: number;
  longitude: number;
  zoomAltitude: number;
  type: "ocean" | "sea" | "country" | "city" | "landmark" | "coordinate" | "float";
  floatId?: number;
  wmoId?: number;
  rawQuery?: string;
  isCoordinate?: boolean;
  isFloat?: boolean;
}

/**
 * Normalizes longitude to standard range [-180, 180]
 */
export function normalizeLongitude(lon: number): number {
  let norm = ((lon + 180) % 360 + 360) % 360 - 180;
  if (norm === -180 && lon > 0) norm = 180;
  return parseFloat(norm.toFixed(6));
}

/**
 * Clamps latitude to [-89.999, 89.999] to prevent mathematical singularities at the poles
 */
export function clampLatitude(lat: number): number {
  return parseFloat(Math.max(-89.999, Math.min(89.999, lat)).toFixed(6));
}

/**
 * Format coordinates into standard navigation representation
 */
export function formatCoordinateString(lat: number, lon: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${latDir} ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}

/**
 * Parse coordinates from natural language string
 * Supports:
 * - 10°N 80°E, 10 N 80 E, 10N 80E, 10° S, 80° W
 * - 10°N 150°W, 20°N 40°W, 30°S 20°W, 70°N 30°E, 60°S 100°E
 * - 10°N 179°E, 10°N 179°W
 * - 0° 0°, 0 0, 0, 0, 10,-80, 10, -80
 * - lat: 10, lon: 80
 */
export function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const trimmed = text.trim();

  // Pattern 1: Directional with N/S and E/W (e.g. 10°N 80°E, 10 N 80 E, 10N 80E, 10° S, 80° W, 10S 80W)
  const dirPattern1 = /(?:^|[^\w.-])([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSns])\b[,\s/]*([+-]?\d+(?:\.\d+)?)\s*°?\s*([EWew])\b/;
  const m1 = trimmed.match(dirPattern1);
  if (m1) {
    let lat = parseFloat(m1[1]);
    const latDir = m1[2].toUpperCase();
    if (latDir === "S" && lat > 0) lat = -lat;

    let lon = parseFloat(m1[3]);
    const lonDir = m1[4].toUpperCase();
    if (lonDir === "W" && lon > 0) lon = -lon;

    return {
      latitude: clampLatitude(lat),
      longitude: normalizeLongitude(lon),
    };
  }

  // Pattern 2: Reversed directional (e.g. 80°E 10°N)
  const dirPattern2 = /(?:^|[^\w.-])([+-]?\d+(?:\.\d+)?)\s*°?\s*([EWew])\b[,\s/]*([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSns])\b/;
  const m2 = trimmed.match(dirPattern2);
  if (m2) {
    let lon = parseFloat(m2[1]);
    const lonDir = m2[2].toUpperCase();
    if (lonDir === "W" && lon > 0) lon = -lon;

    let lat = parseFloat(m2[3]);
    const latDir = m2[4].toUpperCase();
    if (latDir === "S" && lat > 0) lat = -lat;

    return {
      latitude: clampLatitude(lat),
      longitude: normalizeLongitude(lon),
    };
  }

  // Pattern 3: Degrees symbol pair (e.g. 0° 0°, 10° 80°, 10° -80°, 0°0°)
  const degPattern = /(?:^|[^\w.-])([+-]?\d+(?:\.\d+)?)\s*°\s*[,/ ]+\s*([+-]?\d+(?:\.\d+)?)\s*°(?!\w)/;
  const m3 = trimmed.match(degPattern);
  if (m3) {
    const lat = parseFloat(m3[1]);
    const lon = parseFloat(m3[2]);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 360) {
      return {
        latitude: clampLatitude(lat),
        longitude: normalizeLongitude(lon),
      };
    }
  }

  // Pattern 4: Explicit labeled coordinates (e.g. lat: 10, lon: -80 or latitude 10 longitude -80)
  const labeledPattern = /(?:lat(?:itude)?\s*[:=]?\s*)([+-]?\d+(?:\.\d+)?)\s*[,/ ]+\s*(?:lon(?:gitude)?\s*[:=]?\s*)([+-]?\d+(?:\.\d+)?)/i;
  const m4 = trimmed.match(labeledPattern);
  if (m4) {
    const lat = parseFloat(m4[1]);
    const lon = parseFloat(m4[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      return {
        latitude: clampLatitude(lat),
        longitude: normalizeLongitude(lon),
      };
    }
  }

  // Pattern 5: Comma-separated or whitespace numeric pair (e.g. "10,-80", "10, -80", "0, 0", "0,0")
  const commaPairPattern = /(?:^|[^\w.-])([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)(?:[^\w.-]|$)/;
  const m5 = trimmed.match(commaPairPattern);
  if (m5) {
    const lat = parseFloat(m5[1]);
    const lon = parseFloat(m5[2]);
    // Ignore year pairs like "2020, 2025"
    if (!isNaN(lat) && !isNaN(lon) && (lat < 1900 && lon < 1900) && Math.abs(lat) <= 90 && Math.abs(lon) <= 360) {
      return {
        latitude: clampLatitude(lat),
        longitude: normalizeLongitude(lon),
      };
    }
  }

  // Pattern 6: Pure coordinate input like "0 0" or "10 -80" when query consists mostly of coordinates
  const pureNumericMatch = trimmed.match(/^(?:go\s+to\s+|show\s+|center\s+)?([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)$/i);
  if (pureNumericMatch) {
    const lat = parseFloat(pureNumericMatch[1]);
    const lon = parseFloat(pureNumericMatch[2]);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 360) {
      return {
        latitude: clampLatitude(lat),
        longitude: normalizeLongitude(lon),
      };
    }
  }

  return null;
}

/**
 * Identify if query is purely general ocean science/banter without any geographic focus
 */
export function isGeneralNonGeographicQuery(text: string): boolean {
  const q = text.toLowerCase().trim();

  // Greetings / conversational banter
  const banter = [
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "who are you", "what can you do", "help", "how are you", "what are you",
  ];
  if (banter.includes(q)) return true;

  // General concept definitions without regional focus
  const pureConcepts = [
    "what is an argo float", "what is argo float", "what are argo floats", "how do argo floats work",
    "what is salinity", "explain salinity", "what is psu", "how is salinity measured",
    "what is sst", "explain sst", "what is sea surface temperature", "sea surface temperature",
    "what is a thermocline", "what is thermocline", "explain thermocline", "thermocline dynamics",
    "what is a halocline", "what is halocline", "explain halocline", "halocline dynamics",
    "how does ocean circulation work", "ocean circulation", "what are ocean currents",
    "how deep is the ocean", "what is ctd", "what is practical salinity unit",
  ];
  if (pureConcepts.includes(q)) return true;

  // Question starts with general concept and contains no place names or coordinates
  if (
    (q.startsWith("what is an argo") || q.startsWith("how do argo") || q === "what is salinity" || q === "what is sst") &&
    !hasAnyGeographicKeywords(q)
  ) {
    return true;
  }

  return false;
}

/**
 * Check if text contains any geographic keywords
 */
function hasAnyGeographicKeywords(text: string): boolean {
  const q = text.toLowerCase();
  for (const loc of GEOGRAPHIC_LOCATIONS) {
    if (loc.aliases.some((a) => q.includes(a))) return true;
  }
  return false;
}

/**
 * Comprehensive natural language location resolver:
 * Evaluates queries for coordinates, Argo floats, oceans, seas, countries, cities, and landmarks.
 */
export function resolveLocationFromText(query: string): ResolvedLocation | null {
  const trimmed = query.trim();
  const q = trimmed.toLowerCase();

  // 1. Guard against purely general questions
  if (isGeneralNonGeographicQuery(q)) {
    return null;
  }

  // 2. Check for explicit Argo Float ID (e.g. "Argo float 2901234", "float 2901542", "#2901542")
  const explicitFloatMatch =
    q.match(/\b(?:argo\s+float|float)\s*#?\s*(\d{5,7})\b/i) ||
    q.match(/#(\d{5,7})\b/) ||
    q.match(/\b(\d{7})\b/);

  if (explicitFloatMatch) {
    const floatId = parseInt(explicitFloatMatch[1], 10);
    const floatObj = getFloatById(floatId);
    if (floatObj) {
      return {
        name: `Argo Float #${floatObj.wmoId}`,
        latitude: floatObj.latitude,
        longitude: floatObj.longitude,
        zoomAltitude: 3500000.0,
        type: "float",
        floatId: floatObj.id,
        wmoId: floatObj.wmoId,
        rawQuery: trimmed,
        isFloat: true,
      };
    }
  }

  // 3. Check for Coordinate inputs (e.g. "10°N 80°E", "10 N 80 E", "10,-80", "0° 0°")
  const parsedCoords = parseCoordinates(trimmed);
  if (parsedCoords) {
    // If the query also mentions "Argo float near" or "float around", find nearest float
    if (q.includes("float") || q.includes("argo")) {
      const nearest = findNearestFloat(parsedCoords.latitude, parsedCoords.longitude);
      if (nearest) {
        return {
          name: `Argo Float #${nearest.wmoId} (Near ${formatCoordinateString(parsedCoords.latitude, parsedCoords.longitude)})`,
          latitude: nearest.latitude,
          longitude: nearest.longitude,
          zoomAltitude: 3500000.0,
          type: "float",
          floatId: nearest.id,
          wmoId: nearest.wmoId,
          rawQuery: trimmed,
          isFloat: true,
        };
      }
    }

    const coordStr = formatCoordinateString(parsedCoords.latitude, parsedCoords.longitude);
    return {
      name: coordStr,
      latitude: parsedCoords.latitude,
      longitude: parsedCoords.longitude,
      zoomAltitude: 2800000.0,
      type: "coordinate",
      rawQuery: trimmed,
      isCoordinate: true,
    };
  }

  // 4. Check for "Argo float near <Place>" (e.g. "Show me the Argo float near Australia")
  const floatNearMatch = q.match(/(?:argo\s+float|float)\s+(?:near|around|in|off|by)\s+([a-z\s]+)/i);
  if (floatNearMatch) {
    const placePart = floatNearMatch[1].trim();
    // Resolve placePart
    const matchedLoc = findLocationInDictionary(placePart);
    if (matchedLoc) {
      const nearest = findNearestFloat(matchedLoc.latitude, matchedLoc.longitude);
      if (nearest) {
        return {
          name: `Argo Float #${nearest.wmoId} (${matchedLoc.name})`,
          latitude: nearest.latitude,
          longitude: nearest.longitude,
          zoomAltitude: 3500000.0,
          type: "float",
          floatId: nearest.id,
          wmoId: nearest.wmoId,
          rawQuery: trimmed,
          isFloat: true,
        };
      }
    }
  }

  // 5. Match from centralized Geographic Locations dictionary
  const matchedLocation = findLocationInDictionary(q);
  if (matchedLocation) {
    return {
      name: matchedLocation.name,
      latitude: matchedLocation.latitude,
      longitude: matchedLocation.longitude,
      zoomAltitude: matchedLocation.zoomAltitude,
      type: matchedLocation.type,
      rawQuery: trimmed,
    };
  }

  return null;
}

/**
 * Finds best matching location from GEOGRAPHIC_LOCATIONS
 * Sorts by alias length descending to match more specific multi-word locations first (e.g. "North Pacific Ocean" before "Pacific")
 */
function findLocationInDictionary(queryLower: string): GeographicLocation | null {
  // Sort aliases by length descending
  const candidates: { location: GeographicLocation; alias: string; priority: number }[] = [];

  for (const loc of GEOGRAPHIC_LOCATIONS) {
    for (const alias of loc.aliases) {
      const aliasLower = alias.toLowerCase();
      // Match as word boundary or exact phrase
      const escaped = aliasLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");

      if (regex.test(queryLower)) {
        candidates.push({
          location: loc,
          alias: aliasLower,
          priority: aliasLower.length,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Pick the longest matching alias
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0].location;
}
