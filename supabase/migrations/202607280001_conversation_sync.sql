create table public.conversation_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.conversation_snapshots enable row level security;

create policy "Users can read their conversation"
on public.conversation_snapshots for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their conversation"
on public.conversation_snapshots for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their conversation"
on public.conversation_snapshots for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their conversation"
on public.conversation_snapshots for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.conversation_snapshots from anon;
grant select, insert, update, delete on public.conversation_snapshots to authenticated;
