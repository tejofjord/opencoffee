create table if not exists public.session_join_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_ip text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_join_attempts_count_nonnegative check (attempt_count >= 0),
  unique (event_id, user_id, source_ip, window_started_at)
);

create index if not exists session_join_attempts_window_idx
  on public.session_join_attempts (event_id, user_id, source_ip, window_started_at);

drop trigger if exists session_join_attempts_set_updated_at on public.session_join_attempts;
create trigger session_join_attempts_set_updated_at
before update on public.session_join_attempts
for each row execute procedure public.set_updated_at();

alter table public.session_join_attempts enable row level security;

alter table public.notification_jobs
  add column if not exists error jsonb;

create or replace function public.is_blocked(chapter uuid, a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks ub
    where ub.chapter_id = chapter
      and (
        (ub.blocker_id = a and ub.blocked_id = b)
        or (ub.blocker_id = b and ub.blocked_id = a)
      )
  );
$$;

create or replace function public.next_queue_position(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_pos integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('event_signups_queue:' || p_event_id::text, 0));

  select coalesce(max(queue_position), 0) + 1
  into next_pos
  from public.event_signups
  where event_id = p_event_id;

  return next_pos;
end;
$$;

create or replace function public.reorder_event_queue(
  p_event_id uuid,
  p_ordered_signup_ids uuid[],
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_signups integer;
  provided_count integer;
  matched_count integer;
  distinct_count integer;
  temp_base integer;
  chapter_id uuid;
begin
  if p_event_id is null then
    raise exception 'event_id is required';
  end if;

  provided_count := coalesce(array_length(p_ordered_signup_ids, 1), 0);
  if provided_count = 0 then
    raise exception 'ordered signup ids are required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('event_signups_queue:' || p_event_id::text, 0));

  select count(*)
  into total_signups
  from public.event_signups
  where event_id = p_event_id;

  if provided_count <> total_signups then
    raise exception 'ordered signup count (%) does not match event queue count (%)', provided_count, total_signups;
  end if;

  select count(*)
  into matched_count
  from public.event_signups
  where event_id = p_event_id
    and id = any(p_ordered_signup_ids);

  if matched_count <> total_signups then
    raise exception 'ordered signup ids must match exactly with event queue ids';
  end if;

  select count(distinct signup_id)
  into distinct_count
  from unnest(p_ordered_signup_ids) as u(signup_id);

  if distinct_count <> provided_count then
    raise exception 'ordered signup ids contains duplicates';
  end if;

  select coalesce(max(queue_position), 0) + 1000
  into temp_base
  from public.event_signups
  where event_id = p_event_id;

  with ordered as (
    select signup_id, ord::integer as next_pos
    from unnest(p_ordered_signup_ids) with ordinality as u(signup_id, ord)
  )
  update public.event_signups es
  set queue_position = temp_base + ordered.next_pos
  from ordered
  where es.event_id = p_event_id
    and es.id = ordered.signup_id;

  with ordered as (
    select signup_id, ord::integer as next_pos
    from unnest(p_ordered_signup_ids) with ordinality as u(signup_id, ord)
  )
  update public.event_signups es
  set queue_position = ordered.next_pos
  from ordered
  where es.event_id = p_event_id
    and es.id = ordered.signup_id;

  if p_actor_id is not null then
    select chapter_id
    into chapter_id
    from public.events
    where id = p_event_id;

    if chapter_id is not null then
      insert into public.audit_logs (
        chapter_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        payload
      )
      values (
        chapter_id,
        p_actor_id,
        'queue_reorder',
        'event',
        p_event_id,
        jsonb_build_object('count', provided_count)
      );
    end if;
  end if;
end;
$$;

drop policy if exists profiles_read_shared_chapter on public.profiles;
create policy profiles_read_shared_chapter
  on public.profiles
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.chapter_memberships me
      join public.chapter_memberships them
        on them.chapter_id = me.chapter_id
      where me.user_id = auth.uid()
        and them.user_id = profiles.user_id
        and not public.is_blocked(me.chapter_id, auth.uid(), profiles.user_id)
    )
  );

drop policy if exists signups_read_member on public.event_signups;
create policy signups_read_member
  on public.event_signups
  for select
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_signups.event_id
        and public.is_chapter_member(e.chapter_id)
        and not public.is_blocked(e.chapter_id, event_signups.user_id, auth.uid())
    )
  );

drop policy if exists signups_update_self_or_organizer on public.event_signups;
create policy signups_update_self_or_organizer
  on public.event_signups
  for update
  using (
    (
      user_id = auth.uid()
      and exists (
        select 1
        from public.event_sessions s
        where s.event_id = event_signups.event_id
          and s.status = 'open'
          and (s.opens_at is null or now() >= s.opens_at)
          and (s.closes_at is null or now() <= s.closes_at)
      )
    )
    or exists (
      select 1
      from public.events e
      where e.id = event_signups.event_id
        and public.is_chapter_organizer(e.chapter_id)
    )
  )
  with check (
    (
      user_id = auth.uid()
      and exists (
        select 1
        from public.event_sessions s
        where s.event_id = event_signups.event_id
          and s.status = 'open'
          and (s.opens_at is null or now() >= s.opens_at)
          and (s.closes_at is null or now() <= s.closes_at)
      )
    )
    or exists (
      select 1
      from public.events e
      where e.id = event_signups.event_id
        and public.is_chapter_organizer(e.chapter_id)
    )
  );

drop policy if exists requests_read_member on public.connection_requests;
create policy requests_read_member
  on public.connection_requests
  for select
  using (
    public.is_chapter_member(chapter_id)
    and not public.is_blocked(chapter_id, requester_id, target_user_id)
    and (
      requester_id = auth.uid()
      or target_user_id = auth.uid()
      or public.is_chapter_organizer(chapter_id)
      or status = 'accepted'
    )
  );

drop policy if exists conversations_read_participant on public.conversations;
create policy conversations_read_participant
  on public.conversations
  for select
  using (
    (user_a_id = auth.uid() or user_b_id = auth.uid())
    and not public.is_blocked(chapter_id, user_a_id, user_b_id)
  );

drop policy if exists messages_read_participant on public.messages;
create policy messages_read_participant
  on public.messages
  for select
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
        and not public.is_blocked(c.chapter_id, c.user_a_id, c.user_b_id)
    )
  );

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender
  on public.messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
        and not public.is_blocked(c.chapter_id, c.user_a_id, c.user_b_id)
    )
  );
