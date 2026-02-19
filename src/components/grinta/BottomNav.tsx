'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, Plus, Shield, Trophy } from 'lucide-react'

function NavItem({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const pathname = usePathname()
  const isActive = pathname === href
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 px-4 py-2 transition-all duration-150"
    >
      <Icon
        className="w-5 h-5 transition-colors"
        style={{ color: isActive ? 'var(--lime)' : '#555' }}
        strokeWidth={isActive ? 2.5 : 1.5}
      />
      <span
        className="text-[10px] font-semibold tracking-wider uppercase transition-colors"
        style={{ color: isActive ? 'var(--lime)' : '#444' }}
      >
        {label}
      </span>
    </Link>
  )
}

export function BottomNav({
  onCreateMatch,
  isAdmin,
}: {
  onCreateMatch?: () => void
  isAdmin?: boolean
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'linear-gradient(to top, #0A0A0A 60%, rgba(10,10,10,0.9) 100%)',
        borderTop: '1px solid #1A1A1A',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center h-16 px-2 max-w-lg mx-auto">
        {/* Left group */}
        <div className="flex flex-1 justify-around items-center">
          <NavItem href="/home" icon={Home} label="Accueil" />
          <NavItem href="/classement" icon={Trophy} label="Classement" />
        </div>

        {/* FAB — sits between the two groups */}
        <button
          onClick={onCreateMatch}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-150 hover:scale-105 active:scale-95 flex-shrink-0"
          style={{
            background: 'var(--lime)',
            boxShadow: '0 4px 24px rgba(170,255,0,0.3), 0 0 0 3px #0A0A0A',
            marginTop: '-20px',
          }}
        >
          <Plus className="w-6 h-6 text-black" strokeWidth={2.5} />
        </button>

        {/* Right group */}
        <div className="flex flex-1 justify-around items-center">
          <NavItem href="/profil" icon={User} label="Profil" />
          {isAdmin && <NavItem href="/admin" icon={Shield} label="Admin" />}
        </div>
      </div>
    </nav>
  )
}
