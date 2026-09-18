from fastapi import APIRouter

from app.services.anomaly_service import detect_temperature_anomalies


router = APIRouter(
    prefix="/api/anomalies",
    tags=["Ocean Anomalies"]
)


@router.get("/{profile_index}")
def get_anomalies(profile_index: int):
    return detect_temperature_anomalies(profile_index)