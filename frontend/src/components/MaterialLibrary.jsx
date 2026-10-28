import React, { useState, useMemo } from 'react';
import { useStudio } from '../context/StudioContext';
import { Palette, Check, Search } from 'lucide-react';

export default function MaterialLibrary() {
  const {
    materials,
    selectedRegion,
    currentFills,
    centerFillColor,
    applyMaterial
  } = useStudio();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  // Currently active material index on the selected region
  const activeMatIndex = useMemo(() => {
    if (selectedRegion === 'c') return centerFillColor;
    if (selectedRegion !== null) return currentFills[selectedRegion];
    return null;
  }, [selectedRegion, centerFillColor, currentFills]);

  const filteredMaterials = useMemo(() => {
    return materials.map((m, idx) => ({ ...m, origIndex: idx })).filter(m => {
      const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.file.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (filterCategory === 'All') return true;
      if (filterCategory === 'Colors') return m.isColor;
      if (filterCategory === 'Textures') return !m.isColor;
      return true;
    });
  }, [materials, searchQuery, filterCategory]);

  return (
    <aside className="material-library-panel">
      <div className="material-panel-header">
        <div className="material-title-wrap">
          <Palette size={18} className="accent-icon" />
          <h2 className="material-heading">Physical Textures</h2>
          <span className="count-badge">{materials.length} Scans</span>
        </div>
        <p className="material-subhead">
          Authentic scanned stone, terrazzo, and encaustic mineral pigments.
        </p>
      </div>

      <div className="material-filter-row">
        <div className="material-search-wrap">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search 40 textures..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="material-search-input"
          />
        </div>

        <div className="material-type-pills">
          {['All', 'Textures', 'Colors'].map(cat => (
            <button
              key={cat}
              className={`pill-btn ${filterCategory === cat ? 'active' : ''}`}
              onClick={() => setFilterCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="material-swatches-grid">
        {filteredMaterials.map((m) => {
          const isCurrentApplied = activeMatIndex === m.origIndex;
          const srcUrl = m.file.startsWith('/') ? m.file : `/static/materials/${m.file}`;

          return (
            <button
              key={m.id}
              className={`swatch-card ${isCurrentApplied ? 'applied' : ''}`}
              onClick={() => applyMaterial(m.origIndex)}
              title={`${m.name} (${m.file}) — Click to apply`}
            >
              <div className="swatch-thumb-box">
                {m.isColor ? (
                  <div className="swatch-color-fill" style={{ backgroundColor: m.file }} />
                ) : (
                  <img
                    src={srcUrl}
                    alt={m.name}
                    loading="lazy"
                    className="swatch-img"
                  />
                )}
                {isCurrentApplied && (
                  <div className="swatch-active-badge">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </div>
              <div className="swatch-meta">
                <span className="swatch-name">{m.name}</span>
                <span className="swatch-id">#{m.origIndex + 1}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

