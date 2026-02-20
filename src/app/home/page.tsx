'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MatchCard } from '@/components/grinta/MatchCard'
import { BottomNav } from '@/components/grinta/BottomNav'
import { CreateMatchModal } from '@/components/grinta/CreateMatchModal'
import { InstallPrompt } from '@/components/grinta/InstallPrompt'
import type { Match, MatchPlayer, Profile } from '@/types/database'
import { Search, Zap } from 'lucide-react'

type MatchWithPlayers = Match & { match_players: MatchPlayer[] }

export default function HomePage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [profile, setProfile] = useState<Profile | null>(null)
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
    const { data: matchesData } = await (supabase as any)
      .from('matches')
      .select('*, match_players(*)')
      .order('date', { ascending: true })
      .order('heure', { ascending: true })

    if (profileData) setProfile(profileData as Profile)
    if (matchesData) setMatches(matchesData as MatchWithPlayers[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const myMatchIds = matches
    .filter(m => m.match_players.some(p => p.player_id === profile?.id))
    .map(m => m.id)

  const filtered = matches
    .filter(m => tab === 'upcoming'
      ? ['upcoming', 'ongoing'].includes(m.status)
      : m.status === 'completed'
    )
    .filter(m => !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.lieu.toLowerCase().includes(search.toLowerCase()))

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bonne journée'
    return 'Bonsoir'
  }

  return (
    <div className="min-h-dvh bg-[#080808]">
      {/* Header */}
      <div className="sticky top-0 z-40 px-5 pt-12 pb-4"
        style={{ background: 'linear-gradient(to bottom, #080808 80%, transparent)' }}>
        <div className="flex items-start justify-between mb-5">
          <div className="animate-slide-up">
            <p className="text-sm text-[#555] mb-0.5">{greeting()},</p>
            <h1 className="font-display text-3xl text-white leading-tight">
              {profile ? `${profile.first_name.toUpperCase()} ${profile.last_name.charAt(0).toUpperCase()}.` : '...'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{ background: '#141414', border: '1px solid #1E1E1E' }}>
              <Zap className="w-4 h-4" style={{ color: 'var(--lime)' }} />
              <span className="font-display text-sm" style={{ color: 'var(--lime)' }}>GRINTA</span>
            </div>
          </div>
        </div>

        {/* Stats rapides */}
        {profile && (
          <div className="grid grid-cols-3 gap-2 mb-4 animate-slide-up delay-1">
            {[
              { label: 'Matchs', value: profile.matches_played },
              { label: 'Victoires', value: profile.wins },
              { label: 'MVPs', value: profile.mvp_count },
            ].map((stat) => (
              <div key={stat.label} className="card-dark p-3 text-center">
                <p className="font-display text-2xl text-white">{stat.value}</p>
                <p className="text-xs text-[#555] font-display-light tracking-wide">{stat.label.toUpperCase()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative animate-slide-up delay-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un match..."
            className="input-dark" style={{ paddingLeft: 40 }}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 p-1 rounded-lg" style={{ background: '#111' }}>
          {(['upcoming', 'completed'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-md text-xs font-display font-bold tracking-wider uppercase transition-all duration-150"
              style={{
                background: tab === t ? '#1E1E1E' : 'transparent',
                color: tab === t ? 'var(--lime)' : '#555',
                border: tab === t ? '1px solid #2A2A2A' : '1px solid transparent',
              }}
            >
              {t === 'upcoming' ? 'À venir' : 'Terminés'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-28">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-32 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
              style={{ background: 'rgba(170,255,0,0.06)', border: '1px solid rgba(170,255,0,0.1)' }}>
              <Zap className="w-8 h-8 text-[#333]" />
            </div>
            <p className="font-display text-xl text-[#444] mb-2">AUCUN MATCH</p>
            <p className="text-sm text-[#444] mb-6">
              {tab === 'upcoming'
                ? "Organise le prochain match avec le bouton +"
                : "Aucun match terminé pour l'instant"}
            </p>
            {tab === 'upcoming' && (
              <button onClick={() => setShowCreate(true)} className="btn-lime" style={{ width: 'auto', padding: '10px 24px' }}>
                CRÉER UN MATCH
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((match, i) => (
              <div key={match.id} className={`animate-slide-up delay-${Math.min(i + 1, 6)}`}>
                <MatchCard
                  match={match}
                  isRegistered={myMatchIds.includes(match.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <InstallPrompt />
      <BottomNav onCreateMatch={() => setShowCreate(true)} isAdmin={profile?.is_admin ?? false} />
      <CreateMatchModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadData}
      />
    </div>
  )
}
