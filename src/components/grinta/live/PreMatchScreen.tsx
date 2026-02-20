'use client';

import { Player, DISPLAY, LIME, BORDER, TEAM_A_COLOR, TEAM_A_RGB, TEAM_B_COLOR, TEAM_B_RGB, ROOT, initials } from './types';
import { Scanlines, PortraitWarning } from './PortraitWarning';

function TeamPreviewBlock({ team, players }: { team: 'A' | 'B'; players: Player[] }) {
  const color = team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR;
  const rgb = team === 'A' ? TEAM_A_RGB : TEAM_B_RGB;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ ...DISPLAY, fontSize: '13px', color, letterSpacing: '0.15em', marginBottom: '14px' }}>
        ÉQUIPE {team}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '220px' }}>
        {players.length === 0 ? (
          <span style={{ color: '#3A3A3A', fontSize: '13px' }}>Aucun joueur assigné</span>
        ) : (
          players.map((p) => (
            <div
              key={p.id}
              style={{
                width: 42, height: 42, borderRadius: '50%',
                background: `rgba(${rgb},0.12)`, border: `1.5px solid rgba(${rgb},0.3)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                ...DISPLAY, fontSize: '14px', color,
              }}
            >
              {initials(p)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function PreMatchScreen({
  matchTitle,
  teamA,
  teamB,
  onStart,
  onBack,
}: {
  matchTitle: string;
  teamA: Player[];
  teamB: Player[];
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        ...ROOT, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '28px', padding: '24px',
      }}
    >
      <Scanlines />
      <PortraitWarning />

      <div style={{ textAlign: 'center' }}>
        <div style={{ ...DISPLAY, fontSize: '11px', color: '#444', letterSpacing: '0.2em', marginBottom: '8px' }}>
          GRINTA LIVE
        </div>
        <div
          style={{
            ...DISPLAY, fontSize: 'clamp(22px, 4vw, 48px)', color: '#EEE',
            letterSpacing: '0.06em', maxWidth: '70vw', textAlign: 'center',
          }}
        >
          {matchTitle}
        </div>
      </div>

      <div
        style={{
          display: 'flex', gap: '40px', alignItems: 'center',
          background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`,
          borderRadius: '16px', padding: '24px 40px',
        }}
      >
        <TeamPreviewBlock team="A" players={teamA} />
        <div style={{ ...DISPLAY, fontSize: '28px', color: '#2A2A2A', letterSpacing: '0.12em', flexShrink: 0 }}>
          VS
        </div>
        <TeamPreviewBlock team="B" players={teamB} />
      </div>

      <button
        onClick={onStart}
        style={{
          background: LIME, border: 'none', borderRadius: '12px', color: '#000',
          ...DISPLAY, fontSize: 'clamp(18px, 2.5vw, 26px)', letterSpacing: '0.08em',
          padding: '16px 56px', cursor: 'pointer',
          boxShadow: '0 0 32px rgba(170,255,0,0.25)', transition: 'box-shadow 0.2s, transform 0.1s',
        }}
        onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
        onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        ▶ LANCER LE MATCH
      </button>

      <button
        onClick={onBack}
        style={{
          background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px',
          color: '#444', ...DISPLAY, fontSize: '13px', letterSpacing: '0.1em',
          padding: '8px 22px', cursor: 'pointer',
        }}
      >
        ← RETOUR
      </button>
    </div>
  );
}
