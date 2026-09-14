/**
 * Procedural 4D Ocean Data Generator
 * Generates realistic-looking oceanographic data grids for the 4D Ocean Explorer.
 * All data is deterministic (seeded) for reproducibility.
 */

// --- Deterministic seeded PRNG ---
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// --- Region-specific base parameters ---
interface RegionProfile {
  baseSSTMin: number;
  baseSSTMax: number;
  baseSalinityMin: number;
  baseSalinityMax: number;
  thermoclineDepth: number;
  haloclineDepth: number;
  seasonalAmplitude: number;
  seed: number;
}

const REGION_PROFILES: Record<string, RegionProfile> = {
  "Bay of Bengal": {
    baseSSTMin: 26.5, baseSSTMax: 30.5,
    baseSalinityMin: 31.5, baseSalinityMax: 35.2,
    thermoclineDepth: 80, haloclineDepth: 50,
    seasonalAmplitude: 2.5, seed: 42,
  },
  "North Atlantic": {
    baseSSTMin: 8.0, baseSSTMax: 24.0,
    baseSalinityMin: 34.5, baseSalinityMax: 36.8,
    thermoclineDepth: 100, haloclineDepth: 120,
    seasonalAmplitude: 8.0, seed: 137,
  },
  "South Pacific": {
    baseSSTMin: 18.0, baseSSTMax: 28.0,
    baseSalinityMin: 34.0, baseSalinityMax: 36.2,
    thermoclineDepth: 120, haloclineDepth: 100,
    seasonalAmplitude: 4.0, seed: 271,
  },
  "Indian Ocean": {
    baseSSTMin: 24.0, baseSSTMax: 30.0,
    baseSalinityMin: 33.5, baseSalinityMax: 36.0,
    thermoclineDepth: 90, haloclineDepth: 60,
    seasonalAmplitude: 3.0, seed: 314,
  },
  "Arctic Ocean": {
    baseSSTMin: -1.8, baseSSTMax: 6.0,
    baseSalinityMin: 28.0, baseSalinityMax: 35.0,
    thermoclineDepth: 40, haloclineDepth: 30,
    seasonalAmplitude: 5.0, seed: 501,
  },
  "Southern Ocean": {
    baseSSTMin: -1.5, baseSSTMax: 8.0,
    baseSalinityMin: 33.8, baseSalinityMax: 35.0,
    thermoclineDepth: 60, haloclineDepth: 80,
    seasonalAmplitude: 3.5, seed: 607,
  },
};

function getRegionProfile(region: string): RegionProfile {
  if (REGION_PROFILES[region]) return REGION_PROFILES[region];
  const lower = region.toLowerCase();
  for (const [key, profile] of Object.entries(REGION_PROFILES)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return profile;
    }
  }
  return REGION_PROFILES["Bay of Bengal"];
}

// --- 4D Grid Data Point ---
export interface FourDDataPoint {
  year: number;
  month: number;
  depth: number;
  temperature: number;
  salinity: number;
}

export interface FourDGrid {
  region: string;
  parameter: "Salinity (PSU)" | "Temperature (°C)";
  years: number[];
  months: number[];
  depths: number[];
  data: FourDDataPoint[];
  tempMin: number;
  tempMax: number;
  salinityMin: number;
  salinityMax: number;
}

/**
 * Generate a 4D data grid for the given region and time/depth range.
 */
export function generate4DGrid(
  region: string,
  startYear: number,
  endYear: number,
  maxDepth: number = 2000
): FourDGrid {
  const profile = getRegionProfile(region);
  const rng = seededRandom(profile.seed);

  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const depthSteps = [0, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1250, 1500, 1750, 2000, 3000, 4000, 5000, 6000];
  const depths: number[] = [];
  for (const d of depthSteps) {
    if (d <= maxDepth) depths.push(d);
  }

  const data: FourDDataPoint[] = [];
  let tempMin = Infinity, tempMax = -Infinity;
  let salMin = Infinity, salMax = -Infinity;

  for (const year of years) {
    for (const month of months) {
      for (const depth of depths) {
        const { temperature, salinity } = computeDataPoint(profile, year, month, depth, startYear, rng);
        data.push({ year, month, depth, temperature, salinity });
        tempMin = Math.min(tempMin, temperature);
        tempMax = Math.max(tempMax, temperature);
        salMin = Math.min(salMin, salinity);
        salMax = Math.max(salMax, salinity);
      }
    }
  }

  return {
    region,
    parameter: "Salinity (PSU)",
    years,
    months,
    depths,
    data,
    tempMin,
    tempMax,
    salinityMin: salMin,
    salinityMax: salMax,
  };
}

function computeDataPoint(
  profile: RegionProfile,
  year: number,
  month: number,
  depth: number,
  startYear: number,
  rng: () => number
): { temperature: number; salinity: number } {
  const seasonPhase = ((month - 1) / 12) * 2 * Math.PI;
  const seasonalSST = Math.sin(seasonPhase - Math.PI / 3) * profile.seasonalAmplitude;
  const baseSST = (profile.baseSSTMin + profile.baseSSTMax) / 2 + seasonalSST;

  const thermoFactor = Math.exp(-depth / (profile.thermoclineDepth * 3));
  const deepTemp = 1.5 + rng() * 0.5;
  const temp = deepTemp + (baseSST - deepTemp) * thermoFactor;

  const yearOffset = (year - startYear) * 0.08;
  const noise = (rng() - 0.5) * 0.6;
  const temperature = Math.round((temp + yearOffset + noise) * 100) / 100;

  const seasonalSal = Math.sin(seasonPhase + Math.PI / 4) * 0.3;
  const baseSal = (profile.baseSalinityMin + profile.baseSalinityMax) / 2 + seasonalSal;

  const haloFactor = 1 - Math.exp(-depth / (profile.haloclineDepth * 4));
  const deepSal = 34.7 + rng() * 0.3;
  const sal = baseSal + (deepSal - baseSal) * haloFactor;

  const salYearOffset = (year - startYear) * 0.015;
  const salNoise = (rng() - 0.5) * 0.15;
  const salinity = Math.round((sal + salYearOffset + salNoise) * 100) / 100;

  return { temperature, salinity };
}

/**
 * Get data for a specific time point (year+month) across all depths.
 */
export function getDepthProfile(
  grid: FourDGrid,
  year: number,
  month: number,
  parameter: "Salinity (PSU)" | "Temperature (°C)"
): { depth: number; value: number }[] {
  return grid.data
    .filter((d) => d.year === year && d.month === month)
    .map((d) => ({
      depth: d.depth,
      value: parameter === "Salinity (PSU)" ? d.salinity : d.temperature,
    }))
    .sort((a, b) => a.depth - b.depth);
}

/**
 * Get time series at a specific depth across all time points.
 */
export function getTimeSeries(
  grid: FourDGrid,
  depth: number,
  parameter: "Salinity (PSU)" | "Temperature (°C)"
): { year: number; month: number; value: number }[] {
  const closestDepth = grid.depths.reduce((prev, curr) =>
    Math.abs(curr - depth) < Math.abs(prev - depth) ? curr : prev
  );

  return grid.data
    .filter((d) => d.depth === closestDepth)
    .map((d) => ({
      year: d.year,
      month: d.month,
      value: parameter === "Salinity (PSU)" ? d.salinity : d.temperature,
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

/**
 * Get the heatmap grid (depth × time) for the Map View.
 */
export function getHeatmapGrid(
  grid: FourDGrid,
  parameter: "Salinity (PSU)" | "Temperature (°C)"
): {
  depthLabels: number[];
  timeLabels: { year: number; month: number }[];
  values: number[][];
  min: number;
  max: number;
} {
  const depthLabels = grid.depths;
  const timeLabels: { year: number; month: number }[] = [];

  for (const year of grid.years) {
    for (const month of grid.months) {
      timeLabels.push({ year, month });
    }
  }

  const values: number[][] = [];
  let min = Infinity, max = -Infinity;

  for (const depth of depthLabels) {
    const row: number[] = [];
    for (const { year, month } of timeLabels) {
      const point = grid.data.find(
        (d) => d.year === year && d.month === month && d.depth === depth
      );
      const val = point
        ? parameter === "Salinity (PSU)" ? point.salinity : point.temperature
        : 0;
      row.push(val);
      min = Math.min(min, val);
      max = Math.max(max, val);
    }
    values.push(row);
  }

  return { depthLabels, timeLabels, values, min, max };
}

/**
 * Scientific color scale: blue → cyan → green → yellow → red
 */
export function scientificColorScale(t: number): string {
  t = Math.max(0, Math.min(1, t));

  const stops = [
    { pos: 0.0, r: 8, g: 29, b: 88 },
    { pos: 0.25, r: 0, g: 104, b: 170 },
    { pos: 0.5, r: 0, g: 190, b: 150 },
    { pos: 0.75, r: 255, g: 214, b: 0 },
    { pos: 1.0, r: 255, g: 50, b: 20 },
  ];

  let lower = stops[0], upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].pos && t <= stops[i + 1].pos) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const range = upper.pos - lower.pos;
  const frac = range === 0 ? 0 : (t - lower.pos) / range;

  const r = Math.round(lower.r + (upper.r - lower.r) * frac);
  const g = Math.round(lower.g + (upper.g - lower.g) * frac);
  const b = Math.round(lower.b + (upper.b - lower.b) * frac);

  return `rgb(${r},${g},${b})`;
}

/** Month name abbreviation */
export function monthName(month: number): string {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[(month - 1) % 12];
}
