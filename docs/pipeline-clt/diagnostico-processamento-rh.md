# Diagnóstico — Pipeline CLT: Processamento RH
> Gerado em: 2026-05-22
> Contexto: Integração RHiD → Orbe via n8n + Edge Function já implementada. Dados chegam na `registros_ponto` com status `PENDENTE_PROCESSAMENTO`.

---

## 1. A tela de Processamento RH já existe?

**SIM — e é completa.**

Localização: `src/pages/BancoHoras/ProcessamentoRH.tsx` (~2861 linhas)

### O que a tela já mostra e faz:

| Recurso | Status |
|---|---|
| Filtros por competência (mês/ano) e empresa | ✅ Implementado |
| Lista de colaboradores agrupados com saldo do período | ✅ Implementado |
| KPIs: processados, inconsistentes, pendentes, horas positivas/negativas | ✅ Implementado |
| Drawer lateral por colaborador | ✅ Implementado |
| Aba "Visão Geral" com detalhamento do ponto por dia | ✅ Implementado |
| Aba "Ajustes RH" com ações: crédito manual, débito, compensação, pagamento, folga, zerar saldo | ✅ Implementado |
| Aba "Histórico / Auditoria" com trilha de eventos | ✅ Implementado |
| Botão "Processar competência" com modal de confirmação | ✅ Implementado |
| Reprocessamento individual por colaborador | ✅ Implementado |
| Visualização da regra aplicada por dia | ✅ Implementado |
| Cálculo de bônus de explicação da regra (breakdown) | ✅ Implementado |
| Exibição de inconsistências por colaborador / dia | ✅ Implementado |
| Pipeline operacional integrado (`OperationalPipelineModal`) | ✅ Implementado |
| Alerta de colaboradores com cadastro pendente | ✅ Implementado |
| Separação diaristas vs. CLT (diaristas são bloqueados) | ✅ Implementado |
| Governança admin com justificativa obrigatória | ✅ Implementado |
| Auto-seleção do mês mais recente com dados | ✅ Implementado |

> ⚠️ Nota: Existe também uma outra página em `src/pages/Processamento.tsx` — essa é uma tela **legada/genérica** que chama a Edge Function `process-day` e trabalha com operações logísticas, **não** com o pipeline CLT de banco de horas. Não confundir com a tela correta.

---

## 2. Edge Function ou lógica de cálculo de ponto já implementada?

**SIM — é um motor completo em TypeScript no frontend.**

### Arquivo principal:
`src/services/rhProcessing.service.ts` (~1659 linhas)

### O que já está implementado:

#### Funções de cálculo

| Função | O que faz |
|---|---|
| `calculateWorkedMinutes(ponto)` | Calcula minutos trabalhados: `saida - entrada - almoco` |
| `calculateCompensation(params)` | Aplica tolerâncias e calcula saldo do dia, extras, débitos, valores |
| `parseImportedDurationMinutes(value)` | Parseia strings no formato `HH:MM` da planilha/API |
| `buildInconsistencias(params)` | Gera lista de inconsistências detectadas |
| `resolveOperationalEventType(ponto, saldoDia)` | Classifica o evento: `hora_extra`, `falta`, `atraso` |

#### Fluxo de `processRhPeriod` (função principal)

```
1. Carrega registros_ponto com status PENDENTE_PROCESSAMENTO do período
2. Para cada registro:
   a. Resolve empresa (por ID ou por nome normalizado)
   b. Resolve colaborador (por ID, matrícula, CPF ou nome)
   c. Se empresa/colaborador não encontrado → cria automaticamente (pré-cadastro provisional)
   d. Valida se colaborador está apto (exclui diaristas, bloqueados, provisórios)
   e. Resolve regra de banco de horas (por empresa ou regra padrão global)
   f. Calcula horas trabalhadas e saldo do dia
   g. Aplica tolerâncias (atraso, hora extra)
   h. Salva banco de horas evento (banco_horas_eventos)
   i. Atualiza saldo acumulado (banco_horas_saldos)
   j. Marca registro como PROCESSADO ou INCONSISTENTE
   k. Salva inconsistências detectadas
3. Salva log de processamento (processamento_rh_logs)
4. Retorna ProcessResult com totais
```

#### Edge Function legada:
`supabase/functions/process-day/` — Esta função processa **operações logísticas** (não pontos CLT). Não é utilizada pelo pipeline de banco de horas.

---

## 3. Estrutura completa de tabelas relevantes

### `registros_ponto` — Tabela principal (entrada do pipeline)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | Multi-tenant |
| `empresa_id` | UUID | FK → empresas |
| `colaborador_id` | UUID | FK → colaboradores |
| `data` | DATE | Data do registro |
| `competencia` | TEXT | Formato `YYYY-MM` |
| `entrada` | TEXT | Horário de entrada `HH:MM` |
| `saida_almoco` | TEXT | Saída para almoço `HH:MM` |
| `retorno_almoco` | TEXT | Retorno do almoço `HH:MM` |
| `saida` | TEXT | Horário de saída `HH:MM` |
| `horas_trabalhadas` | TEXT | Valor importado da planilha/API |
| `hora_extra` | TEXT | Hora extra importada |
| `falta` | TEXT | Falta importada |
| `atraso` | TEXT | Atraso importado |
| `status` | TEXT | Status do registro bruto (PENDENTE_PROCESSAMENTO, INCONSISTENTE) |
| `status_processamento` | TEXT | `PENDENTE_PROCESSAMENTO` \| `PROCESSADO` \| `INCONSISTENTE` |
| `processado_em` | TIMESTAMPTZ | Timestamp do processamento |
| `horas_calculadas` | TEXT | Horas calculadas pelo motor (HH:MM) |
| `saldo_dia` | INTEGER | Saldo em minutos do dia |
| `saldo_acumulado_minutos` | INTEGER | Saldo acumulado após o dia |
| `minutos_atraso` | INTEGER | Minutos de atraso calculados |
| `minutos_extra` | INTEGER | Minutos de hora extra calculados |
| `valor_dia` | NUMERIC | Valor financeiro do dia |
| `valor_hora_extra` | NUMERIC | Valor das extras |
| `valor_atraso` | NUMERIC | Valor de desconto por atraso |
| `valor_falta` | NUMERIC | Valor de desconto por falta |
| `jornada_calculada` | NUMERIC | Jornada utilizada no cálculo |
| `regra_aplicada` | TEXT | Nome da regra aplicada |
| `inconsistencias` | TEXT | Inconsistências em texto |
| `inconsistencias_count` | INTEGER | Quantidade de inconsistências |
| `nome_colaborador` | TEXT | Nome importado |
| `matricula_colaborador` | TEXT | Matrícula importada |
| `cpf_colaborador` | TEXT | CPF importado |
| `cargo_colaborador` | TEXT | Cargo importado |
| `origem` | TEXT | `importacao` \| `manual` \| `biometrico` \| `rhid_api` |
| `importacao_id` | UUID | FK → historico_importacoes |
| `coletor_id` | UUID | FK → coletores_ponto |
| `drive_file_id` | TEXT | ID do arquivo no Google Drive |
| `observacoes` | TEXT | Observações livres |
| `created_at` | TIMESTAMPTZ | Criação |

---

### `banco_horas_saldos` — Saldo acumulado por colaborador

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | Multi-tenant |
| `empresa_id` | UUID | FK → empresas |
| `colaborador_id` | UUID | FK → colaboradores |
| `saldo_atual_minutos` | INTEGER | Saldo total acumulado |
| `horas_positivas_minutos` | INTEGER | Total de créditos acumulados |
| `horas_negativas_minutos` | INTEGER | Total de débitos acumulados |
| `ultima_atualizacao` | TIMESTAMPTZ | Último processamento |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auditoria |

Constraint: `UNIQUE (tenant_id, colaborador_id)`

---

### `banco_horas_eventos` — Extrato individual de eventos

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | Multi-tenant |
| `colaborador_id` | UUID | FK → colaboradores |
| `empresa_id` | UUID | FK → empresas |
| `registro_ponto_id` | UUID | FK → registros_ponto |
| `tipo_evento` / `tipo` | TEXT | `hora_extra`, `atraso`, `falta`, `compensacao`, `pagamento`, `folga`, `ajuste_manual` |
| `quantidade_minutos` / `minutos` | INTEGER | Minutos (positivo = crédito, negativo = débito) |
| `data_evento` / `data` | DATE | Data do evento |
| `data_vencimento` | DATE | Vencimento do saldo |
| `saldo_anterior` | INTEGER | Saldo antes do evento |
| `saldo_atual` | INTEGER | Saldo após o evento |
| `observacao` / `descricao` | TEXT | Justificativa |
| `origem` | TEXT | `processamento_rh`, `ajuste_manual`, `compensacao` |
| `status` | TEXT | `ativo`, `compensado`, `pago`, `cancelado` |
| `executado_por` | UUID | Usuário executor |
| `created_at` | TIMESTAMPTZ | Auditoria |

Constraint único: `(registro_ponto_id, origem)` WHERE `origem = 'processamento_rh'`

---

### `processamento_rh_logs` — Histórico de execuções

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | Multi-tenant |
| `empresa_id` | UUID | FK → empresas |
| `usuario_id` | UUID | Executor |
| `periodo_mes` | INTEGER | Mês processado |
| `periodo_ano` | INTEGER | Ano processado |
| `total_registros` | INTEGER | Total de pontos |
| `total_processados` | INTEGER | Processados com sucesso |
| `total_inconsistencias` | INTEGER | Inconsistências detectadas |
| `total_horas_positivas` / `total_creditos` | INTEGER | Créditos em minutos |
| `total_horas_negativas` / `total_debitos` | INTEGER | Débitos em minutos |
| `reprocessado` | BOOLEAN | Se foi reprocessamento |
| `registros_limpados` | INTEGER | Registros limpos no reprocessamento |
| `duracao_ms` | INTEGER | Tempo de execução |
| `executado_em` | TIMESTAMPTZ | Timestamp de execução |

---

### `processamento_rh_inconsistencias` — Inconsistências detectadas

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | Multi-tenant |
| `registro_ponto_id` | UUID | FK → registros_ponto |
| `colaborador_id` | UUID | FK → colaboradores |
| `empresa_id` | UUID | FK → empresas |
| `tipo` | TEXT | Tipo da inconsistência (ver abaixo) |
| `descricao` | TEXT | Descrição legível |
| `gravidade` | TEXT | `baixa` \| `media` \| `alta` \| `critica` |
| `status` | TEXT | `aberta` \| `resolvida` \| `ignorada` |
| `resolvida` | BOOLEAN | Se foi resolvida |
| `resolvida_por` | UUID | Usuário que resolveu |
| `resolvida_em` | TIMESTAMPTZ | Data da resolução |
| `observacao` | TEXT | Observação do RH |
| `created_at` | TIMESTAMPTZ | Detecção |

**Tipos de inconsistência mapeados:**
- `empresa_nao_cadastrada`
- `colaborador_nao_cadastrado`
- `regra_inexistente`
- `entrada_ausente`
- `saida_ausente`
- `saida_menor_entrada`
- `intervalo_invalido`
- `jornada_invalida`
- `horas_divergentes`
- `falta`
- `atraso_excessivo`

---

### `fechamento_mensal` — Consolidado por colaborador/período

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | Multi-tenant |
| `colaborador_id` | UUID | FK → colaboradores |
| `empresa_id` | UUID | FK → empresas |
| `mes` / `ano` | INTEGER | Competência |
| `dias_trabalhados` | INTEGER | Dias trabalhados |
| `horas_trabalhadas` | NUMERIC | Total de horas |
| `horas_extras` | NUMERIC | Total de extras |
| `horas_faltas` | NUMERIC | Total de faltas |
| `banco_horas_credito` / `debito` / `saldo` | NUMERIC | Banco de horas |
| `valor_hora_extra` / `valor_faltas` / `valor_total` | NUMERIC | Valores financeiros |
| `situacao` | TEXT | `pendente` \| `fechado` \| ... |

Constraint único: `(tenant_id, colaborador_id, mes, ano)`

---

## 4. Tabela de regras/tolerâncias

**SIM — existe a tabela `banco_horas_regras`.**

### Campos relevantes para cálculo:

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `carga_horaria_diaria` | NUMERIC | 8.00 | Carga horária diária em horas |
| `jornada_contratada` | NUMERIC | 8.00 | Jornada contratada |
| `tolerancia_atraso` | INTEGER | 5 min | Tolerância de atraso em minutos |
| `tolerancia_hora_extra` | INTEGER | 0 min | Tolerância de hora extra em minutos |
| `limite_diario_banco` | INTEGER | 480 min | Limite diário de BH |
| `validade_horas` | INTEGER | 60 dias | Validade das horas |
| `prazo_compensacao_dias` | INTEGER | — | Prazo para compensação |
| `regra_compensacao` | TEXT | `automatico` | `automatico` \| `manual` \| `transferencia` |
| `regra_vencimento` | TEXT | `acumula` | `acumula` \| `zera` \| `expira` |
| `bh_ativo` | BOOLEAN | true | Se banco de horas está ativo |
| `empresa_id` | UUID | null | Se null = regra global/fallback |

**Lógica de resolução de regras** (em `rhProcessing.service.ts`):
1. Busca regra ativa para `empresa_id` do ponto
2. Se não encontrar → busca regra global (`empresa_id IS NULL`)
3. Se não encontrar → cria automaticamente "Regra padrão automática 8h"

---

## 5. Estado atual do `status_processamento` e o que deve acontecer

### Estado atual nos registros vindos do RHiD:

```
status = "PENDENTE_PROCESSAMENTO" (campo legado/bruto)
status_processamento = "PENDENTE_PROCESSAMENTO"
origem = "rhid_api"
```

### Ciclo dos status:

```
PENDENTE_PROCESSAMENTO
       ↓
  [Motor RH executa]
       ↓
    ┌──────────────────────────────────────────────┐
    │                                              │
    ▼                                              ▼
PROCESSADO                               INCONSISTENTE
(saldo gerado,                  (inconsistência registrada,
banco_horas_eventos criado)      RH deve revisar manualmente)
```

### Para avançar no pipeline, o que deve acontecer:

1. **RH acessa** `src/pages/BancoHoras/ProcessamentoRH.tsx`
2. **Seleciona competência** (mês que o RHiD alimentou)
3. **Clica em "Processar competência"** → chama `processRhPeriod()`
4. O motor processa todos os registros `PENDENTE_PROCESSAMENTO` do período:
   - Resolve empresa e colaborador
   - Aplica regra de banco de horas
   - Calcula saldo do dia
   - Gera evento em `banco_horas_eventos`
   - Atualiza `banco_horas_saldos`
   - Marca `status_processamento = PROCESSADO` ou `INCONSISTENTE`
5. **RH revisa inconsistências** no painel e resolve/justifica
6. Quando pronto → **avança para Fechamento RH** (próxima etapa do pipeline)

---

## 6. Gaps identificados / Próximos passos

### ✅ O que já funciona bem

| Item | Avaliação |
|---|---|
| Tela ProcessamentoRH completa | ✅ Pronta |
| Motor de cálculo (tolerâncias, extras, faltas) | ✅ Pronto |
| Banco de horas eventos e saldos | ✅ Pronto |
| Inconsistências detalhadas com gravidade | ✅ Pronto |
| Ajustes manuais RH (crédito, débito, compensação, pagamento, folga) | ✅ Pronto |
| Reprocessamento individual | ✅ Pronto |
| Governança admin com justificativa | ✅ Pronto |
| Dados do RHiD chegam no formato esperado | ✅ Compatível |

### ⚠️ O que precisa validação/atenção

| Item | Ação necessária |
|---|---|
| Campo `origem = 'rhid_api'` nos registros | Confirmar se a tela filtra corretamente por origem (atualmente filtra só por `status_processamento`) |
| Campos `hora_extra`, `falta`, `atraso` vindos do RHiD são strings `HH:MM` | Motor usa `parseImportedDurationMinutes()` — verificar se formato está exatamente `HH:MM` |
| `colaborador_id` preenchido pelo RHiD | Se sim, o motor usa diretamente. Se não, resolve por matrícula/CPF/nome |
| `empresa_id` preenchido pelo RHiD | Se sim, o motor usa diretamente. Se não, resolve por nome |
| Regras de banco de horas configuradas para as empresas | Sem regra → motor cria "Regra padrão 8h" automaticamente (não ideal para produção) |
| Tabela `fechamento_mensal` | Existe mas ainda não integrada ao pipeline de avanço via UI |

### 🔴 O que ainda não existe

| Item | Status |
|---|---|
| Tela de Fechamento RH (UI para encerrar competência e enviar ao financeiro) | ❌ Não implementado como tela separada |
| RPC/função que marca competência como fechada e trava edições | ❌ Verificar se existe |
| Pipeline modal redirecionando ProcessamentoRH → Fechamento → Financeiro | ⚠️ Parcial |

---

## Resumo Executivo

O pipeline CLT está **substancialmente implementado** na camada de Pontos e Processamento RH. A integração com o RHiD alimenta corretamente a tabela `registros_ponto` com `status_processamento = PENDENTE_PROCESSAMENTO`.

O próximo passo operacional é:
1. RH acessar `ProcessamentoRH.tsx` e executar o processamento da competência
2. Revisar inconsistências
3. Implementar/conectar o **Fechamento RH** para encerrar a competência e liberar ao financeiro

---

*Documento gerado em análise estática do código. Para atualizar, reexecutar varredura nas migrações e serviços.*
