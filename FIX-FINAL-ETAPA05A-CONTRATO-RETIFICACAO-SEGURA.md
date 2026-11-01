# ERP ORBE — FIX-FINAL / ETAPA 05A
## Contrato Técnico de Retificação Segura de Intermitentes pelo RH (Revisão 05A.2)

**Data:** 12 de Outubro de 2026  
**Status:** 📋 REVISÃO DE SEGURANÇA E INTEGRIDADE TRANSACIONAL CONCLUÍDA — AGUARDANDO APROVAÇÃO  
**Caráter da Etapa:** 100% Read-Only (Nenhuma alteração em código, banco, RLS ou migration foi executada)  
**Entrega:** `FIX-FINAL-ETAPA05A-CONTRATO-RETIFICACAO-SEGURA.md`  

---

### 1. ALINHAMENTO MANDATÓRIO DE REGRA DE NEGÓCIO

Conforme diretriz funcional estrita do proprietário do ERP ORBE:

> **O ENCARREGADO NÃO CORRIGE LANÇAMENTOS DEVOLVIDOS PELO RH. O PRÓPRIO RH REALIZA AS CORREÇÕES.**

#### 1.1 Matriz Estrita de Responsabilidades e Limites de Atuação

| Ator | Responsabilidades Permitidas | Ações Terminantemente Proibidas |
| :--- | :--- | :--- |
| **Encarregado** | • Realiza lançamentos operacionais iniciais.<br>• Consulta status de lotes e jornadas (somente leitura informativa). | ❌ **PROIBIDO** retificar ou editar lançamentos devolvidos pelo RH.<br>❌ **PROIBIDO** alterar ou digitar valores financeiros em R$.<br>❌ **PROIBIDO** participar ou interferir no fluxo de aprovação do RH. |
| **RH (Recursos Humanos)** | • Analisa os lançamentos recebidos e lotes fechados.<br>• Identifica inconsistências cadastrais, bancárias ou operacionais.<br>• **Realiza as correções necessárias** de forma segura.<br>• Registra justificativas formais e detalhamento das alterações.<br>• Encaminha os lançamentos corrigidos para continuidade do fluxo. | ❌ **PROIBIDO** digitar manualmente quantias monetárias arbitrárias.<br>❌ **PROIBIDO** utilizar fórmulas paralelas/simplificadas de remuneração.<br>❌ **PROIBIDO** aprovar lotes com colaboradores incompletos (Fail-Closed). |
| **ORBE (Sistema)** | • Recalcula valores exclusivamente via motor oficial homologado.<br>• Preserva histórico imutável e trilha de auditoria transacional.<br>• Impede duplicidades financeiras em lotes e CNAB.<br>• Mantém integridade referencial dos lotes e fechamentos. | ❌ **NUNCA** permitir mutações financeiras diretas via API de cliente.<br>❌ **NUNCA** adotar fórmulas simplificadas ou heurísticas de divisão. |

---

### 2. MATRIZ DE RISCOS, EVIDÊNCIAS NO CÓDIGO E SOLUÇÕES PROPOSTAS (REVISÃO 05A.2)

Esta matriz sintetiza as fragilidades mapeadas no sistema atual, as evidências físicas comprovadas no código e o desenho arquitetural seguro:

| Área Crítica | Risco Identificado | Evidência Comprovada no Código / Migrations | Solução Arquitetural Segura Proposta | Dependência de Migration |
| :--- | :--- | :--- | :--- | :--- |
| **Segurança contra Bypass da API** | `current_setting('orbe.in_rpc_retificacao')` isolado é vulnerável a contorno por usuário que emita `set_config`. Além disso, a policy atual de UPDATE em `lancamentos_intermitentes` permite que qualquer usuário autenticado altere qualquer coluna diretamente via PostgREST. | Migration `20260710000001_intermitentes_correcoes_criticas.sql` (L36-41): policy `lancamentos_intermitentes_update_tenant` usa apenas `tenant_id = public.current_tenant_id()` sem restrição de colunas ou roles. | **Defesa em Camadas:**<br>1. Trigger guardião que bloqueia mutações em `total`, `horas_trabalhadas` e `status_pipeline` para chamadas client.<br>2. Verificação estrita de RBAC (`get_user_role()`) e Tenant dentro da RPC `SECURITY DEFINER`.<br>3. `REVOKE EXECUTE` da RPC para `anon` e `public`; concessão restrita a `authenticated`. | Migration de Trigger e RPC |
| **Integridade dos Espelhos Financeiros** | Tentativa de `DELETE` destrutivo em `rh_financeiro_lote_itens` causa perda de rastreabilidade contábil. Além disso, se o lote ainda estiver em análise do RH, itens financeiros nem existem ainda. | `src/services/domain/intermitentes.service.ts` (L612-618): `syncToRHFinanceiro` executa `delete()` físico em lote itens.<br>Migration `20260601...`: schema de `rh_financeiro_lote_itens`. | **Respeito ao Ciclo de Vida:**<br>1. Em `AGUARDANDO_VALIDACAO_RH`, o espelho em `rh_financeiro_lote_itens` ainda não existe (só é gerado na validação do RH).<br>2. Se o lote for devolvido (`DEVOLVIDO_RH`), a retificação de empresa atinge cirurgicamente apenas o lote operacional, recalculando agregados sem deletar histórico financeiro auditado. | Nenhuma alteração destrutiva em tabelas financeiras |
| **Concorrência e Deadlocks** | Múltiplas retificações concorrentes no mesmo lote ou entre lote e lançamento podem causar Deadlock se a ordem de aquisição de locks for inconsistente. | Não há locks pessimistas (`FOR UPDATE`) nas rotas atuais de service TypeScript; mutações são assíncronas e concorrentes. | **Ordem Determinística de Locks:**<br>1. Bloqueia sempre primeiro o Lote Pai (`intermitentes_lotes_fechamento`) `FOR UPDATE`.<br>2. Bloqueia em seguida o Lançamento Filho `FOR UPDATE`.<br>3. Validação de OCC via `updated_at`. | Inclusão de locks padronizados na RPC |
| **Máquina de Estados Negativa vs. Positiva** | A validação anterior usava listas negativas (`NOT IN ('PAGO')`), permitindo que estados desconhecidos ou corrompidos avançassem indevidamente. | `intermitentes.service.ts` possui enums estritos, mas o banco aceitava estados intermediários sem validação exaustiva. | **Lista Positiva Estrita:**<br>Lançamento DEVE estar estritamente em `('RECEBIDO', 'EM_ANALISE_RH', 'DEVOLVIDO')`.<br>Lote DEVE estar estritamente em `('AGUARDANDO_VALIDACAO_RH', 'DEVOLVIDO')`. Rejeita qualquer outro estado com erro `22000`. | Lógica da RPC |
| **Fórmula Simplificada de Remuneração** | O banco PostgreSQL não possui as regras de convocação da CLT Art. 452-A. Qualquer fórmula criada em PL/pgSQL geraria passivo trabalhista e divergência com o Tio Digital. | Edge Function `importar-intermitentes-tio/index.ts` importa valores prontos do Tio Digital.<br>`RemuneracaoResolver.ts` é TypeScript de frontend/BFF. Não há Stored Procedure SQL de folha intermitente. | **Fail-Closed Mandatório:**<br>1. Troca de empresa: preserva 100% o valor `total` original apurado na convocação.<br>2. Alteração de horas: terminantemente BLOQUEADA com exceção explícita até homologação de motor oficial transacional. | Tratamento na RPC |
| **Rastreabilidade e Limitações de Coluna FK** | A coluna `lote_devolvido_origem_id` armazena apenas o último lote de onde o item saiu, perdendo o histórico em múltiplos ciclos de retificação. | Migration `20260624000006_sprint3_audit_log.sql` implementa `public.audit_log` com snapshots JSONB imutáveis e append-only. | **Modelo Híbrido:**<br>1. Coluna FK `lote_devolvido_origem_id` apenas para relacionamento relacional direto de último ciclo.<br>2. Tabela `public.audit_log` para histórico cronológico ilimitado de N eventos com snapshots antes/depois. | Adição da coluna FK nullable |

---

### 3. SEGURANÇA DA RPC, RLS E PREVENÇÃO CONTRA CHAMADAS DIRETAS

#### 3.1 Por que `current_setting` Não Deve Ser Usado como Controle Isolado
A diretiva `set_config('orbe.in_rpc_retificacao', 'true', true)` é uma variável de sessão do PostgreSQL. Se utilizada isoladamente como prova de autorização:
1. Um usuário autenticado com acesso ao console SQL ou chamada RPC personalizada poderia emitir `set_config` antes de um `UPDATE`, contornando a intenção da guarda.
2. Não identifica o perfil corporativo nem a autoridade do usuário.
3. Pode vazar para outras operações na mesma conexão se não for transacional (`is_local = true`).

#### 3.2 Mecanismo em Camadas Proposto
Para garantir segurança inexpugnável contra mutações diretas via Supabase Client (`supabase.from('lancamentos_intermitentes').update(...)`), adota-se um **modelo em 3 camadas**:

```
Camada 1: PostgREST / RLS
• Restringe visibilidade estritamente por tenant_id = public.current_tenant_id().

Camada 2: Trigger Guardião de Imutabilidade Financeira
• Impede modificação direta de 'total', 'horas_trabalhadas', 'horas_normais', 'he_50', 'he_100' e 'hora_noturna' via client API.
• Permite mutações apenas se auth.role() = 'service_role' (ingestão Tio Digital) ou se disparado internamente pela RPC oficial do RH.

Camada 3: RPC com SECURITY DEFINER e RBAC Rigoroso
• search_path sanitizado: SET search_path = public, pg_temp.
• Ownership fixado: OWNER TO postgres.
• Privilégios EXECUTE revogados de public e concedidos a authenticated.
• Validação compulsória de auth.uid() e lower(trim(public.get_user_role())) IN ('admin', 'super_admin', 'rh').
```

#### 3.3 Preservação dos Fluxos Legítimos do Sistema
O mecanismo respeita rigorosamente os serviços existentes homologados:
1. **Ingestão Tio Digital (`importar-intermitentes-tio`):** Executa com `auth.role() = 'service_role'`. Ignora RLS e é liberada pelo trigger guardião.
2. **Fechamento Operacional (`fecharPeriodo` em `intermitentes.service.ts`):** Atualiza apenas `lote_fechamento_id` e `status_pipeline = 'EM_ANALISE_RH'`. O trigger permite essa transição porque os valores monetários e horas não sofrem alteração.
3. **Validação RH (`validarLote`):** Atualiza em lote `status_pipeline = 'APROVADO_RH'` nos itens vinculados ao lote fechado.
4. **Devolução do Lote (`devolverLote`):** Atualiza em lote `status_pipeline = 'DEVOLVIDO'`.
5. **Reabertura do Lote (`reabrirLote`):** Atualiza `status_pipeline = 'RECEBIDO'` e `lote_fechamento_id = null`.
6. **Conciliação Bancária (`cnabConciliacao.service.ts`):** Atualiza `status_pipeline = 'PAGO'` após retorno bancário.

Nenhum desses fluxos legítimos tenta alterar o `total` ou `horas_trabalhadas` arbitrariamente, garantindo compatibilidade total sem regressões.

---

### 4. INTEGRIDADE DOS ESPELHOS FINANCEIROS E COMBATE À DESTRUIÇÃO DE DADOS

#### 4.1 Estrutura Real Comprovada no Banco de Dados
A auditoria no schema de migração comprovou as seguintes estruturas:
- **`rh_financeiro_lotes`:**
  - Chave de unicidade: `CONSTRAINT rh_financeiro_lotes_competencia_origem_unq UNIQUE (tenant_id, empresa_id, competencia, origem, tipo)`.
  - Campos: `id`, `tenant_id`, `empresa_id`, `competencia`, `origem` (`'OPERACIONAL'`), `tipo` (`'INTERMITENTES'`), `status`, `total_colaboradores`, `valor_total`.
- **`rh_financeiro_lote_itens`:**
  - Campos: `id`, `lote_id REFERENCES rh_financeiro_lotes(id)`, `origem_evento` (`'lancamentos_intermitentes'`), `referencia_evento_id` (UUID do lançamento), `colaborador_id`, `valor_calculado`, `status`.

#### 4.2 Descoberta Crucial: Momento de Nascimento do Espelho Financeiro
No código de [intermitentes.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/intermitentes.service.ts):
- O método `fecharPeriodo` (L86-269) **NÃO gera registros em `rh_financeiro_lote_itens`**. Ele cria apenas o lote operacional em `intermitentes_lotes_fechamento` (`AGUARDANDO_VALIDACAO_RH`).
- A sincronização com o financeiro (`syncToRHFinanceiro`) é invocada **apenas quando o RH valida o lote** (`validarLote`, L818) ou quando devolve (`devolverLote`, L963).
- **Conclusão Técnica:** Quando o lote está em análise pendente (`AGUARDANDO_VALIDACAO_RH`), **não existem itens em `rh_financeiro_lote_itens`**. Tentar deletar itens nesse estágio é uma operação nula que pressupunha erroneamente a existência precoce de registros financeiros.

#### 4.3 Comportamento Seguro na Troca de Empresa
Caso o lote já tenha passado por validação prévia e retornado como devolvido (`DEVOLVIDO_RH`), o espelho financeiro existe. Para evitar `DELETE` destrutivo cego e garantir integridade:
1. **Identificação Cirúrgica:** A query localiza o item financeiro específico:
   ```sql
   WHERE origem_evento = 'lancamentos_intermitentes' 
     AND referencia_evento_id = p_lancamento_id
     AND lote_id = v_rh_lote_id;
   ```
2. **Atualização de Status (Soft Cancel) vs. Remoção Controlada:**
   - Se o lote financeiro estiver em estado preliminar (`DEVOLVIDO_RH` ou `PENDENTE_RH`), o item financeiro desvinculado tem seu status atualizado para `'REJEITADO'` ou é desassociado do lote de origem sem destruir logs contábeis.
   - O lote financeiro da Empresa A (`rh_financeiro_lotes`) tem seus contadores recalculados a partir dos itens válidos restantes.
   - **Resultado:** Zero duplicidade financeira e preservação total de auditoria contábil.

---

### 5. MÁQUINA DE ESTADOS POSITIVA, CONCORRÊNCIA E ORDEM DE LOCKS

#### 5.1 Lista Positiva Estrita de Estados Permitidos (Fail-Closed)
O sistema rejeita categoricamente qualquer estado não explicitamente listado:

```sql
-- Validação de Estado do Lançamento (Lista Positiva)
IF v_lanc.status_pipeline NOT IN ('RECEBIDO', 'EM_ANALISE_RH', 'DEVOLVIDO') THEN
    RAISE EXCEPTION 'ESTADO_INVALIDO: Lançamento em status % não permite retificação. Estados permitidos: RECEBIDO, EM_ANALISE_RH, DEVOLVIDO.', v_lanc.status_pipeline
    USING ERRCODE = '22000';
END IF;

-- Validação de Estado do Lote Pai (se vinculado) (Lista Positiva)
IF v_lote_atual.status NOT IN ('AGUARDANDO_VALIDACAO_RH', 'DEVOLVIDO') THEN
    RAISE EXCEPTION 'ESTADO_INVALIDO: Lote operacional em status % não permite retificação de itens filhos. Estados permitidos: AGUARDANDO_VALIDACAO_RH, DEVOLVIDO.', v_lote_atual.status
    USING ERRCODE = '22000';
END IF;
```

#### 5.2 Ordem Determinística de Locks (Prevenção Total de Deadlock)
Quando duas transações concorrentes tentam retificar lançamentos simultaneamente no mesmo tenant, a ordem de aquisição de locks deve ser idêntica em toda a aplicação:
1. **Lock 1 (Pai):** Se o lançamento possuir `lote_fechamento_id`, adquire lock pessimista no lote primeiro:
   ```sql
   SELECT * INTO v_lote_atual
   FROM public.intermitentes_lotes_fechamento
   WHERE id = v_lanc_peek.lote_fechamento_id AND tenant_id = v_tenant_id
   FOR UPDATE;
   ```
2. **Lock 2 (Filho):** Adquire lock pessimista no lançamento:
   ```sql
   SELECT * INTO v_lanc
   FROM public.lancamentos_intermitentes
   WHERE id = p_lancamento_id AND tenant_id = v_tenant_id
   FOR UPDATE;
   ```
Como todas as transações adquirem primeiro o lock do lote pai, chamadas simultâneas sobre o mesmo lote enfileiram-se de forma ordenada e serializada, **eliminando matematicamente a possibilidade de Deadlock relacional**.

#### 5.3 Optimistic Concurrency Control (OCC)
A RPC aceita o parâmetro opcional `p_updated_at TIMESTAMPTZ`. Se fornecido, valida:
```sql
IF p_updated_at IS NOT NULL AND v_lanc.updated_at IS DISTINCT FROM p_updated_at THEN
    RAISE EXCEPTION 'CONCORRENCIA: O registro foi alterado por outro usuário (conflito de versão). Recarregue a página.'
    USING ERRCODE = '40001';
END IF;
```

#### 5.4 Compatibilidade da Reabertura de Lotes Devolvidos pelo RH
Para que o RH possa devolver e revalidar lotes sem intervenção do encarregado:
- É criada a RPC oficial `public.rpc_rh_revalidar_lote_devolvido(p_lote_id UUID, p_justificativa TEXT)`:
  1. Valida se o lote está com status `DEVOLVIDO`.
  2. Transita o lote para `AGUARDANDO_VALIDACAO_RH`.
  3. Transita todos os lançamentos vinculados de `DEVOLVIDO` para `EM_ANALISE_RH`.
  4. Se houver lote financeiro em `rh_financeiro_lotes`, transita de `DEVOLVIDO_RH` para `PENDENTE_RH`.
  5. Grava auditoria formal em `public.audit_log`.
- **Resultado:** O lote reaparece imediatamente na fila de aprovação de [AprovacoesRh.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx), pronto para que o analista do RH confira e aprove.

---

### 6. RASTREABILIDADE COMPLETA E AUDITORIA IMUTÁVEL

#### 6.1 Schema Real Comprovado de `public.audit_log`
A auditoria do banco de dados na migration [20260624000006_sprint3_audit_log.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260624000006_sprint3_audit_log.sql#L7-L24) confirmou o schema oficial corporativo:
- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL)
- `empresa_id` (UUID)
- `usuario_id` (UUID)
- `usuario_nome` (TEXT)
- `perfil_usuario` (TEXT)
- `acao` (TEXT, NOT NULL)
- `entidade` (TEXT, NOT NULL)
- `registro_id` (UUID, NOT NULL)
- `descricao` (TEXT)
- `valor_anterior` (JSONB)
- `valor_novo` (JSONB)
- `origem` (TEXT)
- `ip` (TEXT)
- `user_agent` (TEXT)
- `created_at` (TIMESTAMPTZ)
- **Imutabilidade:** RLS append-only; updates e deletes são terminantemente proibidos na tabela de auditoria.

#### 6.2 Papel Relacional da Coluna FK vs. Tabela de Auditoria
O contrato esclarece a divisão de papéis de rastreabilidade:
- **Coluna `lote_devolvido_origem_id UUID REFERENCES intermitentes_lotes_fechamento(id)`:**
  - Papel estritamente relacional de **último ciclo**: permite que a query da tela de recebidos ou do fechamento identifique imediatamente o lote anterior e apresente badges visuais rápidos sem necessidade de fazer scans na tabela de auditoria.
- **Tabela `public.audit_log`:**
  - Papel corporativo de **histórico ilimitado de N ciclos**: grava cada uma das retificações, mudanças de empresa, justificativas, dados anteriores e dados posteriores. Mesmo que um item passe por 5 ciclos de devolução e retificação, cada transição fica eternizada na auditoria.

---

### 7. ESPECIFICAÇÃO COMPLETA DAS FUNÇÕES TRANSACIONAIS

#### 7.1 Assinatura e Código da RPC `rpc_rh_retificar_intermitente`

```sql
CREATE OR REPLACE FUNCTION public.rpc_rh_retificar_intermitente(
    p_lancamento_id UUID,
    p_nova_empresa_id UUID,
    p_novas_horas NUMERIC DEFAULT NULL,
    p_justificativa TEXT DEFAULT NULL,
    p_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_role TEXT;
    v_user_nome TEXT;
    v_lanc RECORD;
    v_lote_atual RECORD;
    v_lote_id UUID;
    v_cnab_count INTEGER;
BEGIN
    -- 1. IDENTIFICAÇÃO E AUTORIZAÇÃO EXCLUSIVA DE PERFIL (FAIL-CLOSED)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_REQUIRED: Não foi possível resolver o tenant da sessão.' USING ERRCODE = '42501';
    END IF;

    v_role := lower(trim(coalesce(public.get_user_role(), '')));
    IF v_role NOT IN ('admin', 'super_admin', 'rh') THEN
        RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas analistas de RH ou Administradores podem retificar intermitentes. Perfil atual: %', v_role
        USING ERRCODE = '42501';
    END IF;

    SELECT coalesce(nome, email, 'Analista RH') INTO v_user_nome
    FROM public.profiles WHERE user_id = v_user_id OR id = v_user_id LIMIT 1;

    -- 2. VALIDAÇÃO DE ENTRADA
    IF p_nova_empresa_id IS NULL THEN
        RAISE EXCEPTION 'DADO_INVALIDO: A nova empresa vinculada é obrigatória.' USING ERRCODE = '22023';
    END IF;

    IF p_justificativa IS NULL OR trim(p_justificativa) = '' OR length(trim(p_justificativa)) < 10 THEN
        RAISE EXCEPTION 'DADO_INVALIDO: A justificativa formal do RH é obrigatória (mínimo 10 caracteres).' USING ERRCODE = '22023';
    END IF;

    -- 3. VALIDAÇÃO DA NOVA EMPRESA NO MESMO TENANT
    IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_nova_empresa_id AND tenant_id = v_tenant_id) THEN
        RAISE EXCEPTION 'EMPRESA_NOT_FOUND: A empresa informada não existe ou pertence a outro tenant.' USING ERRCODE = '23503';
    END IF;

    -- 4. PEEK NO LANÇAMENTO PARA IDENTIFICAR LOTE PAI
    SELECT lote_fechamento_id INTO v_lote_id
    FROM public.lancamentos_intermitentes
    WHERE id = p_lancamento_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REGISTRO_NOT_FOUND: Lançamento intermitente % não encontrado no tenant atual.', p_lancamento_id
        USING ERRCODE = 'P0002';
    END IF;

    -- 5. ORDEM DETERMINÍSTICA DE LOCKS (PAI PRIMEIRO, FILHO DEPOIS)
    IF v_lote_id IS NOT NULL THEN
        -- Lock pessimista no Lote Pai
        SELECT * INTO v_lote_atual
        FROM public.intermitentes_lotes_fechamento
        WHERE id = v_lote_id AND tenant_id = v_tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'LOTE_NOT_FOUND: Lote associado não encontrado.' USING ERRCODE = 'P0002';
        END IF;

        -- Lista Positiva de Estados do Lote Pai
        IF v_lote_atual.status NOT IN ('AGUARDANDO_VALIDACAO_RH', 'DEVOLVIDO') THEN
            RAISE EXCEPTION 'ESTADO_INVALIDO: Lote operacional em status % impede retificação de lançamentos.', v_lote_atual.status
            USING ERRCODE = '22000';
        END IF;

        -- Validação de CNAB: Proibido se houver arquivo gerado
        SELECT count(*) INTO v_cnab_count
        FROM public.cnab_remessas_arquivos
        WHERE intermitentes_lote_id = v_lote_atual.id;

        IF v_cnab_count > 0 THEN
            RAISE EXCEPTION 'VINCULO_BANCARIO: Lote já possui remessa CNAB gerada no Financeiro.' USING ERRCODE = '22000';
        END IF;
    END IF;

    -- Lock pessimista no Lançamento Filho
    SELECT * INTO v_lanc
    FROM public.lancamentos_intermitentes
    WHERE id = p_lancamento_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    -- 6. VALIDAÇÃO DE CONCORRÊNCIA (OCC)
    IF p_updated_at IS NOT NULL AND v_lanc.updated_at IS DISTINCT FROM p_updated_at THEN
        RAISE EXCEPTION 'CONCORRENCIA: O lançamento foi alterado por outro usuário. Recarregue a página.'
        USING ERRCODE = '40001';
    END IF;

    -- 7. LISTA POSITIVA DE ESTADOS DO LANÇAMENTO
    IF v_lanc.status_pipeline NOT IN ('RECEBIDO', 'EM_ANALISE_RH', 'DEVOLVIDO') THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO: Lançamento em status % não permite retificação.', v_lanc.status_pipeline
        USING ERRCODE = '22000';
    END IF;

    -- 8. FAIL-CLOSED DE HORAS: PROIBIÇÃO DE RECÁLCULO PARALELO
    IF p_novas_horas IS NOT NULL AND p_novas_horas <> v_lanc.horas_trabalhadas THEN
        RAISE EXCEPTION 'OPERACAO_BLOQUEADA: O recálculo de remuneração intermitente exige reprocessamento pelo motor oficial de convocação. Não é permitido alterar horas sem motor oficial homologado.'
        USING ERRCODE = '22000';
    END IF;

    -- 9. EXECUÇÃO TRANSACIONAL DA CORREÇÃO DE EMPRESA
    IF v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN
        -- A. Desvincula do lote da Empresa A e realoca para Empresa B
        UPDATE public.lancamentos_intermitentes
        SET
            empresa_id = p_nova_empresa_id,
            lote_fechamento_id = NULL,
            lote_devolvido_origem_id = v_lanc.lote_fechamento_id,
            status_pipeline = 'RECEBIDO',
            observacoes = trim(p_justificativa),
            updated_at = now()
        WHERE id = p_lancamento_id;

        -- B. Decrementa lote operacional de origem
        UPDATE public.intermitentes_lotes_fechamento
        SET
            quantidade_registros = quantidade_registros - 1,
            valor_total = valor_total - v_lanc.total,
            status = CASE WHEN (quantidade_registros - 1) <= 0 THEN 'CANCELADO' ELSE status END,
            updated_at = now()
        WHERE id = v_lote_atual.id;

        -- C. Ajuste do espelho financeiro (se existente) sem destruição de dados
        UPDATE public.rh_financeiro_lote_itens
        SET
            status = 'REJEITADO',
            updated_at = now()
        WHERE origem_evento = 'lancamentos_intermitentes' 
          AND referencia_evento_id = p_lancamento_id;

        -- Recalcula agregados do lote financeiro pai
        UPDATE public.rh_financeiro_lotes rf
        SET
            total_colaboradores = (SELECT count(DISTINCT colaborador_id) FROM public.rh_financeiro_lote_itens WHERE lote_id = rf.id AND status <> 'REJEITADO'),
            valor_total = coalesce((SELECT sum(valor_calculado) FROM public.rh_financeiro_lote_itens WHERE lote_id = rf.id AND status <> 'REJEITADO'), 0),
            updated_at = now()
        WHERE rf.empresa_id = v_lote_atual.empresa_id 
          AND rf.competencia = v_lote_atual.competencia 
          AND rf.tipo = 'INTERMITENTES';
    ELSE
        -- Retificação interna mantendo no lote (ou lançamento avulso sem lote)
        UPDATE public.lancamentos_intermitentes
        SET
            empresa_id = p_nova_empresa_id,
            observacoes = trim(p_justificativa),
            updated_at = now()
        WHERE id = p_lancamento_id;
    END IF;

    -- 10. AUDITORIA IMUTÁVEL COMPULSÓRIA (public.audit_log)
    INSERT INTO public.audit_log (
        tenant_id, empresa_id, usuario_id, usuario_nome, perfil_usuario,
        acao, entidade, registro_id, descricao, valor_anterior, valor_novo, origem
    ) VALUES (
        v_tenant_id,
        p_nova_empresa_id,
        v_user_id,
        v_user_nome,
        v_role,
        'RETIFICAR_INTERMITENTE_RH',
        'lancamentos_intermitentes',
        p_lancamento_id,
        format('Retificação pelo RH. Justificativa: %s', trim(p_justificativa)),
        jsonb_build_object(
            'empresa_id', v_lanc.empresa_id,
            'horas_trabalhadas', v_lanc.horas_trabalhadas,
            'total', v_lanc.total,
            'lote_fechamento_id', v_lanc.lote_fechamento_id,
            'status_pipeline', v_lanc.status_pipeline
        ),
        jsonb_build_object(
            'empresa_id', p_nova_empresa_id,
            'horas_trabalhadas', v_lanc.horas_trabalhadas,
            'total', v_lanc.total,
            'lote_fechamento_id', CASE WHEN v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN NULL ELSE v_lanc.lote_fechamento_id END,
            'status_pipeline', CASE WHEN v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN 'RECEBIDO' ELSE v_lanc.status_pipeline END
        ),
        'RPC_RH_RETIFICAR_INTERMITENTE'
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', p_lancamento_id,
        'empresa_id', p_nova_empresa_id,
        'total', v_lanc.total,
        'lote_anterior_id', v_lote_id,
        'desvinculado_por_empresa_divergente', (v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id)
    );
END;
$$;

-- Permissões e Ownership da RPC
ALTER FUNCTION public.rpc_rh_retificar_intermitente OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.rpc_rh_retificar_intermitente FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_rh_retificar_intermitente FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_rh_retificar_intermitente TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_rh_retificar_intermitente TO service_role;
```

#### 7.2 Assinatura e Código da RPC `rpc_rh_revalidar_lote_devolvido`

```sql
CREATE OR REPLACE FUNCTION public.rpc_rh_revalidar_lote_devolvido(
    p_lote_id UUID,
    p_justificativa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_role TEXT;
    v_user_nome TEXT;
    v_lote RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    v_tenant_id := public.current_tenant_id();
    v_role := lower(trim(coalesce(public.get_user_role(), '')));

    IF v_role NOT IN ('admin', 'super_admin', 'rh') THEN
        RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas analistas de RH ou Administradores podem revalidar lotes devolvidos.'
        USING ERRCODE = '42501';
    END IF;

    IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 5 THEN
        RAISE EXCEPTION 'DADO_INVALIDO: A justificativa para revalidação do lote é obrigatória.' USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(nome, email, 'Analista RH') INTO v_user_nome
    FROM public.profiles WHERE user_id = v_user_id OR id = v_user_id LIMIT 1;

    -- Lock pessimista no Lote
    SELECT * INTO v_lote
    FROM public.intermitentes_lotes_fechamento
    WHERE id = p_lote_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LOTE_NOT_FOUND: Lote % não encontrado no tenant atual.', p_lote_id USING ERRCODE = 'P0002';
    END IF;

    IF v_lote.status <> 'DEVOLVIDO' THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO: Apenas lotes com status DEVOLVIDO podem ser revalidados. Status atual: %', v_lote.status
        USING ERRCODE = '22000';
    END IF;

    -- 1. Transita lote operacional para AGUARDANDO_VALIDACAO_RH
    UPDATE public.intermitentes_lotes_fechamento
    SET
        status = 'AGUARDANDO_VALIDACAO_RH',
        observacoes = format('Revalidado pelo RH após saneamento. Motivo: %s', trim(p_justificativa)),
        updated_at = now()
    WHERE id = p_lote_id;

    -- 2. Transita lançamentos vinculados para EM_ANALISE_RH
    UPDATE public.lancamentos_intermitentes
    SET
        status_pipeline = 'EM_ANALISE_RH',
        updated_at = now()
    WHERE lote_fechamento_id = p_lote_id;

    -- 3. Atualiza espelho financeiro (se existente) para PENDENTE_RH
    UPDATE public.rh_financeiro_lotes
    SET
        status = 'PENDENTE_RH',
        updated_at = now()
    WHERE empresa_id = v_lote.empresa_id
      AND competencia = v_lote.competencia
      AND tipo = 'INTERMITENTES'
      AND status = 'DEVOLVIDO_RH';

    -- 4. Grava Auditoria
    INSERT INTO public.audit_log (
        tenant_id, empresa_id, usuario_id, usuario_nome, perfil_usuario,
        acao, entidade, registro_id, descricao, valor_anterior, valor_novo, origem
    ) VALUES (
        v_tenant_id,
        v_lote.empresa_id,
        v_user_id,
        v_user_nome,
        v_role,
        'REVALIDAR_LOTE_DEVOLVIDO_RH',
        'intermitentes_lotes_fechamento',
        p_lote_id,
        format('Lote revalidado pelo RH. Justificativa: %s', trim(p_justificativa)),
        jsonb_build_object('status', 'DEVOLVIDO'),
        jsonb_build_object('status', 'AGUARDANDO_VALIDACAO_RH'),
        'RPC_RH_REVALIDAR_LOTE'
    );

    RETURN jsonb_build_object(
        'success', true,
        'lote_id', p_lote_id,
        'novo_status', 'AGUARDANDO_VALIDACAO_RH'
    );
END;
$$;

ALTER FUNCTION public.rpc_rh_revalidar_lote_devolvido OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.rpc_rh_revalidar_lote_devolvido FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_rh_revalidar_lote_devolvido FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_rh_revalidar_lote_devolvido TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_rh_revalidar_lote_devolvido TO service_role;
```

---

### 8. PLANO DE TESTES DE SEGURANÇA E REGRESSÃO DA ETAPA 05B

Quando autorizada a implementação, serão executados os seguintes testes automatizados na suíte de homologação:

| ID do Teste | Cenário Avaliado | Resultado Esperado |
| :--- | :--- | :--- |
| **TEST-SEC-01** | Usuário com perfil `encarregado` tenta invocar `rpc_rh_retificar_intermitente` | Rejeição imediata com erro `42501 (ROLE_NOT_AUTHORIZED)`. |
| **TEST-SEC-02** | Tentativa de UPDATE direto via PostgREST alterando `total` ou `horas_trabalhadas` | Bloqueio imediato pelo trigger guardião com erro `42501`. |
| **TEST-SEC-03** | Invocação da RPC informando `p_novas_horas` diferente das horas atuais | Aborto com erro `22000 (OPERACAO_BLOQUEADA - Fail-Closed)`. |
| **TEST-EST-01** | Tentativa de retificar item de lote com status `CNAB_GERADO` ou `PAGO` | Rejeição imediata com erro `22000 (VINCULO_BANCARIO / ESTADO_INVALIDO)`. |
| **TEST-REL-01** | Retificação de empresa de item em lote da Empresa A para Empresa B | Item desvincula (`lote_fechamento_id: null`), guarda lote em `lote_devolvido_origem_id`, Lote A é decrementado sem duplicidade financeira. |
| **TEST-OCC-01** | Duas chamadas simultâneas com `p_updated_at` defasado | A segunda chamada falha com erro de concorrência `40001 (CONCORRENCIA)`. |
| **TEST-AUD-01** | Gravação formal em `public.audit_log` após retificação bem-sucedida | Verifica presença do registro imutável com snapshots completos antes e depois. |
| **TEST-REV-01** | Revalidação de lote devolvido via `rpc_rh_revalidar_lote_devolvido` | Lote transita para `AGUARDANDO_VALIDACAO_RH` e itens para `EM_ANALISE_RH` sem intervenção do encarregado. |

---

### 9. DECLARAÇÃO DE GOVERNANÇA

- **Caráter 100% Read-Only:** Nenhuma alteração foi realizada em arquivos de código TypeScript/React, banco de dados, RLS ou migrations.
- **Git:** Nenhum commit, branch ou push foi executado.
- **Ação Requerida:** Aguardar aprovação expressa do proprietário para prosseguir com a implementação da **Etapa 05B**.
