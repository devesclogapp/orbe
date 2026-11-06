-- ==============================================================================
-- ORBE ERP - FIX-OCORRÊNCIAS-06: APLICAÇÃO MANUAL NO SUPABASE SQL EDITOR
-- Arquivo: supabase/scripts/ORBE_APLICAR_INFRACOES.sql
-- Módulo: Infrações Operacionais, Deliberação Administrativa e Eventos Financeiros
-- Diretrizes:
--   1. Transacional (BEGIN / COMMIT).
--   2. Preserva integralmente tabelas e dados operacionais pré-existentes.
--   3. Zero dependências fictícias e sem valores monetários arbitrários de catálogo.
--   4. RLS fail-closed por tenant e restrição estrita contra perfil encarregado.
--   5. Imutabilidade e integridade referencial com ON DELETE RESTRICT.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TABELA: CATÁLOGO DE INFRAÇÕES OPERACIONAIS (Configurável por Admin/RH)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.infracoes_operacionais_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  codigo VARCHAR(50) NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('OPERACIONAL', 'DISCIPLINAR', 'SEGURANCA', 'QUALIDADE')),
  descricao TEXT,
  valor_referencia NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (valor_referencia >= 0),
  exige_dano_material BOOLEAN NOT NULL DEFAULT false,
  fundamentacao_padrao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.infracoes_operacionais_catalogo IS 
  'Catálogo configurado por Admin/RH contendo tipos de infração operacional, categoria e valor de referência.';

CREATE UNIQUE INDEX IF NOT EXISTS unq_infracao_tenant_codigo 
  ON public.infracoes_operacionais_catalogo(tenant_id, codigo);

CREATE INDEX IF NOT EXISTS idx_infracoes_catalogo_ativo 
  ON public.infracoes_operacionais_catalogo(tenant_id, ativo);

-- ------------------------------------------------------------------------------
-- 2. TABELA: DELIBERAÇÕES ADMINISTRATIVAS (RH / ADMIN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operacoes_ocorrencias_decisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  operacao_id UUID NOT NULL REFERENCES public.operacoes_producao(id) ON DELETE RESTRICT,
  collaborator_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
  
  -- Vínculo com catálogo e snapshot provisório registrado em campo
  infracao_id UUID REFERENCES public.infracoes_operacionais_catalogo(id) ON DELETE RESTRICT,
  infracao_codigo VARCHAR(50) NOT NULL,
  valor_provisorio_snapshot NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (valor_provisorio_snapshot >= 0),
  
  -- Decisão administrativa fundamentada
  tipo_decisao TEXT NOT NULL CHECK (
    tipo_decisao IN (
      'ARQUIVADA_SEM_PENALIDADE',
      'ADVERTENCIA_FORMAL',
      'PROPOSTA_RESSARCIMENTO'
    )
  ),
  
  -- Ciclo de vida da deliberação
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (
    status IN (
      'PENDENTE',
      'AUTORIZADO',
      'APLICADO',
      'REJEITADO',
      'CANCELADO',
      'REVISADO'
    )
  ),
  
  -- Valor efetivamente aprovado após apuração legal do dano
  valor_autorizado NUMERIC(15,2) DEFAULT 0.00 CHECK (valor_autorizado >= 0),
  competencia_sugerida VARCHAR(7), -- YYYY-MM
  
  -- Fundamentação legal obrigatória (Art. 462 CLT, dolo ou previsão contratual expressa)
  fundamento_legal TEXT NOT NULL,
  
  -- Evidências anexadas
  evidencias_anexas JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Identificação do decisor
  decidido_por UUID NOT NULL REFERENCES auth.users(id),
  decidido_por_nome TEXT NOT NULL,
  
  -- Rastreabilidade e retificações
  revisado_de_id UUID REFERENCES public.operacoes_ocorrencias_decisoes(id) ON DELETE SET NULL,
  motivo_cancelamento TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.operacoes_ocorrencias_decisoes IS 
  'Decisões e deliberações do RH/Admin sobre ocorrências registradas em operações de produção.';

-- Garante que só possa existir uma deliberação em andamento ou autorizada por colaborador em uma operação
CREATE UNIQUE INDEX IF NOT EXISTS unq_active_ocorrencia_decisao_v2
  ON public.operacoes_ocorrencias_decisoes(operacao_id, collaborator_id) 
  WHERE status IN ('PENDENTE', 'AUTORIZADO');

CREATE INDEX IF NOT EXISTS idx_ocorrencias_decisoes_op 
  ON public.operacoes_ocorrencias_decisoes(operacao_id);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_decisoes_colab 
  ON public.operacoes_ocorrencias_decisoes(collaborator_id);

-- ------------------------------------------------------------------------------
-- 3. TABELA: EVENTOS FINANCEIROS DE RESSARCIMENTO (Integração com Motores de Pagamento)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operacoes_ocorrencias_eventos_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  decisao_id UUID NOT NULL REFERENCES public.operacoes_ocorrencias_decisoes(id) ON DELETE RESTRICT,
  collaborator_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
  
  tipo_vinculo TEXT NOT NULL CHECK (tipo_vinculo IN ('CLT', 'INTERMITENTE', 'DIARISTA')),
  competencia VARCHAR(7) NOT NULL, -- YYYY-MM
  valor_desconto NUMERIC(15,2) NOT NULL CHECK (valor_desconto > 0),
  
  status TEXT NOT NULL DEFAULT 'PENDENTE_APLICACAO' CHECK (
    status IN ('PENDENTE_APLICACAO', 'APLICADO', 'CANCELADO', 'ESTORNADO')
  ),
  
  lote_pagamento_id UUID,
  aplicado_em TIMESTAMPTZ,
  aplicado_por UUID REFERENCES auth.users(id),
  detalhes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.operacoes_ocorrencias_eventos_financeiros IS 
  'Eventos financeiros gerados exclusivamente por deliberações autorizadas para dedução em folha ou diárias.';

-- Impede múltiplos eventos financeiros ativos para a mesma deliberação
CREATE UNIQUE INDEX IF NOT EXISTS unq_evento_decisao_ativa 
  ON public.operacoes_ocorrencias_eventos_financeiros(decisao_id) 
  WHERE status IN ('PENDENTE_APLICACAO', 'APLICADO');

CREATE INDEX IF NOT EXISTS idx_eventos_fin_colab_comp 
  ON public.operacoes_ocorrencias_eventos_financeiros(collaborator_id, competencia);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) E POLÍTICAS DE ACESSO
-- ------------------------------------------------------------------------------
ALTER TABLE public.infracoes_operacionais_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_ocorrencias_decisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_ocorrencias_eventos_financeiros ENABLE ROW LEVEL SECURITY;

-- Catálogo: Remoção preventiva de políticas existentes com o mesmo nome
DROP POLICY IF EXISTS "Leitura autenticada do catalogo de infracoes" ON public.infracoes_operacionais_catalogo;
DROP POLICY IF EXISTS "Gestao do catalogo restrita a Admin e RH" ON public.infracoes_operacionais_catalogo;
DROP POLICY IF EXISTS "Impedir delecao fisica do catalogo" ON public.infracoes_operacionais_catalogo;

-- Catálogo: Leitura aberta aos autenticados do mesmo tenant (permite Encarregado carregar a lista de tipos)
CREATE POLICY "Leitura autenticada do catalogo de infracoes"
  ON public.infracoes_operacionais_catalogo
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id() 
    OR tenant_id = NULLIF((auth.jwt() ->> 'tenant_id'), '')::uuid
  );

-- Catálogo: Criação e Atualização restrita a Admin, Super Admin, Gestor e RH
CREATE POLICY "Gestao do catalogo restrita a Admin e RH"
  ON public.infracoes_operacionais_catalogo
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR tenant_id = NULLIF((auth.jwt() ->> 'tenant_id'), '')::uuid)
    AND (
      EXISTS (
        SELECT 1 FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.status = 'ativo'
          AND up.role IN ('admin', 'super_admin', 'gestor', 'rh')
      )
      OR public.get_user_role() IN ('admin', 'super_admin', 'gestor', 'rh')
    )
  )
  WITH CHECK (
    (tenant_id = public.current_tenant_id() OR tenant_id = NULLIF((auth.jwt() ->> 'tenant_id'), '')::uuid)
    AND (
      EXISTS (
        SELECT 1 FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.status = 'ativo'
          AND up.role IN ('admin', 'super_admin', 'gestor', 'rh')
      )
      OR public.get_user_role() IN ('admin', 'super_admin', 'gestor', 'rh')
    )
  );

-- Catálogo: Proibir exclusão física direta para preservar histórico de apontamentos
CREATE POLICY "Impedir delecao fisica do catalogo"
  ON public.infracoes_operacionais_catalogo
  FOR DELETE TO authenticated
  USING (false);

-- Deliberações: Remoção preventiva de políticas
DROP POLICY IF EXISTS "Decisoes administrativas acessiveis apenas a Admin e RH" ON public.operacoes_ocorrencias_decisoes;
DROP POLICY IF EXISTS "Impedir delecao fisica em decisoes administrativas" ON public.operacoes_ocorrencias_decisoes;

-- Deliberações: Consulta e alteração restrita a Admin, Gestor, RH e Financeiro (Encarregado BLOQUEADO)
CREATE POLICY "Decisoes administrativas acessiveis apenas a Admin e RH"
  ON public.operacoes_ocorrencias_decisoes
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR tenant_id = NULLIF((auth.jwt() ->> 'tenant_id'), '')::uuid)
    AND (
      EXISTS (
        SELECT 1 FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.status = 'ativo'
          AND up.role IN ('admin', 'super_admin', 'gestor', 'rh', 'financeiro')
      )
      OR public.get_user_role() IN ('admin', 'super_admin', 'gestor', 'rh', 'financeiro')
    )
  )
  WITH CHECK (
    (tenant_id = public.current_tenant_id() OR tenant_id = NULLIF((auth.jwt() ->> 'tenant_id'), '')::uuid)
    AND (
      EXISTS (
        SELECT 1 FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.status = 'ativo'
          AND up.role IN ('admin', 'super_admin', 'gestor', 'rh')
      )
      OR public.get_user_role() IN ('admin', 'super_admin', 'gestor', 'rh')
    )
  );

CREATE POLICY "Impedir delecao fisica em decisoes administrativas"
  ON public.operacoes_ocorrencias_decisoes
  FOR DELETE TO authenticated
  USING (false);

-- Eventos Financeiros: Remoção preventiva de políticas
DROP POLICY IF EXISTS "Eventos financeiros acessiveis apenas a Admin, RH e Financeiro" ON public.operacoes_ocorrencias_eventos_financeiros;
DROP POLICY IF EXISTS "Impedir delecao fisica em eventos financeiros" ON public.operacoes_ocorrencias_eventos_financeiros;

-- Eventos Financeiros: Consulta e escrita restrita a Admin, RH e Financeiro (Encarregado BLOQUEADO)
CREATE POLICY "Eventos financeiros acessiveis apenas a Admin, RH e Financeiro"
  ON public.operacoes_ocorrencias_eventos_financeiros
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR tenant_id = NULLIF((auth.jwt() ->> 'tenant_id'), '')::uuid)
    AND (
      EXISTS (
        SELECT 1 FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.status = 'ativo'
          AND up.role IN ('admin', 'super_admin', 'gestor', 'rh', 'financeiro')
      )
      OR public.get_user_role() IN ('admin', 'super_admin', 'gestor', 'rh', 'financeiro')
    )
  )
  WITH CHECK (
    (tenant_id = public.current_tenant_id() OR tenant_id = NULLIF((auth.jwt() ->> 'tenant_id'), '')::uuid)
    AND (
      EXISTS (
        SELECT 1 FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.status = 'ativo'
          AND up.role IN ('admin', 'super_admin', 'gestor', 'rh', 'financeiro')
      )
      OR public.get_user_role() IN ('admin', 'super_admin', 'gestor', 'rh', 'financeiro')
    )
  );

CREATE POLICY "Impedir delecao fisica em eventos financeiros"
  ON public.operacoes_ocorrencias_eventos_financeiros
  FOR DELETE TO authenticated
  USING (false);

-- ------------------------------------------------------------------------------
-- 5. GRANTS DE ACESSO
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.infracoes_operacionais_catalogo TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.operacoes_ocorrencias_decisoes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.operacoes_ocorrencias_eventos_financeiros TO authenticated;

GRANT ALL ON public.infracoes_operacionais_catalogo TO service_role;
GRANT ALL ON public.operacoes_ocorrencias_decisoes TO service_role;
GRANT ALL ON public.operacoes_ocorrencias_eventos_financeiros TO service_role;

COMMIT;
