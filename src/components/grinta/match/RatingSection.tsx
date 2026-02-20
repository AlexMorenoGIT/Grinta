'use client'

import { useState, useEffect } from 'react'
import { Check, Crown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { MatchPlayer, Profile, Rating, MvpVote } from '@/types/database'

type PlayerWithProfile = MatchPlayer & { profiles: Profile }

export function RatingSection({ matchId, currentUserId, players }: {
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
