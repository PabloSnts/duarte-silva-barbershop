-- Transactional API. All functions are INVOKER and callable only by service_role.
-- Browser requests must pass through the authenticated barbershop Edge Function.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.barber_access (
  email text primary key check (email = lower(trim(email))),
  enabled boolean not null default true
);
alter table private.barber_access enable row level security;
grant select on private.barber_access to service_role;

create table private.request_buckets (
  bucket text primary key,
  requests integer not null,
  expires_at timestamptz not null
);
alter table private.request_buckets enable row level security;
grant select, insert, update, delete on private.request_buckets to service_role;

create table public.tv_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
alter table public.tv_sessions enable row level security;
revoke all on public.tv_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.tv_sessions to service_role;

create function public.barbershop_allowed(p_email text) returns boolean
language sql stable security invoker set search_path = ''
as $$ select exists(select 1 from private.barber_access where email=lower(trim(p_email)) and enabled) $$;

create function public.barbershop_rate_limit(p_bucket text, p_limit integer)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare n integer; k text := p_bucket || ':' || floor(extract(epoch from now())/60)::text;
begin
  delete from private.request_buckets where expires_at < now() - interval '1 day';
  insert into private.request_buckets(bucket, requests, expires_at) values(k,1,now()+interval '1 minute')
    on conflict(bucket) do update set requests=private.request_buckets.requests+1 returning requests into n;
  return n <= p_limit;
end $$;

create function public.barbershop_read_state() returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare result jsonb;
begin
  if not exists(select 1 from public.settings where id) then raise exception 'Missing settings'; end if;
  select jsonb_build_object(
    'loaded',true,
    'services',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'name',s.name,'duration',s.duration_minutes,'price',s.price,'active',s.active,
      'rules',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'days',r.days,'start',to_char(r.starts_at,'HH24:MI'),'end',to_char(r.ends_at,'HH24:MI')) order by r.id) from public.service_rules r where r.service_id=s.id),'[]'::jsonb)
    ) order by s.id) from public.services s),'[]'::jsonb),
    'bookings',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id',b.id,'client',b.client_name,'clientId',b.client_id,'phone',b.phone,'date',b.date,
      'start',to_char(b.start_time,'HH24:MI'),'shift',b.shift_minutes,'status',b.status,
      'notes',b.notes,'demo',b.demo,'createdAt',floor(extract(epoch from b.created_at)*1000),
      'serviceId',(select bs.service_id from public.booking_services bs where bs.booking_id=b.id order by bs.position limit 1),
      'serviceIds',coalesce((select jsonb_agg(bs.service_id order by bs.position) from public.booking_services bs where bs.booking_id=b.id),'[]'::jsonb),
      'serviceSnapshots',coalesce((select jsonb_agg(jsonb_build_object('id',bs.service_id,'name',bs.service_name,'duration',bs.duration_minutes,'price',bs.price) order by bs.position) from public.booking_services bs where bs.booking_id=b.id),'[]'::jsonb)
    )) order by b.date,b.start_time,b.id) from public.bookings b),'[]'::jsonb),
    'settings',(select jsonb_build_object('shopName',s.shop_name,'open',to_char(s.opens_at,'HH24:MI'),
      'close',to_char(s.closes_at,'HH24:MI'),'workDays',s.work_days,
      'breakStart',coalesce(to_char(s.break_start,'HH24:MI'),''),'breakEnd',coalesce(to_char(s.break_end,'HH24:MI'),''),
      'slot',s.slot_minutes,'showFreeOnTv',s.show_free_on_tv,'tvClientInfo',s.tv_client_info,
      'sound',s.sound,'vacationMessage',s.vacation_message,
      'vacations',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'start',v.starts_on,'end',v.ends_on) order by v.starts_on,v.id) from public.vacations v),'[]'::jsonb)
    ) from public.settings s where id),
    'tv',(select jsonb_strip_nulls(jsonb_build_object('code',null,'expires',coalesce(floor(extract(epoch from t.expires_at)*1000),0),
      'connected',t.connected,'connectedAt',floor(extract(epoch from t.connected_at)*1000))) from public.tv_state t where id),
    'blacklist',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',b.id,'phone',b.phone,'name',b.name,'reason',b.reason,'createdAt',floor(extract(epoch from b.created_at)*1000))) order by b.id) from public.blacklist b),'[]'::jsonb),
    'adjusts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'date',a.date,'fromId',coalesce(a.from_booking_id,''),
      'minutes',a.minutes,'at',floor(extract(epoch from a.created_at)*1000),
      'ids',coalesce((select jsonb_agg(ab.booking_id order by ab.booking_id) from public.adjustment_bookings ab where ab.adjustment_id=a.id),'[]'::jsonb)
    ) order by a.created_at,a.id) from public.schedule_adjustments a),'[]'::jsonb),
    'updatedAt',(select floor(extract(epoch from max(t))*1000) from (
      select updated_at t from public.settings union all select updated_at from public.services
      union all select updated_at from public.service_rules union all select updated_at from public.vacations
      union all select updated_at from public.clients union all select updated_at from public.bookings
      union all select updated_at from public.booking_services union all select updated_at from public.blacklist
      union all select updated_at from public.schedule_adjustments union all select updated_at from public.adjustment_bookings
      union all select updated_at from public.tv_state
    ) u)
  ) into result;
  return result;
end $$;

create function public.barbershop_snapshot() returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare s jsonb := public.barbershop_read_state();
begin return jsonb_build_object('state',s,'revision',md5(s::text)); end $$;

create function public.barbershop_save_booking(p_booking jsonb, p_allow_status boolean default false)
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
  insert into public.clients(name,phone) values(customer,phone_value)
    on conflict(phone) do update set name=excluded.name returning id into client_value;
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

create function public.barbershop_patch(p_changes jsonb, p_revision text)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare entry jsonb; rule jsonb; v jsonb; id_value text; s jsonb; old jsonb;
begin
  perform pg_advisory_xact_lock(73402761);
  if md5(public.barbershop_read_state()::text) is distinct from p_revision then
    raise exception 'A agenda mudou em outro aparelho. Recarregue e tente novamente.' using errcode='40001';
  end if;
  if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('services','bookings','settings','blacklist','adjusts')) then
    raise exception 'Alteração inválida' using errcode='22023';
  end if;
  set constraints public.bookings_no_overlap deferred;
  if p_changes ? 'services' then
    for entry in select * from jsonb_array_elements(p_changes->'services') loop
      if (entry->>'duration')::integer not between 15 and 480 or (entry->>'duration')::integer%15<>0
        or (entry->>'price')::numeric>99999.99 then raise exception 'Duração ou preço inválido' using errcode='22023'; end if;
      insert into public.services(id,name,duration_minutes,price,active)
        values(entry->>'id',trim(entry->>'name'),(entry->>'duration')::integer,(entry->>'price')::numeric,coalesce((entry->>'active')::boolean,true))
        on conflict(id) do update set name=excluded.name,duration_minutes=excluded.duration_minutes,price=excluded.price,active=excluded.active;
      delete from public.service_rules where service_id=entry->>'id';
      for rule in select * from jsonb_array_elements(coalesce(entry->'rules','[]')) loop
        insert into public.service_rules(id,service_id,days,starts_at,ends_at) values(
          coalesce(rule->>'id',gen_random_uuid()::text),entry->>'id',
          array(select distinct x::smallint from jsonb_array_elements_text(rule->'days') x),
          (rule->>'start')::time,(rule->>'end')::time);
      end loop;
    end loop;
    update public.services set active=false where id not in (select item->>'id' from jsonb_array_elements(p_changes->'services') item);
  end if;
  if p_changes ? 'settings' then
    s := p_changes->'settings';
    if (s->>'slot')::integer not in (15,30,45,60) then raise exception 'Intervalo de horários inválido' using errcode='22023'; end if;
    update public.settings set shop_name=s->>'shopName',opens_at=(s->>'open')::time,closes_at=(s->>'close')::time,
      work_days=array(select distinct x::smallint from jsonb_array_elements_text(s->'workDays') x),
      break_start=nullif(s->>'breakStart','')::time,break_end=nullif(s->>'breakEnd','')::time,slot_minutes=(s->>'slot')::integer,
      show_free_on_tv=(s->>'showFreeOnTv')::boolean,tv_client_info=s->>'tvClientInfo',sound=(s->>'sound')::boolean,
      vacation_message=s->>'vacationMessage' where id;
    for v in select * from jsonb_array_elements(s->'vacations') loop
      insert into public.vacations(id,starts_on,ends_on) values(v->>'id',(v->>'start')::date,(v->>'end')::date)
      on conflict(id) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on;
    end loop;
    delete from public.vacations where id not in (select item->>'id' from jsonb_array_elements(s->'vacations') item);
  end if;
  if p_changes ? 'blacklist' then
    for entry in select * from jsonb_array_elements(p_changes->'blacklist') loop
      insert into public.blacklist(id,phone,name,reason) values(entry->>'id',entry->>'phone',entry->>'name',entry->>'reason')
        on conflict(id) do update set phone=excluded.phone,name=excluded.name,reason=excluded.reason;
    end loop;
    delete from public.blacklist where id not in (select item->>'id' from jsonb_array_elements(p_changes->'blacklist') item);
  end if;
  if p_changes ? 'bookings' then
    old := public.barbershop_read_state()->'bookings';
    for entry in select * from jsonb_array_elements(p_changes->'bookings') loop
      if not exists(select 1 from jsonb_array_elements(old) x where x=entry) then
        perform public.barbershop_save_booking(entry,true);
      end if;
    end loop;
    delete from public.bookings where id not in (select item->>'id' from jsonb_array_elements(p_changes->'bookings') item);
    delete from public.schedule_adjustments a where not exists(select 1 from public.adjustment_bookings ab where ab.adjustment_id=a.id);
  end if;
  if p_changes ? 'adjusts' then
    for entry in select * from jsonb_array_elements(p_changes->'adjusts') loop
      insert into public.schedule_adjustments(id,date,from_booking_id,minutes)
        values(entry->>'id',(entry->>'date')::date,nullif(entry->>'fromId',''),(entry->>'minutes')::integer)
        on conflict(id) do update set from_booking_id=excluded.from_booking_id;
      delete from public.adjustment_bookings where adjustment_id=entry->>'id';
      insert into public.adjustment_bookings(adjustment_id,booking_id)
        select entry->>'id',x from jsonb_array_elements_text(entry->'ids') x;
    end loop;
    delete from public.schedule_adjustments where id not in(select item->>'id' from jsonb_array_elements(p_changes->'adjusts') item);
  end if;
  return public.barbershop_snapshot();
end $$;

create function public.barbershop_complete_elapsed() returns integer
language plpgsql security invoker set search_path = ''
as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(73402761);
  update public.bookings set status='concluida' where status='confirmada'
    and upper(occupied_at) <= now() at time zone 'America/Sao_Paulo';
  get diagnostics n=row_count;
  return n;
end $$;

create function public.barbershop_pair_code(p_hash text) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.tv_state set code_hash=p_hash,expires_at=now()+interval '10 minutes' where id;
end $$;

create function public.barbershop_pair_tv(p_code_hash text,p_token_hash text) returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(73402761);
  if not exists(select 1 from public.tv_state where id and code_hash=p_code_hash and expires_at>now()) then return false; end if;
  insert into public.tv_sessions(token_hash) values(p_token_hash);
  update public.tv_state set code_hash=null,expires_at=null,connected=true,connected_at=now() where id;
  return true;
end $$;

create function public.barbershop_tv_allowed(p_hash text) returns boolean
language sql stable security invoker set search_path = ''
as $$ select exists(select 1 from public.tv_sessions where token_hash=p_hash and expires_at>now()) $$;

create function public.barbershop_disconnect_tv() returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  delete from public.tv_sessions;
  update public.tv_state set code_hash=null,expires_at=null,connected=false,connected_at=null where id;
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'barbershop_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
