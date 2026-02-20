'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { finalizeMatchResult } from '@/lib/elo';
import { assignChallenges } from '@/lib/challenges';

import type { Player, GoalEvent, GameState, SelectionStep } from '@/components/grinta/live/types';
import { DISPLAY, LIME, BORDER, ROOT, fmt } from '@/components/grinta/live/types';
import { Scanlines, PortraitWarning } from '@/components/grinta/live/PortraitWarning';
import { PreMatchScreen } from '@/components/grinta/live/PreMatchScreen';
import { PostMatchScreen } from '@/components/grinta/live/PostMatchScreen';
import { TeamZone } from '@/components/grinta/live/TeamZone';
import { PlayerSelectOverlay } from '@/components/grinta/live/PlayerSelectOverlay';
import { CscSelectOverlay } from '@/components/grinta/live/CscSelectOverlay';
import { EventTicker } from '@/components/grinta/live/EventTicker';

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

  // ── Flash
  const [flashA, setFlashA] = useState(false);
  const [flashB, setFlashB] = useState(false);

  // ── Selection
  const [showSelect, setShowSelect] = useState(false);
  const [selectTeam, setSelectTeam] = useState<'A' | 'B'>('A');
  const [selStep, setSelStep] = useState<SelectionStep>('SCORER');
  const [pendingScorer, setPendingScorer] = useState<Player | null>(null);

  // ── CSC
  const [showCscSelect, setShowCscSelect] = useState(false);
  const [cscFaultTeam, setCscFaultTeam] = useState<'A' | 'B'>('A');

  // ── Modals
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Sync
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const goalOrderRef = useRef(0);

  // ── Load match data
  useEffect(() => {
    const load = async () => {
      const supabase = createClient() as any;
      const { data: match } = await supabase.from('matches').select('title').eq('id', matchId).single();
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

  // ── Timer
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        timeRef.current += 1;
        setTime((t) => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // ── Auto-scroll events
  useEffect(() => {
    if (eventsScrollRef.current) {
      eventsScrollRef.current.scrollLeft = eventsScrollRef.current.scrollWidth;
    }
  }, [events]);

  // ── Sync intermédiaire : écrire chaque but en temps réel
  const syncGoalRealtime = useCallback(async (evt: GoalEvent, newScoreA: number, newScoreB: number) => {
    const supabase = createClient() as any;
    goalOrderRef.current += 1;
    // Écrire le but dans match_goals
    await supabase.from('match_goals').insert({
      match_id: matchId,
      scorer_id: evt.is_own_goal ? (evt.ownGoalPlayer?.id ?? null) : (evt.scorer?.id ?? null),
      assist_id: evt.assist?.id ?? null,
      team: evt.team,
      minute: evt.timestamp,
      goal_order: goalOrderRef.current,
      is_own_goal: evt.is_own_goal,
    });
    // Mettre à jour le score dans matches
    await supabase.from('matches').update({
      score_equipe_a: newScoreA,
      score_equipe_b: newScoreB,
    }).eq('id', matchId);
    // Incrémenter CSC si applicable
    if (evt.is_own_goal && evt.ownGoalPlayer) {
      await supabase.rpc('increment_own_goals', { player_id: evt.ownGoalPlayer.id });
    }
  }, [matchId]);

  // ── Passer le match en "ongoing" au lancement + assigner défis
  const startMatch = useCallback(async () => {
    setGameState('LIVE');
    setIsRunning(true);
    const supabase = createClient() as any;
    await supabase.from('matches').update({ status: 'ongoing' }).eq('id', matchId);
    // Assigner un défi confidentiel à chaque joueur
    assignChallenges(matchId).catch(() => {});
  }, [matchId]);

  // ── Goal selection logic
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
    const newA = benefitTeam === 'A' ? scoreA + 1 : scoreA;
    const newB = benefitTeam === 'B' ? scoreB + 1 : scoreB;
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
    syncGoalRealtime(evt, newA, newB);
  }, [cscFaultTeam, scoreA, scoreB, syncGoalRealtime]);

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
      const newA = selectTeam === 'A' ? scoreA + 1 : scoreA;
      const newB = selectTeam === 'B' ? scoreB + 1 : scoreB;
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
      syncGoalRealtime(evt, newA, newB);
    },
    [selectTeam, scoreA, scoreB, syncGoalRealtime]
  );

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

  const removeLastGoal = useCallback((team: 'A' | 'B') => {
    setEvents((prev) => {
      const lastIdx = [...prev].reverse().findIndex((e) => e.team === team);
      if (lastIdx === -1) return prev;
      const actualIdx = prev.length - 1 - lastIdx;
      return prev.filter((_, i) => i !== actualIdx);
    });
    const newA = team === 'A' ? Math.max(0, scoreA - 1) : scoreA;
    const newB = team === 'B' ? Math.max(0, scoreB - 1) : scoreB;
    if (team === 'A') setScoreA((s) => Math.max(0, s - 1));
    else setScoreB((s) => Math.max(0, s - 1));
    // Supprimer le dernier but de cette équipe dans Supabase
    goalOrderRef.current = Math.max(0, goalOrderRef.current - 1);
    const supabase = createClient() as any;
    supabase.from('match_goals')
      .delete()
      .eq('match_id', matchId)
      .eq('team', team)
      .order('goal_order', { ascending: false })
      .limit(1)
      .then(() => {
        // Mettre à jour le score
        supabase.from('matches').update({
          score_equipe_a: newA,
          score_equipe_b: newB,
        }).eq('id', matchId);
      });
  }, [matchId, scoreA, scoreB]);

  const confirmEndMatch = useCallback(() => {
    setIsRunning(false);
    setShowEndConfirm(false);
    setGameState('POST');
  }, []);

  // ── Sync final : les buts sont déjà écrits en temps réel, on finalise juste le match
  const syncToSupabase = async () => {
    setIsSyncing(true);
    const supabase = createClient() as any;

    const { error: matchError } = await supabase
      .from('matches')
      .update({ score_equipe_a: scoreA, score_equipe_b: scoreB, status: 'completed', duration_seconds: time })
      .eq('id', matchId);

    if (matchError) {
      toast.error('Erreur sauvegarde match : ' + matchError.message);
      setIsSyncing(false);
      return;
    }

    // Calcul ELO post-match
    try {
      await finalizeMatchResult(matchId);
    } catch (err) {
      console.error('Erreur calcul ELO:', err);
    }

    setIsSyncing(false);
    router.push(`/match/${matchId}?tab=stats`);
  };

  const playersForSel = selectTeam === 'A' ? teamA : teamB;

  // ── SCREENS ──

  if (gameState === 'LOADING') {
    return (
      <div style={{ ...ROOT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Scanlines />
        <PortraitWarning />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: 48, height: 48, border: `2px solid ${LIME}`, borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ ...DISPLAY, fontSize: '20px', color: LIME, letterSpacing: '0.2em' }}>CHARGEMENT</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (gameState === 'PRE') {
    return (
      <PreMatchScreen
        matchTitle={matchTitle}
        teamA={teamA}
        teamB={teamB}
        onStart={startMatch}
        onBack={() => router.back()}
      />
    );
  }

  if (gameState === 'POST') {
    return (
      <PostMatchScreen
        events={events}
        scoreA={scoreA}
        scoreB={scoreB}
        time={time}
        onResume={() => setGameState('LIVE')}
        onSync={syncToSupabase}
        isSyncing={isSyncing}
      />
    );
  }

  // ── LIVE ──
  return (
    <div style={{ ...ROOT, display: 'flex', flexDirection: 'column' }}>
      <Scanlines />
      <PortraitWarning />

      <style>{`
        #team-zone-a { padding-left: max(14px, env(safe-area-inset-left, 14px)); }
        #team-zone-b { padding-right: max(14px, env(safe-area-inset-right, 14px)); }
        @keyframes pulseLime { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* End match confirmation modal */}
      {showEndConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: '16px', padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', minWidth: '260px' }}>
            <div style={{ ...DISPLAY, fontSize: '22px', color: '#F0F0F0', letterSpacing: '0.06em' }}>TERMINER LE MATCH ?</div>
            <div style={{ fontSize: '13px', color: '#555', textAlign: 'center' }}>Le chrono sera arrêté et les statistiques<br />seront générées.</div>
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button onClick={() => setShowEndConfirm(false)} style={{ flex: 1, background: 'transparent', border: '1px solid #2A2A2A', borderRadius: '10px', color: '#666', ...DISPLAY, fontSize: '14px', padding: '12px', cursor: 'pointer', letterSpacing: '0.06em' }}>ANNULER</button>
              <button onClick={confirmEndMatch} style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: '10px', color: '#EF4444', ...DISPLAY, fontSize: '14px', padding: '12px', cursor: 'pointer', letterSpacing: '0.06em', fontWeight: 'bold' }}>■ TERMINER</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset chrono confirmation modal */}
      {showResetConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: '16px', padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', minWidth: '260px' }}>
            <div style={{ ...DISPLAY, fontSize: '22px', color: '#F0F0F0', letterSpacing: '0.06em' }}>RÉINITIALISER LE CHRONO ?</div>
            <div style={{ fontSize: '13px', color: '#555', textAlign: 'center' }}>Le temps repassera à 00:00.<br />Les buts et le score ne sont pas effacés.</div>
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, background: 'transparent', border: '1px solid #2A2A2A', borderRadius: '10px', color: '#666', ...DISPLAY, fontSize: '14px', padding: '12px', cursor: 'pointer', letterSpacing: '0.06em' }}>ANNULER</button>
              <button onClick={() => { setIsRunning(false); setTime(0); timeRef.current = 0; setShowResetConfirm(false); }} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid #3A3A3A', borderRadius: '10px', color: '#CCC', ...DISPLAY, fontSize: '14px', padding: '12px', cursor: 'pointer', letterSpacing: '0.06em' }}>↺ RESET</button>
            </div>
          </div>
        </div>
      )}

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

      {showCscSelect && (
        <CscSelectOverlay
          faultTeam={cscFaultTeam}
          players={cscFaultTeam === 'A' ? teamA : teamB}
          onPlayerClick={confirmCsc}
          onClose={() => setShowCscSelect(false)}
        />
      )}

      {/* Header bar */}
      <div style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: '#444', ...DISPLAY, fontSize: '13px', letterSpacing: '0.06em', cursor: 'pointer', padding: '0 6px' }}>← RETOUR</button>
        <div style={{ ...DISPLAY, fontSize: 'clamp(13px, 2vw, 19px)', color: '#888', letterSpacing: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' }}>{matchTitle}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: isRunning ? LIME : '#3A3A3A', boxShadow: isRunning ? `0 0 8px ${LIME}` : 'none', animation: isRunning ? 'pulseLime 1.5s ease-in-out infinite' : 'none', transition: 'background 0.3s' }} />
          <span style={{ ...DISPLAY, fontSize: '12px', color: isRunning ? LIME : '#444', letterSpacing: '0.08em', transition: 'color 0.3s' }}>{isRunning ? 'EN COURS' : 'PAUSE'}</span>
        </div>
      </div>

      {/* Main play area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <TeamZone id="team-zone-a" team="A" players={teamA} score={scoreA} onGoal={() => openGoalSelector('A')} onCsc={() => openCscSelector('A')} onRemove={() => removeLastGoal('A')} flashGoal={flashA} />

        {/* Center column */}
        <div style={{ width: 'clamp(160px, 20vw, 240px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '8px 12px', flexShrink: 0, position: 'relative', background: 'rgba(255,255,255,0.01)' }}>
          {[
            { top: 8, left: 8, borderTop: `2px solid ${BORDER}`, borderLeft: `2px solid ${BORDER}` },
            { top: 8, right: 8, borderTop: `2px solid ${BORDER}`, borderRight: `2px solid ${BORDER}` },
            { bottom: 8, left: 8, borderBottom: `2px solid ${BORDER}`, borderLeft: `2px solid ${BORDER}` },
            { bottom: 8, right: 8, borderBottom: `2px solid ${BORDER}`, borderRight: `2px solid ${BORDER}` },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 12, height: 12, ...s }} />
          ))}

          <div style={{ ...DISPLAY, fontSize: 'clamp(34px, 5.5vw, 68px)', color: isRunning ? LIME : '#CCC', letterSpacing: '0.02em', lineHeight: 1, textShadow: isRunning ? '0 0 32px rgba(170,255,0,0.45)' : 'none', fontVariantNumeric: 'tabular-nums', transition: 'color 0.4s, text-shadow 0.4s' }}>
            {fmt(time)}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setIsRunning((r) => !r)} style={{ background: isRunning ? 'rgba(239,68,68,0.1)' : 'rgba(170,255,0,0.1)', border: `1px solid ${isRunning ? '#EF4444' : LIME}`, borderRadius: '8px', color: isRunning ? '#EF4444' : LIME, ...DISPLAY, fontSize: '12px', letterSpacing: '0.06em', padding: '8px 10px', cursor: 'pointer', minWidth: '64px', transition: 'all 0.2s' }}>
              {isRunning ? '⏸ PAUSE' : '▶ START'}
            </button>
            <button onClick={() => setShowResetConfirm(true)} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#444', ...DISPLAY, fontSize: '14px', padding: '8px 10px', cursor: 'pointer' }} title="Réinitialiser le chrono">↺</button>
          </div>

          <button onClick={() => setShowEndConfirm(true)} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#EF4444', ...DISPLAY, fontSize: '11px', letterSpacing: '0.08em', padding: '8px 12px', cursor: 'pointer', width: '100%' }}>
            ■ FIN DU MATCH
          </button>
        </div>

        <TeamZone id="team-zone-b" team="B" players={teamB} score={scoreB} onGoal={() => openGoalSelector('B')} onCsc={() => openCscSelector('B')} onRemove={() => removeLastGoal('B')} flashGoal={flashB} />
      </div>

      <EventTicker ref={eventsScrollRef} events={events} />
    </div>
  );
}
