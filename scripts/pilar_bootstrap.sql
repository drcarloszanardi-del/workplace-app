create extension if not exists pgcrypto;

create table if not exists public.pilar_rubros (
 id uuid primary key default gen_random_uuid(),
 nombre text not null unique,
 tipo text not null check (tipo in ('ingreso','egreso','utilidad')),
 grupo_proveedor text,
 activo boolean not null default true,
 orden int not null default 0
);

create table if not exists public.pilar_transacciones (
 id uuid primary key default gen_random_uuid(),
 fecha date not null,
 mes int not null check (mes between 1 and 12),
 anio int not null,
 numero int,
 cliente text,
 producto text,
 presupuesto numeric(15,2) default 0,
 presupuesto_proveedor numeric(15,2) default 0,
 cobro_1 numeric(15,2) default 0,
 pendiente numeric(15,2) default 0,
 fecha_2 date,
 mes_2 int,
 anio_2 int,
 cobro_2 numeric(15,2) default 0,
 cobro_total numeric(15,2) default 0,
 saldo numeric(15,2) default 0,
 rubro_id uuid not null references public.pilar_rubros(id),
 gastos numeric(15,2) default 0,
 moneda text not null default 'ARS' check (moneda in ('ARS','USD')),
 monto_usd numeric(15,2),
 cotizacion_usd numeric(15,2),
 es_canje_usd boolean not null default false,
 migrado boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists idx_pilar_transacciones_mes_anio on public.pilar_transacciones(mes,anio);
create index if not exists idx_pilar_transacciones_rubro on public.pilar_transacciones(rubro_id);
create index if not exists idx_pilar_transacciones_fecha on public.pilar_transacciones(fecha);

create table if not exists public.pilar_cuenta_usd (
 id uuid primary key default gen_random_uuid(),
 fecha date not null,
 tipo text not null check (tipo in ('compra','pago_proveedor','retiro_pilar')),
 monto_usd numeric(15,2) not null,
 cotizacion_blue numeric(15,2) not null,
 monto_ars_equivalente numeric(15,2) not null,
 transaccion_id uuid references public.pilar_transacciones(id),
 descripcion text,
 created_at timestamptz not null default now()
);
create index if not exists idx_pilar_cuenta_usd_fecha on public.pilar_cuenta_usd(fecha);

create table if not exists public.pilar_deudas (
 id uuid primary key default gen_random_uuid(),
 concepto text not null unique,
 monto numeric(15,2) default 0,
 vencimiento date,
 activo boolean not null default true
);

create table if not exists public.pilar_caja (
 id uuid primary key default gen_random_uuid(),
 concepto text not null unique,
 monto numeric(15,2) default 0,
 detalle text,
 orden int not null default 0
);

create table if not exists public.pilar_cotizacion_usd_cache (
 id uuid primary key default gen_random_uuid(),
 fecha date not null unique,
 blue_compra numeric(15,2),
 blue_venta numeric(15,2),
 blue_promedio numeric(15,2) not null,
 source text not null default 'dolarhoy',
 fetched_at timestamptz not null default now()
);

create table if not exists public.pilar_user_roles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'viewer' check (role in ('admin','viewer')),
 created_at timestamptz not null default now(),
 unique(user_id)
);

alter table public.pilar_rubros enable row level security;
alter table public.pilar_transacciones enable row level security;
alter table public.pilar_cuenta_usd enable row level security;
alter table public.pilar_deudas enable row level security;
alter table public.pilar_caja enable row level security;
alter table public.pilar_cotizacion_usd_cache enable row level security;
alter table public.pilar_user_roles enable row level security;

create or replace function public.is_pilar_admin()
returns boolean as $$
 select exists (
  select 1 from public.pilar_user_roles
  where user_id = auth.uid()
  and role = 'admin'
 );
$$ language sql security definer stable;

DROP POLICY IF EXISTS "pilar_rubros_select" ON public.pilar_rubros;
DROP POLICY IF EXISTS "pilar_rubros_insert" ON public.pilar_rubros;
DROP POLICY IF EXISTS "pilar_rubros_update" ON public.pilar_rubros;
DROP POLICY IF EXISTS "pilar_transacciones_select" ON public.pilar_transacciones;
DROP POLICY IF EXISTS "pilar_transacciones_insert" ON public.pilar_transacciones;
DROP POLICY IF EXISTS "pilar_transacciones_update" ON public.pilar_transacciones;
DROP POLICY IF EXISTS "pilar_transacciones_delete" ON public.pilar_transacciones;
DROP POLICY IF EXISTS "pilar_cuenta_usd_select" ON public.pilar_cuenta_usd;
DROP POLICY IF EXISTS "pilar_cuenta_usd_insert" ON public.pilar_cuenta_usd;
DROP POLICY IF EXISTS "pilar_cuenta_usd_update" ON public.pilar_cuenta_usd;
DROP POLICY IF EXISTS "pilar_deudas_select" ON public.pilar_deudas;
DROP POLICY IF EXISTS "pilar_deudas_insert" ON public.pilar_deudas;
DROP POLICY IF EXISTS "pilar_deudas_update" ON public.pilar_deudas;
DROP POLICY IF EXISTS "pilar_deudas_delete" ON public.pilar_deudas;
DROP POLICY IF EXISTS "pilar_caja_select" ON public.pilar_caja;
DROP POLICY IF EXISTS "pilar_caja_update" ON public.pilar_caja;
DROP POLICY IF EXISTS "pilar_cotizacion_select" ON public.pilar_cotizacion_usd_cache;
DROP POLICY IF EXISTS "pilar_cotizacion_insert" ON public.pilar_cotizacion_usd_cache;
DROP POLICY IF EXISTS "pilar_user_roles_select_own" ON public.pilar_user_roles;
DROP POLICY IF EXISTS "pilar_user_roles_select_admin" ON public.pilar_user_roles;
DROP POLICY IF EXISTS "pilar_user_roles_insert" ON public.pilar_user_roles;
DROP POLICY IF EXISTS "pilar_user_roles_update" ON public.pilar_user_roles;
DROP POLICY IF EXISTS "pilar_user_roles_delete" ON public.pilar_user_roles;

create policy "pilar_rubros_select" on public.pilar_rubros for select to authenticated using (true);
create policy "pilar_rubros_insert" on public.pilar_rubros for insert to authenticated with check (public.is_pilar_admin());
create policy "pilar_rubros_update" on public.pilar_rubros for update to authenticated using (public.is_pilar_admin());

create policy "pilar_transacciones_select" on public.pilar_transacciones for select to authenticated using (true);
create policy "pilar_transacciones_insert" on public.pilar_transacciones for insert to authenticated with check (public.is_pilar_admin());
create policy "pilar_transacciones_update" on public.pilar_transacciones for update to authenticated using (public.is_pilar_admin());
create policy "pilar_transacciones_delete" on public.pilar_transacciones for delete to authenticated using (public.is_pilar_admin());

create policy "pilar_cuenta_usd_select" on public.pilar_cuenta_usd for select to authenticated using (true);
create policy "pilar_cuenta_usd_insert" on public.pilar_cuenta_usd for insert to authenticated with check (public.is_pilar_admin());
create policy "pilar_cuenta_usd_update" on public.pilar_cuenta_usd for update to authenticated using (public.is_pilar_admin());

create policy "pilar_deudas_select" on public.pilar_deudas for select to authenticated using (true);
create policy "pilar_deudas_insert" on public.pilar_deudas for insert to authenticated with check (public.is_pilar_admin());
create policy "pilar_deudas_update" on public.pilar_deudas for update to authenticated using (public.is_pilar_admin());
create policy "pilar_deudas_delete" on public.pilar_deudas for delete to authenticated using (public.is_pilar_admin());

create policy "pilar_caja_select" on public.pilar_caja for select to authenticated using (true);
create policy "pilar_caja_update" on public.pilar_caja for update to authenticated using (public.is_pilar_admin());

create policy "pilar_cotizacion_select" on public.pilar_cotizacion_usd_cache for select to authenticated using (true);
create policy "pilar_cotizacion_insert" on public.pilar_cotizacion_usd_cache for insert to authenticated with check (true);

create policy "pilar_user_roles_select_own" on public.pilar_user_roles for select to authenticated using (user_id = auth.uid());
create policy "pilar_user_roles_select_admin" on public.pilar_user_roles for select to authenticated using (public.is_pilar_admin());
create policy "pilar_user_roles_insert" on public.pilar_user_roles for insert to authenticated with check (public.is_pilar_admin());
create policy "pilar_user_roles_update" on public.pilar_user_roles for update to authenticated using (public.is_pilar_admin());
create policy "pilar_user_roles_delete" on public.pilar_user_roles for delete to authenticated using (public.is_pilar_admin());
