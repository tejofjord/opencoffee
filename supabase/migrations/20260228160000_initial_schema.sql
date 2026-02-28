create extension if not exists pgcrypto;

create type public.chapter_status as enum ('active', 'paused');
create type public.member_role as enum ('member', 'organizer', 'admin');
create type public.event_status as enum ('draft', 'published', 'cancelled');
create type public.session_status as enum ('open', 'closed');
create type public.signup_status as enum ('queued', 'presented', 'skipped');
create type public.request_type as enum ('need_help', 'can_help');
create type public.request_status as enum ('pending', 'accepted', 'declined', 'cancelled');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.notification_status as enum ('pending', 'sent', 'failed');

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'Europe/Oslo',
  status public.chapter_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bio text,
  website_url text,
  linkedin_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chapter_memberships (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique(chapter_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  title text not null,
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.event_status not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_valid_window check (ends_at > starts_at)
);

create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  status public.session_status not null default 'closed',
  opens_at timestamptz,
  closes_at timestamptz,
  qr_token_hash text,
  pin_hash text,
  chunk_size integer not null default 10,
  current_chunk_start integer not null default 0,
  active_signup_id uuid,
  timer_started_at timestamptz,
  timer_elapsed_seconds integer not null default 0,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_sessions_chunk_size check (chunk_size > 0 and chunk_size <= 50),
  constraint event_sessions_chunk_start check (current_chunk_start >= 0),
  constraint event_sessions_timer_elapsed check (timer_elapsed_seconds >= 0)
);

create table public.event_signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  who text not null,
  project text not null,
  need text not null,
  can_help text not null,
  website_url text,
  linkedin_url text,
  short_bio text,
  queue_position integer not null,
  status public.signup_status not null default 'queued',
  presented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, user_id),
  unique(event_id, queue_position),
  constraint event_signups_queue_positive check (queue_position > 0)
);

alter table public.event_sessions
  add constraint event_sessions_active_signup_fk
  foreign key (active_signup_id) references public.event_signups(id) on delete set null;

create table public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  requester_id uuid not null references public.profiles(user_id) on delete cascade,
  target_user_id uuid not null references public.profiles(user_id) on delete cascade,
  request_type public.request_type not null,
  message text,
  status public.request_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint connection_requests_not_self check (requester_id <> target_user_id)
);

create unique index connection_requests_pending_unique
  on public.connection_requests (chapter_id, requester_id, target_user_id, request_type)
  where status = 'pending';

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  user_a_id uuid not null references public.profiles(user_id) on delete cascade,
  user_b_id uuid not null references public.profiles(user_id) on delete cascade,
  created_from_request_id uuid unique references public.connection_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint conversations_not_self check (user_a_id <> user_b_id),
  constraint conversations_sorted_pair check (user_a_id::text < user_b_id::text),
  unique(chapter_id, user_a_id, user_b_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_not_empty check (length(trim(body)) > 0)
);

create table public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  blocker_id uuid not null references public.profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_not_self check (blocker_id <> blocked_id),
  unique(chapter_id, blocker_id, blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  reporter_id uuid not null references public.profiles(user_id) on delete cascade,
  reported_user_id uuid not null references public.profiles(user_id) on delete cascade,
  reason text not null,
  context text,
  status public.report_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles(user_id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_not_self check (reporter_id <> reported_user_id)
);

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  run_at timestamptz not null,
  status public.notification_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  actor_id uuid references public.profiles(user_id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index chapter_memberships_user_idx on public.chapter_memberships (user_id, chapter_id);
create index events_chapter_start_idx on public.events (chapter_id, starts_at);
create index event_signups_event_queue_idx on public.event_signups (event_id, queue_position);
create index connection_requests_chapter_status_idx on public.connection_requests (chapter_id, status, created_at desc);
create index conversations_chapter_idx on public.conversations (chapter_id, created_at desc);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index reports_chapter_status_idx on public.reports (chapter_id, status, created_at desc);
create index notification_jobs_status_run_idx on public.notification_jobs (status, run_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger chapters_set_updated_at
before update on public.chapters
for each row execute procedure public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute procedure public.set_updated_at();

create trigger sessions_set_updated_at
before update on public.event_sessions
for each row execute procedure public.set_updated_at();

create trigger signups_set_updated_at
before update on public.event_signups
for each row execute procedure public.set_updated_at();

create trigger notification_jobs_set_updated_at
before update on public.notification_jobs
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

create or replace function public.is_chapter_member(chapter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chapter_memberships cm
    where cm.chapter_id = chapter
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_chapter_organizer(chapter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chapter_memberships cm
    where cm.chapter_id = chapter
      and cm.user_id = auth.uid()
      and cm.role in ('organizer', 'admin')
  );
$$;

alter table public.chapters enable row level security;
alter table public.profiles enable row level security;
alter table public.chapter_memberships enable row level security;
alter table public.events enable row level security;
alter table public.event_sessions enable row level security;
alter table public.event_signups enable row level security;
alter table public.connection_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.audit_logs enable row level security;

create policy chapters_read_member
  on public.chapters
  for select
  using (public.is_chapter_member(id));

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
    )
  );

create policy profiles_write_own
  on public.profiles
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy memberships_read_chapter
  on public.chapter_memberships
  for select
  using (public.is_chapter_member(chapter_id));

create policy memberships_insert_organizer
  on public.chapter_memberships
  for insert
  with check (
    public.is_chapter_organizer(chapter_id)
    or user_id = auth.uid()
  );

create policy memberships_update_admin
  on public.chapter_memberships
  for update
  using (public.is_chapter_organizer(chapter_id))
  with check (public.is_chapter_organizer(chapter_id));

create policy events_read_member
  on public.events
  for select
  using (public.is_chapter_member(chapter_id));

create policy events_write_organizer
  on public.events
  for all
  using (public.is_chapter_organizer(chapter_id))
  with check (public.is_chapter_organizer(chapter_id));

create policy sessions_read_member
  on public.event_sessions
  for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_sessions.event_id
        and public.is_chapter_member(e.chapter_id)
    )
  );

create policy sessions_write_organizer
  on public.event_sessions
  for all
  using (
    exists (
      select 1 from public.events e
      where e.id = event_sessions.event_id
        and public.is_chapter_organizer(e.chapter_id)
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_sessions.event_id
        and public.is_chapter_organizer(e.chapter_id)
    )
  );

create policy signups_read_member
  on public.event_signups
  for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_signups.event_id
        and public.is_chapter_member(e.chapter_id)
    )
  );

create policy signups_insert_self
  on public.event_signups
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = event_signups.event_id
        and public.is_chapter_member(e.chapter_id)
    )
  );

create policy signups_update_self_or_organizer
  on public.event_signups
  for update
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_signups.event_id
        and public.is_chapter_organizer(e.chapter_id)
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_signups.event_id
        and public.is_chapter_organizer(e.chapter_id)
    )
  );

create policy requests_read_member
  on public.connection_requests
  for select
  using (
    public.is_chapter_member(chapter_id)
    and (requester_id = auth.uid() or target_user_id = auth.uid() or public.is_chapter_organizer(chapter_id))
  );

create policy requests_insert_self
  on public.connection_requests
  for insert
  with check (
    requester_id = auth.uid()
    and public.is_chapter_member(chapter_id)
  );

create policy requests_update_target_or_organizer
  on public.connection_requests
  for update
  using (target_user_id = auth.uid() or public.is_chapter_organizer(chapter_id))
  with check (target_user_id = auth.uid() or public.is_chapter_organizer(chapter_id));

create policy conversations_read_participant
  on public.conversations
  for select
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

create policy conversations_insert_participant
  on public.conversations
  for insert
  with check (
    public.is_chapter_member(chapter_id)
    and (user_a_id = auth.uid() or user_b_id = auth.uid() or public.is_chapter_organizer(chapter_id))
  );

create policy messages_read_participant
  on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  );

create policy messages_insert_sender
  on public.messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  );

create policy blocks_read_self
  on public.user_blocks
  for select
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

create policy blocks_insert_self
  on public.user_blocks
  for insert
  with check (blocker_id = auth.uid() and public.is_chapter_member(chapter_id));

create policy reports_insert_self
  on public.reports
  for insert
  with check (reporter_id = auth.uid() and public.is_chapter_member(chapter_id));

create policy reports_read_reporter_or_organizer
  on public.reports
  for select
  using (
    reporter_id = auth.uid()
    or public.is_chapter_organizer(chapter_id)
  );

create policy reports_update_organizer
  on public.reports
  for update
  using (public.is_chapter_organizer(chapter_id))
  with check (public.is_chapter_organizer(chapter_id));

create policy notification_jobs_read_own
  on public.notification_jobs
  for select
  using (user_id = auth.uid());

create policy audit_logs_read_organizer
  on public.audit_logs
  for select
  using (public.is_chapter_organizer(chapter_id));
