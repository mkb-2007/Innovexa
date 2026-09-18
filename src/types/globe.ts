export type ExplorationMode = "global" | "region" | "float";

export interface GeoLocation {
  latitude: number;
  longitude: number;
  height?: number;
  regionName?: string;
  wmoId?: number;
}

export interface GlobeState {
  mode: ExplorationMode;
  isRotating: boolean;
  isInteracting: boolean;
  selectedLocation: GeoLocation | null;
  isUsingGoogleTiles: boolean;
}

export interface GlobeProps {
  onLocationSelect?: (location: GeoLocation) => void;
  onModeChange?: (mode: ExplorationMode) => void;
  onExploreOcean?: (location: GeoLocation) => void;
  selectedFloatId?: number | null;
  activeLayers?: OceanLayerState;
  className?: string;
}

export interface DepthMeasurement {
  depth: number; // meters (0 to 2000+)
  temperature: number; // °C
  salinity: number; // PSU (Practical Salinity Unit)
  oxygen?: number; // µmol/kg
  pressure?: number; // dbar
}

export interface ArgoFloat {
  id: number;
  wmoId: number;
  name: string;
  latitude: number;
  longitude: number;
  basin: string;
  deploymentDate: string;
  lastProfileDate: string;
  status: "active" | "descending" | "surfacing" | "maintenance";
  cycleNumber: number;
  maxDepth: number; // e.g. 2000m or 6000m
  surfaceTemp: number; // °C
  surfaceSalinity: number; // PSU
  country: string;
  institution: string;
  batteryPercent: number;
  profiles: DepthMeasurement[];
}

export interface OceanLayerState {
  argoFloats: boolean;
  temperatureHeatmap: boolean;
  salinityOverlay: boolean;
  currentsVector: boolean;
  bathymetry: boolean;
}

export interface ExplorerContext {
  region: string;
  parameter: "Salinity (PSU)" | "Temperature (°C)" | "Pressure (dbar)";
  timeRange: string;
  depthRange: string;
  startYear: number;
  endYear: number;
  maxDepth: number;
}

export interface MapActions {
  shouldFlyTo: boolean;
  targetCoordinates?: [number, number]; // [longitude, latitude]
  highlightVariable?: "salinity" | "temperature" | "anomalies";
  depthReach?: number; // integer up to 2000
  isAnomaly?: boolean;
}

export interface SemanticQueryResponse {
  responseText: string;
  mapActions?: MapActions;
  targetFloatId?: number;
  targetLocation?: GeoLocation;
  focusOnFloat?: boolean;
  explorerContext?: ExplorerContext;
  telemetryMetrics?: {
    avgTemp?: number;
    avgSalinity?: number;
    anomaly?: string;
    activeFloatCount?: number;
    basinName?: string;
  };
  chartData?: DepthMeasurement[];
}

export interface ChatMessage {
  id: string | number;
  sender?: "user" | "assistant";
  role?: "user" | "assistant";
  text: string;
  content?: string;
  timestamp?: string;
  mapActions?: MapActions;
  targetFloatId?: number;
  targetLocation?: GeoLocation;
  focusOnFloat?: boolean;
  explorerContext?: ExplorerContext;
  telemetryMetrics?: {
    avgTemp?: number;
    avgSalinity?: number;
    anomaly?: string;
    activeFloatCount?: number;
    basinName?: string;
  };
  chartData?: DepthMeasurement[];
}

export interface FlyToOptions {
  duration?: number;
  pitch?: number;
  altitude?: number;
  height?: number;
  heading?: number;
  roll?: number;
}
