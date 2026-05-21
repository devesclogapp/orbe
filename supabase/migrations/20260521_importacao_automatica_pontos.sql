-- y:\2026\ERP ESC LOG\Orbe\supabase\migrations\20260521_importacao_automatica_pontos.sql

-- 1. Create historico_importacoes table
CREATE TABLE IF NOT EXISTS public.historico_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  unidade_id UUID REFERENCES public.unidades_operacionais(id) ON DELETE SET NULL,
  coletor_id UUID REFERENCES public.coletores(id) ON DELETE SET NULL,
  
  origem TEXT NOT NULL CHECK (origem IN ('manual', 'google_drive', 'api')),
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT,
  
  drive_file_id TEXT,
  drive_folder_id TEXT,
  
  status TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'processando', 'sucesso', 'erro')),
  quantidade_registros INTEGER DEFAULT 0,
  quantidade_inconsistencias INTEGER DEFAULT 0,
  erro_processamento TEXT,
  
  importado_em TIMESTAMPTZ DEFAULT now(),
  processado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Add fields to registros_ponto
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS importacao_id UUID REFERENCES public.historico_importacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coletor_id UUID REFERENCES public.coletores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades_operacionais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reg_ponto_importacao ON public.registros_ponto(importacao_id);
CREATE INDEX IF NOT EXISTS idx_reg_ponto_coletor ON public.registros_ponto(coletor_id);
CREATE INDEX IF NOT EXISTS idx_hist_import_tenant ON public.historico_importacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hist_import_status ON public.historico_importacoes(status);

-- 4. RLS Policies
ALTER TABLE public.historico_importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users with same tenant"
  ON public.historico_importacoes FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Enable insert for authenticated users"
  ON public.historico_importacoes FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 5. Audit Comments
COMMENT ON TABLE public.historico_importacoes IS 'Histórico de importações de pontos (manual e automático)';
COMMENT ON COLUMN public.registros_ponto.importacao_id IS 'Vínculo com o lote de importação original';
COMMENT ON COLUMN public.registros_ponto.drive_file_id IS 'ID do arquivo no Google Drive (se automático)';
