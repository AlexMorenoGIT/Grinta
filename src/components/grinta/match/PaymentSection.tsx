'use client'

import { useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Match, MatchPlayer, Profile } from '@/types/database'

type PlayerWithProfile = MatchPlayer & { profiles: Profile }

export function PaymentSection({ match, players, isCreator, onUpdate }: {
  match: Match
  players: PlayerWithProfile[]
  isCreator: boolean
  onUpdate: () => void
}) {
  const supabase = createClient() as any
  const [organizer, setOrganizer] = useState<Profile | null>(null)
  const [copiedRib, setCopiedRib] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    if (!match.created_by) return
    supabase.from('profiles').select('*').eq('id', match.created_by).single()
      .then(({ data }: any) => { if (data) setOrganizer(data) })
  }, [match.created_by, supabase])

  const togglePaid = async (player: PlayerWithProfile) => {
    setToggling(player.id)
    await supabase.from('match_players')
      .update({ has_paid: !player.has_paid })
      .eq('id', player.id)
    onUpdate()
    setToggling(null)
  }

  const copyRib = () => {
    if (!organizer?.rib) return
    navigator.clipboard.writeText(organizer.rib)
    setCopiedRib(true)
    toast.success('RIB copié !')
    setTimeout(() => setCopiedRib(false), 2000)
  }

  if (!match.price_total) return null

  const organizerId = match.created_by
  const organizerPlayer = players.find(p => p.player_id === organizerId)
  const nonOrgPlayers = players.filter(p => p.player_id !== organizerId)

  const pricePerPlayer = players.length > 0
    ? (match.price_total / players.length).toFixed(2)
    : '0.00'

  const nonOrgPaidCount = nonOrgPlayers.filter(p => p.has_paid).length
  const paidCount = nonOrgPaidCount + (organizerPlayer ? 1 : 0)

  return (
    <div className="card-dark p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 rounded-full" style={{ background: '#22C55E' }} />
        <h3 className="font-display text-base text-white">PAIEMENT</h3>
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#0F0F0F', border: '1px solid #1A1A1A' }}>
        <div>
          <p className="text-xs text-[#555]">Coût par joueur</p>
          <p className="font-display text-2xl text-white">{pricePerPlayer} €</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#555]">Total</p>
          <p className="font-display text-lg text-white">{match.price_total} €</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-[#555] mb-2">
          <span>Paiements reçus</span>
          <span style={{ color: paidCount === players.length ? 'var(--lime)' : '#888' }}>
            {paidCount}/{players.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1A1A1A' }}>
          <div className="h-full rounded-full transition-all"
            style={{
              width: players.length > 0 ? `${(paidCount / players.length) * 100}%` : '0%',
              background: 'var(--lime)',
            }} />
        </div>
      </div>

      <div className="space-y-2">
        {organizerPlayer && (
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#22C55E' }} />
            <span className="flex-1 text-sm text-white truncate">
              {organizerPlayer.profiles.first_name} {organizerPlayer.profiles.last_name}
            </span>
            <span className="text-xs font-display font-bold px-2 py-1 rounded-lg"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22C55E' }}>
              ORGANISATEUR ✓
            </span>
          </div>
        )}

        {nonOrgPlayers.map(player => (
          <div key={player.id} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: player.has_paid ? '#22C55E' : '#EF4444' }} />
            <span className="flex-1 text-sm text-white truncate">
              {player.profiles.first_name} {player.profiles.last_name}
            </span>
            {isCreator ? (
              <button
                onClick={() => togglePaid(player)}
                disabled={toggling === player.id}
                className="text-xs px-2 py-1 rounded-lg transition-all font-display font-bold"
                style={{
                  background: player.has_paid ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${player.has_paid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: player.has_paid ? '#22C55E' : '#EF4444',
                }}
              >
                {toggling === player.id ? '...' : player.has_paid ? 'PAYÉ ✓' : 'NON PAYÉ'}
              </button>
            ) : (
              <span className="text-xs font-display font-bold px-2 py-1 rounded-lg"
                style={{
                  background: player.has_paid ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  color: player.has_paid ? '#22C55E' : '#EF4444',
                }}>
                {player.has_paid ? 'PAYÉ' : 'NON PAYÉ'}
              </span>
            )}
          </div>
        ))}
      </div>

      {organizer && (organizer.wero_phone || organizer.rib) && (
        <div className="pt-2 border-t border-[#1A1A1A] space-y-2">
          <p className="text-xs text-[#555]">Rembourser l'organisateur :</p>
          {organizer.wero_phone && (
            <a
              href={`tel:${organizer.wero_phone}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-display font-bold tracking-wider transition-all"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E' }}
            >
              📱 REMBOURSER VIA WERO
            </a>
          )}
          {organizer.rib && (
            <button
              onClick={copyRib}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-display font-bold tracking-wider transition-all"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#3B82F6' }}
            >
              {copiedRib ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedRib ? 'RIB COPIÉ !' : 'COPIER LE RIB'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
