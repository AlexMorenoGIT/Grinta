'use client'

import { useState, useEffect } from 'react'
import { Shield, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CHALLENGE_DESCRIPTIONS } from '@/lib/challenges'
import type { Match, MatchPlayer, Profile, MatchGoal } from '@/types/database'

type PlayerWithProfile = MatchPlayer & { profiles: Profile }

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function analyzeMatchGoals(
  goals: MatchGoal[],
  scoreA: number,
  scoreB: number,
  durationSeconds: number | null | undefined
): string[] {
  const insights: string[] = []
  if (goals.length === 0) return insights

  const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null
  const diff = Math.abs(scoreA - scoreB)
  const total = scoreA + scoreB

  if (!winner) {
    insights.push(`Match nul accroché — les deux équipes se sont neutralisées (${scoreA}-${scoreB}).`)
  } else if (diff >= 4) {
    insights.push(`L'équipe ${winner} a écrasé l'adversaire dans un match à sens unique (${scoreA}-${scoreB}).`)
  } else if (diff === 1) {
    insights.push(`Victoire à l'arraché de l'équipe ${winner} — un seul but les a séparées (${scoreA}-${scoreB}).`)
  } else {
    insights.push(`L'équipe ${winner} s'impose avec autorité (${scoreA}-${scoreB}).`)
  }

  if (durationSeconds && durationSeconds > 90) {
    const mid = durationSeconds / 2
    const earlyA = goals.filter(g => g.team === 'A' && g.minute <= mid).length
    const earlyB = goals.filter(g => g.team === 'B' && g.minute <= mid).length
    const lateA = scoreA - earlyA
    const lateB = scoreB - earlyB
    if (earlyA > earlyB + 1 && lateB >= lateA) {
      insights.push("L'équipe A a dominé le début mais l'équipe B a réagi et rééquilibré la rencontre.")
    } else if (earlyB > earlyA + 1 && lateA >= lateB) {
      insights.push("L'équipe B a pris le dessus en début de match, mais l'équipe A a renversé la vapeur.")
    } else if (winner === 'A' && earlyA > earlyB) {
      insights.push("L'équipe A a imposé son rythme d'entrée et n'a jamais lâché.")
    } else if (winner === 'B' && earlyB > earlyA) {
      insights.push("L'équipe B a pris le contrôle dès l'entame et a géré son avantage.")
    }
  }

  let maxDeficitA = 0, maxDeficitB = 0, runA = 0, runB = 0
  for (const g of goals) {
    if (g.team === 'A') runA++; else runB++
    if (runA < runB) maxDeficitA = Math.max(maxDeficitA, runB - runA)
    if (runB < runA) maxDeficitB = Math.max(maxDeficitB, runA - runB)
  }
  if (winner === 'A' && maxDeficitA >= 2) insights.push(`Remontée épique de l'équipe A — elle avait ${maxDeficitA} buts à remonter ! 💪`)
  else if (winner === 'B' && maxDeficitB >= 2) insights.push(`Remontée épique de l'équipe B — elle avait ${maxDeficitB} buts à remonter ! 💪`)

  const nonCsc = goals.filter(g => !g.is_own_goal)
  for (let i = 0; i <= nonCsc.length - 3; i++) {
    const trio = nonCsc.slice(i, i + 3)
    if (trio[2].minute - trio[0].minute < 180 && trio.every(g => g.team === trio[0].team)) {
      insights.push(`⚡ Triplé éclair de l'équipe ${trio[0].team} — 3 buts en moins de 3 minutes !`)
      break
    }
  }

  const cscs = goals.filter(g => g.is_own_goal)
  if (cscs.length === 1) insights.push('Un but contre son camp a animé la rencontre. 🥅')
  else if (cscs.length >= 2) insights.push(`${cscs.length} buts contre son camp ont ponctué cette rencontre agitée. 🥅`)

  if (total >= 8) insights.push(`Match prolifique avec ${total} buts au total !`)

  return insights
}

export function StatsSection({ matchId, players, match }: {
  matchId: string
  players: PlayerWithProfile[]
  match: Match
}) {
  const supabase = createClient() as any
  const [goals, setGoals] = useState<MatchGoal[]>([])
  const [completedChallenges, setCompletedChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadGoals = supabase
      .from('match_goals')
      .select('*')
      .eq('match_id', matchId)
      .order('goal_order')
      .then(({ data }: any) => {
        if (data) setGoals(data as MatchGoal[])
      })

    const loadChallenges = supabase
      .from('match_challenges')
      .select('*, profiles:player_id(first_name, last_name), target:target_player_id(first_name, last_name)')
      .eq('match_id', matchId)
      .eq('is_completed', true)
      .then(({ data }: any) => {
        if (data) setCompletedChallenges(data)
      })

    Promise.all([loadGoals, loadChallenges]).then(() => setLoading(false))
  }, [matchId, supabase])

  const getPlayer = (id: string | null | undefined) => id ? players.find(p => p.player_id === id) : undefined

  const scorerMap: Record<string, { player: PlayerWithProfile; goals: number }> = {}
  const assistMap: Record<string, { player: PlayerWithProfile; assists: number }> = {}
  goals.forEach(g => {
    if (!g.is_own_goal && g.scorer_id) {
      const scorer = getPlayer(g.scorer_id)
      if (scorer) {
        if (!scorerMap[g.scorer_id]) scorerMap[g.scorer_id] = { player: scorer, goals: 0 }
        scorerMap[g.scorer_id].goals++
      }
    }
    if (g.assist_id) {
      const assister = getPlayer(g.assist_id)
      if (assister) {
        if (!assistMap[g.assist_id]) assistMap[g.assist_id] = { player: assister, assists: 0 }
        assistMap[g.assist_id].assists++
      }
    }
  })

  const maxGoals = Object.values(scorerMap).reduce((m, s) => Math.max(m, s.goals), 0)
  const topScorers = maxGoals > 0 ? Object.values(scorerMap).filter(s => s.goals === maxGoals) : []
  const maxAssists = Object.values(assistMap).reduce((m, s) => Math.max(m, s.assists), 0)
  const topAssisters = maxAssists > 0 ? Object.values(assistMap).filter(s => s.assists === maxAssists) : []

  const teamAGoals = goals.filter(g => g.team === 'A')
  const teamBGoals = goals.filter(g => g.team === 'B')
  const scoreA = match.score_equipe_a ?? teamAGoals.length
  const scoreB = match.score_equipe_b ?? teamBGoals.length
  const analysis = analyzeMatchGoals(goals, scoreA, scoreB, match.duration_seconds)

  const playerAvatar = (p: PlayerWithProfile, team: 'A' | 'B' | null) => (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{
        background: team === 'A' ? '#1A3A5C' : team === 'B' ? '#3A1A1A' : '#1A1A1A',
        color: team === 'A' ? '#60A5FA' : team === 'B' ? '#F87171' : '#888',
        border: '1px solid #2A2A2A',
      }}>
      {p.profiles.first_name[0]}{p.profiles.last_name[0]}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    )
  }

  if (goals.length === 0) {
    return (
      <div className="card-dark p-8 text-center">
        <Target className="w-8 h-8 mx-auto mb-3 text-[#333]" />
        <p className="font-display text-sm text-[#555]">AUCUN BUT ENREGISTRÉ</p>
        <p className="text-xs text-[#444] mt-1">Le live n'a pas été utilisé pour ce match.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Score + durée */}
      <div className="card-dark p-4">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="font-display text-xs text-blue-400 mb-1">ÉQUIPE A</p>
            <p className="font-display text-5xl text-blue-400" style={{ textShadow: '0 0 20px rgba(59,130,246,0.4)' }}>
              {scoreA}
            </p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl text-[#2A2A2A]">—</p>
            {match.duration_seconds != null && (
              <p className="text-[10px] text-[#444] font-display mt-1">{fmtTime(match.duration_seconds)}</p>
            )}
          </div>
          <div className="text-center">
            <p className="font-display text-xs text-red-400 mb-1">ÉQUIPE B</p>
            <p className="font-display text-5xl text-red-400" style={{ textShadow: '0 0 20px rgba(239,68,68,0.4)' }}>
              {scoreB}
            </p>
          </div>
        </div>
      </div>

      {/* Analyse narrative */}
      {analysis.length > 0 && (
        <div className="rounded-xl p-3 space-y-1.5"
          style={{ background: 'rgba(170,255,0,0.04)', border: '1px solid rgba(170,255,0,0.12)' }}>
          <p className="font-display text-[10px] tracking-widest" style={{ color: 'var(--lime)' }}>⚡ ANALYSE DU MATCH</p>
          {analysis.map((line, i) => (
            <p key={i} className="text-xs text-[#AAA] leading-relaxed">{line}</p>
          ))}
        </div>
      )}

      {/* Top scorers + passeurs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-dark p-3">
          <p className="font-display text-[10px] tracking-widest mb-2" style={{ color: 'var(--lime)' }}>
            ⚽ BUTEUR{topScorers.length > 1 ? 'S' : ''}
          </p>
          {topScorers.length === 0 ? <p className="text-xs text-[#444]">—</p> : (
            <div className="space-y-2">
              {topScorers.map(s => (
                <div key={s.player.player_id} className="flex items-center gap-2">
                  {playerAvatar(s.player, s.player.team as 'A' | 'B' | null)}
                  <div className="min-w-0">
                    <p className="text-xs text-white font-semibold truncate">
                      {s.player.profiles.first_name} {s.player.profiles.last_name}
                    </p>
                    <p className="font-display text-sm" style={{ color: 'var(--lime)' }}>
                      {s.goals} but{s.goals > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-dark p-3">
          <p className="font-display text-[10px] tracking-widest mb-2" style={{ color: '#FFB800' }}>
            🎯 PASSEUR{topAssisters.length > 1 ? 'S' : ''}
          </p>
          {topAssisters.length === 0 ? <p className="text-xs text-[#444]">—</p> : (
            <div className="space-y-2">
              {topAssisters.map(s => (
                <div key={s.player.player_id} className="flex items-center gap-2">
                  {playerAvatar(s.player, s.player.team as 'A' | 'B' | null)}
                  <div className="min-w-0">
                    <p className="text-xs text-white font-semibold truncate">
                      {s.player.profiles.first_name} {s.player.profiles.last_name}
                    </p>
                    <p className="font-display text-sm" style={{ color: '#FFB800' }}>
                      {s.assists} passe{s.assists > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline des buts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ background: 'var(--lime)' }} />
          <h3 className="font-display text-base text-white">
            TIMELINE ({goals.length} but{goals.length > 1 ? 's' : ''})
          </h3>
        </div>

        <div className="space-y-2">
          {goals.map((goal) => {
            const isCSC = !!goal.is_own_goal
            const scorer = isCSC ? null : getPlayer(goal.scorer_id)
            const cscPlayer = isCSC ? getPlayer(goal.scorer_id) : null
            const assister = goal.assist_id ? getPlayer(goal.assist_id) : null
            const isA = goal.team === 'A'
            const borderColor = isCSC ? '#FF6400' : isA ? '#3B82F6' : '#EF4444'
            return (
              <div key={goal.id}
                className="card-dark p-3 flex items-center gap-3"
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                <div className="w-14 flex-shrink-0 text-center">
                  <span className="font-display text-sm" style={{ color: isCSC ? '#FF6400' : isA ? '#60A5FA' : '#F87171' }}>
                    {fmtTime(goal.minute)}
                  </span>
                </div>

                <span className="text-base flex-shrink-0">{isCSC ? '🥅' : '⚽'}</span>

                <div className="flex-1 min-w-0">
                  {isCSC ? (
                    <>
                      <p className="text-sm font-semibold truncate" style={{ color: '#FF6400' }}>
                        CSC — {cscPlayer ? `${cscPlayer.profiles.first_name} ${cscPlayer.profiles.last_name}` : '?'}
                      </p>
                      <p className="text-xs text-[#555]">+1 Équipe {goal.team}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-white truncate">
                        {scorer ? `${scorer.profiles.first_name} ${scorer.profiles.last_name}` : '—'}
                      </p>
                      {assister && (
                        <p className="text-xs text-[#555] truncate">
                          → {assister.profiles.first_name} {assister.profiles.last_name}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <span className={isA ? 'team-a-badge' : 'team-b-badge'}>ÉQ. {goal.team}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats par équipe */}
      <div className="grid grid-cols-2 gap-3">
        {(['A', 'B'] as const).map(team => {
          const teamGoals = goals.filter(g => g.team === team)
          const isA = team === 'A'
          const scorersMap: Record<string, number> = {}
          teamGoals.filter(g => !g.is_own_goal && g.scorer_id).forEach(g => {
            const p = getPlayer(g.scorer_id)
            if (p) {
              const name = `${p.profiles.first_name} ${p.profiles.last_name}`
              scorersMap[name] = (scorersMap[name] || 0) + 1
            }
          })
          const cscInTeam = goals.filter(g => g.is_own_goal && g.team !== team)
          return (
            <div key={team} className="card-dark p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className={`w-3.5 h-3.5 ${isA ? 'text-blue-400' : 'text-red-400'}`} />
                <span className={isA ? 'team-a-badge' : 'team-b-badge'}>ÉQUIPE {team}</span>
                <span className="font-display text-sm text-white ml-auto">{teamGoals.length} buts</span>
              </div>
              <div className="space-y-1">
                {Object.entries(scorersMap)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <span className="text-[#888] truncate">{name}</span>
                      <span className="font-display text-sm text-white ml-2 flex-shrink-0">
                        {count > 1 ? `${count}×` : '⚽'}
                      </span>
                    </div>
                  ))}
                {cscInTeam.map(g => {
                  const p = getPlayer(g.scorer_id)
                  return p ? (
                    <div key={g.id} className="flex items-center justify-between text-xs">
                      <span className="truncate" style={{ color: '#FF6400' }}>{p.profiles.first_name} {p.profiles.last_name}</span>
                      <span className="ml-2 flex-shrink-0" style={{ color: '#FF6400' }}>🥅</span>
                    </div>
                  ) : null
                })}
                {Object.keys(scorersMap).length === 0 && cscInTeam.length === 0 && (
                  <p className="text-xs text-[#444]">Aucun but</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Défis complétés */}
      {completedChallenges.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: '#8B5CF6' }} />
            <h3 className="font-display text-base text-white">DÉFIS COMPLÉTÉS</h3>
          </div>
          <div className="space-y-2">
            {completedChallenges.map((ch: any) => {
              const info = CHALLENGE_DESCRIPTIONS[ch.challenge_type]
              if (!info) return null
              return (
                <div
                  key={ch.id}
                  className="card-dark p-3 flex items-center gap-3"
                  style={{ borderLeft: '3px solid #8B5CF6' }}
                >
                  <span className="text-xl flex-shrink-0">{info.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {ch.profiles?.first_name} {ch.profiles?.last_name}
                    </p>
                    <p className="text-xs" style={{ color: '#8B5CF6' }}>
                      {info.title} — {info.desc}
                      {ch.challenge_type === 'binome' && ch.target && (
                        <span className="text-[#666]"> (avec {ch.target.first_name})</span>
                      )}
                    </p>
                  </div>
                  <span className="font-display text-xs" style={{ color: 'var(--lime)' }}>+5 ELO</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
