'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Shield, TrendingUp, Minus, Zap, Crown, Trophy } from 'lucide-react'
import { BottomNav } from '@/components/grinta/BottomNav'
import { CreateMatchModal } from '@/components/grinta/CreateMatchModal'
import { PlayerAvatar } from '@/components/grinta/PlayerAvatar'
import { FUTCard } from '@/components/grinta/FUTCard'
import type { Profile } from '@/types/database'

export default function JoueurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient() as any

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [recentMatches, setRecentMatches] = useState<any[]>([])
  const [topPartner, setTopPartner] = useState<{ profile: any; wins: number } | null>(null)
  const [topRival, setTopRival] = useState<{ profile: any; losses: number } | null>(null)

  const loadData = useCallback(async () => {
    // Profil
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (!prof) { setLoading(false); return }
    setProfile(prof)

    // Derniers matchs
    const { data: mps } = await supabase
      .from('match_players')
      .select('team, matches(id, title, date, score_equipe_a, score_equipe_b, status)')
      .eq('player_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (mps) {
      setRecentMatches(
        mps
          .filter((mp: any) => mp.matches?.status === 'completed')
          .map((mp: any) => {
            const m = mp.matches
            const won = (mp.team === 'A' && m.score_equipe_a > m.score_equipe_b) ||
                        (mp.team === 'B' && m.score_equipe_b > m.score_equipe_a)
            const draw = m.score_equipe_a === m.score_equipe_b
            return { ...m, team: mp.team, won, draw }
          })
      )
    }

    // Partenaire idéal & bête noire
    const { data: allMps } = await supabase
      .from('match_players')
      .select('match_id, team')
      .eq('player_id', id)

    if (allMps && allMps.length > 0) {
      const matchIds = allMps.map((mp: any) => mp.match_id)
      const teamByMatch: Record<string, string> = {}
      allMps.forEach((mp: any) => { teamByMatch[mp.match_id] = mp.team })

      // Tous les joueurs de ces matchs
      const { data: otherMps } = await supabase
        .from('match_players')
        .select('match_id, player_id, team, matches(score_equipe_a, score_equipe_b, status)')
        .in('match_id', matchIds)
        .neq('player_id', id)

      if (otherMps) {
        const partnerWins: Record<string, number> = {}
        const rivalLosses: Record<string, number> = {}

        for (const mp of otherMps) {
          if (mp.matches?.status !== 'completed') continue
          const myTeam = teamByMatch[mp.match_id]
          const sameTeam = mp.team === myTeam

          const myWon = (myTeam === 'A' && mp.matches.score_equipe_a > mp.matches.score_equipe_b) ||
                        (myTeam === 'B' && mp.matches.score_equipe_b > mp.matches.score_equipe_a)
          const myLost = (myTeam === 'A' && mp.matches.score_equipe_a < mp.matches.score_equipe_b) ||
                         (myTeam === 'B' && mp.matches.score_equipe_b < mp.matches.score_equipe_a)

          if (sameTeam && myWon) {
            partnerWins[mp.player_id] = (partnerWins[mp.player_id] || 0) + 1
          }
          if (!sameTeam && myLost) {
            rivalLosses[mp.player_id] = (rivalLosses[mp.player_id] || 0) + 1
          }
        }

        // Meilleur partenaire
        const bestPartnerId = Object.entries(partnerWins).sort((a, b) => b[1] - a[1])[0]
        if (bestPartnerId && bestPartnerId[1] >= 2) {
          const { data: partnerProf } = await supabase
            .from('profiles').select('id, first_name, last_name, avatar_url').eq('id', bestPartnerId[0]).single()
          if (partnerProf) setTopPartner({ profile: partnerProf, wins: bestPartnerId[1] })
        }

        // Pire rival
        const worstRivalId = Object.entries(rivalLosses).sort((a, b) => b[1] - a[1])[0]
        if (worstRivalId && worstRivalId[1] >= 2) {
          const { data: rivalProf } = await supabase
            .from('profiles').select('id, first_name, last_name, avatar_url').eq('id', worstRivalId[0]).single()
          if (rivalProf) setTopRival({ profile: rivalProf, losses: worstRivalId[1] })
        }
      }
    }

    setLoading(false)
  }, [id, supabase])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#080808] px-5 pt-12">
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
        <BottomNav onCreateMatch={() => setShowCreate(true)} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-dvh bg-[#080808] flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-2xl text-white mb-2">JOUEUR INTROUVABLE</p>
          <button onClick={() => router.back()} className="btn-ghost text-sm">← RETOUR</button>
        </div>
        <BottomNav onCreateMatch={() => setShowCreate(true)} />
      </div>
    )
  }

  const winRate = profile.matches_played > 0
    ? Math.round((profile.wins / profile.matches_played) * 100) : 0

  return (
    <div className="min-h-dvh bg-[#080808]">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[#555] text-sm mb-6 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <div className="flex items-center gap-4 mb-6 animate-slide-up">
          <PlayerAvatar player={profile} size={72} />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl text-white leading-tight">
              {profile.first_name.toUpperCase()} {profile.last_name.toUpperCase()}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="elo-badge">{profile.elo} ELO</span>
              {profile.mvp_count > 0 && (
                <span className="mvp-badge flex items-center gap-1">
                  <Crown className="w-3 h-3" /> {profile.mvp_count}× MVP
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-28 space-y-4">
        {/* FUT Card */}
        {profile.v2_answers && (
          <div className="flex justify-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <FUTCard player={profile} size="md" />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Matchs joués', value: profile.matches_played, icon: Shield, color: '#AAFF00' },
            { label: 'Victoires', value: profile.wins, icon: TrendingUp, color: '#22C55E' },
            { label: 'Défaites', value: profile.losses, icon: Minus, color: '#EF4444' },
            { label: 'Taux victoire', value: `${winRate}%`, icon: Zap, color: '#FFB800' },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="card-dark p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: stat.color }} />
                  <span className="text-xs text-[#555] font-display-light tracking-wide">{stat.label.toUpperCase()}</span>
                </div>
                <p className="font-display text-3xl text-white">{stat.value}</p>
              </div>
            )
          })}
        </div>

        {/* Note moyenne */}
        {profile.avg_rating && (
          <div className="card-dark p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full" style={{ background: '#FFB800' }} />
              <h3 className="font-display text-base text-white">NOTE MOYENNE</h3>
            </div>
            <div className="flex items-end gap-3">
              <span className="font-display text-5xl" style={{ color: 'var(--gold)' }}>
                {Number(profile.avg_rating).toFixed(1)}
              </span>
              <span className="font-display text-xl text-[#444] mb-1">/10</span>
            </div>
            <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: '#1A1A1A' }}>
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${(Number(profile.avg_rating) / 10) * 100}%`,
                  background: Number(profile.avg_rating) >= 7 ? 'var(--lime)' : Number(profile.avg_rating) >= 5 ? 'var(--gold)' : '#EF4444'
                }} />
            </div>
          </div>
        )}

        {/* Drama: Partenaire & Rival */}
        {(topPartner || topRival) && (
          <div className="card-dark p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full" style={{ background: '#8B5CF6' }} />
              <h3 className="font-display text-base text-white">DRAMA</h3>
            </div>
            <div className="space-y-3">
              {topPartner && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#0F0F0F', border: '1px solid #1A1A1A' }}>
                  <PlayerAvatar player={topPartner.profile} size={36} />
                  <div className="flex-1">
                    <p className="text-xs text-[#22C55E] font-display tracking-wider">PARTENAIRE IDÉAL</p>
                    <p className="text-sm text-white">{topPartner.profile.first_name} {topPartner.profile.last_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg text-[#22C55E]">{topPartner.wins}</p>
                    <p className="text-[10px] text-[#555]">VICTOIRES</p>
                  </div>
                </div>
              )}
              {topRival && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#0F0F0F', border: '1px solid #1A1A1A' }}>
                  <PlayerAvatar player={topRival.profile} size={36} />
                  <div className="flex-1">
                    <p className="text-xs text-[#EF4444] font-display tracking-wider">BÊTE NOIRE</p>
                    <p className="text-sm text-white">{topRival.profile.first_name} {topRival.profile.last_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg text-[#EF4444]">{topRival.losses}</p>
                    <p className="text-[10px] text-[#555]">DÉFAITES</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Derniers matchs */}
        {recentMatches.length > 0 && (
          <div className="card-dark p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full" style={{ background: 'var(--lime)' }} />
              <h3 className="font-display text-base text-white">DERNIERS MATCHS</h3>
            </div>
            <div className="space-y-2">
              {recentMatches.slice(0, 5).map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => router.push(`/match/${m.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-[#151515]"
                  style={{ background: '#0F0F0F', border: '1px solid #1A1A1A' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-display text-xs font-bold"
                    style={{
                      background: m.won ? 'rgba(34,197,94,0.15)' : m.draw ? 'rgba(255,184,0,0.15)' : 'rgba(239,68,68,0.15)',
                      color: m.won ? '#22C55E' : m.draw ? '#FFB800' : '#EF4444',
                      border: `1px solid ${m.won ? 'rgba(34,197,94,0.3)' : m.draw ? 'rgba(255,184,0,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}
                  >
                    {m.won ? 'V' : m.draw ? 'N' : 'D'}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm text-white truncate">{m.title}</p>
                    <p className="text-[10px] text-[#555]">
                      {m.date ? new Date(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                    </p>
                  </div>
                  <div className="font-display text-base text-[#888]">
                    {m.score_equipe_a} - {m.score_equipe_b}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {profile.matches_played === 0 && (
          <div className="card-dark p-8 text-center">
            <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: '#2A2A2A' }} />
            <p className="font-display text-lg text-[#444] mb-1">AUCUN MATCH JOUÉ</p>
            <p className="text-xs text-[#333]">Ce joueur n'a pas encore participé à un match.</p>
          </div>
        )}
      </div>

      <BottomNav onCreateMatch={() => setShowCreate(true)} />
      <CreateMatchModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {}} />
    </div>
  )
}
