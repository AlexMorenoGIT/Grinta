'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Search, Trophy, Zap, Star } from 'lucide-react'
import type { Profile } from '@/types/database'

// ─── Helpers ─────────────────────────────────────────────────────────────────


function getPodiumColor(position: number) {
  if (position === 1) return { color: '#FFD700', glow: 'rgba(255,215,0,0.4)' }
  if (position === 2) return { color: '#C0C0C0', glow: 'rgba(192,192,192,0.3)' }
  if (position === 3) return { color: '#CD7F32', glow: 'rgba(205,127,50,0.35)' }
  return { color: '#555', glow: 'transparent' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassementPage() {
  const router = useRouter()
  const supabase = createClient() as any

  const [players, setPlayers] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')


  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [playersRes, meRes] = await Promise.all([
        supabase.from('profiles').select('*').order('elo', { ascending: false }),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
      ])

      if (playersRes.data) setPlayers(playersRes.data)
      if (meRes.data) setCurrentUser(meRes.data)
      setLoading(false)
    }
    load()
  }, [router, supabase])

  const filteredPlayers = players.filter(p => {
    return !search || `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  })

  // Rang global de l'utilisateur connecté
  const myRank = players.findIndex(p => p.id === currentUser?.id) + 1

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#080808] px-5 pt-12">
        <div className="space-y-3">
          <div className="skeleton h-12 rounded-xl" />
          <div className="skeleton h-8 rounded-lg" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // Podium top 3
  const top3 = players.slice(0, 3)

  return (
    <div className="min-h-dvh bg-[#080808]">
      {/* Header */}
      <div className="sticky top-0 z-40 px-5 pt-12 pb-4"
        style={{ background: 'linear-gradient(to bottom, #080808 80%, transparent)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '#141414', border: '1px solid #1E1E1E' }}
          >
            <ArrowLeft className="w-4 h-4 text-[#888]" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-xl text-white">CLASSEMENT</h1>
            <p className="text-[10px] text-[#555]">{players.length} joueurs classés</p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(170,255,0,0.08)', border: '1px solid rgba(170,255,0,0.15)' }}>
            <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--lime)' }} />
            <span className="font-display text-xs" style={{ color: 'var(--lime)' }}>LIVE</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un joueur..."
            className="input-dark pl-10"
          />
        </div>

      </div>

      <div className="px-5 pb-32 space-y-4">
        {/* Ma position (si présent dans le classement et pas dans le top visible) */}
        {currentUser && myRank > 0 && !search && (
          <div className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(170,255,0,0.05)', border: '1px solid rgba(170,255,0,0.15)' }}>
            <Zap className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--lime)' }} />
            <div className="flex-1">
              <p className="text-xs text-white font-semibold">Ma position</p>
              <p className="text-[10px] text-[#666]">{currentUser.first_name} {currentUser.last_name}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-lg" style={{ color: 'var(--lime)' }}>#{myRank}</p>
              <p className="text-[10px] text-[#555]">{currentUser.elo} ELO</p>
            </div>
          </div>
        )}

        {/* Podium top 3 (visible uniquement sans filtre/recherche) */}
        {!search && top3.length >= 3 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full" style={{ background: 'var(--lime)' }} />
              <h2 className="font-display text-sm text-white">PODIUM</h2>
            </div>
            <div className="flex items-end justify-center gap-3" style={{ height: '160px' }}>
              {/* 2ème */}
              {top3[1] && (() => {
                const podium = getPodiumColor(2)
                return (
                  <div className="flex flex-col items-center gap-2 flex-1" style={{ height: '130px', justifyContent: 'flex-end' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: 'rgba(192,192,192,0.15)', border: `2px solid ${podium.color}`, color: podium.color }}>
                      {top3[1].first_name[0]}{top3[1].last_name[0]}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-white font-semibold leading-tight truncate max-w-20">
                        {top3[1].first_name}
                      </p>
                      <p className="font-display text-xs" style={{ color: 'var(--lime)' }}>{top3[1].elo}</p>
                    </div>
                    <div className="w-full rounded-t-lg flex items-center justify-center"
                      style={{ height: '50px', background: `rgba(192,192,192,0.08)`, border: `1px solid ${podium.color}30`, borderBottom: 'none' }}>
                      <span className="font-display text-xl" style={{ color: podium.color }}>#2</span>
                    </div>
                  </div>
                )
              })()}

              {/* 1er */}
              {top3[0] && (() => {
                const podium = getPodiumColor(1)
                return (
                  <div className="flex flex-col items-center gap-2 flex-1" style={{ height: '160px', justifyContent: 'flex-end' }}>
                    <Star className="w-4 h-4" style={{ color: podium.color }} />
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: 'rgba(255,215,0,0.15)', border: `2px solid ${podium.color}`, color: podium.color, boxShadow: `0 0 20px ${podium.glow}` }}>
                      {top3[0].first_name[0]}{top3[0].last_name[0]}
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-white font-semibold leading-tight truncate max-w-24">
                        {top3[0].first_name}
                      </p>
                      <p className="font-display text-sm" style={{ color: 'var(--lime)' }}>{top3[0].elo}</p>
                    </div>
                    <div className="w-full rounded-t-lg flex items-center justify-center"
                      style={{ height: '70px', background: `rgba(255,215,0,0.08)`, border: `1px solid ${podium.color}30`, borderBottom: 'none' }}>
                      <span className="font-display text-2xl" style={{ color: podium.color, textShadow: `0 0 20px ${podium.glow}` }}>#1</span>
                    </div>
                  </div>
                )
              })()}

              {/* 3ème */}
              {top3[2] && (() => {
                const podium = getPodiumColor(3)
                return (
                  <div className="flex flex-col items-center gap-2 flex-1" style={{ height: '110px', justifyContent: 'flex-end' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: 'rgba(205,127,50,0.15)', border: `2px solid ${podium.color}`, color: podium.color }}>
                      {top3[2].first_name[0]}{top3[2].last_name[0]}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-white font-semibold leading-tight truncate max-w-20">
                        {top3[2].first_name}
                      </p>
                      <p className="font-display text-xs" style={{ color: 'var(--lime)' }}>{top3[2].elo}</p>
                    </div>
                    <div className="w-full rounded-t-lg flex items-center justify-center"
                      style={{ height: '35px', background: `rgba(205,127,50,0.08)`, border: `1px solid ${podium.color}30`, borderBottom: 'none' }}>
                      <span className="font-display text-lg" style={{ color: podium.color }}>#3</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Liste complète */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: 'var(--lime)' }} />
            <h2 className="font-display text-sm text-white">
              {!search ? 'CLASSEMENT GÉNÉRAL' : `RÉSULTATS (${filteredPlayers.length})`}
            </h2>
          </div>

          <div className="space-y-2">
            {filteredPlayers.map((player) => {
              const globalRank = players.findIndex(p => p.id === player.id) + 1
              const isMe = player.id === currentUser?.id
              const podiumData = globalRank <= 3 ? getPodiumColor(globalRank) : null

              return (
                <div
                  key={player.id}
                  className="rounded-xl p-3 flex items-center gap-3 transition-all"
                  style={{
                    background: isMe ? 'rgba(170,255,0,0.05)' : '#111',
                    border: `1px solid ${isMe ? 'rgba(170,255,0,0.2)' : '#1A1A1A'}`,
                  }}
                >
                  {/* Rang */}
                  <div className="w-8 flex-shrink-0 text-center">
                    {podiumData ? (
                      <span className="font-display text-base" style={{ color: podiumData.color }}>
                        #{globalRank}
                      </span>
                    ) : (
                      <span className="font-display text-sm text-[#444]">#{globalRank}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: '#1A1A1A',
                      border: '1.5px solid #2A2A2A',
                      color: '#888',
                      boxShadow: globalRank === 1 ? `0 0 12px ${getPodiumColor(1).glow}` : 'none',
                    }}
                  >
                    {player.first_name[0]}{player.last_name[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {player.first_name} {player.last_name}
                      {isMe && <span className="ml-1 text-[10px]" style={{ color: 'var(--lime)' }}>• MOI</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {player.matches_played > 0 && (
                        <span className="text-[10px] text-[#555]">
                          {player.matches_played} match{player.matches_played > 1 ? 's' : ''}
                          {' · '}
                          {player.wins}V
                        </span>
                      )}
                      {player.mvp_count > 0 && (
                        <span className="text-[10px] text-[#FFB800]">👑 {player.mvp_count}</span>
                      )}
                    </div>
                  </div>

                  {/* ELO */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-display text-lg" style={{ color: 'var(--lime)' }}>{player.elo}</p>
                    {(player.elo_gain ?? 0) !== 0 && (
                      <p className="text-[10px] font-display" style={{ color: (player.elo_gain ?? 0) > 0 ? '#AAFF00' : '#F87171' }}>
                        {(player.elo_gain ?? 0) > 0 ? '+' : ''}{player.elo_gain}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {filteredPlayers.length === 0 && (
              <div className="card-dark p-8 text-center">
                <p className="font-display text-sm text-[#444]">AUCUN JOUEUR TROUVÉ</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
