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
