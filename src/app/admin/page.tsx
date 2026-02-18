'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Search, Trash2, Edit3, Users, Zap, Calendar,
  MapPin, ChevronUp, ChevronDown, Shield
} from 'lucide-react'
import { EditMatchModal } from '@/components/grinta/EditMatchModal'
import type { Profile, Match, MatchPlayer } from '@/types/database'

type PlayerRow = Profile & { match_count?: number }
type MatchRow = Match & { match_players: MatchPlayer[] }

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient() as any

  const [tab, setTab] = useState<'players' | 'matches'>('players')
  const [loading, setLoading] = useState(true)

  // Players
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerSort, setPlayerSort] = useState<{ col: keyof PlayerRow; dir: 'asc' | 'desc' }>({ col: 'elo', dir: 'desc' })

  // Matches
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [matchSearch, setMatchSearch] = useState('')
  const [editMatch, setEditMatch] = useState<Match | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [playersRes, matchesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('elo', { ascending: false }),
      supabase.from('matches').select('*, match_players(*)').order('date', { ascending: false }),
    ])
    if (playersRes.data) setPlayers(playersRes.data)
    if (matchesRes.data) setMatches(matchesRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // Verify admin access client-side as well
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/home'); return }
      loadData()
    }
    check()
  }, [loadData, router, supabase])

  const deleteMatch = async (id: string) => {
    setDeleting(id)
    const { data, error } = await supabase
      .from('matches')
      .delete()
      .eq('id', id)
      .select()
    if (error) {
      toast.error('Erreur : ' + error.message)
    } else if (!data || data.length === 0) {
      toast.error('Suppression bloquée par RLS — ajoute la politique admin dans Supabase')
    } else {
      toast.success('Match supprimé')
      await loadData()
    }
    setDeleting(null)
    setConfirmDelete(null)
  }

  // Filtered + sorted players
  const filteredPlayers = players
    .filter(p =>
      !playerSearch ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(playerSearch.toLowerCase())
    )
    .sort((a, b) => {
      const va = (a[playerSort.col] as any) ?? 0
      const vb = (b[playerSort.col] as any) ?? 0
      return playerSort.dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })

  const toggleSort = (col: keyof PlayerRow) => {
    setPlayerSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'desc' }
    )
  }

  const SortIcon = ({ col }: { col: keyof PlayerRow }) => {
    if (playerSort.col !== col) return null
    return playerSort.dir === 'asc'
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />
  }

  // Filtered matches
  const filteredMatches = matches.filter(m =>
    !matchSearch ||
    m.title.toLowerCase().includes(matchSearch.toLowerCase()) ||
    m.lieu.toLowerCase().includes(matchSearch.toLowerCase())
  )

  const statusLabel: Record<string, string> = {
    upcoming: 'À VENIR',
    ongoing: 'EN COURS',
    completed: 'TERMINÉ',
    cancelled: 'ANNULÉ',
  }

  const statusColor: Record<string, string> = {
    upcoming: '#AAFF00',
    ongoing: '#FFB800',
    completed: '#555',
    cancelled: '#EF4444',
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#080808] px-5 pt-12">
        <div className="space-y-4">
          <div className="skeleton h-12 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    )
  }

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
          <div className="flex-1">
            <h1 className="font-display text-xl text-white">ADMIN</h1>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(170,255,0,0.1)', border: '1px solid rgba(170,255,0,0.2)' }}>
            <Shield className="w-3.5 h-3.5" style={{ color: 'var(--lime)' }} />
            <span className="font-display text-xs" style={{ color: 'var(--lime)' }}>ADMIN</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#111' }}>
          {([
            { key: 'players', label: `Joueurs (${players.length})`, icon: Users },
            { key: 'matches', label: `Matchs (${matches.length})`, icon: Calendar },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-lg text-xs font-display font-bold tracking-wider uppercase transition-all"
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

      <div className="px-5 pb-12 space-y-4">
        {/* ─── TAB JOUEURS ─── */}
        {tab === 'players' && (
          <div className="space-y-4 animate-fade-in">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
              <input
                type="text"
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                placeholder="Rechercher un joueur..."
                className="input-dark pl-10"
              />
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Joueurs', value: players.length },
                { label: 'ELO moy.', value: players.length ? Math.round(players.reduce((s, p) => s + p.elo, 0) / players.length) : 0 },
                { label: 'Admins', value: players.filter(p => p.is_admin).length },
              ].map(s => (
                <div key={s.label} className="card-dark p-3 text-center">
                  <p className="font-display text-2xl text-white">{s.value}</p>
                  <p className="text-xs text-[#555]">{s.label.toUpperCase()}</p>
                </div>
              ))}
            </div>

            {/* Table header */}
            <div className="card-dark overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-[#1A1A1A] text-[10px] text-[#444] font-display font-bold tracking-wider">
                <div className="col-span-4">JOUEUR</div>
                <button className="col-span-2 text-right" onClick={() => toggleSort('elo')}>
                  ELO<SortIcon col="elo" />
                </button>
                <button className="col-span-2 text-right" onClick={() => toggleSort('matches_played')}>
                  MJ<SortIcon col="matches_played" />
                </button>
                <button className="col-span-2 text-right" onClick={() => toggleSort('wins')}>
                  V<SortIcon col="wins" />
                </button>
                <button className="col-span-2 text-right" onClick={() => toggleSort('avg_rating')}>
                  NOTE<SortIcon col="avg_rating" />
                </button>
              </div>

              {/* Rows */}
              <div className="divide-y divide-[#111]">
                {filteredPlayers.map(player => (
                  <div key={player.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-[#111] transition-colors">
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                        style={{
                          background: player.is_admin ? 'rgba(170,255,0,0.15)' : '#1A1A1A',
                          color: player.is_admin ? 'var(--lime)' : '#666',
                          border: `1px solid ${player.is_admin ? 'rgba(170,255,0,0.3)' : '#2A2A2A'}`,
                        }}>
                        {player.first_name.charAt(0)}{player.last_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-white font-semibold truncate">
                          {player.first_name} {player.last_name}
                          {player.is_admin && (
                            <span className="ml-1 text-[9px]" style={{ color: 'var(--lime)' }}>★</span>
                          )}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold" style={{ color: '#AAFF00' }}>T{player.technique_score ?? '—'}</span>
                          <span className="text-[9px] font-bold" style={{ color: '#3B82F6' }}>P{player.physique_score ?? '—'}</span>
                          <span className="text-[9px] font-bold" style={{ color: '#A855F7' }}>Ta{player.tactique_score ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="font-display text-sm" style={{ color: 'var(--lime)' }}>{player.elo}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-xs text-white">{player.matches_played}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-xs text-white">{player.wins}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-xs text-white">
                        {player.avg_rating ? Number(player.avg_rating).toFixed(1) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB MATCHS ─── */}
        {tab === 'matches' && (
          <div className="space-y-4 animate-fade-in">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
              <input
                type="text"
                value={matchSearch}
                onChange={e => setMatchSearch(e.target.value)}
                placeholder="Rechercher un match..."
                className="input-dark pl-10"
              />
            </div>

            {/* Match list */}
            <div className="space-y-3">
              {filteredMatches.map(match => (
                <div key={match.id} className="card-dark p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-display text-sm text-white truncate">{match.title}</h3>
                        <span className="text-[10px] font-display font-bold px-1.5 py-0.5 rounded"
                          style={{
                            color: statusColor[match.status] || '#555',
                            background: `${statusColor[match.status]}15` || '#1A1A1A',
                            border: `1px solid ${statusColor[match.status]}30` || '#1A1A1A',
                          }}>
                          {statusLabel[match.status] || match.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#555] flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(match.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{match.lieu}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {match.match_players.length}/{match.max_players}
                        </span>
                        {match.price_total && (
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {match.price_total} €
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditMatch(match)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider transition-all"
                      style={{
                        background: 'rgba(59,130,246,0.1)',
                        border: '1px solid rgba(59,130,246,0.25)',
                        color: '#3B82F6',
                      }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      ÉDITER
                    </button>

                    {confirmDelete === match.id ? (
                      <div className="flex gap-2 flex-1">
                        <button
                          onClick={() => deleteMatch(match.id)}
                          disabled={deleting === match.id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider transition-all"
                          style={{
                            background: 'rgba(239,68,68,0.15)',
                            border: '1px solid rgba(239,68,68,0.4)',
                            color: '#EF4444',
                          }}
                        >
                          {deleting === match.id ? '...' : '✓ CONFIRMER'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider transition-all"
                          style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#888' }}
                        >
                          ANNULER
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(match.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider transition-all"
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          color: '#EF4444',
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        SUPPRIMER
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredMatches.length === 0 && (
                <div className="card-dark p-8 text-center">
                  <p className="font-display text-sm text-[#444]">AUCUN MATCH</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editMatch && (
        <EditMatchModal
          match={editMatch}
          open={!!editMatch}
          onClose={() => setEditMatch(null)}
          onUpdated={() => { loadData(); setEditMatch(null) }}
        />
      )}
    </div>
  )
}
