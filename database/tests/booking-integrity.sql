-- Regression checks run in a transaction that ALWAYS rolls back test data.
begin;
set local role service_role;
do $$
declare a jsonb; b jsonb; snap jsonb; changed jsonb; day date := date_trunc('week',now()+interval '14 days')::date;
  adjustment text := gen_random_uuid()::text; past_id text := gen_random_uuid()::text;
begin
  a := public.barbershop_save_booking(jsonb_build_object('client','Teste A','phone','31999999991','date',day,'start','09:00','serviceIds',jsonb_build_array('corte')));
  b := public.barbershop_save_booking(jsonb_build_object('client','Teste B','phone','31999999992','date',day,'start','09:30','serviceIds',jsonb_build_array('corte')));
  set constraints all immediate;
  if a->>'id' is null then raise exception 'FAIL: missing persisted ID'; end if;
  if (a->'serviceSnapshots'->0->>'price')::numeric<>35 then raise exception 'FAIL: authoritative price'; end if;
  begin
    perform public.barbershop_save_booking(jsonb_build_object('client','Conflito','phone','31999999993','date',day,'start','09:00','serviceIds',jsonb_build_array('corte')));
    raise exception 'FAIL: overlap accepted';
  exception when exclusion_violation then null; end;
  begin
    insert into public.bookings(client_name,phone,date,start_time,duration_minutes) values('Sem itens','5531999999994',day,'16:00',30);
    raise exception 'FAIL: missing items accepted';
  exception when check_violation then null; end;
  begin
    update public.booking_services set duration_minutes=45 where booking_id=a->>'id';
    raise exception 'FAIL: wrong item sum accepted';
  exception when check_violation then null; end;
  update public.services set duration_minutes=45 where id='corte';
  if (select duration_minutes from public.booking_services where booking_id=a->>'id')<>30 then raise exception 'FAIL: history changed with catalogue'; end if;
  snap := public.barbershop_snapshot();
  select jsonb_agg(case when x->>'id' in (a->>'id',b->>'id') then jsonb_set(x,'{shift}','15') else x end)
    into changed from jsonb_array_elements(snap->'state'->'bookings') x;
  snap := public.barbershop_patch(jsonb_build_object('bookings',changed,'adjusts',jsonb_build_array(
    jsonb_build_object('id',adjustment,'date',day,'fromId',a->>'id','minutes',15,'ids',jsonb_build_array(a->>'id',b->>'id'))
  )),snap->>'revision');
  set constraints all immediate;
  if (select count(*) from public.adjustment_bookings where adjustment_id=adjustment)<>2 then raise exception 'FAIL: adjustment links'; end if;
  begin
    perform public.barbershop_patch('{}','stale-revision');
    raise exception 'FAIL: stale update accepted';
  exception when serialization_failure then null; end;
  snap := public.barbershop_snapshot();
  select jsonb_agg(case when x->>'id' in (a->>'id',b->>'id') then jsonb_set(x,'{shift}','0') else x end)
    into changed from jsonb_array_elements(snap->'state'->'bookings') x;
  perform public.barbershop_patch(jsonb_build_object('bookings',changed,'adjusts','[]'::jsonb),snap->>'revision');
  set constraints all immediate;
  if exists(select 1 from public.schedule_adjustments where id=adjustment) then raise exception 'FAIL: undo left history'; end if;
  begin
    perform public.barbershop_save_booking(jsonb_build_object('client','Infinito','phone','31999999995','date','infinity','start','09:00','serviceIds',jsonb_build_array('corte')));
    raise exception 'FAIL: infinite date accepted';
  exception when invalid_parameter_value then null; end;
  begin
    update public.services set duration_minutes=20 where id='corte';
    raise exception 'FAIL: invalid catalogue duration accepted';
  exception when check_violation then null; end;
  set constraints all deferred;
  insert into public.bookings(id,client_name,phone,date,start_time,duration_minutes)
    values(past_id,'Passado temporário','5531999999996',current_date-1,'08:00',30);
  insert into public.booking_services(booking_id,position,service_id,service_name,duration_minutes,price)
    values(past_id,0,'corte','Corte',30,35);
  perform public.barbershop_complete_elapsed();
  if (select status from public.bookings where id=past_id)<>'concluida' then raise exception 'FAIL: automatic completion'; end if;
  update public.bookings set status='ausente' where id=past_id;
  perform public.barbershop_complete_elapsed();
  if (select status from public.bookings where id=past_id)<>'ausente' then raise exception 'FAIL: absence overwritten'; end if;
  perform public.barbershop_pair_code(repeat('a',64));
  if not public.barbershop_pair_tv(repeat('a',64),repeat('b',64)) then raise exception 'FAIL: TV pair'; end if;
  if public.barbershop_pair_tv(repeat('a',64),repeat('c',64)) then raise exception 'FAIL: code reused'; end if;
  if not public.barbershop_tv_allowed(repeat('b',64)) then raise exception 'FAIL: session'; end if;
  perform public.barbershop_disconnect_tv();
  if public.barbershop_tv_allowed(repeat('b',64)) then raise exception 'FAIL: session not revoked'; end if;
  set constraints all immediate;
end $$;
set local role anon;
do $$
begin
  begin perform public.barbershop_snapshot(); raise exception 'FAIL: anon RPC allowed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.bookings; raise exception 'FAIL: anon table allowed';
  exception when insufficient_privilege then null; end;
end $$;
select 'PASS: transactional bookings, sums, snapshots, CAS, multi-booking shifts/undo, completion, TV single-use/revocation and anon denial' as verification;
rollback;
