from fastapi import APIRouter
import xarray as xr
import math
from app.core.config import get_argo_file

router = APIRouter(
    prefix="/api/profile",
    tags=["ARGO Profile Trajectory"]
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


@router.get("/trajectory/4d")
def get_4d_trajectory():

    ds = xr.open_dataset(
        get_argo_file(),
        engine="netcdf4"
    )

    try:

        latitude = ds["LATITUDE"].values
        longitude = ds["LONGITUDE"].values
        times = ds["JULD"].values

        pressure = ds["PRES"].values

        trajectory = []

        total_profiles = ds.sizes["N_PROF"]

        for index in range(total_profiles):

            lat = clean_value(latitude[index])
            lon = clean_value(longitude[index])

            if lat is None or lon is None:
                continue

            # Get valid depth measurements for this profile
            profile_pressure = pressure[index]

            valid_depths = []

            for depth in profile_pressure:

                depth = clean_value(depth)

                if depth is not None:
                    valid_depths.append(depth)

            if valid_depths:

                max_depth = max(valid_depths)
                point_count = len(valid_depths)

            else:

                max_depth = None
                point_count = 0

            trajectory.append({
                "profile_index": index,
                "latitude": lat,
                "longitude": lon,
                "time": clean_time(times[index]),
                "max_depth": max_depth,
                "point_count": point_count
            })

        return {
            "status": "success",

            "float": {
                "float_id": "5904300"
            },

            "trajectory": {
                "profile_count": len(trajectory),
                "points": trajectory
            }
        }

    finally:
        ds.close()