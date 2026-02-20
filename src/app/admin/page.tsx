'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { reverseMatchElo } from '@/lib/elo'
import {
  ArrowLeft, Search, Trash2, Edit3, Users, Zap, Calendar,
  MapPin, ChevronUp, ChevronDown, Shield, RotateCcw, X
} from 'lucide-react'
import { EditMatchModal } from '@/components/grinta/EditMatchModal'
import type { Profile, Match, MatchPlayer } from '@/types/database'

type PlayerRow = Profile & { match_count?: number }
type MatchRow = Match & { match_players: MatchPlayer[] }

// ─── Questions V2 (pour affichage admin) ────────────────────────────────────
const V2_QUESTIONS = [
  {
    id: 'q1', label: 'Passé sportif',
    options: ['Jamais de club', 'Club poussin/benjamin', 'Club Senior (District)', 'Régional', 'National ou plus'],
  },
  {
    id: 'q2', label: 'Cardio (60 min)',
    options: ['Cuit après 15 min', 'Gère mais finit dans le dur', 'Répète les courses', 'Enchaîne 2 matchs'],
  },
  {
    id: 'q3', label: 'Technique de balle',
    options: ['Contrôles approximatifs', 'Propres à l\'arrêt', 'Contrôle en mouvement', 'Pied-main maîtrisé'],
  },
  {
    id: 'q4', label: 'Pied faible',
    options: ['Sert à monter dans le bus', 'Passe courte sans pression', 'Centre/tir possible', 'Ambidextre'],
  },
  {
    id: 'q5', label: 'Vista (vision)',
    options: ['Regarde ses pieds', 'Coéquipier le plus proche', 'Passe qui casse les lignes', 'Dicte le jeu'],
  },
  {
    id: 'q6', label: 'Impact physique',
    options: ['Évite les contacts', 'Subit les costauds', 'Solide sur ses appuis', 'Gagne 90% des duels'],
  },
  {
    id: 'q7', label: 'Réaction sous pression',
    options: ['Panique, dégage', 'S\'appuie sur le GK', 'Trouve une sortie propre', 'Élimine son vis-à-vis'],
  },
  {
    id: 'q8', label: 'Repli défensif',
    options: ['Reste devant', 'Revient si proche', 'Revient toujours', 'Premier à presser'],
  },
  {
    id: 'q9', label: 'Finition',
    options: ['Tire fort et espère', 'Cadre la plupart', 'Choisit son côté', 'Sang-froid total'],
  },
  {
    id: 'q10', label: 'Intelligence tactique',
    options: ['Court partout', 'Reste à son poste', 'Compense les trous', 'Dirige et gère transitions'],
  },
]

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E']
const OPTION_COLORS = ['#9CA3AF', '#60A5FA', '#AAFF00', '#FFB800', '#FF4444']


function PlayerDetailModal({ player, onClose }: { player: PlayerRow; onClose: () => void }) {
  const answers = player.v2_answers as Record<string, number> | null
  const hasCompletedV2 = player.has_completed_v2_onboarding

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-y-auto"
        style={{ background: '#0E0E0E', border: '1px solid #1E1E1E', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[#1A1A1A]"
          style={{ background: '#0E0E0E' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                background: player.is_admin ? 'rgba(170,255,0,0.15)' : '#1A1A1A',
                color: player.is_admin ? 'var(--lime)' : '#888',
                border: `1px solid ${player.is_admin ? 'rgba(170,255,0,0.3)' : '#2A2A2A'}`,
              }}>
              {player.first_name[0]}{player.last_name[0]}
            </div>
            <div>
              <p className="font-display text-base text-white">
                {player.first_name} {player.last_name}
              </p>
              <span className="font-display text-sm" style={{ color: 'var(--lime)' }}>{player.elo} ELO</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
            <X className="w-4 h-4 text-[#666]" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ELO breakdown */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'ELO BASE', value: player.elo_base ?? player.elo, color: 'var(--lime)' },
              { label: 'GAIN MATCHS', value: `${(player.elo_gain ?? 0) >= 0 ? '+' : ''}${player.elo_gain ?? 0}`, color: (player.elo_gain ?? 0) >= 0 ? '#AAFF00' : '#F87171' },
              { label: 'TOTAL', value: player.elo, color: 'var(--lime)' },
            ].map(s => (
              <div key={s.label} className="card-dark p-3 text-center">
                <p className="font-display text-lg" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] text-[#555] font-display tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'MJ', value: player.matches_played },
              { label: 'V', value: player.wins },
              { label: 'D', value: player.losses },
              { label: 'NOTE', value: player.avg_rating ? Number(player.avg_rating).toFixed(1) : '—' },
            ].map(s => (
              <div key={s.label} className="card-dark p-2 text-center">
                <p className="font-display text-base text-white">{s.value}</p>
                <p className="text-[9px] text-[#555]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Questionnaire V2 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full" style={{ background: 'var(--lime)' }} />
              <h3 className="font-display text-sm text-white">QUESTIONNAIRE V2</h3>
              <span className="text-[10px] ml-auto font-display"
                style={{ color: answers ? 'var(--lime)' : hasCompletedV2 ? '#FFB800' : '#555' }}>
                {answers ? 'COMPLÉTÉ' : hasCompletedV2 ? 'DONNÉES MANQUANTES' : 'NON COMPLÉTÉ'}
              </span>
            </div>

            {answers ? (
              <div className="space-y-2">
                {V2_QUESTIONS.map((q, i) => {
                  const scoreVal = answers[q.id] // 1-4
                  const optIdx = scoreVal ? scoreVal - 1 : -1
                  const color = optIdx >= 0 ? OPTION_COLORS[optIdx] : '#444'
                  const optLabel = optIdx >= 0 ? OPTION_LABELS[optIdx] : '?'
                  const optText = optIdx >= 0 ? q.options[optIdx] : 'Non répondu'
                  return (
                    <div key={q.id} className="rounded-xl p-3 flex items-start gap-3"
                      style={{ background: '#111', border: `1px solid ${color}20` }}>
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                        <span className="font-display text-xs" style={{ color }}>{optLabel}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-[#555] font-display tracking-wider mb-0.5">
                          {i + 1}. {q.label.toUpperCase()}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: optIdx >= 0 ? '#DDD' : '#444' }}>
                          {optText}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : hasCompletedV2 ? (
              <div className="card-dark p-4 text-center">
                <p className="text-xs text-[#555]">Questionnaire complété mais les réponses n'ont pas été enregistrées.</p>
                <p className="text-[10px] text-[#444] mt-1">Le joueur doit refaire le questionnaire depuis son profil.</p>
              </div>
            ) : (
              <div className="card-dark p-4 text-center">
                <p className="text-xs text-[#444]">Ce joueur n'a pas encore complété le questionnaire V2.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient() as any

  const [tab, setTab] = useState<'players' | 'matches'>('players')
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null)

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
  const [resetting, setResetting] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState<string | null>(null)
  const [addPlayersMatch, setAddPlayersMatch] = useState<MatchRow | null>(null)
  const [addPlayersSelected, setAddPlayersSelected] = useState<Set<string>>(new Set())
  const [addPlayersSaving, setAddPlayersSaving] = useState(false)
  const [addPlayersSearch, setAddPlayersSearch] = useState('')

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

  const resetMatch = async (id: string) => {
    setResetting(id)
    try {
      await reverseMatchElo(id)
      toast.success('Match remis à zéro — ELO restauré, notes, votes et buts effacés')
      await loadData()
    } catch (err: any) {
      toast.error('Erreur reset : ' + (err?.message || 'Erreur inconnue'))
    }
    setResetting(null)
  }

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

  const closeAddPlayersModal = () => {
    setAddPlayersMatch(null)
    setAddPlayersSelected(new Set())
    setAddPlayersSearch('')
  }

  const saveAddedPlayers = async () => {
    if (!addPlayersMatch) return
    setAddPlayersSaving(true)
    const toAdd = [...addPlayersSelected]

    if (toAdd.length === 0) {
      toast.info('Aucun nouveau joueur à ajouter')
      setAddPlayersSaving(false)
      return
    }

    const rows = toAdd.map(player_id => ({ match_id: addPlayersMatch.id, player_id }))
    const { error } = await supabase.from('match_players').insert(rows)

    if (error) {
      toast.error('Erreur : ' + error.message)
    } else {
      toast.success(`${toAdd.length} joueur(s) ajouté(s)`)
      setAddPlayersMatch(null)
      setAddPlayersSelected(new Set())
      setAddPlayersSearch('')
      await loadData()
    }
    setAddPlayersSaving(false)
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
                className="input-dark" style={{ paddingLeft: 40 }}
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
                  <div key={player.id}
                    onClick={() => setSelectedPlayer(player)}
                    className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-[#111] transition-colors cursor-pointer">
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
                className="input-dark" style={{ paddingLeft: 40 }}
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
                  <div className="flex gap-2 flex-wrap">
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

                    <button
                      onClick={() => {
                        setAddPlayersMatch(match)
                        setAddPlayersSelected(new Set())
                        setAddPlayersSearch('')
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider transition-all"
                      style={{
                        background: 'rgba(255,184,0,0.08)',
                        border: '1px solid rgba(255,184,0,0.2)',
                        color: '#FFB800',
                      }}
                    >
                      <Users className="w-3.5 h-3.5" />
                      JOUEURS
                    </button>

                    {match.status !== 'upcoming' && (
                      confirmReset === match.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setConfirmReset(null); resetMatch(match.id) }}
                            disabled={resetting === match.id}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider transition-all"
                            style={{
                              background: 'rgba(170,255,0,0.12)',
                              border: '1px solid rgba(170,255,0,0.35)',
                              color: 'var(--lime)',
                            }}
                          >
                            {resetting === match.id ? '...' : '✓ CONFIRMER'}
                          </button>
                          <button
                            onClick={() => setConfirmReset(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider transition-all"
                            style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#888' }}
                          >
                            ANNULER
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmReset(match.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider transition-all"
                          style={{
                            background: 'rgba(170,255,0,0.07)',
                            border: '1px solid rgba(170,255,0,0.2)',
                            color: 'var(--lime)',
                          }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          RÉINITIALISER
                        </button>
                      )
                    )}

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

      {/* Add players modal */}
      {addPlayersMatch && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={closeAddPlayersModal}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ background: '#0E0E0E', border: '1px solid #1E1E1E', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1A1A1A] flex-shrink-0">
              <div>
                <p className="font-display text-base text-white">AJOUTER DES JOUEURS</p>
                <p className="text-[10px] text-[#555] font-display mt-0.5 truncate max-w-[240px]">
                  {addPlayersMatch.title}
                </p>
              </div>
              <button
                onClick={closeAddPlayersModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}
              >
                <X className="w-4 h-4 text-[#666]" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
                <input
                  type="text"
                  value={addPlayersSearch}
                  onChange={e => setAddPlayersSearch(e.target.value)}
                  placeholder="Rechercher un joueur..."
                  className="input-dark w-full"
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            {/* Player list */}
            <div className="overflow-y-auto flex-1 px-4 pb-2">
              <div className="space-y-1">
                {players
                  .filter(p =>
                    !addPlayersSearch ||
                    `${p.first_name} ${p.last_name}`.toLowerCase().includes(addPlayersSearch.toLowerCase())
                  )
                  .map(player => {
                    const isAlready = addPlayersMatch.match_players.some((mp: any) => mp.player_id === player.id)
                    const isSelected = addPlayersSelected.has(player.id)
                    return (
                      <button
                        key={player.id}
                        disabled={isAlready}
                        onClick={() => {
                          const next = new Set(addPlayersSelected)
                          if (next.has(player.id)) next.delete(player.id)
                          else next.add(player.id)
                          setAddPlayersSelected(next)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                        style={{
                          background: isSelected ? 'rgba(170,255,0,0.08)' : '#111',
                          border: isSelected ? '1px solid rgba(170,255,0,0.25)' : '1px solid #1A1A1A',
                          opacity: isAlready ? 0.4 : 1,
                          cursor: isAlready ? 'default' : 'pointer',
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                          style={{ background: '#1A1A1A', color: '#666', border: '1px solid #2A2A2A' }}
                        >
                          {player.first_name.charAt(0)}{player.last_name.charAt(0)}
                        </div>
                        <span className="flex-1 text-sm text-left" style={{ color: isSelected ? '#FFF' : '#888' }}>
                          {player.first_name} {player.last_name}
                        </span>
                        <span className="text-[10px] font-display" style={{ color: isAlready ? '#555' : isSelected ? 'var(--lime)' : '#444' }}>
                          {isAlready ? 'INSCRIT' : isSelected ? '✓' : ''}
                        </span>
                      </button>
                    )
                  })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-[#1A1A1A] flex-shrink-0 flex gap-2">
              <button
                onClick={closeAddPlayersModal}
                className="flex-1 py-3 rounded-xl text-sm font-display font-bold tracking-wider"
                style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#666' }}
              >
                ANNULER
              </button>
              <button
                onClick={saveAddedPlayers}
                disabled={addPlayersSaving}
                className="flex-1 py-3 rounded-xl text-sm font-display font-bold tracking-wider transition-all"
                style={{
                  background: 'rgba(170,255,0,0.15)',
                  border: '1px solid rgba(170,255,0,0.35)',
                  color: 'var(--lime)',
                }}
              >
                {addPlayersSaving ? '...' : `AJOUTER (${addPlayersSelected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player detail modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  )
}
