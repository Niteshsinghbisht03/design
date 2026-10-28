import React from 'react';
import { useStudio } from '../context/StudioContext';
import { buildSvgDefs, getFillOf } from '../services/exportEngine';
import { RotateCw, Sparkles, RotateCcw } from 'lucide-react';

export default function Stage() {
  const {
    tab,
    currentPattern,
    currentFills,
    selectedRegion,
    setSelectedRegion,
    centerFillActive,
    centerFillColor,
    materials,
    rotateTile90,
    randomizeMaterials,
    resetColors
  } = useStudio();

  if (!currentPattern) {
    return (
      <div className="stage-empty">
        <p>No tile pattern loaded.</p>
      </div>
    );
  }

  // Handle click on SVG path
  const handleSvgClick = (e) => {
    const path = e.target.closest('path');
    if (path && path.dataset.r != null) {
      const regIdx = parseInt(path.dataset.r, 10);
      setSelectedRegion(regIdx);
    }
  };

  const getStatusText = () => {
    if (selectedRegion === null) {
      return 'Click on any shape in the tile above (or in the region list below) to begin applying materials.';
    }
    if (selectedRegion === 'c') {
      const centerM = centerFillColor != null ? materials[centerFillColor] : null;
      return `Selected: Center Field (${centerFillActive && centerM ? centerM.name : 'Unfilled'}) — choose an authentic texture from the right library.`;
    }
    const regName = currentPattern.r[selectedRegion]?.n || `Region ${selectedRegion + 1}`;
    const fillIdx = currentFills[selectedRegion];
    const fillName = fillIdx != null && materials[fillIdx] ? materials[fillIdx].name : 'Unfilled';
    return `Editing: ${regName} [${fillName}] — choose an authentic texture from the right library.`;
  };

  return (
    <div className="stage-container">
      <div className="stage-card-header">
        <div className="stage-title-wrap">
          <span className="step-tag">Step 1</span>
          <h2 className="stage-tile-title">
            {currentPattern.name || currentPattern.id} <span className="dim-id">({currentPattern.id})</span>
          </h2>
        </div>

        <div className="stage-toolbar-actions">
          <button
            className="tool-btn"
            onClick={rotateTile90}
            title="Rotate tile 90° clockwise"
          >
            <RotateCw size={15} />
            <span>Rotate 90°</span>
          </button>
          <button
            className="tool-btn"
            onClick={randomizeMaterials}
            title="Harmonize with random coordinating authentic textures"
          >
            <Sparkles size={15} />
            <span>Harmonize</span>
          </button>
          <button
            className="tool-btn"
            onClick={resetColors}
            title="Reset tile colors to white"
          >
            <RotateCcw size={15} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="stage-viewport-outer">
        <div className="stage-svg-wrapper">
          <svg
            id="stageSvg"
            viewBox="0 0 100 100"
            className="interactive-tile-svg"
            onClick={handleSvgClick}
          >
            {/* Dynamic Pattern Definitions */}
            <g dangerouslySetInnerHTML={{ __html: buildSvgDefs(materials, false) }} />

            {/* Pattern Path Elements */}
            {currentPattern.r.map((region, rIdx) => {
              const isSelected = selectedRegion === rIdx;
              const fillVal = getFillOf(currentFills[rIdx], materials);

              return region.e.map(([d, t], eIdx) => (
                <path
                  key={`${rIdx}-${eIdx}`}
                  data-r={rIdx}
                  d={d}
                  transform={t || undefined}
                  fill={fillVal}
                  stroke={isSelected ? '#d97706' : (currentPattern.outline ? 'none' : '#24201d')}
                  strokeWidth={isSelected ? '1.4' : '0.6'}
                  strokeLinejoin="round"
                  fillRule="evenodd"
                  className={`stage-path ${isSelected ? 'selected-path' : ''}`}
                />
              ));
            })}

            {/* Master Ink Linework Overlay (from Vectorizer) */}
            {currentPattern.outline && (
              <path
                d={currentPattern.outline.d}
                transform={currentPattern.outline.transform || undefined}
                fill="#000000"
                fillRule="evenodd"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </svg>
        </div>
      </div>

      <div className="stage-status-bar">
        <div className="status-indicator-dot" />
        <span className="status-message">{getStatusText()}</span>
      </div>

      {/* Region Chips Selector Bar */}
      <div className="region-chips-wrapper">
        <span className="region-label-hint">Tile Segments:</span>
        <div className="region-chips-list">
          {currentPattern.r.map((reg, idx) => {
            const isSelected = selectedRegion === idx;
            const mi = currentFills[idx];
            const m = mi != null ? materials[mi] : null;
            const mName = m ? m.name : 'Unfilled';

            let pipStyle = { background: '#ffffff' };
            if (m) {
              if (m.isColor) {
                pipStyle = { background: m.file };
              } else {
                const src = m.file.startsWith('/') ? m.file : `/static/materials/${m.file}`;
                pipStyle = { backgroundImage: `url(${src})`, backgroundSize: 'cover' };
              }
            }

            return (
              <button
                key={idx}
                className={`region-chip-btn ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedRegion(idx)}
              >
                <span className="region-pip" style={pipStyle} />
                <span className="region-chip-name">{reg.n}</span>
                <span className="region-mat-tag">{mName}</span>
              </button>
            );
          })}

          {tab === 'b' && (
            <button
              className={`region-chip-btn ${selectedRegion === 'c' ? 'active' : ''}`}
              onClick={() => setSelectedRegion('c')}
            >
              <span
                className="region-pip"
                style={{
                  background: centerFillColor != null && materials[centerFillColor]
                    ? (materials[centerFillColor].isColor
                        ? materials[centerFillColor].file
                        : `url(/static/materials/${materials[centerFillColor].file})`)
                    : '#ffffff',
                  backgroundSize: 'cover'
                }}
              />
              <span className="region-chip-name">Center Field</span>
              <span className="region-mat-tag">
                {centerFillActive && centerFillColor != null && materials[centerFillColor]
                  ? materials[centerFillColor].name
                  : 'Unfilled'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

