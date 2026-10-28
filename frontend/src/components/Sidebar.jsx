import React from 'react';
import { useStudio } from '../context/StudioContext';
import { buildTileInnerSvg } from '../services/exportEngine';
import { UploadCloud, Sparkles } from 'lucide-react';

export default function Sidebar({ onOpenUpload }) {
  const {
    tab,
    cat,
    setCat,
    allPatterns,
    borders,
    currentPattern,
    selectPattern,
    materials
  } = useStudio();

  const categories = tab === 'p'
    ? ['All', 'Geometric', 'Classic', 'Modern', 'Floral', 'Custom']
    : ['All'];

  const displayedList = tab === 'p'
    ? allPatterns.filter(p => cat === 'All' || p.cat === cat)
    : borders;

  return (
    <aside className="studio-sidebar">
      <div className="sidebar-header">
        <div className="section-title-wrap">
          <h2 className="sidebar-heading">
            {tab === 'p' ? 'Catalog Patterns' : 'Border Profiles'}
          </h2>
          <span className="count-badge">{displayedList.length}</span>
        </div>

        <button
          className="btn-upload-trigger"
          onClick={onOpenUpload}
          title="Upload vector SVG or convert photo with AI"
        >
          <UploadCloud size={16} />
          <span>Upload Custom Tile</span>
        </button>
      </div>

      {tab === 'p' && (
        <div className="category-chips-scroll">
          {categories.map((c) => (
            <button
              key={c}
              className={`chip ${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="patterns-grid-container">
        {displayedList.map((p) => {
          const isSelected = currentPattern && currentPattern.id === p.id;
          return (
            <button
              key={p.id}
              className={`pattern-card ${isSelected ? 'selected' : ''}`}
              onClick={() => selectPattern(p)}
              title={`${p.name || p.id} (${p.id})`}
            >
              {p.cat === 'Custom' && <span className="custom-badge">CUSTOM</span>}
              <div className="pattern-thumb-svg-wrap">
                <svg viewBox="0 0 100 100" dangerouslySetInnerHTML={{ __html: buildTileInnerSvg(p, {}, materials, true) }} />
              </div>
              <div className="pattern-card-label">
                <span className="pattern-id">{p.id}</span>
                <span className="pattern-name">{p.name || 'Tile'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

