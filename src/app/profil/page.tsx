'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  User, TrendingUp, Shield, Zap, Eye, EyeOff,
  Minus, RotateCcw, LogOut, Crown, Copy, Check
} from 'lucide-react'
import { BottomNav } from '@/components/grinta/BottomNav'
import { CreateMatchModal } from '@/components/grinta/CreateMatchModal'
import type { Profile } from '@/types/database'

const CRITERES = [
  { id: 'technique_score', label: 'Technique', color: '#AAFF00', desc: 'Contrôle, passes, dribbles' },
  { id: 'physique_score', label: 'Physique', color: '#3B82F6', desc: 'Vitesse, endurance, puissance' },
  { id: 'tactique_score', label: 'Tactique', color: '#A855F7', desc: 'Lecture du jeu, vision, placement' },
]

export default function ProfilPage() {
  const router = useRouter()
  const supabase = createClient() as any

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stats' | 'settings'>('stats')
  const [showCreate, setShowCreate] = useState(false)

  // Payment stats
  const [totalSpent, setTotalSpent] = useState<number | null>(null)
  const [totalCollected, setTotalCollected] = useState<number | null>(null)
  const [copiedRib, setCopiedRib] = useState(false)

  // Settings form
  const [form, setForm] = useState({
    firstName: '', lastName: '',
    weroPhone: '', rib: '',
    currentPassword: '', newPassword: '', confirmPassword: '',
  })
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  // Self-assessment update
  const [selfScores, setSelfScores] = useState({ technique_score: 5, physique_score: 5, tactique_score: 5 })
  const [savingScores, setSavingScores] = useState(false)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).single()

    if (profileRes.data) {
      setProfile(profileRes.data)
      setForm(prev => ({
        ...prev,
        firstName: profileRes.data.first_name,
        lastName: profileRes.data.last_name,
        weroPhone: profileRes.data.wero_phone || '',
        rib: profileRes.data.rib || '',
      }))
      setSelfScores({
        technique_score: profileRes.data.technique_score || 5,
        physique_score: profileRes.data.physique_score || 5,
        tactique_score: profileRes.data.tactique_score || 5,
      })
    }

    // Payment stats: dépensé (joueur)
    const { data: myMatchPlayers } = await supabase
      .from('match_players')
      .select('has_paid, matches(price_total, max_players)')
      .eq('player_id', user.id)
      .eq('has_paid', true)

    let spent = 0
    if (myMatchPlayers) {
      for (const mp of myMatchPlayers) {
        if (mp.matches?.price_total && mp.matches?.max_players) {
          spent += mp.matches.price_total / mp.matches.max_players
        }
      }
    }
    setTotalSpent(spent)

    // Payment stats: collecté (organisateur)
    const { data: myMatches } = await supabase
      .from('matches')
      .select('id, price_total, match_players(has_paid)')
      .eq('created_by', user.id)

    let collected = 0
    if (myMatches) {
      for (const m of myMatches) {
        if (m.price_total) {
          const paidCount = (m.match_players || []).filter((mp: any) => mp.has_paid).length
          const pricePerPlayer = m.price_total / Math.max((m.match_players || []).length, 1)
          collected += paidCount * pricePerPlayer
        }
      }
    }
    setTotalCollected(collected)

    setLoading(false)
  }, [router, supabase])

  useEffect(() => { loadData() }, [loadData])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSavingProfile(true)

    const { error } = await supabase.from('profiles').update({
      first_name: form.firstName,
      last_name: form.lastName,
    }).eq('id', profile.id)

    if (error) toast.error('Erreur lors de la sauvegarde')
    else {
      toast.success('Profil mis à jour !')
      await loadData()
    }
    setSavingProfile(false)
  }

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSavingPayment(true)

    const { error } = await supabase.from('profiles').update({
      wero_phone: form.weroPhone || null,
      rib: form.rib || null,
    }).eq('id', profile.id)

    if (error) toast.error('Erreur lors de la sauvegarde')
    else {
      toast.success('Infos paiement mises à jour !')
      await loadData()
    }
    setSavingPayment(false)
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    if (form.newPassword.length < 6) {
      toast.error('Minimum 6 caractères')
      return
    }
    setSavingPassword(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: form.currentPassword,
    })

    if (signInError) {
      toast.error('Mot de passe actuel incorrect')
      setSavingPassword(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: form.newPassword })
    if (error) toast.error('Erreur lors du changement')
    else {
      toast.success('Mot de passe modifié !')
      setForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }))
    }
    setSavingPassword(false)
  }

  const saveSelfScores = async () => {
    if (!profile) return
    setSavingScores(true)

    // V2: ELO = elo_base (questionnaire) + elo_gain (matchs). Les sliders n'impactent plus l'ELO.
    const { error } = await supabase.from('profiles').update(selfScores).eq('id', profile.id)

    if (error) toast.error('Erreur')
    else {
      toast.success(`Auto-évaluation mise à jour !`)
      await loadData()
    }
    setSavingScores(false)
  }

  const handleRedoQuestionnaire = async () => {
    if (!profile) return
    await supabase.from('profiles').update({ has_completed_v2_onboarding: false }).eq('id', profile.id)
    router.push('/onboarding')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#080808] px-5 pt-12">
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-40 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
        </div>
        <BottomNav onCreateMatch={() => setShowCreate(true)} />
      </div>
    )
  }

  if (!profile) return null

  const winRate = profile.matches_played > 0
    ? Math.round((profile.wins / profile.matches_played) * 100)
    : 0

  return (
    <div className="min-h-dvh bg-[#080808]">
      {/* Header */}
      <div className="px-5 pt-12 pb-4" style={{ background: 'linear-gradient(to bottom, #080808 80%, transparent)' }}>
        {/* Profile hero */}
        <div className="flex items-center gap-4 mb-6 animate-slide-up">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(170,255,0,0.15), rgba(170,255,0,0.05))',
              border: '2px solid rgba(170,255,0,0.2)',
              color: 'var(--lime)',
              fontFamily: "'Barlow Condensed', sans-serif",
            }}>
            {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl text-white leading-tight">
              {profile.first_name.toUpperCase()} {profile.last_name.toUpperCase()}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {profile.mvp_count > 0 && (
                <span className="mvp-badge flex items-center gap-1">
                  <Crown className="w-3 h-3" /> {profile.mvp_count}× MVP
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#111' }}>
          {([
            { key: 'stats', label: 'Stats' },
            { key: 'settings', label: 'Compte' },
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

      <div className="px-5 pb-28 space-y-4">
        {/* TAB: STATS */}
        {tab === 'stats' && (
          <div className="animate-fade-in space-y-4">
            {/* Performance grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Matchs joués', value: profile.matches_played, icon: Shield, color: '#AAFF00' },
                { label: 'Victoires', value: profile.wins, icon: TrendingUp, color: '#22C55E' },
                { label: 'Défaites', value: profile.losses, icon: Minus, color: '#EF4444' },
                { label: 'Taux de victoire', value: `${winRate}%`, icon: Zap, color: '#FFB800' },
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
                  <h3 className="font-display text-base text-white">NOTE MOYENNE REÇUE</h3>
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
                <p className="text-xs text-[#444] mt-1">Basé sur les notes anonymes de tes coéquipiers</p>
              </div>
            )}

            {/* Auto-évaluation */}
            <div className="card-dark p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full" style={{ background: '#A855F7' }} />
                  <h3 className="font-display text-base text-white">AUTO-ÉVALUATION</h3>
                </div>
                <button
                  onClick={() => setTab('settings')}
                  className="text-xs text-[#555] hover:text-[#888] transition-colors font-display-light tracking-wider"
                >
                  MODIFIER →
                </button>
              </div>
              <div className="space-y-3">
                {CRITERES.map(c => {
                  const score = profile[c.id as keyof Profile] as number | null || 0
                  return (
                    <div key={c.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-[#888]">{c.label}</span>
                        <span className="font-display font-bold text-white">{score}/10</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1A1A1A' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${score * 10}%`, background: c.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Paiements */}
            {(totalSpent !== null || totalCollected !== null) && (
              <div className="card-dark p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full" style={{ background: '#22C55E' }} />
                  <h3 className="font-display text-base text-white">PAIEMENTS</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3" style={{ background: '#0F0F0F', border: '1px solid #1A1A1A' }}>
                    <p className="text-xs text-[#555] mb-1">DÉPENSÉ</p>
                    <p className="font-display text-2xl text-white">{(totalSpent || 0).toFixed(2)} €</p>
                    <p className="text-xs text-[#444] mt-0.5">en tant que joueur</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: '#0F0F0F', border: '1px solid #1A1A1A' }}>
                    <p className="text-xs text-[#555] mb-1">COLLECTÉ</p>
                    <p className="font-display text-2xl text-white">{(totalCollected || 0).toFixed(2)} €</p>
                    <p className="text-xs text-[#444] mt-0.5">en tant qu'organisateur</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: SETTINGS */}
        {tab === 'settings' && (
          <div className="animate-fade-in space-y-4">
            {/* Modifier nom/prénom */}
            <div className="card-dark p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full" style={{ background: 'var(--lime)' }} />
                <h3 className="font-display text-base text-white">INFORMATIONS</h3>
              </div>
              <form onSubmit={saveProfile} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">Prénom</label>
                    <input
                      value={form.firstName}
                      onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                      className="input-dark"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">Nom</label>
                    <input
                      value={form.lastName}
                      onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                      className="input-dark"
                      required
                    />
                  </div>
                </div>
                <button type="submit" disabled={savingProfile} className="btn-lime text-sm" style={{ padding: '10px 20px' }}>
                  {savingProfile ? 'SAUVEGARDE...' : 'ENREGISTRER'}
                </button>
              </form>
            </div>

            {/* Paiement */}
            <div className="card-dark p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full" style={{ background: '#22C55E' }} />
                <h3 className="font-display text-base text-white">PAIEMENT</h3>
              </div>
              <p className="text-xs text-[#555] mb-4 leading-relaxed">
                Renseigne tes infos pour que les joueurs puissent te rembourser facilement.
              </p>
              <form onSubmit={savePayment} className="space-y-3">
                <div>
                  <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">
                    <User className="w-3 h-3 inline mr-1" />Numéro Wero
                  </label>
                  <input
                    value={form.weroPhone}
                    onChange={e => setForm(p => ({ ...p, weroPhone: e.target.value }))}
                    placeholder="06 12 34 56 78"
                    className="input-dark"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">
                    RIB / IBAN
                  </label>
                  <input
                    value={form.rib}
                    onChange={e => setForm(p => ({ ...p, rib: e.target.value }))}
                    placeholder="FR76 XXXX XXXX XXXX..."
                    className="input-dark"
                  />
                </div>
                <button type="submit" disabled={savingPayment} className="btn-lime text-sm" style={{ padding: '10px 20px' }}>
                  {savingPayment ? 'SAUVEGARDE...' : 'ENREGISTRER'}
                </button>
              </form>
            </div>

            {/* Changer mot de passe */}
            <div className="card-dark p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full" style={{ background: '#3B82F6' }} />
                <h3 className="font-display text-base text-white">MOT DE PASSE</h3>
              </div>
              <form onSubmit={savePassword} className="space-y-3">
                <div>
                  <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">Mot de passe actuel</label>
                  <div className="relative">
                    <input
                      type={showCurrentPwd ? 'text' : 'password'}
                      value={form.currentPassword}
                      onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))}
                      placeholder="Ton mot de passe actuel"
                      required
                      className="input-dark pr-12"
                    />
                    <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors">
                      {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      value={form.newPassword}
                      onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Min. 6 caractères"
                      required
                      className="input-dark pr-12"
                    />
                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors">
                      {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">Confirmer</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    required
                    className="input-dark"
                  />
                </div>
                <button type="submit" disabled={savingPassword} className="btn-ghost text-sm">
                  {savingPassword ? 'MODIFICATION...' : 'CHANGER LE MOT DE PASSE'}
                </button>
              </form>
            </div>

            {/* Mise à jour auto-évaluation */}
            <div className="card-dark p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-4 rounded-full" style={{ background: '#A855F7' }} />
                <h3 className="font-display text-base text-white">AUTO-ÉVALUATION</h3>
              </div>
              <p className="text-xs text-[#555] mb-4 leading-relaxed">
                Tu penses que ton niveau a évolué ? Réévalue-toi. Sois honnête !
              </p>

              <div className="space-y-4 mb-4">
                {CRITERES.map(c => {
                  const score = selfScores[c.id as keyof typeof selfScores]
                  return (
                    <div key={c.id}>
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <span className="text-sm text-white font-semibold">{c.label}</span>
                          <p className="text-xs text-[#555]">{c.desc}</p>
                        </div>
                        <span className="font-display text-2xl font-bold" style={{ color: c.color }}>{score}</span>
                      </div>
                      <input
                        type="range" min={1} max={10} step={1}
                        value={score}
                        onChange={e => setSelfScores(prev => ({ ...prev, [c.id]: parseInt(e.target.value) }))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${c.color} 0%, ${c.color} ${(score - 1) / 9 * 100}%, #1A1A1A ${(score - 1) / 9 * 100}%, #1A1A1A 100%)`
                        }}
                      />
                    </div>
                  )
                })}
              </div>

              <button onClick={saveSelfScores} disabled={savingScores} className="btn-ghost flex items-center gap-2 text-sm">
                <RotateCcw className="w-4 h-4" />
                {savingScores ? 'MISE À JOUR...' : 'METTRE À JOUR MON NIVEAU'}
              </button>
            </div>

            {/* Questionnaire ELO */}
            <div className="card-dark p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-4 rounded-full" style={{ background: '#FFB800' }} />
                <h3 className="font-display text-base text-white">QUESTIONNAIRE ELO</h3>
              </div>
              <p className="text-xs text-[#555] mb-4 leading-relaxed">
                Refais les 10 questions pour recalculer ton ELO de base. Ton historique de matchs sera préservé.
              </p>

              {(profile.elo_base != null) && (
                <div className="flex items-center justify-between mb-4 p-3 rounded-xl" style={{ background: '#0F0F0F', border: '1px solid #1A1A1A' }}>
                  <div className="text-center">
                    <p className="text-[10px] text-[#555] font-display tracking-wider">BASE</p>
                    <p className="font-display text-xl text-white">{profile.elo_base}</p>
                  </div>
                  <span className="font-display text-lg text-[#333]">+</span>
                  <div className="text-center">
                    <p className="text-[10px] text-[#555] font-display tracking-wider">MATCHS</p>
                    <p className="font-display text-xl" style={{ color: (profile.elo_gain ?? 0) >= 0 ? 'var(--lime)' : '#EF4444' }}>
                      {(profile.elo_gain ?? 0) >= 0 ? '+' : ''}{profile.elo_gain ?? 0}
                    </p>
                  </div>
                  <span className="font-display text-lg text-[#333]">=</span>
                  <div className="text-center">
                    <p className="text-[10px] text-[#555] font-display tracking-wider">TOTAL</p>
                    <p className="font-display text-xl text-white">{profile.elo}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleRedoQuestionnaire}
                className="btn-ghost flex items-center gap-2 text-sm"
                style={{ color: '#FFB800', borderColor: 'rgba(255,184,0,0.3)' }}
              >
                <RotateCcw className="w-4 h-4" />
                REFAIRE LE QUESTIONNAIRE
              </button>
            </div>

            {/* Déconnexion */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-bold tracking-wider uppercase transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
            >
              <LogOut className="w-4 h-4" />
              SE DÉCONNECTER
            </button>
          </div>
        )}
      </div>

      <BottomNav onCreateMatch={() => setShowCreate(true)} isAdmin={profile?.is_admin ?? false} />
      <CreateMatchModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {}} />
    </div>
  )
}
