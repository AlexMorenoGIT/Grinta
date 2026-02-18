'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, MapPin, Calendar, Clock, Users, Trophy,
  Star, ChevronRight, Copy, Check, Shuffle, Zap,
  Crown, Shield, Swords
} from 'lucide-react'
import { ELOBadge } from '@/components/grinta/ELOBadge'
import type { Profile, Match, MatchPlayer, Composition, Rating, MvpVote } from '@/types/database'
import Link from 'next/link'

type PlayerWithProfile = MatchPlayer & { profiles: Profile }

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ─────────────────────────────────────────────
// SECTION WHATSAPP TEMPLATES
// ─────────────────────────────────────────────
function WhatsAppSection({ match, players }: {
  match: Match
  players: PlayerWithProfile[]
}) {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success('Copié !')
    setTimeout(() => setCopied(null), 2000)
  }

  const date = formatDate(match.date)
  const time = match.heure.substring(0, 5)
  const playerList = players.map((p, i) => `${i + 1}. ${p.profiles.first_name} ${p.profiles.last_name}`).join('\n')

  const templates = [
    {
      key: 'invite',
      label: '📣 Invitation',
      subtitle: 'Partager l\'info du match',
      text: `⚡ *GRINTA — MATCH ORGANISÉ*\n\n📅 ${date}\n⏰ ${time}\n📍 ${match.lieu}${match.google_maps_url ? `\n🗺️ ${match.google_maps_url}` : ''}\n\nNombre de places : ${match.max_players} joueurs\n\nRéponds ici pour t'inscrire ! 🔥`,
    },
    {
      key: 'rappel2',
      label: '⏰ Rappel J-2',
      subtitle: '2 jours avant le match',
      text: `⏰ *RAPPEL — MATCH DANS 2 JOURS*\n\n📅 ${date} à ${time}\n📍 ${match.lieu}\n\n👥 *Inscrits (${players.length}/${match.max_players}) :*\n${playerList}\n\nIl reste ${match.max_players - players.length} place(s). Partagez autour de vous ! 💪`,
    },
    {
      key: 'rappel1',
      label: '🔔 Rappel J-1',
      subtitle: 'La veille du match',
      text: `🔔 *C'EST DEMAIN — TOUT LE MONDE EST PRÊT ?*\n\n📅 ${date} à ${time}\n📍 ${match.lieu}\n\n👥 *Équipe complète (${players.length} joueurs) :*\n${playerList}\n\n✅ Confirme ta présence en répondant OUI !\n❌ Si tu ne peux plus venir, préviens MAINTENANT.`,
    },
    {
      key: 'final',
      label: '🚨 Final Call H-10',
      subtitle: '10h avant le match',
      text: `🚨 *FINAL CALL — MATCH DANS 10H !*\n\n📅 Aujourd'hui à ${time}\n📍 ${match.lieu}\n\nSoyez là 10 min avant l'heure !\n👟 Crampons / baskets propres\n💧 Eau + protège-tibias\n\nLet's go ! ⚡`,
    },
    {
      key: 'postmatch',
      label: '🏆 Post-Match',
      subtitle: 'Votes MVP + notes',
      text: `🏆 *MATCH TERMINÉ — VOTE MVP & NOTES*\n\nMerci à tous pour ce match ! 🔥\n\nMaintenant c'est le moment de :\n⭐ *Notertes coéquipiers et adversaires* (anonyme) sur l'app\n👑 *Voter pour le MVP* du match\n\nOuvre l'appli Grinta et sélectionne ce match pour noter et voter !\n\n🔗 Vos notes influencent l'ELO de chacun — soyez honnêtes.`,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-4 rounded-full" style={{ background: 'var(--lime)' }} />
        <h3 className="font-display text-base text-white">MESSAGES WHATSAPP</h3>
      </div>
      <p className="text-xs text-[#555] mb-3">Appuie pour copier, colle dans WhatsApp.</p>

      {templates.map((tmpl) => (
        <button
          key={tmpl.key}
          onClick={() => copy(tmpl.key, tmpl.text)}
          className="w-full text-left card-dark p-4 flex items-center gap-3 group transition-all"
        >
          <div className="flex-1">
            <p className="font-display text-sm text-white">{tmpl.label}</p>
            <p className="text-xs text-[#555]">{tmpl.subtitle}</p>
          </div>
          <div className="flex-shrink-0">
            {copied === tmpl.key
              ? <Check className="w-4 h-4" style={{ color: 'var(--lime)' }} />
              : <Copy className="w-4 h-4 text-[#444] group-hover:text-[#666] transition-colors" />
            }
          </div>
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// SECTION COMPOSITIONS
// ─────────────────────────────────────────────
function CompositionsSection({ matchId, players, isCreator }: {
  matchId: string
  players: PlayerWithProfile[]
  isCreator: boolean
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [compositions, setCompositions] = useState<Composition[]>([])
  const [loading, setLoading] = useState(false)
  const [activeVariant, setActiveVariant] = useState(1)

  const loadCompositions = useCallback(async () => {
    const { data } = await supabase
      .from('compositions')
      .select('*')
      .eq('match_id', matchId)
      .order('variant')
    if (data) setCompositions(data as Composition[])
  }, [matchId, supabase])

  useEffect(() => { loadCompositions() }, [loadCompositions])

  const generate = async () => {
    if (players.length < 4) {
      toast.error('Il faut au moins 4 joueurs pour générer des compositions')
      return
    }
    setLoading(true)
    const { error } = await (supabase as any).rpc('generate_compositions', { p_match_id: matchId })
    if (error) toast.error('Erreur lors de la génération')
    else {
      toast.success('3 compositions générées !')
      await loadCompositions()
    }
    setLoading(false)
  }

  const applyVariant = async (variant: number) => {
    const comp = compositions.find(c => c.variant === variant)
    if (!comp) return

    // Apply composition to match_players
    const updates = [
      ...comp.team_a_players.map(id => ({ match_id: matchId, player_id: id, team: 'A' as const })),
      ...comp.team_b_players.map(id => ({ match_id: matchId, player_id: id, team: 'B' as const })),
    ]

    for (const u of updates) {
      await supabase.from('match_players').update({ team: u.team }).eq('match_id', matchId).eq('player_id', u.player_id)
    }

    // Mark as applied
    await supabase.from('compositions').update({ is_applied: false }).eq('match_id', matchId)
    await supabase.from('compositions').update({ is_applied: true }).eq('match_id', matchId).eq('variant', variant)

    toast.success(`Variante ${variant} appliquée !`)
    await loadCompositions()
  }

  const getPlayerById = (id: string) => players.find(p => p.player_id === id)

  const currentComp = compositions.find(c => c.variant === activeVariant)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ background: 'var(--lime)' }} />
          <h3 className="font-display text-base text-white">COMPOSITIONS ({players.length} joueurs)</h3>
        </div>
        {isCreator && (
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider transition-all"
            style={{
              background: loading ? '#1A1A1A' : 'rgba(170,255,0,0.1)',
              border: '1px solid rgba(170,255,0,0.25)',
              color: loading ? '#555' : 'var(--lime)',
            }}
          >
            <Shuffle className="w-3.5 h-3.5" />
            {loading ? '...' : compositions.length > 0 ? 'REGÉNÉRER' : 'GÉNÉRER'}
          </button>
        )}
      </div>

      {compositions.length === 0 ? (
        <div className="card-dark p-6 text-center">
          <Swords className="w-8 h-8 mx-auto mb-3 text-[#333]" />
          <p className="font-display text-sm text-[#555]">AUCUNE COMPOSITION</p>
          <p className="text-xs text-[#444] mt-1">
            {isCreator ? 'Génère les compositions quand tous les joueurs sont inscrits.' : 'Le créateur du match génèrera les compositions.'}
          </p>
        </div>
      ) : (
        <>
          {/* Variant selector */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#111' }}>
            {compositions.map(c => (
              <button
                key={c.variant}
                onClick={() => setActiveVariant(c.variant)}
                className="flex-1 py-2 rounded-lg text-xs font-display font-bold tracking-wider uppercase transition-all"
                style={{
                  background: activeVariant === c.variant ? '#1E1E1E' : 'transparent',
                  color: activeVariant === c.variant ? 'var(--lime)' : '#555',
                  border: activeVariant === c.variant ? '1px solid #2A2A2A' : '1px solid transparent',
                }}
              >
                VAR. {c.variant}{c.is_applied ? ' ✓' : ''}
              </button>
            ))}
          </div>

          {currentComp && (
            <div className="space-y-3 animate-fade-in">
              {/* Balance score */}
              <div className="card-dark p-3 text-center">
                <p className="text-xs text-[#555] mb-1 font-display-light tracking-wider">ÉCART ELO</p>
                <p className="font-display text-2xl"
                  style={{ color: (currentComp.balance_score || 0) < 100 ? 'var(--lime)' : (currentComp.balance_score || 0) < 200 ? '#FFB800' : '#EF4444' }}>
                  {currentComp.balance_score ? Math.round(currentComp.balance_score) : '—'}
                </p>
                <p className="text-xs text-[#555] mt-0.5">
                  {(currentComp.balance_score || 0) < 100 ? 'Très équilibré' : (currentComp.balance_score || 0) < 200 ? 'Correct' : 'Déséquilibré'}
                </p>
              </div>

              {/* Teams */}
              <div className="grid grid-cols-2 gap-3">
                {/* Team A */}
                <div className="card-dark p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="team-a-badge">ÉQUIPE A</span>
                    <span className="text-xs text-[#555] ml-auto">{Math.round(currentComp.elo_team_a || 0)}</span>
                  </div>
                  <div className="space-y-2">
                    {currentComp.team_a_players.map(pid => {
                      const p = getPlayerById(pid)
                      return p ? (
                        <div key={pid} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                            style={{ background: '#1A3A5C', color: '#60A5FA' }}>
                            {p.profiles.first_name.charAt(0)}{p.profiles.last_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate font-medium">{p.profiles.first_name}</p>
                          </div>
                          <ELOBadge elo={p.profiles.elo} size="sm" />
                        </div>
                      ) : null
                    })}
                  </div>
                </div>

                {/* Team B */}
                <div className="card-dark p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-red-400" />
                    <span className="team-b-badge">ÉQUIPE B</span>
                    <span className="text-xs text-[#555] ml-auto">{Math.round(currentComp.elo_team_b || 0)}</span>
                  </div>
                  <div className="space-y-2">
                    {currentComp.team_b_players.map(pid => {
                      const p = getPlayerById(pid)
                      return p ? (
                        <div key={pid} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                            style={{ background: '#3A1A1A', color: '#F87171' }}>
                            {p.profiles.first_name.charAt(0)}{p.profiles.last_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate font-medium">{p.profiles.first_name}</p>
                          </div>
                          <ELOBadge elo={p.profiles.elo} size="sm" />
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              </div>

              {/* Apply button */}
              {isCreator && (
                <button
                  onClick={() => applyVariant(activeVariant)}
                  className="btn-ghost text-sm"
                  style={{
                    color: currentComp.is_applied ? 'var(--lime)' : undefined,
                    borderColor: currentComp.is_applied ? 'rgba(170,255,0,0.3)' : undefined,
                  }}
                >
                  {currentComp.is_applied ? '✓ COMPOSITION APPLIQUÉE' : 'APPLIQUER CETTE COMPOSITION'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// SECTION NOTATION POST-MATCH
// ─────────────────────────────────────────────
function RatingSection({ matchId, currentUserId, players }: {
  matchId: string
  currentUserId: string
  players: PlayerWithProfile[]
}) {
  const supabase = createClient() as any
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [myVote, setMyVote] = useState<string | null>(null)
  const [existingRatings, setExistingRatings] = useState<Rating[]>([])
  const [existingVote, setExistingVote] = useState<MvpVote | null>(null)
  const [submittedRatings, setSubmittedRatings] = useState(false)
  const [submittedVote, setSubmittedVote] = useState(false)
  const [loadingRatings, setLoadingRatings] = useState(false)
  const [loadingVote, setLoadingVote] = useState(false)
  const [mvpVotes, setMvpVotes] = useState<MvpVote[]>([])

  const otherPlayers = players.filter(p => p.player_id !== currentUserId)
  const amIPlaying = players.some(p => p.player_id === currentUserId)

  useEffect(() => {
    const load = async () => {
      const [ratingsRes, voteRes, allVotesRes] = await Promise.all([
        supabase.from('ratings').select('*').eq('match_id', matchId).eq('rater_id', currentUserId),
        supabase.from('mvp_votes').select('*').eq('match_id', matchId).eq('voter_id', currentUserId).single(),
        supabase.from('mvp_votes').select('*').eq('match_id', matchId),
      ])
      if (ratingsRes.data?.length) {
        setExistingRatings(ratingsRes.data)
        setSubmittedRatings(true)
      }
      if (voteRes.data) {
        setExistingVote(voteRes.data)
        setMyVote(voteRes.data.voted_player_id)
        setSubmittedVote(true)
      }
      if (allVotesRes.data) setMvpVotes(allVotesRes.data)
    }
    load()
  }, [matchId, currentUserId, supabase])

  const submitRatings = async () => {
    if (Object.keys(ratings).length < otherPlayers.length) {
      toast.error(`Note tous les joueurs (${Object.keys(ratings).length}/${otherPlayers.length} notés)`)
      return
    }
    setLoadingRatings(true)

    const inserts = Object.entries(ratings).map(([playerId, score]) => ({
      match_id: matchId,
      rated_player_id: playerId,
      rater_id: currentUserId,
      score,
    }))

    const { error } = await supabase.from('ratings').upsert(inserts, { onConflict: 'match_id,rated_player_id,rater_id' })
    if (error) toast.error('Erreur lors de la notation')
    else {
      toast.success('Notes envoyées anonymement !')
      setSubmittedRatings(true)
    }
    setLoadingRatings(false)
  }

  const submitVote = async () => {
    if (!myVote) return
    setLoadingVote(true)

    const { error } = await supabase.from('mvp_votes').upsert({
      match_id: matchId,
      voted_player_id: myVote,
      voter_id: currentUserId,
    }, { onConflict: 'match_id,voter_id' })

    if (error) toast.error('Erreur lors du vote')
    else {
      toast.success('Vote MVP enregistré !')
      setSubmittedVote(true)
      const { data } = await supabase.from('mvp_votes').select('*').eq('match_id', matchId)
      if (data) setMvpVotes(data)
    }
    setLoadingVote(false)
  }

  // Count votes par joueur
  const voteCount: Record<string, number> = {}
  mvpVotes.forEach(v => {
    voteCount[v.voted_player_id] = (voteCount[v.voted_player_id] || 0) + 1
  })
  const maxVotes = Math.max(...Object.values(voteCount), 0)

  if (!amIPlaying) {
    return (
      <div className="card-dark p-4 text-center">
        <p className="text-sm text-[#555]">Tu n'étais pas dans ce match.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* NOTATION ANONYME */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-4 rounded-full" style={{ background: '#3B82F6' }} />
          <h3 className="font-display text-base text-white">NOTES JOUEURS</h3>
        </div>
        <p className="text-xs text-[#555] mb-3">
          🔒 Tes notes sont 100% anonymes. Note honnêtement — ça impacte l'ELO de chacun.
        </p>

        {submittedRatings ? (
          <div className="card-dark p-4 text-center">
            <Check className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--lime)' }} />
            <p className="font-display text-sm" style={{ color: 'var(--lime)' }}>NOTES ENVOYÉES</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {existingRatings.map(r => {
                const player = players.find(p => p.player_id === r.rated_player_id)
                return player ? (
                  <div key={r.id} className="flex items-center gap-2 text-xs text-[#888]">
                    <span className="flex-1 truncate">{player.profiles.first_name}</span>
                    <span className="font-display font-bold text-white">{r.score}/10</span>
                  </div>
                ) : null
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {otherPlayers.map(player => (
              <div key={player.player_id} className="card-dark p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: '#1A1A1A', color: '#888', border: '1px solid #2A2A2A' }}>
                    {player.profiles.first_name.charAt(0)}{player.profiles.last_name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-white">
                      {player.profiles.first_name} {player.profiles.last_name}
                    </p>
                    <ELOBadge elo={player.profiles.elo} size="sm" />
                  </div>
                  <div className="font-display text-2xl font-bold"
                    style={{ color: ratings[player.player_id] ? 'var(--lime)' : '#333' }}>
                    {ratings[player.player_id] || '?'}
                  </div>
                </div>

                <input
                  type="range"
                  min={1} max={10} step={1}
                  value={ratings[player.player_id] || 5}
                  onChange={(e) => setRatings(prev => ({ ...prev, [player.player_id]: parseInt(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: ratings[player.player_id]
                      ? `linear-gradient(to right, var(--lime) 0%, var(--lime) ${(ratings[player.player_id] - 1) / 9 * 100}%, #1A1A1A ${(ratings[player.player_id] - 1) / 9 * 100}%, #1A1A1A 100%)`
                      : '#1A1A1A'
                  }}
                />
                <div className="flex justify-between text-[10px] text-[#444] mt-1">
                  <span>Mauvais</span><span>Moyen</span><span>Excellent</span>
                </div>
              </div>
            ))}

            <button
              onClick={submitRatings}
              disabled={loadingRatings || Object.keys(ratings).length < otherPlayers.length}
              className="btn-lime"
            >
              {loadingRatings ? 'ENVOI...' : `ENVOYER MES NOTES (${Object.keys(ratings).length}/${otherPlayers.length})`}
            </button>
          </div>
        )}
      </div>

      {/* VOTE MVP */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-4 rounded-full" style={{ background: 'var(--gold)' }} />
          <h3 className="font-display text-base text-white">VOTE MVP</h3>
          <span className="text-xs text-[#555]">— public</span>
        </div>
        <p className="text-xs text-[#555] mb-3">
          Le MVP reçoit +10 pts ELO bonus. Le vote est visible de tous.
        </p>

        <div className="space-y-2">
          {players.filter(p => p.player_id !== currentUserId).map(player => {
            const votes = voteCount[player.player_id] || 0
            const isLeader = votes === maxVotes && votes > 0
            const isSelected = myVote === player.player_id

            return (
              <button
                key={player.player_id}
                onClick={() => !submittedVote && setMyVote(player.player_id)}
                disabled={submittedVote}
                className="w-full text-left card-dark p-3 flex items-center gap-3 transition-all"
                style={{
                  borderColor: isSelected ? 'rgba(255,184,0,0.4)' : isLeader ? 'rgba(255,184,0,0.2)' : undefined,
                  background: isSelected ? 'rgba(255,184,0,0.08)' : undefined,
                }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: '#1A1A1A', color: '#888', border: '1px solid #2A2A2A' }}>
                  {player.profiles.first_name.charAt(0)}{player.profiles.last_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-semibold truncate">
                    {player.profiles.first_name} {player.profiles.last_name}
                  </p>
                  <ELOBadge elo={player.profiles.elo} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  {isLeader && <Crown className="w-4 h-4" style={{ color: 'var(--gold)' }} />}
                  {votes > 0 && (
                    <span className="font-display text-sm"
                      style={{ color: isLeader ? 'var(--gold)' : '#555' }}>
                      {votes} vote{votes > 1 ? 's' : ''}
                    </span>
                  )}
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0"
                    style={{
                      borderColor: isSelected ? 'var(--gold)' : '#333',
                      background: isSelected ? 'var(--gold)' : 'transparent',
                    }}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {!submittedVote && myVote && (
          <button
            onClick={submitVote}
            disabled={loadingVote}
            className="btn-lime mt-3"
            style={{ background: 'var(--gold)', color: '#000' }}
          >
            {loadingVote ? 'ENVOI...' : '👑 VOTER POUR CE MVP'}
          </button>
        )}
        {submittedVote && (
          <div className="card-dark p-3 text-center mt-3">
            <p className="font-display text-sm" style={{ color: 'var(--gold)' }}>✓ VOTE MVP ENREGISTRÉ</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────
export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient() as any

  const [match, setMatch] = useState<Match | null>(null)
  const [players, setPlayers] = useState<PlayerWithProfile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [tab, setTab] = useState<'info' | 'compo' | 'notes' | 'whatsapp'>('info')
  const [showScoreForm, setShowScoreForm] = useState(false)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')

  const loadMatch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileRes, matchRes, playersRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('matches').select('*').eq('id', id).single(),
      supabase.from('match_players').select('*, profiles(*)').eq('match_id', id).order('joined_at'),
    ])

    if (profileRes.data) setCurrentUser(profileRes.data)
    if (matchRes.data) setMatch(matchRes.data)
    if (playersRes.data) {
      setPlayers(playersRes.data as PlayerWithProfile[])
      setIsRegistered((playersRes.data as PlayerWithProfile[]).some((p: PlayerWithProfile) => p.player_id === user.id))
    }
    setLoading(false)
  }, [id, supabase])

  useEffect(() => { loadMatch() }, [loadMatch])

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
    await loadMatch()
  }

  const isCreator = match?.created_by === currentUser?.id

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
            onClick={() => router.back()}
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
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: '#111' }}>
          {([
            { key: 'info', label: 'Infos' },
            { key: 'compo', label: 'Compos' },
            { key: 'notes', label: 'Notes' },
            { key: 'whatsapp', label: '📱 WA' },
          ] as const).map(t => (
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
              {match.notes && (
                <div className="pt-3 border-t border-[#1A1A1A]">
                  <p className="text-xs text-[#888] leading-relaxed">{match.notes}</p>
                </div>
              )}
            </div>

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
                  <div key={player.id} className={`card-dark p-3 flex items-center gap-3 animate-slide-up delay-${Math.min(i + 1, 6)}`}>
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
                      <ELOBadge elo={player.profiles.elo} size="sm" />
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
                  </div>
                ))}
              </div>
            </div>

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
    </div>
  )
}
