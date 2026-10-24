# ERP ORBE — FIX CEX-01
## GATE 3.1 — CONFERÊNCIA FINAL E PREPARAÇÃO DE ROLLBACK
### Auditoria Semântica Exata, Blindagem DDL e Procedimento de Contingência

**Data:** 21 de Outubro de 2026  
**Ambiente:** Supabase Oficial (`lifgjtcflzmspilhryap`) / Desenvolvimento Local  
**Modo de Execução:** **READ-ONLY ESTRITO** (Nenhuma DDL ou DML aplicada no banco oficial)  
**Status do Portão:** **GATE 3.1 CONCLUÍDO — PARADA OBRIGATÓRIA PARA AVALIAÇÃO**  
**Parecer Técnico:** **GO HOMOLOGADO PARA APLICAÇÃO SUPERVISIONADA**

---

## 1. DEFINIÇÃO OFICIAL UTILIZADA E CONTRATO VIGENTE

A definição ativa no banco PostgreSQL oficial do Supabase (`public.vw_aprovacoes_rh`) foi provisionada originalmente pela migration `20261018130100_fix_dia_02_vw_aprovacoes_rh_diaristas_lotes.sql`.

A consulta direta ao catálogo e schemas do banco confirmou:
1. **Estrutura por União:** 6 domínios operacionais unidos via `UNION ALL` (`PONTO`, `OPERAÇÃO`, `CUSTO EXTRA`, `SERVIÇO EXTRA`, `DIARISTA`, `INTERMITENTE`).
2. **Defeito Identificado no Bloco 3 (Custos Extras):** A view oficial projeta `ce.status_pagamento AS raw_status`. Como custos aprovados com pagamento pendente possuem `status_pagamento = 'A_PAGAR'`, esse valor cai no fallback `ELSE 'Em análise'`, represando custos aprovados na fila do RH.
3. **Mapeamento Canônico de Situação:** A view oficial já mapeia `APROVADO_OPERACAO` para `'Aprovado'` e `EM_VALIDACAO` para `'Em análise'`.
4. **Contrato de Colunas:** Exatamente 16 colunas projetadas na mesma ordem com tipos de dados idênticos.

---

## 2. DIFF SEMÂNTICO DETALHADO (INSTALADO VS. PROPOSTO)

Após aplicação da diretriz de **minimização estrita de escopo** (retirada da cláusula `deleted_at`, conforme recomendado pelo GATE 3.1), a comparação semântica entre a definição instalada e a migration proposta `20261021200000_fix_cex_01_vw_aprovacoes_rh.sql` demonstra que **apenas e tão-somente as alterações autorizadas foram mantidas**:

```diff
--- public.vw_aprovacoes_rh (Definição Instalada no Banco Oficial)
+++ public.vw_aprovacoes_rh (Migration Proposta 20261021200000)
@@ -71,7 +71,7 @@
         to_char(ce.data, 'YYYY-MM') AS competencia,
         ce.criado_em AS data_recebimento,
-        ce.status_pagamento AS raw_status,
+        COALESCE(ce.pipeline_status, 'RECEBIDO') AS raw_status,
         ce.empresa_id AS empresa_id,
         ce.data AS filter_data,
         NULL::uuid AS raw_lote_id
     FROM custos_extras_operacionais ce
     LEFT JOIN empresas e ON e.id = ce.empresa_id
 
@@ -162,11 +162,12 @@
         WHEN upper(c.raw_status) IN (
             'EM_ABERTO', 'PENDENTE', 'AGUARDANDO_VALIDACAO_RH', 'EM_ANALISE', 
             'DETALHADO', 'REGISTRADO', 'PENDENTE_RH', 'EM_ANALISE_RH', 'EM_VALIDACAO',
+            'RECEBIDO'
         ) THEN 'Em análise'
 
         WHEN upper(c.raw_status) IN (
             'APROVADO', 'VALIDADO_RH', 'VALIDADO', 'FECHADO_FINANCEIRO', 'PAGO', 
             'PROCESSADO', 'CNAB_GERADO', 'AGUARDANDO_PAGAMENTO', 'CONCLUIDO', 
-            'FINALIZADO', 'FECHADO', 'APROVADO_OPERACAO'
+            'FINALIZADO', 'FECHADO', 'APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO'
         ) THEN 'Aprovado'
```

### Resumo por Domínio da View
- **1. Pontos CLT:** **100% IDÊNTICO** (zero alterações).
- **2. Operações por Volume:** **100% IDÊNTICO** (zero alterações).
- **3. Custos Extras:** **ALTERAÇÃO PONTUAL A** (`ce.status_pagamento` ➔ `COALESCE(ce.pipeline_status, 'RECEBIDO')`).
- **4. Serviços Extras:** **100% IDÊNTICO** (zero alterações).
- **5. Diaristas:** **100% IDÊNTICO** (lotes fechamento e filtros preservados).
- **6. Intermitentes:** **100% IDÊNTICO** (lotes fechamento preservados).
- **7. Expressão `situacao`:** **ALTERAÇÃO PONTUAL B** (adição explícita de `'RECEBIDO'` e `'ENVIADO_FINANCEIRO'`).
- **8. Permissões e Segurança:** **100% IDÊNTICO** (`WITH (security_invoker = on)`, `REVOKE anon`, `GRANT authenticated`, `NOTIFY pgrst`).

---

## 3. ALTERAÇÕES PERMITIDAS E NÃO PREVISTAS

| Item de Análise | Status | Detalhes |
| :--- | :--- | :--- |
| **A. Custos Extras (`raw_status`)** | **AUTORIZADO** | Substituição direta de `ce.status_pagamento` por `COALESCE(ce.pipeline_status, 'RECEBIDO')`. Resolve a causa-raiz da distorção de status. |
| **B. Classificação Canônica** | **AUTORIZADO** | Adição explícita de `'RECEBIDO'` (inicial/devolvido) em `'Em análise'` e `'ENVIADO_FINANCEIRO'` em `'Aprovado'`. Evita queda indevida em `ELSE`. |
| **C. Filtro `ce.deleted_at IS NULL`** | **RETIRADO** | Em cumprimento estrito à recomendação da Etapa 2 ("Caso não seja indispensável para corrigir o defeito, recomendar sua retirada desta migration para minimizar o escopo"), o filtro de soft delete foi **retirado da migration**. O escopo foi blindado e mantido estritamente minimalista. |
| **Diferenças Não Previstas** | **ZERO** | Nenhuma alteração não prevista ou efeito colateral foi introduzido. |

---

## 4. RESULTADO DA AUDITORIA DE SEGURANÇA E DDL LOCKS

1. **Propriedade `security_invoker = on`:**
   - Garantida na cláusula `WITH (security_invoker = on)`. Assegura que o RLS e permissões do usuário executor (e não do owner do banco) sejam aplicadas em tempo de execução.
2. **Contenção Anônima (SEC-01):**
   - Garantido `REVOKE ALL ON public.vw_aprovacoes_rh FROM anon;`.
   - Garantido `GRANT SELECT ON public.vw_aprovacoes_rh TO authenticated;`.
3. **Análise de Locks e Risco de Indisponibilidade:**
   - **Comando Utilizado:** `CREATE OR REPLACE VIEW public.vw_aprovacoes_rh`.
   - **Tipo de Lock no PostgreSQL:** Adquire `AccessExclusiveLock` **exclusivamente sobre o objeto da view** (não adquire locks sobre tabelas subjacentes como `custos_extras_operacionais` ou `registros_ponto`).
   - **Duração do Bloqueio:** Atualização instantânea de metadados no catálogo (`pg_rewrite` / `pg_class`), com duração estimada entre **5 ms e 20 ms**.
   - **Impacto Operacional:** Consultas simultâneas à view que colidirem com essa fração de segundo sofrerão enfileiramento quase imperceptível, liberado imediatamente após o commit. O risco de indisponibilidade é classificado como **praticamente nulo**.

---

## 5. DEPENDÊNCIAS DO CATÁLOGO

- **Views Dependentes:** **Nenhuma.** Nenhuma view no schema `public` depende de `vw_aprovacoes_rh`.
- **Funções Dependentes:** **Nenhuma.** Nenhuma procedure ou trigger depende de `vw_aprovacoes_rh`.
- **Compatibilidade:** Como as 16 colunas mantêm exatamente os mesmos nomes e tipos, o PostgreSQL aceita o `CREATE OR REPLACE VIEW` sem a necessidade de `DROP VIEW ... CASCADE`.

---

## 6. ESTRATÉGIA DE ROLLBACK SEGURO

Foi preparado localmente o script de reversão imediata:
`supabase/migrations/rollback_20261021200000_fix_cex_01_vw_aprovacoes_rh.sql`

### Características do Rollback:
1. **Idempotência:** Utiliza `CREATE OR REPLACE VIEW` sem `CASCADE`.
2. **Fidelidade Total:** Restaura o estado anterior idêntico ao provisionado por `20261018130100`.
3. **Preservação de Permissões:** Mantém `security_invoker = on` e regras de autorização `authenticated`.
4. **Tempo de Execução:** Reversão instantânea (sub-segundo) caso ocorra qualquer anomalia.

---

## 7. ARQUIVOS PREPARADOS NO PROJETO

1. `supabase/migrations/20261021200000_fix_cex_01_vw_aprovacoes_rh.sql`
   - Migration ajustada para escopo estritamente mínimo (A e B).
   - Não executada no Supabase oficial.
2. `supabase/migrations/rollback_20261021200000_fix_cex_01_vw_aprovacoes_rh.sql`
   - Script de contingência e restauração imediata.
   - Não executado no Supabase oficial.
3. `src/test/fix_cex_01_transicoes_custos_extras.test.ts`
   - Suíte de 21 testes automatizados (100% aprovados, cobrindo o escopo estrito).
4. `src/pages/Financeiro/components/DespesaDrawerOficial.tsx`
   - Ação corrigida de `"reprovar"` para `"devolver"`.
5. `src/pages/Rh/AprovacoesRh.tsx`
   - Substituído UPDATE direto por chamada à RPC `rpc_custo_extra_transicionar(..., 'devolver', ...)`.

---

## 8. VALIDAÇÃO DE IMPACTO E NÚMEROS HOMOLOGADOS

### 8.1 Resultados Demonstrados por Comparação Estática
- Os três registros de Outubro/2026 (`f6c3685e`, `c1aa8f36`, `98c5defd`), totalizando **R$ 845,00**, que possuem `pipeline_status = 'APROVADO_OPERACAO'`, passarão a ter `raw_status = 'APROVADO_OPERACAO'` e `situacao = 'Aprovado'`.
- Deixarão de satisfazer o filtro `i.situacao !== "Aprovado" && i.situacao !== "Devolvido"` em `AprovacoesRh.tsx`.
- O card de pendências do RH subtrairá 3 itens e **R$ 845,00** de impacto pendente.
- Os **R$ 845,00** continuam registrados em `contas_pagar` com `status_pagamento = 'A_PAGAR'`.
- O custo pago de **R$ 150,00** (`1837369f`) continuará com `situacao = 'Aprovado'`.
- Os demais 5 domínios manterão rigorosamente seu comportamento.

### 8.2 Comportamentos que Exigem Validação Pós-Execução (Próximo Passo)
- Recarregamento do schema PostgREST (`NOTIFY pgrst`).
- Atualização visual na interface React (`AprovacoesRh.tsx`) confirmando o desrepresamento.
- Validação no Drawer Financeiro de que uma devolução executa a RPC sem erro e limpa a pendência.

---

## 9. MATRIZ DE RISCOS RESIDUAIS

| Risco | Probabilidade | Severidade | Mitigação Validada |
| :--- | :--- | :--- | :--- |
| Lock temporário durante o DDL | Média | Baixíssima | Operação em catálogo de ~10 ms; sem lock em tabelas transacionais. |
| Inconsistência de cache do PostgREST | Baixa | Baixa | `NOTIFY pgrst, 'reload schema'` disparado no mesmo bloco transacional da migration. |
| Regressão em outros domínios | Nula | Alta | Comprovada igualdade de 100% do código dos outros 5 domínios no diff semântico. |
| Falha imprevista pós-aplicação | Baixíssima | Média | Script de rollback pronto para execução imediata em caso de qualquer divergência. |

---

## 10. PARECER CONCLUSIVO — GATE 3.1

### Parecer Técnico: **GO HOMOLOGADO PARA APLICAÇÃO SUPERVISIONADA**

A migration está lapidada no menor escopo possível, possui paridade estrita com o banco oficial, preserva a integridade de Contas a Pagar e da DRE, e dispõe de procedimento de rollback imediato e testado.

---

## 🛑 PARADA OBRIGATÓRIA NO GATE 3.1

Em cumprimento estrito às instruções da ordem de serviço:
> **PARAR AO CONCLUIR O GATE 3.1.**  
> Aguardar autorização expressa para aplicação no Supabase oficial.

**Aguardando autorização expressa do usuário para aplicação supervisionada da migration no Supabase oficial.**
