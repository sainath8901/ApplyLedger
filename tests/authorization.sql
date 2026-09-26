-- Run only against the disposable local database described in tests/README.md.
\set ON_ERROR_STOP on
create function pg_temp.expect_denied(command text) returns void language plpgsql as $$
begin
 begin execute command; exception when insufficient_privilege then return; end;
 raise exception 'Expected permission denial for %',command;
end;
$$;
create function pg_temp.expect_error(command text) returns void language plpgsql as $$
begin
 begin execute command; exception when others then return; end;
 raise exception 'Expected rejection for %',command;
end;
$$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','member@gmail.com',now(),'{"full_name":"Member","role":"owner"}'),
 ('22222222-2222-4222-8222-222222222222','sainathreddy8901@gmail.com',now(),'{"full_name":"Owner"}'),
 ('33333333-3333-4333-8333-333333333333','second@gmail.com',now(),'{"full_name":"Second member"}');
insert into auth.identities select id,'google' from auth.users;
set role authenticated;
select set_config('request.jwt.claims','{"app_metadata":{"provider":"google"}}',false);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$begin
 if public.ledger_me()->>'role'<>'member' then raise exception 'First signup must not become admin';end if;
end$$;
select pg_temp.expect_denied('select public.ledger_admin_data()');
select pg_temp.expect_denied('select public.ledger_inbox()');
select pg_temp.expect_denied('select * from public.ledger_profiles');
select pg_temp.expect_denied('update public.ledger_profiles set role=''owner''');
select pg_temp.expect_denied('select * from ledger_private.settings');
select pg_temp.expect_denied('select public.ledger_set_admin(''11111111-1111-4111-8111-111111111111'',true)');
select public.ledger_request_admin('I need to review team applications.');
select pg_temp.expect_error('select public.ledger_request_admin(''Repeated request'')');
do $$declare p jsonb; tampered jsonb;
begin
 p=jsonb_build_object('format','applyledger-1','deviceId','test-device','exportedAt',now(),'profiles',jsonb_build_array(jsonb_build_object('id',auth.uid(),'name','Member')),'jobs',jsonb_build_array(jsonb_build_object('id','job-1','profileId',auth.uid(),'source','auto','title','Engineer','company','Test','url','https://example.com/job/1','createdAt','2026-09-26T10:00:00Z','history',jsonb_build_array(jsonb_build_object('status','Saved','at','2026-09-26T10:00:00Z','note','Saved page')))));
 perform public.ledger_sync(p);
 p=jsonb_set(p,'{jobs,0,history}',(p#>'{jobs,0,history}')||jsonb_build_array(jsonb_build_object('status','Submitted','at','2026-09-26T10:10:00Z','note','Confirmed')));
 perform public.ledger_sync(p);
 tampered=jsonb_set(p,'{jobs,0,title}','"Changed"');perform pg_temp.expect_error(format('select public.ledger_sync(%L::jsonb)',tampered));
 tampered=jsonb_set(p,'{jobs,0,history,0,note}','"Changed"');perform pg_temp.expect_error(format('select public.ledger_sync(%L::jsonb)',tampered));
 tampered=jsonb_set(p,'{jobs}','[]');perform pg_temp.expect_error(format('select public.ledger_sync(%L::jsonb)',tampered));
 tampered=jsonb_set(p,'{profiles,0,id}','"22222222-2222-4222-8222-222222222222"');perform pg_temp.expect_error(format('select public.ledger_sync(%L::jsonb)',tampered));
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$declare inbox jsonb; request uuid;
begin
 if public.ledger_me()->>'role'<>'owner' then raise exception 'Configured owner not recognized';end if;
 inbox=public.ledger_inbox();
 if jsonb_array_length(inbox->'notices')<>2 then raise exception 'Expected signup and admin-request notices';end if;
 request=(inbox->'requests'->0->>'id')::uuid;
 perform public.ledger_decide_admin(request,true);
 perform public.ledger_read_notice((inbox->'notices'->0->>'id')::bigint);
 if jsonb_array_length(public.ledger_admin_data()->'members')<>2 then raise exception 'Admin team listing wrong';end if;
end$$;
select pg_temp.expect_error('select public.ledger_set_admin(''22222222-2222-4222-8222-222222222222'',false)');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$begin
 if public.ledger_me()->>'role'<>'admin' then raise exception 'Approval failed';end if;
 perform public.ledger_admin_data();
end$$;
select pg_temp.expect_denied('select public.ledger_set_admin(''33333333-3333-4333-8333-333333333333'',true)');
select pg_temp.expect_denied('select public.ledger_inbox()');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.ledger_me();
select public.ledger_request_admin('Request that will be rejected.');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$declare r uuid;
begin
 r=(public.ledger_inbox()->'requests'->0->>'id')::uuid;
 perform public.ledger_decide_admin(r,false);
 perform public.ledger_set_admin('11111111-1111-4111-8111-111111111111',false);
end$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.expect_denied('select public.ledger_admin_data()');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$begin
 if public.ledger_my_requests()->0->>'status'<>'rejected' then raise exception 'Rejection not recorded';end if;
end$$;
select set_config('request.jwt.claims','{"app_metadata":{"provider":"email"}}',false);
select pg_temp.expect_denied('select public.ledger_me()');
set role anon;
select pg_temp.expect_denied('select public.ledger_me()');
select pg_temp.expect_denied('select public.ledger_admin_data()');
reset role;
select 'All database authorization and integrity checks passed' as result;
