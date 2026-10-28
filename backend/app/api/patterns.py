import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Any, Optional
from backend.app.config import DATA_DIR

router = APIRouter(prefix="/patterns", tags=["patterns"])

class CustomPatternCreate(BaseModel):
    name: str
    cat: Optional[str] = "Custom"
    r: List[Any]

@router.get("")
async def get_patterns():
    """Retrieve catalog patterns (C-001 through C-009) and borders (B-001 through B-004)."""
    file_path = DATA_DIR / "patterns.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Patterns catalog not found")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

@router.post("")
async def add_custom_pattern(pattern: CustomPatternCreate):
    """Save a user-uploaded custom tile pattern."""
    file_path = DATA_DIR / "patterns.json"
    data = {"patterns": [], "borders": []}
    if file_path.exists():
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    
    custom_count = len([p for p in data["patterns"] if p.get("cat") == "Custom"])
    new_id = f"U-{str(custom_count + 1).zfill(3)}"
    new_item = {
        "id": new_id,
        "name": pattern.name,
        "cat": pattern.cat or "Custom",
        "r": pattern.r
    }
    data["patterns"].append(new_item)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return {"message": "Pattern added successfully", "pattern": new_item}

