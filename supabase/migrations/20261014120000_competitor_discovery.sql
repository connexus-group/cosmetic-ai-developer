-- AI Product Developer · competitor discovery (search → pick → collect → compare)
-- Run once in Supabase → SQL Editor, after 20261014000000_competitor_products.sql.
-- Only adds columns and tables; nothing existing is changed or dropped.
--
-- competitor_products (new columns) : regular / sale price, product type, key ingredients, USP phrases,
--                                     normalized size, price per 100 ml/g, estimated country. NULL = not on the page.
-- competitor_searches               : Firecrawl search results, reused for 24h so the same search costs nothing.
-- firecrawl_usage                   : credits this app spent (search / scrape) for the monthly counter.
-- fx_rates                          : daily exchange rates to KRW (Frankfurter, central-bank reference rates).
--
-- Only the server (service role) reads and writes; RLS is on with no public policies.

alter table public.competitor_products
  add column if not exists regular_price_value numeric check (regular_price_value is null or regular_price_value > 0),
  add column if not exists regular_price_text  text,
  add column if not exists sale_price_value    numeric check (sale_price_value is null or sale_price_value > 0),
  add column if not exists sale_price_text     text,
  add column if not exists category            text,
  add column if not exists key_ingredients     text[]  not null default '{}',
  add column if not exists usp                 text[]  not null default '{}',
  add column if not exists size_value          numeric check (size_value is null or size_value > 0),
  add column if not exists size_unit           text,             -- ml | g
  add column if not exists size_converted      boolean not null default false, -- true when converted from oz
  add column if not exists unit_price_per_100  numeric,          -- in the page currency, per 100 ml/g
  add column if not exists country             text,
  add column if not exists country_basis       text;             -- how the country was estimated (domain / currency)

create table if not exists public.competitor_searches (
  id         bigint generated always as identity primary key,
  query_hash text        not null,
  query      text        not null,
  location   text,
  attributes jsonb       not null default '{}',
  results    jsonb       not null default '[]',
  credits    integer     not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists competitor_searches_hash_idx on public.competitor_searches (query_hash, created_at desc);

create table if not exists public.firecrawl_usage (
  id         bigint generated always as identity primary key,
  kind       text        not null check (kind in ('search', 'scrape')),
  credits    integer     not null check (credits >= 0),
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists firecrawl_usage_created_idx on public.firecrawl_usage (created_at desc);

create table if not exists public.fx_rates (
  id         bigint generated always as identity primary key,
  base       text        not null,
  quote      text        not null,
  rate       numeric     not null check (rate > 0),
  rate_date  date        not null,   -- reference date published by the source
  fetched_on date        not null,
  source     text        not null,
  created_at timestamptz not null default now(),
  unique (base, quote, fetched_on)
);

alter table public.competitor_searches enable row level security;
alter table public.firecrawl_usage     enable row level security;
alter table public.fx_rates            enable row level security;
