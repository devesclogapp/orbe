# ERP ORBE — FIX-FINAL / ETAPA 04B
## Relatório de Auditoria de Edição de Lançamentos Intermitentes Devolvidos

**Data:** 11 de Outubro de 2026  
**Status da Auditoria:** ⚠️ CONCLUÍDA — RISCOS E INCONSISTÊNCIAS IDENTIFICADOS  
**Caráter da Etapa:** 100% READ-ONLY (Nenhum código, migration, RLS ou permissão foi alterado)  
**Arquivos Auditados:**
- [IntermitentesRecebidos.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesRecebidos.tsx)
- [IntermitentesTableBlock.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/operacoes/IntermitentesTableBlock.tsx)
- [intermitentes.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/intermitentes.service.ts)
- [access-control.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/lib/access-control.ts)
- [20260710000001_intermitentes_correcoes_criticas.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260710000001_intermitentes_correcoes_criticas.sql)

---

### 1. RESUMO EXECUTIVO

A FIX-INT-04 habilitou a ação `onEdit` para a aba dedicada de lançamentos **Devolvidos** em `IntermitentesRecebidos.tsx` (`activeTab === 'pendentes' || activeTab === 'devolvidos'`).

A presente auditoria técnica identificou que a FIX-INT-04 **reutilizou um fluxo pré-existente de edição** (que já existia para a aba de Pendentes). Entretanto, **esse fluxo herdado possui fragilidades conceituais, de governança e de segurança**:

1. **Adulteração Manual de Remuneração:** O modal expõe um campo de texto livre de **"Valor Total (R$)"**, permitindo ao operador alterar diretamente o valor financeiro do lançamento, violando o princípio de remuneração calculada automaticamente a partir das regras operacionais.
2. **Inconsistência de Lote (`lote_fechamento_id` não limpo):** Lançamentos devolvidos pertenciam originalmente a um lote. Ao salvar a edição, o service atualiza `status_pipeline = 'RECEBIDO'`, mas **não anula `lote_fechamento_id`**. Como a função de fechamento (`fecharPeriodo`) exige estritamente `.is('lote_fechamento_id', null)`, o lançamento retificado fica órfão e **impossibilitado de entrar no próximo lote de fechamento**.
3. **Ausência de Trilha de Auditoria:** O método `atualizarLancamento` no service **não registra nenhum log em `AuditoriaService`**.
4. **Ausência de RBAC no Backend e RLS Permissivo:** O método `atualizarLancamento` apenas valida se o usuário está autenticado (`auth.getUser()`), sem validar perfil (Encarregado vs. RH vs. Admin) e sem validar se o lançamento está em status terminal (`APROVADO_RH`, `PAGO`). A policy RLS do banco autoriza qualquer `UPDATE` por usuário autenticado do mesmo tenant.

---

### 2. MAPEAMENTO COMPLETO DO FLUXO ATUAL

```
[Portal / Tela de Intermitentes] ➔ Rota: /operacional/intermitentes
   │
   ├─► Aba "Devolvidos" (activeTab === 'devolvidos')
   │      │
   │      └─► Linha da Tabela (IntermitentesTableBlock)
   │             │
   │             └─► Botão com Ícone de Lápis (onEdit)
   │                    │
   │                    ▼
   │          [Modal: Corrigir Registro Intermitente]
   │             - Select: Empresa / Operação (editEmpresaId)
   │             - Input: Horas Trabalhadas (editHoras) ⚠️ Texto livre
   │             - Input: Valor Total R$ (editTotal) 🚨 Digitação manual financeira
   │                    │
   │                    ▼ Botão: "Salvar Correção"
   │          [Mutation editItemMutation]
   │             │
   │             ▼
   │          [IntermitentesLoteService.atualizarLancamento(id, payload)]
   │             - Apenas verifica auth.getUser() (Sem check de Role)
   │             - Não valida status atual no banco (Pode alterar PAGO/APROVADO)
   │             - Não limpa lote_fechamento_id (Causa limbo operacional)
   │             - Não chama AuditoriaService.log (Zero rastreabilidade)
   │                    │
   │                    ▼
   │          [Supabase: UPDATE lancamentos_intermitentes]
   │             - RLS: Apenas tenant_id = current_tenant_id()
   │             - Colunas gravadas: empresa_id, total, horas_trabalhadas, status_pipeline='RECEBIDO'
```

#### 2.1. Componente Aberto por `onEdit`
- Componente: `<Dialog>` em [IntermitentesRecebidos.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesRecebidos.tsx#L911-L1000).
- Título: *"Corrigir Registro Intermitente"*.
- Subtítulo: *"Para validar no fluxo oficial, o colaborador {nome} precisa ter uma empresa vinculada."*
- Ação Secundária: Botão *"Completar no RH" / "Cadastrar no RH"*, que navega para `/colaboradores` passando `openEditId` ou `initialName`.

#### 2.2. Campos Efetivamente Editáveis no Modal
- `empresa_id`: `<Select>` com a lista de empresas ativas do tenant.
- `horas_trabalhadas`: `<Input>` de texto livre (permite qualquer número decimal).
- `total`: `<Input>` de texto livre (permite qualquer valor monetário em reais).

#### 2.3. Perfis com Acesso à Ação
- **No Frontend:** A rota `/operacional/intermitentes` é protegida por `AuthGuard`. No preset [access-control.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/lib/access-control.ts#L184), ela está vinculada ao módulo `operacoes_recebidas`.
  - Roles com permissão padrão em `operacoes_recebidas`: `admin` e `gestor`.
  - Encarregados possuem acesso caso atribuído no perfil operacional.
  - Dentro do componente [IntermitentesRecebidos.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesRecebidos.tsx), **não há checagem de role**: qualquer usuário que acesse a página vê e pode disparar o modal.
- **No Backend/Service:** Qualquer usuário autenticado no tenant tem permissão irrestrita.

#### 2.4. Validações no Frontend
- Apenas conversão de formatação: `parseFloat(editTotal.replace(",", ".")) || 0` e `parseFloat(editHoras.replace(",", ".")) || 0`.
- Não há validação de limites de jornada (ex: horas > 24h ou negativas).
- Não há recálculo baseado no valor/hora contratual do colaborador.

#### 2.5. Validações no Service / Backend
- Em `IntermitentesLoteService.atualizarLancamento(id, payload)`:
  ```typescript
  const { data: userAuth } = await this.supabase.auth.getUser();
  if (!userAuth?.user) throw new Error("Usuário não autenticado.");
  ```
  - **Zero validação de perfil (Role).**
  - **Zero validação de estado (Status).**
  - **Zero verificação de integridade de lote.**

#### 2.6. Trilha de Auditoria
- **Nenhum log é gerado.** A chamada não utiliza `AuditoriaService.log()`, nem grava evento na tabela de auditoria ou snapshots dos valores anteriores.

---

### 3. CLASSIFICAÇÃO DOS CAMPOS DE `lancamentos_intermitentes`

| Campo | Classificação de Governança | Justificativa Técnica / Regra Operacional |
| :--- | :--- | :--- |
| `id` | **Somente leitura** | Chave primária UUID gerada pelo PostgreSQL. |
| `tenant_id` | **Somente leitura** | Isolamento de governança multi-tenant gerenciado pelo sistema. |
| `data_referencia` | **Somente leitura** | Data da jornada física importada da automação do Tio Digital. |
| `colaborador_id` | **Exclusivo RH/Admin** | Entidade oficial de RH; vínculo deve ser feito pelo cadastro do colaborador. |
| `nome_colaborador` | **Somente leitura** | Nome original importado na convocação. |
| `cpf_colaborador` | **Somente leitura** | CPF da convocação (usado para conciliação bancária futura). |
| `cargo` | **Somente leitura** | Cargo/função de operação constante na convocação. |
| `departamento` | **Somente leitura** | Departamento/setor operacional de atuação. |
| `convocacao` | **Somente leitura** | Identificador único da convocação no Tio Digital. |
| `empresa_id` | **Permitido ao Encarregado** | **Válido para retificação:** Quando a convocação vem sem empresa, o encarregado deve poder selecionar a filial onde a operação ocorreu. |
| `horas_trabalhadas` | **Dependente de decisão funcional** | Se o apontamento de relógio teve erro material, pode ser retificado operacionalmente, mas **deve disparar recálculo automático** das faixas de horas normais/extras e do total financeiro. |
| `horas_normais` | **Calculado automaticamente** | Derivado das regras contratuais (até 8 horas diárias). |
| `he_50` | **Calculado automaticamente** | Derivado do excedente de jornada em dias úteis/sábados. |
| `he_100` | **Calculado automaticamente** | Derivado das horas trabalhadas em domingos/feriados. |
| `hora_noturna` | **Calculado automaticamente** | Derivado de batidas em horário noturno (22h às 05h). |
| `total` (Remuneração R$) | **Calculado automaticamente** | 🚨 **RISCO CRÍTICO:** **NÃO DEVE SER EDITADO LIVREMENTE**. O valor deve ser resultado estrito de `(horas × valor_hora_cargo) + adicionais`. A edição manual permite fraude financeira ou erro de digitação. |
| `status_pipeline` | **Controlado por Máquina de Estados** | Transição controlada: deve transitar de `DEVOLVIDO` para `RECEBIDO` somente mediante retificação válida. |
| `motivo_devolucao` | **Exclusivo RH/Admin** | Justificativa do apontamento inconsistente lavrada pelo validador do RH. |
| `lote_fechamento_id` | **Controlado por Motor Operacional** | Deve ser explicitamente limpo (`null`) quando o item devolvido for liberado para novo fechamento. |
| `observacoes` | **Permitido ao Encarregado** | Justificativa textual da correção realizada. |

---

### 4. DIAGNÓSTICO DE SEGURANÇA E INTEGRIDADE DE DADOS

#### 4.1. Fragilidade 01 — Bloqueio Silencioso de Fechamento (`lote_fechamento_id`)
Na regra do motor de intermitentes ([intermitentes.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/intermitentes.service.ts#L125-L132)), a query de fechamento exige:
```typescript
let query = supabase
  .from('lancamentos_intermitentes')
  .select('id, total, empresa_id')
  .eq('status_pipeline', 'RECEBIDO')
  .is('lote_fechamento_id', null) // 🚨 EXIGE NULL
  ...
```
- Quando um lote é devolvido pelo RH via `devolverLote`, os lançamentos ficam com `status_pipeline = 'DEVOLVIDO'`, mas **mantêm o `lote_fechamento_id`** do lote devolvido.
- Ao salvar a correção no modal atual, o service atualiza `status_pipeline = 'RECEBIDO'`, mas **não altera `lote_fechamento_id`**.
- **Impacto:** O registro passa para a aba "Pendentes", mas **nunca é agrupado no próximo lote**, ficando invisível para fechamento até que haja intervenção direta no banco.

#### 4.2. Fragilidade 02 — Adulteração de Remuneração Financeira
- O formulário do modal permite que qualquer operador informe `total = "5000,00"` para um colaborador que trabalhou 4 horas.
- O service persiste esse valor diretamente no banco sem recalcular pela tabela de remuneração ou salário-base.
- **Impacto:** Quebra a regra fundamental de que o Encarregado não define valores financeiros, apenas fatos operacionais.

#### 4.3. Fragilidade 03 — Ausência de Travamento de Estados Terminais
- O método `atualizarLancamento(id, payload)` aceita qualquer `id` e executa um `update` direto.
- Se uma requisição for forjada com o `id` de um lançamento já `APROVADO_RH`, `CNAB_GERADO` ou `PAGO`, o banco aceitará a alteração de horas e valores.
- O RLS (`lancamentos_intermitentes_update_tenant`) valida apenas `tenant_id`, não verificando se o registro já está quitado ou homologado.

#### 4.4. Fragilidade 04 — Falta de Rastreabilidade (Auditoria)
- Alterações em dados de folha e remuneração após devolução pelo RH são eventos de alta sensibilidade de governança.
- O salvamento atual não registra quem alterou, quando alterou, quais campos mudaram (antes/depois) e qual a justificativa da retificação.

---

### 5. RESPOSTA À PERGUNTA CENTRAL DA AUDITORIA

> **"A FIX-INT-04 introduziu uma ampliação indevida de permissões ou apenas reutilizou um fluxo seguro já existente?"**

**Veredito Oficial:**
A FIX-INT-04 **não criou uma nova rota ou mecanismo de mutação**: ela simplesmente reutilizou a prop `onEdit` e o modal de edição que já existiam na tela de `IntermitentesRecebidos.tsx`.

Entretanto, **o fluxo herdado NÃO era seguro**:
1. Ele foi concebido originalmente como uma correção rápida de cadastro (vincular `empresa_id` faltante).
2. Porém, mantinha campos de digitação livre de `total` financeiro e `horas_trabalhadas`.
3. Ao ser habilitado para lançamentos devolvidos na FIX-INT-04, esse fluxo herdou as vulnerabilidades e introduziu o efeito colateral de não limpar `lote_fechamento_id`, gerando risco de bloqueio operacional no novo fechamento.

---

### 6. PLANO DE CORREÇÃO RECOMENDADO (PARA ETAPAS FUTURAS)

*Nota: Nenhuma alteração foi implementada nesta etapa (100% Read-Only). As propostas abaixo são submetidas para avaliação da governança:*

1. **Blindagem do Modal de Edição (Frontend):**
   - Remover o campo editável de `Valor Total (R$)` do formulário (torná-lo somente leitura ou informativo).
   - Manter editável a **Empresa / Operação** (`empresa_id`).
   - Se as horas forem ajustadas, o valor total deve ser recalculado pelo sistema com base na remuneração do colaborador/cargo, nunca digitado manualmente.
   - Adicionar campo obrigatório de **"Justificativa da Retificação"**.

2. **Saneamento do Ciclo de Devolução no Service (Backend):**
   - Ao salvar a correção de um item devolvido, definir explicitamente:
     ```typescript
     status_pipeline: 'RECEBIDO',
     lote_fechamento_id: null // ➔ Desvincula do lote antigo para permitir novo fechamento
     ```
   - Validar no service se o status do registro antes do update é estritamente `RECEBIDO` ou `DEVOLVIDO`. Rejeitar se for `VALIDADO_RH`, `APROVADO_RH`, `CNAB_GERADO` ou `PAGO`.

3. **Auditoria Obrigatória:**
   - Chamar `AuditoriaService.log` registrando:
     - Ação: `CORRIGIR_LANCAMENTO_INTERMITENTE`
     - Snapshot: valor anterior vs. novo valor
     - Usuário responsável e timestamp.

4. **Hardening no Banco (RLS / Trigger):**
   - Adicionar trigger ou constraint impedindo UPDATE em `lancamentos_intermitentes` quando `status_pipeline IN ('PAGO', 'CNAB_GERADO', 'APROVADO_RH')` exceto por funções de serviço autorizadas.

---

### 7. CONCLUSÃO E GOVERNANÇA

- **Status:** Auditoria finalizada em modo Read-Only.
- **Git / Deploy:** Nenhum commit, branch, push, deploy ou migration foi executado.
- **Próximo Passo:** Aguardar a revisão do proprietário e as diretrizes para a etapa de correção segura.
