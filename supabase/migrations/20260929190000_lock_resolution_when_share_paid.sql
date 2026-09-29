-- O pagamento confirmado e a devolução do mesmo valor são mutuamente exclusivos.
alter table public.partial_payment_resolution_choices
  drop constraint if exists partial_payment_resolution_choices_status_check;
alter table public.partial_payment_resolution_choices
  add constraint partial_payment_resolution_choices_status_check
  check (status in ('pending_review','processing','completed','failed','cancelled_paid'));

create or replace function public.guard_partial_payment_choice()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status public.payment_status;
begin
  select payment_status into v_status
    from public.participants where id = new.participant_id for update;
  if v_status = 'confirmed' then
    raise exception 'A cota já está quitada. Estorno e crédito indisponíveis.';
  end if;
  return new;
end; $$;

drop trigger if exists guard_partial_payment_choice_insert on public.partial_payment_resolution_choices;
create trigger guard_partial_payment_choice_insert
before insert on public.partial_payment_resolution_choices
for each row execute function public.guard_partial_payment_choice();

create or replace function public.close_partial_payment_choice_on_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_choice_status text;
begin
  if old.payment_status is distinct from 'confirmed' and new.payment_status = 'confirmed' then
    select status into v_choice_status from public.partial_payment_resolution_choices
      where participant_id = new.id for update;
    if v_choice_status in ('processing','completed') then
      raise exception 'Já existe estorno ou crédito em execução/concluído para esta cota.';
    end if;
    if v_choice_status in ('pending_review','failed') then
      update public.partial_payment_resolution_choices
      set status = 'cancelled_paid', updated_at = now()
      where participant_id = new.id;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists close_partial_payment_choice_on_paid on public.participants;
create trigger close_partial_payment_choice_on_paid
before update of payment_status on public.participants
for each row execute function public.close_partial_payment_choice_on_paid();

revoke all on function public.guard_partial_payment_choice() from public, anon, authenticated;
revoke all on function public.close_partial_payment_choice_on_paid() from public, anon, authenticated;
