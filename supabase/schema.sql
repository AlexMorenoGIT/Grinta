-- ============================================================
-- GRINTA - Schéma SQL Complet (synchronisé avec la prod)
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
  elo_base int not null default 1000,  -- ELO défini par le questionnaire
  elo_gain int not null default 0,     -- Points accumulés (matchs + MVP). elo = elo_base + elo_gain
  technique_score int check (technique_score between 1 and 10),
  physique_score int check (physique_score between 1 and 10),
  tactique_score int check (tactique_score between 1 and 10),
  mvp_count int not null default 0,
  matches_played int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  own_goals int not null default 0,    -- Nombre de CSC commis
  avg_rating numeric(4,2) default null,
  onboarding_completed boolean not null default false,
  has_completed_v2_onboarding boolean not null default false,
  v2_answers jsonb default null,
  is_admin boolean not null default false,
  wero_phone text default null,
  rib text default null,
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
  duration_seconds int default null,
  price_total numeric default null,
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
  has_paid boolean not null default false,
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
-- TABLE: match_goals (buts enregistrés en live)
-- ============================================================
create table public.match_goals (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  scorer_id uuid references public.profiles(id) on delete set null,
  assist_id uuid references public.profiles(id) on delete set null,
  team text not null check (team in ('A', 'B')),
  minute int not null,
  goal_order int not null,
  is_own_goal boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE: match_challenges (défis confidentiels)
-- ============================================================
create table public.match_challenges (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade not null,
  player_id uuid references public.profiles(id) on delete cascade not null,
  challenge_type text not null check (challenge_type in (
    'specialist', 'altruiste', 'verrou', 'binome', 'renard',
    'soldat', 'clutch', 'insubmersible', 'proprete', 'pivot'
  )),
  target_player_id uuid references public.profiles(id),
  is_completed boolean default false,
  is_self_reported boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: player_badges
-- ============================================================
create table public.player_badges (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.profiles(id) on delete cascade not null,
  badge_type text not null,
  match_id uuid references public.matches(id) on delete set null,
  earned_at timestamptz default now()
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
create index idx_match_goals_match on public.match_goals(match_id);
create index idx_match_goals_scorer on public.match_goals(scorer_id);
create index idx_match_challenges_match on public.match_challenges(match_id);
create index idx_match_challenges_player on public.match_challenges(player_id);
create index idx_player_badges_player on public.player_badges(player_id);

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
-- Met aussi à jour elo_gain
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
begin
  select elo into v_current_elo
  from public.profiles
  where id = p_player_id;

  select avg(score) into v_avg_rating
  from public.ratings
  where match_id = p_match_id
    and rated_player_id = p_player_id;

  if p_won then
    v_result_points := 25;
  else
    v_result_points := -20;
  end if;

  if v_avg_rating is not null then
    v_rating_points := round((v_avg_rating - 5.5) * 8)::int;
  else
    v_rating_points := 0;
  end if;

  v_total_delta := v_result_points + v_rating_points;
  v_new_elo := greatest(100, v_current_elo + v_total_delta);

  update public.profiles
  set
    elo = v_new_elo,
    elo_gain = elo_gain + v_total_delta,
    matches_played = matches_played + 1,
    wins = wins + (case when p_won then 1 else 0 end),
    losses = losses + (case when not p_won then 1 else 0 end)
  where id = p_player_id;

  -- Mise à jour avg_rating global
  update public.profiles
  set avg_rating = (
    select avg(score)
    from public.ratings r
    where r.rated_player_id = p_player_id
  )
  where id = p_player_id;

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
  select voted_player_id into v_mvp_id
  from public.mvp_votes
  where match_id = p_match_id
  group by voted_player_id
  order by count(*) desc
  limit 1;

  if v_mvp_id is null then
    return;
  end if;

  select elo into v_current_elo from public.profiles where id = v_mvp_id;

  update public.profiles
  set
    elo = elo + 10,
    elo_gain = elo_gain + 10,
    mvp_count = mvp_count + 1
  where id = v_mvp_id;

  insert into public.elo_history (player_id, match_id, elo_before, elo_after, delta, reason)
  values (v_mvp_id, p_match_id, v_current_elo, v_current_elo + 10, 10, 'Bonus MVP 🏆');
end;
$$;

-- ============================================================
-- FONCTION: Incrémenter les CSC d'un joueur
-- ============================================================
create or replace function public.increment_own_goals(player_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.profiles
  set own_goals = own_goals + 1
  where id = player_id;
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

  delete from public.compositions where match_id = p_match_id;

  -- VARIANTE 1: Distribution serpentine
  v_team_a := '{}'; v_team_b := '{}';
  for v_i in 1..v_count loop
    if (v_i % 4 = 1 or v_i % 4 = 0) then
      v_team_a := array_append(v_team_a, v_player_ids[v_i]);
    else
      v_team_b := array_append(v_team_b, v_player_ids[v_i]);
    end if;
  end loop;

  if array_length(v_team_a, 1) != array_length(v_team_b, 1) then
    null;
  end if;

  select avg(p.elo) filter (where p.id = any(v_team_a)), avg(p.elo) filter (where p.id = any(v_team_b))
  into v_elo_a, v_elo_b from public.profiles p where p.id = any(v_player_ids);
  v_balance := abs(coalesce(v_elo_a, 0) - coalesce(v_elo_b, 0));
  insert into public.compositions (match_id, variant, team_a_players, team_b_players, elo_team_a, elo_team_b, balance_score)
  values (p_match_id, 1, v_team_a, v_team_b, v_elo_a, v_elo_b, v_balance);

  -- VARIANTE 2: Distribution alternée simple
  v_team_a := '{}'; v_team_b := '{}';
  for v_i in 1..v_count loop
    if v_i % 2 = 1 then v_team_a := array_append(v_team_a, v_player_ids[v_i]);
    else v_team_b := array_append(v_team_b, v_player_ids[v_i]); end if;
  end loop;

  select avg(p.elo) filter (where p.id = any(v_team_a)), avg(p.elo) filter (where p.id = any(v_team_b))
  into v_elo_a, v_elo_b from public.profiles p where p.id = any(v_player_ids);
  v_balance := abs(coalesce(v_elo_a, 0) - coalesce(v_elo_b, 0));
  insert into public.compositions (match_id, variant, team_a_players, team_b_players, elo_team_a, elo_team_b, balance_score)
  values (p_match_id, 2, v_team_a, v_team_b, v_elo_a, v_elo_b, v_balance);

  -- VARIANTE 3: Top joueurs alternés en croix
  v_team_a := '{}'; v_team_b := '{}';
  for v_i in 1..v_count loop
    if (v_i % 4 = 1 or v_i % 4 = 2) then v_team_b := array_append(v_team_b, v_player_ids[v_i]);
    else v_team_a := array_append(v_team_a, v_player_ids[v_i]); end if;
  end loop;

  select avg(p.elo) filter (where p.id = any(v_team_a)), avg(p.elo) filter (where p.id = any(v_team_b))
  into v_elo_a, v_elo_b from public.profiles p where p.id = any(v_player_ids);
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
alter table public.match_goals enable row level security;
alter table public.match_challenges enable row level security;
alter table public.player_badges enable row level security;

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

create policy "Les admins peuvent inscrire n'importe quel joueur"
  on public.match_players for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

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

-- RATINGS
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

-- MVP_VOTES
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

-- MATCH_GOALS
create policy "Les buts sont visibles par tous"
  on public.match_goals for select to authenticated using (true);

create policy "Le créateur du match peut gérer les buts"
  on public.match_goals for all to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.created_by = auth.uid()
    )
  );

-- MATCH_CHALLENGES
create policy "Joueur voit son propre défi ou tous après match terminé"
  on public.match_challenges for select to authenticated
  using (
    player_id = auth.uid()
    or exists (
      select 1 from public.matches m
      where m.id = match_id and m.status = 'completed'
    )
  );

create policy "Le créateur du match peut créer des défis"
  on public.match_challenges for insert to authenticated
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.created_by = auth.uid()
    )
  );

create policy "Le créateur ou le joueur peut modifier un défi"
  on public.match_challenges for update to authenticated
  using (
    player_id = auth.uid()
    or exists (
      select 1 from public.matches m
      where m.id = match_id and m.created_by = auth.uid()
    )
  );

-- PLAYER_BADGES
create policy "Les badges sont visibles par tous"
  on public.player_badges for select to authenticated using (true);

create policy "Le système peut créer des badges"
  on public.player_badges for insert to authenticated
  with check (true);

-- ============================================================
-- STORAGE: Bucket avatars (photos de profil)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
on conflict (id) do nothing;

create policy "Avatars accessibles publiquement"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "Upload de son propre avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '.webp'
  );

create policy "Mise à jour de son propre avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '.webp'
  );

create policy "Suppression de son propre avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '.webp'
  );
