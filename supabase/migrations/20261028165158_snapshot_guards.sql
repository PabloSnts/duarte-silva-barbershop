-- Limit future and existing application tables to CRUD for the server role.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from service_role;
revoke truncate, references, trigger, maintain on all tables in schema public from service_role;
create index request_buckets_expiry_idx on private.request_buckets(expires_at);

create or replace function public.barbershop_read_state() returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare result jsonb;
begin
  if not exists(select 1 from public.settings where id) then raise exception 'Missing settings'; end if;
  if not exists(select 1 from public.tv_state where id) then raise exception 'Missing TV settings'; end if;
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
      'connected',t.connected and exists(select 1 from public.tv_sessions where expires_at>now()),'connectedAt',floor(extract(epoch from t.connected_at)*1000))) from public.tv_state t where id),
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
revoke all on function public.barbershop_read_state() from public, anon, authenticated;
grant execute on function public.barbershop_read_state() to service_role;
