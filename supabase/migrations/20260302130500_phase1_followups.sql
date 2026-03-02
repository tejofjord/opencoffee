create or replace function public.upsert_event_signup(
  p_event_id uuid,
  p_user_id uuid,
  p_who text,
  p_project text,
  p_need text,
  p_can_help text,
  p_website_url text default null,
  p_linkedin_url text default null,
  p_short_bio text default null
)
returns table (
  signup_id uuid,
  queue_position integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  attempt integer;
  next_pos integer;
begin
  select es.id
  into existing_id
  from public.event_signups es
  where es.event_id = p_event_id
    and es.user_id = p_user_id
  limit 1;

  if existing_id is not null then
    update public.event_signups es
    set who = p_who,
        project = p_project,
        need = p_need,
        can_help = p_can_help,
        website_url = p_website_url,
        linkedin_url = p_linkedin_url,
        short_bio = p_short_bio,
        status = 'queued',
        updated_at = now()
    where es.id = existing_id
    returning es.id, es.queue_position
    into signup_id, queue_position;

    return next;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('event_signups_queue:' || p_event_id::text, 0));

  for attempt in 1..5 loop
    select coalesce(max(es.queue_position), 0) + 1
    into next_pos
    from public.event_signups es
    where es.event_id = p_event_id;

    begin
      insert into public.event_signups (
        event_id,
        user_id,
        who,
        project,
        need,
        can_help,
        website_url,
        linkedin_url,
        short_bio,
        queue_position,
        status
      )
      values (
        p_event_id,
        p_user_id,
        p_who,
        p_project,
        p_need,
        p_can_help,
        p_website_url,
        p_linkedin_url,
        p_short_bio,
        next_pos,
        'queued'
      )
      returning id, event_signups.queue_position
      into signup_id, queue_position;

      return next;
      return;
    exception when unique_violation then
      select es.id
      into existing_id
      from public.event_signups es
      where es.event_id = p_event_id
        and es.user_id = p_user_id
      limit 1;

      if existing_id is not null then
        update public.event_signups es
        set who = p_who,
            project = p_project,
            need = p_need,
            can_help = p_can_help,
            website_url = p_website_url,
            linkedin_url = p_linkedin_url,
            short_bio = p_short_bio,
            status = 'queued',
            updated_at = now()
        where es.id = existing_id
        returning es.id, es.queue_position
        into signup_id, queue_position;

        return next;
        return;
      end if;

      if attempt = 5 then
        raise exception 'Could not allocate queue position for event %', p_event_id;
      end if;
    end;
  end loop;
end;
$$;

drop policy if exists requests_insert_self on public.connection_requests;
create policy requests_insert_self
  on public.connection_requests
  for insert
  with check (
    requester_id = auth.uid()
    and public.is_chapter_member(chapter_id)
    and not public.is_blocked(chapter_id, requester_id, target_user_id)
  );

drop policy if exists requests_update_target_or_organizer on public.connection_requests;
create policy requests_update_target_or_organizer
  on public.connection_requests
  for update
  using (
    (
      target_user_id = auth.uid()
      and not public.is_blocked(chapter_id, requester_id, target_user_id)
    )
    or public.is_chapter_organizer(chapter_id)
  )
  with check (
    (
      target_user_id = auth.uid()
      and not public.is_blocked(chapter_id, requester_id, target_user_id)
    )
    or public.is_chapter_organizer(chapter_id)
  );

drop policy if exists conversations_insert_participant on public.conversations;
create policy conversations_insert_participant
  on public.conversations
  for insert
  with check (
    public.is_chapter_member(chapter_id)
    and not public.is_blocked(chapter_id, user_a_id, user_b_id)
    and (user_a_id = auth.uid() or user_b_id = auth.uid() or public.is_chapter_organizer(chapter_id))
  );
