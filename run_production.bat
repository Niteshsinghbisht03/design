@echo off
echo ========================================================
echo Building and Starting Tile Design Studio Pro (Production)
echo Unified App URL: http://localhost:8000
echo ========================================================

echo Step 1: Building React Vite production bundle...
call npm run build --prefix frontend

echo.
echo Step 2: Starting FastAPI production server...
python backend\run_backend.py

