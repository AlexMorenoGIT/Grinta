/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'

const CHALLENGE_TYPES = [
  'specialist',
  'altruiste',
  'verrou',
  'renard',
  'soldat',
  'clutch',
  'insubmersible',
  'proprete',
  'pivot',
] as const

const BINOME_TYPE = 'binome' as const

/**
 * Assigne un défi aléatoire à chaque joueur d'un match.
 * - "binome" nécessite un coéquipier → target_player_id
 * - Les autres sont indépendants
 * - Évite de donner le même défi à tous
 */
export async function assignChallenges(matchId: string) {
  const supabase = createClient() as any

  // Vérifier s'il y a déjà des défis assignés
  const { data: existing } = await supabase
    .from('match_challenges')
    .select('id')
    .eq('match_id', matchId)
    .limit(1)

  if (existing && existing.length > 0) return // Déjà assignés

  // Récupérer les joueurs du match
  const { data: players } = await supabase
    .from('match_players')
    .select('player_id, team')
    .eq('match_id', matchId)

  if (!players || players.length === 0) return

  const teamA = players.filter((p: any) => p.team === 'A')
  const teamB = players.filter((p: any) => p.team === 'B')

  // Mélanger les types de défi disponibles
  const shuffled = [...CHALLENGE_TYPES].sort(() => Math.random() - 0.5)

  const challenges: any[] = []

  for (let i = 0; i < players.length; i++) {
    const player = players[i]
    const teammates = player.team === 'A'
      ? teamA.filter((p: any) => p.player_id !== player.player_id)
      : teamB.filter((p: any) => p.player_id !== player.player_id)

    // Décider si on donne un défi "binome" (1 chance sur 4, si coéquipiers dispo)
    const giveBinome = teammates.length > 0 && Math.random() < 0.25

    if (giveBinome) {
      const target = teammates[Math.floor(Math.random() * teammates.length)]
      challenges.push({
        match_id: matchId,
        player_id: player.player_id,
        challenge_type: BINOME_TYPE,
        target_player_id: target.player_id,
      })
    } else {
      // Prendre un défi du pool mélangé (avec rotation)
      const challengeType = shuffled[i % shuffled.length]
      challenges.push({
        match_id: matchId,
        player_id: player.player_id,
        challenge_type: challengeType,
      })
    }
  }

  await supabase.from('match_challenges').insert(challenges)
}

/**
 * Descriptions lisibles des défis
 */
export const CHALLENGE_DESCRIPTIONS: Record<string, { title: string; desc: string; icon: string }> = {
  specialist: { title: 'Le Spécialiste', desc: 'Marquer un but du mauvais pied', icon: '🦶' },
  altruiste: { title: "L'Altruiste", desc: '2+ passes décisives', icon: '🤝' },
  verrou: { title: 'Le Verrou', desc: '0 but encaissé les 15 premières min', icon: '🔒' },
  binome: { title: 'Le Binôme', desc: 'Faire une PD à un coéquipier spécifique', icon: '🔗' },
  renard: { title: 'Le Renard', desc: '3+ buts dans le match', icon: '🦊' },
  soldat: { title: 'Le Soldat', desc: 'Note moyenne > 8/10', icon: '⭐' },
  clutch: { title: 'Le Clutch', desc: 'Marquer le dernier but du match', icon: '🎯' },
  insubmersible: { title: "L'Insubmersible", desc: 'Gagner après avoir été mené de 3+ buts', icon: '🚢' },
  proprete: { title: 'La Propreté', desc: '0 but encaissé les 5 dernières min + 0 CSC', icon: '🧹' },
  pivot: { title: 'Le Pivot', desc: '1+ but ET 1+ passe décisive', icon: '🔄' },
}
