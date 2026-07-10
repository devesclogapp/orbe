# Auditoria Arquitetural — Domínio: INTERMITENTES
**Data**: 2026-07-10 | **Fase**: 09 | **Etapa**: 2

---

## 1. Mapa Completo de Arquivos

### 1.1 Frontend

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `src/pages/Operacional/IntermitentesRecebidos.tsx` | Página | Captura dos lançamentos vindos do Tio Digital. KPIs, filtros e "Fechar Período". |
| `src/components/operacoes/IntermitentesTableBlock.tsx` | Componente | Tabela de detalhes de cada lançamento. |
| `src/pages/Rh/AprovacoesRh.tsx` | Página | Fila unificada de aprovação RH — inclui lotes INTERMITENTE. |
| `src/pages/CentralFinanceira.tsx` | Página | Central financeira — sem referência direta a intermitentes (usa view unificada). |
| `src/pages/CentralBancaria.tsx` | Página | Bancário — sem referência direta (compartilhado via cnab_retorno). |

### 1.2 Services

| Arquivo | Responsabilidade |
|---|---|
| `src/services/domain/intermitentes.service.ts` | Toda a lógica de lotes: fecharPeriodo, validarLote, aprovarFinanceiro, devolverLote, reabrirLote, gerarCNABParaLote |
| `src/services/domain/aprovacoes.service.ts` | Consulta `vw_aprovacoes_rh` com suporte à filtragem por tipo INTERMITENTE |
| `src/services/cnab/cnabRetorno.service.ts` | Carrega faturas de intermitentes via `intermitentes_lote_id` (linha 496) e propaga para os itens de retorno |
| `src/services/cnab/cnabConciliacao.service.ts` | **Executa baixa automática** atualizando `status_pipeline=PAGO` nos lançamentos e `status=PAGO` no lote |
| `src/services/cnab/cnabRemessaArquivo.service.ts` | Registra o arquivo de remessa CNAB com vínculo `intermitentes_lote_id` |

### 1.3 Edge Functions

| Função | Responsabilidade |
|---|---|
| `supabase/functions/importar-intermitentes-tio/` | Ingestão via Tio Digital. Lookup CPF→Matrícula→Nome, idempotência por unique index |

### 1.4 Banco de Dados (Tabelas)

| Tabela | Responsabilidade |
|---|---|
| `lancamentos_intermitentes` | Registros individuais por colaborador/data/convocação |
| `intermitentes_lotes_fechamento` | Lotes de fechamento agrupados para RH→Financeiro→CNAB |
| `cnab_remessas_arquivos` | `intermitentes_lote_id` presente (migration 20260618) |
| `cnab_retorno_itens` | `intermitentes_lote_id` presente (migration 20260619) |
| `historico_importacoes` | Registra cada importação da Edge Function |

### 1.5 Views e RPCs

| Objeto | Responsabilidade |
|---|---|
| `vw_aprovacoes_rh` | View unificada de aprovações — inclui `intermitentes_lotes_fechamento` (UNION ALL, linha 114-131) |

### 1.6 RLS e Índices

- `lancamentos_intermitentes`: RLS com política `USING(true)` para authenticated — **sem isolamento por tenant** ⚠️
- `intermitentes_lotes_fechamento`: RLS correta com `USING(tenant_id = current_tenant_id())` ✅
- Indices de idempotência: `unique_intermitente_com_colab` e `unique_intermitente_sem_colab` ✅

---

## 2. Pipeline Técnico Real

```
Tio Digital (CSV/JSON)
    ↓
Edge Function: importar-intermitentes-tio
    ├── Auth: service_role (bypass RLS)
    ├── Idempotência: unique index + map existente
    ├── Lookup: CPF → Matrícula → Nome
    ├── Fallback empresa: departamento
    └── Registro em historico_importacoes

    ↓
lancamentos_intermitentes [status_pipeline = 'RECEBIDO']

    ↓
IntermitentesRecebidos.tsx
    └── "Fechar Período" → IntermitentesLoteService.fecharPeriodo()
        ├── Cria intermitentes_lotes_fechamento [AGUARDANDO_VALIDACAO_RH]
        └── Lançamentos → [EM_ANALISE_RH]

    ↓
AprovacoesRh.tsx (via vw_aprovacoes_rh)
    └── aprovarMutation tipo=INTERMITENTE 
        └── IntermitentesLoteService.validarLote(item.id) ← ⚠️ BUG: item.id é o ID DO LOTE, mas…
            ├── Lote → [VALIDADO_RH]
            └── Lançamentos → [APROVADO_RH]
    └── devolverMutation tipo=INTERMITENTE
        └── IntermitentesLoteService.devolverLote(item.id, msg)
            ├── Lote → [DEVOLVIDO]
            └── Lançamentos → [DEVOLVIDO]

    ↓
Financeiro (não localizado fluxo específico para aprovarFinanceiro de intermitentes)
    └── IntermitentesLoteService.aprovarFinanceiro()
        ├── Lote → [FECHADO_FINANCEIRO]
        └── Lançamentos → [ENVIADO_FINANCEIRO]

    ↓
IntermitentesLoteService.gerarCNABParaLote()
    ├── Valida status = FECHADO_FINANCEIRO ou AGUARDANDO_PAGAMENTO
    ├── Agrega valores por colaborador
    ├── Busca dados bancários em colaboradores
    ├── Gera CNAB240BB
    ├── CnabRemessaArquivoService.registrar() → cnab_remessas_arquivos (intermitentes_lote_id = loteId)
    └── Lote → [CNAB_GERADO]

    ↓
RetornoBancario: CnabRetornoService.processarArquivo()
    ├── Localiza remessa por sequencial + banco
    ├── Carrega lançamentos de intermitentes (via intermitentes_lote_id)
    ├── Constrói "faturas virtuais" (sem tabela faturas, usa lancamentos_intermitentes)
    └── Persiste cnab_retorno_itens (intermitentes_lote_id populado)

    ↓
CnabConciliacaoService.processarBaixaAutomatica() — chamado automaticamente em seguida
    ├── Agrupa por intermitentes_lote_id
    ├── Lançamentos pagos → status_pipeline = 'PAGO'
    └── Se todos pagos sem divergência → Lote → [PAGO]
```

---

## 3. Lacunas da Imersão — Status Revisado

| # | Lacuna Original | Confirmada? | Detalhe |
|---|---|---|---|
| 1 | Status `PAGO` nunca atingido | **DERRUBADA** ✅ | `CnabConciliacaoService` seta PAGO nos lançamentos e no lote (linhas 96-111) |
| 2 | `cnabRetorno` e `cnabConciliacao` sem `intermitentes_lote_id` | **DERRUBADA** ✅ | Ambos implementam o fluxo. Retorno carrega e conciliação seta PAGO |
| 3 | `AprovacoesRh.tsx` sem tratamento de intermitentes | **DERRUBADA** ✅ | Linha 246 trata `INTERMITENTE` com `validarLote` e `devolverLote` |

---

## 4. Novos Riscos Identificados na Auditoria

### 🔴 RISCO CRÍTICO 1 — RLS da tabela `lancamentos_intermitentes` sem isolamento por tenant

A migration `20260615175900` define:
```sql
CREATE POLICY "Acesso total autenticado para lancamentos_intermitentes"
ON public.lancamentos_intermitentes FOR ALL TO authenticated USING (true);
```
**Sem filtro por `tenant_id`**. Um usuário autenticado de qualquer tenant pode ler/escrever dados de outros tenants.

---

### 🔴 RISCO CRÍTICO 2 — `status_pipeline` de `lancamentos_intermitentes` não aceita `'PAGO'`

O CHECK constraint na tabela define:
```sql
CHECK (status_pipeline IN ('RECEBIDO', 'EM_ANALISE_RH', 'APROVADO_RH', 'DEVOLVIDO', 'ENVIADO_FINANCEIRO'))
```
**`'PAGO'` não está no enum do banco.** O `CnabConciliacaoService` tenta fazer:
```ts
.update({ status_pipeline: 'PAGO' })
```
Essa operação **falha silenciosamente** (sem throw, apenas `console.warn`) e o lote **nunca chega a PAGO**.

---

### 🔴 RISCO CRÍTICO 3 — `cpf_colaborador` não existe em `lancamentos_intermitentes`

No `cnabRetorno.service.ts` linha 509:
```ts
.select('colaborador_id, nome_colaborador, cpf_colaborador, total')
```
A tabela `lancamentos_intermitentes` **não tem coluna `cpf_colaborador`** (verificada na migration). Essa coluna é inexistente, tornando o matching por CPF no retorno ineficaz.

---

### 🟡 RISCO MÉDIO 4 — `vw_aprovacoes_rh` expõe lotes com `raw_lote_id = NULL` para INTERMITENTE

Na view (linha 129):
```sql
NULL::uuid AS raw_lote_id
```
Quando `AprovacoesRh.tsx` executa `validarLote(item.id)`, o `item.id` é o ID do lote de intermitentes (correto — pois a linha SELECT usa `il.id`). Isso funciona. Porém, a view não expõe o `id` dos lançamentos individuais, tornando impossível aprovações granulares por colaborador.

---

### 🟡 RISCO MÉDIO 5 — Integração Financeira (`aprovarFinanceiro`) sem tela dedicada

O método `aprovarFinanceiro()` existe no service, mas não há evidência de qual tela dispara essa ação para os lotes de intermitentes. Nos diaristas, existe um fluxo financeiro explícito. Para intermitentes, o caminho de VALIDADO_RH → FECHADO_FINANCEIRO não possui uma tela identificada.

---

### 🟢 RISCO BAIXO 6 — Auditoria de transições sem logs formais

As transições de status no `IntermitentesLoteService` (validarLote, devolverLote, aprovarFinanceiro) não chamam `log_audit` RPC, ao contrário do que acontece no retorno bancário. Menor rastreabilidade nos passos intermediários.

---

## 5. Integrações Confirmadas

| Integração | Status |
|---|---|
| Tio Digital → Edge Function → lancamentos_intermitentes | ✅ Implementada |
| Fechar Período → Lote (AGUARDANDO_VALIDACAO_RH) | ✅ Implementada |
| Aprovação RH via AprovacoesRh.tsx | ✅ Implementada |
| Devolução RH | ✅ Implementada |
| CNAB240 (geração) | ✅ Implementada |
| Retorno Bancário → carregarFaturasRelacionadas | ✅ Implementada (com bug CPF) |
| Conciliação → status PAGO | ❌ Bloqueada pelo CHECK constraint |
| Aprovação Financeiro → tela | ❌ Não localizada |

---

## 6. Classificação dos Riscos

| # | Risco | Gravidade | Impacto |
|---|---|---|---|
| 1 | RLS sem isolamento de tenant em `lancamentos_intermitentes` | 🔴 Crítico | Vazamento de dados entre tenants |
| 2 | `status_pipeline` sem enum `'PAGO'` → CHECK constraint falha | 🔴 Crítico | Lotes jamais chegam a PAGO; conciliação quebrada |
| 3 | `cpf_colaborador` inexistente no schema | 🔴 Crítico | Matching bancário por CPF ineficaz |
| 4 | `raw_lote_id = NULL` para INTERMITENTE na view | 🟡 Médio | Sem impacto no fluxo principal (usa `item.id`) |
| 5 | Aprovação Financeira sem tela identificada | 🟡 Médio | Bloqueia CNAB para o fluxo Financeiro → Intermitente |
| 6 | Ausência de `log_audit` nas transições de lote | 🟢 Baixo | Menor rastreabilidade |

---

## 7. Recomendação de Próxima Etapa

**Não iniciar a homologação funcional E2E** até que os 3 riscos críticos sejam endereçados.

**Etapa 3 — Mapeamento do Pipeline** pode ser realizada em paralelo com a elaboração do Plano de Correção para os 3 riscos críticos identificados.

**Após correção**: Executar homologação funcional com cenário:
1. Importar via Edge Function → verificar idempotência
2. Fechar período → validar lote
3. Aprovar RH → Aprovar Financeiro (identificar/criar tela)
4. Gerar CNAB → verificar arquivo
5. Importar retorno bancário → verificar status PAGO

### Veredito Preliminar da Etapa 2

> O domínio Intermitentes possui arquitetura **parcialmente implementada**. O esqueleto do ciclo completo existe, mas há **3 bugs críticos** que impedem o pipeline de concluir corretamente. O mais grave é a violação do CHECK constraint que impede qualquer lote de atingir o status `PAGO`.
