# Auditoria Arquitetural Final — ORBE ERP
**Data da Auditoria**: 2026-07-10
**Fase**: 09 (Go-Live)
**Tipo**: Relatório de Arquitetura em Nível de Componentes

## 1. Visão Geral
O ORBE ERP é um sistema "Single-Page Application" construído principalmente usando **React (Vite)** e **TypeScript**, hospedado ou entregue estaticamente.
Seu backend, banco de dados, autenticação e computação sob-demanda está delegada para o **Supabase**.

**Pilha Tecnológica (Stack)**:
- **Frontend**: React 18, Vite, TypeScript
- **State/Data Fetching**: `@tanstack/react-query`
- **UI Components**: Shadcn UI (Radix UI, Tailwind CSS)
- **Forms & Validation**: `react-hook-form`, `zod`
- **Rotas**: `react-router-dom`
- **Backend / Database / Auth**: Supabase (PostgreSQL 15+)

## 2. Mapa de Diretórios e Escopo

### 2.1. Frontend (`src/`)

**Módulos / Páginas de Interface (`src/pages/`)**:
O sistema é organizado nos seguintes domínios maiores:
- **Autenticação**: `Auth/` (Login, Cadastro, Redefinição)
- **RH / Banco de Horas**: `BancoHoras/` (Painel Geral, Extrato, Processamento, Regras)
- **Cadastros / Governança**: `Cadastros/` (Empresas, Colaboradores, Coletores, Transportadoras, Fornecedores, Serviços, Parâmetros)
- **Central Operacional**: `CentralOperacional.tsx`, `Dashboard.tsx`
- **Central Financeira**: `CentralFinanceira.tsx`, `Financeiro/` (Inadimplência, Faturamento, DRE, CNAB, Conciliação)
- **Integração / Dashboard do Cliente**: `Cliente/`

**Serviços e Domínios (`src/services/`)**:
Camada responsável por comunicar com o Supabase e abstrair a regra de banco, possuindo organização orientada ao domínio (DDD):
- `domain/`: Classes e serviços base (ex. `core.service.ts`, `aprovacoes.service.ts`, `cadastros.service.ts`, `producao.service.ts`)
- `cnab/`: Toda a lógica e adapters para formato bancário (ex: `CNAB240BBWriter`, `CNAB240ItauWriter`, `CNAB240Formatter`, retorno, etc.)
- `operationalEngine/`: Orquestração de negócio `MotorFinanceiro.ts`, `MotorIndex.ts`, `CicloOperacionalService.ts`
- `automation/`: Processadores e Workers locais automatizados.

### 2.2. Backend (Supabase)

**Edge Functions (`supabase/functions/`)**:
- Importação / Processamento em Batch (ex: `importar-colaboradores-tio`, `importar-intermitentes-tio`, `importar-pontos-*`)
- Ferramentas de Setup e Manipulação (`create-tenant`, `delete-demo-data`, `process-day`)

**Banco de Dados (Migrations em `supabase/migrations/`)**:
- Existem >90 migrations de banco de dados descrevendo fortemente uma arquitetura acoplada no BD (Postgres).
- **Segurança (RLS)**: Envolvendo regras de Multitenancy fortemente documentadas em schemas `tenant_id`
- **Automação de Banco**: Implementação de triggers sistêmicas para log, auditoria, concorrência e OCC.

## 3. Topologia da Solução e Acoplamento

A arquitetura final homologada reflete dois pipelines desacoplados que convergem financeiramente:

- **Pipeline de Despesas (RH)**: Captura (Pontos/Diaristas) -> Motor RH -> Financeiro -> Contas a Pagar/CNAB -> Conciliação
- **Pipeline de Receitas (Operações)**: Produção (Encarregado) -> Validação -> Classificação/Motor Financeiro -> Faturamento/Receitas -> Contas a Receber/DRE

*Conclusão da Etapa 01*:
O sistema reflete maturidade arquitetural mantendo a separação entre apresentação (Telas/Pages), regras de domínio em JS (Services/Domain) e integridade de dados (Supabase Migrations). A substituição de lógicas pesadas para Edge Functions e RPCs também é evidente, aderindo ao princípio de "Domain Hardening" e "OCC".
