-- O extrato registra a saída uma única vez, quando a Efí confirma DEVOLVIDO.
create unique index if not exists wallet_one_efi_refund_per_payment
  on public.wallet_transactions(payment_id) where type='refund';

create or replace function public.record_efi_refund_completion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status='completed' and old.status is distinct from 'completed' then
    insert into public.wallet_transactions(pool_id,payment_id,type,amount_cents,shares,description,created_by)
    select p.pool_id,p.id,'refund',-new.refund_cents,0,
      'Devolução Pix confirmada pela Efí',pool.owner_id
    from public.payments p join public.pools pool on pool.id=p.pool_id
    where p.id=new.payment_id
    on conflict do nothing;
  end if;
  return new;
end; $$;
create trigger record_efi_refund_completion_after_update
after update of status on public.efi_refund_items
for each row execute function public.record_efi_refund_completion();
revoke all on function public.record_efi_refund_completion() from public,anon,authenticated;
