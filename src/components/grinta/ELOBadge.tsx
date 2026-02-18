import { TrendingUp } from 'lucide-react'

interface ELOBadgeProps {
  elo: number
  delta?: number
  size?: 'sm' | 'md' | 'lg'
}

function getEloTier(elo: number): { label: string; color: string; bg: string } {
  if (elo >= 1400) return { label: 'ÉLITE', color: '#FF4444', bg: 'rgba(255,68,68,0.12)' }
  if (elo >= 1200) return { label: 'EXPERT', color: '#FFB800', bg: 'rgba(255,184,0,0.12)' }
  if (elo >= 1000) return { label: 'CONFIRMÉ', color: '#AAFF00', bg: 'rgba(170,255,0,0.12)' }
  if (elo >= 800) return { label: 'INTERMÉD.', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' }
  return { label: 'DÉBUTANT', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' }
}

export function ELOBadge({ elo, delta, size = 'md' }: ELOBadgeProps) {
  const tier = getEloTier(elo)

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-display font-bold ${sizeClasses[size]}`}
      style={{
        background: tier.bg,
        border: `1px solid ${tier.color}35`,
        color: tier.color,
        letterSpacing: '0.06em',
      }}
    >
      <TrendingUp className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
      {elo}
      {delta !== undefined && delta !== 0 && (
        <span className="text-[10px] opacity-80">
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </span>
  )
}

export function EloTierLabel({ elo }: { elo: number }) {
  const tier = getEloTier(elo)
  return (
    <span
      className="font-display text-xs px-2 py-0.5 rounded"
      style={{
        background: tier.bg,
        color: tier.color,
        border: `1px solid ${tier.color}30`,
        letterSpacing: '0.08em',
      }}
    >
      {tier.label}
    </span>
  )
}
