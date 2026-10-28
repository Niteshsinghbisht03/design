import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

STATIC_DIR = BASE_DIR / "static"
MATERIALS_DIR = STATIC_DIR / "materials"
UPLOADS_DIR = STATIC_DIR / "uploads"
DATA_DIR = BASE_DIR / "app" / "data"
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

MATERIALS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "*"
]

