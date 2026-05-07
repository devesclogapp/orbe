-- FASE 10.1 - MOTOR DE AUTOMAÇÃO OPERACIONAL

CREATE TABLE IF NOT EXISTS public.automacao_execucoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo VARCHAR(100) NOT NULL, -- e.g., 'PROCESSAMENTO_RH', 'SUGESTAO_FECHAMENTO'
    status VARCHAR(50) NOT NULL DEFAULT 'pendente', -- pendente, executando, concluido, falhou, cancelado
    prioridade INTEGER DEFAULT 0,
    contexto_json JSONB,
    resultado_json JSONB,
    erro TEXT,
    iniciado_em TIMESTAMP WITH TIME ZONE,
    finalizado_em TIMESTAMP WITH TIME ZONE,
    executado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.automacao_alertas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo VARCHAR(100) NOT NULL, -- colaborador_sem_regra, excesso_horas, etc.
    severidade VARCHAR(50) NOT NULL DEFAULT 'warning', -- info, warning, error, critical
    mensagem TEXT NOT NULL,
    contexto_json JSONB,
    resolvido BOOLEAN DEFAULT false,
    resolvido_em TIMESTAMP WITH TIME ZONE,
    resolvido_por UUID REFERENCES auth.users(id),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.automacao_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automacao_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso Tenant Isolado Automacao Execucoes OAI" ON public.automacao_execucoes
    FOR ALL
    USING (empresa_id = public.current_tenant_id());

CREATE POLICY "Acesso Tenant Isolado Automacao Alertas OAI" ON public.automacao_alertas
    FOR ALL
    USING (empresa_id = public.current_tenant_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automacao_execucoes_empresa_id ON public.automacao_execucoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_automacao_execucoes_status ON public.automacao_execucoes(status);
CREATE INDEX IF NOT EXISTS idx_automacao_alertas_empresa_id ON public.automacao_alertas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_automacao_alertas_resolvido ON public.automacao_alertas(resolvido);

-- Add 'pronto_para_fechamento' status if not exists to ciclo_operacional (We should alter enum / constrain if needed, but since it's probably varchar, we just use it)
