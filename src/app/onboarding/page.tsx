'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Zap } from 'lucide-react'

// ─── Questions ───────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    id: 'q1',
    label: 'TON PASSÉ SPORTIF',
    category: 'BACKGROUND',
    options: [
      { label: 'A', text: 'Jamais fait de club (Foot de rue/city uniquement).', score: 1 },
      { label: 'B', text: 'Club en poussin/benjamin.', score: 2 },
      { label: 'C', text: 'Club jusqu\'en Senior (Niveau District).', score: 3 },
      { label: 'D', text: 'Niveau Ligue ou National (actuel ou passé).', score: 4 },
    ],
  },
  {
    id: 'q2',
    label: 'TON CARDIO (FIVE DE 60 MIN)',
    category: 'PHYSIQUE',
    options: [
      { label: 'A', text: 'Je suis cuit après 15 minutes.', score: 1 },
      { label: 'B', text: 'Je gère mon effort mais je finis dans le dur.', score: 2 },
      { label: 'C', text: 'Je peux répéter les courses jusqu\'à la fin.', score: 3 },
      { label: 'D', text: 'Je peux enchaîner deux matchs de suite sans problème.', score: 4 },
    ],
  },
  {
    id: 'q3',
    label: 'TA TECHNIQUE DE BALLE',
    category: 'TECHNIQUE',
    options: [
      { label: 'A', text: 'Contrôles approximatifs, le ballon rebondit souvent.', score: 1 },
      { label: 'B', text: 'Contrôles propres à l\'arrêt, passes courtes ok.', score: 2 },
      { label: 'C', text: 'Je contrôle en mouvement et je dribble dans les petits espaces.', score: 3 },
      { label: 'D', text: 'Pied-main, le ballon ne me quitte pas.', score: 4 },
    ],
  },
  {
    id: 'q4',
    label: 'TON PIED FAIBLE',
    category: 'TECHNIQUE',
    options: [
      { label: 'A', text: 'Il sert juste à monter dans le bus.', score: 1 },
      { label: 'B', text: 'Je peux faire une passe courte sans pression.', score: 2 },
      { label: 'C', text: 'Je peux centrer ou tirer avec (moins précis que le bon).', score: 3 },
      { label: 'D', text: 'Pratiquement ambidextre.', score: 4 },
    ],
  },
  {
    id: 'q5',
    label: 'TA VISTA (VISION DE JEU)',
    category: 'TACTIQUE',
    options: [
      { label: 'A', text: 'Je regarde mes pieds quand j\'ai le ballon.', score: 1 },
      { label: 'B', text: 'Je cherche toujours le coéquipier le plus proche.', score: 2 },
      { label: 'C', text: 'Je lève la tête et je cherche des passes qui cassent des lignes.', score: 3 },
      { label: 'D', text: 'Je dicte le jeu et je donne des ballons dans le tempo.', score: 4 },
    ],
  },
  {
    id: 'q6',
    label: 'TON IMPACT PHYSIQUE',
    category: 'PHYSIQUE',
    options: [
      { label: 'A', text: 'J\'évite les contacts.', score: 1 },
      { label: 'B', text: 'Je subis les duels contre les joueurs costauds.', score: 2 },
      { label: 'C', text: 'Je suis solide sur mes appuis, difficile à bouger.', score: 3 },
      { label: 'D', text: 'Je gagne 90% de mes duels à l\'épaule.', score: 4 },
    ],
  },
  {
    id: 'q7',
    label: 'TA RÉACTION SOUS PRESSION',
    category: 'MENTAL',
    options: [
      { label: 'A', text: 'Je panique et je dégage n\'importe où.', score: 1 },
      { label: 'B', text: 'J\'essaie de m\'appuyer sur le gardien ou un défenseur.', score: 2 },
      { label: 'C', text: 'Je garde mon calme et je trouve une porte de sortie propre.', score: 3 },
      { label: 'D', text: 'J\'élimine mon vis-à-vis pour créer le décalage.', score: 4 },
    ],
  },
  {
    id: 'q8',
    label: 'TON REPLI DÉFENSIF',
    category: 'TACTIQUE',
    options: [
      { label: 'A', text: 'Je reste devant quand on perd la balle.', score: 1 },
      { label: 'B', text: 'Je reviens si l\'action est proche de moi.', score: 2 },
      { label: 'C', text: 'Je fais toujours l\'effort de revenir aider la défense.', score: 3 },
      { label: 'D', text: 'Je suis le premier à presser et à harceler l\'adversaire.', score: 4 },
    ],
  },
  {
    id: 'q9',
    label: 'TA FINITION (DEVANT LE BUT)',
    category: 'TECHNIQUE',
    options: [
      { label: 'A', text: 'Je tire fort au milieu et j\'espère.', score: 1 },
      { label: 'B', text: 'Je cadre la majorité de mes frappes.', score: 2 },
      { label: 'C', text: 'Je choisis mon côté et je place mon ballon.', score: 3 },
      { label: 'D', text: 'Sang-froid total, je rate rarement mes face-à-face.', score: 4 },
    ],
  },
  {
    id: 'q10',
    label: 'TON INTELLIGENCE TACTIQUE',
    category: 'TACTIQUE',
    options: [
      { label: 'A', text: 'Je cours un peu partout sans réfléchir.', score: 1 },
      { label: 'B', text: 'Je reste à peu près à mon poste.', score: 2 },
      { label: 'C', text: 'Je compense les trous laissés par mes coéquipiers.', score: 3 },
      { label: 'D', text: 'Je dirige les autres et je gère les phases de transition.', score: 4 },
    ],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcEloBase(scoreTotal: number): number {
  return Math.max(600, Math.min(1500, Math.floor(600 + scoreTotal * 22.5)))
}

function getEloTier(elo: number): { label: string; color: string } {
  if (elo < 800) return { label: 'DÉBUTANT', color: '#9CA3AF' }
  if (elo < 1000) return { label: 'INTERMÉD.', color: '#60A5FA' }
  if (elo < 1200) return { label: 'CONFIRMÉ', color: '#AAFF00' }
  if (elo < 1400) return { label: 'EXPERT', color: '#FFB800' }
  return { label: 'ÉLITE', color: '#FF4444' }
}

const OPTION_COLORS = ['#9CA3AF', '#60A5FA', '#AAFF00', '#FFB800']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient() as any

  // step 0 = intro, 1-10 = questions, 11 = recap
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const totalQuestions = QUESTIONS.length
  const currentQuestion = step >= 1 && step <= totalQuestions ? QUESTIONS[step - 1] : null
  const scoreTotal = Object.values(answers).reduce((s, v) => s + v, 0)
  const eloBase = calcEloBase(scoreTotal)
  const tier = getEloTier(eloBase)

  const handleAnswer = (questionId: string, score: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: score }))
    setTimeout(() => setStep(s => s + 1), 180)
  }

  const handleSubmit = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Récupérer elo_gain actuel pour conserver les points de matchs
    const { data: profile } = await supabase
      .from('profiles')
      .select('elo_gain')
      .eq('id', user.id)
      .single()

    const currentGain = profile?.elo_gain ?? 0
    const newElo = eloBase + currentGain

    const { error } = await supabase
      .from('profiles')
      .update({
        elo_base: eloBase,
        elo: newElo,
        onboarding_completed: true,
        has_completed_v2_onboarding: true,
        v2_answers: answers,
      })
      .eq('id', user.id)

    if (error) {
      toast.error('Erreur lors de la sauvegarde')
      setLoading(false)
      return
    }

    toast.success(`ELO de base : ${eloBase} pts 🔥`)
    router.push('/home')
    router.refresh()
  }

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="min-h-dvh bg-[#080808] flex flex-col px-6 pt-12 pb-8">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--lime)' }}>
            <Zap className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg" style={{ color: 'var(--lime)' }}>GRINTA</span>
        </div>

        <div className="flex-1 animate-slide-up">
          <p className="font-display-light text-xs text-[#555] tracking-widest mb-3">ÉVALUATION V2</p>
          <h2 className="font-display text-5xl text-white leading-tight mb-4">
            QUI T'ES<br />
            <span style={{ color: 'var(--lime)' }}>VRAIMENT ?</span>
          </h2>

          {/* Warning */}
          <div className="mb-8 p-4 rounded-xl border"
            style={{ background: 'rgba(170,255,0,0.05)', borderColor: 'rgba(170,255,0,0.2)' }}>
            <p className="font-display text-sm text-white mb-1">⚠ SOIS HONNÊTE</p>
            <p className="text-sm leading-relaxed" style={{ color: '#AAA' }}>
              Sois honnête sur ton niveau <span className="text-white font-semibold">ACTUEL</span>.
              L'équilibre des matchs en dépend. Pas de fausse modestie, pas d'ego.
            </p>
          </div>

          <div className="space-y-3 mb-8">
            <div className="card-dark p-4">
              <p className="font-display text-sm text-white mb-1">10 QUESTIONS</p>
              <p className="text-xs text-[#555]">4 réponses possibles (A / B / C / D) — choisis celle qui te correspond le mieux.</p>
            </div>
            <div className="card-dark p-4">
              <p className="font-display text-sm text-white mb-1">ELO PERSONNALISÉ</p>
              <p className="text-xs text-[#555]">Ton ELO de base sera calculé sur ces réponses. Tes points de matchs sont conservés.</p>
            </div>
          </div>

          <button onClick={() => setStep(1)} className="btn-lime">
            COMMENCER →
          </button>
        </div>
      </div>
    )
  }

  // ── RECAP ──────────────────────────────────────────────────────────────────
  if (step === totalQuestions + 1) {
    return (
      <div className="min-h-dvh bg-[#080808] flex flex-col px-6 pt-12 pb-8">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--lime)' }}>
            <Zap className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg" style={{ color: 'var(--lime)' }}>GRINTA</span>
        </div>

        <div className="animate-slide-up">
          <h2 className="font-display text-4xl text-white leading-tight mb-2">
            TON<br />
            <span style={{ color: 'var(--lime)' }}>RÉSULTAT</span>
          </h2>
          <p className="text-[#888] text-sm mb-8">Voilà ce que tes réponses révèlent.</p>

          {/* ELO card */}
          <div className="mb-4 p-6 rounded-2xl text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(170,255,0,0.1), rgba(170,255,0,0.03))',
              border: '1px solid rgba(170,255,0,0.25)',
            }}>
            <p className="font-display-light text-xs text-[#888] tracking-widest mb-2">ELO DE BASE</p>
            <p className="font-display text-7xl" style={{ color: tier.color }}>{eloBase}</p>
            <div className="mt-2 inline-block px-3 py-1 rounded-full"
              style={{ background: `${tier.color}15`, border: `1px solid ${tier.color}40` }}>
              <p className="font-display text-sm" style={{ color: tier.color }}>{tier.label}</p>
            </div>
            <p className="text-xs text-[#555] mt-3">
              Score total : {scoreTotal}/40 · 600 + ({scoreTotal} × 22.5) = {eloBase}
            </p>
          </div>

          {/* Answers recap */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {QUESTIONS.map((q, i) => {
              const ans = answers[q.id]
              const option = q.options.find(o => o.score === ans)
              const color = OPTION_COLORS[ans - 1] ?? '#555'
              return (
                <div key={q.id} className="card-dark p-3">
                  <p className="text-xs text-[#444] mb-1 font-display-light tracking-wider">{i + 1}. {q.category}</p>
                  <p className="font-display text-lg" style={{ color }}>{option?.label ?? '?'}</p>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-[#555] text-center mb-6 leading-relaxed">
            Tu pourras refaire ce questionnaire depuis ton profil si tu estimes que ton niveau a évolué.
          </p>

          <button onClick={handleSubmit} disabled={loading} className="btn-lime">
            {loading ? 'SAUVEGARDE...' : 'ENTRER SUR LE TERRAIN →'}
          </button>
        </div>
      </div>
    )
  }

  // ── QUESTION ───────────────────────────────────────────────────────────────
  if (!currentQuestion) return null

  const progress = ((step - 1) / totalQuestions) * 100

  return (
    <div className="min-h-dvh bg-[#080808] flex flex-col px-6 pt-12 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--lime)' }}>
          <Zap className="w-4 h-4 text-black" strokeWidth={2.5} />
        </div>
        <span className="font-display text-lg" style={{ color: 'var(--lime)' }}>GRINTA</span>
      </div>

      {/* Progress */}
      <div className="space-y-1 mb-8">
        <div className="flex justify-between text-xs text-[#555]">
          <span className="font-display-light tracking-wider">QUESTION {step}/{totalQuestions}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'var(--lime)' }}
          />
        </div>
      </div>

      <div className="flex-1 animate-slide-up">
        {/* Category tag */}
        <p className="font-display-light text-xs tracking-widest mb-3" style={{ color: 'var(--lime)' }}>
          {currentQuestion.category}
        </p>

        {/* Question title */}
        <h2 className="font-display text-3xl text-white leading-tight mb-8">
          {currentQuestion.label}
        </h2>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, i) => {
            const color = OPTION_COLORS[i]
            const isSelected = answers[currentQuestion.id] === option.score
            return (
              <button
                key={option.label}
                onClick={() => handleAnswer(currentQuestion.id, option.score)}
                className="w-full text-left p-4 rounded-xl transition-all duration-150"
                style={{
                  background: isSelected ? `${color}15` : '#111',
                  border: `1.5px solid ${isSelected ? color : '#1E1E1E'}`,
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isSelected ? `${color}25` : '#1A1A1A',
                      border: `1px solid ${isSelected ? color : '#2A2A2A'}`,
                    }}
                  >
                    <span className="font-display text-sm" style={{ color: isSelected ? color : '#555' }}>
                      {option.label}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed pt-1" style={{ color: isSelected ? '#FFF' : '#888' }}>
                    {option.text}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Back nav */}
        {step > 1 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="mt-6 text-xs text-[#444] hover:text-[#666] transition-colors"
          >
            ← Question précédente
          </button>
        )}
      </div>
    </div>
  )
}
