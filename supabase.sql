-- Timos Turbo Run: gemeinsame Online-Bestenliste
-- Im Supabase-Dashboard (gleiches Projekt wie die Shake-Bar) unter "SQL Editor" einfügen und auf "Run" klicken.

create table if not exists public.ttr_scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(btrim(name)) between 1 and 12),
  score      integer     not null check (score between 1 and 10000000),
  meter      integer     check (meter is null or meter between 0 and 10000000),
  kroketten  integer     check (kroketten is null or kroketten between 0 and 1000000),
  created_at timestamptz not null default now()
);

create index if not exists ttr_scores_score_idx on public.ttr_scores (score desc);

-- Alle dürfen lesen und neue Einträge anlegen. Ändern oder löschen nur im Dashboard.
alter table public.ttr_scores enable row level security;

drop policy if exists "TTR Bestenliste lesen" on public.ttr_scores;
create policy "TTR Bestenliste lesen" on public.ttr_scores for select to anon, authenticated using (true);

drop policy if exists "TTR Eintrag hinzufuegen" on public.ttr_scores;
create policy "TTR Eintrag hinzufuegen" on public.ttr_scores for insert to anon, authenticated with check (true);

grant select, insert on public.ttr_scores to anon, authenticated;
