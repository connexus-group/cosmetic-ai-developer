-- AI Product Developer · competitor products collected with Firecrawl
-- Run once in Supabase → SQL Editor (after 20261013000000_market_data.sql, or on its own).
--
-- competitor_products  : one row per product page. Every field was found in the page text
--                        Firecrawl returned; anything not on the page is NULL (never guessed).
-- competitor_fetch_log : every collection attempt (OK, BLOCKED by robots/terms, ERROR).
--
-- Only the server (service role) reads and writes; RLS is on with no public policies.

create table if not exists public.competitor_products (
  id                  text primary key,               -- prd_ + hash of the normalized URL
  url                 text        not null unique,    -- the page URL the user entered (normalized)
  final_url           text        not null,           -- URL after redirects, as reported by Firecrawl
  domain              text        not null,
  collected_at        timestamptz not null,
  product_name        text,
  brand               text,
  page_title          text,
  price_value         numeric     check (price_value is null or price_value > 0),
  price_text          text,                           -- exactly as printed on the page
  currency            text,
  volume_value        numeric     check (volume_value is null or volume_value > 0),
  volume_unit         text,
  volume_text         text,                           -- exactly as printed on the page
  ingredients         text[]      not null default '{}',
  ingredients_dropped integer     not null default 0, -- extractor items not found in the page text
  field_status        jsonb       not null,           -- FOUND | NOT_FOUND | DROPPED per field
  robots_url          text,
  source_name         text        not null default 'Firecrawl',
  data_type           text        not null default 'COLLECTED' check (data_type = 'COLLECTED'),
  markdown_hash       text        not null,
  markdown_chars      integer     not null,
  created_at          timestamptz not null default now()
);
create index if not exists competitor_products_domain_idx on public.competitor_products (domain, collected_at desc);

create table if not exists public.competitor_fetch_log (
  id         bigint generated always as identity primary key,
  url        text        not null,
  status     text        not null,   -- OK | BLOCKED | NO_DATA | ERROR code
  error      text,
  created_at timestamptz not null default now()
);

alter table public.competitor_products  enable row level security;
alter table public.competitor_fetch_log enable row level security;
