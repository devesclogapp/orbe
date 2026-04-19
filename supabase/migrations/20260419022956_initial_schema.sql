
-- Extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELAS BASE

-- Empresas
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  unidade TEXT,
  cidade TEXT,
  estado TEXT,
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contratos
CREATE TABLE contratos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT NOT NULL CHECK (tipo IN ('hora', 'diaria', 'operacao')),
  valor_base NUMERIC(15, 2) NOT NULL DEFAULT 0,
  regras JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Coletores
CREATE TABLE coletores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  modelo TEXT NOT NULL,
  serie TEXT UNIQUE NOT NULL,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline', 'erro')),
  ultima_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Colaboradores
CREATE TABLE colaboradores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  cargo TEXT,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  tipo_contrato TEXT NOT NULL CHECK (tipo_contrato IN ('Hora', 'Operação')),
  valor_base NUMERIC(15, 2) DEFAULT 0,
  flag_faturamento BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'inconsistente', 'ajustado', 'pendente', 'incompleto')),
  data_admissao DATE,
  matricula TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Operações Logísticas
CREATE TABLE operacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data DATE DEFAULT current_date,
  transportadora TEXT NOT NULL,
  tipo_servico TEXT NOT NULL CHECK (tipo_servico IN ('Volume', 'Carro')),
  quantidade NUMERIC(15, 2) NOT NULL DEFAULT 0,
  horario_inicio TIME,
  horario_fim TIME,
  produto TEXT,
  valor_unitario NUMERIC(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('ok', 'inconsistente', 'pendente', 'ajustado')),
  responsavel_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ponto (RH)
CREATE TABLE registros_ponto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  colaborador_id UUID REFERENCES colaboradores(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT current_date,
  entrada TIME,
  saida_almoco TIME,
  retorno_almoco TIME,
  saida TIME,
  periodo TEXT CHECK (periodo IN ('Diurno', 'Noturno')),
  tipo_dia TEXT CHECK (tipo_dia IN ('Normal', 'Domingo', 'Feriado')),
  status TEXT DEFAULT 'pendente' CHECK (status IN ('ok', 'inconsistente', 'pendente', 'ajustado', 'incompleto')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Logs de Sincronização
CREATE TABLE logs_sincronizacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data TIMESTAMPTZ DEFAULT now(),
  origem TEXT NOT NULL,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  contagem_registros INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('sucesso', 'erro', 'parcial')),
  duracao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Resultados de Processamento
CREATE TABLE resultados_processamento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data DATE NOT NULL,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  valor_total_calculado NUMERIC(15, 2) DEFAULT 0,
  total_operacoes INTEGER DEFAULT 0,
  contagem_inconsistencias INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('processado', 'pendente', 'fechado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SEGURANÇA (RLS & POLICIES)

-- Habilitar RLS em todas as tabelas
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE coletores ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_sincronizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_processamento ENABLE ROW LEVEL SECURITY;

-- Políticas Simples para MVP (Acesso total para usuários autenticados)
-- Nota: Em produção, isso deve ser refinado por empresa_id ou roles.

CREATE POLICY "Acesso total autenticado para empresas" ON empresas FOR ALL TO authenticated USING (true);
CREATE POLICY "Acesso total autenticado para contratos" ON contratos FOR ALL TO authenticated USING (true);
CREATE POLICY "Acesso total autenticado para coletores" ON coletores FOR ALL TO authenticated USING (true);
CREATE POLICY "Acesso total autenticado para colaboradores" ON colaboradores FOR ALL TO authenticated USING (true);
CREATE POLICY "Acesso total autenticado para operacoes" ON operacoes FOR ALL TO authenticated USING (true);
CREATE POLICY "Acesso total autenticado para registros_ponto" ON registros_ponto FOR ALL TO authenticated USING (true);
CREATE POLICY "Acesso total autenticado para logs_sincronizacao" ON logs_sincronizacao FOR ALL TO authenticated USING (true);
CREATE POLICY "Acesso total autenticado para resultados_processamento" ON resultados_processamento FOR ALL TO authenticated USING (true);

-- 3. STORAGE

-- Inserir bucket se não existir (via função do Supabase)
-- Nota: Geralmente feito via dashboard, mas podemos preparar SQL.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', false) ON CONFLICT (id) DO NOTHING;

-- 4. FUNÇÕES DE TRIGGER PARA UPDATED_AT

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_colaboradores_updated_at BEFORE UPDATE ON colaboradores FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_operacoes_updated_at BEFORE UPDATE ON operacoes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_registros_ponto_updated_at BEFORE UPDATE ON registros_ponto FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
