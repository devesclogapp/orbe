-- Migration: Evolução do Processamento RH para Motor Operacional Completo

-- 1. Criar tabela de inconsistências
CREATE TABLE IF NOT EXISTS public.processamento_rh_inconsistencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  registro_ponto_id UUID REFERENCES registros_ponto(id),
  colaborador_id UUID REFERENCES colaboradores(id),
  empresa_id UUID REFERENCES empresas(id),
  tipo TEXT NOT NULL,
  descricao TEXT,
  gravidade TEXT DEFAULT 'media', -- baixa, media, alta, critica
  status TEXT DEFAULT 'aberta', -- aberta, resolvida, ignorada
  resolvida_por UUID,
  resolvida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Verificar e adicionar colunas em banco_horas_eventos se necessário
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banco_horas_eventos' AND column_name = 'id') THEN
    -- Verificar e adicionar colunas que podem não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banco_horas_eventos' AND column_name = 'registro_ponto_id') THEN
      ALTER TABLE public.banco_horas_eventos ADD COLUMN registro_ponto_id UUID REFERENCES registros_ponto(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banco_horas_eventos' AND column_name = 'saldo_anterior') THEN
      ALTER TABLE public.banco_horas_eventos ADD COLUMN saldo_anterior INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banco_horas_eventos' AND column_name = 'saldo_atual') THEN
      ALTER TABLE public.banco_horas_eventos ADD COLUMN saldo_atual INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banco_horas_eventos' AND column_name = 'origem') THEN
      ALTER TABLE public.banco_horas_eventos ADD COLUMN origem TEXT DEFAULT 'processamento_rh';
    END IF;
  END IF;
END $$;

-- 3. Adicionar colunas de valor em registros_ponto se não existirem
ALTER TABLE public.registros_ponto 
  ADD COLUMN IF NOT EXISTS valor_hora NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS valor_dia NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS valor_extras NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS jornada_calculada NUMERIC(5,2);

-- 4. Criar índices para otimização
CREATE INDEX IF NOT EXISTS idx_processamento_rh_inconsistencias_tenant ON public.processamento_rh_inconsistencias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_processamento_rh_inconsistencias_ponto ON public.processamento_rh_inconsistencias(registro_ponto_id);
CREATE INDEX IF NOT EXISTS idx_processamento_rh_inconsistencias_tipo ON public.processamento_rh_inconsistencias(tipo);
CREATE INDEX IF NOT EXISTS idx_banco_horas_eventos_colaborador ON public.banco_horas_eventos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_banco_horas_eventos_data ON public.banco_horas_eventos(data);

-- 5. comentario para as tabelas
COMMENT ON TABLE public.processamento_rh_inconsistencias IS 'Inconsistências detectadas durante o processamento RH';
COMMENT ON COLUMN public.processamento_rh_inconsistencias.tipo IS 'Tipo de inconsitência: colaborador_nao_cadastrado, empresa_nao_cadastrada, regra_inexistente, entrada_ausente, saida_ausente, intervalo_invalido, jornada_negativa, divergencia_horas, atraso, falta, excesso_horas, extras_limite';
COMMENT ON COLUMN public.processamento_rh_inconsistencias.gravidade IS 'Gravidade: baixa, media, alta, critica';