-- ============================================================================
-- Jhoel 1% — Solicitudes de depósito ("Agregar capital")
-- Ejecutar DESPUÉS de schema.sql. Se puede ejecutar más de una vez.
-- ============================================================================

-- Solicitudes que crea el inversionista desde su panel
create table if not exists public.deposit_requests (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  amount        numeric(12, 2) not null check (amount > 0),
  method        text not null check (method in ('binance', 'bank', 'yape')),
  reference     text not null,                -- n.º de orden, ID de transacción u operación
  receipt_path  text,                         -- comprobante en el bucket privado "receipts"
  status        text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  admin_note    text,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);
create index if not exists deposit_requests_status_idx on public.deposit_requests (status, created_at);
alter table public.deposit_requests enable row level security;

drop policy if exists "depositos propios o admin" on public.deposit_requests;
create policy "depositos propios o admin" on public.deposit_requests
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

revoke insert, update, delete, truncate on public.deposit_requests from anon, authenticated;
revoke all on public.deposit_requests from anon;

-- El inversionista avisa que hizo un pago
create or replace function public.request_deposit(p_amount numeric, p_method text, p_reference text, p_receipt_path text default null)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_cap numeric; v_open int; v_id bigint;
begin
  if uid is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_method not in ('binance', 'bank', 'yape') then raise exception 'Medio de pago no válido.'; end if;
  if length(trim(coalesce(p_reference, ''))) < 4 then raise exception 'Escribe el número de operación o ID de la transacción.'; end if;
  if p_receipt_path is not null and split_part(p_receipt_path, '/', 1) <> uid::text then raise exception 'Comprobante no válido.'; end if;

  select capital into v_cap from public.investments where user_id = uid and status = 'active';
  if exists (select 1 from public.investments where user_id = uid and status = 'closing') then
    raise exception 'Tu inversión está en proceso de cierre.';
  end if;
  if v_cap is null and (p_amount is null or p_amount < 100) then raise exception 'La inversión inicial mínima es US$100.'; end if;
  if p_amount is null or p_amount < 50 then raise exception 'El monto mínimo para agregar capital es US$50.'; end if;
  if coalesce(v_cap, 0) + p_amount > 100000 then raise exception 'El capital total no puede superar US$100,000.'; end if;

  select count(*) into v_open from public.deposit_requests where user_id = uid and status = 'pending';
  if v_open >= 3 then raise exception 'Tienes 3 depósitos por confirmar. Espera a que los revisemos.'; end if;

  insert into public.deposit_requests (user_id, amount, method, reference, receipt_path)
  values (uid, round(p_amount, 2), p_method, left(trim(p_reference), 120), p_receipt_path)
  returning id into v_id;
  return v_id;
end $$;

-- El administrador confirma (acredita el capital) o rechaza
create or replace function public.admin_process_deposit(p_id bigint, p_status text, p_note text default null, p_promo boolean default false)
returns void language plpgsql volatile security definer set search_path = public as $$
declare r public.deposit_requests;
  labels constant jsonb := '{"binance":"Binance","bank":"Transferencia bancaria","yape":"Yape / Plin"}';
begin
  perform public.assert_admin();
  if p_status not in ('confirmed', 'rejected') then raise exception 'Estado no válido.'; end if;
  select * into r from public.deposit_requests where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada.'; end if;
  if r.status <> 'pending' then raise exception 'Esta solicitud ya fue procesada.'; end if;

  if p_status = 'confirmed' then
    perform public.admin_register_deposit(r.user_id, r.amount,
      (labels ->> r.method) || ' · ' || r.reference, current_date, p_promo);
  end if;

  update public.deposit_requests
     set status = p_status, admin_note = p_note, processed_at = now()
   where id = p_id;
end $$;

revoke execute on function public.request_deposit(numeric, text, text, text) from public, anon;
revoke execute on function public.admin_process_deposit(bigint, text, text, boolean) from public, anon;
grant execute on function public.request_deposit(numeric, text, text, text) to authenticated;
grant execute on function public.admin_process_deposit(bigint, text, text, boolean) to authenticated;

-- Comprobantes de pago (bucket privado "receipts"): cada usuario en su carpeta
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "comprobante subir propio" on storage.objects;
create policy "comprobante subir propio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "comprobante ver propio o admin" on storage.objects;
create policy "comprobante ver propio o admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
