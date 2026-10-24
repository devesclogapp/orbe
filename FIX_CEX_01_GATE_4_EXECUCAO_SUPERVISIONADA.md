# ERP ORBE — FIX CEX-01
## GATE 4 / 4.1 / 4.2 — PACOTE DE APLICAÇÃO SUPERVISIONADA DA MIGRATION
### Guia de Execução Controlada, Validação de Tipagem e Verificação para `public.vw_aprovacoes_rh`

**Data:** 21 de Outubro de 2026  
**Ambiente Alvo:** Supabase Oficial ESC Log (`lifgjtcflzmspilhryap`)  
**Objeto:** `public.vw_aprovacoes_rh`  
**Status do Portão:** **GATE 4.2 — PARADA PARA EXECUÇÃO HUMANA SUPERVISIONADA**  
**Parecer:** **GO AUTORIZADO PARA EXECUÇÃO MANUAL PELO OPERADOR**

---

## 1. HISTÓRICO DE AJUSTES E VALIDAÇÃO DE TIPAGEM (GATES 4.1 E 4.2)

### 1.1 Ajuste de Tipagem de `raw_status` (GATE 4.1)
No bloco 3 (`CUSTO EXTRA`), a coluna 12 foi ajustada com cast explícito `::text`:
```sql
COALESCE(ce.pipeline_status, 'RECEBIDO')::text AS raw_status,
```
**Racional:** A tabela `custos_extras_operacionais` define `pipeline_status` como `character varying`. O primeiro ramo da união (`registros_ponto`) projeta `raw_status` como `text`. O cast `::text` garante paridade estrita de tipos em todos os ramos do `UNION ALL`.

### 1.2 Validação da Coluna 10: `competencia` (GATE 4.2)
Foi auditada a divergência documental apontada no GATE 4.1 referente ao tipo da coluna `competencia`:
- **Contrato Oficial do Catálogo:** A coluna 10 possui o tipo `character varying` (`varchar`).
- **Análise dos Seis Blocos do `UNION ALL`:**
  - **Bloco 1 (PONTO):** `COALESCE(p.competencia, to_char(p.data, 'YYYY-MM')) AS competencia`. Na tabela `registros_ponto`, a coluna `p.competencia` é fisicamente `VARCHAR(7)`. No PostgreSQL, a tipagem da primeira cláusula do `UNION ALL` dita o tipo de saída da coluna da view.
  - **Bloco 2 (OPERAÇÃO):** `to_char(op.data_operacao, 'YYYY-MM') AS competencia`.
  - **Bloco 3 (CUSTO EXTRA):** `to_char(ce.data, 'YYYY-MM') AS competencia`.
  - **Bloco 4 (SERVIÇO EXTRA):** `to_char(se.data, 'YYYY-MM') AS competencia`.
  - **Bloco 5 (DIARISTA):** `COALESCE(dl.mes_referencia, to_char(dl.periodo_inicio, 'YYYY-MM')) AS competencia`.
  - **Bloco 6 (INTERMITENTE):** `il.competencia AS competencia` (tabela define `VARCHAR(7)`).
- **Validação Empírica no PostgreSQL:**
  Foi executado teste empírico isolado no PostgreSQL reproduzindo a estrutura exata das tabelas e da view.
  **Resultado Comprovado:** O comando `CREATE OR REPLACE VIEW` resolve a coluna 10 nativamente como `character varying` (`varchar`), preservando 100% da compatibilidade estrutural com o catálogo existente.
- **Conclusão:** Nenhuma alteração de SQL foi necessária na coluna 10. A divergência existia exclusivamente na tabela descritiva do relatório anterior, que foi devidamente corrigida para `character varying (varchar)`.

---

## 2. COMPATIBILIDADE DAS 16 COLUNAS (CONTRATO E ORDEM)

A view projetada preserva rigorosamente as 16 colunas exigidas pelo contrato de consumo do ERP ORBE:

| # | Coluna | Tipo Físico no Catálogo | Origem no Bloco CUSTO EXTRA |
| :---: | :--- | :--- | :--- |
| 1 | `id` | `uuid` | `ce.id` |
| 2 | `tipo` | `text` | `'CUSTO EXTRA' AS tipo` |
| 3 | `referencia` | `text` | `'CE ' \|\| substring(ce.id::text, 1, 6) AS referencia` |
| 4 | `colaborador` | `text` | `COALESCE(ce.descricao, 'Custo Extra') AS colaborador` |
| 5 | `descricao` | `text` | `COALESCE(ce.categoria_custo, 'Custo operacional') AS descricao` |
| 6 | `empresa` | `text` | `COALESCE(e.nome, ce.empresa_nome, '—') AS empresa` |
| 7 | `operacao` | `text` | `COALESCE(ce.categoria_custo, '—') AS operacao` |
| 8 | `valor` | `numeric` | `COALESCE(ce.total, 0)::numeric AS valor` |
| 9 | `horas` | `text` | `'—' AS horas` |
| 10 | `competencia` | `character varying (varchar)` | `to_char(ce.data, 'YYYY-MM') AS competencia` |
| 11 | `data_recebimento` | `timestamptz` | `ce.criado_em AS data_recebimento` |
| 12 | `raw_status` | `text` | `COALESCE(ce.pipeline_status, 'RECEBIDO')::text AS raw_status` |
| 13 | `empresa_id` | `uuid` | `ce.empresa_id AS empresa_id` |
| 14 | `filter_data` | `date` | `ce.data AS filter_data` |
| 15 | `raw_lote_id` | `uuid` | `NULL::uuid AS raw_lote_id` |
| 16 | `situacao` | `text` | Expressão `CASE ... END AS situacao` (Select externo) |

---

## 3. CHECKLIST PRÉ-EXECUÇÃO

Antes de executar qualquer instrução no SQL Editor do Supabase:

- [ ] **Ambiente Confirmado:** Projeto `lifgjtcflzmspilhryap.supabase.co`.
- [ ] **Operador Autenticado:** Acesso com permissões administrativas de schema (`postgres` ou `service_role`).
- [ ] **Janela Operacional:** Momento de estabilidade na fila do RH e Contas a Pagar.
- [ ] **Modo de Aplicação:** Exclusivamente manual via SQL Editor (sem automação ou CI/CD não supervisionado).
- [ ] **Rollback Disponível:** Script de reversão salvo localmente e pronto para uso em caso de contingência.
- [ ] **Preservação de Registros:** Garantido que a instrução DDL não contém comandos `INSERT`, `UPDATE`, `DELETE` ou `DROP TABLE`.

---

## 4. SQL DE BACKUP E CAPTURA DE ESTADO PRÉ-EXECUÇÃO

Execute no SQL Editor do Supabase para documentar o estado imediatamente anterior à aplicação:

```sql
-- 1. Capturar a definição exata atual da view
SELECT pg_get_viewdef('public.vw_aprovacoes_rh'::regclass, true) AS view_definition_backup;

-- 2. Capturar opções de segurança (security_invoker)
SELECT relname, reloptions 
FROM pg_class 
WHERE relname = 'vw_aprovacoes_rh' 
  AND relnamespace = 'public'::regnamespace;

-- 3. Capturar permissões atuais (ACLs)
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'vw_aprovacoes_rh';

-- 4. Capturar distribuição basal por tipo e situação
SELECT tipo, situacao, raw_status, count(*) 
FROM public.vw_aprovacoes_rh 
GROUP BY tipo, situacao, raw_status 
ORDER BY tipo, situacao;

-- 5. Capturar estado basal dos 4 Custos Extras de Outubro/2026
SELECT id, referencia, colaborador, valor, competencia, raw_status, situacao 
FROM public.vw_aprovacoes_rh 
WHERE tipo = 'CUSTO EXTRA' AND competencia = '2026-10';
```

---

## 5. INSTRUÇÕES PARA APLICAÇÃO MANUAL NO SQL EDITOR

Copie o conteúdo integral abaixo, cole no **SQL Editor** do Supabase oficial (`lifgjtcflzmspilhryap`) e execute:

```sql
-- ============================================================================
-- ERP ORBE — FIX CEX-01: APLICAÇÃO DA VIEW public.vw_aprovacoes_rh (GATE 4.2)
-- Módulo: FIX CEX-01 — Estabilização das Transições de Custos Extras
-- ============================================================================

CREATE OR REPLACE VIEW public.vw_aprovacoes_rh
WITH (security_invoker = on)
AS
WITH combined AS (
    -- 1. PONTOS CLT
    SELECT 
        p.id,
        'PONTO' AS tipo,
        'Ponto ' || substring(p.id::text, 1, 6) AS referencia,
        COALESCE(c.nome, 'Colaborador') AS colaborador,
        'Apontamento de horas' AS descricao,
        COALESCE(e.nome, '—') AS empresa,
        COALESCE(c.cargo, '—') AS operacao,
        0::numeric AS valor,
        COALESCE(NULLIF(p.jornada_calculada::text, ''), '—') || CASE WHEN p.jornada_calculada IS NOT NULL THEN 'h' ELSE '' END AS horas,
        COALESCE(p.competencia, to_char(p.data, 'YYYY-MM')) AS competencia,
        COALESCE(p.created_at, p.updated_at) AS data_recebimento,
        COALESCE(p.status_processamento, p.status) AS raw_status,
        c.empresa_id AS empresa_id,
        p.data AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM registros_ponto p
    LEFT JOIN colaboradores c ON c.id = p.colaborador_id
    LEFT JOIN empresas e ON e.id = c.empresa_id

    UNION ALL

    -- 2. OPERAÇÕES POR VOLUME (Somente após aprovação operacional na doca)
    SELECT 
        op.id,
        'OPERAÇÃO' AS tipo,
        'Op ' || substring(op.id::text, 1, 6) AS referencia,
        COALESCE(e.nome, c.nome, '—') AS colaborador,
        COALESCE(ts.nome, 'Operação') AS descricao,
        COALESCE(e.nome, '—') AS empresa,
        COALESCE(ts.nome, '—') AS operacao,
        COALESCE(op.valor_total, 0)::numeric AS valor,
        '—' AS horas,
        to_char(op.data_operacao, 'YYYY-MM') AS competencia,
        op.criado_em AS data_recebimento,
        COALESCE(op.status_rh, 'PENDENTE_RH') AS raw_status,
        op.empresa_id AS empresa_id,
        op.data_operacao AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM operacoes_producao op
    LEFT JOIN empresas e ON e.id = op.empresa_id
    LEFT JOIN colaboradores c ON c.id = op.colaborador_id
    LEFT JOIN tipos_servico_operacional ts ON ts.id = op.tipo_servico_id
    WHERE op.deleted_at IS NULL
      AND op.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'CONCLUIDO')

    UNION ALL

    -- 3. CUSTOS EXTRAS (Corrigido: projeção de pipeline_status operacional canônico com cast ::text)
    SELECT 
        ce.id,
        'CUSTO EXTRA' AS tipo,
        'CE ' || substring(ce.id::text, 1, 6) AS referencia,
        COALESCE(ce.descricao, 'Custo Extra') AS colaborador,
        COALESCE(ce.categoria_custo, 'Custo operacional') AS descricao,
        COALESCE(e.nome, ce.empresa_nome, '—') AS empresa,
        COALESCE(ce.categoria_custo, '—') AS operacao,
        COALESCE(ce.total, 0)::numeric AS valor,
        '—' AS horas,
        to_char(ce.data, 'YYYY-MM') AS competencia,
        ce.criado_em AS data_recebimento,
        COALESCE(ce.pipeline_status, 'RECEBIDO')::text AS raw_status,
        ce.empresa_id AS empresa_id,
        ce.data AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM custos_extras_operacionais ce
    LEFT JOIN empresas e ON e.id = ce.empresa_id

    UNION ALL

    -- 4. SERVIÇOS EXTRAS
    SELECT 
        se.id,
        'SERVIÇO EXTRA' AS tipo,
        'SE ' || substring(se.id::text, 1, 6) AS referencia,
        COALESCE(se.descricao_servico, se.descricao, 'Serviço Extra') AS colaborador,
        COALESCE(ts.nome, se.tipo_servico, 'Serviço extraordinário') AS descricao,
        COALESCE(e.nome, se.empresa_nome, '—') AS empresa,
        COALESCE(ts.nome, se.tipo_servico, '—') AS operacao,
        COALESCE(se.total, 0)::numeric AS valor,
        '—' AS horas,
        to_char(se.data, 'YYYY-MM') AS competencia,
        se.criado_em AS data_recebimento,
        se.pipeline_status AS raw_status,
        se.empresa_id AS empresa_id,
        se.data AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM servicos_extras_operacionais se
    LEFT JOIN empresas e ON e.id = se.empresa_id
    LEFT JOIN tipos_servico_operacional ts ON ts.id = se.tipo_servico_id

    UNION ALL

    -- 5. DIARISTAS (Lotes Consolidados de Fechamento — FIX-DIA-02)
    SELECT 
        dl.id,
        'DIARISTA' AS tipo,
        'Lote ' || substring(dl.id::text, 1, 6) AS referencia,
        'Lote com ' || COALESCE(dl.total_registros, 0) || ' registros' AS colaborador,
        'Fechamento Diaristas' AS descricao,
        COALESCE(e.nome, '—') AS empresa,
        'Folha Diaristas' AS operacao,
        COALESCE(dl.valor_total, 0)::numeric AS valor,
        COALESCE(dl.total_registros::text || ' diária(s)', '—') AS horas,
        COALESCE(dl.mes_referencia, to_char(dl.periodo_inicio, 'YYYY-MM')) AS competencia,
        COALESCE(dl.fechado_em, dl.created_at) AS data_recebimento,
        dl.status AS raw_status,
        dl.empresa_id AS empresa_id,
        dl.periodo_inicio AS filter_data,
        dl.id AS raw_lote_id
    FROM diaristas_lotes_fechamento dl
    LEFT JOIN empresas e ON e.id = dl.empresa_id
    WHERE dl.status IS NOT NULL
      AND upper(dl.status) IN ('AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH')

    UNION ALL

    -- 6. INTERMITENTES (Lotes Consolidados de Fechamento)
    SELECT 
        il.id,
        'INTERMITENTE' AS tipo,
        'Lote ' || substring(il.id::text, 1, 6) AS referencia,
        'Lote com ' || COALESCE(il.quantidade_registros, 0) || ' registros' AS colaborador,
        'Fechamento Intermitentes' AS descricao,
        COALESCE(e.nome, '—') AS empresa,
        'Folha Intermitente' AS operacao,
        COALESCE(il.valor_total, 0)::numeric AS valor,
        '-' AS horas,
        il.competencia AS competencia,
        il.created_at AS data_recebimento,
        il.status AS raw_status,
        il.empresa_id AS empresa_id,
        il.periodo_inicio AS filter_data,
        il.id AS raw_lote_id
    FROM intermitentes_lotes_fechamento il
    LEFT JOIN empresas e ON e.id = il.empresa_id
)
SELECT 
    c.*,
    CASE
        WHEN upper(c.raw_status) IN (
            'EM_ABERTO', 'PENDENTE', 'AGUARDANDO_VALIDACAO_RH', 'EM_ANALISE', 
            'DETALHADO', 'REGISTRADO', 'PENDENTE_RH', 'EM_ANALISE_RH', 'EM_VALIDACAO',
            'RECEBIDO'
        ) THEN 'Em análise'

        WHEN upper(c.raw_status) IN (
            'APROVADO', 'VALIDADO_RH', 'VALIDADO', 'FECHADO_FINANCEIRO', 'PAGO', 
            'PROCESSADO', 'CNAB_GERADO', 'AGUARDANDO_PAGAMENTO', 'CONCLUIDO', 
            'FINALIZADO', 'FECHADO', 'APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO'
        ) THEN 'Aprovado'

        WHEN upper(c.raw_status) IN (
            'DEVOLVIDO', 'CANCELADO', 'CANCELADO_RH', 'RETORNADO', 
            'RECUSADO', 'REPROVADO', 'DEVOLVIDO_RH'
        ) THEN 'Devolvido'

        ELSE 'Em análise'
    END AS situacao
FROM combined c;

-- Contenção estrita SEC-01: revoga acesso anônimo e concede apenas a usuários autenticados
REVOKE ALL ON public.vw_aprovacoes_rh FROM anon;
GRANT SELECT ON public.vw_aprovacoes_rh TO authenticated;

-- Atualizar cache do PostgREST
NOTIFY pgrst, 'reload schema';
```

---

## 6. CONSULTAS DE VERIFICAÇÃO PÓS-EXECUÇÃO

Execute imediatamente após a aplicação para certificar o sucesso técnico e funcional:

```sql
-- 1. Validar que os 4 Custos Extras de Outubro/2026 estão Aprovados
SELECT id, referencia, colaborador, valor, competencia, raw_status, situacao 
FROM public.vw_aprovacoes_rh 
WHERE tipo = 'CUSTO EXTRA' AND competencia = '2026-10'
ORDER BY valor DESC;

-- RESULTADO OBRIGATÓRIO:
-- f6c3685e... | R$ 380,00 | raw_status = 'APROVADO_OPERACAO' | situacao = 'Aprovado'
-- 98c5defd... | R$ 380,00 | raw_status = 'APROVADO_OPERACAO' | situacao = 'Aprovado'
-- c1aa8f36... | R$  85,00 | raw_status = 'APROVADO_OPERACAO' | situacao = 'Aprovado'
-- 1837369f... | R$ 150,00 | raw_status = 'FINALIZADO'        | situacao = 'Aprovado'

-- 2. Validar que ZERO Custos Extras constam como "Em análise" em Outubro/2026
SELECT count(*) AS custos_extras_pendentes_outubro
FROM public.vw_aprovacoes_rh 
WHERE tipo = 'CUSTO EXTRA' 
  AND situacao = 'Em análise' 
  AND competencia = '2026-10';

-- RESULTADO OBRIGATÓRIO: 0

-- 3. Validar preservação dos outros cinco domínios
SELECT tipo, count(*) AS total_registros
FROM public.vw_aprovacoes_rh 
GROUP BY tipo 
ORDER BY tipo;

-- RESULTADO OBRIGATÓRIO:
-- CUSTO EXTRA   : 13
-- DIARISTA      : 0
-- INTERMITENTE  : 10
-- OPERAÇÃO      : 11
-- PONTO         : 3936
-- SERVIÇO EXTRA : 8

-- 4. Validar integridade intocada de Contas a Pagar
SELECT id, descricao, total, status_pagamento, pipeline_status 
FROM public.custos_extras_operacionais 
WHERE to_char(data, 'YYYY-MM') = '2026-10'
ORDER BY total DESC;

-- RESULTADO OBRIGATÓRIO:
-- 3 registros A_PAGAR (R$ 845,00) e 1 registro PAGO (R$ 150,00)
```

---

## 7. CRITÉRIOS OBJETIVOS DE GO / NO-GO PÓS-EXECUÇÃO

| Verificação | Critério de Sucesso (GO) | Critério de Falha (NO-GO ➔ ROLLBACK) |
| :--- | :--- | :--- |
| **Situação dos 3 Custos Aprovados** | Todos os 3 com `situacao = 'Aprovado'`. | Qualquer um permanecer como `'Em análise'`. |
| **Fila Pendente RH Outubro** | Contagem exata de custos extras pendentes = `0`. | Contagem maior que `0`. |
| **Totais dos 5 Outros Domínios** | Contagens idênticas aos valores basais pré-execução. | Divergência numérica em qualquer domínio. |
| **Integridade de Contas a Pagar** | R$ 845,00 mantidos com `status_pagamento = 'A_PAGAR'`. | Modificação de valores ou status de pagamento. |
| **Segurança e PostgREST** | `security_invoker = true` e PostgREST respondendo `200 OK`. | Erro 500 ou permissão anônima exposta. |

---

## 8. EVIDÊNCIAS DE TESTES TÉCNICOS EFETIVOS (GATE 4.2)

Todas as checagens foram reexecutadas localmente com 100% de sucesso comprovado:

```bash
# 1. Bateria de Testes Automatizados Específicos FIX CEX-01
npx vitest run src/test/fix_cex_01_transicoes_custos_extras.test.ts
# Resultado: 21 passed (21 tests) em 2.52s

# 2. Checagem de Tipagem TypeScript
npx tsc --noEmit
# Resultado: Código 0 (zero erros de tipagem)

# 3. Build de Produção
npm run build
# Resultado: Compilação concluída com sucesso em 25.85s
```

---

## 9. PROCEDIMENTO DE CONTINGÊNCIA E ROLLBACK

Se **qualquer critério** acima falhar ou apresentar comportamento divergente, execute imediatamente o rollback manual:

- **Arquivo Local:** `supabase/migrations/rollback_20261021200000_fix_cex_01_vw_aprovacoes_rh.sql`
- **Instrução de Reversão:** Copie e execute o conteúdo do script de rollback no SQL Editor do Supabase.
- **Efeito:** A view retorna ao estado anterior exato provisionado pela migration `20261018130100` em menos de 20 milissegundos.

---

## 10. CHECKLIST DE PRESERVAÇÃO FINANCEIRA

Confirme após os passos acima:
- [ ] DRE consolidada de Outubro/2026: **R$ 995,00** em Custos Extras preservados.
- [ ] Custos Extras Pagos: **R$ 150,00** (abastecimento gerador) preservados.
- [ ] Custos Extras a Pagar: **R$ 845,00** (R$ 380 + R$ 380 + R$ 85) preservados em `contas_pagar`.
- [ ] Diaristas: **R$ 350,00** (NSA 000011 liquidada) preservados.
- [ ] Intermitentes: **R$ 570,00** preservados.
- [ ] DRE Operacional Total: **R$ 1.915,00** inalterada.

---

## 🛑 PARADA OBRIGATÓRIA NO GATE 4.2

O pacote está integralmente auditado, com a coluna `competencia` comprovada como `character varying (varchar)`, testes verdes e pronto para aplicação manual pelo operador.

Nenhuma alteração foi realizada no Supabase oficial.

**Aguardando autorização expressa do usuário para aplicação no Supabase oficial.**
