create table public.journal_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.journal_snapshots enable row level security;

create policy "Users can read their journal"
on public.journal_snapshots for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their journal"
on public.journal_snapshots for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their journal"
on public.journal_snapshots for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their journal"
on public.journal_snapshots for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.journal_snapshots from anon;
grant select, insert, update, delete on public.journal_snapshots to authenticated;
