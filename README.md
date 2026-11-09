# ERP ORBE — Painel Operacional Logístico ESC LOG

O **ERP ORBE** é uma plataforma web e mobile de gestão de operações logísticas, recursos humanos operacionais e controladoria financeira desenvolvida para a **ESC LOG**. O sistema gerencia desde a captura operacional em campo (operações por volume, presença semanal de diaristas, serviços extras e custos extras) até o processamento de ponto CLT, rateio de intermitentes, faturamento de receitas, contas a pagar, conciliação bancária CNAB e apuração do DRE operacional.

---

## 🚀 Stack Tecnológica Confirmada

- **Frontend:** React 18.3, TypeScript 5.8, Vite 5.4 (SWC)
- **UI & Estilização:** Tailwind CSS v3, Radix UI, Lucide React, Recharts
- **Estado do Servidor:** TanStack React Query v5
- **Roteamento:** React Router DOM v6 com RBAC granular
- **Backend & Banco de Dados:** Supabase Cloud (PostgreSQL 15, Auth, Row-Level Security, RPCs atômicas e Triggers)
- **Funções Serverless:** Supabase Edge Functions (Deno Runtime)
- **Testes & QA:** Vitest 3.2, Testing Library, Playwright
- **Relatórios & Exportações:** jsPDF, AutoTable, PapaParse, XLSX

---

## 📋 Pré-requisitos

- **Node.js:** Versão 20.x ou superior (testado com Node.js v24 LTS)
- **Gerenciador de Pacotes:** `npm` (versão 10.x ou superior)
- **Instância Supabase:** Projeto ativo com as migrations aplicadas e credenciais de acesso configuradas

---

## ⚙️ Configuração Local de Ambiente

1. Clone o repositório ou acesse a pasta do projeto.
2. Crie o arquivo de ambiente local a partir do template de exemplo:
   ```bash
   cp .env.local.example .env.local
   ```
3. Preencha o arquivo `.env.local` com as credenciais do seu projeto Supabase:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto-id.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima-publica-aqui
   ```
   > ⚠️ **Atenção:** O arquivo `.env.local` é estritamente pessoal e está protegido no `.gitignore`. **Nunca versionar arquivos de credenciais.**

---

## 🛠️ Instalação e Comandos Oficiais

Os scripts oficiais disponíveis no [package.json](package.json) são:

```bash
# Instalar dependências
npm install

# Iniciar servidor local de desenvolvimento (acesso via http://localhost:8080)
npm run dev

# Validação estática de tipos TypeScript (0 erros tolerados)
npm run type-check

# Execução da suíte de testes com Vitest
npm run test

# Compilação otimizada para produção (saída em dist/)
npm run build

# Pré-visualização local dos artefatos compilados
npm run preview

# Verificação de integridade de codificação UTF-8
npm run check:encoding
```

---

## 📁 Estrutura Resumida do Repositório

```text
ORBE/
├── .agent/              # Regras operacionais, scripts de suporte e relatórios de IA
├── .agents/             # Framework AG Kit (memory, rules, skills universais)
├── docs/                # Documentação técnica, arquitetura e evidências de homologação
│   ├── arquitetura/     # Especificações de design system e fluxos
│   └── homologacao/     # Evidências do GATE FINAL (33fa738)
├── public/              # Ativos estáticos e manifestos PWA
├── scripts/             # Scripts utilitários de checagem e automação CI/CD
├── src/                 # NÚCLEO DA APLICAÇÃO (Frontend React)
│   ├── components/      # Componentes UI (Radix, Drawers, Modais, Layout, Shells)
│   ├── contexts/        # Contextos React (Auth, Tenant, RBAC, Pipeline, Client)
│   ├── hooks/           # Hooks React e mutações TanStack Query
│   ├── lib/             # Cliente Supabase singleton, formatadores e RBAC
│   ├── pages/           # Telas do sistema (Dashboard, Operações, RH, Financeiro, etc.)
│   ├── services/        # Camada de negócio desacoplada (Domínio, CNAB, Receitas, etc.)
│   ├── test/            # Suíte de testes unitários e de integração
│   └── types/           # Tipagens TypeScript e contratos de dados
├── supabase/            # NÚCLEO DO BACKEND SUPABASE
│   ├── functions/       # 11 Supabase Edge Functions ativas
│   ├── migrations/      # 293 migrations incrementais do banco
│   └── rollbacks/       # Scripts SQL de contingência
├── CEREBRO.md           # Mapa técnico e índice operacional para agentes de IA e engenharia
├── MEMORIA.md           # Registro de estado técnico, decisões e marcos homologados
└── package.json         # Dependências e scripts de execução
```

---

## 🏢 Módulos Funcionais Principais

O sistema organiza-se em seis grandes domínios com controle de acesso baseado em papéis (RBAC):

1. **Dashboard Executivo & Torre Operacional:** Indicadores em tempo real, auditoria financeira de competência, gargalos e integridade semântica.
2. **Operações de Campo (Portal Mobile & Desktop):** Lançamento de Operações por Volume (carga/descarga com rateio), Diaristas semanais, Serviços Extras e Custos Extras.
3. **Pessoas & Recursos Humanos:** Ponto e Jornadas CLT, Banco de Horas com regras de tolerância, gestão de Intermitentes e fechamento de folha.
4. **Aprovações & Fechamento:** Central unificada de aprovações RH/Financeiro, Central de Inconsistências operacionais e fechamento de ciclos periódicos.
5. **Financeiro & Controladoria:** Pipeline de Receitas Operacionais (Caixa Imediato, Duplicatas, Faturamento Mensal), Contas a Pagar/Despesas Federadas, Inadimplência e DRE Operacional.
6. **Central Bancária (CNAB):** Geração de remessas CNAB 240 (Itaú Sispag e Banco do Brasil), importação de arquivos de retorno bancário e conciliação financeira automatizada.

---

## 📚 Navegação e Referências Documentais

- **[CEREBRO.md](CEREBRO.md):** Mapa técnico central, regras de isolamento, contratos de banco e guia de resolução de problemas (leitura obrigatória para agentes de IA).
- **[MEMORIA.md](MEMORIA.md):** Histórico de marcos homologados, decisões de arquitetura e dívidas técnicas mapeadas.
- **[docs/homologacao/EVIDENCIAS_CONSOLIDADAS_HOMOLOGACAO_ORBE.md](docs/homologacao/EVIDENCIAS_CONSOLIDADAS_HOMOLOGACAO_ORBE.md):** Relatório oficial do GATE FINAL homologado no commit `33fa738`.
- **[docs/ORBE_DESIGN_SYSTEM.md](docs/ORBE_DESIGN_SYSTEM.md):** Especificação de tokens visuais, componentes e padrões de interface.
