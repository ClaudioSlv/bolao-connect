alter table public.participants
  add column if not exists notes text;

comment on column public.participants.notes is 'Observações privadas do organizador sobre o participante e suas cotas.';
