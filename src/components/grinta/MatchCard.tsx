'use client'

import Link from 'next/link'
import { MapPin, Calendar, Clock, Users, ChevronRight } from 'lucide-react'
import type { Match, MatchPlayer } from '@/types/database'

interface MatchCardProps {
  match: Match & { match_players: MatchPlayer[] }
  isRegistered?: boolean
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === now.toDateString()) return "Aujourd'hui"
  if (date.toDateString() === tomorrow.toDateString()) return 'Demain'

  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatTime(timeStr: string): string {
  return timeStr.substring(0, 5)
}

export function MatchCard({ match, isRegistered }: MatchCardProps) {
  const playerCount = match.match_players.length
  const fillRate = playerCount / match.max_players

  const statusConfig = {
    upcoming: { label: 'À venir', class: 'status-upcoming' },
    ongoing: { label: 'En cours', class: 'status-ongoing' },
    completed: { label: 'Terminé', class: 'status-completed' },
    cancelled: { label: 'Annulé', class: 'status-completed' },
  }[match.status] || { label: match.status, class: 'status-completed' }

  return (
    <Link href={`/match/${match.id}`}>
      <div className="card-dark p-4 group cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg text-white leading-tight truncate">
              {match.title.toUpperCase()}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={statusConfig.class}>{statusConfig.label}</span>
            {isRegistered && (
              <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded"
                style={{
                  background: 'rgba(170,255,0,0.1)',
                  color: 'var(--lime)',
                  border: '1px solid rgba(170,255,0,0.2)',
                  letterSpacing: '0.06em',
                }}>
                INSCRIT
              </span>
            )}
          </div>
        </div>

        {/* Infos */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center gap-2 text-sm text-[#888]">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-[#444]" />
            <span className="truncate capitalize">{formatDate(match.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#888]">
            <Clock className="w-3.5 h-3.5 flex-shrink-0 text-[#444]" />
            <span>{formatTime(match.heure)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#888] col-span-2">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-[#444]" />
            <span className="truncate">{match.lieu}</span>
          </div>
        </div>

        {/* Players bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1.5 text-xs text-[#666]">
                <Users className="w-3 h-3" />
                <span className="font-semibold text-white">{playerCount}</span>
                <span>/</span>
                <span>{match.max_players}</span>
              </div>
              <span className="text-xs text-[#555]">{match.max_players - playerCount} places restantes</span>
            </div>
            <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(fillRate * 100, 100)}%`,
                  background: fillRate >= 1 ? '#EF4444' : fillRate >= 0.8 ? '#FFB800' : 'var(--lime)',
                }}
              />
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#666] transition-colors flex-shrink-0" />
        </div>

        {/* Score si terminé */}
        {match.status === 'completed' && match.score_equipe_a !== null && match.score_equipe_b !== null && (
          <div className="mt-3 pt-3 border-t border-[#1A1A1A] flex items-center justify-center gap-4">
            <span className="font-display text-xl text-blue-400">ÉQUIPE A</span>
            <span className="font-display text-2xl text-white">
              {match.score_equipe_a} — {match.score_equipe_b}
            </span>
            <span className="font-display text-xl text-red-400">ÉQUIPE B</span>
          </div>
        )}
      </div>
    </Link>
  )
}
