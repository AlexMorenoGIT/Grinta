'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  elo: number;
  team: 'A' | 'B' | null;
}

interface GoalEvent {
  id: string;
  team: 'A' | 'B'; // équipe qui marque (bénéficiaire)
  scorer: Player | null; // null si CSC
  ownGoalPlayer: Player | null; // joueur fautif si CSC
  assist: Player | null;
  timestamp: number; // seconds
  is_own_goal: boolean;
}

type GameState = 'LOADING' | 'PRE' | 'LIVE' | 'POST';
type SelectionStep = 'SCORER' | 'ASSIST';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function initials(p: Player): string {
  return `${(p.first_name[0] || '?')}${(p.last_name[0] || '')}`.toUpperCase();
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const TEAM_A_COLOR = '#3B82F6';
const TEAM_A_RGB = '59,130,246';
const TEAM_B_COLOR = '#EF4444';
const TEAM_B_RGB = '239,68,68';
const LIME = '#AAFF00';
const VOID = '#080808';
const SURFACE = '#111111';
const BORDER = '#1C1C1C';

const DISPLAY: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 900,
  textTransform: 'uppercase' as const,
  letterSpacing: '-0.01em',
};

const ROOT: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: VOID,
  color: '#F0F0F0',
  fontFamily: "'DM Sans', sans-serif",
  overflow: 'hidden',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Scanlines() {
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

function PortraitWarning() {
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

function TeamPreviewBlock({ team, players }: { team: 'A' | 'B'; players: Player[] }) {
  const color = team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR;
  const rgb = team === 'A' ? TEAM_A_RGB : TEAM_B_RGB;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ ...DISPLAY, fontSize: '13px', color, letterSpacing: '0.15em', marginBottom: '14px' }}>
        ÉQUIPE {team}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'center',
          maxWidth: '220px',
        }}
      >
        {players.length === 0 ? (
          <span style={{ color: '#3A3A3A', fontSize: '13px' }}>Aucun joueur assigné</span>
        ) : (
          players.map((p) => (
            <div
              key={p.id}
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: `rgba(${rgb},0.12)`,
                border: `1.5px solid rgba(${rgb},0.3)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...DISPLAY,
                fontSize: '14px',
                color,
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

function CscSelectOverlay({
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
        position: 'fixed',
        inset: 0,
        background: 'rgba(4,4,4,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        style={{
          background: '#0E0E0E',
          border: `1px solid rgba(${rgb},0.25)`,
          borderRadius: '16px',
          padding: '24px',
          width: 'min(520px, 55vw)',
          maxHeight: '85vh',
          overflow: 'auto',
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
              background: 'transparent',
              border: '1px solid #2A2A2A',
              borderRadius: '8px',
              color: '#555',
              width: 36,
              height: 36,
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
              gap: '10px',
            }}
          >
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => onPlayerClick(p)}
                style={{
                  background: `rgba(${rgb},0.07)`,
                  border: `1.5px solid rgba(${rgb},0.2)`,
                  borderRadius: '12px',
                  padding: '14px 8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
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
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: `rgba(${rgb},0.15)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...DISPLAY,
                    fontSize: '17px',
                    color,
                  }}
                >
                  {initials(p)}
                </div>
                <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', lineHeight: 1.3, fontWeight: 500 }}>
                  {p.first_name}
                  <br />
                  <span style={{ fontWeight: 700 }}>{p.last_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamZone({
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
      {/* Flash overlay */}
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

      {/* Team label */}
      <div
        style={{
          ...DISPLAY,
          fontSize: 'clamp(16px, 2.2vw, 26px)',
          color,
          letterSpacing: '0.12em',
          textAlign: 'center',
        }}
      >
        ÉQUIPE {team}
      </div>

      {/* Score — centré pour rester visible avec le Dynamic Island */}
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

      {/* Player avatars */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '5px',
          justifyContent: 'center',
          flex: 1,
          alignContent: 'flex-start',
        }}
      >
        {players.map((p) => (
          <div
            key={p.id}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `rgba(${rgb},0.1)`,
              border: `1.5px solid rgba(${rgb},0.25)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...DISPLAY,
              fontSize: '11px',
              color,
            }}
          >
            {initials(p)}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '6px',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={onGoal}
          style={{
            background: color,
            border: 'none',
            borderRadius: '10px',
            color: '#000',
            ...DISPLAY,
            fontSize: 'clamp(12px, 1.3vw, 16px)',
            letterSpacing: '0.06em',
            padding: '10px 14px',
            cursor: 'pointer',
            flex: 1,
            maxWidth: '140px',
            transition: 'opacity 0.15s, transform 0.1s',
            WebkitTapHighlightColor: 'transparent',
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
            background: 'rgba(255,100,0,0.08)',
            border: '1px solid rgba(255,100,0,0.3)',
            borderRadius: '8px',
            color: '#FF6400',
            ...DISPLAY,
            fontSize: 'clamp(11px, 1.1vw, 14px)',
            letterSpacing: '0.06em',
            padding: '10px 10px',
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
            WebkitTapHighlightColor: 'transparent',
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
            background: 'transparent',
            border: `1px solid ${score === 0 ? '#222' : '#333'}`,
            borderRadius: '8px',
            color: score === 0 ? '#2A2A2A' : '#555',
            ...DISPLAY,
            fontSize: '13px',
            letterSpacing: '0.04em',
            padding: '10px 10px',
            cursor: score === 0 ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          − CORRIGER
        </button>
      </div>
    </div>
  );
}

function PlayerSelectOverlay({
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
        position: 'fixed',
        inset: 0,
        background: 'rgba(4,4,4,0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        style={{
          background: '#0E0E0E',
          border: `1px solid rgba(${rgb},0.25)`,
          borderRadius: '16px',
          padding: '24px',
          width: 'min(520px, 55vw)',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: `0 0 60px rgba(${rgb},0.1)`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div
              style={{ ...DISPLAY, fontSize: '11px', color: '#444', letterSpacing: '0.16em', marginBottom: '6px' }}
            >
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
              background: 'transparent',
              border: '1px solid #2A2A2A',
              borderRadius: '8px',
              color: '#555',
              width: 36,
              height: 36,
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Player grid */}
        {players.length === 0 ? (
          <div style={{ color: '#333', fontSize: '14px', padding: '16px 0' }}>
            Aucun joueur assigné à cette équipe.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
              gap: '10px',
              marginBottom: step === 'ASSIST' ? '14px' : '0',
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
                    borderRadius: '12px',
                    padding: '14px 8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? `0 0 20px rgba(${rgb},0.3)` : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: isSelected ? 'rgba(0,0,0,0.2)' : `rgba(${rgb},0.15)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...DISPLAY,
                      fontSize: '17px',
                      color: isSelected ? '#000' : color,
                    }}
                  >
                    {initials(p)}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: isSelected ? '#000' : '#888',
                      textAlign: 'center',
                      lineHeight: 1.3,
                      fontWeight: 500,
                    }}
                  >
                    {p.first_name}
                    <br />
                    <span style={{ fontWeight: 700 }}>{p.last_name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Skip assist */}
        {step === 'ASSIST' && (
          <button
            onClick={onSkipAssist}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid #252525',
              borderRadius: '8px',
              color: '#555',
              ...DISPLAY,
              fontSize: '14px',
              letterSpacing: '0.08em',
              padding: '11px',
              cursor: 'pointer',
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

function StatCard({
  label,
  player,
  stat,
  colorHex,
  colorRgb,
}: {
  label: string;
  player?: Player;
  stat?: string;
  colorHex: string;
  colorRgb: string;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${BORDER}`,
        borderRadius: '14px',
        padding: '20px',
      }}
    >
      <div style={{ ...DISPLAY, fontSize: '11px', color: '#444', letterSpacing: '0.14em', marginBottom: '14px' }}>
        {label}
      </div>
      {player ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: `rgba(${colorRgb},0.12)`,
              border: `2px solid rgba(${colorRgb},0.35)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...DISPLAY,
              fontSize: '20px',
              color: colorHex,
              flexShrink: 0,
            }}
          >
            {initials(player)}
          </div>
          <div>
            <div style={{ fontSize: '15px', color: '#DDD', fontWeight: 600, lineHeight: 1.2 }}>
              {player.first_name} {player.last_name}
            </div>
            <div style={{ ...DISPLAY, fontSize: '22px', color: colorHex, marginTop: '2px' }}>{stat}</div>
          </div>
        </div>
      ) : (
        <div style={{ color: '#333', fontSize: '14px' }}>—</div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LivePage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  // ── Data state
  const [gameState, setGameState] = useState<GameState>('LOADING');
  const [matchTitle, setMatchTitle] = useState('MATCH');
  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);

  // ── Game state
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [events, setEvents] = useState<GoalEvent[]>([]);

  // ── Goal flash animation
  const [flashA, setFlashA] = useState(false);
  const [flashB, setFlashB] = useState(false);

  // ── Selection state
  const [showSelect, setShowSelect] = useState(false);
  const [selectTeam, setSelectTeam] = useState<'A' | 'B'>('A');
  const [selStep, setSelStep] = useState<SelectionStep>('SCORER');
  const [pendingScorer, setPendingScorer] = useState<Player | null>(null);

  // ── CSC state
  const [showCscSelect, setShowCscSelect] = useState(false);
  const [cscFaultTeam, setCscFaultTeam] = useState<'A' | 'B'>('A'); // équipe du joueur fautif

  // ── End match confirmation modal
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // ── Reset chrono confirmation modal
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);

  // ── Load match data ─────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const supabase = createClient() as any;

      const { data: match } = await supabase
        .from('matches')
        .select('title')
        .eq('id', matchId)
        .single();

      if (match) setMatchTitle(match.title);

      const { data: mps } = await supabase
        .from('match_players')
        .select('player_id, team, profiles(id, first_name, last_name, elo)')
        .eq('match_id', matchId);

      if (mps) {
        const players: Player[] = mps
          .filter((mp: any) => mp.profiles)
          .map((mp: any) => ({
            id: mp.profiles.id,
            first_name: mp.profiles.first_name,
            last_name: mp.profiles.last_name,
            elo: mp.profiles.elo,
            team: mp.team,
          }));
        setTeamA(players.filter((p) => p.team === 'A'));
        setTeamB(players.filter((p) => p.team === 'B'));
      }

      setGameState('PRE');
    };
    load();
  }, [matchId]);

  // ── Timer ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        timeRef.current += 1;
        setTime((t) => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // ── Auto-scroll events log ──────────────────────────────────────────────────

  useEffect(() => {
    if (eventsScrollRef.current) {
      eventsScrollRef.current.scrollLeft = eventsScrollRef.current.scrollWidth;
    }
  }, [events]);

  // ── Goal selection logic ────────────────────────────────────────────────────

  const openGoalSelector = useCallback((team: 'A' | 'B') => {
    setSelectTeam(team);
    setSelStep('SCORER');
    setPendingScorer(null);
    setShowSelect(true);
  }, []);

  const openCscSelector = useCallback((faultTeam: 'A' | 'B') => {
    setCscFaultTeam(faultTeam);
    setShowCscSelect(true);
  }, []);

  const confirmCsc = useCallback((faultPlayer: Player) => {
    // L'équipe bénéficiaire est l'opposée du fautif
    const benefitTeam: 'A' | 'B' = cscFaultTeam === 'A' ? 'B' : 'A';
    const evt: GoalEvent = {
      id: Math.random().toString(36).slice(2),
      team: benefitTeam,
      scorer: null,
      ownGoalPlayer: faultPlayer,
      assist: null,
      timestamp: timeRef.current,
      is_own_goal: true,
    };
    setEvents((prev) => [...prev, evt]);
    if (benefitTeam === 'A') {
      setScoreA((s) => s + 1);
      setFlashA(true);
      setTimeout(() => setFlashA(false), 800);
    } else {
      setScoreB((s) => s + 1);
      setFlashB(true);
      setTimeout(() => setFlashB(false), 800);
    }
    setShowCscSelect(false);
  }, [cscFaultTeam]);

  const handlePlayerClick = useCallback(
    (player: Player) => {
      if (selStep === 'SCORER') {
        setPendingScorer(player);
        setSelStep('ASSIST');
      } else {
        confirmGoal(pendingScorer!, player);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selStep, pendingScorer, selectTeam]
  );

  const confirmGoal = useCallback(
    (scorer: Player, assist: Player | null) => {
      const evt: GoalEvent = {
        id: Math.random().toString(36).slice(2),
        team: selectTeam,
        scorer,
        ownGoalPlayer: null,
        assist,
        timestamp: timeRef.current,
        is_own_goal: false,
      };
      setEvents((prev) => [...prev, evt]);
      if (selectTeam === 'A') {
        setScoreA((s) => s + 1);
        setFlashA(true);
        setTimeout(() => setFlashA(false), 800);
      } else {
        setScoreB((s) => s + 1);
        setFlashB(true);
        setTimeout(() => setFlashB(false), 800);
      }
      setShowSelect(false);
      setPendingScorer(null);
    },
    [selectTeam]
  );

  const removeLastGoal = useCallback((team: 'A' | 'B') => {
    setEvents((prev) => {
      const lastIdx = [...prev].reverse().findIndex((e) => e.team === team);
      if (lastIdx === -1) return prev;
      const actualIdx = prev.length - 1 - lastIdx;
      return prev.filter((_, i) => i !== actualIdx);
    });
    if (team === 'A') setScoreA((s) => Math.max(0, s - 1));
    else setScoreB((s) => Math.max(0, s - 1));
  }, []);

  // ── End match ───────────────────────────────────────────────────────────────

  const confirmEndMatch = useCallback(() => {
    setIsRunning(false);
    setShowEndConfirm(false);
    setGameState('POST');
  }, []);

  // ── Sync to Supabase ────────────────────────────────────────────────────────

  const syncToSupabase = async () => {
    setIsSyncing(true);
    const supabase = createClient() as any;

    // 1. Mettre à jour le match (score + statut + durée)
    await supabase
      .from('matches')
      .update({
        score_equipe_a: scoreA,
        score_equipe_b: scoreB,
        status: 'completed',
        duration_seconds: time,
      })
      .eq('id', matchId);

    // 2. Supprimer les buts existants (re-sync idempotent)
    await supabase.from('match_goals').delete().eq('match_id', matchId);

    // 3. Insérer tous les buts
    if (events.length > 0) {
      await supabase.from('match_goals').insert(
        events.map((evt, i) => ({
          match_id: matchId,
          scorer_id: evt.is_own_goal ? null : evt.scorer?.id ?? null,
          assist_id: evt.assist?.id ?? null,
          team: evt.team,
          minute: evt.timestamp,
          goal_order: i + 1,
          is_own_goal: evt.is_own_goal,
        }))
      );
    }

    // 4. Incrémenter own_goals pour les joueurs fautifs de CSC
    const cscEvents = events.filter((e) => e.is_own_goal && e.ownGoalPlayer);
    for (const cscEvt of cscEvents) {
      await supabase.rpc('increment_own_goals', { player_id: cscEvt.ownGoalPlayer!.id });
    }

    setIsSyncing(false);
    router.push(`/match/${matchId}?tab=stats`);
  };

  // ── Stats computation ───────────────────────────────────────────────────────

  const scorerMap = events.reduce(
    (acc: Record<string, { player: Player; goals: number }>, e) => {
      if (e.is_own_goal || !e.scorer) return acc; // exclure les CSC
      if (!acc[e.scorer.id]) acc[e.scorer.id] = { player: e.scorer, goals: 0 };
      acc[e.scorer.id].goals++;
      return acc;
    },
    {}
  );

  const assistMap = events.reduce(
    (acc: Record<string, { player: Player; assists: number }>, e) => {
      if (!e.assist) return acc;
      if (!acc[e.assist.id]) acc[e.assist.id] = { player: e.assist, assists: 0 };
      acc[e.assist.id].assists++;
      return acc;
    },
    {}
  );

  const bestScorer = Object.values(scorerMap).sort((a, b) => b.goals - a.goals)[0];
  const bestAssist = Object.values(assistMap).sort((a, b) => b.assists - a.assists)[0];
  const playersForSel = selectTeam === 'A' ? teamA : teamB;

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREENS
  // ─────────────────────────────────────────────────────────────────────────────

  // ── LOADING ─────────────────────────────────────────────────────────────────

  if (gameState === 'LOADING') {
    return (
      <div style={{ ...ROOT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Scanlines />
        <PortraitWarning />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: `2px solid ${LIME}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ ...DISPLAY, fontSize: '20px', color: LIME, letterSpacing: '0.2em' }}>
            CHARGEMENT
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── PRE ─────────────────────────────────────────────────────────────────────

  if (gameState === 'PRE') {
    return (
      <div
        style={{
          ...ROOT,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '28px',
          padding: '24px',
        }}
      >
        <Scanlines />
        <PortraitWarning />

        {/* Logo / title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...DISPLAY, fontSize: '11px', color: '#444', letterSpacing: '0.2em', marginBottom: '8px' }}>
            GRINTA LIVE
          </div>
          <div
            style={{
              ...DISPLAY,
              fontSize: 'clamp(22px, 4vw, 48px)',
              color: '#EEE',
              letterSpacing: '0.06em',
              maxWidth: '70vw',
              textAlign: 'center',
            }}
          >
            {matchTitle}
          </div>
        </div>

        {/* Teams preview */}
        <div
          style={{
            display: 'flex',
            gap: '40px',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${BORDER}`,
            borderRadius: '16px',
            padding: '24px 40px',
          }}
        >
          <TeamPreviewBlock team="A" players={teamA} />
          <div
            style={{
              ...DISPLAY,
              fontSize: '28px',
              color: '#2A2A2A',
              letterSpacing: '0.12em',
              flexShrink: 0,
            }}
          >
            VS
          </div>
          <TeamPreviewBlock team="B" players={teamB} />
        </div>

        {/* Start CTA */}
        <button
          onClick={() => {
            setGameState('LIVE');
            setIsRunning(true);
          }}
          style={{
            background: LIME,
            border: 'none',
            borderRadius: '12px',
            color: '#000',
            ...DISPLAY,
            fontSize: 'clamp(18px, 2.5vw, 26px)',
            letterSpacing: '0.08em',
            padding: '16px 56px',
            cursor: 'pointer',
            boxShadow: '0 0 32px rgba(170,255,0,0.25)',
            transition: 'box-shadow 0.2s, transform 0.1s',
          }}
          onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
          onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          ▶ LANCER LE MATCH
        </button>

        <button
          onClick={() => router.back()}
          style={{
            background: 'transparent',
            border: `1px solid ${BORDER}`,
            borderRadius: '8px',
            color: '#444',
            ...DISPLAY,
            fontSize: '13px',
            letterSpacing: '0.1em',
            padding: '8px 22px',
            cursor: 'pointer',
          }}
        >
          ← RETOUR
        </button>
      </div>
    );
  }

  // ── POST ─────────────────────────────────────────────────────────────────────

  if (gameState === 'POST') {
    const winner =
      scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null;

    return (
      <div
        style={{
          ...ROOT,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 24px',
          gap: '16px',
          animation: 'fadeIn 0.4s ease',
        }}
      >
        <Scanlines />
        <PortraitWarning />
        <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ ...DISPLAY, fontSize: 'clamp(20px, 3vw, 32px)', color: LIME, letterSpacing: '0.1em' }}>
            STATISTIQUES FINALES
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ ...DISPLAY, fontSize: '13px', color: '#444', letterSpacing: '0.1em' }}>
              DURÉE: {fmt(time)}
            </div>
            {winner && (
              <div
                style={{
                  ...DISPLAY,
                  fontSize: '13px',
                  color: winner === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR,
                  background:
                    winner === 'A'
                      ? `rgba(${TEAM_A_RGB},0.1)`
                      : `rgba(${TEAM_B_RGB},0.1)`,
                  border: `1px solid ${winner === 'A' ? `rgba(${TEAM_A_RGB},0.3)` : `rgba(${TEAM_B_RGB},0.3)`}`,
                  borderRadius: '6px',
                  padding: '3px 12px',
                  letterSpacing: '0.1em',
                }}
              >
                VICTOIRE ÉQUIPE {winner}
              </div>
            )}
          </div>
        </div>

        {/* Score + Stats row */}
        <div style={{ display: 'flex', gap: '14px', flex: '0 0 auto' }}>
          {/* Final score */}
          <div
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${BORDER}`,
              borderRadius: '14px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '28px',
              flexShrink: 0,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ ...DISPLAY, fontSize: '11px', color: TEAM_A_COLOR, letterSpacing: '0.15em', marginBottom: '4px' }}>
                ÉQUIPE A
              </div>
              <div
                style={{
                  ...DISPLAY,
                  fontSize: 'clamp(48px, 8vw, 80px)',
                  color: TEAM_A_COLOR,
                  lineHeight: 1,
                  textShadow: `0 0 30px rgba(${TEAM_A_RGB},0.4)`,
                }}
              >
                {scoreA}
              </div>
            </div>
            <div style={{ ...DISPLAY, fontSize: '28px', color: '#2A2A2A' }}>—</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ ...DISPLAY, fontSize: '11px', color: TEAM_B_COLOR, letterSpacing: '0.15em', marginBottom: '4px' }}>
                ÉQUIPE B
              </div>
              <div
                style={{
                  ...DISPLAY,
                  fontSize: 'clamp(48px, 8vw, 80px)',
                  color: TEAM_B_COLOR,
                  lineHeight: 1,
                  textShadow: `0 0 30px rgba(${TEAM_B_RGB},0.4)`,
                }}
              >
                {scoreB}
              </div>
            </div>
          </div>

          {/* Best scorer */}
          <StatCard
            label="⚽ BUTEUR DU MATCH"
            player={bestScorer?.player}
            stat={bestScorer ? `${bestScorer.goals} but${bestScorer.goals > 1 ? 's' : ''}` : undefined}
            colorHex={LIME}
            colorRgb="170,255,0"
          />

          {/* Best assist */}
          <StatCard
            label="🎯 MEILLEUR PASSEUR"
            player={bestAssist?.player}
            stat={bestAssist ? `${bestAssist.assists} passe${bestAssist.assists > 1 ? 's' : ''}` : undefined}
            colorHex="#FFB800"
            colorRgb="255,184,0"
          />
        </div>

        {/* Goal timeline */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${BORDER}`,
            borderRadius: '14px',
            padding: '16px 20px',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ ...DISPLAY, fontSize: '11px', color: '#444', letterSpacing: '0.14em', marginBottom: '12px' }}>
            TIMELINE DES BUTS
          </div>
          {events.length === 0 ? (
            <div style={{ color: '#333', fontSize: '14px' }}>Aucun but enregistré.</div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: '12px',
                overflowX: 'auto',
                paddingBottom: '4px',
                alignItems: 'center',
              }}
            >
              {events.map((evt, i) => (
                <div
                  key={evt.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0,
                    opacity: 0,
                    animation: `fadeIn 0.3s ease ${i * 0.07}s forwards`,
                  }}
                >
                  <div
                    style={{
                      ...DISPLAY,
                      fontSize: '11px',
                      color: '#444',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {fmt(evt.timestamp)}
                  </div>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: evt.is_own_goal
                        ? 'rgba(255,100,0,0.15)'
                        : evt.team === 'A' ? `rgba(${TEAM_A_RGB},0.15)` : `rgba(${TEAM_B_RGB},0.15)`,
                      border: `2px solid ${evt.is_own_goal ? '#FF6400' : evt.team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...DISPLAY,
                      fontSize: '13px',
                      color: evt.is_own_goal ? '#FF6400' : evt.team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR,
                    }}
                  >
                    {evt.is_own_goal ? '🥅' : (evt.scorer ? initials(evt.scorer) : '?')}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', lineHeight: 1.2 }}>
                    {evt.is_own_goal && evt.ownGoalPlayer ? (
                      <>
                        <span style={{ color: '#FF6400' }}>CSC</span>
                        <br />
                        {evt.ownGoalPlayer.first_name[0]}. {evt.ownGoalPlayer.last_name}
                      </>
                    ) : (
                      <>
                        {evt.scorer?.first_name[0]}. {evt.scorer?.last_name}
                        {evt.assist && (
                          <>
                            <br />
                            <span style={{ color: '#444' }}>
                              → {evt.assist.first_name[0]}. {evt.assist.last_name}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {/* connector */}
                  {i < events.length - 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        right: -7,
                        top: '50%',
                        width: 12,
                        height: 1,
                        background: '#222',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            onClick={() => setGameState('LIVE')}
            style={{
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: '8px',
              color: '#555',
              ...DISPLAY,
              fontSize: '14px',
              letterSpacing: '0.08em',
              padding: '11px 24px',
              cursor: 'pointer',
            }}
          >
            ← REPRENDRE
          </button>
          <button
            onClick={syncToSupabase}
            disabled={isSyncing}
            style={{
              background: isSyncing ? '#333' : LIME,
              border: 'none',
              borderRadius: '8px',
              color: isSyncing ? '#666' : '#000',
              ...DISPLAY,
              fontSize: '16px',
              letterSpacing: '0.06em',
              padding: '11px 32px',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              boxShadow: isSyncing ? 'none' : '0 0 24px rgba(170,255,0,0.2)',
            }}
          >
            {isSyncing ? 'SYNCHRONISATION...' : '✓ VALIDER ET ENVOYER'}
          </button>
        </div>
      </div>
    );
  }

  // ── LIVE ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{ ...ROOT, display: 'flex', flexDirection: 'column' }}>
      <Scanlines />
      <PortraitWarning />

      {/* Safe-area padding for Dynamic Island / notch in landscape */}
      <style>{`
        #team-zone-a { padding-left: max(14px, env(safe-area-inset-left, 14px)); }
        #team-zone-b { padding-right: max(14px, env(safe-area-inset-right, 14px)); }
      `}</style>

      {/* End match confirmation modal */}
      {showEndConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#111',
              border: `1px solid #2A2A2A`,
              borderRadius: '16px',
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              minWidth: '260px',
            }}
          >
            <div style={{ ...DISPLAY, fontSize: '22px', color: '#F0F0F0', letterSpacing: '0.06em' }}>
              TERMINER LE MATCH ?
            </div>
            <div style={{ fontSize: '13px', color: '#555', textAlign: 'center' }}>
              Le chrono sera arrêté et les statistiques<br />seront générées.
            </div>
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #2A2A2A',
                  borderRadius: '10px',
                  color: '#666',
                  ...DISPLAY,
                  fontSize: '14px',
                  padding: '12px',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                ANNULER
              </button>
              <button
                onClick={confirmEndMatch}
                style={{
                  flex: 1,
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.5)',
                  borderRadius: '10px',
                  color: TEAM_B_COLOR,
                  ...DISPLAY,
                  fontSize: '14px',
                  padding: '12px',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  fontWeight: 'bold',
                }}
              >
                ■ TERMINER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset chrono confirmation modal */}
      {showResetConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#111',
              border: `1px solid #2A2A2A`,
              borderRadius: '16px',
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              minWidth: '260px',
            }}
          >
            <div style={{ ...DISPLAY, fontSize: '22px', color: '#F0F0F0', letterSpacing: '0.06em' }}>
              RÉINITIALISER LE CHRONO ?
            </div>
            <div style={{ fontSize: '13px', color: '#555', textAlign: 'center' }}>
              Le temps repassera à 00:00.<br />Les buts et le score ne sont pas effacés.
            </div>
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #2A2A2A',
                  borderRadius: '10px',
                  color: '#666',
                  ...DISPLAY,
                  fontSize: '14px',
                  padding: '12px',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                ANNULER
              </button>
              <button
                onClick={() => {
                  setIsRunning(false);
                  setTime(0);
                  timeRef.current = 0;
                  setShowResetConfirm(false);
                }}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid #3A3A3A',
                  borderRadius: '10px',
                  color: '#CCC',
                  ...DISPLAY,
                  fontSize: '14px',
                  padding: '12px',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                ↺ RESET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player selection overlay (buts normaux) */}
      {showSelect && (
        <PlayerSelectOverlay
          team={selectTeam}
          step={selStep}
          players={playersForSel}
          pendingScorer={pendingScorer}
          onPlayerClick={handlePlayerClick}
          onSkipAssist={() => confirmGoal(pendingScorer!, null)}
          onClose={() => setShowSelect(false)}
        />
      )}

      {/* CSC selection overlay */}
      {showCscSelect && (
        <CscSelectOverlay
          faultTeam={cscFaultTeam}
          players={cscFaultTeam === 'A' ? teamA : teamB}
          onPlayerClick={confirmCsc}
          onClose={() => setShowCscSelect(false)}
        />
      )}

      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#444',
            ...DISPLAY,
            fontSize: '13px',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            padding: '0 6px',
          }}
        >
          ← RETOUR
        </button>

        <div
          style={{
            ...DISPLAY,
            fontSize: 'clamp(13px, 2vw, 19px)',
            color: '#888',
            letterSpacing: '0.1em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '40%',
          }}
        >
          {matchTitle}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isRunning ? LIME : '#3A3A3A',
              boxShadow: isRunning ? `0 0 8px ${LIME}` : 'none',
              animation: isRunning ? 'pulseLime 1.5s ease-in-out infinite' : 'none',
              transition: 'background 0.3s',
            }}
          />
          <span
            style={{
              ...DISPLAY,
              fontSize: '12px',
              color: isRunning ? LIME : '#444',
              letterSpacing: '0.08em',
              transition: 'color 0.3s',
            }}
          >
            {isRunning ? 'EN COURS' : 'PAUSE'}
          </span>
        </div>
      </div>

      {/* ── Main play area ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Team A */}
        <TeamZone
          id="team-zone-a"
          team="A"
          players={teamA}
          score={scoreA}
          onGoal={() => openGoalSelector('A')}
          onCsc={() => openCscSelector('A')}
          onRemove={() => removeLastGoal('A')}
          flashGoal={flashA}
        />

        {/* Center column: chrono + controls */}
        <div
          style={{
            width: 'clamp(160px, 20vw, 240px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '8px 12px',
            flexShrink: 0,
            position: 'relative',
            background: 'rgba(255,255,255,0.01)',
          }}
        >
          {/* Corner decorators */}
          {[
            { top: 8, left: 8, borderTop: `2px solid ${BORDER}`, borderLeft: `2px solid ${BORDER}` },
            { top: 8, right: 8, borderTop: `2px solid ${BORDER}`, borderRight: `2px solid ${BORDER}` },
            { bottom: 8, left: 8, borderBottom: `2px solid ${BORDER}`, borderLeft: `2px solid ${BORDER}` },
            { bottom: 8, right: 8, borderBottom: `2px solid ${BORDER}`, borderRight: `2px solid ${BORDER}` },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 12,
                height: 12,
                ...s,
              }}
            />
          ))}

          {/* Chrono */}
          <div
            style={{
              ...DISPLAY,
              fontSize: 'clamp(34px, 5.5vw, 68px)',
              color: isRunning ? LIME : '#CCC',
              letterSpacing: '0.02em',
              lineHeight: 1,
              textShadow: isRunning ? '0 0 32px rgba(170,255,0,0.45)' : 'none',
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.4s, text-shadow 0.4s',
            }}
          >
            {fmt(time)}
          </div>

          {/* Start / Pause + Reset */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setIsRunning((r) => !r)}
              style={{
                background: isRunning ? 'rgba(239,68,68,0.1)' : 'rgba(170,255,0,0.1)',
                border: `1px solid ${isRunning ? TEAM_B_COLOR : LIME}`,
                borderRadius: '8px',
                color: isRunning ? TEAM_B_COLOR : LIME,
                ...DISPLAY,
                fontSize: '12px',
                letterSpacing: '0.06em',
                padding: '8px 10px',
                cursor: 'pointer',
                minWidth: '64px',
                transition: 'all 0.2s',
              }}
            >
              {isRunning ? '⏸ PAUSE' : '▶ START'}
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              style={{
                background: 'transparent',
                border: `1px solid ${BORDER}`,
                borderRadius: '8px',
                color: '#444',
                ...DISPLAY,
                fontSize: '14px',
                padding: '8px 10px',
                cursor: 'pointer',
              }}
              title="Réinitialiser le chrono"
            >
              ↺
            </button>
          </div>

          {/* End match button */}
          <button
            onClick={() => setShowEndConfirm(true)}
            style={{
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#EF4444',
              ...DISPLAY,
              fontSize: '11px',
              letterSpacing: '0.08em',
              padding: '8px 12px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            ■ FIN DU MATCH
          </button>
        </div>

        {/* Team B */}
        <TeamZone
          id="team-zone-b"
          team="B"
          players={teamB}
          score={scoreB}
          onGoal={() => openGoalSelector('B')}
          onCsc={() => openCscSelector('B')}
          onRemove={() => removeLastGoal('B')}
          flashGoal={flashB}
        />
      </div>

      {/* ── Events log ticker ───────────────────────────────────────────────── */}
      <div
        ref={eventsScrollRef}
        style={{
          height: '34px',
          borderTop: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: '4px',
          overflowX: 'auto',
          overflowY: 'hidden',
          flexShrink: 0,
          scrollbarWidth: 'none',
        }}
      >
        {events.length === 0 ? (
          <span
            style={{
              ...DISPLAY,
              fontSize: '11px',
              color: '#2A2A2A',
              letterSpacing: '0.1em',
            }}
          >
            AUCUN ÉVÉNEMENT · APPUYEZ SUR + MARQUER POUR ENREGISTRER UN BUT
          </span>
        ) : (
          events.map((evt, i) => (
            <div
              key={evt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0,
              }}
            >
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
                  <span
                    style={{
                      fontSize: '11px',
                      color: evt.team === 'A' ? '#60A5FA' : '#F87171',
                      fontWeight: 600,
                    }}
                  >
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
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: evt.team === 'A' ? TEAM_A_COLOR : TEAM_B_COLOR,
                  flexShrink: 0,
                  marginLeft: 2,
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
