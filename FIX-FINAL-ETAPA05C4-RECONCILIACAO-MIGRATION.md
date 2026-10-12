# ERP ORBE — FIX-FINAL / ETAPA 05C.4
# Reconciliação da Migration com a Auditoria SQL Real

**Data de Emissão:** 12 de Outubro de 2026  
**Ambiente Auditado:** Supabase Operacional ESC Log (`lifgjtcflzmspilhryap`)  
**Objeto em Análise:** `supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`  
**Fase do Projeto:** Pré-Homologação em Ambiente Isolado (Auditoria Read-Only)

---

## 1. RESUMO EXECUTIVO

A presente auditoria reconcilia linha a linha a migration proposta para a retificação de lançamentos intermitentes pelo RH com os resultados reais obtidos na auditoria SQL manual executada diretamente no catálogo de dados do Supabase.

A auditoria manual comprovou a existência de todas as dependências estruturais do banco de dados (tabelas, chaves estrangeiras, views e funções de contexto), mas revelou dados e comportamentos do pipeline que exigem calibração cirúrgica da migration antes de qualquer aplicação em ambiente de testes:

1. **Volume e Distribuição Real de Dados:** Existem 90 lançamentos intermitentes e 9 lotes operacionais cadastrados, com presença confirmada dos status `ENVIADO_FINANCEIRO` (13 lançamentos) e `FECHADO_FINANCEIRO` (4 lotes).
2. **Retificação de Premissa Financeira:** A premissa anterior da etapa 05B.2 de que `rh_financeiro_lotes.tipo` não suportava `'INTERMITENTES'` revelou-se incorreta. O tipo **é perfeitamente válido**, constando explicitamente na enum/check constraint. No entanto, o status `'PENDENTE_RH'` **não existe** no schema real de `rh_financeiro_lotes`.
3. **Decisão Arquitetural sobre o Módulo Financeiro:** A retirada de operações de escrita em `rh_financeiro_lotes` da migration foi **correta e deve ser mantida**. O módulo financeiro é uma projeção alimentada exclusivamente na aprovação do lote via serviço de domínio (`syncToRHFinanceiro`), não devendo sofrer mutações parciais ou fora de sincronia com a tabela de itens (`rh_financeiro_lote_itens`) no momento da retificação operacional.
4. **Veredito:** A migration **NÃO ESTÁ APTA** para execução imediata em staging até que sejam ajustados os status terminais observados no trigger guardião e adicionado o bloqueio explícito de `DELETE`. Após essas adequações pontuais, estará plenamente apta para homologação em banco isolado.

---

## 2. MATRIZ DE COMPATIBILIDADE

Comparação entre cada pré-condição técnica exigida pela migration e a realidade constatada na base de dados:

| Item / Pré-Condição da Migration | Estado no Banco Real | Compatibilidade | Impacto / Evidência |
| :--- | :--- | :---: | :--- |
| **Tabela `lancamentos_intermitentes`** | Presente (90 registros) | **100% Compatível** | Schema idêntico ao esperado. Colunas `total`, `horas_trabalhadas`, `lote_fechamento_id`, `empresa_id` e `status_pipeline` ativas. |
| **Tabela `intermitentes_lotes_fechamento`** | Presente (9 registros) | **100% Compatível** | Chaves estrangeiras e integridade referencial preservadas. |
| **Coluna `lote_devolvido_origem_id`** | Ausente (adicionada via migration) | **100% Compatível** | Cláusula `ADD COLUMN IF NOT EXISTS` com FK para `intermitentes_lotes_fechamento(id) ON DELETE SET NULL` é segura e idempotente. |
| **Tabela `cnab_remessas_arquivos`** | Presente | **100% Compatível** | Coluna `intermitentes_lote_id` existe e aponta para `intermitentes_lotes_fechamento.id`. A validação anti-retificação pós-CNAB é suportada. |
| **Tabela `audit_log`** | Presente | **100% Compatível** | Colunas `tenant_id`, `empresa_id`, `usuario_id`, `acao`, `entidade`, `valor_anterior`, `valor_novo` e `origem` prontas para escrita compulsória. |
| **Funções `current_tenant_id()` e `get_user_role()`** | Presentes no schema `public` | **100% Compatível** | Funções canônicas de tenant e perfil ativas no catálogo do PostgreSQL. |
| **Triggers existentes em `lancamentos_intermitentes`** | 2 triggers ativos (auditoria e `updated_at`) | **Compatível com Atenção** | O novo trigger `trg_guard_lancamentos_intermitentes` é `BEFORE UPDATE` e não causa conflito, pois apenas valida e retorna `NEW`. |
| **Triggers existentes em `intermitentes_lotes_fechamento`** | 2 triggers ativos (tenant e `updated_at`) | **100% Compatível** | Nenhuma colisão detectada com os locks `FOR UPDATE` da RPC. |
| **Políticas RLS Atuais** | Isolamento por `tenant_id` habilitado | **Compatível** | RLS atual filtra por tenant mas não isola perfis na escrita. O trigger guardião preenche exatamente essa lacuna de segurança. |
| **`rh_financeiro_lotes.tipo`** | Suporta `'INTERMITENTES'` | **Compatível** | Aceita `BANCO_HORAS`, `FOLHA_VARIAVEL`, `FOLHA_BASE`, `INTERMITENTES` e `DIARISTAS`. |
| **`rh_financeiro_lotes.status`** | **NÃO aceita `'PENDENTE_RH'`** | **Incompatível se houvesse escrita** | Confirma a necessidade de NÃO executar `UPDATE status = 'PENDENTE_RH'` em `rh_financeiro_lotes`. |

---

## 3. DIVERGÊNCIAS CONFIRMADAS

### 3.1 Correção do Equívoco da Auditoria 05B.2 (`rh_financeiro_lotes.tipo`)
Na etapa 05B.2, supôs-se preliminarmente que `rh_financeiro_lotes` não suportava o tipo `'INTERMITENTES'`.  
A inspeção manual do catálogo de constraints comprovou que:
- O tipo `'INTERMITENTES'` **consta formalmente** na check constraint de `rh_financeiro_lotes.tipo`.
- O real ponto de ruptura estava no campo **`status`**, que não admite `'PENDENTE_RH'`. Os status suportados pelo financeiro são: `'ABERTO'`, `'AGUARDANDO_FINANCEIRO'`, `'EM_ANALISE_FINANCEIRA'`, `'AGUARDANDO_PAGAMENTO'`, `'PAGO'`, `'CANCELADO'`, `'DEVOLVIDO_RH'`, `'FINALIZADO'`.

### 3.2 Ocorrência Real do Status `ENVIADO_FINANCEIRO`
A distribuição real de lançamentos revelou:
- `RECEBIDO`: 68
- `EM_ANALISE_RH`: 7
- `ENVIADO_FINANCEIRO`: 13 *(presente em produção!)*
- `PAGO`: 2

E nos lotes de fechamento:
- `AGUARDANDO_VALIDACAO_RH`: 1
- `CANCELADO`: 3
- `FECHADO_FINANCEIRO`: 4 *(presente em produção!)*
- `PAGO`: 1

**Divergência na Migration:**  
No item 7 do trigger guardião (`fn_guard_lancamentos_intermitentes_update`), a lista de status imutáveis protegia apenas:
```sql
IF OLD.status_pipeline IN ('APROVADO_RH', 'PAGO', 'CNAB_GERADO')
```
Como 13 registros reais já transitaram para `ENVIADO_FINANCEIRO` e 4 lotes estão em `FECHADO_FINANCEIRO`, a ausência desses status na lista de estados protegidos deixaria uma brecha para mutações indevidas via API client nesses lançamentos já despachados ao financeiro.

### 3.3 Ausência de Bloqueio Guardião para `DELETE`
O trigger guardião atual foi projetado exclusivamente para `BEFORE UPDATE`.  
Embora o RLS limite acessos por tenant, um cliente autenticado com permissão genérica poderia teoricamente emitir `DELETE FROM lancamentos_intermitentes WHERE id = ...`.  
Se um lançamento vinculado a um lote em análise ou fechado for excluído diretamente, causará orfandade e divergência matemática entre a soma do lote e seus itens.

---

## 4. ANÁLISE DO FLUXO FINANCEIRO E DA RETIRADA DE `rh_financeiro_lotes`

### 4.1 A Cadeia Relacional Real
A auditoria cruzada do código-fonte (`intermitentes.service.ts` e `rhFinanceiro.service.ts`) revelou como o ORBE integra os três domínios:

```text
[Lançamento Intermitente] (lancamentos_intermitentes)
         │
         ▼ vincula-se a
[Lote Operacional de Intermitentes] (intermitentes_lotes_fechamento)
         │
         │ (Apenas quando RH aprova via validarLote -> syncToRHFinanceiro)
         ▼
[Lote RH Financeiro] (rh_financeiro_lotes: tipo = 'INTERMITENTES', status = 'AGUARDANDO_FINANCEIRO')
         │
         ├─► [Itens do Lote Financeiro] (rh_financeiro_lote_itens: referencia_evento_id = lancamento.id)
         │
         ▼ (Quando o financeiro gera remessa)
[Remessa Bancária CNAB] (cnab_remessas_arquivos: intermitentes_lote_id = lote_fechamento.id)
```

### 4.2 Por Que a Retirada de Escrita em `rh_financeiro_lotes` na Migration é Mandatória?
1. **Momento Temporal da Retificação:** A retificação de empresa pelo RH ocorre quando o lote operacional está em `AGUARDANDO_VALIDACAO_RH` ou `DEVOLVIDO`. Neste estágio:
   - Em lotes recém-fechados (`AGUARDANDO_VALIDACAO_RH`), o lote financeiro **ainda não existe**. Ele só é gerado no momento em que o RH conclui a aprovação (`syncToRHFinanceiro`).
   - Em lotes devolvidos pelo Financeiro (`DEVOLVIDO`), o lote financeiro correspondente já está marcado como `DEVOLVIDO_RH`.
2. **Atomicidade com Itens Financeiros:** Qualquer tentativa de atualizar `rh_financeiro_lotes` diretamente via trigger/RPC sem reconstruir a tabela de detalhes `rh_financeiro_lote_itens` quebraria a consistência financeira. O recálculo dos itens é atribuição exclusiva do serviço oficial `syncToRHFinanceiro`.
3. **Desacoplamento de Domínios:** O princípio de não acoplamento entre regras operacionais e o motor de despesas/financeiro exige que o banco de dados garanta a integridade operacional (lote pai e lançamentos filhos) e delegue a projeção contábil aos fluxos canônicos de homologação financeira.

**Conclusão:** A remoção das operações de escrita em `rh_financeiro_lotes` na migration 05B.3 foi **absolutamente correta** e preserva a integridade estrutural do sistema.

---

## 5. REVISÃO CRÍTICA DO MECANISMO DE AUTORIZAÇÃO ANTI-BYPASS

A migration emprega uma barreira de autorização quádrupla para distinguir a RPC oficial de chamadas diretas via API client:

```sql
GET DIAGNOSTICS v_stack = PG_CONTEXT;
IF (v_stack LIKE '%rpc_rh_retificar_intermitente%') AND
   (current_user = 'postgres') AND
   (current_setting('orbe.in_rpc_retificacao', true) = 'true') AND
   (lower(trim(coalesce(public.get_user_role(), ''))) IN ('admin', 'super_admin', 'rh')) THEN
    RETURN NEW;
END IF;
```

### 5.1 Avaliação Técnica das Camadas
1. **`PG_CONTEXT` (Introspecção da Pilha PL/pgSQL):**
   - *Mecanismo:* Lê o call stack interno do engine PostgreSQL.
   - *Resistência a Spoofing:* Impossível de ser injetado por clientes externos via REST/PostgREST. Se a chamada não partiu da função especificada, o nome não constará na pilha.
2. **`current_user = 'postgres'` (Contexto Privilegiado):**
   - *Mecanismo:* A RPC é definida como `SECURITY DEFINER` com `OWNER TO postgres`.
   - *Resistência:* Conexões de clientes utilizam a role `authenticated`. O `current_user` só transita para `postgres` durante o frame de execução da função definida com `SECURITY DEFINER`.
3. **`orbe.in_rpc_retificacao = 'true'` (Flag de Sessão Transacional):**
   - *Mecanismo:* Configurada via `set_config('orbe.in_rpc_retificacao', 'true', true)` (escopo local da transação).
   - *Limitação Isolada:* Uma sessão transacional cliente que execute SQL arbitrário poderia tentar emitir `SET LOCAL`. Por isso, **não opera sozinha**, servindo como confirmação de que o bloco de execução atingiu o ponto exato da transação.
4. **`get_user_role()` (Verificação de Perfil):**
   - *Mecanismo:* Valida que o `auth.uid()` da sessão Supabase realmente detém privilégios de governança (RH/Admin).

### 5.2 Avaliação de Risco — Não Declaração de Inviolabilidade Abstrata
Embora conceitualmente sólida, esta arquitetura **não pode ser considerada inviolável sem teste prático em banco isolado** pelos seguintes motivos:
- **Connection Pooling (PgBouncer/Supabase Pooler):** Variáveis de sessão ou flags de contexto sob connection poolers em modo transaction pool podem apresentar comportamentos imprevistos caso transações fiquem abertas ou ocorram resets parciais.
- **Formatação de `PG_CONTEXT`:** A saída exata de `PG_CONTEXT` pode variar conforme a versão menor do PostgreSQL e o nível de aninhamento de chamadas. Deve-se capturar a string real durante a execução em staging.
- **`search_path` Poisoning:** A RPC define `SET search_path = public, pg_temp`, o que é excelente contra sequestro de schema, mas a função de trigger `fn_guard_lancamentos_intermitentes_update` também deve ter seu `search_path` estritamente fixado.

---

## 6. AVALIAÇÃO DE CONFLITOS COM TRIGGERS E MUTABILIDADE

### 6.1 Triggers Existentes vs. Novo Trigger Guardião
- **`update_lancamentos_intermitentes_updated_at`:** Executa `BEFORE UPDATE` e apenas atribui `NEW.updated_at = timezone('utc'::text, now())`.
- **`trg_guard_lancamentos_intermitentes`:** Executa `BEFORE UPDATE`, valida regras de negócio e bloqueia mutações indevidas. Como não altera valores de colunas de cálculo, não gera dependência circular nem colide com o carimbo de data/hora.
- **`trg_audit_lancamentos_intermitentes`:** Executa `AFTER UPDATE`. Como a auditoria lê os valores finais após a aprovação do guardião, a rastreabilidade permanecerá íntegra.

### 6.2 Preservação de Dados Sensíveis
- **Horas e Remuneração:** A migration possui cláusula fail-closed absoluta (`IF p_novas_horas IS NOT NULL AND p_novas_horas <> v_lanc.horas_trabalhadas THEN RAISE EXCEPTION ...`). Nenhuma hora ou valor é recalculado sem o motor oficial homologado.
- **Tenant e Empresa:** A RPC valida tenant em todas as consultas e impede transferência entre empresas de tenants distintos.
- **Histórico e OCC:** Validação pessimista `FOR UPDATE` na ordem Pai -> Filho previne concorrência predatória, e `p_updated_at` impede sobrescrita cega (lost updates).

---

## 7. MATRIZ DE RISCOS CLASSIFICADOS POR SEVERIDADE

| Risco Identificado | Severidade | Impacto Técnico | Ação Mitigadora Obrigatória |
| :--- | :---: | :--- | :--- |
| **Status `ENVIADO_FINANCEIRO` e `FECHADO_FINANCEIRO` fora da lista de imutabilidade** | 🔴 **CRÍTICO** | Lançamentos já enviados ao financeiro poderiam ser mutados via API client sem bloqueio do trigger. | Incluir `'ENVIADO_FINANCEIRO'` e `'FECHADO_FINANCEIRO'` na lista de status terminais imutáveis do trigger guardião. |
| **Ausência de proteção contra `DELETE` em lançamentos vinculados** | 🔴 **CRÍTICO** | Usuário via API client poderia deletar lançamentos vinculados a lotes em análise ou fechados, corrompendo a integridade matemática do lote. | Adicionar trigger guardião `BEFORE DELETE` impedindo exclusão de lançamentos com `lote_fechamento_id IS NOT NULL` ou status fora de `RECEBIDO`. |
| **Comportamento de `PG_CONTEXT` e `current_user` sob o Pooler Supabase** | 🟡 **MÉDIO** | Risco de falso-positivo ou falso-negativo na checagem anti-bypass caso o formato da pilha divirja em runtime. | Validar empiricamente os 14 cenários em staging isolado antes de autorizar subida a produção. |
| **`search_path` ausente na função do trigger** | 🟡 **MÉDIO** | Vulnerabilidade clássica de segurança em funções PL/pgSQL caso o schema `public` seja sobrescrito. | Adicionar `SET search_path = public, pg_temp` explicitamente em `fn_guard_lancamentos_intermitentes_update`. |
| **Presunção de nulidade de `lote_fechamento_id` em lotes cancelados** | 🟢 **BAIXO** | Lançamento desvinculado por retificação de empresa tem lote setado como NULL e origem salva em `lote_devolvido_origem_id`. | Comportamento validado e auditável pelo histórico. |

---

## 8. CORREÇÕES NECESSÁRIAS NA MIGRATION

Antes de qualquer execução em ambiente isolado, a migration local `supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql` deve receber 3 ajustes cirúrgicos:

### Ajuste 1: Fixar `search_path` na Função Guardiã
Adicionar:
```sql
CREATE OR REPLACE FUNCTION public.fn_guard_lancamentos_intermitentes_update()
RETURNS trigger
SET search_path = public, pg_temp
AS $$
...
```

### Ajuste 2: Expandir Lista de Status Imutáveis
Atualizar o item 7 do trigger guardião para contemplar os status reais observados na auditoria:
```sql
-- 7. Bloqueia alteração direta de status terminal ou já despachado
IF OLD.status_pipeline IN ('APROVADO_RH', 'PAGO', 'CNAB_GERADO', 'ENVIADO_FINANCEIRO') AND 
   NEW.status_pipeline IS DISTINCT FROM OLD.status_pipeline THEN
    IF NOT (OLD.status_pipeline = 'CNAB_GERADO' AND NEW.status_pipeline = 'PAGO') THEN
        RAISE EXCEPTION 'ESTADO_IMUTAVEL: Lançamentos em status % são imutáveis via API client.', OLD.status_pipeline
        USING ERRCODE = '55000';
    END IF;
END IF;
```

### Ajuste 3: Adicionar Trigger Guardião contra Exclusão Indevida (`BEFORE DELETE`)
Criar guardião de deleção para blindar lançamentos que já ingressaram no fluxo de governança:
```sql
CREATE OR REPLACE FUNCTION public.fn_guard_lancamentos_intermitentes_delete()
RETURNS trigger
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN OLD;
    END IF;

    IF OLD.lote_fechamento_id IS NOT NULL THEN
        RAISE EXCEPTION 'EXCLUSAO_BLOQUEADA: Lançamento vinculado a lote operacional não pode ser excluído diretamente.'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status_pipeline <> 'RECEBIDO' THEN
        RAISE EXCEPTION 'EXCLUSAO_BLOQUEADA: Apenas lançamentos no status RECEBIDO podem ser excluídos. Status atual: %', OLD.status_pipeline
        USING ERRCODE = '42501';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_lancamentos_intermitentes_delete ON public.lancamentos_intermitentes;
CREATE TRIGGER trg_guard_lancamentos_intermitentes_delete
BEFORE DELETE ON public.lancamentos_intermitentes
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_lancamentos_intermitentes_delete();
```

---

## 9. VERIFICAÇÕES QUE EXIGEM HOMOLOGAÇÃO EM BANCO ISOLADO

As seguintes validações **não podem ser homologadas apenas por leitura de código** e exigem execução no ambiente Supabase local / staging isolado:

1. **Validação Empírica da Pilha `PG_CONTEXT`:** Executar a RPC via cliente autenticado e registrar em log a string exata capturada por `GET DIAGNOSTICS v_stack = PG_CONTEXT;`.
2. **Tentativa Real de Bypass do Trigger:** Executar chamada direta `supabase.from('lancamentos_intermitentes').update({ empresa_id: nova })` como analista RH e como encarregado para comprovar o bloqueio (`VINCULO_PROTEGIDO`).
3. **Teste de Tentativa de Falsificação de Variável de Sessão:** Tentar executar `SET LOCAL orbe.in_rpc_retificacao = 'true'` em transação cliente e em seguida fazer update direto, comprovando que o trigger bloqueia pela checagem de `PG_CONTEXT` e `current_user`.
4. **Comportamento Concorrente de Lock Pessimista:** Simular dois clientes tentando retificar lançamentos do mesmo lote simultaneamente para comprovar ausência de deadlocks e funcionamento do OCC via `p_updated_at`.
5. **Teste de Esvaziamento de Lote:** Retificar o único lançamento de um lote e comprovar transição automática do lote pai para `CANCELADO` e decremento de contagem/total.
6. **Ciclo Completo com Revalidação:** Retificar empresa -> revalidar lote com `rpc_rh_revalidar_lote_devolvido` -> chamar aprovação do RH no frontend e validar que o serviço `syncToRHFinanceiro` projeta os dados corretamente para o Financeiro sem colisão.

---

## 10. PLANO OBJETIVO PARA A PRÓXIMA ETAPA

Com base nas evidências, o roteiro estrito para prosseguir com segurança total é:

```text
ETAPA 05C.4 (Concluída)
Reconciliação e Laudo Técnico de Conformidade
         │
         ▼ (Requer autorização do usuário)
ETAPA 05C.5 (Aplicação Local dos Ajustes Pontuais)
- Aplicar localmente os 3 ajustes cirúrgicos no arquivo SQL da migration
- Adicionar os cenários de teste de ENVIADO_FINANCEIRO e DELETE no seed de homologação
         │
         ▼
ETAPA 05D (Execução e Testes no Banco Isolado)
- Subir containers locais isolados ou staging com o seed sintético
- Executar os 14 testes funcionais + 4 testes de segurança anti-bypass
- Coletar logs de execução e evidências de assertividade
         │
         ▼
ETAPA 05E (Homologação Final e Liberação para Produção)
- Emissão do Laudo de Homologação E2E
```

---

## 11. VEREDITO TÉCNICO

**CLASSIFICAÇÃO DE APTIDÃO:**  
⚠️ **PARCIALMENTE APTA (CONDICIONADA A AJUSTES PONTUAIS)**

A migration proposta possui integridade conceitual e arquitetural de excelência, demonstrando completo alinhamento com a estrutura do Supabase operacional e respeitando os princípios de não-regressão do ERP ORBE.

No entanto, a constatação real de lançamentos em status `ENVIADO_FINANCEIRO` e a lacuna de proteção contra `DELETE` exigem que apliquemos os **3 ajustes preventivos recomendados** na migration local antes de inicializarmos os testes automatizados no banco isolado.

> **Status:** AGUARDANDO AUTORIZAÇÃO DO USUÁRIO PARA APLICAR OS AJUSTES PONTUAIS NA MIGRATION LOCAL (ETAPA 05C.5).
