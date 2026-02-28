insert into public.chapters (slug, name, timezone, status)
values ('oslo', 'Open Coffee Oslo', 'Europe/Oslo', 'active')
on conflict (slug) do update set
  name = excluded.name,
  timezone = excluded.timezone,
  status = excluded.status;

-- Optional bootstrap: promote known account to organizer role for Oslo.
do $$
declare
  organizer_id uuid;
  oslo_id uuid;
begin
  select id into organizer_id from auth.users where email = 'organizer@opencoff.ee' limit 1;
  select id into oslo_id from public.chapters where slug = 'oslo' limit 1;

  if organizer_id is not null and oslo_id is not null then
    insert into public.profiles (user_id, display_name)
    values (organizer_id, 'Oslo Organizer')
    on conflict (user_id) do update set display_name = excluded.display_name;

    insert into public.chapter_memberships (chapter_id, user_id, role)
    values (oslo_id, organizer_id, 'organizer')
    on conflict (chapter_id, user_id) do update set role = excluded.role;
  end if;
end $$;
