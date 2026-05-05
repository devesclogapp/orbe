-- ============================================================
-- NUCLEAR FIX: Isolamento TOTAL de regras_modulos / regras_campos / regras_dados
-- Data: 2026-05-15
-- Problema: Dados da aba "Meios de Pagamentos" (regras_dados) aparecem para
--   todos os tenants porque:
--   1. Policies antigas usam USING (true) — sem restrição alguma
--   2. Migration 20260514f usou OR tenant_id IS NULL — ainda vaza registros
--      que não foram corretamente associados a um tenant
-- Solução:
--   - Dropar TODAS as policies permissivas (incluindo nomes duplicados)
--   - Popular tenant_id via a árvore de relacionamentos correta
--   - Criar UMA única policy rígida: tenant_id = current_tenant_id()
--   - Sem OR NULL, sem USING (true)
-- ============================================================

-- ============================================================
-- PASSO 1: Garantir colunas tenant_id existem
-- ============================================================
ALTER TABLE public.regras_modulos  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.regras_campos   ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.regras_dados    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- ============================================================
-- PASSO 2: Popular tenant_id nos registros existentes
-- Estratégia: identificar o tenant principal (admin real, não suporte)
-- via o perfil cujo papel é admin E tem mais empresas vinculadas
-- ============================================================

-- 2a. Popular regras_modulos com tenant_id = tenant principal do sistema
--     (usamos o tenant que possui o maior número de empresas ATIVAS)
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Pega o tenant com mais empresas cadastradas (heurístico mais seguro)
  SELECT t.id INTO v_tenant_id
  FROM public.tenants t
  JOIN public.empresas e ON e.tenant_id = t.id
  GROUP BY t.id
  ORDER BY COUNT(e.id) DESC
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    -- Atribui somente registros sem tenant_id
    UPDATE public.regras_modulos  SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    RAISE NOTICE 'regras_modulos: tenant_id populado com %', v_tenant_id;
  ELSE
    RAISE WARNING 'Nenhum tenant encontrado para popular regras_modulos!';
  END IF;
END $$;

-- 2b. Popular regras_campos via regras_modulos (parent)
UPDATE public.regras_campos rc
SET    tenant_id = rm.tenant_id
FROM   public.regras_modulos rm
WHERE  rc.modulo_id = rm.id
  AND  rc.tenant_id IS NULL
  AND  rm.tenant_id IS NOT NULL;

-- 2c. Popular regras_dados via regras_modulos (parent)
UPDATE public.regras_dados rd
SET    tenant_id = rm.tenant_id
FROM   public.regras_modulos rm
WHERE  rd.modulo_id = rm.id
  AND  rd.tenant_id IS NULL
  AND  rm.tenant_id IS NOT NULL;

-- ============================================================
-- PASSO 3: Dropar TODAS as policies existentes (qualquer nome)
-- ============================================================

-- regras_modulos
DROP POLICY IF EXISTS "Allow read access to authenticated users"   ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_modulos;
DROP POLICY IF EXISTS "regras_modulos_authenticated"               ON public.regras_modulos;
DROP POLICY IF EXISTS "regras_modulos_tenant_all"                  ON public.regras_modulos;

-- regras_campos
DROP POLICY IF EXISTS "Allow read access to authenticated users"   ON public.regras_campos;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.regras_campos;
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_campos;
DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_campos;
DROP POLICY IF EXISTS "regras_campos_authenticated"                ON public.regras_campos;
DROP POLICY IF EXISTS "regras_campos_tenant_all"                   ON public.regras_campos;

-- regras_dados
DROP POLICY IF EXISTS "Allow read access to authenticated users"   ON public.regras_dados;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.regras_dados;
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_dados;
DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_dados;
DROP POLICY IF EXISTS "regras_dados_authenticated"                 ON public.regras_dados;
DROP POLICY IF EXISTS "regras_dados_tenant_all"                    ON public.regras_dados;

-- ============================================================
-- PASSO 4: Habilitar RLS (se ainda não estiver)
-- ============================================================
ALTER TABLE public.regras_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_campos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_dados   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASSO 5: Criar UMA única policy RÍGIDA por tabela
-- SEM OR NULL — isolamento absoluto
-- ============================================================

CREATE POLICY "regras_modulos_tenant_all" ON public.regras_modulos
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "regras_campos_tenant_all" ON public.regras_campos
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "regras_dados_tenant_all" ON public.regras_dados
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ============================================================
-- PASSO 6: Triggers auto_tenant para novos registros
-- ============================================================

-- regras_modulos
DROP TRIGGER IF EXISTS trg_auto_tenant_regras_modulos ON public.regras_modulos;
CREATE TRIGGER trg_auto_tenant_regras_modulos
  BEFORE INSERT ON public.regras_modulos
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- regras_campos
DROP TRIGGER IF EXISTS trg_auto_tenant_regras_campos ON public.regras_campos;
CREATE TRIGGER trg_auto_tenant_regras_campos
  BEFORE INSERT ON public.regras_campos
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- regras_dados
DROP TRIGGER IF EXISTS trg_auto_tenant_regras_dados ON public.regras_dados;
CREATE TRIGGER trg_auto_tenant_regras_dados
  BEFORE INSERT ON public.regras_dados
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- ============================================================
-- PASSO 7: Índices de performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_regras_modulos_tenant_id ON public.regras_modulos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_regras_campos_tenant_id  ON public.regras_campos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_regras_dados_tenant_id   ON public.regras_dados(tenant_id);

-- ============================================================
-- VERIFICAÇÃO FINAL — execute após aplicar no Supabase
-- Todas as policies devem mostrar qual = (tenant_id = current_tenant_id())
-- Nenhum registro deve aparecer com tenant_id NULL
-- ============================================================
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('regras_modulos', 'regras_campos', 'regras_dados')
ORDER BY tablename, policyname;

-- Confirmar que não há registros orfãos sem tenant_id
SELECT 'regras_modulos' AS tabela, COUNT(*) FILTER (WHERE tenant_id IS NULL) AS sem_tenant, COUNT(*) AS total FROM public.regras_modulos
UNION ALL
SELECT 'regras_campos',  COUNT(*) FILTER (WHERE tenant_id IS NULL), COUNT(*) FROM public.regras_campos
UNION ALL
SELECT 'regras_dados',   COUNT(*) FILTER (WHERE tenant_id IS NULL), COUNT(*) FROM public.regras_dados;
