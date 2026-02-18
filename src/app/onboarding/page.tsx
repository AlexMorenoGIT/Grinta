'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Zap, Dumbbell, Brain, ChevronRight } from 'lucide-react'

const CRITERES = [
  {
    id: 'technique',
    label: 'Technique',
    icon: Zap,
    description: 'Contrôle balle, passes, dribbles',
    color: '#AAFF00',
    examples: ['1–3 : Débutant', '4–6 : Intermédiaire', '7–9 : Avancé', '10 : Pro'],
  },
  {
    id: 'physique',
    label: 'Physique',
    icon: Dumbbell,
    description: 'Vitesse, endurance, puissance',
    color: '#3B82F6',
    examples: ['1–3 : Limité', '4–6 : Correct', '7–9 : Athlétique', '10 : Exceptionnel'],
  },
  {
    id: 'tactique',
    label: 'Tactique',
    icon: Brain,
    description: 'Lecture du jeu, placement, vision',
    color: '#A855F7',
    examples: ['1–3 : Basique', '4–6 : Correct', '7–9 : Intelligent', '10 : Maestro'],
  },
]

function calcElo(t: number, p: number, ta: number): number {
  const avg = (t + p + ta) / 3
  return Math.floor(avg * 100 + 500)
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient() as any

  const [scores, setScores] = useState({ technique: 5, physique: 5, tactique: 5 })
  const [step, setStep] = useState(0) // 0: intro, 1: technique, 2: physique, 3: tactique, 4: recap
  const [loading, setLoading] = useState(false)

  const currentCritere = step >= 1 && step <= 3 ? CRITERES[step - 1] : null
  const elo = calcElo(scores.technique, scores.physique, scores.tactique)

  const handleScore = (key: string, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        technique_score: scores.technique,
        physique_score: scores.physique,
        tactique_score: scores.tactique,
        elo,
        onboarding_completed: true,
      })
      .eq('id', user.id)

    if (error) {
      toast.error('Erreur lors de la sauvegarde')
      setLoading(false)
      return
    }

    toast.success(`ELO de départ : ${elo} pts 🔥`)
    router.push('/home')
    router.refresh()
  }

  const getScoreLabel = (score: number) => {
    if (score <= 3) return 'Débutant'
    if (score <= 5) return 'Intermédiaire'
    if (score <= 7) return 'Avancé'
    if (score <= 9) return 'Expert'
    return 'LÉGENDE'
  }

  const getScoreColor = (score: number) => {
    if (score <= 3) return '#9CA3AF'
    if (score <= 5) return '#60A5FA'
    if (score <= 7) return '#AAFF00'
    if (score <= 9) return '#FFB800'
    return '#FF4444'
  }

  return (
    <div className="min-h-dvh bg-[#080808] flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: 'var(--lime)' }}>
            <Zap className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg" style={{ color: 'var(--lime)' }}>GRINTA</span>
        </div>

        {/* Progress bar */}
        {step > 0 && step <= 3 && (
          <div className="space-y-1 animate-fade-in">
            <div className="flex justify-between text-xs text-[#555]">
              <span className="font-display-light tracking-wider">ÉVALUATION {step}/3</span>
              <span>{Math.round((step / 3) * 100)}%</span>
            </div>
            <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(step / 3) * 100}%`, background: 'var(--lime)' }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 px-6 pb-8">
        {/* INTRO */}
        {step === 0 && (
          <div className="animate-slide-up">
            <h2 className="font-display text-4xl text-white leading-tight mb-3">
              ÉVALUE TON<br />
              <span style={{ color: 'var(--lime)' }}>NIVEAU</span>
            </h2>
            <p className="text-[#888] text-sm leading-relaxed mb-8">
              Sois honnête — tu vas te noter sur 3 critères. Ton ELO de départ en dépend et il détermine l'équilibrage des matchs.
            </p>

            <div className="space-y-3 mb-8">
              {CRITERES.map((c, i) => {
                const Icon = c.icon
                return (
                  <div key={c.id} className={`card-dark p-4 flex items-center gap-4 animate-slide-up delay-${i + 1}`}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${c.color}15`, border: `1px solid ${c.color}30` }}>
                      <Icon className="w-5 h-5" style={{ color: c.color }} />
                    </div>
                    <div>
                      <p className="font-display text-base text-white">{c.label.toUpperCase()}</p>
                      <p className="text-xs text-[#666]">{c.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={() => setStep(1)} className="btn-lime">
              COMMENCER L'ÉVALUATION
            </button>
          </div>
        )}

        {/* CRITERE STEPS */}
        {step >= 1 && step <= 3 && currentCritere && (
          <div className="animate-slide-up">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${currentCritere.color}15`, border: `1px solid ${currentCritere.color}30` }}>
                  <currentCritere.icon className="w-6 h-6" style={{ color: currentCritere.color }} />
                </div>
                <div>
                  <h2 className="font-display text-3xl text-white">{currentCritere.label.toUpperCase()}</h2>
                  <p className="text-sm text-[#666]">{currentCritere.description}</p>
                </div>
              </div>
            </div>

            {/* Score display */}
            <div className="text-center mb-8">
              <div
                className="font-display text-8xl transition-all duration-200"
                style={{ color: getScoreColor(scores[currentCritere.id as keyof typeof scores]) }}
              >
                {scores[currentCritere.id as keyof typeof scores]}
              </div>
              <div
                className="font-display text-lg tracking-widest mt-1 transition-all duration-200"
                style={{ color: getScoreColor(scores[currentCritere.id as keyof typeof scores]) }}
              >
                {getScoreLabel(scores[currentCritere.id as keyof typeof scores])}
              </div>
            </div>

            {/* Slider */}
            <div className="mb-6">
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={scores[currentCritere.id as keyof typeof scores]}
                onChange={(e) => handleScore(currentCritere.id, parseInt(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${currentCritere.color} 0%, ${currentCritere.color} ${(scores[currentCritere.id as keyof typeof scores] - 1) / 9 * 100}%, #1A1A1A ${(scores[currentCritere.id as keyof typeof scores] - 1) / 9 * 100}%, #1A1A1A 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-[#444] mt-2">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>

            {/* Reference examples */}
            <div className="grid grid-cols-2 gap-2 mb-8">
              {currentCritere.examples.map((ex, i) => (
                <div key={i} className="text-xs text-[#666] px-3 py-2 rounded-lg"
                  style={{ background: '#141414', border: '1px solid #1E1E1E' }}>
                  {ex}
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(step + 1)}
              className="btn-lime flex items-center gap-2"
            >
              {step < 3 ? (
                <>SUIVANT <ChevronRight className="w-4 h-4" /></>
              ) : (
                'VOIR MON ELO →'
              )}
            </button>
          </div>
        )}

        {/* RECAP */}
        {step === 4 && (
          <div className="animate-slide-up">
            <h2 className="font-display text-4xl text-white mb-2">
              TON PROFIL<br />
              <span style={{ color: 'var(--lime)' }}>INITIAL</span>
            </h2>
            <p className="text-[#888] text-sm mb-8">Voilà ce qu'on a retenu de toi.</p>

            {/* ELO Card */}
            <div className="mb-6 p-6 rounded-2xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(170,255,0,0.1), rgba(170,255,0,0.03))',
                border: '1px solid rgba(170,255,0,0.25)',
              }}>
              <p className="font-display-light text-sm text-[#888] tracking-widest mb-2">ELO DE DÉPART</p>
              <p className="font-display text-7xl lime-glow-text" style={{ color: 'var(--lime)' }}>
                {elo}
              </p>
              <p className="text-xs text-[#555] mt-2">
                (({scores.technique} + {scores.physique} + {scores.tactique}) / 3 × 100) + 500
              </p>
            </div>

            {/* Scores grid */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {CRITERES.map((c) => {
                const score = scores[c.id as keyof typeof scores]
                const Icon = c.icon
                return (
                  <div key={c.id} className="card-dark p-3 text-center">
                    <Icon className="w-4 h-4 mx-auto mb-2" style={{ color: c.color }} />
                    <p className="font-display text-2xl text-white">{score}</p>
                    <p className="text-xs text-[#555] font-display-light tracking-wide">{c.label.toUpperCase()}</p>
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-[#555] text-center mb-6 leading-relaxed">
              Tu pourras faire évoluer ton auto-évaluation dans ton profil si tu estimes que ton niveau a changé.
            </p>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-lime"
            >
              {loading ? 'CHARGEMENT...' : 'ENTRER SUR LE TERRAIN →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
