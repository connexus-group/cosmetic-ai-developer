-- AI Product Developer · real market data (first version)
-- Run once in Supabase → SQL Editor (or `supabase db push`).
--
-- market_observations : values collected from external sources (data_type = 'COLLECTED')
-- ai_analyses         : sentences written by the analysis engine / AI, each citing observation ids
-- market_queries      : one row per distinct query; used as the cache index and fetch log
--
-- Collected values and AI-generated text live in separate tables on purpose.
-- Only the server (service role) reads and writes; RLS is on with no public policies.

create table if not exists public.market_observations (
  id                  text primary key,              -- deterministic: source + query + metric + period
  source_name         text        not null,
  source_url          text        not null,
  country             text        not null,
  category            text        not null,
  keyword             text,
  metric_name         text        not null,
  dimension           text        not null default 'all',  -- all | age:20 | gender:f ...
  metric_value        numeric     not null,
  unit                text        not null,
  period_start        date        not null,
  period_end          date        not null,
  collected_at        timestamptz not null,
  published_at        timestamptz,
  data_type           text        not null default 'COLLECTED' check (data_type = 'COLLECTED'),
  verification_status text        not null check (verification_status in ('OFFICIAL_SOURCE', 'UNVERIFIED', 'REJECTED')),
  query_hash          text        not null,
  created_at          timestamptz not null default now(),
  check (period_start <= period_end)
);
create index if not exists market_observations_query_idx on public.market_observations (query_hash, period_start);
create index if not exists market_observations_lookup_idx on public.market_observations (country, category, keyword, metric_name);

create table if not exists public.market_queries (
  query_hash        text primary key,
  source_id         text        not null,
  query             jsonb       not null,
  last_success_at   timestamptz,
  last_attempt_at   timestamptz,
  last_status       text,
  last_error        text,
  observation_count integer     not null default 0
);

create table if not exists public.ai_analyses (
  id                  uuid primary key default gen_random_uuid(),
  query_hash          text        not null,
  model               text        not null,
  statement           text        not null,
  observation_ids     text[]      not null check (cardinality(observation_ids) > 0),
  data_type           text        not null check (data_type in ('COMPUTED', 'AI_GENERATED')),
  verification_status text        not null default 'UNVERIFIED',
  created_at          timestamptz not null default now()
);
create index if not exists ai_analyses_query_idx on public.ai_analyses (query_hash, created_at desc);

alter table public.market_observations enable row level security;
alter table public.market_queries      enable row level security;
alter table public.ai_analyses         enable row level security;
