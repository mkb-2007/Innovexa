export interface KnowledgeTopic {
  keywords: string[];
  title: string;
  summary: string;
  details: string;
  suggestedBasin?: string;
  sampleFloatId?: number;
  avgTemp?: number;
  avgSalinity?: number;
  anomalyText?: string;
}

export const OCEAN_KNOWLEDGE: KnowledgeTopic[] = [
  {
    keywords: ["bay of bengal", "bob", "monsoon", "ganges", "freshwater", "salinity"],
    title: "Bay of Bengal Hydrology & Salinity Dynamics",
    summary: "The Bay of Bengal features uniquely low surface salinity (31–33.5 PSU) driven by river discharge from the Ganges-Brahmaputra and Irrawaddy river systems during the summer monsoon.",
    details: "Strong stratification traps solar heat in a shallow surface layer (~20m), creating dynamic sea surface temperature (SST) anomalies that fuel tropical cyclones. ARGO floats in this basin (e.g. WMO 2901542, 2902910) record sharp haloclines near 30m depth and intense seasonal salinity fluctuations.",
    suggestedBasin: "Bay of Bengal",
    sampleFloatId: 2901542,
    avgTemp: 29.4,
    avgSalinity: 33.2,
    anomalyText: "-1.8 PSU Salinity Deficit (Freshwater Layer)",
  },
  {
    keywords: ["arabian sea", "evaporation", "high salinity", "upwelling"],
    title: "Arabian Sea High Salinity & Upwelling",
    summary: "The Arabian Sea exhibits high surface salinity (>36.5 PSU) due to excess evaporation over precipitation and inflow of warm, saline waters from the Red Sea and Persian Gulf.",
    details: "During the Southwest Monsoon (June–September), wind-driven coastal upwelling along Oman and western India brings cold, nutrient-rich deep water to the surface. ARGO floats like WMO 1902341 track thick thermoclines and oxygen minimum zones (OMZs) down to 1000m.",
    suggestedBasin: "Arabian Sea",
    sampleFloatId: 1902341,
    avgTemp: 27.8,
    avgSalinity: 36.4,
    anomalyText: "+1.4 PSU High Salinity Anomaly",
  },
  {
    keywords: ["heatwave", "marine heatwave", "temperature anomaly", "warming", "sst"],
    title: "Marine Heatwaves & Thermal Anomaly Profiles",
    summary: "Marine Heatwaves (MHWs) are prolonged discrete warm water events. Recent ARGO telemetry indicates upper-ocean thermal anomalies exceeding +1.5°C above climatological baselines.",
    details: "MHWs disrupt marine ecosystems, trigger coral bleaching, and alter oceanic heat content (OHC). ARGO floats capture heat storage up to 300m depth, showing thermal anomalies extending far below the ocean surface layer.",
    suggestedBasin: "Global Ocean",
    sampleFloatId: 5906211,
    avgTemp: 27.2,
    avgSalinity: 35.0,
    anomalyText: "+1.6°C Thermal Anomaly (Upper 150m)",
  },
  {
    keywords: ["deep ocean", "6000m", "deep argo", "abyssal", "salinity"],
    title: "Deep ARGO Network & Abyssal Telemetry",
    summary: "Deep ARGO floats descend to 6,000 meters depth to measure warming and salinity in the abyssal ocean layer, which accounts for ~10% of total ocean heat uptake.",
    details: "Standard floats profile down to 2,000m. Deep ARGO floats (such as WMO 3902190 in the South Indian Ocean) utilize high-pressure glass spheres and specialized CTD sensors to track slow abyssal circulation and deep sea ocean warming trends.",
    suggestedBasin: "Indian Ocean",
    sampleFloatId: 3902190,
    avgTemp: 25.1,
    avgSalinity: 35.4,
    anomalyText: "Deep Ocean Warming +0.02°C / decade at 4000m",
  },
  {
    keywords: ["argo float", "how it works", "cycle", "telemetry", "drift", "ctd"],
    title: "ARGO Autonomous Float Operational Cycle",
    summary: "ARGO floats operate on a 10-day cycle: descending to 1,000m drift depth, sinking to 2,000m profile depth, and rising while measuring CTD (Conductivity, Temperature, Depth).",
    details: "Upon reaching the surface, floats transmit high-resolution data via Iridium satellite telemetry to global ocean data centers (INCOIS, NOAA, Ifremer, JAMSTEC) within hours. Over 3,900 active floats continuously monitor global ocean physics.",
    suggestedBasin: "Global Ocean",
    sampleFloatId: 2901542,
    avgTemp: 24.2,
    avgSalinity: 34.9,
    anomalyText: "Global Network Operational (3,940 Floats Active)",
  },
];
