from fastapi import APIRouter
from app.services.argo_service import get_float_summary

router = APIRouter(
    prefix="/api/floats",
    tags=["ARGO Floats"]
)


@router.get("/")
def get_floats():
    """
    Return real ARGO float information.
    """

    float_data = get_float_summary()

    return {
        "count": 1,
        "floats": [float_data]
    }