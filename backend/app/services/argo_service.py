import xarray as xr
from pathlib import Path


from app.core.config import get_argo_file


def load_argo_data():
    """
    Open the ARGO NetCDF file and return the dataset.
    """
    argo_file = get_argo_file()
    ds = xr.open_dataset(
        argo_file,
        engine="netcdf4"
    )

    return ds


def get_float_summary():
    """
    Get basic information about the ARGO float.
    """

    ds = load_argo_data()

    try:
        latitude = ds["LATITUDE"].values.tolist()
        longitude = ds["LONGITUDE"].values.tolist()

        return {
            "float_id": "5904300",
            "profile_count": len(latitude),
            "latitude": latitude,
            "longitude": longitude
        }

    finally:
        ds.close()