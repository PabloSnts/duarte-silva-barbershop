create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('barbershop-complete-bookings','* * * * *','select public.barbershop_complete_elapsed()');
