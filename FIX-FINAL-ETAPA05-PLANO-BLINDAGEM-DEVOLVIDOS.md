# ERP ORBE — FIX-FINAL / ETAPA 05
## Plano de Blindagem da Edição de Intermitentes Devolvidos

**Data:** 11 de Outubro de 2026  
**Status:** 📋 PLANEJAMENTO E DIAGNÓSTICO CONCLUÍDOS — AGUARDANDO AUTORIZAÇÃO  
**Caráter da Etapa:** 100% Read-Only (Nenhuma alteração em código, banco, RLS ou migrations foi realizada)  
**Entrega:** `FIX-FINAL-ETAPA05-PLANO-BLINDAGEM-DEVOLVIDOS.md`  

---

### FASE 1 — DIAGNÓSTICO TÉCNICO OBRIGATÓRIO

#### 1. Mapeamento das Chamadas que Modificam `lancamentos_intermitentes`

A tabela canônica `lancamentos_intermitentes` é manipulada por fluxos específicos no ciclo de vida do ERP:

| Ponto de Chamada / Arquivo | Operação | Status / Campos Alterados | Contexto Operacional |
| :--- | :--- | :--- | :--- |
| `importar-intermitentes-tio/index.ts` (Edge Function) | `INSERT` / `UPDATE` | `status_pipeline = 'RECEBIDO'` ou `'DEVOLVIDO'`, horas, total | Ingestão diária de convocações do Tio Digital. Se departamento/empresa não for resolvido, entra como `DEVOLVIDO`. |
| `intermitentes.service.ts` (`fecharPeriodo`) | `UPDATE` | `status_pipeline = 'DEVOLVIDO'` | Lançamentos com `empresa_id: null` são devolvidos antes do fechamento. |
| `intermitentes.service.ts` (`fecharPeriodo`) | `UPDATE` | `status_pipeline = 'EM_LOTE'`, `lote_fechamento_id = loteId` | Agrupamento dos lançamentos válidos no lote fechado. |
| `intermitentes.service.ts` (`sincronizarStatusLote`) | `UPDATE` | `status_pipeline = targetStatus` | Sincronização do status operacional dos lançamentos com o lote. |
| `intermitentes.service.ts` (`aprovarLote`) | `UPDATE` | `status_pipeline = 'APROVADO_RH'` | Homologação formal pelo analista de RH no painel de aprovações. |
| `intermitentes.service.ts` (`devolverLote`) | `UPDATE` | `status_pipeline = 'DEVOLVIDO'` | Validador do RH rejeita/devolve o lote informando observação. |
| `intermitentes.service.ts` (`reabrirLote`) | `UPDATE` | `status_pipeline = 'RECEBIDO'`, `lote_fechamento_id = null` | Desfaz o lote inteiro e cancela `intermitentes_lotes_fechamento`. |
| `cnabConciliacao.service.ts` (`processarBaixaAutomatica`) | `UPDATE` | `status_pipeline = 'PAGO'` | Liquidação final pós-retorno bancário (.RET). |
| `intermitentes.service.ts` (`atualizarLancamento`) 🚨 | `UPDATE` | `...payload`, `updated_at` | **MUTATION EXPOSTA:** Disparada pelo modal de edição em [IntermitentesRecebidos.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesRecebidos.tsx). Atualiza livremente `empresa_id`, `horas_trabalhadas`, `total` e `status_pipeline = 'RECEBIDO'`. |

---

#### 2. Permissões Efetivas no Banco e Políticas RLS

Na migration oficial [20260710000001_intermitentes_correcoes_criticas.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260710000001_intermitentes_correcoes_criticas.sql#L36-L41):
```sql
CREATE POLICY "lancamentos_intermitentes_update_tenant"
ON public.lancamentos_intermitentes
FOR UPDATE
TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());
```

**Diagnóstico de Segurança do RLS:**
- A política apenas valida que o usuário pertence ao mesmo `tenant_id`.
- **Não há restrição por Role:** Qualquer usuário autenticado (Encarregado, Operador, Usuário comum) tem permissão de `UPDATE` concedida no banco de dados.
- **Não há restrição de Colunas:** Qualquer coluna da tabela pode ser modificada diretamente via cliente Supabase (inclusive `total`, `status_pipeline`, `lote_fechamento_id`).
- **Não há restrição de Máquina de Estados:** Não há `CHECK` impedindo modificação de registros que já estejam em estados terminais (`APROVADO_RH`, `CNAB_GERADO`, `PAGO`).

---

#### 3. Como o RH Devolve Lançamentos e Lotes

- No módulo de RH ([AprovacoesRh.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx)), o analista de RH confere o lote e, ao identificar inconsistência, rejeita/devolve com justificativa (`observacao`).
- A devolução aciona `IntermitentesLoteService.devolverLote`:
  1. `intermitentes_lotes_fechamento` recebe `status = 'DEVOLVIDO', observacoes = observacao`.
  2. Todos os lançamentos vinculados recebem `status_pipeline = 'DEVOLVIDO'`.
  3. O espelho financeiro em `rh_financeiro_lotes` é devolvido via `RHFinanceiroService.devolverAoRH`.
  4. **Ponto Crítico:** Na devolução, **`lote_fechamento_id` é mantido preenchido** em `lancamentos_intermitentes`. O lançamento continua formalmente apontando para o lote devolvido.

---

#### 4. Relação entre Lote Original, Lançamento Devolvido e Novo Fechamento

Na função oficial de fechamento (`fecharPeriodo` em [intermitentes.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/intermitentes.service.ts#L125-L132)):
```typescript
let query = supabase
  .from('lancamentos_intermitentes')
  .select('id, total, empresa_id')
  .eq('status_pipeline', 'RECEBIDO')
  .is('lote_fechamento_id', null) // 🚨 FILTRO OBRIGATÓRIO
  .gte('data_referencia', params.periodoInicio)
  .lte('data_referencia', params.periodoFim)
  .eq('empresa_id', params.empresaId);
```

**O Gargalo Oculto:**
1. Quando um lançamento é devolvido, ele possui `lote_fechamento_id = 'lote-original-uuid'`.
2. O modal atual de retificação salva `status_pipeline = 'RECEBIDO'`, mas **não altera `lote_fechamento_id`**.
3. Quando o encarregado tenta fechar o período na tela principal, o lançamento **não é capturado** pela query acima, pois `lote_fechamento_id` NÃO é nulo.
4. O lançamento fica preso em um limbo: aparece em "Pendentes", mas é impossível de fechar.
5. Se forçado para `lote_fechamento_id = null` sem registrar o lote original, perde-se a rastreabilidade da devolução e a correspondência com os dados do lote que foi rejeitado.

---

#### 5. Motor Oficial de Cálculo e Regras de Recálculo

- **Origem dos Valores:** Os intermitentes possuem remuneração apurada por convocação física no coletor/Tio Digital, contendo jornada, adicionais e total.
- **Risco Atual no Frontend:** O modal em [IntermitentesRecebidos.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesRecebidos.tsx#L949) expõe:
  ```tsx
  <Input
    value={editTotal}
    onChange={(e) => setEditTotal(e.target.value)}
    placeholder="Ex: 120,00"
  />
  ```
  Isso permite ao operador digitar manualmente qualquer quantia arbitrária em reais.
- **Regra de Recálculo Oficial:**
  - Caso a retificação seja puramente cadastral (atribuir `empresa_id` ou associar colaborador), o valor financeiro `total` original **deve ser preservado integralmente** sem alteração manual.
  - Caso haja retificação justificada de horas trabalhadas (por erro físico no relógio), o total financeiro **deve ser recalculado matematicamente pelo sistema**:
    $$\text{Taxa Hora} = \frac{\text{Total Original}}{\text{Horas Trabalhadas Originais}}$$
    $$\text{Novo Total} = \text{Novas Horas} \times \text{Taxa Hora}$$
    *(Ou pelo valor_base cadastrado do cargo/função do colaborador em `colaboradores`).*
  - O Encarregado **nunca deve ter permissão para digitar o valor total em dinheiro**.

---

#### 6. Mecanismo Atual de Versionamento / Histórico

- A tabela `lancamentos_intermitentes` possui apenas `created_at` e `updated_at`.
- **Não existe tabela de histórico/snapshots** para retificações de intermitentes.
- `atualizarLancamento` **não invoca `AuditoriaService.log()`**. Nenhuma auditoria é gerada quando um registro é retificado.

---

#### 7. Efeitos em RH, Financeiro e CNAB

- **RH:** Se um lançamento já homologado for modificado, o espelho do lote validado fica descompassado com os lançamentos de origem.
- **Financeiro (`rh_financeiro_lotes`):** O montante financeiro consolidado foi gravado no fechamento. Se lançamentos filhos tiverem o `total` alterado posteriormente, a soma dos itens diverge do total do lote financeiro.
- **CNAB:** Se a alteração ocorrer em lançamentos já remetidos (`CNAB_GERADO`) ou pagos (`PAGO`), o arquivo bancário transmitido não bate com a base, comprometendo a prestação de contas.

---

### FASE 2 — PROPOSTA DE CORREÇÃO DETALHADA

#### A. Proteção da Remuneração
1. **Blindagem no Frontend ([IntermitentesRecebidos.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesRecebidos.tsx)):**
   - **Remover o campo editável de `Valor Total (R$)`**.
   - Exibir o valor total apenas como `<div className="text-xs font-mono text-muted-foreground">` (somente leitura informativa).
   - Manter editável a **Empresa / Operação** (`empresa_id`).
   - Se houver retificação de horas trabalhadas, o cálculo do novo total deve ser exibido como prévia calculada automaticamente, bloqueada para digitação manual.
2. **Blindagem no Backend / Service ([intermitentes.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/intermitentes.service.ts)):**
   - Rejeitar qualquer payload que passe `total` arbitrário vindo do frontend de operadores/encarregados.
   - Recalcular `total` exclusivamente no backend com base na taxa/hora oficial.

#### B. Correção dos Devolvidos e Ciclo de Vida
1. **Desvinculação Segura de Lote:**
   - Ao retificar um item com `status_pipeline = 'DEVOLVIDO'`:
     - Armazenar o lote original em coluna de histórico/metadados (`lote_devolvido_origem_id` ou campo `historico_devolucao`).
     - Setar `lote_fechamento_id = null`.
     - Setar `status_pipeline = 'RECEBIDO'`.
   - Isso permite que o item corrigido entre legitimamente no próximo `fecharPeriodo` e seja submetido a um **novo ciclo completo de validação pelo RH**.
2. **Bloqueio de Estados Não Permissivos:**
   - O service deve consultar o status atual no banco antes de qualquer update.
   - Se o status atual for `APROVADO_RH`, `ENVIADO_FINANCEIRO`, `FECHADO_FINANCEIRO`, `CNAB_GERADO`, `PAGO` ou `CANCELADO`, a operação **deve ser sumariamente rejeitada** com erro explícito (`403 Forbidden: Lançamento em estado imutável`).

#### C. Autorização e Controle de Acesso
1. **Controle no Servidor:**
   - Verificar autenticação e permissão de módulo (`operacoes_recebidas: editar`) via `userAuth`.
   - Garantir que o Encarregado só possa retificar lançamentos nos status `RECEBIDO` ou `DEVOLVIDO` dentro da sua filial/operação autorizada.
2. **Isolamento de Tenant:**
   - Manter e reforçar `tenant_id = current_tenant_id()`.

#### D. Auditoria e Rastreabilidade
1. **Gravação Obrigatória no Log de Auditoria:**
   - Inserir chamada obrigatória a `AuditoriaService.log()` contendo:
     - `acao`: `'RETIFICAR_INTERMITENTE_DEVOLVIDO'`
     - `entidade`: `'lancamentos_intermitentes'`
     - `registro_id`: `id`
     - `payload`: `{ lote_origem_id, valores_anteriores: { horas, total, empresa_id }, valores_novos: { horas, total, empresa_id }, justificativa }`
   - O campo **"Justificativa da Correção"** deve se tornar **obrigatório** no modal do frontend.

---

### FASE 3 — PONTO DE DECISÃO E ALTERAÇÕES ESTRUTURAIS

> ⚠️ **ATENÇÃO — PARADA OBRIGATÓRIA DE IMPLEMENTAÇÃO**  
> Para que a blindagem seja **arquiteturalmente íntegra** e não apenas um remendo visual de frontend, são necessárias as seguintes alterações de infraestrutura de banco de dados:

1. **Alteração Estrutural (Schema):**
   - Adicionar a coluna `lote_devolvido_origem_id UUID REFERENCES intermitentes_lotes_fechamento(id)` na tabela `lancamentos_intermitentes` (ou coluna `metadata JSONB` para rastreabilidade de devoluções).
   - Sem essa coluna, ou perdemos o vínculo histórico com o lote que foi devolvido pelo RH, ou deixamos o registro preso impedindo novo fechamento.

2. **Hardening de RLS / Constraints (Banco de Dados):**
   - Atualizar a policy RLS `lancamentos_intermitentes_update_tenant` para restringir updates quando `status_pipeline IN ('PAGO', 'CNAB_GERADO', 'APROVADO_RH')`.
   - Ou criar uma RPC transacional dedicada (`retificar_intermitente_devolvido`) com `SECURITY DEFINER` que executa as validações, recálculo, atualização e auditoria de forma atômica.

**AÇÃO:** Conforme regra mandatória do projeto, a implementação está **interrompida** aguardando autorização do proprietário para elaboração da migration e implementação segura.

---

### FASE 4 — PLANO DE TESTES E CENÁRIOS DE VALIDAÇÃO

Serão implementados os seguintes cenários de testes automatizados na fase de homologação da Etapa 05:

| ID | Cenário de Teste | Comportamento Esperado |
| :--- | :--- | :--- |
| **TEST-01** | Encarregado corrigindo lançamento devolvido | Permite selecionar empresa e ajustar horas; desvincula do lote anterior e move para `RECEBIDO`. |
| **TEST-02** | Tentativa de alterar remuneração manualmente | Modal não oferece input manual de R$; payload com `total` forçado é recalculado/rejeitado pelo backend. |
| **TEST-03** | Tentativa de editar lançamento pago (`PAGO`) | Backend bloqueia com exceção imediata; interface não exibe botão de ação. |
| **TEST-04** | Tentativa de editar lançamento aprovado (`APROVADO_RH`) | Backend bloqueia alteração de registros já homologados pelo RH. |
| **TEST-05** | Tentativa de modificar lançamento de outro tenant | RLS e query barram a alteração com erro de isolamento. |
| **TEST-06** | Retificação de horas com recálculo proporcional | Alteração de horas recalcula automaticamente o `total` baseado no valor/hora contratual. |
| **TEST-07** | Preservação de rastreabilidade do lote anterior | Registro guarda referência do lote devolvido (`lote_devolvido_origem_id`), mantendo histórico. |
| **TEST-08** | Novo fechamento sem duplicidade | `fecharPeriodo` agrupa o item retificado em um novo lote e submete à nova validação pelo RH. |
| **TEST-09** | Falha no registro de auditoria | Transação aborta caso o registro em `AuditoriaService` falhe, garantindo consistência estrita. |

---

### 5. ARQUIVOS ENVOLVIDOS NA FUTURA IMPLEMENTAÇÃO

1. **Migration / Banco:**
   - `supabase/migrations/20261011_blindagem_edicao_intermitentes_devolvidos.sql` (Criação de `lote_devolvido_origem_id` e hardening de RLS/RPC).
2. **Frontend:**
   - [src/pages/Operacional/IntermitentesRecebidos.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesRecebidos.tsx) (Remoção do input manual de R$, inclusão de campo de justificativa obrigatório e exibição de valor calculado).
3. **Service / Domínio:**
   - [src/services/domain/intermitentes.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/intermitentes.service.ts) (Validação de status permitidos, recálculo matemático de remuneração, desvinculação segura de lote e chamada obrigatória de auditoria).
4. **Testes Automatizados:**
   - `src/test/fix_int_etapa05_blindagem_devolvidos.test.tsx` (Suíte completa cobrindo os cenários TEST-01 a TEST-09).

---

### 6. DECLARAÇÃO DE GOVERNANÇA

- Nenhuma alteração foi realizada em código ou banco de dados.
- Nenhum commit, branch, push ou deploy foi executado.
- Aguardando expressa autorização do proprietário para prosseguir com a implementação da Etapa 05.
