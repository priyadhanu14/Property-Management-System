from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import router as api_v1


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Bahuleya PMS API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1, prefix="/api/v1", tags=["v1"])


@app.get("/health")
async def health():
    return {"status": "ok"}
