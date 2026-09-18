from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.floats import router as floats_router
from app.api.routes.telemetry import router as telemetry_router
from app.api.routes.query import router as query_router
from app.api.routes.anomalies import router as anomalies_router
from app.api.routes.profile import router as profile_router
from app.api.routes.profile_4d import router as profile_4d_router
from app.api.routes.profile_analysis import router as profile_analysis_router
from app.api.routes.natural_query import router as natural_query_router
from app.api.routes.visualization_4d import router as visualization_4d_router


app = FastAPI(
    title="FloatChat API",
    description="Backend API for ARGO Ocean Data Platform",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(floats_router)
app.include_router(telemetry_router)
app.include_router(query_router)
app.include_router(anomalies_router)
app.include_router(profile_router)
app.include_router(profile_4d_router)
app.include_router(profile_analysis_router)
app.include_router(natural_query_router)
app.include_router(visualization_4d_router)


@app.get("/")
def root():
    return {
        "message": "FloatChat Backend is running!"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "FloatChat API"
    }