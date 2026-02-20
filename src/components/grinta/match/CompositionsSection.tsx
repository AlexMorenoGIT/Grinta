'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shuffle, Swords, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { MatchPlayer, Profile, Composition } from '@/types/database'

type PlayerWithProfile = MatchPlayer & { profiles: Profile }

export function CompositionsSection({ matchId, players, isCreator }: {
  matchId: string
  players: PlayerWithProfile[]
  isCreator: boolean
}) {
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

    const updates = [
      ...comp.team_a_players.map(id => ({ match_id: matchId, player_id: id, team: 'A' as const })),
      ...comp.team_b_players.map(id => ({ match_id: matchId, player_id: id, team: 'B' as const })),
    ]

    for (const u of updates) {
      await supabase.from('match_players').update({ team: u.team }).eq('match_id', matchId).eq('player_id', u.player_id)
    }

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

              <div className="grid grid-cols-2 gap-3">
                <div className="card-dark p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="team-a-badge">ÉQUIPE A</span>
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
                          <p className="text-xs text-white truncate font-medium">{p.profiles.first_name}</p>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>

                <div className="card-dark p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-red-400" />
                    <span className="team-b-badge">ÉQUIPE B</span>
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
                          <p className="text-xs text-white truncate font-medium">{p.profiles.first_name}</p>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              </div>

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
