@echo off
echo ========================================================
echo Starting Tile Design Studio Pro (Development Mode)
echo Backend: FastAPI on http://localhost:8000
echo Frontend: Vite React on http://localhost:5173
echo ========================================================

start "Tile Studio Pro - Backend API" cmd /k "python backend\run_backend.py"
start "Tile Studio Pro - React Frontend" cmd /k "npm run dev --prefix frontend"

echo.
echo Both servers started!
echo Open your browser at http://localhost:5173
echo API documentation available at http://localhost:8000/docs

