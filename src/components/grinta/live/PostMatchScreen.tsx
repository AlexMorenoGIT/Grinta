'use client';

import { GoalEvent, Player, DISPLAY, LIME, BORDER, TEAM_A_COLOR, TEAM_A_RGB, TEAM_B_COLOR, TEAM_B_RGB, ROOT, fmt, initials } from './types';
import { Scanlines, PortraitWarning } from './PortraitWarning';

function generateMatchAnalysis(
  events: GoalEvent[],
  scoreA: number,
  scoreB: number,
  totalSeconds: number
): string[] {
  const insights: string[] = [];
  if (scoreA === 0 && scoreB === 0) {
    insights.push('Match verrouillé — aucun but malgré les efforts des deux équipes.');
    return insights;
  }

  const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null;
  const diff = Math.abs(scoreA - scoreB);
  const total = scoreA + scoreB;

  if (!winner) {
    insights.push(`Match nul accroché — les deux équipes se sont neutralisées (${scoreA}-${scoreB}).`);
  } else if (diff >= 4) {
    insights.push(`L'équipe ${winner} a écrasé l'adversaire dans un match à sens unique (${scoreA}-${scoreB}).`);
  } else if (diff === 1) {
    insights.push(`Victoire à l'arraché de l'équipe ${winner} — un seul but les a séparées (${scoreA}-${scoreB}).`);
  } else {
    insights.push(`L'équipe ${winner} s'impose avec autorité (${scoreA}-${scoreB}).`);
  }

  if (totalSeconds > 90) {
    const mid = totalSeconds / 2;
    const earlyA = events.filter(e => e.team === 'A' && e.timestamp <= mid).length;
    const earlyB = events.filter(e => e.team === 'B' && e.timestamp <= mid).length;
    const lateA = scoreA - earlyA;
    const lateB = scoreB - earlyB;
    if (earlyA > earlyB + 1 && lateB >= lateA) {
      insights.push("L'équipe A a dominé la première période mais l'équipe B a su réagir et inverser la tendance.");
    } else if (earlyB > earlyA + 1 && lateA >= lateB) {
      insights.push("L'équipe B a pris le dessus en début de match, mais l'équipe A a renversé la vapeur.");
    } else if (winner === 'A' && earlyA > earlyB && lateA > 0) {
      insights.push("L'équipe A a dicté le rythme de bout en bout sans jamais se faire rattraper.");
    } else if (winner === 'B' && earlyB > earlyA && lateB > 0) {
      insights.push("L'équipe B a pris le contrôle dès l'entame et n'a jamais lâché l'avantage.");
    }
  }

  let maxDeficitA = 0, maxDeficitB = 0, runA = 0, runB = 0;
  for (const e of events) {
    if (e.team === 'A') runA++; else runB++;
    if (runA < runB) maxDeficitA = Math.max(maxDeficitA, runB - runA);
    if (runB < runA) maxDeficitB = Math.max(maxDeficitB, runA - runB);
  }
  if (winner === 'A' && maxDeficitA >= 2) insights.push(`Remontée épique de l'équipe A — elle avait ${maxDeficitA} buts à remonter ! 💪`);
  else if (winner === 'B' && maxDeficitB >= 2) insights.push(`Remontée épique de l'équipe B — elle avait ${maxDeficitB} buts à remonter ! 💪`);

  const nonCsc = events.filter(e => !e.is_own_goal);
  for (let i = 0; i <= nonCsc.length - 3; i++) {
    const trio = nonCsc.slice(i, i + 3);
    if (trio[2].timestamp - trio[0].timestamp < 180 && trio.every(e => e.team === trio[0].team)) {
      insights.push(`⚡ Triplé éclair de l'équipe ${trio[0].team} — 3 buts en moins de 3 minutes !`);
      break;
    }
  }

  const cscs = events.filter(e => e.is_own_goal);
  if (cscs.length === 1) insights.push('Un but contre son camp a animé la rencontre. 🥅');
  else if (cscs.length >= 2) insights.push(`${cscs.length} buts contre son camp ont ponctué cette rencontre agitée. 🥅`);

  if (total >= 8) insights.push(`Match prolifique avec ${total} buts au total — du spectacle pur !`);

  return insights;
}

export function PostMatchScreen({
  events,
  scoreA,
  scoreB,
  time,
  onResume,
  onSync,
  isSyncing,
}: {
  events: GoalEvent[];
  scoreA: number;
  scoreB: number;
  time: number;
  onResume: () => void;
  onSync: () => void;
  isSyncing: boolean;
}) {
  const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null;

  const scorerMap = events.reduce(
    (acc: Record<string, { player: Player; goals: number }>, e) => {
      if (e.is_own_goal || !e.scorer) return acc;
      if (!acc[e.scorer.id]) acc[e.scorer.id] = { player: e.scorer, goals: 0 };
      acc[e.scorer.id].goals++;
      return acc;
    }, {}
  );

  const assistMap = events.reduce(
    (acc: Record<string, { player: Player; assists: number }>, e) => {
      if (!e.assist) return acc;
      if (!acc[e.assist.id]) acc[e.assist.id] = { player: e.assist, assists: 0 };
      acc[e.assist.id].assists++;
      return acc;
    }, {}
  );

  const maxGoals = Object.values(scorerMap).reduce((m, s) => Math.max(m, s.goals), 0);
  const topScorers = maxGoals > 0 ? Object.values(scorerMap).filter(s => s.goals === maxGoals) : [];
  const maxAssists = Object.values(assistMap).reduce((m, s) => Math.max(m, s.assists), 0);
  const topAssisters = maxAssists > 0 ? Object.values(assistMap).filter(s => s.assists === maxAssists) : [];

  const analysis = generateMatchAnalysis(events, scoreA, scoreB, time);

  return (
    <div style={{ ...ROOT, overflow: 'auto', animation: 'fadeIn 0.4s ease' }}>
      <Scanlines />
      <PortraitWarning />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .post-wrap {
          min-height: 100%;
          display: flex; flex-direction: column; gap: 12px;
          padding: max(16px, env(safe-area-inset-top, 16px)) max(20px, env(safe-area-inset-right, 20px)) max(16px, env(safe-area-inset-bottom, 16px)) max(20px, env(safe-area-inset-left, 20px));
        }
        .post-grid { display: grid; gap: 12px; flex: 1; min-height: 0; }
        @media (orientation: landscape) {
          .post-grid { grid-template-columns: 42% 1fr; }
          .post-left { overflow-y: auto; }
          .post-timeline { overflow-y: auto; }
        }
        @media (orientation: portrait) {
          .post-grid { grid-template-columns: 1fr; }
          .post-timeline { max-height: 40vh; overflow-y: auto; }
        }
      `}</style>

      <div className="post-wrap">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ ...DISPLAY, fontSize: 'clamp(16px, 2.5vw, 28px)', color: LIME, letterSpacing: '0.1em' }}>
            STATS FINALES
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ ...DISPLAY, fontSize: '12px', color: '#444', letterSpacing: '0.08em' }}>{fmt(time)}</div>
            {winner ? (
              <div style={{
                ...DISPLAY, fontSize: '12px', letterSpacing: '0.08em', borderRadius: '6px', padding: '3px 10px',
                color: winner === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR,
                background: winner === 'A' ? `rgba(${TEAM_A_RGB},0.1)` : `rgba(${TEAM_B_RGB},0.1)`,
                border: `1px solid ${winner === 'A' ? `rgba(${TEAM_A_RGB},0.3)` : `rgba(${TEAM_B_RGB},0.3)`}`,
              }}>
                ▲ ÉQ. {winner}
              </div>
            ) : (
              <div style={{ ...DISPLAY, fontSize: '12px', color: '#555', letterSpacing: '0.08em' }}>MATCH NUL</div>
            )}
          </div>
        </div>

        {/* Two-column grid */}
        <div className="post-grid">
          {/* LEFT */}
          <div className="post-left" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Score card */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '14px',
              padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexShrink: 0,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...DISPLAY, fontSize: '10px', color: TEAM_A_COLOR, letterSpacing: '0.15em', marginBottom: '2px' }}>ÉQUIPE A</div>
                <div style={{ ...DISPLAY, fontSize: 'clamp(40px, 7vw, 72px)', color: TEAM_A_COLOR, lineHeight: 1, textShadow: `0 0 24px rgba(${TEAM_A_RGB},0.4)` }}>
                  {scoreA}
                </div>
              </div>
              <div style={{ ...DISPLAY, fontSize: '22px', color: '#2A2A2A' }}>—</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...DISPLAY, fontSize: '10px', color: TEAM_B_COLOR, letterSpacing: '0.15em', marginBottom: '2px' }}>ÉQUIPE B</div>
                <div style={{ ...DISPLAY, fontSize: 'clamp(40px, 7vw, 72px)', color: TEAM_B_COLOR, lineHeight: 1, textShadow: `0 0 24px rgba(${TEAM_B_RGB},0.4)` }}>
                  {scoreB}
                </div>
              </div>
            </div>

            {/* Analysis */}
            {analysis.length > 0 && (
              <div style={{ background: 'rgba(170,255,0,0.04)', border: '1px solid rgba(170,255,0,0.12)', borderRadius: '12px', padding: '12px 14px', flexShrink: 0 }}>
                <div style={{ ...DISPLAY, fontSize: '10px', color: LIME, letterSpacing: '0.16em', marginBottom: '8px' }}>⚡ ANALYSE DU MATCH</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {analysis.map((line, i) => (
                    <p key={i} style={{ fontSize: '12px', color: '#AAA', lineHeight: 1.4, margin: 0 }}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Top scorers */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px 14px', flexShrink: 0 }}>
              <div style={{ ...DISPLAY, fontSize: '10px', color: LIME, letterSpacing: '0.14em', marginBottom: '8px' }}>⚽ BUTEUR{topScorers.length > 1 ? 'S' : ''} DU MATCH</div>
              {topScorers.length === 0 ? (
                <div style={{ color: '#333', fontSize: '13px' }}>—</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {topScorers.map(s => (
                    <div key={s.player.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(170,255,0,0.12)', border: '1.5px solid rgba(170,255,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...DISPLAY, fontSize: '11px', color: LIME }}>
                        {initials(s.player)}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#DDD', fontWeight: 600 }}>{s.player.first_name} {s.player.last_name}</div>
                        <div style={{ ...DISPLAY, fontSize: '14px', color: LIME }}>{s.goals} but{s.goals > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top assists */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px 14px', flexShrink: 0 }}>
              <div style={{ ...DISPLAY, fontSize: '10px', color: '#FFB800', letterSpacing: '0.14em', marginBottom: '8px' }}>🎯 PASSEUR{topAssisters.length > 1 ? 'S' : ''}</div>
              {topAssisters.length === 0 ? (
                <div style={{ color: '#333', fontSize: '13px' }}>—</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {topAssisters.map(s => (
                    <div key={s.player.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,184,0,0.12)', border: '1.5px solid rgba(255,184,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...DISPLAY, fontSize: '11px', color: '#FFB800' }}>
                        {initials(s.player)}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#DDD', fontWeight: 600 }}>{s.player.first_name} {s.player.last_name}</div>
                        <div style={{ ...DISPLAY, fontSize: '14px', color: '#FFB800' }}>{s.assists} passe{s.assists > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Timeline */}
          <div className="post-timeline" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '12px 14px' }}>
            <div style={{ ...DISPLAY, fontSize: '10px', color: '#444', letterSpacing: '0.14em', marginBottom: '10px' }}>
              TIMELINE DES BUTS ({events.length})
            </div>
            {events.length === 0 ? (
              <div style={{ color: '#333', fontSize: '13px' }}>Aucun but enregistré.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {events.map((evt, i) => {
                  const isCSC = evt.is_own_goal;
                  const teamColor = evt.team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR;
                  const teamRgb = evt.team === 'A' ? TEAM_A_RGB : TEAM_B_RGB;
                  return (
                    <div key={evt.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px',
                      background: isCSC ? 'rgba(255,100,0,0.06)' : `rgba(${teamRgb},0.05)`,
                      border: `1px solid ${isCSC ? 'rgba(255,100,0,0.15)' : `rgba(${teamRgb},0.12)`}`,
                      opacity: 0, animation: `slideUp 0.25s ease ${i * 0.05}s forwards`,
                    }}>
                      <div style={{ ...DISPLAY, fontSize: '11px', color: '#444', letterSpacing: '0.04em', flexShrink: 0, width: 34 }}>
                        {fmt(evt.timestamp)}
                      </div>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: isCSC ? 'rgba(255,100,0,0.15)' : `rgba(${teamRgb},0.15)`, border: `1.5px solid ${isCSC ? '#FF6400' : teamColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...DISPLAY, fontSize: '10px', color: isCSC ? '#FF6400' : teamColor, flexShrink: 0 }}>
                        {isCSC ? '🥅' : (evt.scorer ? initials(evt.scorer) : '?')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isCSC && evt.ownGoalPlayer ? (
                          <>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#FF6400' }}>
                              CSC — {evt.ownGoalPlayer.first_name} {evt.ownGoalPlayer.last_name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#555' }}>+1 Équipe {evt.team}</div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#DDD', textOverflow: 'ellipsis' }}>
                              {evt.scorer?.first_name} {evt.scorer?.last_name}
                            </div>
                            {evt.assist && (
                              <div style={{ fontSize: '10px', color: '#555' }}>
                                → {evt.assist.first_name} {evt.assist.last_name}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div style={{ ...DISPLAY, fontSize: '10px', color: teamColor, borderRadius: '4px', padding: '2px 6px', background: `rgba(${teamRgb},0.1)`, border: `1px solid rgba(${teamRgb},0.2)`, flexShrink: 0 }}>
                        ÉQ {evt.team}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            onClick={onResume}
            style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#555', ...DISPLAY, fontSize: '13px', letterSpacing: '0.08em', padding: '10px 20px', cursor: 'pointer' }}
          >
            ← REPRENDRE
          </button>
          <button
            onClick={onSync}
            disabled={isSyncing}
            style={{ background: isSyncing ? '#333' : LIME, border: 'none', borderRadius: '8px', color: isSyncing ? '#666' : '#000', ...DISPLAY, fontSize: '14px', letterSpacing: '0.06em', padding: '10px 28px', cursor: isSyncing ? 'not-allowed' : 'pointer', transition: 'background 0.2s', boxShadow: isSyncing ? 'none' : '0 0 20px rgba(170,255,0,0.2)' }}
          >
            {isSyncing ? 'SYNC...' : '✓ VALIDER ET ENVOYER'}
          </button>
        </div>
      </div>
    </div>
  );
}
