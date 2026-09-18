from fastapi import APIRouter, Query
import xarray as xr
import math
from app.core.config import get_argo_file

router = APIRouter(
    prefix="/api/visualization",
    tags=["4D Visualization"]
)


def clean_value(value):
    value = float(value)

    if math.isnan(value) or math.isinf(value):
        return None

    return value


def clean_time(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


@router.get("/4d")
def get_4d_visualization_data(
    start_profile: int = Query(0, ge=0),
    end_profile: int | None = Query(None, ge=0),
    min_depth: float | None = Query(None, ge=0),
    max_depth: float | None = Query(None, ge=0)
):
    ds = xr.open_dataset(
        get_argo_file(),
        engine="netcdf4"
    )

    try:
        latitude = ds["LATITUDE"].values
        longitude = ds["LONGITUDE"].values
        times = ds["JULD"].values

        pressure = ds["PRES"].values
        temperature = ds["TEMP"].values
        salinity = ds["PSAL"].values

        total_profiles = ds.sizes["N_PROF"]

        # Make sure the requested profile range is valid
        if start_profile >= total_profiles:
            return {
                "status": "error",
                "message": "start_profile is outside available profiles",
                "available_profiles": total_profiles
            }

        if end_profile is None:
            end_profile = total_profiles - 1

        if end_profile >= total_profiles:
            end_profile = total_profiles - 1

        if start_profile > end_profile:
            return {
                "status": "error",
                "message": "start_profile cannot be greater than end_profile"
            }

        points = []

        for profile_index in range(
            start_profile,
            end_profile + 1
        ):

            lat = clean_value(latitude[profile_index])
            lon = clean_value(longitude[profile_index])

            if lat is None or lon is None:
                continue

            profile_time = clean_time(times[profile_index])

            profile_pressure = pressure[profile_index]
            profile_temperature = temperature[profile_index]
            profile_salinity = salinity[profile_index]

            for level in range(len(profile_pressure)):

                depth = clean_value(profile_pressure[level])
                temp = clean_value(profile_temperature[level])
                sal = clean_value(profile_salinity[level])

                if depth is None:
                    continue

                # Depth filtering
                if min_depth is not None and depth < min_depth:
                    continue

                if max_depth is not None and depth > max_depth:
                    continue

                # Skip completely empty measurements
                if temp is None and sal is None:
                    continue

                points.append({
                    "profile_index": profile_index,
                    "latitude": lat,
                    "longitude": lon,
                    "time": profile_time,
                    "depth": depth,
                    "temperature": temp,
                    "salinity": sal
                })

        return {
            "status": "success",
            "float_id": "5904300",
            "profile_range": {
                "start": start_profile,
                "end": end_profile
            },
            "profile_count": end_profile - start_profile + 1,
            "point_count": len(points),
            "filters": {
                "min_depth": min_depth,
                "max_depth": max_depth
            },
            "points": points
        }

    finally:
        ds.close()