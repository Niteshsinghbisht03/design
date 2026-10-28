# Tile Design Studio Pro (React + FastAPI)

A production-grade, full-stack architectural ceramic tile design platform.

- **Frontend**: React 18, Vite, Lucide React, HTML5 Canvas High-Res Export Engine
- **Backend**: FastAPI, OpenCV, NumPy, Uvicorn, Python-Multipart
- **Tile System**: 250 × 250 × 22 mm encaustic & terrazzo floor tiles

---

## Key Features

1. **Authentic Scanned Textures**:
   - 40 physical scans of marble, terrazzo aggregates, terracotta, and mineral pigments.
   - Dynamic SVG `<pattern>` generation with instant region mapping.

2. **Interactive 250×250mm Tile Specimen Stage**:
   - Clickable SVG vector paths with hover preview and active amber glow.
   - Region selector pills showing live material swatch pips.
   - 90° step rotation, material harmonizer, and reset tools.

3. **4×4 Floor Repeat Installation (16 Tiles)**:
   - Full 4×4 floor field simulation.
   - 90° step rotation and alternating windmill / checkerboard rotation modes.
   - Dynamic grout mortar joint simulator (0 to 4.0 mm) with customizable mortar tones.

4. **Tile Quantity & Box Calculator**:
   - Calculates exact floor area ($m^2$ and $sq\ ft$).
   - Computes base tiles needed (16 tiles/$m^2$ at 0.0625 $m^2$/tile).
   - Automatically factors standard +10% cutting buffer and box packaging (12 tiles/box).

5. **Client Deliverables & High-Res Export Engine**:
   - **Client Specification Sheet (1200×1400 PNG)**: Includes 1×1 tile specimen, 4×4 repeat layout, project metadata, and physical material scan swatches.
   - **Seamless 3D Texture Map (1024×1024 PNG)**: Diffuse texture map for 3D rendering in Blender, SketchUp, 3ds Max, or Unreal Engine.
   - **Base64 Inlining**: Automatically converts texture URLs to data URLs during export to prevent HTML5 canvas CORS taint.
   - **WhatsApp Client Link**: One-click sharing with formatted tile specification.

6. **Custom Tile Import & AI Raster Vectorizer**:
   - **Vector SVG Upload**: Drag-and-drop `.svg` files with automatic coordinate normalization to 100×100 viewBox and region parsing.
   - **AI Raster Vectorizer (`POST /api/vectorize`)**:
     - Mode A: Black line art & inking binarization.
     - Mode B: Segmented color ceramic tile decomposition.
     - D4 Dihedral Symmetry (4 rotations × 2 reflections).
     - Morphological inner fill boundary generation tucked 2px beneath the black ink outlines.

---

## Project Structure

```
design/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── materials.py       # GET /api/materials
│   │   │   ├── patterns.py        # GET & POST /api/patterns
│   │   │   └── vectorize.py       # POST /api/vectorize
│   │   ├── data/
│   │   │   ├── materials.json     # 40 scanned physical materials
│   │   │   └── patterns.json      # 9 field patterns + 4 borders
│   │   ├── services/
│   │   │   └── vectorizer_service.py # OpenCV & NumPy D4 vectorizer
│   │   ├── config.py              # Paths, CORS, storage
│   │   └── main.py                # FastAPI app & static file mounts
│   ├── static/
│   │   ├── materials/             # 40 authentic JPEG scans
│   │   └── uploads/               # Processed vector uploads
│   ├── requirements.txt           # Python dependencies
│   └── run_backend.py             # Uvicorn direct runner
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActionBar.jsx      # Calculator, undo/redo, exports
│   │   │   ├── FloorPreview.jsx   # 4x4 repeat & grout simulator
│   │   │   ├── Header.jsx         # Branding, tabs, theme toggle
│   │   │   ├── MaterialLibrary.jsx# 40 texture cards & search
│   │   │   ├── Sidebar.jsx        # Categories & pattern thumbnails
│   │   │   ├── Stage.jsx          # Interactive 250x250 single tile
│   │   │   ├── Toast.jsx          # Toast notifications
│   │   │   └── UploadModal.jsx    # SVG upload & AI vectorizer
│   │   ├── context/
│   │   │   └── StudioContext.jsx  # Global state & undo/redo
│   │   ├── services/
│   │   │   ├── api.js             # Backend API client
│   │   │   ├── exportEngine.js    # Canvas PNG & 3D texture exports
│   │   │   └── svgParser.js       # Client-side SVG parser
│   │   ├── App.css                # Luxury studio theme (dark/light)
│   │   ├── App.jsx                # Layout root
│   │   └── main.jsx               # Vite React entry point
│   ├── package.json               # Frontend dependencies
│   └── vite.config.js             # Vite config with API proxy
│
├── Dockerfile                     # Multi-stage production build
├── docker-compose.yml             # Docker compose deployment
├── run_dev.bat                    # Windows development launcher
├── run_production.bat             # Windows production launcher
└── README.md
```

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+

### Development Mode

Run the Windows launcher:
```cmd
run_dev.bat
```

Or start the servers manually:

1. **Start FastAPI Backend**:
   ```cmd
   pip install -r backend/requirements.txt
   python backend/run_backend.py
   ```
   Backend runs at: `http://localhost:8000` (Swagger docs at `/docs`)

2. **Start Vite React Frontend**:
   ```cmd
   cd frontend
   npm install
   npm run dev
   ```
   Frontend runs at: `http://localhost:5173`

---

### Production Mode (Unified Single Server)

Build the React frontend and run FastAPI:
```cmd
run_production.bat
```
FastAPI serves the complete React SPA, the API endpoints, and the texture assets at:
`http://localhost:8000`

---

### Docker Deployment

Run with Docker Compose:
```cmd
docker-compose up --build
```
Access the application at `http://localhost:8000`.

