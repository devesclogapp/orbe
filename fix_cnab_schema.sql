-- Correções Estruturais do Banco de Dados 
-- Detectadas durante E2E Pipeline Diaristas (Geração Remessa / Conciliação CNAB)

DO $$
BEGIN
    ---------------------------------------------------------------------------
    -- 1. Tabela: cnab_remessas_arquivos
    -- Adicionar suporte ao rastreamento nativo dos lotes da vertical Operacional
    ---------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'cnab_remessas_arquivos' 
          AND column_name = 'diaristas_lote_id'
    ) THEN
        ALTER TABLE public.cnab_remessas_arquivos 
        ADD COLUMN diaristas_lote_id UUID REFERENCES public.diaristas_lotes_fechamento(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'cnab_remessas_arquivos' 
          AND column_name = 'intermitentes_lote_id'
    ) THEN
        ALTER TABLE public.cnab_remessas_arquivos 
        ADD COLUMN intermitentes_lote_id UUID REFERENCES public.intermitentes_lotes_fechamento(id) ON DELETE SET NULL;
    END IF;

    ---------------------------------------------------------------------------
    -- 2. Tabela: diaristas_lotes_fechamento
    -- Acompanhamento financeiro da jornada do arquivo CNAB (aguardando_conciliacao, etc)
    ---------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'diaristas_lotes_fechamento' 
          AND column_name = 'status_conciliacao'
    ) THEN
        ALTER TABLE public.diaristas_lotes_fechamento 
        ADD COLUMN status_conciliacao VARCHAR(50);
    END IF;

END $$;
