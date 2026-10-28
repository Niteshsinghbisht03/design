import logging
import traceback
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from fastapi.responses import Response
from backend.app.services.vectorizer_service import vectorize_image_bytes

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/vectorize", tags=["vectorize"])

@router.post("")
async def vectorize_tile(
    file: UploadFile = File(...),
    mode: str = Query("auto", pattern="^(auto|lineart|colored)$"),
    symmetric: bool = Query(None),
    format: str = Query("json", pattern="^(json|svg)$")
):
    """
    Vectorize an uploaded raster tile image (JPEG, PNG, WebP) into scalable SVG
    with uniform outlines and 2px tucked color fill regions.
    Supports auto-detecting colored ceramic tiles vs line art sketches.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        result = vectorize_image_bytes(
            image_bytes=content,
            mode=mode,
            symmetric=symmetric
        )

        if format == "svg":
            return Response(content=result["svg"], media_type="image/svg+xml")

        return {
            "success": True,
            "status": "success",
            "filename": file.filename,
            "mode": result["mode"],
            "requested_mode": result.get("requested_mode", mode),
            "symmetric": result["symmetric"],
            "region_count": result["region_count"],
            "svg": result["svg"],
            "width": result["width"],
            "height": result["height"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vectorization exception: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Vectorization failed: {str(e)}")
