import xarray as xr
import math
from app.core.config import get_argo_file


def clean_value(value):
    value = float(value)

    if math.isnan(value) or math.isinf(value):
        return None

    return value


def detect_temperature_anomalies(profile_index: int):
    """
    Detect unusually large temperature changes
    within one ARGO profile.
    """

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

        anomalies = []

        previous_temperature = None

        for p, temp in zip(pressure, temperature):

            p = clean_value(p)
            temp = clean_value(temp)

            # Ignore missing values
            if p is None or temp is None:
                continue

            # Compare with previous valid temperature
            if previous_temperature is not None:

                temperature_change = abs(
                    temp - previous_temperature
                )

                # MVP anomaly threshold
                if temperature_change >= 0.5:
                    anomalies.append({
                        "pressure": p,
                        "temperature": temp,
                        "temperature_change": round(
                            temperature_change, 3
                        ),
                        "status": "temperature_anomaly"
                    })

            previous_temperature = temp

        return {
            "float_id": "5904300",
            "profile_index": profile_index,
            "anomaly_count": len(anomalies),
            "anomalies": anomalies
        }

    finally:
        ds.close()