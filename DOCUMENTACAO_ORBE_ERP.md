# Documentação Completa do ERP Orbe

## 1. Visão Geral do Sistema

O **Orbe** é um ERP completo para gestão de operações logísticas, recursos humanos e financeiro, desenvolvido com tecnologia moderna (React + Supabase). O sistema foi concebido para atender empresas de logística que trabalham com diaristas, colaboradores horistas e operações de carga/descarga.

### Objetivos Principais

- **Gestão de Ponto**: Registro e controle de frequência de colaboradores
- **Operações Logísticas**: Lançamento e cálculo de operações de carga/descarga
- **Financeiro**: Faturamento, pagamentos e conciliação bancária
- **RH**: Gestão de diaristas e colaboradores com regras personalizadas
- **Portal do Cliente**: Dashboard externo para acompanhamento de resultados
- **Governança**: Controle de acessos, permissões e auditoria

---

## 2. Arquitetura Técnica

### Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI Components | Radix UI + Tailwind CSS + Shadcn UI |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Estado | React Query + Context API |
| Gráficos | Recharts |
| Icons | Lucide React |
| Validação | Zod + React Hook Form |
| Importação | XLSX + PapaParse |
| Relatórios | jsPDF + jsPDF-AutoTable |

### Estrutura de Pastas

```
src/
├── components/     # Componentes React reutilizáveis
├── contexts/      # Contextos React (Auth, Client, Selection, Preferences)
├── hooks/         # Hooks customizados
├── lib/           # Configurações e utilities
├── pages/         # Páginas do sistema organizadas por módulo
├── services/      # Serviços de comunicação com API
├── types/         # Definições de tipos TypeScript
└── utils/         # Funções utilitárias
```

### Banco de Dados (Supabase/PostgreSQL)

Principais tabelas:

- `empresas` - Cadastro de empresas/clientes
- `colaboradores` - Funcionários CLT e diaristas
- `coletores` - Equipamentos REP de ponto eletrônico
- `operacoes` - Registro de operações logísticas
- `registros_ponto` - Batidas de ponto
- `diaristas` - Cadastro específico de diaristas
- `regras_operacionais` - Regras de cálculo por tipo de operação
- `faturas` - Faturamento por cliente
- `remessas` - Envio de arquivos CNAB
- `retornos` - Processamento de retornos bancários
- `bancario_lancamentos` - Lançamentos financeiros
- `bancario_conciliacao` - Conciliação bancária

---

## 3. Módulos e Funcionalidades

### 3.1 Dashboard Central

**Rota**: `/`

**Funcionalidades**:
- KPIs operacionais em tempo real
- Gráficos de receita, custos e lucro
- Indicadores de inadimplência
- Métricas por empresa e período
- Filtros por mês/ano e empresa

**Inputs**:
- Seleção de empresa
- Seleção de período (mês/ano)

**Outputs**:
- Cards de métricas com indicadores visuais
- Gráficos de linha e pizza
- Tendências e variações percentuais

---

### 3.2 Módulo Operacional

**Rotas**:
- `/operacional/dashboard` - Dashboard operacional
- `/operacional/operacoes` - Lista de operações
- `/operacional/pontos` - Registro de ponto

**Funcionalidades**:

#### Operações (`/operacional/operacoes`)
- Lançamento manual de operações
- Importação de planilhas (Excel/CSV)
- Cálculo automático de valores por tipo de serviço
- Categorização por transportadora e tipo de serviço (Volume/Carro)
- Vinculação de colaboradores responsáveis
- Custos extras operacionais
- Processamento diário de operações

**Inputs**:
- Data da operação
- Empresa
- Transportadora/Fornecedor
- Tipo de serviço
- Quantidade
- Valor unitário
- Horário de início/fim
- Placa do veículo
- Colaboradores vinculados

**Outputs**:
- Lista de operações com detalhamento
- Totalizadores por período
- Exportação para Excel
- Relatórios de produtividade

#### Pontos (`/operacional/pontos`)
- Visualização de registros de ponto
- Importação de dados de REP (Registro Eletrônico de Ponto)
- Batidas manuais
- Histórico por colaborador

**Inputs**:
- Colaborador
- Data
- Entrada/Saída/Almoço

**Outputs**:
- Folha de ponto
- Espelho de ponto
- Relatório de horas trabalhadas

---

### 3.3 Módulo de Produção

**Rotas**:
- `/producao` - Lançamento geral de produção
- `/producao/diaristas` - Lançamento específico para diaristas

**Funcionalidades**:
- Lançamento de produção por diarista
- Registro de presença diária
- Cálculo de valor por diária
- Vinculação a empresas específicas

**Inputs**:
- Data
- Diarista
- Empresa
- Quantidade de colaborador
- Tipo de cálculo (volume/diária)
- Valor unitário

**Outputs**:
- Registro de produção diário
- Totais por período

---

### 3.4 Módulo RH - Diaristas

**Rotas**:
- `/rh/diaristas` - Painel de diaristas
- `/rh/diaristas/cadastros` - Gestão de cadastros

**Funcionalidades**:

#### Painel de Diaristas (`/rh/diaristas`)
- Dashboard específico para gestão de diaristas
- Métricas de presença e produtividade
- Lista de diaristas por empresa

#### Gestão de Diaristas (`/rh/diaristas/cadastros`)
- Cadastro completo de diaristas
- Dados pessoais (nome, CPF, telefone)
- Função (Diarista, Auxiliar de carga, Ajudante, Conferente, etc.)
- Valor da diária
- Dados bancários para pagamento
- Status (ativo/inativo)
- Observações

**Inputs**:
- Nome completo
- CPF
- Telefone
- Função
- Valor diária
- Dados bancários (banco, agência, conta, tipo)
- Empresa vinculada
- Status

**Outputs**:
- Lista de diaristas cadastrados
- Relatório de diaristas por empresa

---

### 3.5 Central de Cadastros

**Rota**: `/cadastros`

**Funcionalidades**:
- Gestão integrada de todos os cadastros
- Empresas
- Colaboradores
- Coletores (REP)
- Regras Operacionais
- Configurações de importação

#### Aba Empresas
- Cadastro de empresas/unidades
- CNPJ, nome, cidade, estado
- Status (ativa/inativa)
- Contagem de colaboradores e coletores

#### Aba Colaboradores
- Lista completa de colaboradores
- Dados pessoais e contratuais
- Tipo de contrato (Hora/Operação)
- Valor base
- Status de faturamento
- Vinculação a empresa

#### Aba Coletores
- Equipamentos REP cadastrados
- Modelo, série
- Status (online/offline/erro)
- Última sincronização
- Visualização em tabela ou grid

#### Aba Configurações
- Tipos de operação
- Produtos de carga
- Tipos de dia (Normal, Domingo, Feriado)
- Parâmetros operacionais

---

### 3.6 Central Financeira

**Rota**: `/financeiro`

**Funcionalidades**:

#### Competências
- Gestão de meses/anos competência
- Processamento de fechamentos
- Status por empresa (pendente/processado/fechado)
- Consolidação de resultados

#### Faturamento
- Geração de faturas por cliente
- Cálculo automático baseado em operações
- Status de aprovação
- Detalhamento por período

**Fluxo**:
1. Processar competência
2. Consolidar operações
3. Gerar fatura
4. Enviar para aprovação (portal cliente)
5. Aprovar/Rejeitar
6. Fechar período

**Inputs**:
- Mês/Ano competência
- Empresa
- Operações do período
- Regras de cálculo

**Outputs**:
- Faturas detalhadas
- Valores consolidados
- Status de aprovação
- Histórico de fechamentos

---

### 3.7 Central Bancária

**Rota**: `/bancario`

**Funcionalidades**:
- Geração de remessas CNAB
- Processamento de retornos
- Conciliação bancária
- Histórico de remessas
- Configuração de contas bancárias

#### Remessa CNAB (`/financeiro/remessa`)
- Geração de arquivo de pagamento
- Seleção de colaboradores/diaristas
- Configuração de lote
- Visualização de valores

#### Retorno Bancário (`/financeiro/retorno`)
- Upload de arquivos de retorno
- Processamento automático
- Identificação de pagamentos
- Atualização de status

#### Histórico de Remessas (`/financeiro/remessa/historico`)
- Lista de remessas geradas
- Status de processamento
- Valores totais

---

### 3.8 Portal do Cliente

**Rotas**:
- `/cliente/dashboard` - Dashboard do cliente
- `/cliente/relatorios` - Relatórios
- `/cliente/aprovacoes` - Aprovações

**Funcionalidades**:

#### Dashboard (`/cliente/dashboard`)
- Visão geral para clientes externos
- Faturado no mês
- Consolidado
- Pendências para aprovação

#### Relatórios (`/cliente/relatorios`)
- Relatórios específicos do cliente
- Filtros por período
- Exportação

#### Aprovações (`/cliente/aprovacoes`)
- Lista de itens aguardando aprovação
- Aprovar/Rejeitar com justificativa
- Histórico de aprovações

**Acesso**: Restrito a usuários com perfil de cliente (via PortalGuard)

---

### 3.9 Central de Relatórios e Integrações

**Rota**: `/relatorios`

**Funcionalidades**:

#### Catálogo de Relatórios
- Relatórios operacionais
- Relatórios financeiros
- Relatórios de faturamento
- Relatórios de banco de horas
- Relatórios de auditoria
- Relatórios contábeis/fiscais

#### Agendamentos (`/relatorios/agendamentos`)
- Agendamento de relatórios automáticos
- Frequência (diário, semanal, mensal)
- Destinatários

#### Layouts de Exportação (`/relatorios/layouts`)
- Definição de layouts customizados
- Mapeamento de campos
- Exportação em diferentes formatos

#### Integração Contábil (`/relatorios/integracao`)
- Configuração de integração
- Mapeamento contábil
- Logs de processamento

#### Mapeamento Contábil (`/relatorios/mapeamento`)
- Mapeamento de contas
- Regras de classificação

#### Logs de Integração (`/relatorios/integracao/logs`)
- Histórico de execuções
- Erros e alertas
- Rastreabilidade

---

### 3.10 Banco de Horas

**Rotas**:
- `/banco-horas` - Painel geral
- `/banco-horas/regras` - Configuração de regras
- `/banco-horas/extrato/:id` - Extrato individual

**Funcionalidades**:

#### Painel Geral (`/banco-horas`)
- Saldos de todos os colaboradores
- Total acumulado
- Minutos a vencer em 30 dias
- Colaboradores em situação crítica
- Filtros por empresa e status

#### Regras (`/banco-horas/regras`)
- Configuração de acumulação
- Vencimento de horas
- Tolerâncias

#### Extrato (`/banco-horas/extrato/:id`)
- Histórico individual de eventos
- Saldo por período
- Movimentações detalhadas

**Inputs**:
- Eventos de crédito/débito
- Justificativas
- Datas de competência

**Outputs**:
- Saldo atual
- Histórico de movimentações
- Relatório para exportação (CSV)

---

### 3.11 Central de Governança

**Rota**: `/governanca`

**Funcionalidades**:

#### Usuários (`/governanca/usuarios`)
- Gestão de usuários do sistema
- Ativação/Desativação
- Vinculação a empresas
- Perfis de acesso

#### Perfis (`/governanca/perfis`)
- Criação e edição de perfis
- Permissões granulares
- Herança de permissões

#### Auditoria (`/governanca/auditoria`)
- Log de todas as ações
- Auditoria de dados sensíveis
- Rastreabilidade completa

---

### 3.12 Fechamento Mensal

**Rota**: `/fechamento`

**Funcionalidades**:
- Consolidação por período
- Total de operações
- Total de valor calculado
- Contagem de inconsistências
- Status (Aberto/Fechado)
- Reabertura com justificativa

---

### 3.13 Regras Operacionais

**Rota**: `/cadastros/regras-operacionais`

**Funcionalidades**:
- Cadastro de regras de cálculo
- Regras por transportadora
- Regras por tipo de serviço
- Formas de pagamento
- Produtos de carga
- Configurações específicas por contexto (transportadora)

---

### 3.14 Importações

**Rota**: `/importacoes`

**Funcionalidades**:
- Importação de planilhas (Excel/CSV)
- Sincronização de dados de ponto
- Histórico de importações
- Status (sucesso/erro/parcial)
- Logs detalhados

---

### 3.15 Inconsistências

**Rota**: `/inconsistencias`

**Funcionalidades**:
- Listagem de inconsistências detectadas
- Tipos de inconsistência
- Origem (importação, processamento)
- Resolução de pendências

---

### 3.16 Configurações

**Rota**: `/configuracoes`

**Funcionalidades**:

#### Aba Preferências
- Tema (claro/escuro)
- Aba padrão inicial

#### Aba Perfil
- Edição de nome
- Upload de avatar

#### Aba Configurações do Sistema
- Tipos de operação
- Produtos de carga
- Tipos de dia
- Parâmetros operacionais

#### Aba Armazenamento
- Gestão de arquivos
- Limite de uso

---

## 4. Fluxo de Telas (Navegação)

### Fluxo Principal

```
Login
    │
    ├── Dashboard (/)
    │       │
    │       ├── Operacional (/operacional)
    │       │       ├── Operações (/operacional/operacoes)
    │       │       └── Pontos (/operacional/pontos)
    │       │
    │       ├── Produção (/producao)
    │       │       ├── Lançamento (/producao)
    │       │       └── Diaristas (/producao/diaristas)
    │       │
    │       ├── RH (/rh)
    │       │       ├── Painel Diaristas (/rh/diaristas)
    │       │       └── Cadastros (/rh/diaristas/cadastros)
    │       │
    │       ├── Cadastros (/cadastros)
    │       │       ├── Empresas
    │       │       ├── Colaboradores
    │       │       ├── Coletores
    │       │       └── Regras Operacionais
    │       │
    │       ├── Financeiro (/financeiro)
    │       │       ├── Competências
    │       │       ├── Faturamento
    │       │       ├── Regras de Cálculo
    │       │       └── Detalhamentos
    │       │
    │       ├── Bancário (/bancario)
    │       │       ├── Remessa CNAB
    │       │       ├── Retorno
    │       │       └── Histórico
    │       │
    │       ├── Relatórios (/relatorios)
    │       │       ├── Catálogo
    │       │       ├── Agendamentos
    │       │       ├── Layouts
    │       │       ├── Integração Contábil
    │       │       └── Logs
    │       │
    │       ├── Banco de Horas (/banco-horas)
    │       │       ├── Painel Geral
    │       │       ├── Regras
    │       │       └── Extrato Individual
    │       │
    │       ├── Governança (/governanca)
    │       │       ├── Usuários
    │       │       ├── Perfis
    │       │       └── Auditoria
    │       │
    │       ├── Fechamento (/fechamento)
    │       │
    │       ├── Importações (/importacoes)
    │       │
    │       ├── Inconsistências (/inconsistencias)
    │       │
    │       └── Configurações (/configuracoes)
    │
    ├── Portal Cliente (Acesso Externo)
    │       ├── Dashboard (/cliente/dashboard)
    │       ├── Relatórios (/cliente/relatorios)
    │       └── Aprovações (/cliente/aprovacoes)
    │
    └── Login Operacional (/login/operacional)
```

---

## 5. Perfis de Acesso e Permissões

### Roles do Banco de Dados

| Role | Descrição |
|------|-----------|
| `admin_role` | Acesso total ao sistema |
| `rh_role` | Acesso ao módulo de RH e ponto |
| `fin_role` | Acesso ao módulo financeiro |

### Perfis de Usuário

| Perfil | Funcionalidades |
|--------|-----------------|
| **Admin** | Acesso completo a todos os módulos |
| **Financeiro** | Financeiro, bancário, relatórios |
| **RH** | Ponto, diaristas, cadastro de colaboradores |
| **Operacional** | Lançamento de operações, produção |
| **Encarregado** | Visualização e lançamento parcial |
| **Cliente** | Acesso ao portal externo |

### Políticas de Segurança (RLS)

- **Registros de Ponto**: Acesso do proprietário ou admin
- **Operações**: Leitura por admin/financeiro, escrita por admin/RH
- **Custos**: Leitura por admin/financeiro, escrita por admin/RH
- **Faturas**: Apenas leitura para clientes (via portal)

---

## 6. Inputs e Saídas por Módulo

### Operações

**Inputs**:
- Data (date)
- Empresa (select)
- Transportadora (select)
- Tipo Serviço (select: Volume/Carro)
- Quantidade (number)
- Valor Unitário (currency)
- Horário Início (time)
- Horário Fim (time)
- Placa (string)
- Responsável (select colaborador)
- Observações (text)

**Saídas**:
- Lista de operações filtrada
- Totalizadores por período
- Valor total calculado
- Exportação Excel

### Ponto

**Inputs**:
- Colaborador (select)
- Data (date)
- Entrada (time)
- Saída Almoço (time)
- Retorno Almoço (time)
- Saída (time)
- Período (select: Diurno/Noturno)
- Tipo Dia (select: Normal/Domingo/Feriado)

**Saídas**:
- Espelho de ponto
- Relatório de horas
- Resumo mensal

### Diaristas

**Inputs**:
- Nome (string)
- CPF (string)
- Telefone (string)
- Função (select)
- Valor Diária (currency)
- Dados Bancários (object)
- Empresa (select)
- Status (toggle)

**Saídas**:
- Lista de diaristas
- Relatório de pagamento
- Crachás

### Financeiro

**Inputs**:
- Competência (month/year)
- Empresa (select)
- Faturas (list)
- Aprovações (actions)

**Saídas**:
- Faturas formatadas
- Relatórios consolidados
- Status de fechamento

---

## 7. Integrações

### Integração Contábil
- Geração de arquivos para sistema contábil
- Mapeamento de contas
- Agendamento automático
- Logs de processamento

### Integração Bancária
- Envio de remessas (CNAB 240)
- Recebimento de retornos
- Conciliação automática

### Portal do Cliente
- API de acesso a dados
- Notificações de aprovação
- Relatórios em tempo real

---

## 8. Funcionalidades Especiais

### Admin Override
- Permite alteração de dados protegidos
- Requer justificativa
- Registrado em auditoria
- Gatilho de validação no banco

### Processamento Diário
- Função Edge Function do Supabase
- Cálculo automático de operações
- Geração de resultados

### Importação de Planilhas
- Suporte Excel e CSV
- Mapeamento de colunas
- Validação de dados
- Histórico de importações

### Auditoria
- Tabela de log de operações
- Trigger automático
- Rastreabilidade completa

---

## 9. Tecnologias e Bibliotecas

### Dependencies Principais

```json
{
  "react": "^18.3.1",
  "react-router-dom": "^6.30.1",
  "@supabase/supabase-js": "^2.103.3",
  "@tanstack/react-query": "^5.83.0",
  "recharts": "^2.15.4",
  "lucide-react": "^1.8.0",
  "date-fns": "^3.6.0",
  "xlsx": "^0.18.5",
  "jspdf": "^4.2.1",
  "zod": "^3.25.76",
  "react-hook-form": "^7.61.1",
  "@radix-ui/react-*": "/* múltiplos componentes */",
  "tailwindcss": "^3.4.17"
}
```

---

## 10. Considerações Finais

O ERP Orbe é um sistema completo e modular, desenvolvido para atender às necessidades específicas de empresas de logística com gestão de diaristas. Sua arquitetura moderna (React + Supabase) permite escalabilidade e fácil manutenção.

O sistema oferece:
- **Modularidade**: Cada área funciona de forma independente
- **Segurança**: RLS + Roles + Auditoria
- **Flexibilidade**: Regras operacionais customizáveis
- **Integração**: Múltiplos pontos de integração
- **Portal**: Acesso externo para clientes

---

*Documento gerado automaticamente em: Mon May 04 2026*