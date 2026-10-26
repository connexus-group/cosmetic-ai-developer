-- AI Product Developer · Packaging Studio (reference library + AI concept mockups)
-- Run once in Supabase → SQL Editor. Only adds tables and one private storage bucket; nothing existing is changed.
--
-- packaging_reference_searches : image search results (Firecrawl), reused for 24h so the same search costs nothing.
--                                Stores image ADDRESSES and source pages only. Image files are never copied.
-- packaging_mockups            : AI Concept Mockups generated on the site (metadata). The image file goes to the
--                                private bucket "packaging-mockups".
--
-- Only the server (service role) reads and writes; RLS is on with no public policies.

create table if not exists public.packaging_reference_searches (
  id         bigint generated always as identity primary key,
  query_hash text        not null,
  query      text        not null,
  results    jsonb       not null default '[]',
  credits    integer     not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists packaging_reference_searches_hash_idx on public.packaging_reference_searches (query_hash, created_at desc);

create table if not exists public.packaging_mockups (
  id           text        primary key,
  project_id   text        not null,
  kind         text        not null check (kind in ('container', 'carton', 'set', 'colorway')),
  provider     text        not null,
  model        text        not null,
  prompt       text        not null,
  options      jsonb       not null default '{}',
  storage_path text,
  created_at   timestamptz not null default now()
);
create index if not exists packaging_mockups_project_idx on public.packaging_mockups (project_id, created_at desc);

alter table public.packaging_reference_searches enable row level security;
alter table public.packaging_mockups            enable row level security;

insert into storage.buckets (id, name, public)
values ('packaging-mockups', 'packaging-mockups', false)
on conflict (id) do nothing;
