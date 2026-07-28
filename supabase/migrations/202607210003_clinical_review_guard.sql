create or replace function public.validate_knowledge_pack_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('approved', 'published')
    and coalesce((new.content->>'clinicalReviewRequired')::boolean, false)
  then
    if new.reviewed_by is null or new.reviewed_at is null then
      raise exception 'Clinical knowledge packs require a completed review';
    end if;
    if new.created_by is not null and new.reviewed_by = new.created_by then
      raise exception 'Clinical knowledge pack authors cannot review their own version';
    end if;
  end if;
  return new;
end;
$$;

create trigger knowledge_pack_versions_require_clinical_review
before insert or update on public.knowledge_pack_versions
for each row execute function public.validate_knowledge_pack_review();
