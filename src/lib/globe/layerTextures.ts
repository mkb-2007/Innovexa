/**
 * Procedural Equirectangular Imagery Texture Generators for Cesium 3D Earth
 *
 * Generates scientifically authentic raster maps for:
 * 1. Sea Surface Temperature (SST) - Thermal gradient overlay
 * 2. Salinity Anomaly - Evaporation vs freshwater runoff zones
 * 3. Bathymetry & Seafloor Relief - Undersea ridges and deep trenches
 *
 * All textures are rendered onto an equirectangular canvas ([-180, -90] to [180, 90])
 * and loaded into Cesium's SingleTileImageryProvider, rotating 100% with the Earth.
 */

// Converts geographic coordinates [lon, lat] to canvas pixel coordinates [x, y]
function geoToPixel(lon: number, lat: number, width: number, height: number): [number, number] {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}

/**
 * 1. SEA SURFACE TEMPERATURE (SST)
 * Realistic thermal distribution:
 * - Polar waters: 0°C to 4°C (Deep navy blue)
 * - Subpolar waters: 5°C to 14°C (Cool marine cyan-blue)
 * - Temperate & Subtropical: 15°C to 24°C (Oceanic cyan-teal)
 * - Equatorial & Tropics: 25°C to 30°C+ (Vibrant cyan with warm amber/coral accents in warm pools)
 */
export function createSSTTexture(): string {
  if (typeof document === "undefined") return "";

  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Base latitude thermal gradient
  const latGrad = ctx.createLinearGradient(0, 0, 0, height);
  // 90°N (North Pole): Deep cold navy
  latGrad.addColorStop(0.0, "rgba(2, 15, 38, 0.65)");
  latGrad.addColorStop(0.12, "rgba(4, 30, 68, 0.60)");
  // 50°N (Subpolar North): Cool marine blue
  latGrad.addColorStop(0.22, "rgba(8, 70, 130, 0.52)");
  // 30°N (Subtropical): Cyan-teal
  latGrad.addColorStop(0.33, "rgba(14, 140, 185, 0.46)");
  // 10°N - 10°S (Equatorial/Tropics): Warm cyan
  latGrad.addColorStop(0.44, "rgba(0, 210, 255, 0.48)");
  latGrad.addColorStop(0.50, "rgba(0, 220, 255, 0.52)");
  latGrad.addColorStop(0.56, "rgba(0, 210, 255, 0.48)");
  // 30°S (Subtropical): Cyan-teal
  latGrad.addColorStop(0.67, "rgba(14, 140, 185, 0.46)");
  // 55°S (Southern Ocean Antarctic Convergence): Cool marine blue
  latGrad.addColorStop(0.80, "rgba(8, 70, 130, 0.54)");
  // 90°S (Antarctica): Deep cold navy
  latGrad.addColorStop(1.0, "rgba(2, 15, 38, 0.70)");

  ctx.fillStyle = latGrad;
  ctx.fillRect(0, 0, width, height);

  // Regional Warm & Cool Anomalies (Gyres, Warm Pools, Coastal Upwellings)
  const thermalFeatures: { lon: number; lat: number; radiusX: number; radiusY: number; color: string }[] = [
    // Indo-Pacific Warm Pool (Earth's warmest oceanic body, 29°C - 31°C)
    { lon: 135, lat: 8, radiusX: 160, radiusY: 70, color: "rgba(245, 158, 11, 0.40)" },
    { lon: 120, lat: 2, radiusX: 90, radiusY: 45, color: "rgba(251, 146, 60, 0.35)" },
    // Gulf Stream thermal plume (Western North Atlantic warming heading NE)
    { lon: -65, lat: 34, radiusX: 110, radiusY: 50, color: "rgba(245, 158, 11, 0.35)" },
    { lon: -40, lat: 44, radiusX: 85, radiusY: 40, color: "rgba(14, 165, 233, 0.35)" },
    // Kuroshio Current warm plume (Western Pacific)
    { lon: 142, lat: 33, radiusX: 95, radiusY: 45, color: "rgba(245, 158, 11, 0.32)" },
    // Humboldt / Peru Cool Upwelling tongue
    { lon: -80, lat: -18, radiusX: 45, radiusY: 85, color: "rgba(4, 40, 85, 0.45)" },
    // California Cool Coastal Current
    { lon: -125, lat: 32, radiusX: 45, radiusY: 70, color: "rgba(4, 40, 85, 0.40)" },
    // Benguela Cool Upwelling (SW Africa)
    { lon: 12, lat: -25, radiusX: 40, radiusY: 65, color: "rgba(4, 40, 85, 0.42)" },
  ];

  thermalFeatures.forEach((f) => {
    const [cx, cy] = geoToPixel(f.lon, f.lat, width, height);
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, f.radiusX);
    radGrad.addColorStop(0, f.color);
    radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.0, f.radiusY / f.radiusX);
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(0, 0, f.radiusX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  return canvas.toDataURL("image/png");
}

/**
 * 2. SALINITY ANOMALY OVERLAY
 * Visualizes regional deviation from global baseline salinity (35.0 PSU):
 * - High Salinity Zones (+Anomaly, >36.5 PSU): Subtropical Atlantic gyres, Arabian Sea, Mediterranean (Magenta/Violet contours)
 * - Low Salinity Zones (-Anomaly, <34.0 PSU): Amazon/Congo plumes, Bay of Bengal, Polar melting fringes (Cyan/Teal contours)
 * - Neutral regions remain transparent so Earth's natural surface shines through.
 */
export function createSalinityTexture(): string {
  if (typeof document === "undefined") return "";

  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Start with transparent base
  ctx.clearRect(0, 0, width, height);

  // High Salinity Evaporation Anomaly Basins (+1.5 to +2.8 PSU, Violet/Magenta)
  const highSalinityZones = [
    // North Atlantic Subtropical Gyre (Maximum ocean salinity, 37.5 PSU)
    { lon: -40, lat: 26, rx: 110, ry: 55, color: "rgba(168, 85, 247, 0.50)" },
    // South Atlantic Subtropical Gyre (36.8 PSU)
    { lon: -18, lat: -22, rx: 90, ry: 50, color: "rgba(147, 51, 234, 0.45)" },
    // Arabian Sea & Red Sea (High evaporation, 37.0 - 38.5 PSU)
    { lon: 62, lat: 18, rx: 65, ry: 45, color: "rgba(192, 132, 252, 0.55)" },
    // Mediterranean Sea (38.5 PSU)
    { lon: 18, lat: 35, rx: 55, ry: 25, color: "rgba(192, 132, 252, 0.55)" },
    // South Pacific Subtropical Gyre
    { lon: -110, lat: -22, rx: 115, ry: 60, color: "rgba(147, 51, 234, 0.40)" },
  ];

  // Low Salinity Freshwater Runoff & Melting Basins (-1.5 to -3.0 PSU, Teal/Cyan)
  const lowSalinityZones = [
    // Amazon River Plume (Discharges 20% of Earth's freshwater, <32.5 PSU)
    { lon: -48, lat: 4, rx: 80, ry: 45, color: "rgba(6, 182, 212, 0.55)" },
    // Bay of Bengal & Ganges/Brahmaputra runoff (<31.5 PSU)
    { lon: 88, lat: 16, rx: 65, ry: 45, color: "rgba(14, 165, 233, 0.52)" },
    // Subpolar North Pacific & Bering Sea (High precipitation, <33.0 PSU)
    { lon: -170, lat: 54, rx: 105, ry: 45, color: "rgba(20, 184, 166, 0.45)" },
    // Congo River Plume (Equatorial West Africa, <33.5 PSU)
    { lon: 8, lat: -6, rx: 45, ry: 35, color: "rgba(6, 182, 212, 0.48)" },
    // Arctic Polar Melt Fringe
    { lon: 0, lat: 75, rx: 280, ry: 40, color: "rgba(56, 189, 248, 0.42)" },
    // Southern Ocean Antarctic Ice Melt Fringe
    { lon: 0, lat: -68, rx: 320, ry: 35, color: "rgba(56, 189, 248, 0.38)" },
  ];

  const allZones = [...highSalinityZones, ...lowSalinityZones];

  allZones.forEach((z) => {
    const [cx, cy] = geoToPixel(z.lon, z.lat, width, height);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, z.rx);
    grad.addColorStop(0, z.color);
    grad.addColorStop(0.65, z.color.replace(/[\d\.]+\)$/, "0.25)"));
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.0, z.ry / z.rx);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, z.rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  return canvas.toDataURL("image/png");
}

/**
 * 3. BATHYMETRY & SEAFLOOR RELIEF
 * Enhances ocean-floor depth and topography:
 * - Mid-Ocean Ridges (Mid-Atlantic, East Pacific Rise, Indian Ridge): Light cyan-blue illuminated contour lines
 * - Deep Trenches (Mariana, Puerto Rico, Java, Tonga): Deep midnight abyssal slits
 * - Abyssal Plains: Subtle dark navy depth shading
 */
export function createBathymetryTexture(): string {
  if (typeof document === "undefined") return "";

  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.clearRect(0, 0, width, height);

  // Deep Abyssal Shading across all oceans
  ctx.fillStyle = "rgba(2, 8, 20, 0.42)";
  ctx.fillRect(0, 0, width, height);

  // Undersea Ridge Chains (Mid-Atlantic Ridge, East Pacific Rise, Carlsberg/Indian Ridge)
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(56, 189, 248, 0.40)";
  ctx.shadowColor = "#00d2ff";
  ctx.shadowBlur = 8;

  // Mid-Atlantic Ridge Trajectory (North to South)
  const midAtlanticWaypoints = [
    [-28, 68],
    [-24, 60],
    [-30, 48],
    [-42, 32],
    [-40, 22],
    [-30, 10],
    [-18, 0],
    [-14, -12],
    [-16, -26],
    [-15, -42],
    [-5, -55],
  ];

  ctx.beginPath();
  midAtlanticWaypoints.forEach(([lon, lat], i) => {
    const [x, y] = geoToPixel(lon, lat, width, height);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // East Pacific Rise & Pacific-Antarctic Ridge
  const eastPacificWaypoints = [
    [-108, 20],
    [-106, 8],
    [-104, -6],
    [-112, -22],
    [-115, -38],
    [-135, -52],
    [-160, -62],
  ];

  ctx.beginPath();
  eastPacificWaypoints.forEach(([lon, lat], i) => {
    const [x, y] = geoToPixel(lon, lat, width, height);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Southwest & Central Indian Ridge
  const indianRidgeWaypoints = [
    [60, 12],
    [64, -2],
    [68, -18],
    [72, -32],
    [52, -44],
    [35, -52],
  ];

  ctx.beginPath();
  indianRidgeWaypoints.forEach(([lon, lat], i) => {
    const [x, y] = geoToPixel(lon, lat, width, height);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Deep Ocean Trenches (Deepest points on Earth, intense dark slits)
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4.0;
  ctx.strokeStyle = "rgba(1, 4, 12, 0.85)";

  const trenches = [
    // Mariana Trench (Challenger Deep, 10,994m)
    [[141, 16], [143, 12], [145, 10]],
    // Puerto Rico Trench (8,376m)
    [[-68, 20], [-64, 19.5]],
    // Java / Sunda Trench (7,450m)
    [[98, -2], [105, -8], [115, -10]],
    // Peru-Chile / Atacama Trench (8,065m)
    [[-74, -18], [-72, -28], [-74, -36]],
    // Kuril-Kamchatka & Japan Trench (10,542m)
    [[154, 48], [148, 42], [144, 34]],
    // Tonga-Kermadec Trench (10,882m)
    [[-174, -18], [-176, -28], [-178, -34]],
  ];

  trenches.forEach((path) => {
    ctx.beginPath();
    path.forEach(([lon, lat], i) => {
      const [x, y] = geoToPixel(lon, lat, width, height);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  return canvas.toDataURL("image/png");
}
