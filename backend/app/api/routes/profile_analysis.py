from fastapi import APIRouter

from app.services.profile_analysis_service import analyze_profile


router = APIRouter(
    prefix="/api/profile-analysis",
    tags=["Profile Analysis"]
)


@router.get("/{profile_index}")
def get_profile_analysis(profile_index: int):
    return analyze_profile(profile_index)