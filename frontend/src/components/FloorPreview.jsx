import React from 'react';
import { useStudio } from '../context/StudioContext';
import { buildSvgDefs, buildTileInnerSvg, getFillOf } from '../services/exportEngine';
import { RotateCw, Grid, Sliders, RefreshCw } from 'lucide-react';

export default function FloorPreview() {
  const {
    tab,
    currentPattern,
    currentFills,
    materials,
    tileRotation,
    rotateTile90,
    altRotation,
    toggleAltRotation,
    groutWidth,
    setGroutWidth,
    groutColor,
    setGroutColor,
    centerFillActive,
    centerFillColor
  } = useStudio();

  if (!currentPattern) return null;

  const groutPresets = [
    { name: 'Sand Cream', value: '#e2dbd2' },
    { name: 'Pure White', value: '#ffffff' },
    { name: 'Concrete Gray', value: '#8c827a' },
    { name: 'Charcoal Black', value: '#24201d' }
  ];

  // Helper to build 4x4 SVG content
  const render4x4Grid = () => {
    const tileInner = buildTileInnerSvg(currentPattern, currentFills, materials, false);
    const size = 400;
    const items = [];

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        let rot = tileRotation;
        if (altRotation && (x + y) % 2 === 1) {
          rot = (rot + 90) % 360;
        }
        const transform = `translate(${x * 100} ${y * 100}) rotate(${rot} 50 50)`;
        items.push(
          <g key={`${x}-${y}`} transform={transform}>
            <use href="#baseTileUnit" />
          </g>
        );
      }
    }

    // Effective grout gap padding calculation
    // Scale gap relative to 100x100 viewBox (e.g. 2.5mm on 250mm tile is 1% -> 1.0 SVG unit)
    const gapSvg = (groutWidth / 250) * 100;

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="floor-svg">
        <g dangerouslySetInnerHTML={{ __html: buildSvgDefs(materials, false) }} />
        <defs>
          <g id="baseTileUnit" dangerouslySetInnerHTML={{ __html: tileInner }} />
        </defs>
        {/* Grout background */}
        <rect width={size} height={size} fill={groutColor} />
        {/* Clipped or spaced tiles */}
        <g style={{ transform: gapSvg > 0 ? `scale(${1 - (gapSvg * 4) / size})` : undefined, transformOrigin: 'center' }}>
          {items}
        </g>
      </svg>
    );
  };

  // Helper to build 6x6 Border Grid SVG
  const renderBorderGrid = () => {
    const tileInner = buildTileInnerSvg(currentPattern, currentFills, materials, false);
    const centerFill = centerFillActive ? getFillOf(centerFillColor, materials) : '#f4ece3';
    const cells = [];

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const x = c * 100;
        const y = r * 100;
        let angle = null;
        if (r === 0) angle = 0;
        else if (r === 5) angle = 180;
        else if (c === 5) angle = 90;
        else if (c === 0) angle = 270;

        if (angle === null) {
          cells.push(
            <rect
              key={`${r}-${c}`}
              x={x}
              y={y}
              width={100}
              height={100}
              fill={centerFill}
              stroke="#e5dbd0"
              strokeWidth="0.8"
            />
          );
        } else {
          cells.push(
            <use
              key={`${r}-${c}`}
              href="#borderUnitRepeat"
              transform={`translate(${x} ${y}) rotate(${angle} 50 50)`}
            />
          );
        }
      }
    }

    return (
      <svg viewBox="0 0 600 600" className="floor-svg">
        <g dangerouslySetInnerHTML={{ __html: buildSvgDefs(materials, false) }} />
        <defs>
          <g id="borderUnitRepeat" dangerouslySetInnerHTML={{ __html: tileInner }} />
        </defs>
        <rect width={600} height={600} fill={groutColor} />
        {cells}
      </svg>
    );
  };

  return (
    <div className="floor-preview-card">
      <div className="floor-header">
        <div className="floor-title-wrap">
          <span className="step-tag">Step 2</span>
          <h2 className="floor-heading">
            {tab === 'p' ? 'Floor Installation (4 × 4 Repeat)' : 'Perimeter Border Frame (6 × 6 Grid)'}
          </h2>
          <span className="repeat-badge">
            {tab === 'p' ? `${tileRotation}° orientation` : 'Mitred border layout'}
          </span>
        </div>

        {tab === 'p' && (
          <div className="floor-controls-bar">
            <button
              className="ctrl-pill-btn"
              onClick={rotateTile90}
              title="Rotate all tiles in repeat by 90°"
            >
              <RotateCw size={14} />
              <span>Step 90°</span>
            </button>
            <button
              className={`ctrl-pill-btn ${altRotation ? 'active' : ''}`}
              onClick={toggleAltRotation}
              title="Toggle alternating windmill / checkerboard rotation"
            >
              <RefreshCw size={14} />
              <span>Alternating Windmill</span>
            </button>
          </div>
        )}
      </div>

      <div className="floor-viewport-outer">
        <div className="floor-svg-container">
          {tab === 'p' ? render4x4Grid() : renderBorderGrid()}
        </div>
      </div>

      <div className="floor-grout-simulator">
        <div className="grout-control-item">
          <label htmlFor="groutSlider" className="grout-label">
            <Sliders size={14} />
            <span>Grout Joint Width: <b>{groutWidth.toFixed(1)} mm</b></span>
          </label>
          <input
            id="groutSlider"
            type="range"
            min="0"
            max="4"
            step="0.5"
            value={groutWidth}
            onChange={(e) => setGroutWidth(parseFloat(e.target.value))}
            className="grout-range-input"
          />
        </div>

        <div className="grout-tone-item">
          <span className="grout-tone-title">Grout Mortar Tone:</span>
          <div className="grout-swatches">
            {groutPresets.map((g) => (
              <button
                key={g.value}
                className={`grout-dot ${groutColor === g.value ? 'selected' : ''}`}
                style={{ backgroundColor: g.value }}
                onClick={() => setGroutColor(g.value)}
                title={g.name}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

