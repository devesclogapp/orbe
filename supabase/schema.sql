
-- Tabela de Empresas
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  unidade TEXT,
  cidade TEXT,
  estado TEXT,
  status TEXT DEFAULT 'ativa',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Coletores (REP)
CREATE TABLE coletores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo TEXT NOT NULL,
  serie TEXT UNIQUE NOT NULL,
  empresa_id UUID REFERENCES empresas(id),
  status TEXT DEFAULT 'online',
  ultima_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabelas de Contratos operacionais
CREATE TABLE contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- 'hora', 'diaria', 'operacao'
  valor_base NUMERIC(10, 2) NOT NULL,
  regras JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Colaboradores
CREATE TABLE colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cargo TEXT,
  empresa_id UUID REFERENCES empresas(id),
  tipo_contrato TEXT NOT NULL, -- 'Hora' ou 'Operação'
  valor_base NUMERIC(10, 2),
  flag_faturamento BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'ok',
  data_admissao DATE,
  matricula TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Operações Logísticas
CREATE TABLE operacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE DEFAULT current_date,
  transportadora TEXT NOT NULL,
  tipo_servico TEXT NOT NULL, -- 'Volume' ou 'Carro'
  quantidade NUMERIC(10, 2) NOT NULL,
  horario_inicio TIME,
  horario_fim TIME,
  produto TEXT,
  valor_unitario NUMERIC(10, 2),
  status TEXT DEFAULT 'pendente',
  responsavel_id UUID REFERENCES colaboradores(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Registros de Ponto (RH)
CREATE TABLE registros_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES colaboradores(id),
  data DATE NOT NULL,
  entrada TIME,
  saida_almoco TIME,
  retorno_almoco TIME,
  saida TIME,
  periodo TEXT, -- 'Diurno', 'Noturno'
  tipo_dia TEXT, -- 'Normal', 'Domingo', 'Feriado'
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Logs de Sincronização
CREATE TABLE logs_sincronizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data TIMESTAMPTZ DEFAULT now(),
  origem TEXT NOT NULL,
  empresa_id UUID REFERENCES empresas(id),
  contagem_registros INTEGER DEFAULT 0,
  status TEXT, -- 'sucesso', 'erro', 'parcial'
  duracao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Resultados de Processamento Operacional
CREATE TABLE resultados_processamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  empresa_id UUID REFERENCES empresas(id),
  valor_total_calculado NUMERIC(15, 2),
  total_operacoes INTEGER,
  contagem_inconsistencias INTEGER,
  status TEXT, -- 'processado', 'pendente', 'fechado'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Configurações de RLS (Row Level Security) - Inicialmente permitindo leitura para simplificar o MVP
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura simplificada para usuários autenticados" ON empresas;
CREATE POLICY "Leitura aberta para empresas" ON empresas FOR SELECT USING (true);

-- Repetir para outras tabelas conforme necessário...
