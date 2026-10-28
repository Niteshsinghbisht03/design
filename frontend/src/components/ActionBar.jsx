import React, { useState, useMemo } from 'react';
import { useStudio } from '../context/StudioContext';
import {
  exportClientSpecPng,
  export3dTextureMap,
  generateWhatsAppLink
} from '../services/exportEngine';
import {
  Calculator,
  Download,
  Share2,
  Undo2,
  Redo2,
  Package,
  Layers,
  Sparkles,
  FileCheck
} from 'lucide-react';

export default function ActionBar() {
  const {
    tab,
    currentPattern,
    currentFills,
    materials,
    clientName,
    roomArea,
    tileRotation,
    altRotation,
    groutColor,
    centerFillActive,
    centerFillColor,
    undo,
    redo,
    canUndo,
    canRedo,
    showToast
  } = useStudio();

  // Calculator inputs
  const [roomLength, setRoomLength] = useState(4.5);
  const [roomWidth, setRoomWidth] = useState(3.2);
  const [isExportingSpec, setIsExportingSpec] = useState(false);
  const [isExporting3d, setIsExporting3d] = useState(false);

  // Estimator Calculations for 250x250mm tile (0.0625 m² per tile = 16 tiles/m²)
  const calcResults = useMemo(() => {
    const l = parseFloat(roomLength) || 0;
    const w = parseFloat(roomWidth) || 0;
    const areaM2 = l * w;
    const areaSqFt = areaM2 * 10.7639;
    const exactTiles = Math.ceil(areaM2 / 0.0625);
    const bufferedTiles = Math.ceil(exactTiles * 1.10); // +10% standard wastage
    const boxes = Math.ceil(bufferedTiles / 12); // 12 tiles/box

    return {
      areaM2: areaM2.toFixed(1),
      areaSqFt: areaSqFt.toFixed(1),
      exactTiles,
      bufferedTiles,
      boxes
    };
  }, [roomLength, roomWidth]);

  // Check if at least one fill has been applied
  const hasAppliedColors = useMemo(() => {
    const keys = Object.keys(currentFills || {});
    return keys.length > 0 || (tab === 'b' && centerFillActive && centerFillColor != null);
  }, [currentFills, tab, centerFillActive, centerFillColor]);

  // Trigger Spec Sheet Export
  const handleExportSpec = async () => {
    if (!currentPattern) return;
    try {
      setIsExportingSpec(true);
      showToast('Generating high-resolution client presentation sheet...');
      await exportClientSpecPng({
        pattern: currentPattern,
        fills: currentFills,
        materials,
        clientName,
        roomArea,
        tileRotation,
        altRotation,
        groutColor,
        tab,
        centerFillActive,
        centerFillColor,
        brandName: 'Tile Studio Pro'
      });
      showToast('Downloaded Client Specification Sheet (PNG)');
    } catch (err) {
      console.error('Spec sheet export error:', err);
      showToast('Export failed: ' + err.message);
    } finally {
      setIsExportingSpec(false);
    }
  };

  // Trigger 3D Seamless Texture Export
  const handleExport3D = async () => {
    if (!currentPattern) return;
    try {
      setIsExporting3d(true);
      showToast('Rendering 1024×1024 seamless 3D diffuse map...');
      await export3dTextureMap({
        pattern: currentPattern,
        fills: currentFills,
        materials
      });
      showToast('Downloaded 1024×1024 Seamless 3D Texture Map');
    } catch (err) {
      console.error('3D export error:', err);
      showToast('Export failed: ' + err.message);
    } finally {
      setIsExporting3d(false);
    }
  };

  // Trigger WhatsApp share
  const handleWhatsAppShare = () => {
    if (!currentPattern) return;
    const link = generateWhatsAppLink({
      brand: 'Tile Design Studio Pro',
      pattern: currentPattern,
      fills: currentFills,
      materials,
      clientName,
      roomArea
    });
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <footer className="studio-action-bar">
      {/* Tile Quantity Calculator Card */}
      <div className="calc-panel-card">
        <div className="calc-panel-title">
          <Calculator size={16} className="calc-icon" />
          <span>Tile Quantity & Packaging Estimator</span>
        </div>
        <div className="calc-inputs-row">
          <div className="calc-field">
            <label>Length (m)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={roomLength}
              onChange={(e) => setRoomLength(e.target.value)}
            />
          </div>
          <span className="mult-sign">×</span>
          <div className="calc-field">
            <label>Width (m)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={roomWidth}
              onChange={(e) => setRoomWidth(e.target.value)}
            />
          </div>
        </div>
        <div className="calc-metrics-display">
          <div className="calc-metric">
            <span className="metric-label">Floor Area:</span>
            <span className="metric-val">{calcResults.areaM2} m² ({calcResults.areaSqFt} sq ft)</span>
          </div>
          <div className="calc-metric">
            <span className="metric-label">Exact Tiles:</span>
            <span className="metric-val">{calcResults.exactTiles} pcs</span>
          </div>
          <div className="calc-metric highlight">
            <span className="metric-label">+10% Cut Buffer:</span>
            <span className="metric-val"><b>{calcResults.bufferedTiles} tiles</b> ({calcResults.boxes} boxes @ 12/box)</span>
          </div>
        </div>
      </div>

      {/* Undo / Redo History Controls */}
      <div className="history-controls-panel">
        <button
          className="history-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
          <span>Undo</span>
        </button>
        <button
          className="history-btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={16} />
          <span>Redo</span>
        </button>
      </div>

      {/* Client Deliverables & High-Res Export Suite */}
      <div className="exports-suite-panel">
        <div className="export-status-note">
          <FileCheck size={14} />
          <span>
            {hasAppliedColors
              ? 'Design ready for high-resolution production sheet export.'
              : 'Select tile regions and apply authentic materials above.'}
          </span>
        </div>

        <div className="export-buttons-group">
          <button
            className="btn-export-primary"
            onClick={handleExportSpec}
            disabled={!hasAppliedColors || isExportingSpec}
            title="Download 1200×1400 client presentation sheet with physical scan swatch legend"
          >
            <Download size={16} />
            <span>{isExportingSpec ? 'Rendering...' : 'Spec Sheet (PNG)'}</span>
          </button>

          <button
            className="btn-export-secondary"
            onClick={handleExport3D}
            disabled={!hasAppliedColors || isExporting3d}
            title="Download 1024×1024 seamless square diffuse texture map for Blender, SketchUp, 3ds Max"
          >
            <Layers size={16} />
            <span>{isExporting3d ? 'Generating...' : '3D Texture (1024²)'}</span>
          </button>

          <button
            className="btn-export-share"
            onClick={handleWhatsAppShare}
            title="Share material specification text directly with client via WhatsApp"
          >
            <Share2 size={16} />
            <span>WhatsApp Spec</span>
          </button>
        </div>
      </div>
    </footer>
  );
}

