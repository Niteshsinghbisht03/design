import React, { useState, useRef } from 'react';
import { useStudio } from '../context/StudioContext';
import { SvgTileParser } from '../services/svgParser';
import { vectorizeImage } from '../services/api';
import {
  UploadCloud,
  FileCode,
  Wand2,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';

export default function UploadModal({ isOpen, onClose }) {
  const { addCustomPattern, showToast } = useStudio();

  const [activeTab, setActiveTab] = useState('svg'); // 'svg' | 'raster'
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [tileName, setTileName] = useState('');
  const [parsedPattern, setParsedPattern] = useState(null);
  const [previewSvgString, setPreviewSvgString] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Vectorizer parameters
  const [vectorizeMode, setVectorizerMode] = useState('lineart'); // 'lineart' | 'colored'
  const [enforceD4, setEnforceD4] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Handle direct SVG text or file
  const handleSvgTextParse = (svgContent, fileName = 'Custom Tile') => {
    try {
      const parsed = SvgTileParser.parse(svgContent);
      if (!parsed || !parsed.regions || parsed.regions.length < 2) {
        throw new Error('Could not detect distinct fillable regions in the SVG. Ensure vector shapes (paths, rects, circles) are present.');
      }

      const customId = `CUSTOM-${Date.now().toString().slice(-4)}`;
      const newPattern = {
        id: customId,
        name: tileName || fileName.replace(/\.[^/.]+$/, ''),
        cat: 'Custom',
        r: parsed.regions,
        outline: parsed.outline || null
      };

      setParsedPattern(newPattern);
      setPreviewSvgString(svgContent);
      setError(null);
    } catch (err) {
      console.error('SVG Parsing failed:', err);
      setError(err.message || 'Invalid SVG vector content');
      setParsedPattern(null);
    }
  };

  // Handle file drop or selection
  const handleFileChange = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    setParsedPattern(null);
    setPreviewSvgString('');

    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

    if (isSvg) {
      setActiveTab('svg');
      const reader = new FileReader();
      reader.onload = (e) => {
        handleSvgTextParse(e.target.result, file.name);
      };
      reader.onerror = () => setError('Failed to read file');
      reader.readAsText(file);
    } else {
      // Raster image (JPEG / PNG)
      setActiveTab('raster');
    }
  };

  // Process raster image through FastAPI Vectorizer Service
  const handleRunVectorizer = async () => {
    if (!selectedFile) {
      setError('Please select a raster image file (JPEG, PNG).');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      showToast('AI Vectorizer running (D4 symmetry & fill segmentation)...');

      const result = await vectorizeImage(selectedFile, vectorizeMode, enforceD4);
      if ((result.status !== 'success' && !result.success) || !result.svg) {
        throw new Error(result.detail || 'Vectorization completed without SVG output');
      }

      setPreviewSvgString(result.svg);

      // Parse generated SVG into our internal pattern format
      const parsed = SvgTileParser.parse(result.svg);
      if (!parsed || !parsed.regions) {
        throw new Error('Vectorized SVG could not be converted to pattern regions.');
      }

      const customId = `CUSTOM-${Date.now().toString().slice(-4)}`;
      const newPattern = {
        id: customId,
        name: tileName || selectedFile.name.replace(/\.[^/.]+$/, ''),
        cat: 'Custom',
        r: parsed.regions,
        outline: parsed.outline || null
      };

      setParsedPattern(newPattern);
      showToast(`Tile successfully vectorized into ${parsed.regions.length} fillable regions!`);
    } catch (err) {
      console.error('Vectorization API error:', err);
      setError(err.message || 'Vectorization failed. Ensure backend server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyTile = () => {
    if (!parsedPattern) return;
    addCustomPattern(parsedPattern);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <UploadCloud size={20} className="modal-icon" />
            <div>
              <h2 className="modal-title">Upload & Create Custom Tile</h2>
              <p className="modal-subtitle">
                Import vector SVG directly or vectorize raster tile photos using AI OpenCV D4 symmetry.
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'svg' ? 'active' : ''}`}
            onClick={() => setActiveTab('svg')}
          >
            <FileCode size={16} />
            <span>Direct Vector SVG</span>
          </button>
          <button
            className={`modal-tab ${activeTab === 'raster' ? 'active' : ''}`}
            onClick={() => setActiveTab('raster')}
          >
            <Wand2 size={16} />
            <span>AI Raster Vectorizer (JPEG/PNG)</span>
          </button>
        </div>

        <div className="modal-body">
          {/* Dropzone */}
          <div
            className={`upload-dropzone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept={activeTab === 'svg' ? '.svg,image/svg+xml' : 'image/jpeg,image/png,image/webp'}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />
            <UploadCloud size={32} className="dropzone-icon" />
            <div className="dropzone-prompt">
              {selectedFile ? (
                <span className="file-name-highlight">{selectedFile.name}</span>
              ) : (
                <>
                  <span className="prompt-strong">Click to browse</span> or drag and drop tile file here
                </>
              )}
            </div>
            <span className="dropzone-hint">
              {activeTab === 'svg' ? 'Accepts .svg vector files' : 'Accepts .jpg, .png tile photos or sketches'}
            </span>
          </div>

          {/* Raster Vectorizer Settings */}
          {activeTab === 'raster' && (
            <div className="vectorizer-settings-box">
              <div className="settings-row">
                <label className="settings-label">Processing Engine:</label>
                <div className="engine-options">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="vecMode"
                      value="lineart"
                      checked={vectorizeMode === 'lineart'}
                      onChange={() => setVectorizerMode('lineart')}
                    />
                    <span>Mode A: Black Line Art / Drawing (Leaves, Petals, Sketches)</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="vecMode"
                      value="colored"
                      checked={vectorizeMode === 'colored'}
                      onChange={() => setVectorizerMode('colored')}
                    />
                    <span>Mode B: Segmented Color Ceramic Tile</span>
                  </label>
                </div>
              </div>

              <div className="settings-row">
                <label className="settings-label">Dihedral Symmetry:</label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={enforceD4}
                    onChange={(e) => setEnforceD4(e.target.checked)}
                  />
                  <span>Enforce D4 Tile Symmetry (4 Rotations × 2 Reflections — leave unchecked for hand drawings)</span>
                </label>
              </div>

              <button
                className="btn-run-vectorizer"
                onClick={handleRunVectorizer}
                disabled={isLoading || !selectedFile}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="spin-icon" />
                    <span>Vectorizing Tile via Python OpenCV...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Run AI Vectorizer</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Custom Name Input */}
          <div className="tile-name-field">
            <label htmlFor="customTileName">Tile Pattern Name (Optional):</label>
            <input
              id="customTileName"
              type="text"
              placeholder="e.g. Alhambra Floral Star"
              value={tileName}
              onChange={(e) => setTileName(e.target.value)}
            />
          </div>

          {/* Error notice */}
          {error && (
            <div className="modal-error-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Parsed Result Preview */}
          {parsedPattern && (
            <div className="parsed-preview-card">
              <div className="preview-header">
                <CheckCircle size={16} className="success-icon" />
                <span>Detected {parsedPattern.r.length} fillable regions ready for materials!</span>
              </div>
              <div className="preview-svg-box">
                <svg
                  viewBox="0 0 100 100"
                  className="preview-svg"
                  dangerouslySetInnerHTML={{
                    __html: parsedPattern.r.map((r, i) =>
                      r.e.map(([d, t]) =>
                        `<path d="${d}" ${t ? `transform="${t}"` : ''} fill="#ffffff" stroke="${parsedPattern.outline ? 'none' : '#24201d'}" stroke-width="0.8" fill-rule="evenodd"/>`
                      ).join('')
                    ).join('') + (parsedPattern.outline ? `<path d="${parsedPattern.outline.d}" ${parsedPattern.outline.transform ? `transform="${parsedPattern.outline.transform}"` : ''} fill="#000000" fill-rule="evenodd"/>` : '')
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-apply-tile"
            onClick={handleApplyTile}
            disabled={!parsedPattern}
          >
            Apply as Active Tile Pattern
          </button>
        </div>
      </div>
    </div>
  );
}

