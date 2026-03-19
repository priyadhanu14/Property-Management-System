from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.api.v1 import router as api_v1
from app.db.session import async_session_maker
from app.models.room import RoomType, Room

DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"

# Fixed rooms for Bahuleya Service Apartments
SEED_ROOM_TYPES = ["2BHK", "3BHK"]
SEED_ROOMS = [
    # (unit_code, room_type_name)
    ("A4", "2BHK"),
    ("B1", "2BHK"),
    ("B2", "2BHK"),
    ("B3", "2BHK"),
    ("B4", "2BHK"),
    ("C1", "3BHK"),
]


async def seed_rooms() -> None:
    """Insert the fixed set of rooms if they don't exist yet."""
    async with async_session_maker() as session:
        # Ensure room types exist
        type_map: dict[str, int] = {}
        for name in SEED_ROOM_TYPES:
            result = await session.execute(
                select(RoomType).where(RoomType.name == name)
            )
            rt = result.scalar_one_or_none()
            if not rt:
                rt = RoomType(name=name)
                session.add(rt)
                await session.flush()
            type_map[name] = rt.id

        # Ensure rooms exist
        for unit_code, type_name in SEED_ROOMS:
            result = await session.execute(
                select(Room).where(Room.unit_code == unit_code)
            )
            if not result.scalar_one_or_none():
                session.add(
                    Room(
                        unit_code=unit_code,
                        room_type_id=type_map[type_name],
                        is_active=True,
                    )
                )

        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_rooms()
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
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def ngrok_skip_warning(request: Request, call_next):
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "1"
    return response

app.include_router(api_v1, prefix="/api/v1", tags=["v1"])


@app.api_route("/health", methods=["GET", "HEAD"], include_in_schema=False)
def health():
    return {"status": "ok"}
# ---------------------------------------------------------------------------
# Serve the built React frontend (Vite) from the same process.
# Only active when frontend/dist exists (i.e. after `npm run build`).
# ---------------------------------------------------------------------------
if DIST_DIR.is_dir():
    if (DIST_DIR / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="static-assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        file = (DIST_DIR / full_path).resolve()
        if full_path and file.is_relative_to(DIST_DIR) and file.exists() and file.is_file():
            return FileResponse(file)
        return FileResponse(DIST_DIR / "index.html")
