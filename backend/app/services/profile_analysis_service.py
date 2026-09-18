import xarray as xr
import math
from app.core.config import get_argo_file


def clean_value(value):
    value = float(value)

    if math.isnan(value) or math.isinf(value):
        return None

    return value


def analyze_profile(profile_index: int):

    ds = xr.open_dataset(
        get_argo_file(),
        engine="netcdf4"
    )

    try:
        total_profiles = ds.sizes["N_PROF"]

        if profile_index < 0 or profile_index >= total_profiles:
            return {
                "error": "Profile index out of range",
                "available_profiles": total_profiles
            }

        pressure = ds["PRES"].isel(
            N_PROF=profile_index
        ).values

        temperature = ds["TEMP"].isel(
            N_PROF=profile_index
        ).values

        salinity = ds["PSAL"].isel(
            N_PROF=profile_index
        ).values

        profile_data = []

        for p, temp, salt in zip(
            pressure,
            temperature,
            salinity
        ):

            p = clean_value(p)
            temp = clean_value(temp)
            salt = clean_value(salt)

            if p is None or temp is None or salt is None:
                continue

            profile_data.append({
                "depth": p,
                "temperature": temp,
                "salinity": salt
            })

        # -----------------------------------------
        # Calculate temperature gradient
        # -----------------------------------------

        thermocline_points = []

        for i in range(1, len(profile_data)):

            previous = profile_data[i - 1]
            current = profile_data[i]

            depth_change = (
                current["depth"] - previous["depth"]
            )

            temperature_change = (
                current["temperature"]
                - previous["temperature"]
            )

            if depth_change <= 0:
                continue

            temperature_gradient = (
                temperature_change / depth_change
            )

            thermocline_points.append({
                "depth": current["depth"],
                "temperature": current["temperature"],
                "temperature_gradient": round(
                    temperature_gradient,
                    4
                )
            })

        # -----------------------------------------
        # Calculate salinity gradient
        # -----------------------------------------

        salinity_gradient_points = []

        for i in range(1, len(profile_data)):

            previous = profile_data[i - 1]
            current = profile_data[i]

            depth_change = (
                current["depth"] - previous["depth"]
            )

            salinity_change = (
                current["salinity"]
                - previous["salinity"]
            )

            if depth_change <= 0:
                continue

            salinity_gradient = (
                salinity_change / depth_change
            )

            salinity_gradient_points.append({
                "depth": current["depth"],
                "salinity": current["salinity"],
                "salinity_gradient": round(
                    salinity_gradient,
                    4
                )
            })

        # -----------------------------------------
        # Find strongest thermocline point
        # -----------------------------------------

        strongest_thermocline = None

        if thermocline_points:

            strongest_thermocline = min(
                thermocline_points,
                key=lambda x: x["temperature_gradient"]
            )

        # -----------------------------------------
        # Find strongest salinity gradient
        # -----------------------------------------

        strongest_salinity_gradient = None

        if salinity_gradient_points:

            strongest_salinity_gradient = max(
                salinity_gradient_points,
                key=lambda x: abs(
                    x["salinity_gradient"]
                )
            )

        return {
            "float_id": "5904300",
            "profile_index": profile_index,
            "point_count": len(profile_data),

            "thermocline": {
                "strongest_point": strongest_thermocline,
                "points": thermocline_points
            },

            "salinity_gradient": {
                "strongest_point": strongest_salinity_gradient,
                "points": salinity_gradient_points
            }
        }

    finally:
        ds.close()