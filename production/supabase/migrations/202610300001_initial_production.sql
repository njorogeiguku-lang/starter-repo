create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  client text not null check (char_length(client) between 1 and 200),
  project text not null check (char_length(project) between 1 and 200),
  service text not null check (char_length(service) between 1 and 200),
  step smallint not null default 0 check (step between 0 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index if not exists workflows_workspace_updated_idx on public.workflows(workspace_id, updated_at desc);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  workflow_id uuid,
  template text not null check (template in ('proposal', 'brief', 'kickoff')),
  title text not null check (char_length(title) between 1 and 300),
  client text not null check (char_length(client) between 1 and 200),
  project text not null default '',
  service text not null default '',
  content text not null check (octet_length(content) <= 80000),
  generated_by text not null default 'template' check (generated_by in ('template', 'openai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_workflow_workspace_fk foreign key (workspace_id, workflow_id) references public.workflows(workspace_id, id) on delete set null (workflow_id)
);
create index if not exists documents_workspace_updated_idx on public.documents(workspace_id, updated_at desc);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  event_type text not null check (char_length(event_type) between 1 and 100),
  details jsonb not null default '{}'::jsonb check (octet_length(details::text) <= 4000),
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_workspace_created_idx on public.audit_logs(workspace_id, created_at desc);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_edit_workspace(target_workspace uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.can_admin_workspace(target_workspace uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.can_edit_workspace(uuid) from public, anon;
revoke all on function public.can_admin_workspace(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.can_edit_workspace(uuid) to authenticated;
grant execute on function public.can_admin_workspace(uuid) to authenticated;

create or replace function public.create_workspace_for_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  requested_name text;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'workspace_name'), '');
  if requested_name is null then
    requested_name := coalesce(nullif(split_part(coalesce(new.email, 'My'), '@', 1), ''), 'My') || ' workspace';
  end if;
  insert into public.workspaces(name) values (left(requested_name, 80)) returning id into new_workspace_id;
  insert into public.workspace_members(workspace_id, user_id, role) values (new_workspace_id, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_flowforge on auth.users;
create trigger on_auth_user_created_flowforge
  after insert on auth.users
  for each row execute procedure public.create_workspace_for_new_user();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workflows enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;

grant select, update on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert, update, delete on public.workflows to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;

create policy workspaces_member_read on public.workspaces
  for select to authenticated using ((select public.is_workspace_member(id)));
create policy workspaces_admin_update on public.workspaces
  for update to authenticated using ((select public.can_admin_workspace(id)))
  with check ((select public.can_admin_workspace(id)));

create policy members_workspace_read on public.workspace_members
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_workspace_member(workspace_id)));

create policy workflows_member_read on public.workflows
  for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy workflows_editor_insert on public.workflows
  for insert to authenticated with check (
    created_by = (select auth.uid()) and (select public.can_edit_workspace(workspace_id))
  );
create policy workflows_editor_update on public.workflows
  for update to authenticated using ((select public.can_edit_workspace(workspace_id)))
  with check ((select public.can_edit_workspace(workspace_id)));
create policy workflows_editor_delete on public.workflows
  for delete to authenticated using ((select public.can_edit_workspace(workspace_id)));

create policy documents_member_read on public.documents
  for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy documents_editor_insert on public.documents
  for insert to authenticated with check (
    created_by = (select auth.uid()) and (select public.can_edit_workspace(workspace_id))
  );
create policy documents_editor_update on public.documents
  for update to authenticated using ((select public.can_edit_workspace(workspace_id)))
  with check ((select public.can_edit_workspace(workspace_id)));
create policy documents_editor_delete on public.documents
  for delete to authenticated using ((select public.can_edit_workspace(workspace_id)));

create policy audit_member_read on public.audit_logs
  for select to authenticated using ((select public.can_admin_workspace(workspace_id)));
create policy audit_member_insert on public.audit_logs
  for insert to authenticated with check (
    actor_id = (select auth.uid()) and (select public.is_workspace_member(workspace_id))
  );

comment on table public.audit_logs is 'Append-only application audit events; no authenticated update or delete policy is granted.';
comment on table public.documents is 'Client documents are isolated by workspace membership through RLS.';
