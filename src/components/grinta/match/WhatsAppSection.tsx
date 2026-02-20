'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { Match, MatchPlayer, Profile } from '@/types/database'

type PlayerWithProfile = MatchPlayer & { profiles: Profile }

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export function WhatsAppSection({ match, players }: {
  match: Match
  players: PlayerWithProfile[]
}) {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success('Copié !')
    setTimeout(() => setCopied(null), 2000)
  }

  const date = formatDate(match.date)
  const time = match.heure.substring(0, 5)
  const playerList = players.map((p, i) => `${i + 1}. ${p.profiles.first_name} ${p.profiles.last_name}`).join('\n')
  const matchUrl = typeof window !== 'undefined' ? `${window.location.origin}/match/${match.id}` : ''

  const templates = [
    {
      key: 'invite',
      label: '📣 Invitation',
      subtitle: 'Partager l\'info du match',
      text: `⚡ *GRINTA — MATCH ORGANISÉ*\n\n📅 ${date}\n⏰ ${time}\n📍 ${match.lieu}${match.google_maps_url ? `\n🗺️ ${match.google_maps_url}` : ''}\n\nNombre de places : ${match.max_players} joueurs\n\nRéponds ici pour t'inscrire ! 🔥\n🔗 ${matchUrl}`,
    },
    {
      key: 'rappel2',
      label: '⏰ Rappel J-2',
      subtitle: '2 jours avant le match',
      text: `⏰ *RAPPEL — MATCH DANS 2 JOURS*\n\n📅 ${date} à ${time}\n📍 ${match.lieu}\n\n👥 *Inscrits (${players.length}/${match.max_players}) :*\n${playerList}\n\nIl reste ${match.max_players - players.length} place(s). Partagez autour de vous ! 💪\n🔗 ${matchUrl}`,
    },
    {
      key: 'rappel1',
      label: '🔔 Rappel J-1',
      subtitle: 'La veille du match',
      text: `🔔 *C'EST DEMAIN — TOUT LE MONDE EST PRÊT ?*\n\n📅 ${date} à ${time}\n📍 ${match.lieu}\n\n👥 *Équipe complète (${players.length} joueurs) :*\n${playerList}\n\n✅ Confirme ta présence en répondant OUI !\n❌ Si tu ne peux plus venir, préviens MAINTENANT.\n🔗 ${matchUrl}`,
    },
    {
      key: 'final',
      label: '🚨 Final Call H-10',
      subtitle: '10h avant le match',
      text: `🚨 *FINAL CALL — MATCH DANS 10H !*\n\n📅 Aujourd'hui à ${time}\n📍 ${match.lieu}\n\nSoyez là 10 min avant l'heure !\n👟 Crampons / baskets propres\n💧 Eau + protège-tibias\n\nLet's go ! ⚡\n🔗 ${matchUrl}`,
    },
    {
      key: 'postmatch',
      label: '🏆 Post-Match',
      subtitle: 'Votes MVP + notes',
      text: `🏆 *MATCH TERMINÉ — VOTE MVP & NOTES*\n\nMerci à tous pour ce match ! 🔥\n\nMaintenant c'est le moment de :\n⭐ *Noter tes coéquipiers et adversaires* (anonyme) sur l'app\n👑 *Voter pour le MVP* du match\n\nOuvre l'appli Grinta et sélectionne ce match pour noter et voter !\n🔗 ${matchUrl}\n\n🔗 Vos notes influencent l'ELO de chacun — soyez honnêtes.`,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-4 rounded-full" style={{ background: 'var(--lime)' }} />
        <h3 className="font-display text-base text-white">MESSAGES WHATSAPP</h3>
      </div>
      <p className="text-xs text-[#555] mb-3">Appuie pour copier, colle dans WhatsApp.</p>

      {templates.map((tmpl) => (
        <button
          key={tmpl.key}
          onClick={() => copy(tmpl.key, tmpl.text)}
          className="w-full text-left card-dark p-4 flex items-center gap-3 group transition-all"
        >
          <div className="flex-1">
            <p className="font-display text-sm text-white">{tmpl.label}</p>
            <p className="text-xs text-[#555]">{tmpl.subtitle}</p>
          </div>
          <div className="flex-shrink-0">
            {copied === tmpl.key
              ? <Check className="w-4 h-4" style={{ color: 'var(--lime)' }} />
              : <Copy className="w-4 h-4 text-[#444] group-hover:text-[#666] transition-colors" />
            }
          </div>
        </button>
      ))}
    </div>
  )
}
