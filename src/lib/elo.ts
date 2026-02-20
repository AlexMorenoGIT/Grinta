/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'

/**
 * Finalise le résultat d'un match :
 * 1. Récupère le match (score)
 * 2. Récupère tous les match_players avec leur team
 * 3. Appelle update_player_elo_after_match pour chaque joueur
 * 4. Appelle award_mvp_bonus
 * 5. Vérifie les défis accomplis → +5 ELO bonus
 */
export async function finalizeMatchResult(matchId: string) {
  const supabase = createClient() as any

  // 1. Récupérer le match
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('score_equipe_a, score_equipe_b, status')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    throw new Error('Match introuvable: ' + matchError?.message)
  }

  const { score_equipe_a, score_equipe_b } = match

  if (score_equipe_a === null || score_equipe_b === null) {
    throw new Error('Scores non définis')
  }

  // Déterminer le résultat
  const isDraw = score_equipe_a === score_equipe_b

  // 2. Récupérer tous les joueurs du match
  const { data: players, error: playersError } = await supabase
    .from('match_players')
    .select('player_id, team')
    .eq('match_id', matchId)

  if (playersError || !players) {
    throw new Error('Joueurs introuvables: ' + playersError?.message)
  }

  // 3. Pour chaque joueur, calculer s'il a gagné et appeler la RPC
  for (const player of players) {
    if (!player.team) continue // Skip joueurs sans équipe

    let won: boolean
    if (isDraw) {
      // Pour un match nul, on considère que personne n'a "gagné"
      // La RPC ne gère pas le draw explicitement, on passe false
      // et on incrémente draws manuellement
      won = false

      // Incrémenter draws au lieu de losses pour les nuls
      await supabase
        .from('profiles')
        .update({ draws: supabase.rpc ? undefined : 0 }) // placeholder
        .eq('id', player.player_id)

      // On va gérer le draw autrement: on appelle la RPC avec won=false
      // puis on corrige: -1 loss, +1 draw
      await supabase.rpc('update_player_elo_after_match', {
        p_match_id: matchId,
        p_player_id: player.player_id,
        p_won: false,
      })

      // Corriger: la RPC a ajouté +1 loss, on veut +1 draw à la place
      await supabase.rpc('increment_draws_fix', { p_player_id: player.player_id })
        .then(() => {})
        .catch(() => {
          // Si la RPC n'existe pas, faire la correction manuellement
          // losses -1, draws +1
        })

      // Correction manuelle si RPC inexistante
      const { data: profile } = await supabase
        .from('profiles')
        .select('losses, draws')
        .eq('id', player.player_id)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            losses: Math.max(0, profile.losses - 1),
            draws: profile.draws + 1,
          })
          .eq('id', player.player_id)
      }
    } else {
      won = (player.team === 'A' && score_equipe_a > score_equipe_b) ||
            (player.team === 'B' && score_equipe_b > score_equipe_a)

      await supabase.rpc('update_player_elo_after_match', {
        p_match_id: matchId,
        p_player_id: player.player_id,
        p_won: won,
      })
    }
  }

  // 4. Bonus MVP
  await supabase.rpc('award_mvp_bonus', { p_match_id: matchId })

  // 5. Vérifier les défis accomplis
  await checkChallenges(matchId)
}

/**
 * Vérifie et complète les défis d'un match
 */
async function checkChallenges(matchId: string) {
  const supabase = createClient() as any

  // Récupérer les défis du match
  const { data: challenges } = await supabase
    .from('match_challenges')
    .select('*')
    .eq('match_id', matchId)
    .eq('is_completed', false)

  if (!challenges || challenges.length === 0) return

  // Récupérer les goals du match
  const { data: goals } = await supabase
    .from('match_goals')
    .select('*')
    .eq('match_id', matchId)
    .order('goal_order')

  // Récupérer le match
  const { data: match } = await supabase
    .from('matches')
    .select('score_equipe_a, score_equipe_b, duration_seconds')
    .eq('id', matchId)
    .single()

  // Récupérer les match_players
  const { data: matchPlayers } = await supabase
    .from('match_players')
    .select('player_id, team')
    .eq('match_id', matchId)

  // Récupérer les ratings
  const { data: ratings } = await supabase
    .from('ratings')
    .select('rated_player_id, score')
    .eq('match_id', matchId)

  if (!goals || !match || !matchPlayers) return

  const scoreA = match.score_equipe_a ?? 0
  const scoreB = match.score_equipe_b ?? 0
  const duration = match.duration_seconds ?? 0

  for (const challenge of challenges) {
    const playerId = challenge.player_id
    const playerTeam = matchPlayers.find((mp: any) => mp.player_id === playerId)?.team
    if (!playerTeam) continue

    let completed = false

    switch (challenge.challenge_type) {
      case 'altruiste': {
        // 2+ passes décisives
        const assists = (goals || []).filter((g: any) => g.assist_id === playerId && !g.is_own_goal)
        completed = assists.length >= 2
        break
      }
      case 'renard': {
        // 3+ buts
        const playerGoals = (goals || []).filter((g: any) => g.scorer_id === playerId && !g.is_own_goal)
        completed = playerGoals.length >= 3
        break
      }
      case 'pivot': {
        // 1+ PD ET 1+ but
        const pGoals = (goals || []).filter((g: any) => g.scorer_id === playerId && !g.is_own_goal)
        const pAssists = (goals || []).filter((g: any) => g.assist_id === playerId && !g.is_own_goal)
        completed = pGoals.length >= 1 && pAssists.length >= 1
        break
      }
      case 'clutch': {
        // Marquer le dernier but
        if (goals && goals.length > 0) {
          const lastGoal = goals[goals.length - 1]
          completed = lastGoal.scorer_id === playerId && !lastGoal.is_own_goal
        }
        break
      }
      case 'soldat': {
        // Note moyenne > 8/10
        if (ratings) {
          const playerRatings = ratings.filter((r: any) => r.rated_player_id === playerId)
          if (playerRatings.length > 0) {
            const avg = playerRatings.reduce((sum: number, r: any) => sum + r.score, 0) / playerRatings.length
            completed = avg > 8
          }
        }
        break
      }
      case 'verrou': {
        // 0 but encaissé les 15 premières minutes (900 secondes)
        const oppositeTeam = playerTeam === 'A' ? 'B' : 'A'
        // Buts de l'équipe adverse dans les 15 premières minutes (= buts encaissés)
        // Note: dans match_goals, "team" = l'équipe qui MARQUE
        // Donc les buts encaissés par l'équipe du joueur = buts marqués par l'autre équipe
        // MAIS il faut aussi compter les CSC de l'équipe du joueur (car team = équipe bénéficiaire)
        const earlyOpponentGoals = (goals || []).filter((g: any) =>
          g.team === oppositeTeam && g.minute <= 900
        )
        // Un CSC de l'équipe du joueur donne un but à l'adversaire
        // En fait, dans le modèle, team = l'équipe qui bénéficie du but
        // Donc si team === team adverse dans les 15 premières min = but encaissé
        // Mais on veut les buts subis par l'ÉQUIPE du joueur = buts où team = équipe adverse... non
        // team dans match_goals = l'équipe qui marque/bénéficie
        // Buts encaissés par l'équipe du joueur = buts où team = équipe adverse
        const concededEarly = (goals || []).filter((g: any) => {
          // But encaissé par l'équipe du joueur = but marqué PAR l'autre équipe
          // team = équipe bénéficiaire du but
          // Si le joueur est en team A, les buts encaissés = buts où team = 'B' (l'adversaire marque)
          // Mais attention: un CSC de l'équipe A donne team = 'B' aussi
          return g.team !== playerTeam && g.minute <= 900
        })
        completed = concededEarly.length === 0
        break
      }
      case 'proprete': {
        // 0 but encaissé dans les 5 dernières minutes + 0 CSC du joueur
        if (duration > 0) {
          const last5min = duration - 300
          const lateGoals = (goals || []).filter((g: any) =>
            g.team !== playerTeam && g.minute >= last5min
          )
          const playerCsc = (goals || []).filter((g: any) =>
            g.is_own_goal && g.scorer_id === playerId
          )
          completed = lateGoals.length === 0 && playerCsc.length === 0
        }
        break
      }
      case 'binome': {
        // PD à un coéquipier spécifique (target_player_id)
        if (challenge.target_player_id) {
          const binomeAssists = (goals || []).filter((g: any) =>
            g.assist_id === playerId && g.scorer_id === challenge.target_player_id && !g.is_own_goal
          )
          completed = binomeAssists.length >= 1
        }
        break
      }
      case 'insubmersible': {
        // Gagner après avoir été mené de 3+ buts
        const won = (playerTeam === 'A' && scoreA > scoreB) ||
                    (playerTeam === 'B' && scoreB > scoreA)
        if (won && goals) {
          let runA = 0, runB = 0, maxDeficit = 0
          for (const g of goals) {
            if (g.team === 'A') runA++; else runB++
            if (playerTeam === 'A') {
              if (runB > runA) maxDeficit = Math.max(maxDeficit, runB - runA)
            } else {
              if (runA > runB) maxDeficit = Math.max(maxDeficit, runA - runB)
            }
          }
          completed = maxDeficit >= 3
        }
        break
      }
      case 'specialist': {
        // Self-report — ne pas vérifier automatiquement
        break
      }
    }

    if (completed) {
      // Marquer le défi comme complété
      await supabase
        .from('match_challenges')
        .update({ is_completed: true })
        .eq('id', challenge.id)

      // +5 ELO bonus
      const { data: profile } = await supabase
        .from('profiles')
        .select('elo')
        .eq('id', playerId)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            elo: profile.elo + 5,
            elo_gain: supabase.raw ? undefined : profile.elo + 5, // handled below
          })
          .eq('id', playerId)

        // Update elo and elo_gain
        await supabase.rpc('add_challenge_bonus', { p_player_id: playerId }).catch(() => {
          // If RPC doesn't exist, do it manually
        })

        // Manual update
        await supabase
          .from('profiles')
          .update({ elo: profile.elo + 5 })
          .eq('id', playerId)

        // Ajouter un badge
        await supabase.from('player_badges').insert({
          player_id: playerId,
          badge_type: `challenge_${challenge.challenge_type}`,
          match_id: matchId,
        })

        // Historique ELO
        await supabase.from('elo_history').insert({
          player_id: playerId,
          match_id: matchId,
          elo_before: profile.elo,
          elo_after: profile.elo + 5,
          delta: 5,
          reason: `Défi complété: ${challenge.challenge_type} ⚡`,
        })
      }
    }
  }
}

/**
 * Annule le calcul ELO d'un match (pour reset admin)
 */
export async function reverseMatchElo(matchId: string) {
  const supabase = createClient() as any

  // 1. Fetch elo_history (may be empty — that's OK)
  const { data: history } = await supabase
    .from('elo_history')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at')

  // 2. Reverse ELO only if history exists
  if (history && history.length > 0) {
    // Fetch match to detect draws
    const { data: matchData } = await supabase
      .from('matches')
      .select('score_equipe_a, score_equipe_b')
      .eq('id', matchId)
      .single()
    const isDraw = matchData &&
      matchData.score_equipe_a !== null &&
      matchData.score_equipe_a === matchData.score_equipe_b

    for (const entry of history) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('elo, elo_gain, matches_played, wins, losses, draws, mvp_count')
        .eq('id', entry.player_id)
        .single()

      if (!profile) continue

      const updates: any = {
        elo: Math.max(100, profile.elo - entry.delta),
        elo_gain: profile.elo_gain - entry.delta,
      }

      if (entry.reason.startsWith('Victoire')) {
        updates.matches_played = Math.max(0, profile.matches_played - 1)
        updates.wins = Math.max(0, profile.wins - 1)
      } else if (entry.reason.startsWith('Défaite')) {
        updates.matches_played = Math.max(0, profile.matches_played - 1)
        if (isDraw) {
          // Draw was recorded as "Défaite" by the RPC but corrected to draws
          updates.draws = Math.max(0, profile.draws - 1)
        } else {
          updates.losses = Math.max(0, profile.losses - 1)
        }
      } else if (entry.reason.includes('MVP')) {
        updates.mvp_count = Math.max(0, profile.mvp_count - 1)
      }
      // Challenge bonuses: only ELO is reversed

      await supabase.from('profiles').update(updates).eq('id', entry.player_id)
    }

    // 3. Delete elo_history
    await supabase.from('elo_history').delete().eq('match_id', matchId)
  }

  // 4. Always delete match result data
  await supabase.from('ratings').delete().eq('match_id', matchId)
  await supabase.from('mvp_votes').delete().eq('match_id', matchId)
  await supabase.from('match_goals').delete().eq('match_id', matchId)
  await supabase.from('match_challenges').delete().eq('match_id', matchId)

  // 5. Always reset match status — this MUST run regardless of ELO history
  await supabase
    .from('matches')
    .update({
      score_equipe_a: null,
      score_equipe_b: null,
      status: 'upcoming',
      duration_seconds: null,
    })
    .eq('id', matchId)
}
