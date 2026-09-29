-- Reabre apenas devoluções recusadas, mantendo a ID original da Efí.
create or replace function public.retry_failed_efi_refund(p_participant_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_choice text; v_payment public.payment_status;
begin
  select payment_status into v_payment from public.participants
    where id=p_participant_id for update;
  if not found or v_payment='confirmed' then return false; end if;
  select status into v_choice from public.partial_payment_resolution_choices
    where participant_id=p_participant_id and choice='refund' for update;
  if v_choice is distinct from 'failed' then return false; end if;
  if not exists(select 1 from public.efi_refund_items where participant_id=p_participant_id and status='failed')
    or exists(select 1 from public.efi_refund_items where participant_id=p_participant_id and status<>'failed')
  then return false; end if;
  update public.partial_payment_resolution_choices set status='processing',updated_at=now()
    where participant_id=p_participant_id;
  update public.efi_refund_items set status='pending',attempted_at=null,provider_status=null
    where participant_id=p_participant_id and status='failed';
  return true;
end; $$;
revoke all on function public.retry_failed_efi_refund(uuid) from public,anon,authenticated;
grant execute on function public.retry_failed_efi_refund(uuid) to service_role;
