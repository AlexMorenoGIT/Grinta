'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, MapPin, Calendar, Clock, Users, Trophy,
  Star, Zap, Crown, EuroIcon, Settings
} from 'lucide-react'
import Link from 'next/link'
import type { Profile, Match, MatchPlayer } from '@/types/database'
import { EditMatchModal } from '@/components/grinta/EditMatchModal'
import { finalizeMatchResult } from '@/lib/elo'
import { CHALLENGE_DESCRIPTIONS } from '@/lib/challenges'
import { WhatsAppSection } from '@/components/grinta/match/WhatsAppSection'
import { PaymentSection } from '@/components/grinta/match/PaymentSection'
import { CompositionsSection } from '@/components/grinta/match/CompositionsSection'
import { RatingSection } from '@/components/grinta/match/RatingSection'
import { StatsSection } from '@/components/grinta/match/StatsSection'

type PlayerWithProfile = MatchPlayer & { profiles: Profile }

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient() as any

  const [match, setMatch] = useState<Match | null>(null)
  const [players, setPlayers] = useState<PlayerWithProfile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [registerLoading, setRegisterLoading] = useState(false)
  const initialTab = (searchParams.get('tab') as 'info' | 'compo' | 'stats' | 'notes' | 'whatsapp') ?? 'info'
  const [tab, setTab] = useState<'info' | 'compo' | 'stats' | 'notes' | 'whatsapp'>(initialTab)
  const [showScoreForm, setShowScoreForm] = useState(false)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [myChallenge, setMyChallenge] = useState<any>(null)

  const loadMatch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const matchRes = await supabase.from('matches').select('*').eq('id', id).single()
    const playersRes = await supabase.from('match_players').select('*, profiles(*)').eq('match_id', id).order('joined_at')

    if (profileRes.data) setCurrentUser(profileRes.data)
    if (matchRes.data) setMatch(matchRes.data)
    if (playersRes.data) {
      setPlayers(playersRes.data as PlayerWithProfile[])
      setIsRegistered((playersRes.data as PlayerWithProfile[]).some((p: PlayerWithProfile) => p.player_id === user.id))
    }

    // Charger le défi personnel (RLS = visible uniquement par le joueur)
    const { data: challenge } = await supabase
      .from('match_challenges')
      .select('*, target:target_player_id(first_name, last_name)')
      .eq('match_id', id)
      .eq('player_id', user.id)
      .maybeSingle()
    if (challenge) setMyChallenge(challenge)

    setLoading(false)
  }, [id, supabase])

  useEffect(() => { loadMatch() }, [loadMatch])

  // Realtime: écouter les changements sur matches et match_goals
  useEffect(() => {
    const channel = supabase
      .channel(`match-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, () => {
        loadMatch()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_goals', filter: `match_id=eq.${id}` }, () => {
        loadMatch()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, supabase, loadMatch])

  const toggleRegistration = async () => {
    if (!currentUser || !match) return
    setRegisterLoading(true)

    if (isRegistered) {
      await supabase.from('match_players').delete().eq('match_id', id).eq('player_id', currentUser.id)
      toast.success('Tu t\'es désinscrit du match')
    } else {
      if (players.length >= match.max_players) {
        toast.error('Match complet !')
        setRegisterLoading(false)
        return
      }
      await supabase.from('match_players').insert({ match_id: id, player_id: currentUser.id })
      toast.success('Tu es inscrit au match ! 🔥')
    }

    await loadMatch()
    setRegisterLoading(false)
  }

  const setScore = async () => {
    if (!scoreA || !scoreB) return
    await supabase.from('matches').update({
      score_equipe_a: parseInt(scoreA),
      score_equipe_b: parseInt(scoreB),
      status: 'completed',
    }).eq('id', id)
    toast.success('Score enregistré !')
    setShowScoreForm(false)
    try {
      await finalizeMatchResult(id as string)
    } catch (err) {
      console.error('Erreur calcul ELO:', err)
    }
    await loadMatch()
  }

  const isCreator = match?.created_by === currentUser?.id
  const isLive = match?.status === 'ongoing'

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#080808] flex items-center justify-center">
        <div className="space-y-3 w-full px-5">
          <div className="skeleton h-8 w-2/3" />
          <div className="skeleton h-48" />
          <div className="skeleton h-24" />
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-dvh bg-[#080808] flex items-center justify-center">
        <p className="text-[#555]">Match introuvable.</p>
      </div>
    )
  }

  const statusConfig = {
    upcoming: { label: 'À VENIR', class: 'status-upcoming' },
    ongoing: { label: 'EN COURS', class: 'status-ongoing' },
    completed: { label: 'TERMINÉ', class: 'status-completed' },
    cancelled: { label: 'ANNULÉ', class: 'status-completed' },
  }[match.status] || { label: match.status, class: 'status-completed' }

  return (
    <div className="min-h-dvh bg-[#080808]">
      {/* Header */}
      <div className="sticky top-0 z-40 px-5 pt-12 pb-4"
        style={{ background: 'linear-gradient(to bottom, #080808 80%, transparent)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.push('/home')}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: '#141414', border: '1px solid #1E1E1E' }}
          >
            <ArrowLeft className="w-4 h-4 text-[#888]" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl text-white leading-tight truncate">
              {match.title.toUpperCase()}
            </h1>
          </div>
          <span className={statusConfig.class}>{statusConfig.label}</span>
          {match.status !== 'completed' && match.status !== 'cancelled' && (
            <button
              onClick={() => router.push(`/match/${id}/live`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-display text-xs font-bold tracking-wider transition-all"
              style={{ background: 'rgba(170,255,0,0.12)', border: '1px solid rgba(170,255,0,0.3)', color: 'var(--lime)' }}
            >
              {isLive && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              <Zap className="w-3.5 h-3.5" />
              LIVE
            </button>
          )}
          {isCreator && (
            <button
              onClick={() => setShowEditModal(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: '#141414', border: '1px solid #1E1E1E' }}
            >
              <Settings className="w-4 h-4 text-[#888]" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: '#111' }}>
          {(([
            { key: 'info', label: 'Infos' },
            { key: 'compo', label: 'Compos' },
            ...(match.status === 'completed' ? [{ key: 'stats', label: '📊 Stats' }] : []),
            { key: 'notes', label: 'Notes' },
            { key: 'whatsapp', label: '📱 WA' },
          ]) as { key: typeof tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-lg text-xs font-display font-bold tracking-wider uppercase transition-all whitespace-nowrap"
              style={{
                background: tab === t.key ? '#1E1E1E' : 'transparent',
                color: tab === t.key ? 'var(--lime)' : '#555',
                border: tab === t.key ? '1px solid #2A2A2A' : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-28 space-y-4">
        {/* TAB: INFO */}
        {tab === 'info' && (
          <div className="animate-fade-in space-y-4">
            {/* Match details */}
            <div className="card-dark p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-[#444] flex-shrink-0" />
                <span className="text-sm text-white capitalize">{formatDate(match.date)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-[#444] flex-shrink-0" />
                <span className="text-sm text-white">{match.heure.substring(0, 5)}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#444] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white">{match.lieu}</p>
                  {match.google_maps_url && (
                    <a href={match.google_maps_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs hover:underline mt-0.5 inline-block transition-colors"
                      style={{ color: 'var(--lime)' }}>
                      Voir sur Maps →
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-[#444] flex-shrink-0" />
                <span className="text-sm text-white">{players.length} / {match.max_players} joueurs</span>
              </div>
              {match.price_total && (
                <div className="flex items-center gap-3">
                  <EuroIcon className="w-4 h-4 text-[#444] flex-shrink-0" />
                  <span className="text-sm text-white">{match.price_total} € au total</span>
                </div>
              )}
              {match.notes && (
                <div className="pt-3 border-t border-[#1A1A1A]">
                  <p className="text-xs text-[#888] leading-relaxed">{match.notes}</p>
                </div>
              )}
            </div>

            {/* Défi confidentiel (visible uniquement par le joueur) */}
            {myChallenge && (() => {
              const info = CHALLENGE_DESCRIPTIONS[myChallenge.challenge_type]
              if (!info) return null
              return (
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: myChallenge.is_completed
                      ? 'rgba(170,255,0,0.06)'
                      : 'rgba(139,92,246,0.06)',
                    border: `1px solid ${myChallenge.is_completed ? 'rgba(170,255,0,0.2)' : 'rgba(139,92,246,0.2)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{info.icon}</span>
                    <span className="font-display text-xs tracking-widest" style={{ color: myChallenge.is_completed ? 'var(--lime)' : '#8B5CF6' }}>
                      {myChallenge.is_completed ? 'DÉFI ACCOMPLI !' : 'TON DÉFI SECRET'}
                    </span>
                  </div>
                  <p className="font-display text-base text-white">{info.title}</p>
                  <p className="text-xs text-[#888] mt-1">
                    {info.desc}
                    {myChallenge.challenge_type === 'binome' && myChallenge.target && (
                      <span className="text-[#8B5CF6]"> → {myChallenge.target.first_name} {myChallenge.target.last_name}</span>
                    )}
                  </p>
                  {myChallenge.is_completed && (
                    <p className="text-xs mt-2 font-display" style={{ color: 'var(--lime)' }}>+5 ELO BONUS</p>
                  )}
                </div>
              )
            })()}

            {/* Score si terminé */}
            {match.status === 'completed' && match.score_equipe_a !== null && (
              <div className="card-dark p-4 text-center">
                <p className="text-xs text-[#555] font-display-light tracking-widest mb-3">SCORE FINAL</p>
                <div className="flex items-center justify-center gap-4">
                  <span className="font-display text-xl text-blue-400">ÉQUIPE A</span>
                  <span className="font-display text-4xl text-white">
                    {match.score_equipe_a} — {match.score_equipe_b}
                  </span>
                  <span className="font-display text-xl text-red-400">ÉQUIPE B</span>
                </div>
              </div>
            )}

            {/* Set score (créateur) */}
            {isCreator && match.status !== 'completed' && match.status !== 'cancelled' && (
              <div>
                {showScoreForm ? (
                  <div className="card-dark p-4 space-y-3">
                    <p className="font-display text-sm text-white mb-2">SAISIR LE SCORE FINAL</p>
                    <div className="grid grid-cols-3 gap-3 items-center">
                      <div>
                        <label className="text-xs text-blue-400 font-display-light block mb-1">ÉQUIPE A</label>
                        <input type="number" min={0} max={99} value={scoreA}
                          onChange={e => setScoreA(e.target.value)}
                          className="input-dark text-center text-xl font-display" />
                      </div>
                      <span className="font-display text-2xl text-[#444] text-center">—</span>
                      <div>
                        <label className="text-xs text-red-400 font-display-light block mb-1">ÉQUIPE B</label>
                        <input type="number" min={0} max={99} value={scoreB}
                          onChange={e => setScoreB(e.target.value)}
                          className="input-dark text-center text-xl font-display" />
                      </div>
                    </div>
                    <button onClick={setScore} className="btn-lime mt-2">VALIDER LE SCORE</button>
                    <button onClick={() => setShowScoreForm(false)} className="btn-ghost">Annuler</button>
                  </div>
                ) : (
                  <button onClick={() => setShowScoreForm(true)} className="btn-ghost flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    SAISIR LE SCORE FINAL
                  </button>
                )}
              </div>
            )}

            {/* Liste des joueurs */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full" style={{ background: 'var(--lime)' }} />
                <h3 className="font-display text-base text-white">
                  JOUEURS ({players.length}/{match.max_players})
                </h3>
              </div>

              <div className="space-y-2">
                {players.map((player, i) => (
                  <Link
                    key={player.id}
                    href={`/joueur/${player.player_id}`}
                    className={`card-dark p-3 flex items-center gap-3 animate-slide-up delay-${Math.min(i + 1, 6)} transition-all hover:border-[#333]`}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        background: player.team === 'A' ? '#1A3A5C' : player.team === 'B' ? '#3A1A1A' : '#1A1A1A',
                        color: player.team === 'A' ? '#60A5FA' : player.team === 'B' ? '#F87171' : '#666',
                        border: '1px solid',
                        borderColor: player.team === 'A' ? '#1A3A5C' : player.team === 'B' ? '#3A1A1A' : '#2A2A2A',
                      }}>
                      {player.profiles.first_name.charAt(0)}{player.profiles.last_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-semibold truncate">
                        {player.profiles.first_name} {player.profiles.last_name}
                        {player.player_id === match.created_by && (
                          <span className="ml-2 text-[10px] text-[#555] font-normal">organisateur</span>
                        )}
                      </p>
                    </div>
                    {player.team && (
                      <span className={player.team === 'A' ? 'team-a-badge' : 'team-b-badge'}>
                        ÉQ. {player.team}
                      </span>
                    )}
                    {player.profiles.mvp_count > 0 && (
                      <div className="flex items-center gap-1 text-xs mvp-badge px-2 py-0.5 rounded">
                        <Crown className="w-3 h-3" />
                        <span>{player.profiles.mvp_count}</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {/* Section paiement */}
            {match.price_total && (
              <PaymentSection
                match={match}
                players={players}
                isCreator={isCreator}
                onUpdate={loadMatch}
              />
            )}

            {/* Bouton inscription */}
            {match.status === 'upcoming' && (
              <button
                onClick={toggleRegistration}
                disabled={registerLoading || (!isRegistered && players.length >= match.max_players)}
                className={isRegistered ? 'btn-ghost' : 'btn-lime'}
              >
                {registerLoading ? '...' : isRegistered ? 'SE DÉSINSCRIRE' : players.length >= match.max_players ? 'MATCH COMPLET' : "M'INSCRIRE →"}
              </button>
            )}
          </div>
        )}

        {/* TAB: COMPOS */}
        {tab === 'compo' && (
          <div className="animate-fade-in">
            <CompositionsSection
              matchId={id}
              players={players}
              isCreator={isCreator}
            />
          </div>
        )}

        {/* TAB: STATS */}
        {tab === 'stats' && (
          <div className="animate-fade-in">
            <StatsSection matchId={id} players={players} match={match} />
          </div>
        )}

        {/* TAB: NOTES */}
        {tab === 'notes' && (
          <div className="animate-fade-in">
            {match.status === 'completed' && currentUser ? (
              <RatingSection
                matchId={id}
                currentUserId={currentUser.id}
                players={players}
              />
            ) : (
              <div className="card-dark p-6 text-center">
                <Star className="w-8 h-8 mx-auto mb-3 text-[#333]" />
                <p className="font-display text-sm text-[#555]">NOTATION DISPONIBLE</p>
                <p className="text-xs text-[#444] mt-1">après la fin du match</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: WHATSAPP */}
        {tab === 'whatsapp' && (
          <div className="animate-fade-in">
            <WhatsAppSection match={match} players={players} />
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEditModal && match && (
        <EditMatchModal
          match={match}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onUpdated={loadMatch}
        />
      )}
    </div>
  )
}
