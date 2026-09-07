-- Keep only the 50 most recent contests for each lottery.
-- When a 51st contest is inserted, the oldest contest for that lottery is removed.
-- Handles lotteries with more than one draw_index in the same contest by pruning whole contests.

create or replace function public.prune_lottery_results_to_latest_50()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.lottery_results lr
  where lr.lottery = new.lottery
    and lr.contest_number in (
      select contest_number
      from (
        select distinct contest_number
        from public.lottery_results
        where lottery = new.lottery
        order by contest_number desc
        offset 50
      ) old_contests
    );

  return new;
end;
$$;

drop trigger if exists lottery_results_keep_latest_50 on public.lottery_results;

create trigger lottery_results_keep_latest_50
after insert or update of lottery, contest_number
on public.lottery_results
for each row
execute function public.prune_lottery_results_to_latest_50();

-- Clean up any historical excess immediately when this migration is applied.
delete from public.lottery_results lr
where exists (
  select 1
  from (
    select lottery, contest_number
    from (
      select distinct lottery, contest_number
      from public.lottery_results
    ) d
    where (
      select count(*)
      from (
        select distinct contest_number
        from public.lottery_results newer
        where newer.lottery = d.lottery
          and newer.contest_number > d.contest_number
      ) n
    ) >= 50
  ) excess
  where excess.lottery = lr.lottery
    and excess.contest_number = lr.contest_number
);
