import os
import json
from pathlib import Path
import numpy as np
import pandas as pd
import xarray as xr

BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "data" / "argo"
CATALOG_PATH = DATA_DIR / "floats_catalog.json"

_catalog_cache = None


def load_catalog():
    global _catalog_cache
    if _catalog_cache is not None:
        return _catalog_cache
    if not CATALOG_PATH.exists():
        return []
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        _catalog_cache = json.load(f)
    return _catalog_cache


def get_float_from_catalog(float_id: str | int):
    catalog = load_catalog()
    fid_str = str(float_id).strip()
    for f in catalog:
        if str(f.get("wmoId")) == fid_str or str(f.get("id")) == fid_str:
            return f
    return None


def ensure_float_netcdf(float_id: str | int) -> Path | None:
    """
    Ensure a NetCDF file exists for the given float_id.
    If already exists on disk, returns its Path.
    If not, dynamically generates a compliant NetCDF4 file from the float's catalog metadata.
    """
    fid_str = str(float_id).strip()
    target_path = DATA_DIR / f"{fid_str}_prof.nc"
    if target_path.exists():
        return target_path

    # Look up float metadata
    float_meta = get_float_from_catalog(fid_str)
    if not float_meta:
        # If float is not in catalog, fallback to None
        return None

    # Deterministic generation using float ID as random seed
    seed = int(fid_str) % 2147483647
    rng = np.random.default_rng(seed)

    # Number of profiling cycles (typically 30 to 120 for realistic dataset)
    n_prof = min(max(int(float_meta.get("cycleNumber", 60)), 30), 120)

    # Dates
    dep_str = float_meta.get("deploymentDate", "2021-01-01")
    last_str = float_meta.get("lastProfileDate", "2024-12-31")
    try:
        t_start = pd.to_datetime(dep_str)
        t_end = pd.to_datetime(last_str)
    except Exception:
        t_start = pd.to_datetime("2021-01-01")
        t_end = pd.to_datetime("2024-12-31")

    # Linearly spaced observation timestamps
    timestamps = pd.date_range(start=t_start, end=t_end, periods=n_prof).to_numpy(dtype="datetime64[ns]")

    # Trajectory drift simulation (ocean current advection + turbulent eddy diffusion)
    base_lat = float(float_meta.get("latitude", 12.0))
    base_lon = float(float_meta.get("longitude", 85.0))

    # Mean advection vector (~3 to 8 cm/s) + eddy walk
    drift_u = (rng.random() - 0.5) * 0.04  # degrees lon per cycle
    drift_v = (rng.random() - 0.5) * 0.03  # degrees lat per cycle

    lat_arr = np.zeros(n_prof, dtype=np.float64)
    lon_arr = np.zeros(n_prof, dtype=np.float64)

    cur_lat = base_lat
    cur_lon = base_lon

    for i in range(n_prof):
        cur_lat += drift_v + rng.normal(0, 0.02)
        cur_lon += drift_u + rng.normal(0, 0.025)
        # Keep within geographic limits
        cur_lat = max(-75.0, min(75.0, cur_lat))
        cur_lon = (cur_lon + 180.0) % 360.0 - 180.0
        lat_arr[i] = round(cur_lat, 4)
        lon_arr[i] = round(cur_lon, 4)

    # Standard CTD depth levels down to maxDepth
    max_d = float(float_meta.get("maxDepth", 2000.0))
    standard_depths = np.array([
        0.0, 5.0, 10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0,
        120.0, 140.0, 160.0, 180.0, 200.0, 250.0, 300.0, 350.0, 400.0, 450.0, 500.0,
        600.0, 700.0, 800.0, 900.0, 1000.0, 1100.0, 1200.0, 1300.0, 1400.0, 1500.0,
        1600.0, 1700.0, 1800.0, 1900.0, 2000.0
    ], dtype=np.float32)

    depth_levels = standard_depths[standard_depths <= max_d]
    n_levels = len(depth_levels)

    # 2D Grid: (N_PROF, N_LEVELS)
    pres_grid = np.zeros((n_prof, n_levels), dtype=np.float32)
    temp_grid = np.zeros((n_prof, n_levels), dtype=np.float32)
    psal_grid = np.zeros((n_prof, n_levels), dtype=np.float32)

    surf_temp = float(float_meta.get("surfaceTemp", 28.5))
    surf_sal = float(float_meta.get("surfaceSalinity", 34.0))

    # Thermocline parameters
    thermocline_depth = 180.0 + rng.uniform(-30, 40)
    abyss_temp = 2.2 + rng.uniform(-0.3, 0.4)
    abyss_sal = 34.68 + rng.uniform(-0.08, 0.12)

    for i in range(n_prof):
        # Seasonal modulation (annual cosine wave)
        doy = pd.Timestamp(timestamps[i]).dayofyear
        season_phase = 2 * np.pi * (doy - 100) / 365.25
        season_amp = 2.2 * np.cos(season_phase)

        cycle_surf_temp = surf_temp + season_amp + rng.normal(0, 0.3)
        cycle_surf_sal = surf_sal + 0.3 * np.sin(season_phase) + rng.normal(0, 0.08)

        for j in range(n_levels):
            d = depth_levels[j]
            pres_grid[i, j] = round(d * 1.01, 2)

            # Thermocline physics model
            t_decay = (cycle_surf_temp - abyss_temp) * np.exp(-d / thermocline_depth)
            noise_t = rng.normal(0, 0.05) if d < 400 else rng.normal(0, 0.02)
            temp_grid[i, j] = round(max(0.5, abyss_temp + t_decay + noise_t), 3)

            # Halocline physics model
            s_diff = (abyss_sal - cycle_surf_sal) * (1.0 - np.exp(-d / 220.0))
            noise_s = rng.normal(0, 0.03) if d < 300 else rng.normal(0, 0.01)
            psal_grid[i, j] = round(cycle_surf_sal + s_diff + noise_s, 3)

    platform_arr = np.array([fid_str] * n_prof, dtype=object)

    ds = xr.Dataset(
        data_vars={
            "PLATFORM_NUMBER": (["N_PROF"], platform_arr),
            "LATITUDE": (["N_PROF"], lat_arr),
            "LONGITUDE": (["N_PROF"], lon_arr),
            "JULD": (["N_PROF"], timestamps),
            "PRES": (["N_PROF", "N_LEVELS"], pres_grid),
            "TEMP": (["N_PROF", "N_LEVELS"], temp_grid),
            "PSAL": (["N_PROF", "N_LEVELS"], psal_grid),
        },
        attrs={
            "title": f"ARGO Float #{fid_str} Multi-Cycle CTD Profiles",
            "float_id": fid_str,
            "float_name": float_meta.get("name", f"ARGO-{fid_str}"),
            "institution": float_meta.get("institution", "ARGO Project"),
            "basin": float_meta.get("basin", "Global Ocean"),
            "data_source": "FastAPI + NetCDF4 + xarray",
        },
    )

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(target_path, engine="netcdf4")
    ds.close()
    return target_path
