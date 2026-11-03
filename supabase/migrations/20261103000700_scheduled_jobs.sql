-- Scheduled jobs (pg_cron). On Supabase, pg_cron is available on every plan.
-- Skipped automatically where pg_cron is not installed (e.g. local tests).
do $outer$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available: scheduled jobs not created';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.schedule('expire-unpaid-orders', '*/10 * * * *', $$select public.expire_unpaid_orders()$$);
  -- 03:30 UTC = 09:00 IST
  perform cron.schedule('installment-statuses', '30 3 * * *', $$select public.refresh_installment_statuses()$$);
  perform cron.schedule('installment-reminders', '45 3 * * *', $$select public.queue_installment_reminders()$$);
end
$outer$;
