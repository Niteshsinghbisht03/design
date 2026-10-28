import React from 'react';
import { useStudio } from '../context/StudioContext';
import { Sun, Moon, Layers, Frame } from 'lucide-react';

export default function Header() {
  const {
    tab,
    setTab,
    setSelectedRegion,
    clientName,
    setClientName,
    roomArea,
    setRoomArea,
    theme,
    toggleTheme
  } = useStudio();

  return (
    <header className="studio-header">
      <div className="header-brand">
        <div className="brand-logo-mark">◈</div>
        <div className="brand-text">
          <h1 className="brand-title">Tile Design Studio <span className="pro-badge">PRO</span></h1>
          <p className="brand-subtitle">Bespoke Encaustic & Terrazzo Architect Suite (250 × 250 mm)</p>
        </div>
        <button
          className="theme-toggle-btn mobile-theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div className="header-center-tabs">
        <button
          className={`tab-btn ${tab === 'p' ? 'active' : ''}`}
          onClick={() => {
            setTab('p');
            setSelectedRegion(null);
          }}
        >
          <Layers size={16} />
          <span>Field Patterns</span>
        </button>
        <button
          className={`tab-btn ${tab === 'b' ? 'active' : ''}`}
          onClick={() => {
            setTab('b');
            setSelectedRegion(null);
          }}
        >
          <Frame size={16} />
          <span>Perimeter Borders</span>
        </button>
      </div>

      <div className="header-meta-controls">
        <div className="input-group">
          <label htmlFor="projClient">Client / Project</label>
          <input
            id="projClient"
            type="text"
            placeholder="e.g. Villa Firenze"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label htmlFor="projArea">Room / Area</label>
          <input
            id="projArea"
            type="text"
            placeholder="e.g. Master Bath"
            value={roomArea}
            onChange={(e) => setRoomArea(e.target.value)}
          />
        </div>

        <button
          className="theme-toggle-btn desktop-theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

