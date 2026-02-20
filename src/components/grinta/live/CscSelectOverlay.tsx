'use client';

import { Player, DISPLAY, TEAM_A_COLOR, TEAM_A_RGB, TEAM_B_COLOR, TEAM_B_RGB, initials } from './types';

export function CscSelectOverlay({
  faultTeam,
  players,
  onPlayerClick,
  onClose,
}: {
  faultTeam: 'A' | 'B';
  players: Player[];
  onPlayerClick: (p: Player) => void;
  onClose: () => void;
}) {
  const color = faultTeam === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR;
  const rgb = faultTeam === 'A' ? TEAM_A_RGB : TEAM_B_RGB;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(4,4,4,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        style={{
          background: '#0E0E0E', border: `1px solid rgba(${rgb},0.25)`, borderRadius: '16px',
          padding: '24px', width: 'min(520px, 55vw)', maxHeight: '85vh', overflow: 'auto',
          boxShadow: `0 0 60px rgba(${rgb},0.1)`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ ...DISPLAY, fontSize: '11px', color: '#444', letterSpacing: '0.16em', marginBottom: '6px' }}>
              ÉQUIPE {faultTeam} · CONTRE SON CAMP
            </div>
            <div style={{ ...DISPLAY, fontSize: 'clamp(18px, 2.5vw, 24px)', color, letterSpacing: '0.04em' }}>
              🥅 CSC — JOUEUR FAUTIF
            </div>
            <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
              Sélectionne le joueur de l'équipe {faultTeam} ayant marqué contre son camp.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid #2A2A2A', borderRadius: '8px',
              color: '#555', width: 36, height: 36, cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {players.length === 0 ? (
          <div style={{ color: '#333', fontSize: '14px', padding: '16px 0' }}>
            Aucun joueur assigné à cette équipe.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '10px' }}>
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => onPlayerClick(p)}
                style={{
                  background: `rgba(${rgb},0.07)`, border: `1.5px solid rgba(${rgb},0.2)`,
                  borderRadius: '12px', padding: '14px 8px 12px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  transition: 'all 0.15s ease',
                }}
                onPointerEnter={(e) => {
                  e.currentTarget.style.background = `rgba(${rgb},0.14)`;
                  e.currentTarget.style.borderColor = color;
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.style.background = `rgba(${rgb},0.07)`;
                  e.currentTarget.style.borderColor = `rgba(${rgb},0.2)`;
                }}
              >
                <div
                  style={{
                    width: 48, height: 48, borderRadius: '50%', background: `rgba(${rgb},0.15)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...DISPLAY, fontSize: '17px', color,
                  }}
                >
                  {initials(p)}
                </div>
                <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', lineHeight: 1.3, fontWeight: 500 }}>
                  {p.first_name}<br /><span style={{ fontWeight: 700 }}>{p.last_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
