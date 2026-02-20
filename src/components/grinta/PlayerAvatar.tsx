'use client'

import Image from 'next/image'

interface PlayerAvatarProps {
  player: {
    avatar_url?: string | null
    first_name: string
    last_name: string
  }
  size?: number
  className?: string
}

export function PlayerAvatar({ player, size = 40, className = '' }: PlayerAvatarProps) {
  const initials = `${player.first_name.charAt(0)}${player.last_name.charAt(0)}`

  if (player.avatar_url) {
    return (
      <Image
        src={player.avatar_url}
        alt={`${player.first_name} ${player.last_name}`}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-display font-bold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.35,
        background: 'linear-gradient(135deg, rgba(170,255,0,0.15), rgba(170,255,0,0.05))',
        border: '2px solid rgba(170,255,0,0.2)',
        color: 'var(--lime)',
      }}
    >
      {initials}
    </div>
  )
}
