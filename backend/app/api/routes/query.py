from fastapi import APIRouter, Query, HTTPException
import xarray as xr
import math
from app.core.config import get_argo_file

router = APIRouter(
    prefix="/api/query",
    tags=["Ocean Data Query"]
)


def clean_value(value):
    value = float(value)

    if math.isnan(value) or math.isinf(value):
        return None

    return value


@router.get("/")
def query_ocean_data(
    profile_index: int = Query(0, ge=0),
    variable: str = Query("temperature"),
    min_pressure: float | None = Query(None, ge=0),
    max_pressure: float | None = Query(None, ge=0),
    target_depth: float | None = Query(None, ge=0)
):
    # Check pressure range
    if (
        min_pressure is not None
        and max_pressure is not None
        and min_pressure > max_pressure
    ):
        raise HTTPException(
            status_code=400,
            detail="min_pressure cannot be greater than max_pressure"
        )

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
        # 2. Select requested variable
        # -----------------------------------------

        variable_map = {
            "temperature": "TEMP",
            "temp": "TEMP",
            "salinity": "PSAL",
            "salt": "PSAL",
            "pressure": "PRES",
            "depth": "PRES"
        }

        variable_key = variable.strip().lower()

        if variable_key not in variable_map:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid variable",
                    "requested_variable": variable,
                    "available_variables": [
                        "temperature",
                        "salinity",
                        "pressure"
                    ]
                }
            )

        variable_name = variable_map[variable_key]

        # -----------------------------------------
        # 3. Load pressure and requested data
        # -----------------------------------------

        pressure = ds["PRES"].isel(
            N_PROF=profile_index
        ).values

        values = ds[variable_name].isel(
            N_PROF=profile_index
        ).values

        result = []

        # -----------------------------------------
        # 4. Filter valid measurements
        # -----------------------------------------

        for p, value in zip(pressure, values):

            p = clean_value(p)
            value = clean_value(value)

            # Skip missing/invalid values
            if p is None or value is None:
                continue

            # Minimum pressure filter
            if min_pressure is not None and p < min_pressure:
                continue

            # Maximum pressure filter
            if max_pressure is not None and p > max_pressure:
                continue

            result.append({
                "pressure": p,
                "value": value
            })

        nearest = None
        if target_depth is not None and result:
            nearest = min(result, key=lambda x: abs(x["pressure"] - target_depth))

        return {
            "status": "success",
            "float_id": "5904300",
            "profile_index": profile_index,
            "variable": variable_key,
            "min_pressure": min_pressure,
            "max_pressure": max_pressure,
            "target_depth": target_depth,
            "nearest": nearest,
            "count": len(result),
            "data": result
        }

    finally:
        ds.close()

