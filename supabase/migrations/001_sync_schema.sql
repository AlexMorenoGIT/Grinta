-- ============================================================
-- Migration 001: Synchronisation schema.sql avec la prod
-- ============================================================

-- ── Colonnes manquantes sur profiles ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS v2_answers jsonb DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wero_phone text DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rib text DEFAULT NULL;

-- ── Colonnes manquantes sur matches ──
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS duration_seconds int DEFAULT NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS price_total numeric DEFAULT NULL;

-- ── Colonne manquante sur match_players ──
ALTER TABLE public.match_players ADD COLUMN IF NOT EXISTS has_paid boolean NOT NULL DEFAULT false;

-- ── Table match_goals ──
CREATE TABLE IF NOT EXISTS public.match_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  scorer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assist_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  team text NOT NULL CHECK (team IN ('A', 'B')),
  minute int NOT NULL,
  goal_order int NOT NULL,
  is_own_goal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_goals_match ON public.match_goals(match_id);
CREATE INDEX IF NOT EXISTS idx_match_goals_scorer ON public.match_goals(scorer_id);

ALTER TABLE public.match_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les buts sont visibles par tous"
  ON public.match_goals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Le créateur du match peut gérer les buts"
  ON public.match_goals FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND m.created_by = auth.uid()
    )
  );

-- ── RPC increment_own_goals ──
CREATE OR REPLACE FUNCTION public.increment_own_goals(player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET own_goals = own_goals + 1
  WHERE id = player_id;
END;
$$;

-- ── Table match_challenges ──
CREATE TABLE IF NOT EXISTS public.match_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  challenge_type text NOT NULL CHECK (challenge_type IN (
    'specialist', 'altruiste', 'verrou', 'binome', 'renard',
    'soldat', 'clutch', 'insubmersible', 'proprete', 'pivot'
  )),
  target_player_id uuid REFERENCES public.profiles(id),
  is_completed boolean DEFAULT false,
  is_self_reported boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_challenges_match ON public.match_challenges(match_id);
CREATE INDEX IF NOT EXISTS idx_match_challenges_player ON public.match_challenges(player_id);

ALTER TABLE public.match_challenges ENABLE ROW LEVEL SECURITY;

-- Chaque joueur ne voit que son propre défi jusqu'à la fin du match
CREATE POLICY "Joueur voit son propre défi"
  ON public.match_challenges FOR SELECT TO authenticated
  USING (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND m.status = 'completed'
    )
  );

CREATE POLICY "Le système peut créer des défis"
  ON public.match_challenges FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND m.created_by = auth.uid()
    )
  );

CREATE POLICY "Le système peut mettre à jour les défis"
  ON public.match_challenges FOR UPDATE TO authenticated
  USING (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND m.created_by = auth.uid()
    )
  );

-- ── Table player_badges ──
CREATE TABLE IF NOT EXISTS public.player_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  badge_type text NOT NULL,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  earned_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_badges_player ON public.player_badges(player_id);

ALTER TABLE public.player_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les badges sont visibles par tous"
  ON public.player_badges FOR SELECT TO authenticated USING (true);

CREATE POLICY "Le système peut créer des badges"
  ON public.player_badges FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── Modifier update_player_elo_after_match pour écrire elo_gain ──
CREATE OR REPLACE FUNCTION public.update_player_elo_after_match(
  p_match_id uuid,
  p_player_id uuid,
  p_won boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current_elo int;
  v_avg_rating numeric;
  v_result_points int;
  v_rating_points int;
  v_total_delta int;
  v_new_elo int;
BEGIN
  SELECT elo INTO v_current_elo
  FROM public.profiles
  WHERE id = p_player_id;

  SELECT avg(score) INTO v_avg_rating
  FROM public.ratings
  WHERE match_id = p_match_id
    AND rated_player_id = p_player_id;

  IF p_won THEN
    v_result_points := 25;
  ELSE
    v_result_points := -20;
  END IF;

  IF v_avg_rating IS NOT NULL THEN
    v_rating_points := round((v_avg_rating - 5.5) * 8)::int;
  ELSE
    v_rating_points := 0;
  END IF;

  v_total_delta := v_result_points + v_rating_points;
  v_new_elo := greatest(100, v_current_elo + v_total_delta);

  UPDATE public.profiles
  SET
    elo = v_new_elo,
    elo_gain = elo_gain + v_total_delta,
    matches_played = matches_played + 1,
    wins = wins + (CASE WHEN p_won THEN 1 ELSE 0 END),
    losses = losses + (CASE WHEN NOT p_won THEN 1 ELSE 0 END)
  WHERE id = p_player_id;

  -- Mise à jour avg_rating global
  UPDATE public.profiles
  SET avg_rating = (
    SELECT avg(score)
    FROM public.ratings r
    WHERE r.rated_player_id = p_player_id
  )
  WHERE id = p_player_id;

  INSERT INTO public.elo_history (player_id, match_id, elo_before, elo_after, delta, reason)
  VALUES (
    p_player_id,
    p_match_id,
    v_current_elo,
    v_new_elo,
    v_total_delta,
    CASE WHEN p_won THEN 'Victoire' ELSE 'Défaite' END ||
    ' | Note: ' || coalesce(v_avg_rating::text, 'N/A') ||
    ' | Total: ' || v_total_delta::text || 'pts'
  );
END;
$$;

-- ── Activer Realtime sur matches et match_goals ──
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_goals;
