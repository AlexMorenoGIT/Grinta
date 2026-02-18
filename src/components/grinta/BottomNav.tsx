'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, Plus } from 'lucide-react'

const NAV = [
  { href: '/home', icon: Home, label: 'Accueil' },
  { href: '/profil', icon: User, label: 'Profil' },
]

export function BottomNav({ onCreateMatch }: { onCreateMatch?: () => void }) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'linear-gradient(to top, #0A0A0A 60%, rgba(10,10,10,0.9) 100%)',
        borderTop: '1px solid #1A1A1A',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around px-4 h-16 max-w-lg mx-auto relative">
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
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
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* FAB central */}
        <button
          onClick={onCreateMatch}
          className="absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-150 hover:scale-105 active:scale-95"
          style={{
            background: 'var(--lime)',
            boxShadow: '0 4px 24px rgba(170,255,0,0.3), 0 0 0 3px #0A0A0A',
          }}
        >
          <Plus className="w-6 h-6 text-black" strokeWidth={2.5} />
        </button>
      </div>
    </nav>
  )
}
