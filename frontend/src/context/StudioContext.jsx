import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { fetchMaterials, fetchPatterns } from '../services/api';

const StudioContext = createContext(null);

export function StudioProvider({ children }) {
  // Loaded Catalog Data
  const [materials, setMaterials] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [borders, setBorders] = useState([]);
  const [customPatterns, setCustomPatterns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Studio Interactive State
  const [tab, setTab] = useState('p'); // 'p' for Patterns, 'b' for Borders
  const [cat, setCat] = useState('All');
  const [currentPatternId, setCurrentPatternId] = useState('C-009');
  const [currentBorderId, setCurrentBorderId] = useState('B-001');

  // Fills state: { [patternId]: { [regionIndex]: materialIndex } }
  const [fills, setFills] = useState({
    'C-009': { 0: 0, 1: 5, 2: 12, 3: 20 },
    'C-003': { 0: 0, 1: 3, 2: 7 }
  });

  const [selectedRegion, setSelectedRegion] = useState(null); // number or 'c' for center
  const [centerFillActive, setCenterFillActive] = useState(false);
  const [centerFillColor, setCenterFillColor] = useState(0);

  // Rotation & Grout Simulation
  const [tileRotation, setTileRotation] = useState(0); // 0, 90, 180, 270
  const [altRotation, setAltRotation] = useState(false);
  const [groutWidth, setGroutWidth] = useState(2.5); // 0 to 4mm
  const [groutColor, setGroutColor] = useState('#e2dbd2');

  // Project Metadata
  const [clientName, setClientName] = useState('');
  const [roomArea, setRoomArea] = useState('');
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'

  // Toast System
  const [toastMessage, setToastMessage] = useState(null);

  // Undo / Redo History
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Toast Trigger Helper
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2400);
  }, []);

  // Fetch initial patterns and materials from API
  useEffect(() => {
    async function initCatalog() {
      try {
        setLoading(true);
        const [matsData, patsData] = await Promise.all([
          fetchMaterials(),
          fetchPatterns()
        ]);
        setMaterials(matsData);
        setPatterns(patsData.patterns || []);
        setBorders(patsData.borders || []);
      } catch (err) {
        console.error('Failed to load initial studio data:', err);
        showToast('Error loading studio textures and patterns');
      } finally {
        setLoading(false);
      }
    }
    initCatalog();
  }, [showToast]);

  // Combined patterns list (system + user uploaded custom tiles)
  const allPatterns = useMemo(() => {
    return [...patterns, ...customPatterns];
  }, [patterns, customPatterns]);

  // Active object based on active tab
  const currentPattern = useMemo(() => {
    if (tab === 'p') {
      return allPatterns.find(p => p.id === currentPatternId) || allPatterns[0] || null;
    } else {
      return borders.find(b => b.id === currentBorderId) || borders[0] || null;
    }
  }, [tab, currentPatternId, currentBorderId, allPatterns, borders]);

  // Fills for current pattern
  const currentFills = useMemo(() => {
    if (!currentPattern) return {};
    return fills[currentPattern.id] || {};
  }, [currentPattern, fills]);

  // Push snapshot to history stack
  const pushHistorySnapshot = useCallback((newFills, newCenterActive, newCenterColor) => {
    const snapshot = {
      tab,
      patternId: currentPattern ? currentPattern.id : null,
      fills: JSON.parse(JSON.stringify(newFills)),
      centerFillActive: newCenterActive,
      centerFillColor: newCenterColor
    };

    setHistory(prev => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, snapshot];
    });
    setHistoryIndex(prev => prev + 1);
  }, [tab, currentPattern, historyIndex]);

  // Apply Material to Selected Region
  const applyMaterial = useCallback((matIndex) => {
    if (selectedRegion === null) {
      showToast('Select a tile region first');
      return;
    }

    if (selectedRegion === 'c') {
      setCenterFillColor(matIndex);
      setCenterFillActive(true);
      pushHistorySnapshot(fills, true, matIndex);
      showToast(`Applied material to Center Field`);
    } else if (currentPattern) {
      const patId = currentPattern.id;
      const updatedPatternFills = { ...(fills[patId] || {}), [selectedRegion]: matIndex };
      const updatedFills = { ...fills, [patId]: updatedPatternFills };
      setFills(updatedFills);
      pushHistorySnapshot(updatedFills, centerFillActive, centerFillColor);

      const regName = currentPattern.r[selectedRegion]?.n || `Region ${selectedRegion + 1}`;
      const matName = materials[matIndex]?.name || `Texture #${matIndex + 1}`;
      showToast(`Applied ${matName} to ${regName}`);
    }
  }, [selectedRegion, currentPattern, fills, centerFillActive, centerFillColor, materials, pushHistorySnapshot, showToast]);

  // Undo / Redo implementations
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (canUndo) {
      const targetIndex = historyIndex - 1;
      const s = history[targetIndex];
      setFills(JSON.parse(JSON.stringify(s.fills)));
      setCenterFillActive(s.centerFillActive);
      setCenterFillColor(s.centerFillColor);
      setHistoryIndex(targetIndex);
      showToast('Undo');
    }
  }, [canUndo, historyIndex, history, showToast]);

  const redo = useCallback(() => {
    if (canRedo) {
      const targetIndex = historyIndex + 1;
      const s = history[targetIndex];
      setFills(JSON.parse(JSON.stringify(s.fills)));
      setCenterFillActive(s.centerFillActive);
      setCenterFillColor(s.centerFillColor);
      setHistoryIndex(targetIndex);
      showToast('Redo');
    }
  }, [canRedo, historyIndex, history, showToast]);

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Rotate Tile by 90 degrees
  const rotateTile90 = useCallback(() => {
    setTileRotation(prev => (prev + 90) % 360);
  }, []);

  // Toggle Alternating (Windmill / Checkerboard) Rotation
  const toggleAltRotation = useCallback(() => {
    setAltRotation(prev => !prev);
  }, []);

  // Harmonize / Randomize Materials from textures library
  const randomizeMaterials = useCallback(() => {
    if (!currentPattern || !materials.length) return;
    const patId = currentPattern.id;
    // Pick 2 to 4 harmonizing textures
    const sample = [
      Math.floor(Math.random() * materials.length),
      Math.floor(Math.random() * materials.length),
      Math.floor(Math.random() * materials.length)
    ];

    const newPatternFills = {};
    currentPattern.r.forEach((r, i) => {
      newPatternFills[i] = sample[i % sample.length];
    });

    const updatedFills = { ...fills, [patId]: newPatternFills };
    setFills(updatedFills);
    pushHistorySnapshot(updatedFills, centerFillActive, centerFillColor);
    showToast('Harmonized materials applied');
  }, [currentPattern, materials, fills, centerFillActive, centerFillColor, pushHistorySnapshot, showToast]);

  // Reset Colors to unfilled
  const resetColors = useCallback(() => {
    if (!currentPattern) return;
    const patId = currentPattern.id;
    const updatedFills = { ...fills, [patId]: {} };
    setFills(updatedFills);
    pushHistorySnapshot(updatedFills, centerFillActive, centerFillColor);
    showToast('Reset tile colors');
  }, [currentPattern, fills, centerFillActive, centerFillColor, pushHistorySnapshot, showToast]);

  // Add Custom Pattern (from SVG parse or AI Vectorizer)
  const addCustomPattern = useCallback((newPattern) => {
    setCustomPatterns(prev => [newPattern, ...prev]);
    setCurrentPatternId(newPattern.id);
    setTab('p');
    setCat('Custom');
    setSelectedRegion(null);
    showToast(`Loaded Custom Pattern: ${newPattern.name || newPattern.id}`);
  }, [showToast]);

  // Select Pattern
  const selectPattern = useCallback((p) => {
    if (tab === 'p') {
      setCurrentPatternId(p.id);
    } else {
      setCurrentBorderId(p.id);
    }
    setSelectedRegion(null);
  }, [tab]);

  // Toggle Theme
  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = {
    loading,
    materials,
    patterns,
    borders,
    allPatterns,
    customPatterns,
    tab,
    setTab,
    cat,
    setCat,
    currentPattern,
    currentPatternId,
    setCurrentPatternId,
    currentBorderId,
    setCurrentBorderId,
    selectPattern,
    fills,
    currentFills,
    selectedRegion,
    setSelectedRegion,
    centerFillActive,
    setCenterFillActive,
    centerFillColor,
    setCenterFillColor,
    applyMaterial,
    tileRotation,
    setTileRotation,
    rotateTile90,
    altRotation,
    setAltRotation,
    toggleAltRotation,
    groutWidth,
    setGroutWidth,
    groutColor,
    setGroutColor,
    clientName,
    setClientName,
    roomArea,
    setRoomArea,
    theme,
    setTheme,
    toggleTheme,
    toastMessage,
    showToast,
    undo,
    redo,
    canUndo,
    canRedo,
    randomizeMaterials,
    resetColors,
    addCustomPattern
  };

  return (
    <StudioContext.Provider value={value}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
}

