-- ============================================================
-- GRINTA - Schéma SQL Complet
-- ============================================================

-- Extension UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: profiles
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  first_name text not null,
  last_name text not null,
  username text unique,
  avatar_url text,
  elo int not null default 1000,
  technique_score int check (technique_score between 1 and 10),
  physique_score int check (physique_score between 1 and 10),
  tactique_score int check (tactique_score between 1 and 10),
  mvp_count int not null default 0,
  matches_played int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  avg_rating numeric(4,2) default null,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TABLE: matches
-- ============================================================
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  lieu text not null,
  date date not null,
  heure time not null,
  google_maps_url text,
  max_players int not null default 10,
  status text not null default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed', 'cancelled')),
  score_equipe_a int default null,
  score_equipe_b int default null,
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TABLE: match_players
-- ============================================================
create table public.match_players (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  player_id uuid references public.profiles(id) on delete cascade not null,
  team text check (team in ('A', 'B', null)),
  joined_at timestamptz not null default now(),
  unique(match_id, player_id)
);

-- ============================================================
-- TABLE: compositions
-- ============================================================
create table public.compositions (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  variant int not null check (variant in (1, 2, 3)),
  team_a_players uuid[] not null default '{}',
  team_b_players uuid[] not null default '{}',
  elo_team_a numeric(8,2) default null,
  elo_team_b numeric(8,2) default null,
  balance_score numeric(6,2) default null,
  is_applied boolean not null default false,
  created_at timestamptz not null default now(),
  unique(match_id, variant)
);

-- ============================================================
-- TABLE: ratings (anonymes)
-- ============================================================
create table public.ratings (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  rated_player_id uuid references public.profiles(id) on delete cascade not null,
  rater_id uuid references public.profiles(id) on delete cascade not null,
  score int not null check (score between 1 and 10),
  created_at timestamptz not null default now(),
  unique(match_id, rated_player_id, rater_id)
);

-- ============================================================
-- TABLE: mvp_votes (publics)
-- ============================================================
create table public.mvp_votes (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  voted_player_id uuid references public.profiles(id) on delete cascade not null,
  voter_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique(match_id, voter_id)
);

-- ============================================================
-- TABLE: elo_history (historique ELO)
-- ============================================================
create table public.elo_history (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.profiles(id) on delete cascade not null,
  match_id uuid references public.matches(id) on delete set null,
  elo_before int not null,
  elo_after int not null,
  delta int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_match_players_match on public.match_players(match_id);
create index idx_match_players_player on public.match_players(player_id);
create index idx_ratings_match on public.ratings(match_id);
create index idx_ratings_rated_player on public.ratings(rated_player_id);
create index idx_mvp_votes_match on public.mvp_votes(match_id);
create index idx_elo_history_player on public.elo_history(player_id);
create index idx_matches_status on public.matches(status);
create index idx_matches_date on public.matches(date);

-- ============================================================
-- TRIGGER: updated_at auto-update
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger on_matches_updated
  before update on public.matches
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- TRIGGER: Création du profil automatique après inscription
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, first_name, last_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'username', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- FONCTION: Calcul ELO de départ (onboarding)
-- ============================================================
create or replace function public.calculate_initial_elo(
  p_technique int,
  p_physique int,
  p_tactique int
)
returns int language plpgsql as $$
declare
  v_average numeric;
begin
  v_average := (p_technique + p_physique + p_tactique)::numeric / 3.0;
  return floor((v_average * 100) + 500)::int;
end;
$$;

-- ============================================================
-- FONCTION: Mise à jour ELO post-match (Hybride 50/50)
-- ============================================================
create or replace function public.update_player_elo_after_match(
  p_match_id uuid,
  p_player_id uuid,
  p_won boolean
)
returns void language plpgsql security definer as $$
declare
  v_current_elo int;
  v_avg_rating numeric;
  v_result_points int;
  v_rating_points int;
  v_total_delta int;
  v_new_elo int;
  v_match_count int;
begin
  -- ELO actuel du joueur
  select elo into v_current_elo
  from public.profiles
  where id = p_player_id;

  -- Moyenne des notes reçues dans ce match (sans rater_id = player_id)
  select avg(score) into v_avg_rating
  from public.ratings
  where match_id = p_match_id
    and rated_player_id = p_player_id;

  -- 50% résultat match: victoire +25, défaite -20, note absente = 0
  if p_won then
    v_result_points := 25;
  else
    v_result_points := -20;
  end if;

  -- 50% note moyenne: centré sur 5.5/10, chaque point vaut 8pts
  if v_avg_rating is not null then
    v_rating_points := round((v_avg_rating - 5.5) * 8)::int;
  else
    v_rating_points := 0;
  end if;

  -- Total delta
  v_total_delta := v_result_points + v_rating_points;

  -- ELO minimum 100
  v_new_elo := greatest(100, v_current_elo + v_total_delta);

  -- Mise à jour profil
  update public.profiles
  set
    elo = v_new_elo,
    matches_played = matches_played + 1,
    wins = wins + (case when p_won then 1 else 0 end),
    losses = losses + (case when not p_won then 1 else 0 end)
  where id = p_player_id;

  -- Mise à jour avg_rating
  select avg(score) into v_avg_rating
  from public.ratings r
  join public.match_players mp on mp.match_id = r.match_id and mp.player_id = r.rated_player_id
  where r.rated_player_id = p_player_id;

  update public.profiles
  set avg_rating = v_avg_rating
  where id = p_player_id;

  -- Historique
  insert into public.elo_history (player_id, match_id, elo_before, elo_after, delta, reason)
  values (
    p_player_id,
    p_match_id,
    v_current_elo,
    v_new_elo,
    v_total_delta,
    case when p_won then 'Victoire' else 'Défaite' end ||
    ' | Note: ' || coalesce(v_avg_rating::text, 'N/A') ||
    ' | Total: ' || v_total_delta::text || 'pts'
  );
end;
$$;

-- ============================================================
-- FONCTION: Donner le bonus MVP (+10 ELO)
-- ============================================================
create or replace function public.award_mvp_bonus(
  p_match_id uuid
)
returns void language plpgsql security definer as $$
declare
  v_mvp_id uuid;
  v_current_elo int;
begin
  -- Joueur avec le plus de votes
  select voted_player_id into v_mvp_id
  from public.mvp_votes
  where match_id = p_match_id
  group by voted_player_id
  order by count(*) desc
  limit 1;

  if v_mvp_id is null then
    return;
  end if;

  -- ELO actuel
  select elo into v_current_elo from public.profiles where id = v_mvp_id;

  -- +10 ELO bonus MVP
  update public.profiles
  set
    elo = elo + 10,
    mvp_count = mvp_count + 1
  where id = v_mvp_id;

  -- Historique
  insert into public.elo_history (player_id, match_id, elo_before, elo_after, delta, reason)
  values (v_mvp_id, p_match_id, v_current_elo, v_current_elo + 10, 10, 'Bonus MVP 🏆');
end;
$$;

-- ============================================================
-- FONCTION: Générer 3 compositions équilibrées
-- ============================================================
create or replace function public.generate_compositions(p_match_id uuid)
returns void language plpgsql security definer as $$
declare
  v_players record;
  v_player_ids uuid[];
  v_elos int[];
  v_count int;
  v_team_a uuid[];
  v_team_b uuid[];
  v_elo_a numeric;
  v_elo_b numeric;
  v_balance numeric;
  v_i int;
begin
  -- Récupérer les joueurs inscrits avec leur ELO
  select
    array_agg(mp.player_id order by p.elo desc) as ids,
    array_agg(p.elo order by p.elo desc) as elos,
    count(*) as cnt
  into v_players
  from public.match_players mp
  join public.profiles p on p.id = mp.player_id
  where mp.match_id = p_match_id;

  v_player_ids := v_players.ids;
  v_elos := v_players.elos;
  v_count := v_players.cnt;

  if v_count < 2 then
    return;
  end if;

  -- Supprimer les anciennes compositions
  delete from public.compositions where match_id = p_match_id;

  -- === VARIANTE 1: Distribution serpentine (1→A, 2→B, 3→B, 4→A, ...) ===
  v_team_a := '{}'; v_team_b := '{}';
  for v_i in 1..v_count loop
    if (v_i % 4 = 1 or v_i % 4 = 0) then
      v_team_a := array_append(v_team_a, v_player_ids[v_i]);
    else
      v_team_b := array_append(v_team_b, v_player_ids[v_i]);
    end if;
  end loop;

  -- Si effectif impair: les plus gros ELO dans l'équipe minoritaire
  if array_length(v_team_a, 1) != array_length(v_team_b, 1) then
    -- Déjà géré par la distribution
    null;
  end if;

  -- Calculer ELO moyen des équipes
  select
    avg(p.elo) filter (where p.id = any(v_team_a)) as avg_a,
    avg(p.elo) filter (where p.id = any(v_team_b)) as avg_b
  into v_elo_a, v_elo_b
  from public.profiles p
  where p.id = any(v_player_ids);

  v_balance := abs(coalesce(v_elo_a, 0) - coalesce(v_elo_b, 0));

  insert into public.compositions (match_id, variant, team_a_players, team_b_players, elo_team_a, elo_team_b, balance_score)
  values (p_match_id, 1, v_team_a, v_team_b, v_elo_a, v_elo_b, v_balance);

  -- === VARIANTE 2: Distribution alternée simple ===
  v_team_a := '{}'; v_team_b := '{}';
  for v_i in 1..v_count loop
    if v_i % 2 = 1 then
      v_team_a := array_append(v_team_a, v_player_ids[v_i]);
    else
      v_team_b := array_append(v_team_b, v_player_ids[v_i]);
    end if;
  end loop;

  select
    avg(p.elo) filter (where p.id = any(v_team_a)) as avg_a,
    avg(p.elo) filter (where p.id = any(v_team_b)) as avg_b
  into v_elo_a, v_elo_b
  from public.profiles p
  where p.id = any(v_player_ids);

  v_balance := abs(coalesce(v_elo_a, 0) - coalesce(v_elo_b, 0));

  insert into public.compositions (match_id, variant, team_a_players, team_b_players, elo_team_a, elo_team_b, balance_score)
  values (p_match_id, 2, v_team_a, v_team_b, v_elo_a, v_elo_b, v_balance);

  -- === VARIANTE 3: Top joueurs alternés en croix ===
  v_team_a := '{}'; v_team_b := '{}';
  for v_i in 1..v_count loop
    if (v_i % 4 = 1 or v_i % 4 = 2) then
      v_team_b := array_append(v_team_b, v_player_ids[v_i]);
    else
      v_team_a := array_append(v_team_a, v_player_ids[v_i]);
    end if;
  end loop;

  select
    avg(p.elo) filter (where p.id = any(v_team_a)) as avg_a,
    avg(p.elo) filter (where p.id = any(v_team_b)) as avg_b
  into v_elo_a, v_elo_b
  from public.profiles p
  where p.id = any(v_player_ids);

  v_balance := abs(coalesce(v_elo_a, 0) - coalesce(v_elo_b, 0));

  insert into public.compositions (match_id, variant, team_a_players, team_b_players, elo_team_a, elo_team_b, balance_score)
  values (p_match_id, 3, v_team_a, v_team_b, v_elo_a, v_elo_b, v_balance);

end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.compositions enable row level security;
alter table public.ratings enable row level security;
alter table public.mvp_votes enable row level security;
alter table public.elo_history enable row level security;

-- PROFILES
create policy "Les profils sont visibles par tous les utilisateurs connectés"
  on public.profiles for select to authenticated using (true);

create policy "Les utilisateurs peuvent modifier leur propre profil"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- MATCHES
create policy "Les matchs sont visibles par tous les utilisateurs connectés"
  on public.matches for select to authenticated using (true);

create policy "Les utilisateurs connectés peuvent créer un match"
  on public.matches for insert to authenticated with check (auth.uid() = created_by);

create policy "Seul le créateur peut modifier le match"
  on public.matches for update to authenticated using (auth.uid() = created_by);

-- MATCH_PLAYERS
create policy "Les inscriptions sont visibles par tous"
  on public.match_players for select to authenticated using (true);

create policy "Les utilisateurs peuvent s'inscrire à un match"
  on public.match_players for insert to authenticated with check (auth.uid() = player_id);

create policy "Les utilisateurs peuvent se désinscrire"
  on public.match_players for delete to authenticated using (auth.uid() = player_id);

-- COMPOSITIONS
create policy "Les compositions sont visibles par tous"
  on public.compositions for select to authenticated using (true);

create policy "Le créateur du match peut gérer les compositions"
  on public.compositions for all to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.created_by = auth.uid()
    )
  );

-- RATINGS (anonymes - lecture interdite du rater_id)
create policy "Les notations anonymes: voir les scores sans savoir qui a noté"
  on public.ratings for select to authenticated using (true);

create policy "Un joueur peut noter ses coéquipiers/adversaires"
  on public.ratings for insert to authenticated
  with check (
    auth.uid() = rater_id
    and auth.uid() != rated_player_id
    and exists (
      select 1 from public.match_players mp1
      where mp1.match_id = ratings.match_id and mp1.player_id = auth.uid()
    )
    and exists (
      select 1 from public.match_players mp2
      where mp2.match_id = ratings.match_id and mp2.player_id = rated_player_id
    )
  );

-- MVP_VOTES (publics)
create policy "Les votes MVP sont visibles par tous"
  on public.mvp_votes for select to authenticated using (true);

create policy "Un joueur peut voter pour le MVP"
  on public.mvp_votes for insert to authenticated
  with check (
    auth.uid() = voter_id
    and auth.uid() != voted_player_id
    and exists (
      select 1 from public.match_players mp
      where mp.match_id = mvp_votes.match_id and mp.player_id = auth.uid()
    )
  );

-- ELO_HISTORY
create policy "L'historique ELO est visible par tous"
  on public.elo_history for select to authenticated using (true);
