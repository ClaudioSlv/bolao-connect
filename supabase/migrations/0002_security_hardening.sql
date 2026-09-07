-- Bolão Connect: hardening de acesso para produção
-- Mantém a publishable key no cliente e aplica menor privilégio no Data API.

-- Perfis: o usuário autenticado pode criar, ler e atualizar somente o próprio perfil.
create policy "profile self insert"
on public.profiles for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = id);

-- Pagamentos: membros podem consultar apenas pagamentos do próprio bolão.
create policy "members read payments"
on public.payments for select
to authenticated
using (
  exists (
    select 1 from public.pools b
    where b.id = payments.pool_id
      and (
        b.owner_id = auth.uid()
        or exists (
          select 1 from public.participants me
          where me.pool_id = b.id
            and me.user_id = auth.uid()
            and me.status <> 'cancelled'
        )
      )
  )
);

-- Preferências de lembrete: organizador gerencia; participante vinculado lê/atualiza a própria preferência.
create policy "owner manages reminders"
on public.reminder_preferences for all
to authenticated
using (
  exists (
    select 1 from public.pools b
    where b.id = reminder_preferences.pool_id
      and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.pools b
    where b.id = reminder_preferences.pool_id
      and b.owner_id = auth.uid()
  )
);

create policy "member reads own reminders"
on public.reminder_preferences for select
to authenticated
using (
  exists (
    select 1 from public.participants p
    where p.id = reminder_preferences.participant_id
      and p.user_id = auth.uid()
  )
);

create policy "member updates own reminders"
on public.reminder_preferences for update
to authenticated
using (
  exists (
    select 1 from public.participants p
    where p.id = reminder_preferences.participant_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.participants p
    where p.id = reminder_preferences.participant_id
      and p.user_id = auth.uid()
  )
);

-- Auditoria: somente participantes autorizados podem ler; gravações normais ficam restritas ao organizador.
create policy "members read audit"
on public.audit_events for select
to authenticated
using (
  pool_id is not null and exists (
    select 1 from public.pools b
    where b.id = audit_events.pool_id
      and (
        b.owner_id = auth.uid()
        or exists (
          select 1 from public.participants me
          where me.pool_id = b.id
            and me.user_id = auth.uid()
            and me.status <> 'cancelled'
        )
      )
  )
);

create policy "owner inserts audit"
on public.audit_events for insert
to authenticated
with check (
  actor_id = auth.uid()
  and pool_id is not null
  and exists (
    select 1 from public.pools b
    where b.id = audit_events.pool_id
      and b.owner_id = auth.uid()
  )
);

-- Menor privilégio: visitantes não autenticados não acessam dados privados do bolão.
revoke all on table public.profiles from anon;
revoke all on table public.pools from anon;
revoke all on table public.participants from anon;
revoke all on table public.payments from anon;
revoke all on table public.wallet_transactions from anon;
revoke all on table public.games from anon;
revoke all on table public.lottery_results from anon;
revoke all on table public.game_checks from anon;
revoke all on table public.reminder_preferences from anon;
revoke all on table public.audit_events from anon;

-- Usuários autenticados recebem somente as operações que o app precisa.
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.pools to authenticated;
grant select, insert, update, delete on table public.participants to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.wallet_transactions to authenticated;
grant select, insert, update, delete on table public.games to authenticated;
grant select on table public.lottery_results to authenticated;
grant select on table public.game_checks to authenticated;
grant select, insert, update, delete on table public.reminder_preferences to authenticated;
grant select, insert on table public.audit_events to authenticated;
