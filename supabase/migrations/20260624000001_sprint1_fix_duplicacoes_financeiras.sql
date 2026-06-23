-- Migration: Financial Integrity Constraints (Sprint 1)
-- Enforces UNIQUE restrictions preventing concurrent recalculation from doubling financial records.
-- NOTE: Requires PostgreSQL 15+ for NULLS NOT DISTINCT

-- financeiro_consolidados_cliente: Um fechamento unico por cliente em um ciclo
ALTER TABLE public.financeiro_consolidados_cliente
DROP CONSTRAINT IF EXISTS uk_financeiro_consolidados_cliente_competencia;

DROP INDEX IF EXISTS idx_uq_fin_cons_cliente;
ALTER TABLE public.financeiro_consolidados_cliente
DROP CONSTRAINT IF EXISTS idx_uq_fin_cons_cliente;

ALTER TABLE public.financeiro_consolidados_cliente
ADD CONSTRAINT idx_uq_fin_cons_cliente UNIQUE NULLS NOT DISTINCT (tenant_id, empresa_id, cliente_id, competencia);

-- financeiro_consolidados_colaborador: Um fechamento unico por colaborador em um ciclo
ALTER TABLE public.financeiro_consolidados_colaborador
DROP CONSTRAINT IF EXISTS uk_financeiro_consolidados_colaborador_competencia;

DROP INDEX IF EXISTS idx_uq_fin_cons_colaborador;
ALTER TABLE public.financeiro_consolidados_colaborador
DROP CONSTRAINT IF EXISTS idx_uq_fin_cons_colaborador;

ALTER TABLE public.financeiro_consolidados_colaborador
ADD CONSTRAINT idx_uq_fin_cons_colaborador UNIQUE NULLS NOT DISTINCT (tenant_id, empresa_id, colaborador_id, competencia);

-- faturas: Protege contra dupla criacao da mesma fatura por competencia
DROP INDEX IF EXISTS idx_uq_faturas_motor;
ALTER TABLE public.faturas
DROP CONSTRAINT IF EXISTS uq_faturas_motor_cliente;
ALTER TABLE public.faturas
DROP CONSTRAINT IF EXISTS uq_faturas_motor_colab;

-- Cliente Fatura Unique
ALTER TABLE public.faturas
ADD CONSTRAINT uq_faturas_motor_cliente UNIQUE NULLS NOT DISTINCT (tenant_id, empresa_id, cliente_id, competencia);

-- Colaborador Fatura Unique
ALTER TABLE public.faturas
ADD CONSTRAINT uq_faturas_motor_colab UNIQUE NULLS NOT DISTINCT (tenant_id, empresa_id, colaborador_id, competencia);
