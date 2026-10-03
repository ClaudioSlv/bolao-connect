-- All fixtures roll back; this exercises the actual database triggers.
begin;
create function pg_temp.expect_blocked(command text) returns void language plpgsql as $$
begin
 begin execute command;
 exception when raise_exception or insufficient_privilege then return;
 end;
 raise exception 'Expected operation to be blocked: %',command;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select owner_id from public.pools limit 1))::text,true);
insert into public.pools(id,owner_id,title,lottery,share_price_cents,total_shares,payment_deadline,status,public_slug)
select '00000000-0000-0000-0000-00000000cc01',owner_id,'Fixture de fechamento','lotofacil',3500,50,now()+interval '1 hour','open','fixture-roster-'||gen_random_uuid() from public.pools limit 1;
insert into public.participants(id,pool_id,name,shares,status,payment_status) values
('00000000-0000-0000-0000-00000000cc11','00000000-0000-0000-0000-00000000cc01','Pago no prazo',1,'confirmed','pending'),
('00000000-0000-0000-0000-00000000cc12','00000000-0000-0000-0000-00000000cc01','Não pago',1,'confirmed','pending'),
('00000000-0000-0000-0000-00000000cc13','00000000-0000-0000-0000-00000000cc01','Pix em conciliação',1,'confirmed','pending'),
('00000000-0000-0000-0000-00000000cc14','00000000-0000-0000-0000-00000000cc01','Espera',1,'waitlisted','pending');
insert into public.payments(pool_id,participant_id,amount_cents,gross_amount_cents,status,payment_method,confirmed_at)
values('00000000-0000-0000-0000-00000000cc01','00000000-0000-0000-0000-00000000cc11',3500,3500,'confirmed','cash',now());
update public.participants set payment_status='confirmed' where id='00000000-0000-0000-0000-00000000cc11';
select public.close_pool_roster('00000000-0000-0000-0000-00000000cc01');
do $$begin if exists(select 1 from public.pool_closed_rosters where pool_id='00000000-0000-0000-0000-00000000cc01') then raise exception 'Roster appeared before deadline'; end if; end$$;
insert into public.payment_checkout_sessions(pool_id,participant_id,provider,order_nsu,provider_order_id,gross_amount_cents,expected_amount_cents,status,transaction_nsu,created_at)
values('00000000-0000-0000-0000-00000000cc01','00000000-0000-0000-0000-00000000cc13','efi','fixture-nsu-'||gen_random_uuid(),'fixture-roster-txid',3500,3500,'processing','fixture-roster-e2e',now()-interval '2 hours');
update public.pools set payment_deadline=now()-interval '1 hour' where id='00000000-0000-0000-0000-00000000cc01';
select pg_temp.expect_blocked($q$update public.participants set payment_status='confirmed' where id='00000000-0000-0000-0000-00000000cc12'$q$);
select pg_temp.expect_blocked($q$update public.participants set notes='Mudança' where id='00000000-0000-0000-0000-00000000cc12'$q$);
select pg_temp.expect_blocked($q$update public.participants set name='Outro nome' where id='00000000-0000-0000-0000-00000000cc11'$q$);
select pg_temp.expect_blocked($q$update public.participants set shares=2 where id='00000000-0000-0000-0000-00000000cc11'$q$);
select pg_temp.expect_blocked($q$update public.participants set status='confirmed',payment_status='confirmed' where id='00000000-0000-0000-0000-00000000cc14'$q$);
select pg_temp.expect_blocked($q$update public.participants set payment_deadline_override=now()+interval '1 day' where id='00000000-0000-0000-0000-00000000cc12'$q$);
select pg_temp.expect_blocked($q$delete from public.participants where id='00000000-0000-0000-0000-00000000cc11'$q$);
select pg_temp.expect_blocked($q$insert into public.payments(pool_id,participant_id,amount_cents,status) values('00000000-0000-0000-0000-00000000cc01','00000000-0000-0000-0000-00000000cc12',3500,'confirmed')$q$);
select pg_temp.expect_blocked($q$update public.payments set amount_cents=1 where participant_id='00000000-0000-0000-0000-00000000cc11'$q$);
select pg_temp.expect_blocked($q$delete from public.payments where participant_id='00000000-0000-0000-0000-00000000cc11'$q$);
select pg_temp.expect_blocked($q$update public.pools set payment_deadline=now()+interval '1 day' where id='00000000-0000-0000-0000-00000000cc01'$q$);
select pg_temp.expect_blocked($q$update public.pools set waitlist_payment_deadline=now()+interval '1 day' where id='00000000-0000-0000-0000-00000000cc01'$q$);
select pg_temp.expect_blocked($q$delete from public.pools where id='00000000-0000-0000-0000-00000000cc01'$q$);
do $$begin if public.promote_next_waitlisted('00000000-0000-0000-0000-00000000cc01') is not null then raise exception 'Waitlist reopened'; end if; end$$;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.close_pool_roster('00000000-0000-0000-0000-00000000cc01');
select public.close_pool_roster('00000000-0000-0000-0000-00000000cc01');
do $$begin if (select count(*) from public.pool_closed_roster_entries where pool_id='00000000-0000-0000-0000-00000000cc01')<>1 then raise exception 'Roster includes unpaid or duplicate participants'; end if; end$$;
select pg_temp.expect_blocked($q$update public.pool_closed_roster_entries set name='Alterado' where pool_id='00000000-0000-0000-0000-00000000cc01'$q$);
select pg_temp.expect_blocked($q$delete from public.pool_closed_rosters where pool_id='00000000-0000-0000-0000-00000000cc01'$q$);
select pg_temp.expect_blocked($q$update public.participants set payment_status='confirmed' where id='00000000-0000-0000-0000-00000000cc12'$q$);
select pg_temp.expect_blocked($q$insert into public.payments(pool_id,participant_id,amount_cents,status,provider,provider_reference,provider_transaction_nsu,provider_paid_at) values('00000000-0000-0000-0000-00000000cc01','00000000-0000-0000-0000-00000000cc13',3500,'confirmed','efi','fixture-roster-txid','fixture-roster-e2e',now())$q$);
insert into public.payments(pool_id,participant_id,amount_cents,gross_amount_cents,status,provider,provider_reference,provider_transaction_nsu,provider_paid_at)
values('00000000-0000-0000-0000-00000000cc01','00000000-0000-0000-0000-00000000cc13',3500,3500,'confirmed','efi','fixture-roster-txid','fixture-roster-e2e',now()-interval '90 minutes');
update public.participants set payment_status='confirmed' where id='00000000-0000-0000-0000-00000000cc13';
do $$begin
 if (select count(*) from public.pool_closed_roster_entries where pool_id='00000000-0000-0000-0000-00000000cc01')<>2 then raise exception 'Missing verified late bank confirmation'; end if;
 if not exists(select 1 from public.pool_closed_roster_entries where participant_id='00000000-0000-0000-0000-00000000cc13' and late_bank_confirmation) then raise exception 'Missing bank reconciliation label'; end if;
 if has_table_privilege('anon','public.pool_closed_roster_entries','SELECT') or has_table_privilege('authenticated','public.pool_closed_roster_entries','SELECT') then raise exception 'Roster is publicly readable'; end if;
 if has_function_privilege('authenticated','public.close_pool_roster(uuid)','EXECUTE') then raise exception 'Organizer can call privileged closure'; end if;
end$$;
rollback;
select 'passed: deadline locks, immutable list, verified bank exception, private access; fixtures rolled back' as result;
