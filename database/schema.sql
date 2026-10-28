-- Initial schema for one barbershop / one appointment calendar.
-- Server/n8n access only. Browser integration and Auth are a separate step.
begin;

create table public.settings (
  id boolean primary key default true check (id),
  shop_name text not null default 'Duarte & Silva Barbearia',
  timezone text not null default 'America/Sao_Paulo' check (timezone = 'America/Sao_Paulo'),
  opens_at time not null default '09:00',
  closes_at time not null default '19:00',
  work_days smallint[] not null default '{1,2,3,4,5,6}',
  break_start time default '12:00',
  break_end time default '13:00',
  slot_minutes integer not null default 30 check (slot_minutes between 1 and 1440),
  show_free_on_tv boolean not null default true,
  tv_client_info text not null default 'first' check (tv_client_info in ('first','initials','none')),
  sound boolean not null default false,
  vacation_message text not null default 'Olá! Estamos de férias entre {inicio} e {fim}. Voltamos logo — obrigado pela preferência!',
  check (opens_at < closes_at),
  check (work_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  check ((break_start is null and break_end is null) or
    (break_start is not null and break_end is not null and break_start < break_end and break_start >= opens_at and break_end <= closes_at))
);

create table public.services (
  id text primary key default gen_random_uuid()::text,
  name text not null check (length(trim(name)) between 1 and 120),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  price numeric(12,2) not null default 0 check (price >= 0),
  active boolean not null default true
);

create table public.service_rules (
  id text primary key default gen_random_uuid()::text,
  service_id text not null references public.services(id) on delete cascade,
  days smallint[] not null check (cardinality(days) > 0 and days <@ array[0,1,2,3,4,5,6]::smallint[]),
  starts_at time not null,
  ends_at time not null,
  check (starts_at < ends_at)
);
create index service_rules_service_idx on public.service_rules(service_id);

create table public.vacations (
  id text primary key default gen_random_uuid()::text,
  starts_on date not null,
  ends_on date not null,
  check (starts_on <= ends_on)
);
create index vacations_dates_idx on public.vacations(starts_on, ends_on);

create table public.clients (
  id text primary key default gen_random_uuid()::text,
  name text not null check (length(trim(name)) between 1 and 120),
  phone text not null unique check (phone ~ '^55[0-9]{10,11}$'),
  created_at timestamptz not null default now()
);

create table public.bookings (
  id text primary key default gen_random_uuid()::text,
  client_id text references public.clients(id) on delete set null,
  client_name text not null check (length(trim(client_name)) between 1 and 120),
  phone text not null check (phone ~ '^55[0-9]{10,11}$'),
  date date not null,
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  shift_minutes integer not null default 0 check (shift_minutes between -1440 and 1440),
  status text not null default 'confirmada' check (status in ('confirmada','concluida','cancelada','ausente')),
  notes text not null default '' check (length(notes) <= 300),
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  -- Local wall-clock range; the calendar uses America/Sao_Paulo.
  occupied_at tsrange generated always as (
    tsrange(date + start_time + shift_minutes * interval '1 minute',
      date + start_time + (shift_minutes + duration_minutes) * interval '1 minute', '[)')
  ) stored,
  constraint bookings_no_overlap exclude using gist (occupied_at with &&)
    where (status <> 'cancelada') deferrable initially immediate
);
create index bookings_date_start_idx on public.bookings(date, start_time);
create index bookings_client_idx on public.bookings(client_id);
create index bookings_phone_idx on public.bookings(phone);

create table public.booking_services (
  booking_id text not null references public.bookings(id) on delete cascade,
  position integer not null check (position >= 0),
  service_id text not null references public.services(id) on delete restrict,
  -- Snapshots preserve the booked terms after catalogue edits.
  service_name text not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  price numeric(12,2) not null check (price >= 0),
  primary key (booking_id, position),
  unique (booking_id, service_id)
);
create index booking_services_service_idx on public.booking_services(service_id);

create table public.blacklist (
  id text primary key default gen_random_uuid()::text,
  phone text not null unique check (phone ~ '^55[0-9]{10,11}$'),
  name text,
  reason text,
  created_at timestamptz not null default now()
);

create table public.schedule_adjustments (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  from_booking_id text references public.bookings(id) on delete set null,
  minutes integer not null check (minutes <> 0 and minutes between -1440 and 1440),
  created_at timestamptz not null default now()
);
create index schedule_adjustments_from_idx on public.schedule_adjustments(from_booking_id);

create table public.adjustment_bookings (
  adjustment_id text not null references public.schedule_adjustments(id) on delete cascade,
  booking_id text not null references public.bookings(id) on delete cascade,
  primary key (adjustment_id, booking_id)
);
create index adjustment_bookings_booking_idx on public.adjustment_bookings(booking_id);

create table public.tv_state (
  id boolean primary key default true check (id),
  -- Pairing codes are short-lived secrets: persist only their SHA-256 hash.
  code_hash text check (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz,
  connected boolean not null default false,
  connected_at timestamptz,
  check ((code_hash is null) = (expires_at is null)),
  check (not connected or connected_at is not null)
);

-- No login/ownership model exists in the current demo. Keep all rows private.
-- No policies for anon/authenticated; service_role is for trusted servers only.
do $$
declare table_name text;
begin
  foreach table_name in array array['settings','services','service_rules','vacations',
    'clients','bookings','booking_services','blacklist','schedule_adjustments',
    'adjustment_bookings','tv_state'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
    execute format('comment on table public.%I is %L', table_name,
      'Barbershop backend only. RLS denies browser access until authentication is implemented.');
  end loop;
end $$;

insert into public.settings(id) values (true);
insert into public.tv_state(id) values (true);
insert into public.services(id,name,duration_minutes,price) values
  ('corte','Corte',30,35), ('barba','Barba',30,35),
  ('combo','Corte + Barba',60,70), ('pigmentacao','Pigmentação',45,0);

commit;

