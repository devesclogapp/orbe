# CEREBRO.md — Índice Técnico Central e Mapa Operacional

> **Finalidade:** Ponto de entrada canônico e mapa de navegação técnico do ERP ORBE para desenvolvedores, arquitetos e agentes de IA.  
> **Status Geral do Sistema:** GATE FINAL de Homologação Aprovado em Produção (Versão `33fa738`).  
> **Princípio Central:** Preservar rigorosamente as funcionalidades homologadas e os contratos vigentes.

---

## 1. Visão Arquitetural Macro

O ERP ORBE é construído sobre uma arquitetura serverless desacoplada com separação total entre os domínios de **Receitas Operacionais** e **Despesas/Folha**:

```text
[ ENTRADAS OPERACIONAIS ]
  ├── Portal do Encarregado (Mobile /producao/*)
  ├── Coletor de Ponto REP / TIO Digital (Automação 7h)
  └── Importações Manuais / Planilhas

          │
          ▼
[ CAMADA DE DOMÍNIO DESACOPLADA (src/services/) ]
  ├── Pipeline de Receitas (receitasOficial.service.ts)
  │     └── Caixa Imediato | Duplicata | Faturamento Mensal -> Faturas -> Contas a Receber
  └── Pipeline de Despesas (despesasOficial.service.ts)
        └── CLT | Diaristas | Intermitentes | Custos Extras -> Lotes -> CNAB 240 -> Conciliação

          │
          ▼
[ GOVERNANÇA, CONCILIAÇÃO & DRE ]
  ├── DRE Operacional Integrado (financial.service.ts)
  ├── Auditoria em Tempo Real (Triggers & Snapshots)
  └── Dashboard Executivo & Torre Operacional (dashboard.service.ts)
```

---

## 2. Mapa de Módulos, Código e Fontes de Verdade

| Módulo Funcional | Páginas (`src/pages/`) | Serviços Centrais (`src/services/`) | Tabelas Supabase Reais | Status Atual |
| :--- | :--- | :--- | :--- | :---: |
| **Dashboard Executivo** | [Dashboard.tsx](src/pages/Dashboard.tsx) | [dashboard.service.ts](src/services/dashboard.service.ts) | `operacoes_producao`, `lancamentos_diaristas`, `faturas` | **HOMOLOGADO** |
| **Torre Operacional** | [PipelineOperacional.tsx](src/pages/PipelineOperacional.tsx) | [torreOperacional.service.ts](src/services/torreOperacional.service.ts) | `operacoes_producao`, `custos_extras`, `lancamentos_diaristas` | **HOMOLOGADO** |
| **Cadastros Basilares** | [CentralCadastros.tsx](src/pages/CentralCadastros.tsx) | [cadastros.service.ts](src/services/domain/cadastros.service.ts) | `empresas`, `unidades`, `colaboradores`, `transportadoras`, `fornecedores`, `produtos` | **HOMOLOGADO** |
| **Operação por Volume** | [Operacoes.tsx](src/pages/Operacoes.tsx), [LancamentoProducao.tsx](src/pages/LancamentoProducao.tsx) | [receitasOficial.service.ts](src/services/receitasOficial.service.ts) | `operacoes_producao`, `production_entry_collaborators` | **HOMOLOGADO** |
| **Diaristas (Semanal)** | [RhDiaristasPainel.tsx](src/pages/Rh/RhDiaristasPainel.tsx), [DiaristasLancamento.tsx](src/pages/Producao/DiaristasLancamento.tsx) | [diaristas.service.ts](src/services/domain/diaristas.service.ts) | `lancamentos_diaristas`, `diaristas_lotes`, `diaristas_lotes_fechamento` | **HOMOLOGADO** |
| **Serviços Extras** | [ServicosExtrasLancamento.tsx](src/pages/Producao/ServicosExtrasLancamento.tsx) | [producao.service.ts](src/services/domain/producao.service.ts) | `servicos_extras_operacionais`, `faturas` | **HOMOLOGADO** |
| **Custos Extras** | [CustosExtrasLancamento.tsx](src/pages/Producao/CustosExtrasLancamento.tsx) | [despesasOficial.service.ts](src/services/despesasOficial.service.ts) | `custos_extras_operacionais` | **HOMOLOGADO** |
| **Portal do Encarregado** | [LoginOperacional.tsx](src/pages/Auth/LoginOperacional.tsx), `src/pages/Producao/*` | [portalOperacional.service.ts](src/services/portal/portalOperacional.service.ts) | `perfis`, tabelas operacionais de campo | **HOMOLOGADO** (Rotas, Lançamentos, RLS) / **PENDENTE** (Validação Campo) |
| **RH Ponto & CLT** | [PontoJornadasClt.tsx](src/pages/Clt/PontoJornadasClt.tsx), [ProcessamentoRH.tsx](src/pages/BancoHoras/ProcessamentoRH.tsx) | [rhProcessing.service.ts](src/services/rhProcessing.service.ts), [jornada.service.ts](src/services/jornada.service.ts) | `registros_ponto`, `jornadas_trabalho`, `banco_horas_registros` | **HOMOLOGADO** (Motor base) |
| **RH Intermitentes** | [IntermitentesRecebidos.tsx](src/pages/Operacional/IntermitentesRecebidos.tsx) | [intermitentes.service.ts](src/services/domain/intermitentes.service.ts) | `lancamentos_intermitentes`, `lotes_fechamento_intermitentes` | **HOMOLOGADO** |
| **Financeiro & DRE** | [CentralFinanceira.tsx](src/pages/CentralFinanceira.tsx), [RelatorioDRE.tsx](src/pages/Financeiro/RelatorioDRE.tsx) | [financial.service.ts](src/services/financial.service.ts), [despesasOficial.service.ts](src/services/despesasOficial.service.ts) | `contas_pagar`, `contas_receber`, `faturas`, `dre_lancamentos` | **HOMOLOGADO** |
| **Central Bancária (CNAB)** | [CentralBancaria.tsx](src/pages/CentralBancaria.tsx), [RemessaCNAB.tsx](src/pages/Financeiro/RemessaCNAB.tsx) | [cnab240-itau.ts](src/services/cnab/cnab240-itau.ts), [cnabRetorno.service.ts](src/services/cnab/cnabRetorno.service.ts) | `remessas_cnab`, `retornos_cnab`, `contas_bancarias` | **TESTADO INTERNAMENTE** (Pendente banco real) |
| **Automações TIO / n8n** | [AutomacaoOperacional.tsx](src/pages/Governanca/AutomacaoOperacional.tsx) | `supabase/functions/importar-*-tio/` | `historico_importacoes` | **IMPLEMENTADO** (Pendente E2E total) |

---

## 3. Contratos Inegociáveis e Regras de Segurança

1. **Separação Obrigatória dos Pipelines (Receitas vs Despesas):**
   - Regra estrita documentada em [.agent/rules/evolucao-operacao-volume.md](.agent/rules/evolucao-operacao-volume.md).
   - O pipeline de receitas cuida do faturamento de clientes; o pipeline de despesas cuida de pagamentos a colaboradores e fornecedores. **Nunca compartilhar tabelas de estado ou regras de cálculo entre ambos.**
2. **Segregação Canônica de Despesas (`ORIGEM:ID`):**
   - O serviço [despesasOficial.service.ts](src/services/despesasOficial.service.ts) unifica despesas com chave composta `ORIGEM:ID_CANONICO`. Impede duplicidades no DRE e nas telas de contas a pagar.
3. **Bloqueio de Custos Extras no CNAB:**
   - Registros de `custos_extras_operacionais` são liquidados localmente ou reembolsados; **jamais entram em arquivo de remessa bancária CNAB**.
4. **Isolamento Multitenant Estrito:**
   - Toda query direta no Supabase deve respeitar o `tenant_id`. O Supabase aplica Row-Level Security (RLS) referenciando `public.perfis.tenant_id`.
5. **Isolamento de Homologação Sintética (`EnvironmentService`):**
   - Conforme documentado em [src/services/environment/EnvironmentService.ts](src/services/environment/EnvironmentService.ts), registros com flag `is_teste = true` pertencem à Base de Homologação (`CLT-HML-001` a `005`). Em ambiente de produção, são filtrados e nunca misturados com dados reais.
6. **Controle de Acesso e Escopo do Encarregado (`PortalGuard`):**
   - Implementado em [src/components/Auth/PortalGuard.tsx](src/components/Auth/PortalGuard.tsx) e [src/lib/access-control.ts](src/lib/access-control.ts).
   - **Homologado:** Renderização das rotas operacionais, lançamentos dos quatro fluxos operacionais e controle de acesso RBAC/RLS (o encarregado não possui permissão para acessar financeiro, folha RH ou governança, comprovado nos testes do FIX-08).
   - **Testado Internamente:** Autenticação no navegador e fluxo funcional dos componentes `LoginOperacional` e `PortalGuard`.
   - **Pendente:** Validação operacional em dispositivos móveis reais diretamente com encarregados em condições de campo.
7. **Imutabilidade de Lotes:**
   - Lotes com status `REMESSA_GERADA`, `CNAB_GERADO` ou `PAGO` são imutáveis e travados contra novas inclusões.

---

## 4. Dicionário Semântico Canônico

- **Lançamento:** A menor unidade de apontamento (uma operação de volume, uma diária, um custo extra).
- **Lote:** Agrupamento formal de lançamentos processados para validação conjunta (lote de diaristas semanal, lote de intermitentes, lote CNAB). Nunca chamar lançamento individual de lote.
- **Ciclo:** Período de apuração temporal (semana operacional para diaristas, competência mensal `YYYY-MM` para CLT e intermitentes).
- **Operação:** Carga, descarga, transbordo ou movimentação logística realizada para um cliente/empresa.
- **Diarista:** Colaborador avulso que recebe valor fixo por diária com apuração semanal.
- **Intermitente:** Colaborador convocado sob demanda que recebe proporcionalmente pelas horas executadas na operação.
- **CLT:** Colaborador fixo com jornada contratual registrada via REP, com banco de horas e folha mensal.

---

## 5. RPCs Transacionais e Edge Functions Críticas

### Stored Procedures (PostgreSQL) Confirmadas:
- `fechar_periodo_diaristas`: Agrupa lançamentos semanais e gera lote com status `AGUARDANDO_VALIDACAO_RH`.
- `process_intermitentes_lote`: Consolida convocações e horas de intermitentes para aprovação.
- `conciliar_retorno_bancario_1n`: Baixa automática de parcelas e conciliação atômica de arquivos de retorno bancário.

### Supabase Edge Functions (`supabase/functions/`):
- `importar-pontos-rhid`: Endpoint serverless para ingestão de pontos via coletor REP.
- `importar-colaboradores-tio`: Sincronização automática de dados cadastrais de funcionários.
- `create-tenant`: Criação e provisionamento atômico de novos ambientes multi-tenant com perfil Admin.
- `sec03-activate-account`: Ativação segura de contas administrativas sob fluxo de convite.

---

## 6. Guia de Investigação Rápida (Onde Procurar)

| Se o problema estiver em: | Arquivos e Diretórios a Investigar: |
| :--- | :--- |
| **Telas não exibem campos lançados pelo encarregado** | [src/services/domain/producao.service.ts](src/services/domain/producao.service.ts), [.agent/rules/skill-incons-dados-telas.md](.agent/rules/skill-incons-dados-telas.md) |
| **Cálculo de diárias ou fechamento semanal de diaristas** | [src/services/domain/diaristas.service.ts](src/services/domain/diaristas.service.ts), [.agent/rules/validacao-final-diarista.md](.agent/rules/validacao-final-diarista.md) |
| **Banco de Horas, tolerância de ponto ou batidas ímpares** | [src/services/rhProcessing.service.ts](src/services/rhProcessing.service.ts), [src/services/jornada.service.ts](src/services/jornada.service.ts) |
| **Operações por volume, faturamento ou status de receitas** | [src/services/receitasOficial.service.ts](src/services/receitasOficial.service.ts), [.agent/rules/evolucao-operacao-volume.md](.agent/rules/evolucao-operacao-volume.md) |
| **Contas a pagar, duplicidade de despesas ou DRE** | [src/services/despesasOficial.service.ts](src/services/despesasOficial.service.ts), [src/services/financial.service.ts](src/services/financial.service.ts) |
| **Arquivo CNAB 240, dados bancários ou retorno Itaú/BB** | [src/services/cnab/cnab240-itau.ts](src/services/cnab/cnab240-itau.ts), [src/services/cnab/cnabRetorno.service.ts](src/services/cnab/cnabRetorno.service.ts) |
| **Permissões de tela, bloqueio de botões ou perfis (RBAC)** | [src/lib/access-control.ts](src/lib/access-control.ts), [src/contexts/AccessControlContext.tsx](src/contexts/AccessControlContext.tsx) |
| **Navegação, títulos e rotas do ERP** | [src/components/layout/navigationMeta.ts](src/components/layout/navigationMeta.ts), [src/App.tsx](src/App.tsx) |

---

## 7. Diretrizes para Agentes de IA

1. **Leitura Obrigatória:** Ler este documento ([CEREBRO.md](CEREBRO.md)) e [MEMORIA.md](MEMORIA.md) antes de qualquer proposição arquitetural.
2. **Prioridade de Regras:** Workspace Rules ([.agent/rules/](.agent/rules/) e [.agents/rules/](.agents/rules/)) > `CEREBRO.md` > Código local.
3. **Regra de Ouro:** Extensão, nunca substituição destrutiva de contratos já homologados.
4. **Verificação Mandatória:** Após qualquer alteração de código, rodar `npm run type-check` e `npm run build`.
