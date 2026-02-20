'use client';

import { forwardRef } from 'react';
import { GoalEvent, DISPLAY, BORDER, TEAM_A_COLOR, TEAM_B_COLOR, fmt } from './types';

export const EventTicker = forwardRef<HTMLDivElement, { events: GoalEvent[] }>(
  function EventTicker({ events }, ref) {
    return (
      <div
        ref={ref}
        style={{
          height: '34px', borderTop: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', padding: '0 12px', gap: '4px',
          overflowX: 'auto', overflowY: 'hidden', flexShrink: 0, scrollbarWidth: 'none',
        }}
      >
        {events.length === 0 ? (
          <span style={{ ...DISPLAY, fontSize: '11px', color: '#2A2A2A', letterSpacing: '0.1em' }}>
            AUCUN ÉVÉNEMENT · APPUYEZ SUR + MARQUER POUR ENREGISTRER UN BUT
          </span>
        ) : (
          events.map((evt, i) => (
            <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              {i > 0 && <span style={{ color: '#222', fontSize: '11px', margin: '0 4px' }}>│</span>}
              <span style={{ ...DISPLAY, fontSize: '10px', color: '#444' }}>{fmt(evt.timestamp)}</span>
              <span style={{ fontSize: '11px' }}>{evt.is_own_goal ? '🥅' : '⚽'}</span>
              {evt.is_own_goal && evt.ownGoalPlayer ? (
                <>
                  <span style={{ fontSize: '11px', color: '#FF6400', fontWeight: 600 }}>
                    CSC {evt.ownGoalPlayer.first_name} {evt.ownGoalPlayer.last_name[0]}.
                  </span>
                  <span style={{ fontSize: '10px', color: '#555' }}>
                    (Éq.{evt.team === 'A' ? 'B' : 'A'} → Éq.{evt.team})
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '11px', color: evt.team === 'A' ? '#60A5FA' : '#F87171', fontWeight: 600 }}>
                    {evt.scorer?.first_name} {evt.scorer?.last_name[0]}.
                  </span>
                  {evt.assist && (
                    <span style={{ fontSize: '11px', color: '#444' }}>
                      → {evt.assist.first_name} {evt.assist.last_name[0]}.
                    </span>
                  )}
                </>
              )}
              <div
                style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: evt.team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR,
                  flexShrink: 0, marginLeft: 2,
                }}
              />
            </div>
          ))
        )}
      </div>
    );
  }
);
