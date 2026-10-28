import json
from fastapi import APIRouter, HTTPException
from backend.app.config import DATA_DIR

router = APIRouter(prefix="/materials", tags=["materials"])

@router.get("")
async def get_materials():
    """Retrieve all 40 authentic mineral and photographic material textures."""
    file_path = DATA_DIR / "materials.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Materials catalog not found")
    with open(file_path, "r", encoding="utf-8") as f:
        materials = json.load(f)
    return {
        "count": len(materials),
        "materials": materials
    }

