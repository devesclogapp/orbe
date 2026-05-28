# 🔍 RELATÓRIO DE AUDITORIA OPERACIONAL — ERP ORBE
## Data: 2026-05-27 | Auditor: Antigravity

---

## 1. MAPA DA ARQUITETURA OPERACIONAL

### 1.1 Estrutura Geral

| Camada | Localização | Responsabilidade |
|---|---|---|
| **Contextos** | `src/contexts/` (8 contextos) | Auth, Tenant, Pipeline, Preferences, Selection, Onboarding, Access, Client |
| **Services** | `src/services/base.service.ts` (4915 linhas) + 15 services auxiliares | CRUD, logic, CNAB, RH, Financeiro |
| **Pages** | `src/pages/` (27 arquivos + 9 diretórios) | UI operacional |
| **Hooks** | `src/hooks/` (8 hooks) | Tenant filter, mobile, toast, pipeline, pulse |
| **Components** | `src/components/` (94 arquivos) | UI components |

### 1.2 Pipeline Operacional Mapeado

```
ENCARREGADO (mobile/portal)
├── /producao                    → LancamentoProducao.tsx
├── /producao/diaristas          → DiaristasLancamento.tsx
├── /producao/custos-extras      → CustosExtrasLancamento.tsx
├── /producao/servicos-extras    → ServicosExtrasLancamento.tsx
│
↓ PAINEL OPERACIONAL
├── /operacional/operacoes       → Operacoes.tsx + OperacoesTableBlock.tsx
├── /operacional/diaristas       → RhDiaristasPainel.tsx (rota compartilhada)
│
↓ RH
├── /rh/diaristas                → RhDiaristasPainel.tsx (validação/edição)
├── /rh/diaristas/cadastros      → RhDiaristasGestao.tsx
│
↓ FINANCEIRO
├── /financeiro                  → CentralFinanceira.tsx
├── /bancario                    → CentralBancaria.tsx
├── /financeiro/remessa          → RemessaCNAB.tsx
├── /financeiro/retorno          → RetornoBancario.tsx
│
↓ FECHAMENTO
├── /fechamento                  → Fechamento.tsx
│
↓ RELATÓRIOS/KPIs
├── /operacional/dashboard       → Dashboard.tsx
├── /relatorios                  → CentralRelatoriosIntegracoes.tsx
│
↓ GOVERNANÇA/AUDITORIA
├── /governanca                  → CentralGovernanca.tsx
├── /governanca/auditoria        → Auditoria.tsx
```

---

## 2. VALIDAÇÃO POR ETAPA DO PIPELINE

### ═══════════════════════════════════════
### ETAPA 1 — CAPTURA OPERACIONAL (ENCARREGADO)
### ═══════════════════════════════════════

**Status: ✅ OPERACIONAL COM RESSALVAS**

#### Módulos de Captura:

| Módulo | Arquivo | Tabela DB | Status |
|---|---|---|---|
| Operação por Volume | `LancamentoProducao.tsx` | `operacoes_producao` | ✅ Funcional |
| Diaristas | `DiaristasLancamento.tsx` | `lancamentos_diaristas` | ✅ Funcional |
| Custos Extras | `CustosExtrasLancamento.tsx` | `custos_extras_operacionais` | ✅ Funcional |
| Serviços Extras | `ServicosExtrasLancamento.tsx` | `servicos_extras_operacionais` | ✅ Funcional |

#### Serviços de Persistência:

| Service | Tabela | Sanitização | Joins | Status |
|---|---|---|---|---|
| `OperacaoProducaoService` | `operacoes_producao` | ✅ `sanitizeOperacaoPayload()` remove campos inválidos | ✅ 7 joins (colaboradores, tipos_servico, transportadoras, fornecedores, produtos_carga, formas_pagamento, unidades) | ✅ |
| `LancamentoDiaristaService` | `lancamentos_diaristas` | ✅ Whitelist `VALID_COLUMNS` + delete+insert idempotente | ❌ Sem joins — apenas `select('*')` | ⚠️ |
| `CustoExtraOperacionalService` | `custos_extras_operacionais` | ✅ Básico | ✅ Join `empresas(nome)` | ✅ |
| `ServicosExtrasOperacionaisService` | `servicos_extras_operacionais` | ✅ Básico (herdado de BaseService) | ✅ Join `empresas(nome)` | ✅ |

#### Findings — Etapa 1:

| # | Severidade | Descrição | Causa Raiz |
|---|---|---|---|
| E1.1 | ⚠️ Regular | `LancamentoDiaristaService.getByPeriodo()` usa `select('*')` sem joins. Não traz nome da empresa, nome da unidade. O frontend depende de `nome_colaborador` denormalizado na tabela. | Por design — dados denormalizados no insert. |
| E1.2 | ✅ OK | `OperacaoProducaoService` tem sanitização robusta: remove `categoria_servico`, `categoria_custo`, `tipo_calculo`, `descricao_servico`, `modalidade_financeira` do payload e normaliza `tipo_calculo_snapshot`. | Resolvido em conversas anteriores. |
| E1.3 | ✅ OK | Insert de diaristas usa estratégia DELETE+INSERT idempotente para evitar duplicatas. | Implementado corretamente. |

---

### ═══════════════════════════════════════
### ETAPA 2 — PAINEL OPERACIONAL
### ═══════════════════════════════════════

**Status: ✅ OPERACIONAL**

#### Telas do Painel:

| Tela | Rota | Service Utilizado | Status |
|---|---|---|---|
| Operações (Volume, Serviços, Custos) | `/operacional/operacoes` | `OperacaoProducaoService.getAll()` | ✅ |
| Diaristas (visão operacional) | `/operacional/diaristas` | `LancamentoDiaristaService.getByPeriodo()` | ✅ |

#### Findings — Etapa 2:

| # | Severidade | Descrição |
|---|---|---|
| E2.1 | ✅ OK | `OperacoesTableBlock` recebe dados com todos os joins necessários. Campos exibidos: empresa_id→nome, tipo_servico_id→nome, transportadora_id→nome, fornecedor_id→nome, produto_carga_id→nome, forma_pagamento_id→nome, unidade_id→nome. |
| E2.2 | ⚠️ Regular | `RhDiaristasPainel` resolve `unidade_id` → nome via query separada (`unidades_operacionais`). Funcional mas sem join. |
| E2.3 | ✅ OK | Filtros de período (semana_atual, semana_anterior, personalizado) funcionam corretamente. |
| E2.4 | ✅ OK | Agrupamentos por diarista e por data implementados corretamente. |

---

### ═══════════════════════════════════════
### ETAPA 3 — FECHAMENTO DE CICLO (DIARISTAS)
### ═══════════════════════════════════════

**Status: ✅ OPERACIONAL**

#### Fluxo de Fechamento:

```
1. Encarregado fecha período via `fecharMutation`
   → LoteFechamentoDiaristaService.fecharPeriodo()
     → Agrega lançamentos por diarista
     → Cria/reutiliza lote em `diaristas_lotes_fechamento`
     → Chama RPC `fechar_periodo_diaristas()` (SECURITY DEFINER)
     → Status do lote: AGUARDANDO_VALIDACAO_RH

2. Sistema bloqueia edição via `periodoBloqueado` useMemo
   → Detecta lotes com status avançado
   
3. Invalidação de cache: 7 query keys invalidadas corretamente
```

#### Findings — Etapa 3:

| # | Severidade | Descrição |
|---|---|---|
| E3.1 | ✅ OK | Verificação de lote existente antes de criar novo (evita duplicidade). |
| E3.2 | ✅ OK | RPC `fechar_periodo_diaristas` usada para operação atômica com SECURITY DEFINER. |
| E3.3 | ⚠️ Mediano | Comentários `// tipo_fechamento: tipoFechamento, // Removido temporariamente para evitar erro de coluna inexistente` — campo planejado mas não implementado no banco. Pode causar perda de rastreabilidade entre fechamento operacional vs administrativo. |
| E3.4 | ✅ OK | Bloqueio de período funciona corretamente — detecta lotes com status avançado. |

---

### ═══════════════════════════════════════
### ETAPA 4 — RH (VALIDAÇÃO)
### ═══════════════════════════════════════

**Status: ✅ OPERACIONAL COM RESSALVAS**

#### Fluxo RH Diaristas:

```
1. `validarMutation` → LoteFechamentoDiaristaService.validarPeriodo()
   → RPC `validar_periodo_diaristas()` 
   → Status: AGUARDANDO_VALIDACAO_RH → VALIDADO_RH

2. Se !enviar_financeiro → bypass direto para FECHADO_FINANCEIRO ou PAGO
   → Update direto em supabase (lote + lançamentos)
   → Log de auditoria registrado

3. Reabertura: `reabrirMutation` 
   → RPC `reabrir_periodo_diaristas()`
   → Tipos: 'operacional' (devolve ao encarregado) | 'administrativa' (RH corrige)
```

#### Fluxo RH CLT (Pontos/Banco de Horas):

```
1. Processamento: rhProcessing.service.ts
   → validateColaboradorApto() 
   → calculateWorkedMinutes()
   → resolveOperationalEventType()

2. Consolidação: rhFinanceiro.service.ts
   → validateCompetenciaApproval()
   → approveCompetencia() → gera lotes
   → Status: AGUARDANDO_FINANCEIRO
```

#### Findings — Etapa 4:

| # | Severidade | Descrição |
|---|---|---|
| E4.1 | ✅ OK | Pipeline de diaristas: ABERTURA → FECHAMENTO → VALIDAÇÃO RH → FINANCEIRO → CNAB flui corretamente. |
| E4.2 | ✅ OK | Edição administrativa registra auditoria com snapshot pré-mutação (PASSO 1-5 no `editarMutation`). |
| E4.3 | ⚠️ Regular | `validarMutation` faz bypass de financeiro diretamente na UI com updates em cascata (lote + lançamentos). Isso deveria ser atômico via RPC. |
| E4.4 | ✅ OK | Reabertura tem 2 modos (operacional/administrativa) com log diferenciado. |
| E4.5 | ✅ OK | Status map completo — cobre lowercase, UPPERCASE e legado. |

---

### ═══════════════════════════════════════
### ETAPA 5 — FINANCEIRO
### ═══════════════════════════════════════

**Status: ✅ OPERACIONAL**

#### Central Financeira (`CentralFinanceira.tsx`):

```
1. Lista lotes recebidos: rhFinanceiro.service.ts → listLotesRecebidos()
2. Aprovação individual: aprovarFinanceiro()
3. Aprovação em lote: handleApproveBatch()
4. Devolução ao RH: devolverAoRH()
5. Custos extras: getByCompetencia()
6. Consolidação: ConsolidadoService, ResultadosService
```

#### Findings — Etapa 5:

| # | Severidade | Descrição |
|---|---|---|
| E5.1 | ✅ OK | `RHFinanceiroServiceClass.validateCompetenciaApproval()` validação de bloqueios (impedimentos, pendências cadastrais, avisos operacionais). |
| E5.2 | ✅ OK | `approveCompetencia()` gera lotes com histórico e log de auditoria. |
| E5.3 | ✅ OK | Diaristas financeiro: `getByEmpresaParaFinanceiro()` filtra apenas status avançados (VALIDADO_RH, FECHADO_FINANCEIRO, AGUARDANDO_PAGAMENTO, PAGO, cnab_gerado). |

---

### ═══════════════════════════════════════
### ETAPA 6 — CNAB/TXT
### ═══════════════════════════════════════

**Status: ✅ OPERACIONAL**

#### Geração CNAB Diaristas:

```
LoteFechamentoDiaristaService.gerarCNABParaLote()
1. Busca lote → valida status (FECHADO_FINANCEIRO | AGUARDANDO_PAGAMENTO)
2. Busca lançamentos por lote_fechamento_id (fallback: por período)
3. Agrega valores por diarista
4. Busca dados bancários dos colaboradores
5. Valida: banco, agência, conta, dígito, CPF, valor > 0
6. Monta empresa remetente
7. Gera CNAB240 posicional (BB) via gerarCNAB240BB()
8. Registra arquivo via CnabRemessaArquivoService
9. Download Windows-1252 (ANSI/FEBRABAN)
10. Atualiza lote: status → cnab_gerado, status_conciliacao → aguardando_conciliacao
11. Log de auditoria: GEROU_CNAB
```

#### CNAB CLT:

```
Infraestrutura completa:
- CNAB240BBReader.ts (retorno)
- CNAB240BBWriter.ts (remessa) 
- cnab240-posicional.ts (layout posicional)
- cnabRemessaArquivo.service.ts (persistência)
- cnabRetorno.service.ts (conciliação)
- segmentos/ (7 arquivos: HeaderArquivo, HeaderLote, SegmentoA/B/J/J52, Trailer)
```

#### Findings — Etapa 6:

| # | Severidade | Descrição |
|---|---|---|
| E6.1 | ✅ OK | Validação robusta de dados bancários antes de gerar CNAB. Lista pendências por diarista. |
| E6.2 | ✅ OK | Sequencial de arquivo gerenciado por conta bancária (evita colisão). |
| E6.3 | ✅ OK | Tipo serviço 20 (Fornecedor) correto para pagamentos a prestadores. |
| E6.4 | ✅ OK | Log de auditoria com detalhes: arquivo, beneficiários, linhas, valor total. |

---

### ═══════════════════════════════════════
### ETAPA 7 — RETORNO BANCÁRIO
### ═══════════════════════════════════════

**Status: ✅ OPERACIONAL**

#### Infraestrutura:

| Componente | Arquivo | Status |
|---|---|---|
| Parser CNAB240 Retorno | `CNAB240BBReader.ts` | ✅ |
| Serviço de Conciliação | `cnabRetorno.service.ts` | ✅ |
| Tela UI | `RetornoBancario.tsx` (38KB) | ✅ |
| Histórico | `HistoricoRemessas.tsx` | ✅ |

#### Findings — Etapa 7:

| # | Severidade | Descrição |
|---|---|---|
| E7.1 | ✅ OK | `cnabRetorno.service.ts` (18KB) — lógica de conciliação implementada. |
| E7.2 | ⚠️ Regular | `marcarComoPago()` foi desabilitado com throw explícito: "Pagamento manual desabilitado: o lote de diaristas só pode virar PAGO após retorno bancário conciliado." — Correto por design, garante integridade. |

---

### ═══════════════════════════════════════
### ETAPA 8 — KPIs E RELATÓRIOS
### ═══════════════════════════════════════

**Status: ✅ OPERACIONAL**

#### Dashboard (`Dashboard.tsx` — 55KB):

```
Fontes de dados:
- OperacaoService.getAll()
- CustoExtraOperacionalService.getAll()
- ConsolidadoService (métricas consolidadas)
- processarOperacao() (cálculos financeiros)

KPIs:
- Total operações por mês
- Resumo financeiro
- Auditoria de competência
- Relatórios rápidos
```

#### Relatórios:

| Módulo | Arquivo | Status |
|---|---|---|
| Hub de Relatórios | `RelatoriosHub.tsx` | ✅ |
| Detalhe | `RelatorioDetalhe.tsx` | ✅ |
| Agendamentos | `Agendamentos.tsx` | ✅ |
| Layouts Exportação | `LayoutsExportacao.tsx` | ✅ |
| Integração Contábil | `IntegracaoContabil.tsx` | ✅ |
| Logs Integração | `LogsIntegracao.tsx` | ✅ |

---

### ═══════════════════════════════════════
### ETAPA 9 — LOGS E AUDITORIA
### ═══════════════════════════════════════

**Status: ✅ OPERACIONAL**

#### Mecanismos de Auditoria:

| Mecanismo | Onde | Status |
|---|---|---|
| Logs de fechamento diaristas | `diaristas_logs_fechamento` | ✅ Insert em cada ação (fechar, validar, reabrir, editar, CNAB) |
| Logs RH/Financeiro | `lotes_historico` via `appendLoteHistorico()` | ✅ |
| Auditoria de Governança | `Auditoria.tsx` + `AuditoriaService` | ✅ |
| Pipeline visual | `OperationalPipelineContext.tsx` — 1233 linhas com 11 builders de pipeline | ✅ |
| Automação operacional | `AutomacaoOperacional.tsx` | ✅ |
| Exportação trilha de auditoria | `exportarAuditoriaXlsx()` no `RhDiaristasPainel` | ✅ |

#### Findings — Etapa 9:

| # | Severidade | Descrição |
|---|---|---|
| E9.1 | ✅ OK | Logs de diaristas incluem: tenant_id, empresa_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim, motivo. |
| E9.2 | ✅ OK | Edição admin captura snapshot pré-mutação direto do DB (nunca do cache). |
| E9.3 | ✅ OK | Agrupamento inteligente de logs (mesma ação, mesmo usuário, mesmo período, dentro de 5 minutos). |

---

## 3. PIPELINE CONTEXT — GOVERNANÇA VISUAL

### `OperationalPipelineContext.tsx` (1233 linhas)

#### Builders de Pipeline Implementados:

| Builder | Fluxo | Steps |
|---|---|---|
| `buildFolhaVariavelPipeline` | CLT/Ponto | importacao → processamento_rh → banco_horas → aprovacao → remessa → retorno |
| `buildOperationalStagePipeline` | Estágios operacionais | cadastros → processamento_rh → banco_horas → fechamento_mensal |
| `buildOperationalStageReviewPipeline` | Revisão de estágio | cadastros → processamento_rh → banco_horas → fechamento_mensal → central_financeira |
| `buildBancoHorasRhValidationPipeline` | BH + RH | operacional → processamento → validacao_rh → aprovacao → remessa → retorno |
| `buildDiaristasPipeline` | Diaristas | lancamento → fechamento → validacao_rh → financeiro → remessa → concluido |
| `buildDiaristasDevolvidoPipeline` | Devolução diaristas | (devolvido com motivo) |
| `buildOperacaoVolumePipeline` | Operação por volume | lancamento → validacao_rh → aprovacao_financeiro → fechamento → cnab → conciliacao |
| `buildCustosExtrasPipeline` | Custos extras | lancamento → validacao_rh → aprovacao_financeiro → fechamento → cnab → conciliacao |
| `buildServicosExtrasPipeline` | Serviços extras | lancamento → validacao_rh → aprovacao_financeiro → pagamento → cnab → conciliacao |
| `buildOperationalFailurePipeline` | Falha operacional | (failure state) |

**Status: ✅ COMPLETO — Todos os fluxos operacionais possuem pipeline visual.**

---

## 4. PONTOS DE ATENÇÃO E RISCOS

### Riscos Identificados:

| # | Categoria | Risco | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | **Consistência** | `base.service.ts` tem 4915 linhas — arquivo monolítico | Manutenção difícil, risco de regressão | Refatorar em módulos separados (fase futura) |
| R2 | **Atomicidade** | Bypass de financeiro em `validarMutation` faz 3 updates separados (lote + lançamentos + log) sem transaction | Race condition possível | Migrar para RPC SECURITY DEFINER |
| R3 | **Cache** | TanStack Query com `staleTime: 5min` + `refetchOnWindowFocus: false` | Dados podem ficar desatualizados | Invalidação explícita funciona; considerar reduzir staleTime para operacional |
| R4 | **Schema** | `tipo_fechamento` comentado no `fecharPeriodo()` — coluna planejada mas não existe no banco | Sem distinção entre fechamento operacional vs administrativo persistida | Criar migration para adicionar coluna |
| R5 | **Pagamento manual** | `marcarComoPago()` desabilitado com throw — correto por design | Nenhum: força retorno bancário conciliado | ✅ Intencional |

---

## 5. CHECKLIST GLOBAL DE VALIDAÇÃO

| Item | Status |
|---|---|
| Nenhuma tela quebra sem dados | ✅ Todos os queries têm fallback `?? []` ou `.catch()` |
| Nenhum fluxo gera erro silencioso | ✅ Erros propagados via toast + console.error |
| Nenhum formulário falha silenciosamente | ✅ Mutations têm onError com toast |
| Nenhum modal trava | ✅ Estados controlados com useState |
| Nenhuma API falha sem tratamento | ✅ Todos os services têm try/catch + throw |
| Nenhum componente depende de mock | ✅ Dados reais via Supabase |
| Nenhum estado fica indefinido | ✅ Defaults definidos em useState |
| Pipeline visual completo | ✅ 11 builders cobrindo todos os fluxos |
| Auditoria rastreável | ✅ Logs em cada ação |
| CNAB com validação bancária | ✅ Bloqueia se dados incompletos |
| Retorno bancário implementado | ✅ Parser + conciliação |

---

## 6. CLASSIFICAÇÃO GERAL

### Status Geral: ✅ ESTÁVEL COM RESSALVAS MÍNIMAS

O ERP Orbe está em estado funcional e operacional para a esteira completa:

```
ENCARREGADO → RH → FINANCEIRO → FECHAMENTO → CNAB → RETORNO → CONCILIAÇÃO → KPIs → AUDITORIA
```

### Ressalvas:

1. **R2 — Atomicidade no bypass financeiro**: Operação não-atômica no `validarMutation` quando `enviar_financeiro === false`. Recomendação: criar RPC `validar_e_pular_financeiro_diaristas()` que faça lote + lançamentos + log em uma transaction.

2. **R4 — Campo `tipo_fechamento` pendente**: Adiar para próxima migration consolidada.

3. **R1 — Monolito `base.service.ts`**: Não afeta funcionalidade, mas compromete manutenibilidade. Plano de modularização como tarefa futura.

---

## 7. PRÓXIMOS PASSOS RECOMENDADOS

### Prioridade Alta:
- [ ] Criar RPC para bypass financeiro atômico (R2)

### Prioridade Média:
- [ ] Adicionar coluna `tipo_fechamento` na migration de diaristas (R4)
- [ ] Considerar reduzir `staleTime` para módulos operacionais (R3)

### Prioridade Baixa:
- [ ] Modularizar `base.service.ts` em arquivos separados (R1)
- [ ] Adicionar joins no `LancamentoDiaristaService.getByPeriodo()` para trazer nome da empresa (E1.1)

---

*Relatório gerado em 2026-05-27T20:29:00-03:00*
*Auditor: Antigravity — Sistema de Auditoria Operacional ERP Orbe*
