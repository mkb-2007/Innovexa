import os
from pathlib import Path

# Base backend directory: .../backend
BACKEND_DIR = Path(__file__).resolve().parents[2]

# Environment override or default relative to backend/data/argo
DEFAULT_ARGO_PATH = BACKEND_DIR / "data" / "argo" / "5904300_prof.nc"

ARGO_FILE_PATH_ENV = os.getenv("ARGO_NETCDF_PATH")
if ARGO_FILE_PATH_ENV:
    ARGO_FILE = Path(ARGO_FILE_PATH_ENV).resolve()
else:
    ARGO_FILE = DEFAULT_ARGO_PATH


def get_argo_file() -> Path:
    if not ARGO_FILE.exists():
        # Fallback check relative to cwd
        cwd_candidate = Path("data/argo/5904300_prof.nc").resolve()
        if cwd_candidate.exists():
            return cwd_candidate
        cwd_backend_candidate = Path("backend/data/argo/5904300_prof.nc").resolve()
        if cwd_backend_candidate.exists():
            return cwd_backend_candidate
        raise FileNotFoundError(f"ARGO NetCDF file not found at: {ARGO_FILE}")
    return ARGO_FILE
