-- ============================================================
-- Coletores: flexibilizar campos obrigatórios
-- 
-- Problema: modelo e serie eram NOT NULL no schema inicial,
-- impedindo o cadastro quando o hardware ainda não está disponível.
--
-- Solução:
--   1. Tornar modelo nullable (informação técnica opcional)
--   2. Tornar serie nullable e remover UNIQUE global
--      (série pode ser NULL para coletores virtuais/drive)
--   3. serie UNIQUE apenas quando preenchida (por tenant)
--   4. nome_coletor passa a ser o identificador primário
--   5. Corrigir FK unidade_id para referenciar 'unidades'
--      (tabela operacional com empresa_id, usada em todo o sistema)
--   6. Garantir RLS em unidades_operacionais
-- ============================================================

-- 1. Tornar modelo nullable
ALTER TABLE public.coletores
  ALTER COLUMN modelo DROP NOT NULL;

-- 2. Tornar serie nullable
ALTER TABLE public.coletores
  ALTER COLUMN serie DROP NOT NULL;

-- 3. Remover UNIQUE global de serie
ALTER TABLE public.coletores
  DROP CONSTRAINT IF EXISTS coletores_serie_key;

-- 4. Unique parcial: apenas quando serie está preenchida, por tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_coletores_serie_unica_quando_preenchida
  ON public.coletores (tenant_id, serie)
  WHERE serie IS NOT NULL AND serie != '';

-- 5. Backfill nome_coletor para registros sem nome
UPDATE public.coletores
SET nome_coletor = COALESCE(
  NULLIF(nome_coletor, ''),
  CASE 
    WHEN modelo IS NOT NULL AND serie IS NOT NULL THEN modelo || ' · ' || serie
    WHEN modelo IS NOT NULL THEN modelo
    WHEN serie IS NOT NULL THEN 'Coletor ' || serie
    ELSE 'Coletor ' || id::text
  END
)
WHERE nome_coletor IS NULL OR nome_coletor = '';

-- 6. nome_coletor obrigatório
ALTER TABLE public.coletores
  ALTER COLUMN nome_coletor SET NOT NULL;

-- 7. Corrigir FK: unidade_id dos coletores deve referenciar 'unidades'
--    (tabela principal do sistema, com empresa_id)
--    A FK para unidades_operacionais (criada em 20260520) pode coexistir,
--    mas o select vai usar 'unidades' como fonte primária.
--    Não precisamos alterar a FK do banco — apenas o select no serviço.

-- 8. Garantir que unidades_operacionais tem RLS ativo e política de leitura
ALTER TABLE IF EXISTS public.unidades_operacionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unidades_operacionais_select" ON public.unidades_operacionais;
CREATE POLICY "unidades_operacionais_select"
  ON public.unidades_operacionais FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT id FROM public.tenants WHERE id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ) LIMIT 1)
  );

DROP POLICY IF EXISTS "unidades_operacionais_insert" ON public.unidades_operacionais;
CREATE POLICY "unidades_operacionais_insert"
  ON public.unidades_operacionais FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT id FROM public.tenants WHERE id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ) LIMIT 1)
  );

DROP POLICY IF EXISTS "unidades_operacionais_update" ON public.unidades_operacionais;
CREATE POLICY "unidades_operacionais_update"
  ON public.unidades_operacionais FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT id FROM public.tenants WHERE id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ) LIMIT 1)
  );

COMMENT ON COLUMN public.coletores.modelo IS 'Modelo do hardware REP — opcional. Informe quando disponível.';
COMMENT ON COLUMN public.coletores.serie IS 'Número de série do hardware — opcional e único por tenant quando preenchido.';
COMMENT ON COLUMN public.coletores.nome_coletor IS 'Nome operacional obrigatório. Ex: Coletor Dismelo - Entrada Principal';
