-- Tabela de regras de fechamento
CREATE TABLE IF NOT EXISTS regras_fechamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_ciclo TEXT NOT NULL DEFAULT 'semanal',
    dia_fechamento INTEGER NOT NULL DEFAULT 5,
    ativo BOOLEAN NOT NULL DEFAULT true,
    auto_fechar BOOLEAN NOT NULL DEFAULT false,
    enviar_financeiro BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de ciclos de diaristas
CREATE TABLE IF NOT EXISTS ciclos_diaristas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto',
    valor_total DECIMAL(12,2) DEFAULT 0,
    diaristas_count INTEGER DEFAULT 0,
    regra_fechamento_id UUID REFERENCES regras_fechamento(id),
    fechado_por UUID REFERENCES auth.users(id),
    fechado_em TIMESTAMPTZ,
    enviado_por UUID REFERENCES auth.users(id),
    enviado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de lote de pagamento
CREATE TABLE IF NOT EXISTS lote_pagamento_diaristas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ciclo_id UUID NOT NULL REFERENCES ciclos_diaristas(id),
    quantidade_diaristas INTEGER NOT NULL DEFAULT 0,
    valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendente',
    gerado_por UUID REFERENCES auth.users(id),
    gerado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enviado_financeiro BOOLEAN NOT NULL DEFAULT false,
    enviado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de itens do lote
CREATE TABLE IF NOT EXISTS lote_pagamento_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lote_id UUID NOT NULL REFERENCES lote_pagamento_diaristas(id),
    colaborador_id UUID NOT NULL,
    nome_colaborador TEXT NOT NULL,
    cpf TEXT,
    banco TEXT,
    agencia TEXT,
    conta TEXT,
    quantidade_dias INTEGER NOT NULL DEFAULT 0,
    valor_dia DECIMAL(10,2) NOT NULL DEFAULT 0,
    multiplicador TEXT DEFAULT 'P',
    valor_final DECIMAL(10,2) NOT NULL DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de lançamentos adicionais (ajustes pós-fechamento)
CREATE TABLE IF NOT EXISTS lancamentos_adicionais_diaristas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ciclo_id UUID NOT NULL REFERENCES ciclos_diaristas(id),
    colaborador_id UUID NOT NULL,
    tipo TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    motivo TEXT,
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir regra padrão
INSERT INTO regras_fechamento (tipo_ciclo, dia_fechamento, ativo, auto_fechar, enviar_financeiro)
VALUES ('semanal', 5, true, false, true);

-- RLS
ALTER TABLE regras_fechamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE ciclos_diaristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lote_pagamento_diaristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lote_pagamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_adicionais_diaristas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Full access regras_fechamento" ON regras_fechamento FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access ciclos_diaristas" ON ciclos_diaristas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access lote_pagamento_diaristas" ON lote_pagamento_diaristas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access lote_pagamento_itens" ON lote_pagamento_itens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access lancamentos_adicionais_diaristas" ON lancamentos_adicionais_diaristas FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX idx_ciclos_diaristas_status ON ciclos_diaristas(status);
CREATE INDEX idx_ciclos_diaristas_datas ON ciclos_diaristas(data_inicio, data_fim);
CREATE INDEX idx_lote_pagamento_ciclo ON lote_pagamento_diaristas(ciclo_id);
CREATE INDEX idx_lote_itens_lote ON lote_pagamento_itens(lote_id);
CREATE INDEX idx_lancamentos_ciclo ON lancamentos_adicionais_diaristas(ciclo_id);