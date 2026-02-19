export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string
          last_name: string
          username: string | null
          avatar_url: string | null
          elo: number
          elo_base: number
          elo_gain: number
          technique_score: number | null
          physique_score: number | null
          tactique_score: number | null
          mvp_count: number
          matches_played: number
          wins: number
          losses: number
          draws: number
          own_goals: number
          avg_rating: number | null
          onboarding_completed: boolean
          has_completed_v2_onboarding: boolean
          v2_answers: Record<string, number> | null
          is_admin: boolean
          wero_phone: string | null
          rib: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name: string
          last_name: string
          username?: string | null
          avatar_url?: string | null
          elo?: number
          elo_base?: number
          elo_gain?: number
          technique_score?: number | null
          physique_score?: number | null
          tactique_score?: number | null
          mvp_count?: number
          matches_played?: number
          wins?: number
          losses?: number
          draws?: number
          own_goals?: number
          avg_rating?: number | null
          onboarding_completed?: boolean
          has_completed_v2_onboarding?: boolean
          v2_answers?: Record<string, number> | null
          is_admin?: boolean
          wero_phone?: string | null
          rib?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          first_name?: string
          last_name?: string
          username?: string | null
          avatar_url?: string | null
          elo?: number
          elo_base?: number
          elo_gain?: number
          technique_score?: number | null
          physique_score?: number | null
          tactique_score?: number | null
          mvp_count?: number
          matches_played?: number
          wins?: number
          losses?: number
          draws?: number
          own_goals?: number
          avg_rating?: number | null
          onboarding_completed?: boolean
          has_completed_v2_onboarding?: boolean
          v2_answers?: Record<string, number> | null
          is_admin?: boolean
          wero_phone?: string | null
          rib?: string | null
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          title: string
          lieu: string
          date: string
          heure: string
          google_maps_url: string | null
          max_players: number
          status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
          score_equipe_a: number | null
          score_equipe_b: number | null
          duration_seconds: number | null
          created_by: string | null
          notes: string | null
          price_total: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          lieu: string
          date: string
          heure: string
          google_maps_url?: string | null
          max_players?: number
          status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
          score_equipe_a?: number | null
          score_equipe_b?: number | null
          created_by?: string | null
          notes?: string | null
          price_total?: number | null
        }
        Update: {
          title?: string
          lieu?: string
          date?: string
          heure?: string
          google_maps_url?: string | null
          max_players?: number
          status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
          score_equipe_a?: number | null
          score_equipe_b?: number | null
          notes?: string | null
          price_total?: number | null
        }
      }
      match_players: {
        Row: {
          id: string
          match_id: string
          player_id: string
          team: 'A' | 'B' | null
          has_paid: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          match_id: string
          player_id: string
          team?: 'A' | 'B' | null
          has_paid?: boolean
          joined_at?: string
        }
        Update: {
          team?: 'A' | 'B' | null
          has_paid?: boolean
        }
      }
      compositions: {
        Row: {
          id: string
          match_id: string
          variant: 1 | 2 | 3
          team_a_players: string[]
          team_b_players: string[]
          elo_team_a: number | null
          elo_team_b: number | null
          balance_score: number | null
          is_applied: boolean
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          variant: 1 | 2 | 3
          team_a_players: string[]
          team_b_players: string[]
          elo_team_a?: number | null
          elo_team_b?: number | null
          balance_score?: number | null
          is_applied?: boolean
        }
        Update: {
          is_applied?: boolean
        }
      }
      ratings: {
        Row: {
          id: string
          match_id: string
          rated_player_id: string
          rater_id: string
          score: number
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          rated_player_id: string
          rater_id: string
          score: number
        }
        Update: {
          score?: number
        }
      }
      mvp_votes: {
        Row: {
          id: string
          match_id: string
          voted_player_id: string
          voter_id: string
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          voted_player_id: string
          voter_id: string
        }
        Update: Record<string, never>
      }
      match_goals: {
        Row: {
          id: string
          match_id: string
          scorer_id: string | null
          assist_id: string | null
          team: 'A' | 'B'
          minute: number
          goal_order: number
          is_own_goal: boolean
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          scorer_id?: string | null
          assist_id?: string | null
          team: 'A' | 'B'
          minute: number
          goal_order: number
          is_own_goal?: boolean
        }
        Update: Record<string, never>
      }
      elo_history: {
        Row: {
          id: string
          player_id: string
          match_id: string | null
          elo_before: number
          elo_after: number
          delta: number
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          match_id?: string | null
          elo_before: number
          elo_after: number
          delta: number
          reason: string
        }
        Update: Record<string, never>
      }
    }
    Views: Record<string, never>
    Functions: {
      calculate_initial_elo: {
        Args: { p_technique: number; p_physique: number; p_tactique: number }
        Returns: number
      }
      generate_compositions: {
        Args: { p_match_id: string }
        Returns: void
      }
      update_player_elo_after_match: {
        Args: { p_match_id: string; p_player_id: string; p_won: boolean }
        Returns: void
      }
      award_mvp_bonus: {
        Args: { p_match_id: string }
        Returns: void
      }
    }
    Enums: Record<string, never>
  }
}

// Helpers
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type MatchPlayer = Database['public']['Tables']['match_players']['Row']
export type Composition = Database['public']['Tables']['compositions']['Row']
export type Rating = Database['public']['Tables']['ratings']['Row']
export type MvpVote = Database['public']['Tables']['mvp_votes']['Row']
export type EloHistory = Database['public']['Tables']['elo_history']['Row']
export type MatchGoal = Database['public']['Tables']['match_goals']['Row']

export type MatchWithPlayers = Match & {
  match_players: (MatchPlayer & { profiles: Profile })[]
  creator?: Profile
}

export type ProfileWithStats = Profile & {
  elo_history: EloHistory[]
}
