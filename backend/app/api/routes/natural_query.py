import math
import xarray as xr
from fastapi import APIRouter, Query

from app.core.config import get_argo_file
from app.services.natural_query_service import parse_natural_query
from app.services.anomaly_service import detect_temperature_anomalies
from app.services.profile_analysis_service import analyze_profile

router = APIRouter(
    prefix="/api/natural-query",
    tags=["Natural Language Query"]
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


@router.get("/")
def natural_query(question: str = Query(...)):
    parsed = parse_natural_query(question)

    intent = parsed["intent"]
    profile_index = parsed["profile_index"]
    variable = parsed["variable"]
    min_pressure = parsed["min_pressure"]
    max_pressure = parsed["max_pressure"]

    if intent == "anomaly_query":
        result = detect_temperature_anomalies(profile_index)

        return {
            "status": "success",
            "question": question,
            "intent": intent,
            "result": result
        }

    if intent == "thermocline_query":
        analysis = analyze_profile(profile_index)
        thermocline = analysis.get("strongest_thermocline")

        if thermocline is None:
            thermocline = analysis.get("thermocline")

        return {
            "status": "success",
            "question": question,
            "intent": intent,
            "profile_index": profile_index,
            "result": thermocline
        }

    if intent == "salinity_gradient_query":
        analysis = analyze_profile(profile_index)
        salinity_gradient = analysis.get("strongest_salinity_gradient")

        if salinity_gradient is None:
            salinity_gradient = analysis.get("salinity_gradient")

        return {
            "status": "success",
            "question": question,
            "intent": intent,
            "profile_index": profile_index,
            "result": salinity_gradient
        }

    if intent == "profile_analysis_query":
        analysis = analyze_profile(profile_index)

        return {
            "status": "success",
            "question": question,
            "intent": intent,
            "profile_index": profile_index,
            "result": analysis
        }

    if intent == "trajectory_query":
        ds = xr.open_dataset(get_argo_file(), engine="netcdf4")

        try:
            latitude = ds["LATITUDE"].values
            longitude = ds["LONGITUDE"].values
            times = ds["JULD"].values
            total_profiles = ds.sizes["N_PROF"]
            trajectory = []

            for index in range(total_profiles):
                lat = clean_value(latitude[index])
                lon = clean_value(longitude[index])

                if lat is None or lon is None:
                    continue

                trajectory.append({
                    "profile_index": index,
                    "latitude": lat,
                    "longitude": lon,
                    "time": clean_time(times[index])
                })

            return {
                "status": "success",
                "question": question,
                "intent": intent,
                "float_id": "5904300",
                "result": {
                    "profile_count": len(trajectory),
                    "trajectory": trajectory
                }
            }
        finally:
            ds.close()

    ds = xr.open_dataset(get_argo_file(), engine="netcdf4")

    try:
        total_profiles = ds.sizes["N_PROF"]

        if profile_index < 0 or profile_index >= total_profiles:
            return {
                "status": "error",
                "message": "Profile index out of range",
                "available_profiles": total_profiles
            }

        variable_map = {
            "temperature": "TEMP",
            "salinity": "PSAL",
            "pressure": "PRES"
        }
        variable = variable or "temperature"
        dataset_variable = variable_map.get(variable)

        if dataset_variable is None:
            return {
                "status": "error",
                "message": "Unsupported variable"
            }

        pressure_values = ds["PRES"].isel(N_PROF=profile_index).values
        data_values = ds[dataset_variable].isel(N_PROF=profile_index).values
        data = []

        for pressure_value, data_value in zip(pressure_values, data_values):
            pressure = clean_value(pressure_value)
            value = clean_value(data_value)

            if pressure is None or value is None:
                continue
            if min_pressure is not None and pressure < min_pressure:
                continue
            if max_pressure is not None and pressure > max_pressure:
                continue

            data.append({"pressure": pressure, "value": value})

        return {
            "status": "success",
            "question": question,
            "intent": intent,
            "float_id": "5904300",
            "profile_index": profile_index,
            "variable": variable,
            "min_pressure": min_pressure,
            "max_pressure": max_pressure,
            "count": len(data),
            "data": data
        }
    finally:
        ds.close()
