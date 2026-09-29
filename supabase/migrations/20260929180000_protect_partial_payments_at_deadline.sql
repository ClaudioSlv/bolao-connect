-- A reserva parcialmente paga exige conferência e devolução antes de liberar a vaga.
-- A rotina automática expira apenas reservas sem valores recebidos ou créditos aplicados.
create or replace function public.process_payment_deadlines(p_pool_id uuid,p_now timestamptz default now())
returns table(expired_ids uuid[],promoted_ids uuid[]) language plpgsql security definer set search_path=public as $$
declare v_pool public.pools%rowtype; v_expired uuid[]:='{}'; v_promoted uuid[]:='{}'; v_id uuid;
begin
 select * into v_pool from public.pools where id=p_pool_id for update;
 if not found then return query select v_expired,v_promoted; return; end if;
 if v_pool.payment_deadline is not null and p_now>v_pool.payment_deadline then
  with changed as (
   update public.participants p set status='expired',waitlist_position=null
   where p.pool_id=p_pool_id and p.status='confirmed' and p.payment_status<>'confirmed'
     and coalesce(p.is_test,false)=false and p.payment_deadline_override is null
     and not exists (select 1 from public.payments pay where pay.participant_id=p.id
       and pay.status in ('partial','confirmed') and (coalesce(pay.amount_cents,0)>0 or coalesce(pay.credit_used_cents,0)>0))
     and not exists (select 1 from public.payment_checkout_sessions checkout where checkout.participant_id=p.id
       and (checkout.status in ('processing','review_required') or
         (checkout.status in ('creating','pending') and checkout.qr_code_expires_at > p_now - interval '1 hour')))
   returning p.id
  ) select coalesce(array_agg(id),'{}'::uuid[]) into v_expired from changed;
 end if;
 if v_pool.waitlist_payment_deadline is not null and p_now>v_pool.waitlist_payment_deadline then
  with changed as (
   update public.participants p set status='expired',waitlist_position=null
   where p.pool_id=p_pool_id and p.status='confirmed' and p.payment_status<>'confirmed'
     and coalesce(p.is_test,false)=false and p.payment_deadline_override is not null and p_now>p.payment_deadline_override
     and not exists (select 1 from public.payments pay where pay.participant_id=p.id
       and pay.status in ('partial','confirmed') and (coalesce(pay.amount_cents,0)>0 or coalesce(pay.credit_used_cents,0)>0))
     and not exists (select 1 from public.payment_checkout_sessions checkout where checkout.participant_id=p.id
       and (checkout.status in ('processing','review_required') or
         (checkout.status in ('creating','pending') and checkout.qr_code_expires_at > p_now - interval '1 hour')))
   returning p.id
  ) select v_expired||coalesce(array_agg(id),'{}'::uuid[]) into v_expired from changed;
 end if;
 if v_pool.waitlist_payment_deadline is not null and p_now<=v_pool.waitlist_payment_deadline then
  loop v_id:=public.promote_next_waitlisted(p_pool_id); exit when v_id is null; v_promoted:=array_append(v_promoted,v_id); end loop;
 end if;
 return query select v_expired,v_promoted;
end; $$;

-- Corrige a cláusula antiga apenas nos bolões que ainda usam o texto correspondente.
update public.pools
set rules_text=replace(rules_text,
 'A reserva somente estará garantida quando houver o pagamento de pelo menos uma parte do valor da cota até a data limite estabelecida para o bolão.',
 'Pagamentos parciais mantêm a reserva durante o prazo, mas a participação somente será confirmada após a quitação de 100% do valor até a data e o horário limite informados para o bolão. Sem a quitação, a reserva poderá ser cancelada e a vaga oferecida à lista de espera. Os valores já pagos serão devolvidos conforme as condições de cancelamento informadas antes do pagamento.'),
 rules_version=coalesce(rules_version,4)+1
where rules_text like '%A reserva somente estará garantida quando houver o pagamento de pelo menos uma parte%';

-- A versão nova exige novo aceite antes do próximo pagamento.
update public.pools set rules_version=5
where rules_text is null and coalesce(rules_version,0)<5;
