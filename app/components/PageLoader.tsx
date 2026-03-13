import React from 'react';

/** Minimal fallback for lazy-loaded route chunks. Keeps layout stable. */
export function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#050505]" aria-label="Laster siden">
      <div className="w-8 h-8 border-2 border-[#FF5B00] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
