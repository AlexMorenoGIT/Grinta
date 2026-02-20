'use client';

import { Player, DISPLAY, BORDER, TEAM_A_COLOR, TEAM_A_RGB, TEAM_B_COLOR, TEAM_B_RGB, initials } from './types';

export function TeamZone({
  id,
  team,
  players,
  score,
  onGoal,
  onCsc,
  onRemove,
  flashGoal,
}: {
  id?: string;
  team: 'A' | 'B';
  players: Player[];
  score: number;
  onGoal: () => void;
  onCsc: () => void;
  onRemove: () => void;
  flashGoal: boolean;
}) {
  const isA = team === 'A';
  const color = isA ? TEAM_A_COLOR : TEAM_B_COLOR;
  const rgb = isA ? TEAM_A_RGB : TEAM_B_RGB;

  return (
    <div
      id={id}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 14px',
        gap: '6px',
        position: 'relative',
        overflow: 'hidden',
        background: flashGoal
          ? `rgba(${rgb},0.12)`
          : `linear-gradient(${isA ? '90deg' : '270deg'}, rgba(${rgb},0.04) 0%, transparent 60%)`,
        transition: 'background 0.2s ease',
        borderRight: isA ? `1px solid ${BORDER}` : 'none',
        borderLeft: !isA ? `1px solid ${BORDER}` : 'none',
      }}
    >
      {flashGoal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at ${isA ? '0%' : '100%'} 50%, rgba(${rgb},0.25) 0%, transparent 70%)`,
            pointerEvents: 'none',
            animation: 'fadeIn 0.1s ease',
          }}
        />
      )}

      <div style={{ ...DISPLAY, fontSize: 'clamp(16px, 2.2vw, 26px)', color, letterSpacing: '0.12em', textAlign: 'center' }}>
        ÉQUIPE {team}
      </div>

      <div
        style={{
          ...DISPLAY,
          fontSize: 'clamp(72px, 16vw, 148px)',
          color,
          lineHeight: 0.85,
          textAlign: 'center',
          textShadow: `0 0 60px rgba(${rgb},0.35)`,
          letterSpacing: '-0.04em',
          transition: 'text-shadow 0.3s ease',
        }}
      >
        {score}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center', flex: 1, alignContent: 'flex-start' }}>
        {players.map((p) => (
          <div
            key={p.id}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: `rgba(${rgb},0.1)`, border: `1.5px solid rgba(${rgb},0.25)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...DISPLAY, fontSize: '11px', color,
            }}
          >
            {initials(p)}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={onGoal}
          style={{
            background: color, border: 'none', borderRadius: '10px', color: '#000',
            ...DISPLAY, fontSize: 'clamp(12px, 1.3vw, 16px)', letterSpacing: '0.06em',
            padding: '10px 14px', cursor: 'pointer', flex: 1, maxWidth: '140px',
            transition: 'opacity 0.15s, transform 0.1s', WebkitTapHighlightColor: 'transparent',
          }}
          onPointerDown={(e) => ((e.currentTarget.style.transform = 'scale(0.96)'))}
          onPointerUp={(e) => ((e.currentTarget.style.transform = 'scale(1)'))}
          onPointerLeave={(e) => ((e.currentTarget.style.transform = 'scale(1)'))}
        >
          + MARQUER
        </button>
        <button
          onClick={onCsc}
          style={{
            background: 'rgba(255,100,0,0.08)', border: '1px solid rgba(255,100,0,0.3)',
            borderRadius: '8px', color: '#FF6400',
            ...DISPLAY, fontSize: 'clamp(11px, 1.1vw, 14px)', letterSpacing: '0.06em',
            padding: '10px 10px', cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s', WebkitTapHighlightColor: 'transparent',
          }}
          onPointerDown={(e) => ((e.currentTarget.style.transform = 'scale(0.96)'))}
          onPointerUp={(e) => ((e.currentTarget.style.transform = 'scale(1)'))}
          onPointerLeave={(e) => ((e.currentTarget.style.transform = 'scale(1)'))}
        >
          CSC
        </button>
        <button
          onClick={onRemove}
          disabled={score === 0}
          style={{
            background: 'transparent', border: `1px solid ${score === 0 ? '#222' : '#333'}`,
            borderRadius: '8px', color: score === 0 ? '#2A2A2A' : '#555',
            ...DISPLAY, fontSize: '13px', letterSpacing: '0.04em',
            padding: '10px 10px', cursor: score === 0 ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          − CORRIGER
        </button>
      </div>
    </div>
  );
}
