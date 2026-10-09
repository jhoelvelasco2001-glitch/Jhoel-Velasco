-- ============================================================================
-- Jhoel 1% — Base de datos (Supabase / PostgreSQL)
-- Pega este archivo completo en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin borrar datos.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. TABLAS
-- ----------------------------------------------------------------------------

-- Perfil de cada usuario (se crea solo al registrarse)
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  first_name    text not null default '',
  last_name     text not null default '',
  phone         text,
  country       text,
  doc_number    text,
  role          text not null default 'investor' check (role in ('investor', 'admin')),
  ref_code      text not null unique,
  referred_by   uuid references public.profiles (id) on delete set null,
  kyc_status    text not null default 'pending'
                check (kyc_status in ('pending', 'in_review', 'verified', 'rejected')),
  created_at    timestamptz not null default now()
);

-- Inversión (plan) de cada usuario. Solo una activa por usuario.
create table if not exists public.investments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  capital      numeric(12, 2) not null check (capital >= 0),
  start_date   date not null default current_date,
  promo_until  date,                         -- fin de la promoción de lanzamiento (null = sin promoción)
  status       text not null default 'active' check (status in ('active', 'closing', 'closed')),
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create unique index if not exists investments_one_open
  on public.investments (user_id) where status in ('active', 'closing');

-- Libro de movimientos (depósitos, rentabilidad, retiros, devolución de capital)
create table if not exists public.movements (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('deposit', 'profit', 'withdraw', 'capital_return')),
  amount        numeric(12, 2) not null,     -- positivo = entra, negativo = sale
  rate          numeric(6, 3),               -- % aplicado (solo rentabilidad)
  detail        text,
  period_start  date,
  period_end    date,
  created_at    timestamptz not null default now(),
  created_by    uuid
);
create index if not exists movements_user_idx on public.movements (user_id, created_at desc);
create unique index if not exists movements_one_profit_per_period
  on public.movements (user_id, period_end) where kind = 'profit';

-- Solicitudes de retiro
create table if not exists public.withdrawal_requests (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  type          text not null check (type in ('profit', 'total')),
  amount        numeric(12, 2) not null check (amount > 0),
  profit_part   numeric(12, 2) not null default 0,   -- parte del monto que sale de ganancias
  method        text not null,
  account       text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  admin_note    text,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);
create index if not exists withdrawals_status_idx on public.withdrawal_requests (status, created_at);

-- Documentos de verificación de identidad
create table if not exists public.kyc_docs (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('id', 'selfie', 'address')),
  path         text not null,               -- ruta en el bucket privado "kyc"
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note         text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

-- Resultado real de la estrategia en cada mes (registro de desempeño)
create table if not exists public.monthly_results (
  id           bigserial primary key,
  real_result  numeric(6, 3) not null,        -- % logrado por la estrategia ese mes
  note         text,
  credited     integer not null default 0,    -- cuentas a las que se acreditó
  total        numeric(14, 2) not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid
);

-- ----------------------------------------------------------------------------
-- 2. FUNCIONES DE APOYO
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Referidos válidos: verificaron su identidad y tienen una inversión activa
create or replace function public.valid_referrals(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.profiles r
  where r.referred_by = p_user
    and r.kyc_status = 'verified'
    and exists (select 1 from public.investments i where i.user_id = r.id and i.status = 'active');
$$;

-- Tasa objetivo regular: 1% + 0.01% por referido válido (máximo +1%)
create or replace function public.target_rate(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select 1.0 + least(public.valid_referrals(p_user) * 0.01, 1.0);
$$;

-- Ganancias disponibles = rentabilidad acreditada − retiros solicitados no rechazados
create or replace function public.available_profits(p_user uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare v numeric;
begin
  if p_user is distinct from auth.uid() and not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  select coalesce((select sum(amount) from public.movements where user_id = p_user and kind = 'profit'), 0)
       - coalesce((select sum(profit_part) from public.withdrawal_requests where user_id = p_user and status <> 'rejected'), 0)
    into v;
  return greatest(round(v, 2), 0);
end $$;

-- Código de referido único
create or replace function public.new_ref_code(p_first text)
returns text language plpgsql volatile set search_path = public as $$
declare
  base text := upper(left(regexp_replace(coalesce(p_first, ''), '[^A-Za-z]', '', 'g'), 4));
  code text;
begin
  if base = '' then base := 'USER'; end if;
  loop
    code := 'JHOEL-' || base || lpad((floor(random() * 100))::int::text, 2, '0');
    exit when not exists (select 1 from public.profiles where ref_code = code);
    base := base || chr(65 + floor(random() * 26)::int);
  end loop;
  return code;
end $$;

-- Al registrarse un usuario se crea su perfil con los datos del formulario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_ref uuid;
begin
  select id into v_ref from public.profiles
   where ref_code = upper(trim(coalesce(meta ->> 'ref_code', ''))) limit 1;

  insert into public.profiles (id, email, first_name, last_name, phone, country, ref_code, referred_by)
  values (
    new.id, new.email,
    left(trim(coalesce(meta ->> 'first_name', '')), 80),
    left(trim(coalesce(meta ->> 'last_name', '')), 80),
    left(trim(coalesce(meta ->> 'phone', '')), 30),
    left(trim(coalesce(meta ->> 'country', '')), 60),
    public.new_ref_code(meta ->> 'first_name'),
    v_ref
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. FUNCIONES DEL INVERSIONISTA
-- ----------------------------------------------------------------------------

-- Lista de mis referidos (nombre abreviado, fecha y si es válido)
create or replace function public.my_referrals()
returns table (name text, created_at timestamptz, is_valid boolean)
language sql stable security definer set search_path = public as $$
  select
    initcap(split_part(r.first_name, ' ', 1)) || ' ' || upper(left(r.last_name, 1)) || '.',
    r.created_at,
    (r.kyc_status = 'verified'
      and exists (select 1 from public.investments i where i.user_id = r.id and i.status = 'active'))
  from public.profiles r
  where r.referred_by = auth.uid()
  order by r.created_at;
$$;

-- Solicitar un retiro de ganancias ('profit') o el retiro total ('total')
create or replace function public.request_withdrawal(p_type text, p_amount numeric, p_method text, p_account text)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_kyc text;
  v_avail numeric;
  v_inv public.investments;
  v_id bigint;
begin
  if uid is null then raise exception 'Debes iniciar sesión.'; end if;
  select kyc_status into v_kyc from public.profiles where id = uid;
  if v_kyc is distinct from 'verified' then
    raise exception 'Completa la verificación de identidad para habilitar retiros.';
  end if;
  if coalesce(trim(p_method), '') = '' or length(trim(coalesce(p_account, ''))) < 6 then
    raise exception 'Indica el método y la cuenta de destino.';
  end if;

  -- Bloquea la inversión para evitar dos solicitudes simultáneas
  select * into v_inv from public.investments
   where user_id = uid and status in ('active', 'closing') for update;
  if not found then raise exception 'No tienes una inversión activa.'; end if;
  if v_inv.status = 'closing' then raise exception 'Ya tienes un retiro total en proceso.'; end if;

  v_avail := public.available_profits(uid);

  if p_type = 'profit' then
    if p_amount is null or p_amount < 10 then raise exception 'El monto mínimo de retiro es US$10.'; end if;
    if p_amount > v_avail then raise exception 'El monto supera tus ganancias disponibles (US$%).', v_avail; end if;
    insert into public.withdrawal_requests (user_id, type, amount, profit_part, method, account)
    values (uid, 'profit', round(p_amount, 2), round(p_amount, 2), trim(p_method), trim(p_account))
    returning id into v_id;
  elsif p_type = 'total' then
    insert into public.withdrawal_requests (user_id, type, amount, profit_part, method, account)
    values (uid, 'total', v_inv.capital + v_avail, v_avail, trim(p_method), trim(p_account))
    returning id into v_id;
    update public.investments set status = 'closing' where id = v_inv.id;
  else
    raise exception 'Tipo de retiro no válido.';
  end if;
  return v_id;
end $$;

-- Registrar un documento subido para la verificación
create or replace function public.submit_kyc_doc(p_kind text, p_path text)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_kind not in ('id', 'selfie', 'address') then raise exception 'Tipo de documento no válido.'; end if;
  if split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'Ruta no válida.'; end if;
  insert into public.kyc_docs (user_id, kind, path) values (auth.uid(), p_kind, p_path) returning id into v_id;
  update public.profiles set kyc_status = 'in_review'
   where id = auth.uid() and kyc_status in ('pending', 'rejected');
  return v_id;
end $$;

-- ----------------------------------------------------------------------------
-- 4. FUNCIONES DEL ADMINISTRADOR
-- ----------------------------------------------------------------------------

create or replace function public.assert_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores.'; end if;
end $$;

-- Cifras generales
create or replace function public.admin_stats()
returns table (
  capital_total numeric, investors_active integer, investors_total integer,
  withdrawals_pending integer, withdrawals_pending_amount numeric,
  kyc_pending integer, profits_month numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query select
    coalesce((select sum(capital) from public.investments where status in ('active', 'closing')), 0),
    (select count(*)::int from public.investments where status = 'active'),
    (select count(*)::int from public.profiles where role = 'investor'),
    (select count(*)::int from public.withdrawal_requests where status in ('pending', 'approved')),
    coalesce((select sum(amount) from public.withdrawal_requests where status in ('pending', 'approved')), 0),
    (select count(distinct user_id)::int from public.kyc_docs where status = 'pending'),
    coalesce((select sum(amount) from public.movements
              where kind = 'profit' and created_at >= date_trunc('month', now())), 0);
end $$;

-- Lista de inversionistas con sus cifras
create or replace function public.admin_investors()
returns table (
  id uuid, email text, first_name text, last_name text, phone text, country text, doc_number text,
  kyc_status text, ref_code text, referred_by_name text, created_at timestamptz,
  investment_id uuid, capital numeric, start_date date, promo_until date, inv_status text,
  profits_total numeric, available numeric, valid_refs integer, rate numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
  select p.id, p.email, p.first_name, p.last_name, p.phone, p.country, p.doc_number,
         p.kyc_status, p.ref_code,
         nullif(trim(coalesce(rp.first_name, '') || ' ' || coalesce(rp.last_name, '')), ''),
         p.created_at,
         i.id, coalesce(i.capital, 0), i.start_date, i.promo_until, coalesce(i.status, 'none'),
         coalesce((select sum(m.amount) from public.movements m where m.user_id = p.id and m.kind = 'profit'), 0),
         public.available_profits(p.id),
         public.valid_referrals(p.id),
         public.target_rate(p.id)
  from public.profiles p
  left join public.profiles rp on rp.id = p.referred_by
  left join lateral (
    select * from public.investments x where x.user_id = p.id and x.status in ('active', 'closing') limit 1
  ) i on true
  where p.role = 'investor'
  order by p.created_at desc;
end $$;

-- Registrar un depósito: crea la inversión si no existe o suma capital
create or replace function public.admin_register_deposit(
  p_user uuid, p_amount numeric, p_detail text default 'Transferencia bancaria',
  p_start date default current_date, p_promo boolean default false
) returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_inv public.investments;
begin
  perform public.assert_admin();
  if p_amount is null or p_amount <= 0 then raise exception 'Monto no válido.'; end if;

  select * into v_inv from public.investments
   where user_id = p_user and status in ('active', 'closing') for update;

  if not found then
    if p_amount < 100 or p_amount > 100000 then
      raise exception 'La inversión inicial debe estar entre US$100 y US$100,000.';
    end if;
    insert into public.investments (user_id, capital, start_date, promo_until)
    values (p_user, round(p_amount, 2), p_start,
            case when p_promo then (p_start + interval '3 months')::date end)
    returning * into v_inv;
  else
    if v_inv.status = 'closing' then raise exception 'La inversión está en proceso de cierre.'; end if;
    if v_inv.capital + p_amount > 100000 then raise exception 'El capital total no puede superar US$100,000.'; end if;
    update public.investments set capital = capital + round(p_amount, 2) where id = v_inv.id;
  end if;

  insert into public.movements (user_id, kind, amount, detail, created_by)
  values (p_user, 'deposit', round(p_amount, 2), coalesce(nullif(trim(p_detail), ''), 'Depósito'), auth.uid());
  return v_inv.id;
end $$;

-- Aprobar, marcar como pagado o rechazar un retiro
create or replace function public.admin_process_withdrawal(p_id bigint, p_status text, p_note text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare r public.withdrawal_requests; v_inv public.investments;
begin
  perform public.assert_admin();
  if p_status not in ('approved', 'paid', 'rejected') then raise exception 'Estado no válido.'; end if;
  select * into r from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada.'; end if;
  if r.status in ('paid', 'rejected') then raise exception 'Esta solicitud ya fue cerrada.'; end if;

  update public.withdrawal_requests
     set status = p_status, admin_note = coalesce(p_note, admin_note), processed_at = now()
   where id = p_id;

  if p_status = 'paid' then
    if r.profit_part > 0 then
      insert into public.movements (user_id, kind, amount, detail, created_by)
      values (r.user_id, 'withdraw', -r.profit_part, r.method, auth.uid());
    end if;
    if r.type = 'total' then
      select * into v_inv from public.investments
       where user_id = r.user_id and status = 'closing' for update;
      if found then
        insert into public.movements (user_id, kind, amount, detail, created_by)
        values (r.user_id, 'capital_return', -v_inv.capital, r.method, auth.uid());
        update public.investments set status = 'closed', closed_at = now() where id = v_inv.id;
      end if;
    end if;
  elsif p_status = 'rejected' and r.type = 'total' then
    update public.investments set status = 'active' where user_id = r.user_id and status = 'closing';
  end if;
end $$;

-- Revisar un documento de verificación
create or replace function public.admin_review_kyc(p_doc bigint, p_status text, p_note text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_user uuid; v_ok int;
begin
  perform public.assert_admin();
  if p_status not in ('approved', 'rejected') then raise exception 'Estado no válido.'; end if;
  update public.kyc_docs set status = p_status, note = p_note, reviewed_at = now()
   where id = p_doc returning user_id into v_user;
  if v_user is null then raise exception 'Documento no encontrado.'; end if;

  select count(distinct kind) into v_ok from public.kyc_docs where user_id = v_user and status = 'approved';
  update public.profiles set kyc_status = case
      when v_ok >= 3 then 'verified'
      when p_status = 'rejected' then 'rejected'
      else 'in_review' end
   where id = v_user;
end $$;

-- Cambiar a mano el estado de verificación (por ejemplo, verificado por videollamada)
create or replace function public.admin_set_kyc(p_user uuid, p_status text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.assert_admin();
  if p_status not in ('pending', 'in_review', 'verified', 'rejected') then raise exception 'Estado no válido.'; end if;
  update public.profiles set kyc_status = p_status where id = p_user;
end $$;

-- Rentabilidad del mes.
-- Para cada inversión activa con un periodo mensual vencido calcula:
--   tasa objetivo = 2% si el periodo termina dentro de la promoción, si no 1% + bono de referidos
--   tasa aplicada = la menor entre la tasa objetivo y el resultado real del mes
-- Con p_commit = false solo muestra la vista previa; con true la acredita.
create or replace function public.credit_rows(p_real numeric)
returns table (
  user_id uuid, name text, capital numeric, period_start date, period_end date,
  target numeric, applied numeric, amount numeric
) language sql stable security definer set search_path = public as $$
  select i.user_id,
         trim(p.first_name || ' ' || p.last_name),
         i.capital,
         (i.start_date + make_interval(months => n.paid))::date,
         (i.start_date + make_interval(months => n.paid + 1))::date,
         t.target,
         least(t.target, p_real),
         round(i.capital * least(t.target, p_real) / 100, 2)
  from public.investments i
  join public.profiles p on p.id = i.user_id
  cross join lateral (
    select count(*)::int as paid from public.movements m
     where m.user_id = i.user_id and m.kind = 'profit' and m.period_start >= i.start_date
  ) n
  cross join lateral (
    select case
      when i.promo_until is not null
           and (i.start_date + make_interval(months => n.paid + 1))::date <= i.promo_until
        then greatest(2.0, public.target_rate(i.user_id))
      else public.target_rate(i.user_id) end as target
  ) t
  where i.status = 'active'
    and (i.start_date + make_interval(months => n.paid + 1))::date <= current_date;
$$;

create or replace function public.admin_credit_profits(p_real_result numeric, p_commit boolean default false, p_note text default null)
returns table (
  user_id uuid, name text, capital numeric, period_start date, period_end date,
  target numeric, applied numeric, amount numeric
) language plpgsql volatile security definer set search_path = public as $$
declare r record; v_count int := 0; v_total numeric := 0;
begin
  perform public.assert_admin();
  if p_real_result is null or p_real_result < 0 or p_real_result > 10 then
    raise exception 'Indica el resultado real del mes (entre 0%% y 10%%).';
  end if;
  for r in select * from public.credit_rows(p_real_result) c order by c.name loop
    user_id := r.user_id; name := r.name; capital := r.capital;
    period_start := r.period_start; period_end := r.period_end;
    target := r.target; applied := r.applied; amount := r.amount;
    return next;
    if p_commit and r.amount > 0 then
      insert into public.movements (user_id, kind, amount, rate, detail, period_start, period_end, created_by)
      values (r.user_id, 'profit', r.amount, r.applied,
              'Rentabilidad ' || to_char(r.applied, 'FM0.00') || '% sobre US$' || to_char(r.capital, 'FM999,999.00'),
              r.period_start, r.period_end, auth.uid());
      v_count := v_count + 1; v_total := v_total + r.amount;
    end if;
  end loop;
  if p_commit then
    insert into public.monthly_results (real_result, note, credited, total, created_by)
    values (p_real_result, p_note, v_count, v_total, auth.uid());
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. SEGURIDAD (Row Level Security)
-- ----------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.investments         enable row level security;
alter table public.movements           enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.kyc_docs            enable row level security;
alter table public.monthly_results     enable row level security;

drop policy if exists "perfil propio o admin" on public.profiles;
create policy "perfil propio o admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
drop policy if exists "admin edita perfiles" on public.profiles;
create policy "admin edita perfiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "inversion propia o admin" on public.investments;
create policy "inversion propia o admin" on public.investments
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "movimientos propios o admin" on public.movements;
create policy "movimientos propios o admin" on public.movements
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "retiros propios o admin" on public.withdrawal_requests;
create policy "retiros propios o admin" on public.withdrawal_requests
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "documentos propios o admin" on public.kyc_docs;
create policy "documentos propios o admin" on public.kyc_docs
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "resultados solo admin" on public.monthly_results;
create policy "resultados solo admin" on public.monthly_results
  for select to authenticated using (public.is_admin());

-- Los cambios de dinero solo se hacen con las funciones de arriba.
revoke insert, update, delete, truncate on public.investments, public.movements,
  public.withdrawal_requests, public.kyc_docs, public.monthly_results from anon, authenticated;
revoke insert, delete, truncate on public.profiles from anon, authenticated;
revoke all on all tables in schema public from anon;

-- Funciones: solo usuarios con sesión
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_admin(), public.valid_referrals(uuid), public.target_rate(uuid), public.available_profits(uuid),
  public.my_referrals(), public.request_withdrawal(text, numeric, text, text), public.submit_kyc_doc(text, text),
  public.admin_stats(), public.admin_investors(),
  public.admin_register_deposit(uuid, numeric, text, date, boolean),
  public.admin_process_withdrawal(bigint, text, text), public.admin_review_kyc(bigint, text, text),
  public.admin_set_kyc(uuid, text), public.admin_credit_profits(numeric, boolean, text)
to authenticated;

-- ----------------------------------------------------------------------------
-- 6. ARCHIVOS DE VERIFICACIÓN (bucket privado "kyc")
--    Cada usuario sube a la carpeta con su propio id: <user_id>/<archivo>
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "kyc subir propio" on storage.objects;
create policy "kyc subir propio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kyc ver propio o admin" on storage.objects;
create policy "kyc ver propio o admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'kyc' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ----------------------------------------------------------------------------
-- 7. HACERTE ADMINISTRADOR
--    Primero regístrate en la web con tu correo y luego ejecuta (cambiando el correo):
--
--    update public.profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';
-- ----------------------------------------------------------------------------
