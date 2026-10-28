# ==============================================================================
# Multi-Stage Production Dockerfile for Tile Design Studio Pro
# Frontend: React 18 + Vite
# Backend: FastAPI + OpenCV + NumPy + Uvicorn
# ==============================================================================

# --- Stage 1: Build React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python FastAPI Production Runner ---
FROM python:3.11-slim AS production

# Install system dependencies required for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application
COPY backend/ ./backend/

# Copy built frontend assets from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure storage directories exist
RUN mkdir -p /app/backend/static/materials /app/backend/static/uploads /app/backend/app/data

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["python", "backend/run_backend.py"]

