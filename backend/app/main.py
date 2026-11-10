from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.dataset import router as dataset_router

app = FastAPI(
    title="EnergyPulse API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dataset_router)

@app.get("/")
def root():
    return {
        "message": "Welcome to EnergyPulse 2.0!",
        "status": "Backend is running"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "EnergyPulse"
    }