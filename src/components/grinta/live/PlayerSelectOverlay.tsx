'use client';

import { Player, SelectionStep, DISPLAY, TEAM_A_COLOR, TEAM_A_RGB, TEAM_B_COLOR, TEAM_B_RGB, initials } from './types';

export function PlayerSelectOverlay({
  team,
  step,
  players,
  pendingScorer,
  onPlayerClick,
  onSkipAssist,
  onClose,
}: {
  team: 'A' | 'B';
  step: SelectionStep;
  players: Player[];
  pendingScorer: Player | null;
  onPlayerClick: (p: Player) => void;
  onSkipAssist: () => void;
  onClose: () => void;
}) {
  const color = team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR;
  const rgb = team === 'A' ? TEAM_A_RGB : TEAM_B_RGB;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(4,4,4,0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
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
              ÉQUIPE {team} · {step === 'SCORER' ? 'ÉTAPE 1/2' : 'ÉTAPE 2/2'}
            </div>
            <div style={{ ...DISPLAY, fontSize: 'clamp(18px, 2.5vw, 24px)', color, letterSpacing: '0.04em' }}>
              {step === 'SCORER' ? '⚽ BUTEUR' : '🎯 PASSEUR'}
            </div>
            {step === 'ASSIST' && pendingScorer && (
              <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                But signé {pendingScorer.first_name} {pendingScorer.last_name}
              </div>
            )}
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
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
              gap: '10px', marginBottom: step === 'ASSIST' ? '14px' : '0',
            }}
          >
            {players.map((p) => {
              const isSelected = pendingScorer?.id === p.id && step === 'ASSIST';
              return (
                <button
                  key={p.id}
                  onClick={() => onPlayerClick(p)}
                  style={{
                    background: isSelected ? color : `rgba(${rgb},0.07)`,
                    border: `1.5px solid ${isSelected ? color : `rgba(${rgb},0.2)`}`,
                    borderRadius: '12px', padding: '14px 8px 12px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? `0 0 20px rgba(${rgb},0.3)` : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: isSelected ? 'rgba(0,0,0,0.2)' : `rgba(${rgb},0.15)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      ...DISPLAY, fontSize: '17px', color: isSelected ? '#000' : color,
                    }}
                  >
                    {initials(p)}
                  </div>
                  <div style={{ fontSize: '11px', color: isSelected ? '#000' : '#888', textAlign: 'center', lineHeight: 1.3, fontWeight: 500 }}>
                    {p.first_name}<br /><span style={{ fontWeight: 700 }}>{p.last_name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 'ASSIST' && (
          <button
            onClick={onSkipAssist}
            style={{
              width: '100%', background: 'transparent', border: '1px solid #252525',
              borderRadius: '8px', color: '#555',
              ...DISPLAY, fontSize: '14px', letterSpacing: '0.08em', padding: '11px', cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            SANS PASSEUR →
          </button>
        )}
      </div>
    </div>
  );
}
