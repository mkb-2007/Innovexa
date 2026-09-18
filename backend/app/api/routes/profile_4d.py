from fastapi import APIRouter
import xarray as xr
import math
from app.core.config import get_argo_file

router = APIRouter(
    prefix="/api/profile",
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


@router.get("/{profile_index}/4d")
def get_4d_profile(profile_index: int):

    ds = xr.open_dataset(
        get_argo_file(),
        engine="netcdf4"
    )

    try:
        total_profiles = ds.sizes["N_PROF"]

        # Check profile index
        if profile_index < 0 or profile_index >= total_profiles:
            return {
                "status": "error",
                "message": "Profile index out of range.",
                "available_profiles": total_profiles
            }

        # --------------------------------
        # PROFILE LOCATION
        # --------------------------------

        latitude = clean_value(
            ds["LATITUDE"].isel(N_PROF=profile_index).values
        )

        longitude = clean_value(
            ds["LONGITUDE"].isel(N_PROF=profile_index).values
        )

        # --------------------------------
        # PROFILE TIME
        # --------------------------------

        profile_time = clean_time(
            ds["JULD"].isel(N_PROF=profile_index).values
        )

        # --------------------------------
        # OCEAN VARIABLES
        # --------------------------------

        pressure = ds["PRES"].isel(
            N_PROF=profile_index
        ).values

        temperature = ds["TEMP"].isel(
            N_PROF=profile_index
        ).values

        salinity = ds["PSAL"].isel(
            N_PROF=profile_index
        ).values

        # --------------------------------
        # BUILD 4D DATA POINTS
        # --------------------------------

        points = []

        for p, temp, sal in zip(
            pressure,
            temperature,
            salinity
        ):

            p = clean_value(p)
            temp = clean_value(temp)
            sal = clean_value(sal)

            # Only keep complete measurements
            if (
                p is None
                or temp is None
                or sal is None
            ):
                continue

            points.append({
                "depth": p,
                "temperature": temp,
                "salinity": sal
            })

        # --------------------------------
        # RETURN CLEAN API RESPONSE
        # --------------------------------

        return {
            "status": "success",

            "float": {
                "float_id": "5904300"
            },

            "profile": {
                "profile_index": profile_index,
                "latitude": latitude,
                "longitude": longitude,
                "time": profile_time,
                "point_count": len(points)
            },

            "data": points
        }

    finally:
        ds.close()