# Mapeamento do Pipeline — Domínio: INTERMITENTES
**Data**: 2026-07-10 | **Fase**: 09 | **Etapa**: 3
**Status pós-correção**: Correções críticas aplicadas via `20260710000001_intermitentes_correcoes_criticas.sql`

---

## Visão Geral do Pipeline

```
Tio Digital (sistema externo de ponto)
    ↓  POST /functions/v1/importar-intermitentes-tio
Edge Function: importar-intermitentes-tio
    ↓  INSERT/UPSERT → lancamentos_intermitentes [RECEBIDO]
Tela: IntermitentesRecebidos.tsx — Operacional
    ↓  IntermitentesLoteService.fecharPeriodo()
intermitentes_lotes_fechamento [AGUARDANDO_VALIDACAO_RH]
    ↓  AprovacoesRh.tsx — Fila INTERMITENTE
    ↓  IntermitentesLoteService.validarLote()
intermitentes_lotes_fechamento [VALIDADO_RH]
    ↓  CentralFinanceira.tsx — aba "Lotes do RH"
    ↓  IntermitentesLoteService.aprovarFinanceiro()
intermitentes_lotes_fechamento [FECHADO_FINANCEIRO]
    ↓  CentralBancaria.tsx — aba CNAB
    ↓  IntermitentesLoteService.gerarCNABParaLote()
cnab_remessas_arquivos (intermitentes_lote_id = loteId)
intermitentes_lotes_fechamento [CNAB_GERADO]
    ↓  Banco Digital (envio do arquivo)
    ↓  CnabRetornoService.processarArquivo() — Upload .ret
cnab_retorno_itens (intermitentes_lote_id = loteId)
    ↓  CnabConciliacaoService.processarBaixaAutomatica()
lancamentos_intermitentes [PAGO] ← ✅ status agora válido no CHECK
intermitentes_lotes_fechamento [PAGO]
```

---

## ETAPA 1 — Ingestão (Tio Digital → Edge Function)

### Dados de Entrada

| Campo (payload Tio Digital) | Campo normalizado | Salvo em `lancamentos_intermitentes` |
|---|---|---|
| `Colaborador` / `colaborador_nome` | `nome_colaborador` | ✅ |
| `CPF` / `cpf` | → resolve cadastro | `cpf_colaborador` ✅ **novo** |
| `Matricula` | lookup → `colaborador_id` | `colaborador_id` |
| `Data` / `DATA` / `data_periodo` | `data_referencia` (DATE) | ✅ |
| `Convocacao` | `convocacao` | ✅ |
| `Cargo` | `cargo` | ✅ |
| `Departamento`/`Unidade` | `departamento` + lookup empresa | `empresa_id` |
| `H. Trabalhadas` | `horas_trabalhadas` (NUMERIC 10,2) | ✅ |
| `H. Normais` | `horas_normais` (NUMERIC 10,2) | ✅ |
| `HE 50%` | `he_50` (NUMERIC 10,2) | ✅ |
| `HE 100%` | `he_100` (NUMERIC 10,2) | ✅ |
| `H. Noturna` | `hora_noturna` (NUMERIC 10,2) | ✅ |
| `Total` | `total` (NUMERIC 10,2) | ✅ |
| — | `origem` = `tio_digital` | ✅ |
| — | `status_pipeline` = `RECEBIDO` | ✅ |
| — | `tenant_id` | via header / payload |
| — | `importacao_id` | FK para `historico_importacoes` |

### Idempotência
- Unique index condicional por `(tenant_id, colaborador_id, data_referencia, convocacao)` when `colaborador_id IS NOT NULL`
- Fallback: `(tenant_id, nome_colaborador, data_referencia, convocacao)` when `colaborador_id IS NULL`
- Reimportação: registros com `lote_fechamento_id = null` e status `RECEBIDO` são **atualizados** (upsert por PK)
- Registros em `EM_ANALISE_RH` ou posteriores são **ignorados** na reimportação

### RLS (pós-correção)
- Autenticados: isolamento por `tenant_id = current_tenant_id()` ✅
- `service_role` (Edge Function): bypassa RLS — importação continua funcionando ✅

---

## ETAPA 2 — Tela de Captura (IntermitentesRecebidos.tsx)

### O que é exibido
- Todos os lançamentos do mês/ano selecionado
- KPIs: Colaboradores únicos, Registros total, H. Trabalhadas, H. Normais, HE 50%, HE 100%, H. Noturna, Valor
- Busca por colaborador, cargo, convocação
- Filtro por empresa

### Botão "Fechar Período"
- Disponível somente se houver registros `status_pipeline = RECEBIDO` sem `lote_fechamento_id`
- Chama: `IntermitentesLoteService.fecharPeriodo(empresaId, periodoInicio, periodoFim, fechadoPor)`

### O que acontece no fecharPeriodo()
1. Busca lançamentos com `status_pipeline = RECEBIDO` e `lote_fechamento_id IS NULL` no período
2. Cria `intermitentes_lotes_fechamento` com `status = AGUARDANDO_VALIDACAO_RH`
3. Atualiza lançamentos: `lote_fechamento_id = lote.id`, `status_pipeline = EM_ANALISE_RH`

---

## ETAPA 3 — Aprovação RH (AprovacoesRh.tsx)

### Como aparece na fila
- Via `vw_aprovacoes_rh` — UNION ALL de `intermitentes_lotes_fechamento` (linha 114)
- `tipo = 'INTERMITENTE'`
- `raw_status = il.status` → mapeado para `situacao`
- `AGUARDANDO_VALIDACAO_RH` → exibido como "Em análise"

### Ações
| Ação | Chamada | Resultado |
|---|---|---|
| Validar | `IntermitentesLoteService.validarLote(item.id, userId)` | Lote → `VALIDADO_RH`, lançamentos → `APROVADO_RH` |
| Devolver | `IntermitentesLoteService.devolverLote(item.id, msg)` | Lote → `DEVOLVIDO`, lançamentos → `DEVOLVIDO` |
| Reabrir (na tela de captura) | `IntermitentesLoteService.reabrirLote(id)` | Lote → `CANCELADO`, lançamentos → `RECEBIDO`, `lote_fechamento_id = null` |

---

## ETAPA 4 — Aprovação Financeira (CentralFinanceira.tsx)

### Como aparece
- Query: `IntermitentesLoteService.getByEmpresaParaFinanceiro(empresaId)` — filtra por `status IN (VALIDADO_RH, FECHADO_FINANCEIRO, ...)`
- Formatado como `tipo = "INTERMITENTES"` e incluído em `lotesRh` (array unificado com diaristas e RH)
- Visível na aba **"Lotes do RH"** da Central Financeira

### Ações
| Ação | Chamada | Resultado |
|---|---|---|
| Aprovar | `IntermitentesLoteService.aprovarFinanceiro(id, userId)` | Lote → `FECHADO_FINANCEIRO`, lançamentos → `ENVIADO_FINANCEIRO` |
| Devolver | `IntermitentesLoteService.devolverLote(id, motivo)` | Lote → `DEVOLVIDO`, lançamentos → `DEVOLVIDO` |

---

## ETAPA 5 — Geração de CNAB (IntermitentesLoteService.gerarCNABParaLote)

### Pré-condições
- Status do lote: `FECHADO_FINANCEIRO` ou `AGUARDANDO_PAGAMENTO`

### Fluxo interno
1. Busca lote: `intermitentes_lotes_fechamento`
2. Busca lançamentos: `lancamentos_intermitentes WHERE lote_fechamento_id = loteId`
3. **Agrega por colaborador**: soma `total` por `colaborador_id` ou `nome_colaborador`
4. Busca dados bancários: `colaboradores (banco_codigo, agencia, conta, digito_conta, tipo_conta, cpf)`
5. Valida campos obrigatórios por beneficiário (banco, agência, conta, dígito, CPF)
6. Monta empresa remetente a partir de `contas_bancarias_empresa`
7. Gera arquivo CNAB240 posicional via `gerarCNAB240BB()`
8. Registra em `cnab_remessas_arquivos` com `intermitentes_lote_id = loteId`
9. Faz download do arquivo no browser
10. Atualiza lote: `status = CNAB_GERADO`

### Campos do CNAB por beneficiário
| Campo | Fonte |
|---|---|
| Nome | `colaboradores.nome_completo` ou `nome_colaborador` |
| CPF | `colaboradores.cpf` (normalizado, sem caracteres) |
| Valor | Soma dos `total` dos lançamentos do colaborador |
| Banco/Agência/Conta/Dígito | `colaboradores.*` |
| Tipo de conta | `colaboradores.tipo_conta` (corrente/poupança) |
| Data pagamento | `now()` |

---

## ETAPA 6 — Retorno Bancário (CnabRetornoService.processarArquivo)

### Como localiza o lote de intermitentes
1. Parser lê o arquivo `.ret` do banco
2. Localiza a remessa por sequencial + banco: `cnab_remessas_arquivos`
3. Se `remessaRelacionada.intermitentes_lote_id` estiver preenchido → entra no branch de intermitentes

### Como constrói as "faturas virtuais" (sem tabela `faturas`)
1. Busca lote: `intermitentes_lotes_fechamento (empresa_id, competencia)`
2. Busca lançamentos: `lancamentos_intermitentes SELECT(colaborador_id, nome_colaborador, cpf_colaborador ✅, total)`
3. Agrega por `cpf_colaborador` → fallback `nome_colaborador`
4. Monta objetos compatíveis com `FaturaComColaborador`

### Matching do detalhe do retorno
| Critério | Como |
|---|---|
| `seu_numero_prefixo` | Prefixo `PGT{fatura.id[:8]}` |
| `nosso_numero` | Campo nosso_numero da fatura |
| `documento + valor` | CPF + valor exato |
| `documento` | CPF apenas |
| `valor` | Valor exato (fallback) |

### O que é persistido
- `cnab_retorno_arquivos`: cabeçalho do retorno
- `cnab_retorno_itens`: um item por detalhe do arquivo — com `intermitentes_lote_id` preenchido

---

## ETAPA 7 — Conciliação Automática (CnabConciliacaoService.processarBaixaAutomatica)

### Chamado automaticamente logo após o `processarArquivo`

### Fluxo para intermitentes
1. Agrupa itens de retorno por `intermitentes_lote_id`
2. Para cada lote, filtra itens com `status = 'pago'`
3. Atualiza `lancamentos_intermitentes`: `status_pipeline = 'PAGO'` — ✅ agora válido no CHECK
4. Verifica se todos os lançamentos do lote estão `PAGO`
5. Se sim e sem divergências → atualiza lote: `status = 'PAGO'`
6. Atualiza `cnab_retorno_itens`: `status_conciliacao = 'conciliado'`

---

## Mapa de Status Completo

### `lancamentos_intermitentes.status_pipeline`

```
RECEBIDO ──────────────────────────────────────── Importação via Edge Function
    ↓ fecharPeriodo()
EM_ANALISE_RH ─────────────────────────────────── Aguardando validação RH
    ↓ validarLote()         ↓ devolverLote()
APROVADO_RH                DEVOLVIDO ──────────── RH devolveu
    ↓ aprovarFinanceiro()
ENVIADO_FINANCEIRO ──────────────────────────────  Financeiro aprovou
    ↓ (CNAB gerado + retorno)
PAGO ✅ ────────────────────────────────────────── Conciliação bancária
```

### `intermitentes_lotes_fechamento.status`

```
AGUARDANDO_VALIDACAO_RH → VALIDADO_RH → FECHADO_FINANCEIRO → CNAB_GERADO → PAGO
                        ↘ DEVOLVIDO
                        ↗ CANCELADO (via reabrirLote)
```

---

## Mapa de Telas e Services

| Etapa | Tela | Service | Banco |
|---|---|---|---|
| Importação | — (API externa) | Edge Function | `lancamentos_intermitentes`, `historico_importacoes` |
| Captura/Visualização | `IntermitentesRecebidos.tsx` | `IntermitentesLoteService.fecharPeriodo()` | `intermitentes_lotes_fechamento` |
| Aprovação RH | `AprovacoesRh.tsx` | `validarLote()` / `devolverLote()` | atualiza lote + lançamentos |
| Aprovação Financeira | `CentralFinanceira.tsx` | `aprovarFinanceiro()` / `devolverLote()` | atualiza lote + lançamentos |
| CNAB (geração) | `CentralBancaria.tsx` | `gerarCNABParaLote()` | `cnab_remessas_arquivos` |
| Retorno Bancário | `CentralBancaria.tsx` | `CnabRetornoService.processarArquivo()` | `cnab_retorno_itens` |
| Conciliação | (automática) | `CnabConciliacaoService.processarBaixaAutomatica()` | lançamentos + lote → PAGO |

---

## Confirmação pós-correção

| Item | Antes | Depois |
|---|---|---|
| RLS `lancamentos_intermitentes` | `USING(true)` — cross-tenant ❌ | 4 policies com `tenant_id = current_tenant_id()` ✅ |
| `status_pipeline = 'PAGO'` | CHECK rejeita ❌ | CHECK aceita ✅ |
| `cpf_colaborador` | Coluna inexistente ❌ | Coluna adicionada, backfill aplicado, índice criado ✅ |
| Edge Function grava CPF | Não gravava ❌ | Grava `cpf_colaborador` priorizando cadastro ✅ |
| `cnabConciliacao` — erros silenciosos | `await` sem `.error` ❌ | Erros logados explicitamente ✅ |
| `aprovarFinanceiro` sem tela | Suposto gap ❌ | Já integrado na CentralFinanceira linha 371 ✅ |

---

## Observações para a Homologação Funcional

1. **N8N**: Não existe workflow N8N para intermitentes. A automação é um POST direto do Tio Digital para a Edge Function. Na fase de automação, o N8N pode ser usado como intermediário (recebe webhook do Tio Digital → formata payload → chama a Edge Function), mas hoje **não existe** esse elo.

2. **Rota no App.tsx**: `IntermitentesRecebidos.tsx` não aparece diretamente no `App.tsx` — verificar se está acessível via menu/sidebar antes da homologação funcional.

3. **CNAB**: O `gerarCNABParaLote` usa a condição `FECHADO_FINANCEIRO OR AGUARDANDO_PAGAMENTO` — o status `AGUARDANDO_PAGAMENTO` nunca é setado no ciclo atual, então a geração CNAB depende exclusivamente do `FECHADO_FINANCEIRO`.

4. **Matching do retorno**: O matching por `cpf_colaborador` agora será efetivo via `documento_favorecido → colaboradores.cpf`, melhorando a taxa de conciliação automática.
