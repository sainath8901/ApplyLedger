-- ApplyLedger v2. Run once in a NEW Supabase project's SQL editor.
-- Owner identity is configured in a private table, never in a client-supplied role.
begin;
create schema if not exists ledger_private;
revoke all on schema ledger_private from public, anon, authenticated;
create table ledger_private.settings (
 singleton boolean primary key default true check(singleton),
 owner_email text not null,
 owner_id uuid unique references auth.users(id)
);
alter table ledger_private.settings enable row level security;
insert into ledger_private.settings(owner_email) values ('sainathreddy8901@gmail.com');
create table public.ledger_profiles (
 id uuid primary key references auth.users(id),
 email text not null,
 name text not null,
 role text not null default 'member' check(role in ('member','admin','owner')),
 active boolean not null default true,
 joined_at timestamptz not null default now()
);
create unique index ledger_one_owner on public.ledger_profiles(role) where role='owner';
create table public.ledger_devices (
 user_id uuid not null references public.ledger_profiles(id),
 device_id text not null check(length(device_id) between 1 and 100),
 payload jsonb not null,
 synced_at timestamptz not null default now(),
 primary key(user_id,device_id)
);
create table public.ledger_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.ledger_profiles(id),
 reason text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references public.ledger_profiles(id)
);
create unique index ledger_one_pending on public.ledger_requests(user_id) where status='pending';
create table public.ledger_notices (
 id bigint generated always as identity primary key,
 kind text not null,
 user_id uuid references public.ledger_profiles(id),
 message text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create table public.ledger_audit (
 id bigint generated always as identity primary key,
 actor uuid references public.ledger_profiles(id),
 target uuid references public.ledger_profiles(id),
 action text not null,
 created_at timestamptz not null default now()
);
alter table public.ledger_profiles enable row level security;
alter table public.ledger_devices enable row level security;
alter table public.ledger_requests enable row level security;
alter table public.ledger_notices enable row level security;
alter table public.ledger_audit enable row level security;
-- All table access is denied. The API consists only of the checked RPCs below.
revoke all on public.ledger_profiles,public.ledger_devices,public.ledger_requests,public.ledger_notices,public.ledger_audit from anon,authenticated;
revoke all on all sequences in schema public from anon,authenticated;

create function ledger_private.current_role() returns text
language sql stable security definer set search_path='' as $$
 select p.role from public.ledger_profiles p
 where p.id=auth.uid() and p.active and auth.jwt()->'app_metadata'->>'provider'='google';
$$;
create function ledger_private.require_role(allowed text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(ledger_private.current_role()=any(allowed),false)=false then
  raise exception 'Access denied' using errcode='42501';
 end if;
end;
$$;

create function public.ledger_me() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u auth.users; p public.ledger_profiles; owner ledger_private.settings; assigned text; inserted boolean=false;
begin
 select * into u from auth.users where id=auth.uid();
 if u.id is null or u.email_confirmed_at is null or auth.jwt()->'app_metadata'->>'provider' is distinct from 'google'
    or not exists(select 1 from auth.identities where user_id=u.id and provider='google') then
  raise exception 'Sign in with a verified Google account' using errcode='42501';
 end if;
 select * into owner from ledger_private.settings where singleton for update;
 if owner.owner_id is null and lower(u.email)=lower(owner.owner_email) then
  update ledger_private.settings set owner_id=u.id where singleton;
  owner.owner_id=u.id;
 end if;
 assigned=case when owner.owner_id=u.id then 'owner' else 'member' end;
 insert into public.ledger_profiles(id,email,name,role) values(u.id,lower(u.email),left(coalesce(nullif(u.raw_user_meta_data->>'full_name',''),u.email),100),assigned)
 on conflict(id) do nothing;
 inserted=found;
 select * into p from public.ledger_profiles where id=u.id;
 if not p.active then raise exception 'Your workspace access has been disabled' using errcode='42501'; end if;
 if inserted and assigned<>'owner' then
  insert into public.ledger_notices(kind,user_id,message) values('signup',u.id,p.name||' joined as a member');
 end if;
 return to_jsonb(p);
end;
$$;

create function public.ledger_request_admin(p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare p public.ledger_profiles;
begin
 perform ledger_private.require_role(array['member']);
 select * into p from public.ledger_profiles where id=auth.uid();
 if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>1000 then raise exception 'Explain why you need admin access (5–1000 characters)'; end if;
 if exists(select 1 from public.ledger_requests where user_id=p.id and created_at>now()-interval '1 day') then raise exception 'You can submit one admin request per day';end if;
 insert into public.ledger_requests(user_id,reason) values(p.id,trim(p_reason));
 insert into public.ledger_notices(kind,user_id,message) values('admin_request',p.id,p.name||' requested administrator access');
end;
$$;
create function public.ledger_my_requests() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform ledger_private.require_role(array['member','admin','owner']);
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.ledger_requests r where user_id=auth.uid()),'[]'::jsonb);
end;
$$;
create function public.ledger_decide_admin(p_request uuid,p_approve boolean) returns void
language plpgsql security definer set search_path='' as $$
declare r public.ledger_requests;
begin
 perform ledger_private.require_role(array['owner']);
 select * into r from public.ledger_requests where id=p_request for update;
 if r.id is null or r.status<>'pending' then raise exception 'Request is no longer pending';end if;
 if p_approve is null then raise exception 'Decision required';end if;
 if p_approve then
  update public.ledger_profiles set role='admin' where id=r.user_id and role='member' and active;
  if not found then raise exception 'Member is not eligible for promotion';end if;
 end if;
 update public.ledger_requests set status=case when p_approve then 'approved' else 'rejected' end,decided_at=now(),decided_by=auth.uid() where id=r.id;
 insert into public.ledger_audit(actor,target,action) values(auth.uid(),r.user_id,case when p_approve then 'Approved admin request' else 'Rejected admin request' end);
end;
$$;
create function public.ledger_set_admin(p_user uuid,p_admin boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform ledger_private.require_role(array['owner']);
 if p_user=auth.uid() or p_admin is null then raise exception 'Owner role cannot be changed';end if;
 update public.ledger_profiles set role=case when p_admin then 'admin' else 'member' end where id=p_user and role<>'owner' and active;
 if not found then raise exception 'Member not found';end if;
 update public.ledger_requests set status=case when p_admin then 'approved' else 'rejected' end,decided_at=now(),decided_by=auth.uid() where user_id=p_user and status='pending';
 insert into public.ledger_audit(actor,target,action) values(auth.uid(),p_user,case when p_admin then 'Granted administrator access' else 'Revoked administrator access' end);
end;
$$;
create function public.ledger_inbox() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform ledger_private.require_role(array['owner']);
 return jsonb_build_object(
  'notices',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (select * from public.ledger_notices order by created_at desc limit 100) n),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('name',p.name,'email',p.email) order by r.created_at) from public.ledger_requests r join public.ledger_profiles p on p.id=r.user_id where r.status='pending'),'[]'::jsonb),
  'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.ledger_audit order by created_at desc limit 100) a),'[]'::jsonb));
end;
$$;
create function public.ledger_read_notice(p_id bigint) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform ledger_private.require_role(array['owner']);
 update public.ledger_notices set read_at=now() where id=p_id and read_at is null;
end;
$$;

create function public.ledger_sync(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous jsonb; j jsonb; old_job jsonb; new_job jsonb; event jsonb; ids text[]='{}'; device text; ix integer;
begin
 perform ledger_private.require_role(array['member','admin','owner']);
 if p_payload->>'format' is distinct from 'applyledger-1' or jsonb_typeof(p_payload->'jobs') is distinct from 'array'
 or jsonb_typeof(p_payload->'profiles') is distinct from 'array' then raise exception 'Invalid snapshot';end if;
 device=p_payload->>'deviceId';
 if device is null or length(device) not between 1 and 100 or octet_length(p_payload::text)>10000000
 or jsonb_array_length(p_payload->'jobs')>10000 or jsonb_array_length(p_payload->'profiles')<>1
 or p_payload->'profiles'->0->>'id' is distinct from auth.uid()::text then raise exception 'Invalid snapshot owner or size';end if;
 perform (p_payload->>'exportedAt')::timestamptz;
 for j in select value from jsonb_array_elements(p_payload->'jobs') loop
  if j->>'id' is null or length(j->>'id') not between 1 and 100 or j->>'id'=any(ids)
   or j->>'profileId' is distinct from auth.uid()::text or j->>'source' not in ('auto','manual')
   or j->>'source' is null or jsonb_typeof(j->'history') is distinct from 'array'
   or j->>'title' is null or length(j->>'title')>300 or j->>'company' is null or length(j->>'company')>300
   or j->>'createdAt' is null then raise exception 'Invalid job';end if;
  ids=array_append(ids,j->>'id');
  perform (j->>'createdAt')::timestamptz;
  if jsonb_array_length(j->'history') not between 1 and 1000 then raise exception 'Invalid history';end if;
  for event in select value from jsonb_array_elements(j->'history') loop
   if event->>'status' is null or event->>'status' not in ('Saved','In progress','Needs confirmation','Submitted','Applied','Reviewing','Screening','Interview','Offer','Accepted','Rejected','Withdrawn')
    or event->>'at' is null or length(coalesce(event->>'note',''))>1000 then raise exception 'Invalid event';end if;
   perform (event->>'at')::timestamptz;
  end loop;
 end loop;
 -- Serialize updates for the same account/device, including its first upload.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||device,0));
 select payload into previous from public.ledger_devices where user_id=auth.uid() and device_id=device for update;
 if previous is not null then
  if (previous->>'exportedAt')::timestamptz>(p_payload->>'exportedAt')::timestamptz then raise exception 'Snapshot is older than the last sync';end if;
  for old_job in select value from jsonb_array_elements(previous->'jobs') loop
   select value into new_job from jsonb_array_elements(p_payload->'jobs') where value->>'id'=old_job->>'id';
   if new_job is null then raise exception 'Synced records cannot be removed';end if;
   if new_job->>'createdAt' is distinct from old_job->>'createdAt' then raise exception 'Recorded date cannot change';end if;
   if old_job->>'source'='auto' and (new_job->>'source' is distinct from 'auto' or new_job->>'title' is distinct from old_job->>'title' or new_job->>'company' is distinct from old_job->>'company' or new_job->>'url' is distinct from old_job->>'url') then raise exception 'Captured details are locked';end if;
   if jsonb_array_length(new_job->'history')<jsonb_array_length(old_job->'history') then raise exception 'History cannot be removed';end if;
   for ix in 0..jsonb_array_length(old_job->'history')-1 loop
    if old_job->'history'->ix is distinct from new_job->'history'->ix then raise exception 'History cannot be rewritten';end if;
   end loop;
  end loop;
 end if;
 insert into public.ledger_devices(user_id,device_id,payload) values(auth.uid(),device,p_payload)
 on conflict(user_id,device_id) do update set payload=excluded.payload,synced_at=now();
 return jsonb_build_object('syncedAt',now());
end;
$$;

create function public.ledger_admin_data() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform ledger_private.require_role(array['admin','owner']);
 return jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object(
  'synced_at',(select max(d.synced_at) from public.ledger_devices d where d.user_id=p.id),
  'snapshot',jsonb_build_object('jobs',coalesce((select jsonb_agg(j.value) from public.ledger_devices d cross join lateral jsonb_array_elements(d.payload->'jobs') j where d.user_id=p.id),'[]'::jsonb))) order by p.name)
 from public.ledger_profiles p),'[]'::jsonb));
end;
$$;
-- SECURITY DEFINER functions default to PUBLIC execution: explicitly close that access.
revoke all on all functions in schema ledger_private from public,anon,authenticated;
revoke all on function public.ledger_me(),public.ledger_request_admin(text),public.ledger_my_requests(),public.ledger_decide_admin(uuid,boolean),public.ledger_set_admin(uuid,boolean),public.ledger_inbox(),public.ledger_read_notice(bigint),public.ledger_sync(jsonb),public.ledger_admin_data() from public,anon;
grant execute on function public.ledger_me(),public.ledger_request_admin(text),public.ledger_my_requests(),public.ledger_decide_admin(uuid,boolean),public.ledger_set_admin(uuid,boolean),public.ledger_inbox(),public.ledger_read_notice(bigint),public.ledger_sync(jsonb),public.ledger_admin_data() to authenticated;
commit;
