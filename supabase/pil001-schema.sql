-- ============================================================
-- PIL-001 v1.0 — SQL COMPLETO PARA SUPABASE
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- Orden: extensiones → tablas → índices → seed → RLS → políticas
-- ============================================================

-- 0. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLAS
CREATE TABLE public.rubros (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 nombre TEXT NOT NULL UNIQUE,
 tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'utilidad')),
 grupo_proveedor TEXT,
 activo BOOLEAN NOT NULL DEFAULT true,
 orden INT NOT NULL DEFAULT 0
);

CREATE TABLE public.transacciones (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 fecha DATE NOT NULL,
 mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
 anio INT NOT NULL,
 numero INT,
 cliente TEXT,
 producto TEXT,
 presupuesto NUMERIC(15,2) DEFAULT 0,
 presupuesto_proveedor NUMERIC(15,2) DEFAULT 0,
 cobro_1 NUMERIC(15,2) DEFAULT 0,
 pendiente NUMERIC(15,2) DEFAULT 0,
 fecha_2 DATE,
 mes_2 INT,
 anio_2 INT,
 cobro_2 NUMERIC(15,2) DEFAULT 0,
 cobro_total NUMERIC(15,2) DEFAULT 0,
 saldo NUMERIC(15,2) DEFAULT 0,
 rubro_id UUID NOT NULL REFERENCES public.rubros(id),
 gastos NUMERIC(15,2) DEFAULT 0,
 moneda TEXT NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS', 'USD')),
 monto_usd NUMERIC(15,2),
 cotizacion_usd NUMERIC(15,2),
 es_canje_usd BOOLEAN NOT NULL DEFAULT false,
 migrado BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transacciones_mes_anio ON public.transacciones(mes, anio);
CREATE INDEX idx_transacciones_rubro ON public.transacciones(rubro_id);
CREATE INDEX idx_transacciones_fecha ON public.transacciones(fecha);

CREATE TABLE public.cuenta_usd (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 fecha DATE NOT NULL,
 tipo TEXT NOT NULL CHECK (tipo IN ('compra', 'pago_proveedor', 'retiro_pilar')),
 monto_usd NUMERIC(15,2) NOT NULL,
 cotizacion_blue NUMERIC(15,2) NOT NULL,
 monto_ars_equivalente NUMERIC(15,2) NOT NULL,
 transaccion_id UUID REFERENCES public.transacciones(id),
 descripcion TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cuenta_usd_fecha ON public.cuenta_usd(fecha);

CREATE TABLE public.deudas (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 concepto TEXT NOT NULL,
 monto NUMERIC(15,2) DEFAULT 0,
 vencimiento DATE,
 activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.caja (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 concepto TEXT NOT NULL UNIQUE,
 monto NUMERIC(15,2) DEFAULT 0,
 detalle TEXT,
 orden INT NOT NULL DEFAULT 0
);

CREATE TABLE public.cotizacion_usd_cache (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 fecha DATE NOT NULL UNIQUE,
 blue_compra NUMERIC(15,2),
 blue_venta NUMERIC(15,2),
 blue_promedio NUMERIC(15,2) NOT NULL,
 source TEXT NOT NULL DEFAULT 'dolarhoy',
 fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id)
);

-- 2. SEED DATA
INSERT INTO public.rubros (nombre, tipo, grupo_proveedor, activo, orden) VALUES
 ('Ventas Maxi Pisos', 'ingreso', 'Maxi Pisos', true, 1),
 ('Ventas Mozzetto', 'ingreso', 'Mozzetto', true, 2),
 ('Ventas Flex-Color', 'ingreso', 'Flex-Color', true, 3),
 ('Ventas Lamparas', 'ingreso', 'Lamparas', true, 4),
 ('Ventas Mobile', 'ingreso', 'Mobile', true, 5),
 ('Ventas Muresco', 'ingreso', 'Muresco', true, 6),
 ('Ventas Otros', 'ingreso', 'Otros', true, 7),
 ('Liquidación USD', 'ingreso', NULL, true, 8),
 ('Maxi Pisos - Pagos', 'egreso', 'Maxi Pisos', true, 10),
 ('Mozzetto - Pagos', 'egreso', 'Mozzetto', true, 11),
 ('Flex-Color - Pagos', 'egreso', 'Flex-Color', true, 12),
 ('Lamparas - Pagos', 'egreso', 'Lamparas', true, 13),
 ('Mobile - Pagos', 'egreso', 'Mobile', true, 14),
 ('Muresco - Pagos', 'egreso', 'Muresco', true, 15),
 ('Otros Proveedores - Pagos','egreso', 'Otros', true, 16),
 ('Impuestos', 'egreso', NULL, true, 20),
 ('Viaticos/Combustible', 'egreso', NULL, true, 21),
 ('Ferreteria', 'egreso', NULL, true, 22),
 ('Publicidad', 'egreso', NULL, true, 23),
 ('Alquiler', 'egreso', NULL, true, 24),
 ('Colocación', 'egreso', NULL, true, 25),
 ('Servicios', 'egreso', NULL, true, 26),
 ('Fletes', 'egreso', NULL, true, 27),
 ('Gastos Generales', 'egreso', NULL, true, 28),
 ('Contador', 'egreso', NULL, true, 29),
 ('AFIP', 'egreso', NULL, true, 30),
 ('Showroom', 'egreso', NULL, true, 31),
 ('Compra Dolares', 'utilidad', NULL, true, 40),
 ('Utilidades Pilar', 'utilidad', NULL, true, 41),
 ('Utilidades Male', 'utilidad', NULL, false, 99);

INSERT INTO public.deudas (concepto, monto, activo) VALUES
 ('La Cueva', 0, true),
 ('Marmolin', 0, true),
 ('Flex-Color', 0, true),
 ('Lamparas', 0, true),
 ('Mobile', 0, true),
 ('Muresco', 0, true),
 ('Otros', 0, true),
 ('Servicios', 0, true),
 ('Male', 0, true),
 ('Pili', 0, true);

INSERT INTO public.caja (concepto, monto, orden) VALUES
 ('Efectivo Pili', 541800.00, 1),
 ('Banco Nacion', 602512.13, 2),
 ('Banco pcia. Credito', 0.00, 3),
 ('Cheques', 0.00, 4),
 ('Dolares', 5870.00, 5);

-- 3. RLS
ALTER TABLE public.rubros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuenta_usd ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_usd_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. HELPER ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid()
  AND role = 'admin'
 );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. POLICIES
CREATE POLICY "rubros_select" ON public.rubros
 FOR SELECT TO authenticated USING (true);
CREATE POLICY "rubros_insert" ON public.rubros
 FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "rubros_update" ON public.rubros
 FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "transacciones_select" ON public.transacciones
 FOR SELECT TO authenticated USING (true);
CREATE POLICY "transacciones_insert" ON public.transacciones
 FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "transacciones_update" ON public.transacciones
 FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "transacciones_delete" ON public.transacciones
 FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "cuenta_usd_select" ON public.cuenta_usd
 FOR SELECT TO authenticated USING (true);
CREATE POLICY "cuenta_usd_insert" ON public.cuenta_usd
 FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "cuenta_usd_update" ON public.cuenta_usd
 FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "deudas_select" ON public.deudas
 FOR SELECT TO authenticated USING (true);
CREATE POLICY "deudas_insert" ON public.deudas
 FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "deudas_update" ON public.deudas
 FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "deudas_delete" ON public.deudas
 FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "caja_select" ON public.caja
 FOR SELECT TO authenticated USING (true);
CREATE POLICY "caja_update" ON public.caja
 FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "cotizacion_select" ON public.cotizacion_usd_cache
 FOR SELECT TO authenticated USING (true);
CREATE POLICY "cotizacion_insert" ON public.cotizacion_usd_cache
 FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "user_roles_select_own" ON public.user_roles
 FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_select_admin" ON public.user_roles
 FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "user_roles_insert" ON public.user_roles
 FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "user_roles_update" ON public.user_roles
 FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "user_roles_delete" ON public.user_roles
 FOR DELETE TO authenticated USING (public.is_admin());
