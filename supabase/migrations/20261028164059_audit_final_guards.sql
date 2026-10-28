-- Per-schema revocation cannot undo PostgreSQL's global PUBLIC EXECUTE default.
-- This only affects future functions created by postgres, not managed Supabase roles.
alter default privileges for role postgres revoke execute on functions from public;
revoke maintain on all tables in schema public from service_role;
alter table public.services add constraint services_editor_duration
  check (duration_minutes between 15 and 480 and duration_minutes % 15 = 0);
alter table public.services add constraint services_editor_price check (price <= 99999.99);
alter table public.bookings add constraint bookings_finite_date check (isfinite(date));
alter table public.bookings add constraint bookings_minute_precision check (extract(second from start_time) = 0);

create or replace function public.barbershop_save_booking(p_booking jsonb, p_allow_status boolean default false)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  b public.bookings%rowtype;
  settings public.settings%rowtype;
  id_value text := coalesce(nullif(p_booking->>'id',''),gen_random_uuid()::text);
  customer text := trim(p_booking->>'client');
  phone_value text := regexp_replace(coalesce(p_booking->>'phone',''),'[^0-9]','','g');
  date_value date := (p_booking->>'date')::date;
  start_value time := (p_booking->>'start')::time;
  shift_value integer := coalesce((p_booking->>'shift')::integer,0);
  ids text[] := array(select jsonb_array_elements_text(coalesce(p_booking->'serviceIds',jsonb_build_array(p_booking->>'serviceId'))));
  old_ids text[];
  changed boolean;
  duration_value integer;
  client_value text;
  rule_ok boolean;
  service_row record;
  saved_status text;
begin
  perform pg_advisory_xact_lock(73402761);
  select * into b from public.bookings where id=id_value;
  old_ids := array(select service_id from public.booking_services where booking_id=id_value order by position);
  if date_value is null or not isfinite(date_value) or start_value is null or extract(second from start_value)<>0 then
    raise exception 'Data ou horário inválido' using errcode='22023';
  end if;
  changed := b.id is null or b.date<>date_value or b.start_time<>start_value or old_ids is distinct from ids;
  if length(phone_value) in (10,11) then phone_value := '55'||phone_value; end if;
  if phone_value !~ '^55[0-9]{10,11}$' then raise exception 'Telefone inválido' using errcode='22023'; end if;
  if customer is null or length(customer) not between 2 and 80 then raise exception 'Nome inválido' using errcode='22023'; end if;
  if cardinality(ids)=0 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Serviços inválidos' using errcode='22023'; end if;
  if ids is distinct from old_ids and exists(select 1 from unnest(ids) x left join public.services s on s.id=x where s.id is null or not s.active) then
    raise exception 'Serviço indisponível' using errcode='22023';
  end if;
  if b.id is null or ids is distinct from old_ids then
    select sum(s.duration_minutes) into duration_value from public.services s where s.id=any(ids);
  else duration_value := b.duration_minutes; end if;
  select * into settings from public.settings where id;
  if settings.id is null then raise exception 'Missing settings'; end if;
  if changed then
    if date_value < (now() at time zone 'America/Sao_Paulo')::date or
       date_value+start_value <= (now() at time zone 'America/Sao_Paulo') then
      raise exception 'Escolha um horário futuro' using errcode='22023';
    end if;
    if not extract(dow from date_value)::smallint=any(settings.work_days)
      or exists(select 1 from public.vacations where date_value between starts_on and ends_on)
      or start_value<settings.opens_at or start_value+duration_value*interval '1 minute'>settings.closes_at
      or mod((extract(epoch from start_value-settings.opens_at)/60)::integer,settings.slot_minutes)<>0
      or (settings.break_start is not null and start_value<settings.break_end and start_value+duration_value*interval '1 minute'>settings.break_start)
    then raise exception 'Fora do expediente ou em férias' using errcode='22023'; end if;
    for service_row in select s.id from public.services s where s.id=any(ids) loop
      if exists(select 1 from public.service_rules where service_id=service_row.id) then
        select exists(select 1 from public.service_rules where service_id=service_row.id
          and extract(dow from date_value)::smallint=any(days) and start_value>=starts_at
          and start_value+duration_value*interval '1 minute'<=ends_at) into rule_ok;
        if not rule_ok then raise exception 'Serviço indisponível neste horário' using errcode='22023'; end if;
      end if;
    end loop;
    if exists(select 1 from public.blacklist where phone=phone_value) then raise exception 'Agendamento indisponível para este contato' using errcode='22023'; end if;
  end if;
  if extract(epoch from start_value)/60+shift_value<0 or extract(epoch from start_value)/60+shift_value+duration_value>1440 then
    raise exception 'O ajuste ultrapassa o dia da reserva' using errcode='22023';
  end if;
  if b.client_id is not null and b.phone=phone_value and b.client_name=customer then
    client_value := b.client_id;
  else
    insert into public.clients(name,phone) values(customer,phone_value)
      on conflict(phone) do update set name=excluded.name returning id into client_value;
  end if;
  saved_status := case when p_allow_status then coalesce(p_booking->>'status',b.status,'confirmada') else coalesce(b.status,'confirmada') end;
  insert into public.bookings(id,client_id,client_name,phone,date,start_time,duration_minutes,shift_minutes,status,notes,demo)
    values(id_value,client_value,customer,phone_value,date_value,start_value,duration_value,shift_value,saved_status,coalesce(p_booking->>'notes',''),false)
    on conflict(id) do update set client_id=excluded.client_id,client_name=excluded.client_name,phone=excluded.phone,
      date=excluded.date,start_time=excluded.start_time,duration_minutes=excluded.duration_minutes,shift_minutes=excluded.shift_minutes,
      status=excluded.status,notes=excluded.notes;
  if b.id is null or ids is distinct from old_ids then
    delete from public.booking_services where booking_id=id_value;
    insert into public.booking_services(booking_id,position,service_id,service_name,duration_minutes,price)
      select id_value,(x.n-1)::integer,s.id,s.name,s.duration_minutes,s.price
      from unnest(ids) with ordinality x(id,n) join public.services s on s.id=x.id;
  end if;
  return (select item from jsonb_array_elements(public.barbershop_read_state()->'bookings') item where item->>'id'=id_value);
end $$;
revoke all on function public.barbershop_save_booking(jsonb,boolean) from public, anon, authenticated;
grant execute on function public.barbershop_save_booking(jsonb,boolean) to service_role;
