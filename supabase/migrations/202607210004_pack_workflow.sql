drop policy if exists "Authors can create pack versions" on public.knowledge_pack_versions;
drop policy if exists "Authors and reviewers can update unpublished versions" on public.knowledge_pack_versions;
drop policy if exists "Reviewers can create pack reviews" on public.pack_reviews;

create policy "Authors can create draft versions" on public.knowledge_pack_versions
for insert to authenticated with check (
  status = 'draft'
  and created_by = (select auth.uid())
  and reviewed_by is null
  and reviewed_at is null
  and published_at is null
  and exists (
    select 1 from public.knowledge_packs pack
    where pack.id = pack_id
      and public.is_organization_member(pack.organization_id, array['author', 'admin'])
  )
);

create policy "Authors can edit draft versions" on public.knowledge_pack_versions
for update to authenticated using (
  status = 'draft'
  and exists (
    select 1 from public.knowledge_packs pack
    where pack.id = pack_id
      and public.is_organization_member(pack.organization_id, array['author', 'admin'])
  )
) with check (
  status = 'draft'
  and reviewed_by is null
  and reviewed_at is null
  and published_at is null
  and exists (
    select 1 from public.knowledge_packs pack
    where pack.id = pack_id
      and public.is_organization_member(pack.organization_id, array['author', 'admin'])
  )
);

create policy "Authors can delete draft versions" on public.knowledge_pack_versions
for delete to authenticated using (
  status = 'draft'
  and exists (
    select 1 from public.knowledge_packs pack
    where pack.id = pack_id
      and public.is_organization_member(pack.organization_id, array['author', 'admin'])
  )
);

create or replace function public.create_knowledge_pack_draft(
  p_organization_id uuid,
  p_pack_id text,
  p_slug text,
  p_title text,
  p_summary text,
  p_version text,
  p_content jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_organization_member(p_organization_id, array['author', 'admin']) then
    raise exception 'Not authorized to create a knowledge pack';
  end if;
  if p_content->>'id' <> p_pack_id or p_content->>'version' <> p_version then
    raise exception 'Content ID and version must match the pack version';
  end if;
  if p_content->>'schemaVersion' <> '1'
    or jsonb_typeof(p_content->'modules') <> 'array'
    or jsonb_typeof(p_content->'patterns') <> 'array' then
    raise exception 'Knowledge pack content has an invalid shape';
  end if;

  insert into public.knowledge_packs (
    id, organization_id, slug, title, summary, visibility, created_by
  ) values (
    p_pack_id, p_organization_id, p_slug, p_title, p_summary, 'private', (select auth.uid())
  );

  insert into public.knowledge_pack_versions (
    pack_id, version, status, content, created_by
  ) values (
    p_pack_id, p_version, 'draft', p_content, (select auth.uid())
  );

  insert into public.audit_events (organization_id, actor_user_id, action, target_type, target_id)
  values (p_organization_id, (select auth.uid()), 'pack.created', 'knowledge_pack_version', p_pack_id || '@' || p_version);
end;
$$;

create or replace function public.submit_knowledge_pack_version(p_pack_id text, p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  select pack.organization_id into target_organization_id
  from public.knowledge_packs pack
  where pack.id = p_pack_id;

  if target_organization_id is null
    or not public.is_organization_member(target_organization_id, array['author', 'admin']) then
    raise exception 'Not authorized to submit this knowledge pack';
  end if;

  update public.knowledge_pack_versions
  set status = 'in_review', reviewed_by = null, reviewed_at = null
  where pack_id = p_pack_id and version = p_version and status = 'draft';

  if not found then
    raise exception 'Only a draft version can be submitted';
  end if;

  insert into public.audit_events (organization_id, actor_user_id, action, target_type, target_id)
  values (target_organization_id, (select auth.uid()), 'pack.submitted', 'knowledge_pack_version', p_pack_id || '@' || p_version);
end;
$$;

create or replace function public.review_knowledge_pack_version(
  p_pack_id text,
  p_version text,
  p_decision text,
  p_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  version_creator uuid;
  review_decision text;
begin
  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'Invalid review decision';
  end if;
  if char_length(p_notes) > 4000 then
    raise exception 'Review notes are too long';
  end if;

  select pack.organization_id, pack_version.created_by
  into target_organization_id, version_creator
  from public.knowledge_pack_versions pack_version
  join public.knowledge_packs pack on pack.id = pack_version.pack_id
  where pack_version.pack_id = p_pack_id and pack_version.version = p_version
  for update of pack_version;

  if target_organization_id is null
    or not public.is_organization_member(target_organization_id, array['reviewer', 'admin']) then
    raise exception 'Not authorized to review this knowledge pack';
  end if;
  if version_creator = (select auth.uid()) then
    raise exception 'Authors cannot review their own version';
  end if;

  insert into public.pack_reviews (pack_id, version, reviewer_id, decision, notes)
  values (p_pack_id, p_version, (select auth.uid()), p_decision, p_notes);

  review_decision := case when p_decision = 'approved' then 'approved' else 'draft' end;
  update public.knowledge_pack_versions
  set status = review_decision,
      reviewed_by = case when p_decision = 'approved' then (select auth.uid()) else null end,
      reviewed_at = case when p_decision = 'approved' then now() else null end
  where pack_id = p_pack_id and version = p_version and status = 'in_review';

  if not found then
    raise exception 'Only a version in review can be reviewed';
  end if;

  insert into public.audit_events (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    target_organization_id,
    (select auth.uid()),
    'pack.reviewed',
    'knowledge_pack_version',
    p_pack_id || '@' || p_version,
    jsonb_build_object('decision', p_decision)
  );
end;
$$;

create or replace function public.publish_knowledge_pack_version(p_pack_id text, p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  select pack.organization_id into target_organization_id
  from public.knowledge_packs pack
  where pack.id = p_pack_id;

  if target_organization_id is null
    or not public.is_organization_member(target_organization_id, array['publisher', 'admin']) then
    raise exception 'Not authorized to publish this knowledge pack';
  end if;

  update public.knowledge_pack_versions
  set status = 'published', published_at = now()
  where pack_id = p_pack_id and version = p_version and status = 'approved';

  if not found then
    raise exception 'Only an approved version can be published';
  end if;

  update public.knowledge_packs set updated_at = now() where id = p_pack_id;
  insert into public.audit_events (organization_id, actor_user_id, action, target_type, target_id)
  values (target_organization_id, (select auth.uid()), 'pack.published', 'knowledge_pack_version', p_pack_id || '@' || p_version);
end;
$$;

revoke all on function public.submit_knowledge_pack_version(text, text) from public;
revoke all on function public.review_knowledge_pack_version(text, text, text, text) from public;
revoke all on function public.publish_knowledge_pack_version(text, text) from public;
grant execute on function public.submit_knowledge_pack_version(text, text) to authenticated;
grant execute on function public.review_knowledge_pack_version(text, text, text, text) to authenticated;
grant execute on function public.publish_knowledge_pack_version(text, text) to authenticated;
revoke all on function public.create_knowledge_pack_draft(uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.create_knowledge_pack_draft(uuid, text, text, text, text, text, jsonb) to authenticated;

revoke insert, update, delete on public.pack_reviews from authenticated;
