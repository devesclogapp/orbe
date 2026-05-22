# Validação da Skill CLT — Orbe ERP
> Referência: `skill-fluxo-clt-pontos-banco-de-horas-financeiro.md`
> Data: 2026-05-22

---

## Status Geral

| Etapa do Pipeline | Status |
|---|:---:|
| 1. Pontos Recebidos | ✅ Conforme |
| 2. Processamento RH | ✅ Conforme |
| 3. Banco de Horas | ⚠️ Parcial |
| 4. Fechamento RH | ⚠️ Parcial |
| 5. Central Financeira | ⚠️ Parcial |
| 6. Central Bancária / CNAB | ✅ Existe |
| 7. Retorno Bancário | ✅ Existe |
| 8. Dashboard | ⚠️ Parcial |

**Classificação global: ⚠️ PARCIAL — Base sólida, gaps nas etapas de passagem RH → Financeiro**

---

## Validação por Seção da Skill

---

### Seção 1 — Objetivo do Fluxo

```
Ponto → Processamento RH → Banco de Horas → Fechamento RH →
Financeiro → CNAB → Pagamento → Dashboard
```

| Item | Implementado? | Arquivo |
|---|:---:|---|
| Pipeline existe de ponta a ponta | ⚠️ | Parcialmente conectado |
| Rastreabilidade por etapa | ✅ | `banco_horas_eventos`, `processamento_rh_logs` |
| Auditabilidade | ✅ | `JustificationModal`, `admin_override` |
| Responsabilidade setorial | ✅ | RBAC implementado por role |
| Reflexo financeiro correto | ⚠️ | Banco de horas → Financeiro CLT não automatizado |

---

### Seção 2 — Input Oficial

| Campo obrigatório da skill | Presente em `registros_ponto`? |
|---|:---:|
| colaborador | ✅ `colaborador_id` / `nome_colaborador` |
| matrícula | ✅ `matricula_colaborador` |
| data | ✅ `data` |
| entrada | ✅ `entrada` |
| saída | ✅ `saida` |
| competência YYYY-MM | ✅ `competencia` |
| empresa | ✅ `empresa_id` / `nome_empresa` |

Origens mapeadas: `importacao`, `rhid_api`, `manual`, `biometrico` → ✅ Conforme

---

### Seção 5.1 — Tela: PONTOS RECEBIDOS

| Requisito da skill | Status | Arquivo |
|---|:---:|---|
| Importar planilha | ✅ | `Pontos.tsx` |
| Visualizar status | ✅ | `Pontos.tsx` |
| Visualizar competência | ✅ | `Pontos.tsx` |
| Visualizar origem | ✅ | `ImportacoesTimeline.tsx` |
| Visualizar processamento RH | ⚠️ | Link direto para ProcessamentoRH não implementado |
| **NÃO** processar RH | ✅ | Não há lógica de cálculo em `Pontos.tsx` |
| **NÃO** compensar saldo | ✅ | Não implementado nesta tela |
| **NÃO** aprovar financeiro | ✅ | Não implementado nesta tela |

---

### Seção 5.2 — Tela: PROCESSAMENTO RH

| Requisito da skill | Status | Arquivo |
|---|:---:|---|
| Cálculo diário de horas | ✅ | `rhProcessing.service.ts` → `calculateWorkedMinutes` |
| Aplicar regras e tolerâncias | ✅ | `calculateCompensation()` com `tolerancia_atraso`, `tolerancia_hora_extra` |
| Saldo do banco de horas | ✅ | `banco_horas_saldos` atualizado a cada processamento |
| Extras e faltas | ✅ | `minutosExtra`, `minutosDebito`, `valorFalta` calculados |
| Inconsistências detectadas | ✅ | 11 tipos mapeados em `buildInconsistencias()` |
| Compensações | ✅ | Drawer → Aba "Ajustes RH" → ação `compensacao` |
| Ajustes manuais | ✅ | `credito_manual`, `debito_manual` com justificativa |
| Reprocessamento | ✅ | `reprocessRhPeriod()` implementado |
| **Drawer operacional obrigatório** | ✅ | Sheet lateral com 3 abas |
| — Aba Visão Geral | ✅ | |
| — Aba Ajustes RH | ✅ | |
| — Aba Histórico/Auditoria | ✅ | |
| Justificativa obrigatória | ✅ | `JustificationModal` integrado |
| Usuário executor registrado | ✅ | `executado_por` em `banco_horas_eventos` |
| Timestamp das ações | ✅ | `created_at` em todos os eventos |
| Tolerância explicável no drawer | ✅ | `buildRuleExplanation()` mostra breakdown completo |
| **NÃO** aprovar pagamento | ✅ | Pagamento só é sinalizado para financeiro futuro |
| **NÃO** gerar CNAB | ✅ | Não há chamada CNAB nesta tela |

---

### Seção 5.3 — Tela: BANCO DE HORAS

| Requisito da skill | Status | Arquivo |
|---|:---:|---|
| Saldo acumulado | ✅ | `PainelGeral.tsx` + `banco_horas_saldos` |
| Créditos acumulados | ✅ | `horas_positivas_minutos` |
| Impacto financeiro | ⚠️ | Exibe saldo mas sem conversão monetária direta |
| Risco financeiro | ⚠️ | Parcial — sem alerta de vencimento por risco |
| Fechamento RH visível | ⚠️ | Link para `Fechamento.tsx` não direto desta tela |
| **NÃO** editar saldo individual | ✅ | Edições só em `ProcessamentoRH.tsx` |
| **NÃO** compensar individualmente | ✅ | Ação exclusiva do ProcessamentoRH |

---

### Seção 5.4 — Tela: FECHAMENTO RH

| Requisito da skill | Status | Arquivo |
|---|:---:|---|
| Tela de fechamento existe | ✅ | `Fechamento.tsx` |
| Consolidar banco RH antes de fechar | ⚠️ | `Fechamento.tsx` usa `CicloOperacional` (semanal), não `fechamento_mensal` CLT |
| Travar alterações após fechar | ✅ | `CicloOperacional.status = 'fechado'` bloqueia edições |
| Liberar para financeiro | ✅ | Fluxo: fechar → validar RH → validar Financeiro |
| Atualizar pipeline visual | ✅ | `OperationalPipelineModal` integrado |
| **NÃO** gerar pagamento | ✅ | Não há geração de pagamento nesta tela |
| **NÃO** gerar CNAB | ✅ | Não há geração de CNAB nesta tela |
| Justificativa para ações | ✅ | `JustificationModal` em rejeição e reabertura |

> ⚠️ **GAP IDENTIFICADO:** `Fechamento.tsx` fecha `CicloOperacional` (semanas operacionais de produção/logística). O `fechamento_mensal` da tabela CLT (vinculado a `banco_horas_saldos`) ainda não está conectado ao fluxo desta tela. São dois ciclos separados que precisam ser explicitamente linkados ou unificados.

---

### Seção 5.5 — CENTRAL FINANCEIRA

| Requisito da skill | Status | Arquivo |
|---|:---:|---|
| Receber competência RH validada | ⚠️ | `CentralFinanceira.tsx` existe mas não consome `fechamento_mensal` CLT |
| Visualizar origem RH | ⚠️ | Não há seção específica de Banco de Horas CLT no financeiro |
| Aprovar lote financeiro | ⚠️ | Aprovação financeira de ciclos via `Fechamento.tsx`, não via Central Financeira para CLT |
| Preparar bancário | ⚠️ | Conexão CLT → CNAB não está explicitamente implementada |

> ⚠️ **GAP IDENTIFICADO:** A `CentralFinanceira.tsx` concentra operações logísticas (diaristas, operações). O **lote financeiro CLT** (banco de horas → folha variável) não passa por ela de forma explícita.

---

### Seção 5.6 — CENTRAL BANCÁRIA / CNAB

| Requisito da skill | Status | Arquivo |
|---|:---:|---|
| Gerar remessa bancária | ✅ | `RemessaCNAB.tsx` |
| CNAB240 | ✅ | `CentralBancaria.tsx` |
| Retorno bancário | ✅ | `RetornoBancario.tsx` |
| Bloquear divergência financeira | ✅ | Validações implementadas |
| Bloquear favorecido inválido | ✅ | Validações de dados bancários |
| Bloquear conta inválida | ✅ | Campos de conta/agência validados |

> ⚠️ **GAP IDENTIFICADO:** O CNAB CLT (folha variável) não está claramente separado do CNAB de diaristas. A `CentralBancariaDiaristas.tsx` existe separada, mas não há `CentralBancariaCLT.tsx` ou rota equivalente explícita.

---

### Seção 6 — Pipeline Visual

| Requisito da skill | Status |
|---|:---:|
| `OperationalPipelineModal` em todas as etapas | ✅ |
| Estado `pendente` | ✅ |
| Estado `em_andamento` | ✅ |
| Estado `concluido` | ✅ |
| Estado `bloqueado` | ✅ |
| Estado `devolvido` | ✅ |
| Estado `cancelado` | ✅ |
| Sistema conduz o usuário | ✅ |
| Auto-trigger após conclusão de etapa | ✅ `useOperationalPipelineAutoTrigger` |

---

### Seção 7 — Regras de Cálculo

| Requisito | Status | Detalhe |
|---|:---:|---|
| Tolerância de atraso | ✅ | `tolerancia_atraso` em minutos (banco_horas_regras) |
| Tolerância de hora extra | ✅ | `tolerancia_hora_extra` em minutos |
| Jornada configurável | ✅ | `carga_horaria_diaria` / `jornada_contratada` |
| Tolerância explicável no drawer | ✅ | `buildRuleExplanation()` com breakdown completo |
| Exemplo da skill (8h jornada, 20min excedente, 10min tolerância → 10min banco) | ✅ | Algoritmo correto em `calculateCompensation()` |

---

### Seção 8 — Regras Proibidas

| Regra Proibida | Situação |
|---|:---:|
| RH aprovar pagamento | ✅ Respeitado |
| RH gerar CNAB | ✅ Respeitado |
| Recalcular financeiro no front-end | ⚠️ Parcial — `buildRuleExplanation()` recalcula para exibição (não persistência), aceitável |
| Editar saldo individual fora do ProcessamentoRH | ✅ Respeitado |
| Múltiplos fechamentos | ✅ Constraint único por `(tenant_id, colaborador_id, mes, ano)` |
| Múltiplos bancos de horas | ✅ Constraint único por `(tenant_id, colaborador_id)` |

---

### Seção 9 — Reflexos Sistêmicos

| Ação → Impacta | Implementado? |
|---|:---:|
| Processamento RH → Banco de Horas | ✅ `banco_horas_eventos` + `banco_horas_saldos` |
| Ajuste RH → Banco de Horas | ✅ Ações no drawer atualizam eventos e saldos |
| Banco de Horas → Fechamento RH | ⚠️ `fechamento_mensal` existe mas não conectado ao fluxo visual |
| Fechamento RH → Financeiro | ⚠️ `CicloOperacional` valida RH → Fin, mas CLT separado |
| Financeiro → CNAB | ⚠️ CLT → CNAB não explicitamente conectado |
| CNAB → Dashboard | ⚠️ Dashboard CLT não consome dados de banco de horas |

---

### Seção 10 — Tratamento de Falhas

| Tipo de Falha | Implementado? |
|---|:---:|
| Falha RH — colaborador inválido | ✅ `colaborador_nao_cadastrado` detectado e registrado |
| Falha RH — jornada inválida | ✅ `jornada_invalida` detectado |
| Falha RH — regra ausente | ✅ `regra_inexistente` detectado, fallback criado automaticamente |
| Bloquear fechamento com inconsistências | ✅ `criticalBlockers` em `Fechamento.tsx` |
| Falha Financeira — impedir aprovação | ✅ Botão bloqueado com `financialFlowBlockers` |
| Falha CNAB — bloquear remessa | ✅ Validações em `CentralBancaria.tsx` |

---

### Seção 11 — Dashboard

| Requisito | Status |
|---|:---:|
| Consome somente dados consolidados | ⚠️ Dashboard geral não consome especificamente banco de horas CLT |
| Somente competências fechadas | ⚠️ Não verificado para CLT |
| Nunca recalcular regras RH no front | ✅ Dashboard não recalcula |
| KPIs de banco de horas no dashboard | ❌ Não visíveis no dashboard principal |

---

## Resumo dos Gaps por Prioridade

### 🔴 Críticos (bloqueiam o pipeline)

| # | Gap | Impacto |
|---|---|---|
| 1 | `fechamento_mensal` CLT não está conectado ao fluxo visual do pipeline | Impossível fechar competência RH formalmente e liberar ao Financeiro |
| 2 | Banco de Horas → Central Financeira: lote CLT não passa pela Central Financeira | Financeiro não recebe os valores de banco de horas para aprovação |
| 3 | CLT → CNAB: não há rota/fluxo explícito de remessa para folha variável CLT | Pagamento CLT não pode ser gerado via CNAB |

### ⚠️ Importantes (afetam conformidade com a skill)

| # | Gap | Impacto |
|---|---|---|
| 4 | `Fechamento.tsx` opera sobre `CicloOperacional` (semanal operacional), não sobre competência mensal CLT | Semântica diferente do esperado pela skill |
| 5 | Dashboard principal não exibe KPIs de banco de horas CLT | Visão estratégica incompleta |
| 6 | `PainelGeral.tsx` não exibe impacto financeiro em R$ do banco de horas | Risco financeiro não quantificado visualmente |
| 7 | Link direto Pontos Recebidos → Processamento RH não implementado | UX do pipeline não conduz o usuário automaticamente |

### ✅ Conforme — O que já funciona

- Motor de processamento RH completo (`rhProcessing.service.ts`)
- Cálculo de horas, tolerâncias, extras, faltas
- Banco de horas eventos e saldos atualizados corretamente
- Drawer operacional do ProcessamentoRH com 3 abas
- Todos os ajustes RH (crédito, débito, compensação, pagamento, folga, zerar)
- Justificativa obrigatória em toda ação sensível
- Governança admin com override auditável
- Reprocessamento individual
- 11 tipos de inconsistências mapeados e tratados
- Pipeline visual `OperationalPipelineModal` integrado
- Separação diaristas vs. CLT garantida
- Central Bancária / CNAB / Retorno implementados
- Tratamento de falhas em todas as etapas

---

## Critérios de Aceite da Skill (Seção 13)

| Critério | Status |
|---|:---:|
| O ponto entra corretamente | ✅ |
| O RH consegue operar individualmente | ✅ |
| O banco consolida corretamente | ✅ |
| O fechamento libera financeiro | ⚠️ (parcial — ciclos operacionais, não CLT) |
| O financeiro gera CNAB | ⚠️ (existe mas sem conexão explícita ao CLT) |
| O dashboard reflete o resultado | ❌ |
| O pipeline conduz o usuário | ⚠️ (parcial — falta link automático entre etapas CLT) |
| Não existem ações duplicadas | ✅ |
| Não existem responsabilidades ambíguas | ✅ |

---

## Próximos Passos Recomendados

1. **[CRÍTICO]** Criar a tela/seção de **Fechamento Mensal CLT** que consume `fechamento_mensal` e conecta ao pipeline visual → libera para Central Financeira
2. **[CRÍTICO]** Criar o fluxo CLT na **Central Financeira**: receber lotes de banco de horas aprovados e gerar CNAB de folha variável
3. **[IMPORTANTE]** Adicionar KPIs de banco de horas CLT ao **Dashboard** principal
4. **[IMPORTANTE]** Adicionar impacto financeiro em R$ ao `PainelGeral.tsx` (Banco de Horas)
5. **[MELHORIA]** Adicionar botão/link de navegação em `Pontos.tsx` → `ProcessamentoRH.tsx` para condução do pipeline

---

*Validação executada em análise estática do código. 2026-05-22*
