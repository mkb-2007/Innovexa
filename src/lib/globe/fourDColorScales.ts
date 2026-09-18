/**
 * Scientific Color Scales for 4D Ocean Exploration
 * Supports single active variable: Temperature, Salinity, or Pressure
 */

export type OceanVariable = "Temperature (°C)" | "Salinity (PSU)" | "Pressure (dbar)";

export interface VariableRange {
  name: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

export const VARIABLE_CONFIG: Record<OceanVariable, VariableRange> = {
  "Temperature (°C)": {
    name: "Sea Temperature",
    unit: "°C",
    min: 2.0,
    max: 30.0,
    step: 0.1,
  },
  "Salinity (PSU)": {
    name: "Salinity Concentration",
    unit: "PSU",
    min: 33.5,
    max: 35.5,
    step: 0.05,
  },
  "Pressure (dbar)": {
    name: "Hydrostatic Pressure",
    unit: "dbar",
    min: 0.0,
    max: 2000.0,
    step: 10,
  },
};

/**
 * Temperature scientific scale: Deep Abyss Blue -> Cold Cyan -> Green -> Amber -> Coral Red
 */
export function getTemperatureColor(val: number): string {
  const min = 2.0;
  const max = 30.0;
  const t = Math.max(0, Math.min(1, (val - min) / (max - min)));

  if (t < 0.25) {
    // 0 to 0.25: deep blue to cyan
    const f = t / 0.25;
    const r = Math.round(15 + f * 10);
    const g = Math.round(50 + f * 140);
    const b = Math.round(180 + f * 75);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (t < 0.5) {
    // 0.25 to 0.5: cyan to emerald green
    const f = (t - 0.25) / 0.25;
    const r = Math.round(25 + f * 20);
    const g = Math.round(190 + f * 35);
    const b = Math.round(255 - f * 150);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (t < 0.75) {
    // 0.5 to 0.75: emerald green to amber
    const f = (t - 0.5) / 0.25;
    const r = Math.round(45 + f * 200);
    const g = Math.round(225 - f * 45);
    const b = Math.round(105 - f * 95);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // 0.75 to 1.0: amber to coral red
    const f = (t - 0.75) / 0.25;
    const r = Math.round(245 + f * 10);
    const g = Math.round(180 - f * 130);
    const b = Math.round(10 + f * 40);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Salinity scientific scale: Freshwater Cyan/Teal -> Ocean Blue -> Deep Saline Purple
 */
export function getSalinityColor(val: number): string {
  const min = 33.5;
  const max = 35.5;
  const t = Math.max(0, Math.min(1, (val - min) / (max - min)));

  if (t < 0.33) {
    // Low salinity: fresh cyan to sky blue
    const f = t / 0.33;
    const r = Math.round(6 + f * 8);
    const g = Math.round(182 + f * 20);
    const b = Math.round(212 + f * 40);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (t < 0.66) {
    // Normal ocean salinity: blue to royal purple
    const f = (t - 0.33) / 0.33;
    const r = Math.round(14 + f * 120);
    const g = Math.round(202 - f * 80);
    const b = Math.round(252 - f * 30);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // High salinity: royal purple to deep magenta
    const f = (t - 0.66) / 0.34;
    const r = Math.round(134 + f * 85);
    const g = Math.round(122 - f * 60);
    const b = Math.round(222 + f * 20);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Pressure scientific scale: Surface Cyan -> Mid Ocean Blue -> Abyss Indigo
 */
export function getPressureColor(val: number): string {
  const min = 0.0;
  const max = 2000.0;
  const t = Math.max(0, Math.min(1, (val - min) / (max - min)));

  const r = Math.round(0 + t * 90);
  const g = Math.round(210 - t * 160);
  const b = Math.round(255 - t * 65);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get active color for single selected variable
 */
export function getVariableColor(variable: OceanVariable, val: number): string {
  if (variable === "Salinity (PSU)") {
    return getSalinityColor(val);
  }
  if (variable === "Pressure (dbar)") {
    return getPressureColor(val);
  }
  return getTemperatureColor(val);
}

/**
 * Get normalized [r, g, b] (0..1) for single selected variable, optimized for WebGL buffer attributes
 */
export function getVariableColorRgb(variable: OceanVariable, val: number): [number, number, number] {
  const css = getVariableColor(variable, val);
  const match = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return [
      parseInt(match[1], 10) / 255,
      parseInt(match[2], 10) / 255,
      parseInt(match[3], 10) / 255,
    ];
  }
  return [0, 0.8, 1];
}

