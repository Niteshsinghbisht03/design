/**
 * API Service for communicating with FastAPI Backend
 */

export async function fetchMaterials() {
  try {
    const res = await fetch('/api/materials');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.materials || [];
  } catch (err) {
    console.warn('Could not fetch materials from API, using fallback:', err);
    return [];
  }
}

export async function fetchPatterns() {
  try {
    const res = await fetch('/api/patterns');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Could not fetch patterns from API, using fallback:', err);
    return { patterns: [], borders: [] };
  }
}

export async function saveCustomPattern(pattern) {
  const res = await fetch('/api/patterns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pattern),
  });
  if (!res.ok) throw new Error(`Failed to save pattern: ${res.statusText}`);
  return await res.json();
}

export async function vectorizeImage(file, mode = 'auto', symmetric = null) {
  const formData = new FormData();
  formData.append('file', file);
  
  let url = `/api/vectorize?mode=${encodeURIComponent(mode)}&format=json`;
  if (symmetric !== null && symmetric !== undefined) {
    url += `&symmetric=${Boolean(symmetric)}`;
  }
  
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || 'Vectorization failed');
  }

  return await res.json();
}

