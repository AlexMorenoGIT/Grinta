'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Eye, EyeOff, Zap } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient() as any

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect'
        : error.message
      )
      setLoading(false)
      return
    }

    const returnTo = searchParams.get('returnTo')
    router.push(returnTo || '/home')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm animate-slide-up delay-1">
      <div className="card-dark p-6">
        <h2 className="font-display text-2xl text-white mb-1">
          CONNEXION
        </h2>
        <p className="text-sm text-[#666] mb-6">
          Contente de te revoir, champion.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
              className="input-dark"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-dark pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#999] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-lime mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                CONNEXION...
              </span>
            ) : 'SE CONNECTER'}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-[#555] mt-4">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-semibold hover:underline" style={{ color: 'var(--lime)' }}>
          Créer un compte
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#080808]">
      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(170,255,0,0.06) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(170,255,0,0.04) 0%, transparent 70%)' }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#AAFF00" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="mb-10 animate-slide-up text-center">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse-lime"
              style={{ background: 'var(--lime)', boxShadow: '0 0 20px rgba(170,255,0,0.4)' }}>
              <Zap className="w-5 h-5 text-black" strokeWidth={2.5} />
            </div>
            <h1 className="font-display text-4xl text-white" style={{ color: 'var(--lime)', letterSpacing: '-0.02em' }}>
              GRINTA
            </h1>
          </div>
          <p className="text-sm text-[#666] font-display-light tracking-widest">
            FOOTBALL ORGANISÉ
          </p>
        </div>

        <Suspense fallback={<div className="w-full max-w-sm skeleton h-64 rounded-2xl" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
