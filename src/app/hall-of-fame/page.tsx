'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Trophy, Crosshair, Shuffle, Shield, AlertTriangle, Crown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { BottomNav } from '@/components/grinta/BottomNav'
import { CreateMatchModal } from '@/components/grinta/CreateMatchModal'
import { PlayerAvatar } from '@/components/grinta/PlayerAvatar'

/* ── Types ──────────────────────────────────────────────────────────────── */

interface RankedPlayer {
  id: string
  first_name: string
  last_name: string
  avatar_url?: string | null
  count: number
  extra?: string
}

interface Category {
  key: string
  title: string
  icon: LucideIcon
  accent: string
  players: RankedPlayer[]
}

/* ── Podium colors ──────────────────────────────────────────────────────── */

const MEDAL = [
  { bg: 'rgba(255,215,0,0.10)', border: '#FFD700', glow: 'rgba(255,215,0,0.25)', text: '#FFD700' },
  { bg: 'rgba(192,192,192,0.08)', border: '#C0C0C0', glow: 'rgba(192,192,192,0.18)', text: '#C0C0C0' },
  { bg: 'rgba(205,127,50,0.08)', border: '#CD7F32', glow: 'rgba(205,127,50,0.18)', text: '#CD7F32' },
]

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function HallOfFamePage() {
  const router = useRouter()
  const supabase = createClient() as any

  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'all' | 'month'>('all')
  const [categories, setCategories] = useState<Category[]>([])
  const [showCreate, setShowCreate] = useState(false)

  const loadData = useCallback(async (p: 'all' | 'month') => {
    setLoading(true)

    // Date filter for "this month"
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // ── 1. Pichichi (Top Scorers) ──
    let goalsQuery = supabase
      .from('match_goals')
      .select('scorer_id, match_id, matches(date)')
      .eq('is_own_goal', false)
      .not('scorer_id', 'is', null)

    if (p === 'month') {
      goalsQuery = goalsQuery.gte('matches.date', monthStart)
    }

    const { data: goals } = await goalsQuery

    const scorerMap: Record<string, number> = {}
    if (goals) {
      for (const g of goals) {
        if (p === 'month' && !g.matches?.date) continue
        if (g.scorer_id) scorerMap[g.scorer_id] = (scorerMap[g.scorer_id] || 0) + 1
      }
    }
    const scorerIds = Object.entries(scorerMap).sort((a, b) => b[1] - a[1]).slice(0, 10)

    // ── 2. Maestro (Top Assisters) ──
    let assistQuery = supabase
      .from('match_goals')
      .select('assist_id, match_id, matches(date)')
      .not('assist_id', 'is', null)

    if (p === 'month') {
      assistQuery = assistQuery.gte('matches.date', monthStart)
    }

    const { data: assists } = await assistQuery

    const assistMap: Record<string, number> = {}
    if (assists) {
      for (const a of assists) {
        if (p === 'month' && !a.matches?.date) continue
        if (a.assist_id) assistMap[a.assist_id] = (assistMap[a.assist_id] || 0) + 1
      }
    }
    const assistIds = Object.entries(assistMap).sort((a, b) => b[1] - a[1]).slice(0, 10)

    // ── 3. Le Roc (Best Win Rate) ──
    const { data: rocProfiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, wins, matches_played')
      .gte('matches_played', 5)
      .order('wins', { ascending: false })

    const rocRanked: RankedPlayer[] = (rocProfiles || [])
      .map((p: any) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        avatar_url: p.avatar_url,
        count: Math.round((p.wins / p.matches_played) * 100),
        extra: `${p.wins}V / ${p.matches_played}M`,
      }))
      .sort((a: RankedPlayer, b: RankedPlayer) => b.count - a.count)
      .slice(0, 10)

    // ── 4. Banane d'Or (Most Own Goals) ──
    const { data: cscProfiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, own_goals')
      .gt('own_goals', 0)
      .order('own_goals', { ascending: false })
      .limit(10)

    // ── Fetch profiles for scorers/assisters ──
    const allIds = [...new Set([
      ...scorerIds.map(([id]) => id),
      ...assistIds.map(([id]) => id),
    ])]

    let profilesMap: Record<string, any> = {}
    if (allIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', allIds)
      if (profiles) {
        for (const p of profiles) profilesMap[p.id] = p
      }
    }

    const toRanked = (entries: [string, number][], unit: string): RankedPlayer[] =>
      entries
        .filter(([id]) => profilesMap[id])
        .map(([id, count]) => ({
          id,
          first_name: profilesMap[id].first_name,
          last_name: profilesMap[id].last_name,
          avatar_url: profilesMap[id].avatar_url,
          count,
          extra: `${count} ${unit}`,
        }))

    setCategories([
      { key: 'pichichi', title: 'PICHICHI', icon: Crosshair, accent: '#AAFF00', players: toRanked(scorerIds, 'buts') },
      { key: 'maestro', title: 'MAESTRO', icon: Shuffle, accent: '#3B82F6', players: toRanked(assistIds, 'PD') },
      { key: 'roc', title: 'LE ROC', icon: Shield, accent: '#FFB800', players: rocRanked },
      {
        key: 'banane', title: "BANANE D'OR", icon: AlertTriangle, accent: '#FF6B00',
        players: (cscProfiles || []).map((p: any) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          avatar_url: p.avatar_url,
          count: p.own_goals,
          extra: `${p.own_goals} CSC`,
        })),
      },
    ])

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData(period) }, [loadData, period])

  return (
    <div className="min-h-dvh bg-[#080808]">
      {/* Ambient glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(170,255,0,0.04) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 pt-12 pb-4"
        style={{ background: 'linear-gradient(to bottom, #080808 80%, transparent)' }}
      >
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '#141414', border: '1px solid #1E1E1E' }}
          >
            <ArrowLeft className="w-4 h-4 text-[#888]" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-xl text-white tracking-wide">HALL OF FAME</h1>
            <p className="text-[10px] text-[#444] tracking-wider font-display">LES LÉGENDES DU FIVE</p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(255,215,0,0.08)',
              border: '1px solid rgba(255,215,0,0.15)',
              boxShadow: '0 0 20px rgba(255,215,0,0.08)',
            }}
          >
            <Trophy className="w-5 h-5" style={{ color: '#FFD700' }} />
          </div>
        </div>

        {/* Period toggle */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#111' }}>
          {([
            { key: 'all' as const, label: 'ALL-TIME' },
            { key: 'month' as const, label: 'CE MOIS' },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setPeriod(t.key)}
              className="flex-1 py-2 rounded-lg text-xs font-display font-bold tracking-wider uppercase transition-all"
              style={{
                background: period === t.key ? '#1E1E1E' : 'transparent',
                color: period === t.key ? 'var(--lime)' : '#555',
                border: period === t.key ? '1px solid #2A2A2A' : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-28 space-y-5">
        {loading ? (
          // Skeletons
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-dark p-4 space-y-3">
              <div className="skeleton h-6 w-40 rounded-lg" />
              <div className="flex justify-center gap-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex flex-col items-center gap-2">
                    <div className="skeleton w-12 h-12 rounded-full" />
                    <div className="skeleton h-3 w-16 rounded" />
                  </div>
                ))}
              </div>
              <div className="skeleton h-10 rounded-lg" />
            </div>
          ))
        ) : (
          categories.map((cat, catIdx) => (
            <div
              key={cat.key}
              className="card-dark overflow-hidden animate-slide-up"
              style={{ animationDelay: `${catIdx * 80}ms`, animationFillMode: 'backwards' }}
            >
              {/* Category header */}
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{
                  background: `linear-gradient(90deg, rgba(${hexToRgb(cat.accent)},0.08), transparent)`,
                  borderBottom: '1px solid #1A1A1A',
                }}
              >
                <cat.icon className="w-5 h-5 flex-shrink-0" style={{ color: cat.accent }} />
                <div className="flex-1">
                  <h2 className="font-display text-base text-white tracking-wide">{cat.title}</h2>
                  <p className="text-[10px] text-[#444]">
                    {cat.key === 'pichichi' && 'Meilleurs buteurs'}
                    {cat.key === 'maestro' && 'Meilleurs passeurs'}
                    {cat.key === 'roc' && 'Meilleur taux de victoire (min. 5 matchs)'}
                    {cat.key === 'banane' && 'Les rois du CSC'}
                  </p>
                </div>
              </div>

              {cat.players.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-display text-sm text-[#333]">AUCUNE DONNÉE</p>
                  <p className="text-[10px] text-[#252525] mt-1">
                    {period === 'month' ? 'Aucun résultat ce mois-ci' : 'Jouez des matchs pour débloquer'}
                  </p>
                </div>
              ) : (
                <div className="p-4">
                  {/* Podium top 3 */}
                  <div className="flex items-end justify-center gap-3 mb-4" style={{ minHeight: 120 }}>
                    {/* 2nd place */}
                    {cat.players[1] ? (
                      <PodiumSlot player={cat.players[1]} rank={2} accent={cat.accent} unit={cat.key === 'roc' ? '%' : ''} />
                    ) : <div className="flex-1" />}

                    {/* 1st place */}
                    {cat.players[0] ? (
                      <PodiumSlot player={cat.players[0]} rank={1} accent={cat.accent} unit={cat.key === 'roc' ? '%' : ''} />
                    ) : <div className="flex-1" />}

                    {/* 3rd place */}
                    {cat.players[2] ? (
                      <PodiumSlot player={cat.players[2]} rank={3} accent={cat.accent} unit={cat.key === 'roc' ? '%' : ''} />
                    ) : <div className="flex-1" />}
                  </div>

                  {/* Rest of the list (4+) */}
                  {cat.players.length > 3 && (
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{ border: '1px solid #1A1A1A' }}
                    >
                      {cat.players.slice(3).map((p, i) => (
                        <Link
                          key={p.id}
                          href={`/joueur/${p.id}`}
                          className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#151515]"
                          style={{
                            background: i % 2 === 0 ? '#0D0D0D' : '#0F0F0F',
                            borderTop: i > 0 ? '1px solid #141414' : 'none',
                          }}
                        >
                          <span className="font-display text-xs text-[#333] w-5 text-center">
                            {i + 4}
                          </span>
                          <PlayerAvatar player={p} size={28} />
                          <span className="flex-1 text-sm text-[#999] truncate">
                            {p.first_name} {p.last_name}
                          </span>
                          <span className="font-display text-sm" style={{ color: cat.accent }}>
                            {p.count}{cat.key === 'roc' ? '%' : ''}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <BottomNav onCreateMatch={() => setShowCreate(true)} />
      <CreateMatchModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {}} />
    </div>
  )
}

/* ── Podium Slot ────────────────────────────────────────────────────────── */

function PodiumSlot({
  player,
  rank,
  accent,
  unit,
}: {
  player: RankedPlayer
  rank: 1 | 2 | 3
  accent: string
  unit: string
}) {
  const medal = MEDAL[rank - 1]
  const heights = { 1: 70, 2: 50, 3: 36 }
  const avatarSizes = { 1: 44, 2: 36, 3: 36 }

  return (
    <Link
      href={`/joueur/${player.id}`}
      className="flex flex-col items-center gap-1.5 flex-1 transition-transform hover:scale-105"
      style={{ justifyContent: 'flex-end' }}
    >
      {/* Crown for #1 */}
      {rank === 1 && (
        <Crown
          className="w-4 h-4"
          style={{ color: '#FFD700', filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.4))' }}
        />
      )}

      {/* Avatar */}
      <div
        className="rounded-full p-0.5"
        style={{
          background: `linear-gradient(135deg, ${medal.border}40, ${medal.border}15)`,
          boxShadow: `0 0 12px ${medal.glow}`,
        }}
      >
        <PlayerAvatar player={player} size={avatarSizes[rank]} />
      </div>

      {/* Name */}
      <p
        className="text-center leading-tight truncate max-w-full"
        style={{
          fontSize: rank === 1 ? 12 : 11,
          color: rank === 1 ? '#FFF' : '#AAA',
          fontWeight: 600,
        }}
      >
        {player.first_name}
      </p>

      {/* Pedestal */}
      <div
        className="w-full rounded-t-lg flex flex-col items-center justify-center"
        style={{
          height: heights[rank],
          background: medal.bg,
          border: `1px solid ${medal.border}20`,
          borderBottom: 'none',
        }}
      >
        <span className="font-display text-lg" style={{ color: medal.text }}>
          #{rank}
        </span>
        <span className="font-display text-xs" style={{ color: accent }}>
          {player.count}{unit}
        </span>
      </div>
    </Link>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
