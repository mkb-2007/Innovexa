from fastapi import APIRouter, HTTPException, Path as FastAPIPath
import xarray as xr
import math
from app.core.config import get_argo_file

router = APIRouter(
    prefix="/api/telemetry",
    tags=["ARGO Telemetry"]
)


def clean_value(value):
    value = float(value)

    if math.isnan(value) or math.isinf(value):
        return None

    return value


def clean_values(values):
    result = []

    for value in values:
        result.append(clean_value(value))

    return result


def clean_time(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


@router.get("/{profile_index}")
def get_profile(
    profile_index: int = FastAPIPath(..., ge=0)
):
    ds = xr.open_dataset(
        get_argo_file(),
        engine="netcdf4"
    )

    try:
        # -----------------------------------------
        # 1. Check profile number
        # -----------------------------------------

        total_profiles = ds.sizes["N_PROF"]

        if profile_index >= total_profiles:
            raise HTTPException(
                status_code=404,
                detail={
                    "message": "Profile index out of range",
                    "requested_profile": profile_index,
                    "available_profiles": total_profiles
                }
            )

        # -----------------------------------------
        # 2. Read profile metadata
        # -----------------------------------------

        latitude = clean_value(
            ds["LATITUDE"].isel(
                N_PROF=profile_index
            ).values
        )

        longitude = clean_value(
            ds["LONGITUDE"].isel(
                N_PROF=profile_index
            ).values
        )

        time = clean_time(
            ds["JULD"].isel(
                N_PROF=profile_index
            ).values
        )

        # -----------------------------------------
        # 3. Read telemetry measurements
        # -----------------------------------------

        pressure = clean_values(
            ds["PRES"].isel(
                N_PROF=profile_index
            ).values
        )

        temperature = clean_values(
            ds["TEMP"].isel(
                N_PROF=profile_index
            ).values
        )

        salinity = clean_values(
            ds["PSAL"].isel(
                N_PROF=profile_index
            ).values
        )

        # -----------------------------------------
        # 4. Count valid measurements
        # -----------------------------------------

        valid_measurements = 0

        for index in range(len(pressure)):
            if (
                pressure[index] is not None
                and temperature[index] is not None
                and salinity[index] is not None
            ):
                valid_measurements += 1

        # -----------------------------------------
        # 5. Return profile
        # -----------------------------------------

        return {
            "status": "success",
            "float_id": "5904300",

            "profile": {
                "profile_index": profile_index,
                "latitude": latitude,
                "longitude": longitude,
                "time": time,
                "measurement_count": valid_measurements
            },

            "telemetry": {
                "pressure": pressure,
                "temperature": temperature,
                "salinity": salinity
            }
        }

    finally:
        ds.close()
