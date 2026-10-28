import React from 'react';
import { useStudio } from '../context/StudioContext';

export default function Toast() {
  const { toastMessage } = useStudio();

  if (!toastMessage) return null;

  return (
    <div className="toast show" role="status" aria-live="polite">
      {toastMessage}
    </div>
  );
}

