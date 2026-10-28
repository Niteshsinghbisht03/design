from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.app.config import MATERIALS_DIR, UPLOADS_DIR, CORS_ORIGINS, FRONTEND_DIST
from backend.app.api.materials import router as materials_router
from backend.app.api.patterns import router as patterns_router
from backend.app.api.vectorize import router as vectorize_router

app = FastAPI(
    title="Tile Studio Pro API",
    description="High-performance backend for custom ceramic tile design, material texture mapping, and AI raster vectorization.",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for 40 photographic materials and uploads
app.mount("/static/materials", StaticFiles(directory=str(MATERIALS_DIR)), name="materials")
app.mount("/static/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Mount API routers under /api
app.include_router(materials_router, prefix="/api")
app.include_router(patterns_router, prefix="/api")
app.include_router(vectorize_router, prefix="/api")

@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "healthy",
        "service": "Tile Studio Pro API",
        "version": "2.0.0"
    }

# If production frontend build exists, mount it to serve the complete SPA
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/", tags=["system"])
    async def root():
        return {
            "message": "Tile Studio Pro API is running. Start the frontend Vite dev server or run 'npm run build' inside frontend/ to serve the SPA."
        }

