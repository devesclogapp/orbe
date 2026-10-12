# ERP ORBE — FIX-FINAL / ETAPA 03A
## Relatório de Revisão de Consistência da Auditoria dos Intermitentes

**Data de Emissão:** 11/10/2026  
**Status do Ciclo:** REVISÃO E BLINDAGEM CONCLUÍDAS COM SUCESSO  
**Governança:** Somente o proprietário executa commits. Nenhuma migração ou deploy executado.

---

## 1. Contexto e Diagnóstico

Na Etapa 03, foram implementadas as pendências funcionais **FIX-INT-01** (Resumo Persistente de Lote) e **FIX-INT-02** (Auditoria de Fechamento de Intermitentes).

Contudo, a auditoria arquitetural identificou um **risco de feedback enganoso (false positive)**:
1. Caso a chamada de auditoria sofresse falha silenciosa ou exceção de rede/permissão, o fechamento operacional era concluído, mas o badge da interface exibia categoricamente `"100% Auditado e Coerente"`.
2. Essa rotulação misturava dois conceitos distintos: a **consistência matemática dos dados do lote** (volume x valor unitário) e a **comprovação de persistência do log de governança na tabela `auditoria`**.
3. Não havia verificação real se `AuditoriaService.log` retornara de fato um registro com ID persistido ou se retornara nulo/falhou silenciosamente.

---

## 2. Auditoria dos Contratos e Persistência Real

### 2.1. Contrato de `AuditoriaService.log`
- **Implementação em `src/services/v4.service.ts`:**
  - `AuditoriaServiceClass` estende `BaseService<'auditoria'>`.
  - O método `log(evento, detalhes, entidade, entidade_id)` realiza:
    ```typescript
    const { data, error } = await supabase
      .from('auditoria')
      .insert({
        evento,
        entidade: entidade ?? 'SISTEMA',
        entidade_id,
        detalhes,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data;
    ```
- **Comportamento em Falha:**
  - Se houver erro de rede, RLS ou schema inválido, ele **lança exceção (`throw error`)**.
  - No código anterior de `fecharPeriodo`, havia um `try/catch` em volta de `AuditoriaService.log`. Se falhasse, emitia um `console.warn` e prosseguia retornando o lote. A tela então lia os dados do lote e inferia que estava tudo "100% Auditado".
  - Se o retorno fosse `null` ou `undefined`, não havia checagem de integridade do payload retornado.

### 2.2. RPC `log_audit`
- Existe como RPC auxiliar (`log_audit`) no backend Supabase, com assinatura `(p_action, p_entity_type, p_entity_id, p_details, p_severity)`.
- No entanto, a tabela oficial de auditoria consultada pelo ORBE e por seus painéis de governança é a tabela relacional `auditoria` (com as colunas `evento`, `entidade`, `entidade_id`, `detalhes`, `timestamp`).
- A chamada REST direta do Supabase **não participa da mesma transação física do banco de dados** que o fechamento do lote, a menos que encapsulada em uma única RPC transacional SQL.

### 2.3. Semântica de Eventos e Idempotência
- **Evento Semântico:** `FECHAR_PERIODO` / `INTERMITENTE_LOTE`.
- **Idempotência Operacional:** O fechamento do período agrupa lançamentos com status `EM_APROVACAO` e os atualiza para `PROCESSADO`, vinculando-os ao `lote_id`.
- Se um lote já estiver fechado e o encarregado/RH tentar reexecutar o fechamento sem novos lançamentos pendentes, o serviço previne duplicidade identificando que não há itens elegíveis para aquele período ou reaproveitando o lote existente caso seja uma consulta posterior.

---

## 3. Segregação Conceitual do Feedback ao Usuário

Para eliminar qualquer ambiguidade ou feedback enganoso, os conceitos foram estritamente desmembrados:

| Dimensão | O que valida | Quando é Positivo | Quando é Atenção / Pendente |
| :--- | :--- | :--- | :--- |
| **Integridade dos Dados** | Reconciliação matemática entre a soma dos lançamentos filhos e os campos-âncora (`total_diarias`, `valor_total`) do lote persistido. | "Totais Consistentes" (verde) | "Divergência na Âncora" (amarelo) |
| **Confirmação de Auditoria** | Existência física comprovada do registro de auditoria com `id` persistido na tabela `auditoria`. | "Auditoria Confirmada" (verde) | "Auditoria Pendente / Indeterminada" (amarelo/alerta) |

### Impacto na Interface:
1. **Modal de Confirmação Pós-Fechamento (`IntermitentesRecebidos.tsx`):**
   - Linha 1: **Integridade dos Totais** (exibe `✓ Totais Consistentes` se a âncora bater, ou `⚠️ Divergência na âncora`).
   - Linha 2: **Registro de Auditoria** (exibe `✓ Auditoria Confirmada` somente se `loteFechado.auditoriaConfirmada === true`; caso contrário, exibe `⚠️ Auditoria Pendente` com o motivo).
2. **Drawer Primário de Detalhes do Lote (`IntermitentesLotes.tsx`):**
   - Título ajustado para `"Resumo Analítico Persistido (Integridade dos Totais)"`.
   - O badge único `"100% Auditado e Coerente"` foi **descontinuado**.
   - Em seu lugar, existem dois badges granulares:
     - Badge de Integridade: `Totais Consistentes` vs `Divergência na Âncora`.
     - Badge de Auditoria: `Auditoria Confirmada` vs `Auditoria Pendente`.

---

## 4. Consistência Transacional: Avaliação Técnica

### 4.1. Situação Atual (Client-side Orchestration)
O fluxo no client/service executa sequencialmente:
1. `supabase.from('intermitentes_lotes_fechamento').insert(...)`
2. `supabase.from('lancamentos_intermitentes').update(...).eq('lote_id', ...)`
3. `AuditoriaService.log('FECHAR_PERIODO', ...)`

**Vulnerabilidade Arquitetural:**
Se o passo 1 e 2 tiverem sucesso, mas a conexão cair no passo 3, o lote foi persistido no banco, mas a auditoria não foi gravada.
- Dar rollback manual no lote no passo 3 criaria outro risco (perda de apontamentos ou inconsistência parcial caso o rollback também falhasse).
- O tratamento implementado agora é: **o lote é preservado, mas o retorno marca `auditoriaConfirmada: false` e avisa o usuário que a auditoria está pendente**.

### 4.2. Proposta Técnica: RPC Transacional no PostgreSQL (Aguardando Autorização)
Para alcançar atomicidade ACID absoluta (onde o lote só nasce se o registro de auditoria for gravado no mesmo commit de transação do banco):

```sql
-- PROPOSTA DE RPC TRANSACIONAL (NÃO APLICADA - AGUARDANDO APROVAÇÃO)
CREATE OR REPLACE FUNCTION rpc_fechar_periodo_intermitente(
  p_lote_payload JSONB,
  p_lancamentos_ids UUID[],
  p_usuario_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lote_id UUID;
  v_audit_id UUID;
  v_result JSONB;
BEGIN
  -- 1. Inserir Lote de Fechamento
  INSERT INTO intermitentes_lotes_fechamento (
    empresa_id,
    periodo_inicio,
    periodo_fim,
    total_diarias,
    valor_total,
    status,
    fechado_por
  ) VALUES (
    (p_lote_payload->>'empresa_id')::UUID,
    (p_lote_payload->>'periodo_inicio')::DATE,
    (p_lote_payload->>'periodo_fim')::DATE,
    (p_lote_payload->>'total_diarias')::NUMERIC,
    (p_lote_payload->>'valor_total')::NUMERIC,
    'FECHADO',
    p_usuario_id
  ) RETURNING id INTO v_lote_id;

  -- 2. Atualizar Lançamentos Intermitentes
  UPDATE lancamentos_intermitentes
  SET status = 'PROCESSADO',
      lote_id = v_lote_id
  WHERE id = ANY(p_lancamentos_ids);

  -- 3. Inserir Registro de Auditoria ATOMICAMENTE
  INSERT INTO auditoria (
    evento,
    entidade,
    entidade_id,
    detalhes,
    timestamp
  ) VALUES (
    'FECHAR_PERIODO',
    'INTERMITENTE_LOTE',
    v_lote_id::TEXT,
    jsonb_build_object(
      'lote_id', v_lote_id,
      'total_diarias', p_lote_payload->>'total_diarias',
      'valor_total', p_lote_payload->>'valor_total',
      'fechado_por', p_usuario_id
    ),
    NOW()
  ) RETURNING id INTO v_audit_id;

  -- 4. Montar Retorno Seguro
  v_result := jsonb_build_object(
    'lote_id', v_lote_id,
    'audit_id', v_audit_id,
    'auditoria_confirmada', true
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Rollback implícito de toda a transação
  RAISE EXCEPTION 'Falha atômica ao fechar período: %', SQLERRM;
END;
$$;
```
> **Nota de Governança:** Conforme as diretrizes do projeto, esta RPC **NÃO** foi executada no banco nem criada via migration neste momento, aguardando validação do proprietário da arquitetura. A camada de serviços foi blindada para funcionar de forma transparente caso a RPC venha a ser adotada futuramente.

---

## 5. Implementação Realizada

### 5.1. Serviço de Domínio (`src/services/domain/intermitentes.service.ts`)
1. **Extensão do Tipo `IntermitenteLoteFechamento`:**
   ```typescript
   export interface IntermitenteLoteFechamento {
     // ... campos existentes preservados ...
     auditoriaConfirmada?: boolean;
     auditoriaAviso?: string;
   }
   ```
2. **Validação Estrita de Persistência no `fecharPeriodo`:**
   - Verifica se o retorno de `AuditoriaService.log` possui `id`.
   - Se possuir: `lote.auditoriaConfirmada = true`.
   - Se for nulo ou cair no catch: `lote.auditoriaConfirmada = false` e preenche `auditoriaAviso` detalhado, sem mascarar falha.
3. **Resumo Persistente com Consulta Reativa à Auditoria (`getResumoLoteIntermitente`):**
   - Ao consultar um lote existente, além de somar os lançamentos persistidos na tabela `lancamentos_intermitentes`, o serviço executa uma consulta direta na tabela `auditoria` filtrando `detalhes->lote_id`.
   - Retorna o campo `auditoriaStatus: 'CONFIRMADA' | 'PENDENTE_OU_INDETERMINADA'`, permitindo que a tela reflita o estado real mesmo após recarregar.

### 5.2. Interfaces de Usuário
1. **`src/pages/Operacional/IntermitentesRecebidos.tsx`:**
   - Feedback explícito no modal de fechamento distinguindo integridade matemática dos totais e confirmação do registro de auditoria.
2. **`src/pages/Operacional/IntermitentesLotes.tsx`:**
   - No drawer do lote selecionado, exibe os badges desacoplados:
     - `Totais Consistentes` / `Divergência na Âncora`.
     - `Auditoria Confirmada` / `Auditoria Pendente`.

---

## 6. Cobertura de Testes Automatizados

Foi criado e executado o conjunto de testes automatizados em `src/test/fix_int_resumo_auditoria.test.ts`:

1. **Cenário 1 (Fechamento com Auditoria Confirmada):**
   - Lote fecha, `AuditoriaService.log` retorna objeto com `{ id: 'audit-uuid-1' }`.
   - `lote.auditoriaConfirmada` é estritamente `true`.
2. **Cenário 2 (Falha Silenciosa de Auditoria - Retorno nulo):**
   - `AuditoriaService.log` retorna `null` sem disparar erro.
   - O lote é retornado com `auditoriaConfirmada: false` e aviso descritivo.
3. **Cenário 3 (Falha de Rede / Exceção em Auditoria):**
   - `AuditoriaService.log` lança `Error('Network timeout')`.
   - O lote é preservado, a exceção é interceptada, `auditoriaConfirmada: false` é registrado e o fluxo não quebra.
4. **Cenário 4 (Consulta Posterior via `getResumoLoteIntermitente` com Auditoria Confirmada):**
   - Simula lote e lançamentos no banco com auditoria encontrada.
   - Retorna `consistente: true` e `auditoriaStatus: 'CONFIRMADA'`.
5. **Cenário 5 (Consulta Posterior com Auditoria Ausente/Pendente):**
   - Simula lote e lançamentos sem registro correspondente em `auditoria`.
   - Retorna `consistente: true` (matemática consistente) e `auditoriaStatus: 'PENDENTE_OU_INDETERMINADA'`.
6. **Cenário 6 (Tratamento de Lote Inexistente):**
   - Retorna `null` de forma segura.

### Resultado da Execução:
```bash
✓ src/test/fix_int_resumo_auditoria.test.ts (6 tests) - PASS
✓ src/test/intermitentes_fechamento_periodo_e2e.test.ts (4 tests) - PASS
✓ src/test/conv17_etapa03_intermitentes_recebidos.test.tsx (5 tests) - PASS
✓ src/test/conv17_etapa04_lotes_intermitentes.test.tsx (6 tests) - PASS
Total: 21 testes aprovados (100% de sucesso)
TypeScript Build: npx tsc --noEmit completou com 0 erros.
```

---

## 7. Limitações e Próximos Passos

1. **Limitação de Atomicidade no Supabase:**
   - Sem a RPC transacional proposta na Seção 4.2, o fechamento e a auditoria permanecem orquestrados no client. A falha de auditoria é **detectada e exibida honestamente na interface**, mas o lote fechado permanece no banco.
2. **Sem Comandos Git de Escrita:**
   - Nenhum commit foi executado. O controle de versão permanece sob estrito domínio do usuário.
3. **Aguardando Instruções:**
   - A próxima FIX não foi iniciada automaticamente.
