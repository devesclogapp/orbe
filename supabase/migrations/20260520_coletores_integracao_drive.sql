ALTER TABLE public.coletores
  ADD COLUMN IF NOT EXISTS unidade_id          UUID REFERENCES public.unidades_operacionais(id),
  ADD COLUMN IF NOT EXISTS unidade_local       TEXT,
  ADD COLUMN IF NOT EXISTS fabricante          TEXT,
  ADD COLUMN IF NOT EXISTS tipo_integracao     TEXT
    CHECK (tipo_integracao IN ('google_drive', 'api_direta', 'upload_manual', 'rede_local')),
  ADD COLUMN IF NOT EXISTS formato_arquivo     TEXT
    CHECK (formato_arquivo IN ('AFD', 'CSV', 'TXT', 'XLSX')),
  
  -- Google Drive (IDs e URLs)
  ADD COLUMN IF NOT EXISTS folder_entrada_url     TEXT,
  ADD COLUMN IF NOT EXISTS folder_entrada_id      TEXT,
  ADD COLUMN IF NOT EXISTS folder_processados_url TEXT,
  ADD COLUMN IF NOT EXISTS folder_processados_id  TEXT,
  ADD COLUMN IF NOT EXISTS folder_erros_url       TEXT,
  ADD COLUMN IF NOT EXISTS folder_erros_id        TEXT,
  
  ADD COLUMN IF NOT EXISTS integracao_ativa       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS intervalo_sincronizacao_minutos INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ultima_importacao_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_erro            TEXT;

-- Índice para filtrar coletores ativos por empresa (consulta frequente)
CREATE INDEX IF NOT EXISTS idx_coletores_empresa_ativa
  ON public.coletores (empresa_id, integracao_ativa);

COMMENT ON COLUMN public.coletores.unidade_id IS 'ID da unidade operacional vinculada à empresa';
COMMENT ON COLUMN public.coletores.unidade_local IS 'Local/unidade de operação do coletor (texto livre legado)';
COMMENT ON COLUMN public.coletores.fabricante IS 'Fabricante do hardware REP (Henry, Dimep, Control, etc.)';
COMMENT ON COLUMN public.coletores.tipo_integracao IS 'Modo de integração: google_drive | api_direta | upload_manual | rede_local';
COMMENT ON COLUMN public.coletores.formato_arquivo IS 'Formato do arquivo de ponto esperado';
COMMENT ON COLUMN public.coletores.folder_entrada_id IS 'Google Drive Folder ID — extraído da URL';
COMMENT ON COLUMN public.coletores.folder_entrada_url IS 'Google Drive URL — pasta de entrada';
COMMENT ON COLUMN public.coletores.integracao_ativa IS 'Se false o coletor é ignorado pelo pipeline de importação';
COMMENT ON COLUMN public.coletores.intervalo_sincronizacao_minutos IS 'Intervalo entre execuções automáticas (n8n/pipeline)';
