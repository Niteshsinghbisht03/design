import React, { useState } from 'react';
import { StudioProvider, useStudio } from './context/StudioContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Stage from './components/Stage';
import FloorPreview from './components/FloorPreview';
import MaterialLibrary from './components/MaterialLibrary';
import ActionBar from './components/ActionBar';
import UploadModal from './components/UploadModal';
import Toast from './components/Toast';
import './App.css';

function StudioWorkspace() {
  const { theme, loading } = useStudio();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  return (
    <div className={`studio-root ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <Header />

      {loading ? (
        <div className="studio-loading-overlay">
          <div className="loading-spinner" />
          <p>Loading 40 authentic textures and architectural patterns...</p>
        </div>
      ) : (
        <main className="studio-main-layout">
          {/* Left Column: Pattern & Border Library */}
          <Sidebar onOpenUpload={() => setIsUploadOpen(true)} />

          {/* Center Column: Design Stage & Floor Repeat Installation */}
          <section className="studio-center-stage">
            <Stage />
            <FloorPreview />
          </section>

          {/* Right Column: Physical Material Textures Scans */}
          <MaterialLibrary />
        </main>
      )}

      {/* Persistent Deliverables & Estimator Action Bar */}
      <ActionBar />

      {/* Upload & AI Vectorizer Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />

      {/* Floating System Toast */}
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <StudioProvider>
      <StudioWorkspace />
    </StudioProvider>
  );
}

