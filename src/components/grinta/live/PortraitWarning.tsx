'use client';

import { DISPLAY, LIME, VOID } from './types';

export function Scanlines() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px)',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}

export function PortraitWarning() {
  return (
    <>
      <style>{`@media (orientation: portrait) { .grinta-portrait-warn { display: flex !important; } }`}</style>
      <div
        className="grinta-portrait-warn"
        style={{
          position: 'fixed',
          inset: 0,
          background: VOID,
          zIndex: 99999,
          display: 'none',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '32px',
        }}
      >
        <div style={{ fontSize: '56px', lineHeight: 1 }}>↻</div>
        <div
          style={{ ...DISPLAY, fontSize: '26px', color: LIME, letterSpacing: '0.1em', textAlign: 'center' }}
        >
          TOURNEZ VOTRE ÉCRAN
        </div>
        <div style={{ fontSize: '14px', color: '#555', textAlign: 'center', maxWidth: '260px', lineHeight: 1.5 }}>
          Grinta Live est conçu exclusivement pour une utilisation en mode paysage.
        </div>
      </div>
    </>
  );
}
