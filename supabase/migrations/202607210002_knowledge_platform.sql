create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{2,62}$'),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('author', 'reviewer', 'publisher', 'admin')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.knowledge_packs (
  id text primary key check (id ~ '^[a-z][a-z0-9_.-]{2,79}$'),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z][a-z0-9-]{2,62}$'),
  title text not null check (char_length(title) between 1 and 90),
  summary text not null check (char_length(summary) between 1 and 420),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.knowledge_pack_versions (
  pack_id text not null references public.knowledge_packs(id) on delete restrict,
  version text not null check (version ~ '^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$'),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published', 'rejected')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  change_summary text not null default '' check (char_length(change_summary) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  primary key (pack_id, version),
  check (content->>'id' = pack_id),
  check (content->>'version' = version),
  check (status <> 'published' or published_at is not null),
  check (status <> 'approved' or reviewed_at is not null)
);

create table public.pack_reviews (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null,
  version text not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'changes_requested')),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  foreign key (pack_id, version) references public.knowledge_pack_versions(pack_id, version) on delete restrict
);

create table public.pack_test_cases (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null,
  version text not null,
  name text not null check (char_length(name) between 1 and 160),
  case_type text not null check (case_type in ('expected_pattern', 'false_positive', 'safety', 'language')),
  input jsonb not null,
  expected jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (pack_id, version) references public.knowledge_pack_versions(pack_id, version) on delete cascade
);

create table public.user_pack_enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null,
  version text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  consented_at timestamptz not null,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, pack_id),
  foreign key (pack_id, version) references public.knowledge_pack_versions(pack_id, version) on delete restrict
);

create table public.user_program_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null,
  module_id text not null check (module_id ~ '^[a-z][a-z0-9_.-]{2,79}$'),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  last_practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, pack_id, module_id),
  foreign key (user_id, pack_id) references public.user_pack_enrollments(user_id, pack_id) on delete cascade
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  target_type text not null check (char_length(target_type) between 1 and 80),
  target_id text not null check (char_length(target_id) between 1 and 240),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_organization_member(target_organization_id uuid, allowed_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = (select auth.uid())
      and (allowed_roles is null or member.role = any(allowed_roles))
  );
$$;

revoke all on function public.is_organization_member(uuid, text[]) from public;
grant execute on function public.is_organization_member(uuid, text[]) to authenticated;

create or replace function public.prevent_published_pack_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'Published knowledge pack versions are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger knowledge_pack_versions_immutable
before update or delete on public.knowledge_pack_versions
for each row execute function public.prevent_published_pack_mutation();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.knowledge_packs enable row level security;
alter table public.knowledge_pack_versions enable row level security;
alter table public.pack_reviews enable row level security;
alter table public.pack_test_cases enable row level security;
alter table public.user_pack_enrollments enable row level security;
alter table public.user_program_progress enable row level security;
alter table public.audit_events enable row level security;

create policy "Members can read their organizations" on public.organizations
for select to authenticated using (public.is_organization_member(id));
create policy "Admins can update their organizations" on public.organizations
for update to authenticated using (public.is_organization_member(id, array['admin']))
with check (public.is_organization_member(id, array['admin']));

create policy "Members can read organization membership" on public.organization_members
for select to authenticated using (public.is_organization_member(organization_id));
create policy "Admins can add organization members" on public.organization_members
for insert to authenticated with check (public.is_organization_member(organization_id, array['admin']));
create policy "Admins can update organization members" on public.organization_members
for update to authenticated using (public.is_organization_member(organization_id, array['admin']))
with check (public.is_organization_member(organization_id, array['admin']));
create policy "Admins can remove organization members" on public.organization_members
for delete to authenticated using (public.is_organization_member(organization_id, array['admin']));

create policy "Members can read organization packs" on public.knowledge_packs
for select to authenticated using (public.is_organization_member(organization_id));
create policy "Authors can create packs" on public.knowledge_packs
for insert to authenticated with check (public.is_organization_member(organization_id, array['author', 'admin']));
create policy "Authors can update packs" on public.knowledge_packs
for update to authenticated using (public.is_organization_member(organization_id, array['author', 'admin']))
with check (public.is_organization_member(organization_id, array['author', 'admin']));

create policy "Members can read pack versions" on public.knowledge_pack_versions
for select to authenticated using (
  exists (
    select 1 from public.knowledge_packs pack
    where pack.id = pack_id and public.is_organization_member(pack.organization_id)
  )
);
create policy "Authors can create pack versions" on public.knowledge_pack_versions
for insert to authenticated with check (
  exists (
    select 1 from public.knowledge_packs pack
    where pack.id = pack_id and public.is_organization_member(pack.organization_id, array['author', 'admin'])
  )
);
create policy "Authors and reviewers can update unpublished versions" on public.knowledge_pack_versions
for update to authenticated using (
  status <> 'published' and exists (
    select 1 from public.knowledge_packs pack
    where pack.id = pack_id and public.is_organization_member(pack.organization_id, array['author', 'reviewer', 'publisher', 'admin'])
  )
);

create policy "Members can read pack reviews" on public.pack_reviews
for select to authenticated using (
  exists (select 1 from public.knowledge_packs pack where pack.id = pack_id and public.is_organization_member(pack.organization_id))
);
create policy "Reviewers can create pack reviews" on public.pack_reviews
for insert to authenticated with check (
  reviewer_id = (select auth.uid()) and exists (
    select 1 from public.knowledge_packs pack
    where pack.id = pack_id and public.is_organization_member(pack.organization_id, array['reviewer', 'admin'])
  )
);

create policy "Members can manage pack tests" on public.pack_test_cases
for all to authenticated using (
  exists (select 1 from public.knowledge_packs pack where pack.id = pack_id and public.is_organization_member(pack.organization_id))
) with check (
  exists (select 1 from public.knowledge_packs pack where pack.id = pack_id and public.is_organization_member(pack.organization_id, array['author', 'reviewer', 'admin']))
);

create policy "Users own their enrollments" on public.user_pack_enrollments
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users own their program progress" on public.user_program_progress
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Admins can read organization audit events" on public.audit_events
for select to authenticated using (public.is_organization_member(organization_id, array['admin']));

revoke all on public.organizations, public.organization_members, public.knowledge_packs,
  public.knowledge_pack_versions, public.pack_reviews, public.pack_test_cases,
  public.user_pack_enrollments, public.user_program_progress, public.audit_events from anon;

grant select, insert, update, delete on public.organizations, public.organization_members,
  public.knowledge_packs, public.knowledge_pack_versions, public.pack_reviews,
  public.pack_test_cases, public.user_pack_enrollments, public.user_program_progress to authenticated;
grant select on public.audit_events to authenticated;

insert into public.organizations (id, slug, name)
values ('00000000-0000-4000-8000-000000000001', 'within', 'Within');

insert into public.knowledge_packs (id, organization_id, slug, title, summary, visibility)
values (
  'within.relationships',
  '00000000-0000-4000-8000-000000000001',
  'relationships',
  'Within Relationships',
  'Structured reflection skills for pacing, boundaries, conflict, decisions, routines, and burnout.',
  'public'
);

insert into public.knowledge_pack_versions (pack_id, version, status, content, change_summary, published_at)
values (
  'within.relationships',
  '1.0.0',
  'published',
  $pack${
    "schemaVersion": 1,
    "id": "within.relationships",
    "version": "1.0.0",
    "title": "Within Relationships",
    "summary": "Structured reflection skills for pacing, boundaries, conflict, decisions, routines, and burnout.",
    "intendedAudience": "Adults using a private journal for educational self-reflection and relationship skills.",
    "supportedLifeAreas": ["Dating", "Relationships", "Friends", "Work", "Family", "Habits"],
    "authors": [{"name": "Within", "credentials": "Internal educational content team"}],
    "clinicalReviewRequired": false,
    "modules": [
      {"id":"pace_check","title":"Check the pace","purpose":"Separate excitement from the speed of your next commitment.","journalPrompts":["What has changed since this relationship began?","What pace would feel sustainable?"],"steps":["List what has changed recently.","Name the pace that would feel sustainable.","Wait 24 hours before the next major commitment."],"completionCriteria":["The user identifies one sustainable next step."],"contraindications":[]},
      {"id":"boundary_builder","title":"Build a clear boundary","purpose":"Turn a private preference into a limit you can communicate and keep.","journalPrompts":["What do you need to protect here?","What request would make the limit observable?"],"steps":["State what you need without explaining it away.","Make one specific request.","Decide what you will do if the limit is ignored."],"completionCriteria":["The boundary describes the user's own action."],"contraindications":["Do not use ordinary boundary coaching when immediate safety or abuse support is needed."]},
      {"id":"decision_pause","title":"Pause a pressured decision","purpose":"Reduce urgency before making a choice that is difficult to reverse.","journalPrompts":["What feels urgent?","Which consequences are difficult to reverse?"],"steps":["Name what feels urgent.","Separate reversible from irreversible consequences.","Choose a specific time to reconsider."],"completionCriteria":["A reconsideration time is chosen."],"contraindications":[]},
      {"id":"conflict_repair","title":"Repair after conflict","purpose":"Move from blame toward one observable issue and a concrete request.","journalPrompts":["What happened without interpreting motives?","What impact can you take responsibility for?"],"steps":["Describe what happened without motive or character labels.","Name the impact on you.","Ask for one specific change."],"completionCriteria":["The repair uses observable behavior rather than character labels."],"contraindications":["Do not encourage direct repair when doing so could create immediate danger."]},
      {"id":"assumption_check","title":"Check the story","purpose":"Separate what you know from the meaning your mind added.","journalPrompts":["What did you directly observe?","What meaning did you add?"],"steps":["Write only the observable facts.","Write your current interpretation.","List two other plausible explanations."],"completionCriteria":["At least two plausible explanations are considered."],"contraindications":[]},
      {"id":"routine_protection","title":"Protect what keeps you grounded","purpose":"Notice when a new priority begins displacing the life you value.","journalPrompts":["What routine or relationship shifted?","Was that change intentional?"],"steps":["Name the routine or relationship that shifted.","Decide whether that change was intentional.","Put one protected activity back on your calendar."],"completionCriteria":["One valued activity is deliberately restored or consciously released."],"contraindications":[]},
      {"id":"burnout_check","title":"Check your load","purpose":"Compare commitments added with recovery removed.","journalPrompts":["What did you add this week?","What recovery time disappeared?"],"steps":["List what you added this week.","List what recovery time disappeared.","Renegotiate or remove one commitment."],"completionCriteria":["One commitment is renegotiated or recovery time is restored."],"contraindications":[]}
    ],
    "patterns": [
      {"id":"pacing","category":"pacing","title":"Pace changes","description":"Repeated major relationship changes occurring faster than the user's stated preferred pace.","minimumEvidenceEntries":2,"supportingSignals":["Separate entries describe difficult-to-reverse commitments or repeated displacement of existing priorities."],"weakeningSignals":["The pace is deliberate and aligned with the user's explicit values."],"excludingSignals":["Excitement or frequent contact without behavioral displacement."],"moduleId":"pace_check"},
      {"id":"boundaries","category":"boundaries","title":"Boundary follow-through","description":"Repeated difficulty expressing or maintaining a limit the user wants to protect.","minimumEvidenceEntries":2,"supportingSignals":["Separate entries describe the same limit being abandoned or left unspoken."],"weakeningSignals":["The user consciously changed the preference after reflection."],"excludingSignals":["A single compromise."],"moduleId":"boundary_builder"},
      {"id":"balance","category":"balance","title":"Balance shifts","description":"A new priority repeatedly displaces established relationships or routines.","minimumEvidenceEntries":2,"supportingSignals":["Separate entries identify existing priorities being cancelled or neglected."],"weakeningSignals":["The shift is temporary, intentional, and consistent with stated values."],"excludingSignals":["One isolated scheduling change."],"moduleId":"routine_protection"},
      {"id":"conflict","category":"conflict","title":"Conflict loop","description":"A repeated conflict sequence is described across separate entries.","minimumEvidenceEntries":2,"supportingSignals":["The same observable escalation or withdrawal sequence appears more than once."],"weakeningSignals":["Later entries show a successful repair or materially different response."],"excludingSignals":["Character labels without observable events."],"moduleId":"conflict_repair"},
      {"id":"decision_loop","category":"decision_loop","title":"Decision pressure","description":"Urgency repeatedly precedes choices that are difficult to reverse.","minimumEvidenceEntries":2,"supportingSignals":["Separate entries describe pressure to decide immediately."],"weakeningSignals":["Deadlines are external, factual, and unavoidable."],"excludingSignals":["Ordinary uncertainty without pressure."],"moduleId":"decision_pause"},
      {"id":"burnout","category":"burnout","title":"Load and recovery","description":"Commitments repeatedly increase while recovery time decreases.","minimumEvidenceEntries":2,"supportingSignals":["Separate entries mention added obligations and lost rest."],"weakeningSignals":["Recovery is protected elsewhere and functioning remains stable."],"excludingSignals":["One unusually busy day."],"moduleId":"burnout_check"},
      {"id":"strength","category":"strength","title":"A repeated strength","description":"A constructive response is repeated across separate entries.","minimumEvidenceEntries":2,"supportingSignals":["The same value-aligned behavior appears in separate situations."],"weakeningSignals":[],"excludingSignals":["Praise based only on stated intention without observable action."],"moduleId":"assumption_check"}
    ],
    "language": {"approvedTerms":["may be worth checking","the entries suggest","one possible interpretation"],"prohibitedClaims":["diagnose the user or another person","claim hidden motives as fact","label a person narcissistic, toxic, abusive, or dangerous","tell the user to start or end a relationship"]},
    "safety": {"scope":"Educational self-reflection only. This pack does not diagnose, treat a mental-health condition, replace psychotherapy, or manage emergencies.","escalationRules":["Self-harm, violence, abuse, and medical-emergency signals bypass ordinary pattern coaching.","Do not continue an ordinary exercise when immediate safety support is indicated."]}
  }$pack$::jsonb,
  'Initial immutable version migrated from the consumer MVP.',
  now()
);
