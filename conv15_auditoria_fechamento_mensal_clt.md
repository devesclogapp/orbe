# CONV-15 — AUDITORIA DE CONVERGÊNCIA: FECHAMENTO MENSAL CLT
## ETAPA 01 — Auditoria Técnica e Funcional (Strictly Read-Only)

**Projeto:** ERP ORBE — ESC Logística  
**Módulo:** Pessoas & RH → Fechamento Mensal CLT  
**Rota Funcional:** `/banco-horas/fechamento`  
**Data da Auditoria:** 08/10/2026  
**Natureza:** Auditoria técnica e funcional, estritamente READ-ONLY (sem alterações de código, banco ou dados).

---

## 1. INVENTÁRIO DA IMPLEMENTAÇÃO ATUAL

### 1.1 Rotas e Roteamento
- **Rota Especialista Oficial:** `/banco-horas/fechamento`
- **Arquivo de Entrada da Página:** [`FechamentoMensalCLT.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/BancoHoras/FechamentoMensalCLT.tsx)
- **Registro no Roteador:** [`App.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/App.tsx#L277)  
  `Route path="/banco-horas/fechamento" element={<AuthGuard><FechamentoMensalCLT /></AuthGuard>}`
- **Entrada no Menu de Navegação:** [`Sidebar.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/layout/Sidebar.tsx#L170-L175)  
  Seção: *Pessoas & RH* → Item: `Fechamento Mensal CLT` (`id: "fechamento-clt"`, `icon: Lock`, `module: "fechamento_mensal"`).
- **Roteamento Transversal Correlato:**
  - Rota de Origem Operacional: `/banco-horas/pontos` ([`PontoJornadasClt.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Clt/PontoJornadasClt.tsx#L998) botão *"Ir para Fechamento Mensal"*).
  - Hub Transversal de Fechamentos: `/fechamento` ([`Fechamento.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Fechamento.tsx)).
  - Rota de Resolução de Bloqueios Cadastrais: `/cadastros?colaboradorId={id}&openModal=true&section={section}&from=processamento-rh`.
  - Rota de Resolução de Bloqueios de Ponto: `/banco-horas/extrato/{colaboradorId}?highlight={pontoId}&data={data}&from=processamento-rh` ou `/inconsistencias`.

### 1.2 Componentes Utilizados
- **Shell e Layout:** [`AppShell.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/layout/AppShell.tsx), [`Sidebar.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/layout/Sidebar.tsx), [`Topbar.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/layout/Topbar.tsx).
- **UI Base:** [`Button`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ui/button.tsx), Ícones Lucide (`CalendarCheck`, `Lock`, `Unlock`, `Loader2`, `CheckCircle2`, `XCircle`, `Clock`).
- **Componente Local:** `StatusBadge` (linhas 16–40 de `FechamentoMensalCLT.tsx`) para renderizar pílulas de status semânticas de RH e Financeiro.
- **Feedback & Toasts:** `sonner` (`toast.success`, `toast.error`).
- **Contextos Integrados:**
  - [`OperationalPipelineContext.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/contexts/OperationalPipelineContext.tsx): acionado em `onSuccess` (`buildOperationalStagePipeline`) e `onError` (`buildOperationalFailurePipeline`).
  - [`AuthContext.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/contexts/AuthContext.tsx) e [`TenantContext.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/contexts/TenantContext.tsx).

### 1.3 Serviços de Domínio Envolvidos
1. [`RHFinanceiroService`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/rhFinanceiro.service.ts):
   - `validateCompetenciaApproval(empresaId, competencia)`: audita todos os bloqueios, pendências cadastrais, inconsistências de ponto, custos e serviços extras antes de autorizar o fechamento.
   - `approveCompetencia(empresaId, competencia)`: gera formalmente os 3 lotes financeiros (`FOLHA_BASE`, `FOLHA_VARIAVEL`, `BANCO_HORAS`) em `rh_financeiro_lotes` com seus itens detalhados em `rh_financeiro_lote_itens`.
   - `validateReprocessPeriod(empresaId, competencia)`: protege competências já consolidadas financeiramente contra reprocessamentos acidentais.
   - `iniciarAnalise(loteId)`, `aprovarFinanceiro(loteId)`, `devolverAoRH(loteId, motivo)`: esteira financeira pós-fechamento.
2. [`rhProcessing.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/rhProcessing.service.ts):
   - `upsertFechamentoMensal`: consolida totais por colaborador na tabela `fechamento_mensal`.
   - `getMultiplicadorHoraExtra`: obtém o multiplicador de hora extra a partir da regra configurada.
3. [`RemuneracaoResolver.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/operationalEngine/RemuneracaoResolver.ts):
   - Resolve o valor-hora oficial do colaborador CLT considerando `salario_base`, `valor_base`, `valor_hora` ou carga horária contratual.
4. [`FechamentoCiclosOficialService`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/fechamentoCiclosOficial.service.ts):
   - Serviço agregador do Hub Transversal `/fechamento` que já consome `RHFinanceiroService.validateCompetenciaApproval` através do método `adaptarMotorClt`.

---

## 2. MAPA DE SERVIÇOS E FONTES DE DADOS

### 2.1 Tabelas PostgreSQL / Supabase
| Tabela | Campos Utilizados | Finalidade no Fechamento CLT |
|---|---|---|
| `empresas` | `id, nome, tenant_id` | Identificação das unidades e empresas empregadoras |
| `profiles` | `user_id, tenant_id, full_name` | Resolução do tenant e usuário autenticado |
| `registros_ponto` | `id, tenant_id, empresa_id, colaborador_id, nome_colaborador, data, status_processamento, jornada_calculada, valor_hora_extra, valor_atraso, valor_falta, minutos_extra, minutos_atraso, horas_extras_detalhadas` | Extração de eventos do mês para `FOLHA_VARIAVEL` |
| `colaboradores` | `id, nome, status, status_cadastro, cadastro_provisorio, tipo_colaborador, empresa_id, valor_hora, salario_base, valor_base, valor_diaria, modelo_calculo, tipo_contrato, gera_faturamento, jornada_id, banco_codigo` | Base salarial para `FOLHA_BASE`, elegibilidade e validação de pendências cadastrais |
| `processamento_rh_inconsistencias` | `id, registro_ponto_id, colaborador_id, tipo, descricao, status, resolvida, created_at, tenant_id, empresa_id` | Apuração de conflitos e inconsistências de ponto não resolvidas |
| `processamento_rh_logs` | `id, tipo_execucao, total_processados, total_inconsistencias, executado_em, periodo_ano, periodo_mes` | Rastreabilidade das execuções do motor de ponto na competência |
| `banco_horas_regras` | `id, nome, adicional_hora_extra_percentual, bh_ativo, empresa_id, tenant_id` | Percentual de adicional de horas extras das regras ativas |
| `custos_extras_operacionais` | `id, data, status_pagamento, pipeline_status, tenant_id, empresa_id` | Verificação de pendências de custos operacionais com reflexo financeiro |
| `servicos_extras_operacionais` | `id, data, pipeline_status, empresa_id` | Validação operacional de serviços extraordinários |
| `banco_horas_eventos` | `id, colaborador_id, empresa_id, tipo_evento, tipo, minutos, quantidade_minutos, descricao, data_evento, created_at, reflexo_financeiro_pendente, status, tenant_id` | Composição de itens do lote `BANCO_HORAS` |
| `rh_financeiro_lotes` | `id, tenant_id, empresa_id, competencia, origem, tipo, status, total_colaboradores, valor_total, criado_por, aprovado_por, aprovado_em, observacao_financeiro, created_at, updated_at` | Registro mestre dos lotes consolidados de folha encaminhados ao financeiro |
| `rh_financeiro_lote_itens` | `id, lote_id, tenant_id, colaborador_id, nome_colaborador, tipo_evento, minutos, horas, valor_calculado, origem_evento, referencia_evento_id, status` | Itens analíticos de cada lote de folha |
| `rh_financeiro_lote_historico` | `id, tenant_id, lote_id, usuario_id, usuario_nome, acao, status_anterior, status_novo, observacao, created_at` | Trilha de auditoria imutável do ciclo de aprovação do lote |
| `fechamento_mensal` | `tenant_id, colaborador_id, empresa_id, mes, ano, dias_trabalhados, horas_trabalhadas, horas_extras, horas_faltas, banco_horas_credito, banco_horas_debito, saldo_banco_horas, valor_hora_extra, valor_faltas, valor_total, situacao` | Consolidação espelho para relatórios e extratos individuais |

### 2.2 Origem Real dos Indicadores Apresentados na UI
A tela oficial [`FechamentoMensalCLT.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/BancoHoras/FechamentoMensalCLT.tsx) apresenta dois blocos de indicadores:

#### Bloco 1 — Resumo Corporativo Superior (Cards Globais)
1. **Unidades (Empresas) em Apuração:**  
   - Fórmula: `validations.length`  
   - Fonte Real: Quantidade de empresas que retornaram registros de ponto na competência ou que possuem pendências cadastrais/bloqueios críticos ativos.
2. **Bloqueios Críticos:**  
   - Fórmula: `validations.reduce((acc, curr) => acc + curr.resumo.bloqueiosCriticos, 0)`  
   - Fonte Real: Soma de colaboradores com cadastro provisório/pendente de complemento (`pendenciasCadastrais`) + pontos inconsistentes não tratados + colaboradores inativos com ponto + custos/serviços extras pendentes.
3. **Folha Variável:**  
   - Fórmula: `validations.reduce((acc, curr) => acc + (curr.resumo.financeiroPrevisto?.variaveis || 0), 0)`  
   - Fonte Real: Quantidade total de ocorrências apuradas nos registros de ponto da competência que possuem monetização (`hora_extra`, `atraso`, `falta`).
4. **Lotes Liberados:**  
   - Fórmula: `lotesAtuais.length`  
   - Fonte Real: Quantidade de registros existentes na tabela `rh_financeiro_lotes` com `competencia = currentMonth` e `origem = 'RH'`.

#### Bloco 2 — Card Individual por Empresa
1. **Saúde Cadastral:** `v.resumo.pendenciasCadastrais === 0 ? "validado" : "inconsistente"`
2. **Dados Ponto:** `v.resumo.inconsistenciasAbertas === 0 ? "fechado" : "pendente"`
3. **Lote Financeiro:** `lotesAtuais.find(l => l.empresa_id === empresaId)?.status || "pendente"`
4. **Bloqueios:** `v.resumo.bloqueiosCriticos`
5. **Itens de Ponto:** `v.resumo.financeiroPrevisto?.variaveis || 0`
6. **Avisos:** `v.resumo.avisosOperacionais`
7. **Banco de Horas:** `v.resumo.financeiroPrevisto?.bancoHoras || 0` (eventos com `reflexo_financeiro_pendente = true`)

---

## 3. DIAGNÓSTICO DOS ERROS HTTP 400 (BAD REQUEST)

Na captura da interface oficial, o navegador registra múltiplos erros simultâneos com código `400 Bad Request`.

### 3.1 Identificação Técnica e Evidência
- **Arquivo de Origem:** [`src/services/rhFinanceiro.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/rhFinanceiro.service.ts#L237-L241)
- **Função:** `loadCompetenciaContext(tenantId, empresaId, competencia)`, chamada por `validateCompetenciaApproval`.
- **Endpoint Supabase/PostgREST:**  
  `GET /rest/v1/banco_horas_regras?select=id%2Cnome%2Cadicional_hora_extra_percentual%2Cativo%2Cempresa_id%2Ctenant_id&tenant_id=eq.{tenantId}`
- **Parâmetros Enviados:**  
  `select=id,nome,adicional_hora_extra_percentual,ativo,empresa_id,tenant_id`
- **Código e Mensagem Retornados pelo PostgreSQL:**
  - **HTTP Status:** `400 Bad Request`
  - **PostgreSQL Error Code:** `42703` (*undefined_column*)
  - **Mensagem:** `column banco_horas_regras.ativo does not exist`
  - **Hint retornado pelo banco:** `Perhaps you meant to reference the column "banco_horas_regras.tipo".`

### 3.2 Causa Raiz do Erro
A inspeção da estrutura real da tabela `banco_horas_regras` revelou as seguintes colunas existentes:
```json
[
  "id", "nome", "empresa_id", "prazo_compensacao_dias", "tipo", "status",
  "created_at", "updated_at", "is_teste", "lote_id", "tenant_id",
  "carga_horaria_diaria", "tolerancia_atraso", "tolerancia_hora_extra",
  "limite_diario_banco", "validade_horas", "regra_compensacao", "regra_vencimento",
  "bh_ativo", "jornada_contratada", "origem_ponto", "vigencia_inicio",
  "vigencia_fim", "adicional_hora_extra_percentual", "escopo"
]
```
A coluna de ativação da regra chama-se **`bh_ativo`** (ou `status`), porém o código do serviço consultou explicitamente o identificador inexistente **`ativo`**.

### 3.3 Mecanismo de Disparo em Cascata
No componente [`FechamentoMensalCLT.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/BancoHoras/FechamentoMensalCLT.tsx#L71-L93), há um loop que percorre todas as empresas do tenant:
```typescript
for (const empresa of companies) {
  const val = await RHFinanceiroService.validateCompetenciaApproval(empresa.id, currentMonth);
  ...
}
```
Como existem 10 empresas cadastradas no tenant, a chamada de validação dispara 10 requisições simultâneas para `banco_horas_regras` com o campo inexistente `ativo`, gerando exatamente **10 requisições com retorno HTTP 400 Bad Request** na aba Network do navegador ao carregar a página.

### 3.4 Impacto na Integridade dos Indicadores
No arquivo [`rhFinanceiro.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/rhFinanceiro.service.ts#L242-L247):
```typescript
if (pontosError) throw pontosError;
if (colaboradoresError) throw colaboradoresError;
if (inconsistenciasError) throw inconsistenciasError;
if (logsError) throw logsError;
// NOTA: regrasError NÃO é relançado com throw!
return {
  ...
  regras: (regras || []) as any[],
  ...
};
```
O serviço engole o erro e retorna `regras: []` (array vazio).  
- **Impacto visual:** A tela não quebra em tela branca.
- **Impacto funcional:** Como `regras` fica vazio, o mapa de regras `regrasMap` em `buildFolhaVariavelItems` fica vazio. Ao calcular o valor da hora extra de um colaborador sem regra explícita no ponto, a função cai no multiplicador de fallback `1.0` em vez de aplicar o percentual configurado da regra (ex.: 50% ou 100%).
- **Classificação:** **FUNCIONAL** (não quebra a aplicação, mas causa degradação de cálculo e saturação de erros 400 no console). A correção é cirúrgica e deverá ser aplicada na Etapa 02.

---

## 4. AUDITORIA DOS BLOQUEIOS CADASTRAIS

A interface oficial apresenta exatamente:
- **9 empresas em apuração**
- **89 bloqueios críticos**
- **Evidencia Operacional: 26 bloqueios**
- **Evidencia Noite: 10 bloqueios**

### 4.1 Origem Real dos 89 Bloqueios (Auditoria por Consulta Direta)
A execução de script de verificação de integridade no banco de dados Supabase revelou a exata composição dos números apresentados na interface:

| Empresa | ID da Empresa | Total de Colaboradores | Pendências Cadastrais | Motivo do Bloqueio |
|---|---|:---:|:---:|---|
| **Evidencia Operacional** | `5cbf405b-4bd5-40d0-8e2b-11f02a3587d9` | 26 | **26** | `status_cadastro: pendente_complemento`, `cadastro_provisorio: true` |
| **Evidencia Noite** | `5f077100-5190-4e0c-ae54-976a7d0966ed` | 10 | **10** | `status_cadastro: pendente_complemento`, `cadastro_provisorio: true` |
| **BENEVIDES** | `4d4c1328-a8e7-4c5b-875d-924b416fa13a` | 19 | **18** | `status_cadastro: PENDENTE_COMPLEMENTO`, `cadastro_provisorio: true` |
| **DISMELO CASTANHAL** | `cf987be4-467e-4970-b46d-d01881a92ab5` | 17 | **17** | `status_cadastro: pendente_complemento`, `cadastro_provisorio: true` |
| **Encarregado GARRA** | `fa700191-bcba-4163-9d2b-b11b2da90b4e` | 8 | **8** | `status_cadastro: pendente_complemento`, `cadastro_provisorio: true` |
| **Escritório RH** | `ee818b7e-6eb1-4967-a96f-81fce7c95545` | 4 | **4** | `status_cadastro: pendente_complemento`, `cadastro_provisorio: true` |
| **Operacional Noturno** | `82e04eac-3b93-44a7-82f6-a943e04cdff4` | 3 | **3** | `status_cadastro: PENDENTE_COMPLEMENTO`, `cadastro_provisorio: true` |
| **Castanhal,Operacional** | `32e359fc-743a-4fdf-a5c9-dc3be5f7d482` | 2 | **2** | `status_cadastro: PENDENTE_COMPLEMENTO`, `cadastro_provisorio: true` |
| **Operacional,Castanhal** | `2d67a910-c329-45df-8330-e8bce09a8ee4` | 1 | **1** | `status_cadastro: PENDENTE_COMPLEMENTO`, `cadastro_provisorio: true` |
| *Empresa Teste - Homologação* | `28a560b5-37ef-403d-ae4f-b28a608b6a68` | 9 | **0** | Base Oficial de Homologação (cadastros 100% íntegros) |
| **TOTAL GERAL** | — | **99** | **89** | **89 bloqueios distribuídos exatamente nas 9 empresas** |

### 4.2 Por Que a Tela Apresenta "9 Empresas em Apuração"?
Existem 10 empresas cadastradas no tenant.  
A empresa *"Empresa Teste - Homologação"* possui seus colaboradores da Base Oficial de Homologação com cadastros completos (0 pendências cadastrais) e, para a competência `2026-10`, não possui registros de ponto abertos nem bloqueios críticos.  
Como o filtro da página elimina empresas vazias sem bloqueios (`!isEmpty || pendenciasCadastrais > 0 || bloqueiosCriticos > 0`), a lista resulta exatamente em **9 empresas ativas em apuração**.

### 4.3 Regras de Negócio dos Bloqueios Cadastrais
- **Origem dos Registros:** No Workflow A (sincronização automática com coletor RHID), novos colaboradores são pré-cadastrados automaticamente com:
  - `status_cadastro: 'pendente_complemento'`
  - `cadastro_provisorio: true`
- **Regra de Fechamento:** Em [`rhFinanceiro.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/rhFinanceiro.service.ts#L507-L513):
  Colaboradores CLT com status cadastral pendente ou cadastro provisório NÃO podem ter competência homologada nem folha salarial liberada para o Financeiro.
- **Campos Obrigatórios para Liberação:**
  - Dados de identificação: CPF, Matrícula, Tipo de Contrato (`CLT_MENSAL`, `CLT_HORISTA`, etc.).
  - Dados bancários para pagamento: `banco_codigo`, `agencia`, `conta` ou chave PIX válida.
  - Dados de remuneração: `salario_base` ou `valor_base` preenchidos.
  - Flag de faturamento/folha: `gera_faturamento = true`.
- **Resolução Oficial:** O sistema encaminha o usuário para a Central de Cadastros (`/cadastros?colaboradorId={id}&openModal=true`). Uma vez complementado o cadastro, o recálculo do fechamento remove o colaborador da lista de bloqueios automaticamente.
- **Parecer Obrigatório:** **Pendência cadastral real NÃO é bug**. Os 89 bloqueios representam a operação correta do sistema de proteção de fechamento.

---

## 5. MOTOR DE FECHAMENTO MENSAL CLT

O fluxo de fechamento mensal CLT segue um ciclo de governança estrito e unidirecional:

```text
Registros Ponto RHID
        ↓
Motor RH (Apuração de Jornadas / Banco de Horas)
        ↓
Auditoria de Bloqueios (validateCompetenciaApproval)
   ├─ [Bloqueado] → Central de Inconsistências / Central de Cadastros
   └─ [Sem Bloqueios] → Homologação RH (approveCompetencia)
                               ↓
                   rh_financeiro_lotes
             (FOLHA_BASE, FOLHA_VARIAVEL, BANCO_HORAS)
                               ↓
             Status: AGUARDANDO_FINANCEIRO
                               ↓
             Financeiro inicia análise (iniciarAnalise)
                               ↓
             Status: EM_ANALISE_FINANCEIRA
                               ↓
             Aprovação Financeira (aprovarFinanceiro)
                               ↓
             Status: AGUARDANDO_PAGAMENTO
                               ↓
             Disponível para Central Bancária / CNAB 240
```

### 5.1 Etapas e Pré-condições de Fechamento
1. **Pré-condições Impeditivas:**
   - Presença obrigatória de marcações processadas no mês.
   - Zero colaboradores com `pendente_complemento` ou `cadastro_provisorio` na empresa.
   - Zero registros de ponto marcados com `status_processamento = 'INCONSISTENTE'`.
   - Zero inconsistências pendentes em `processamento_rh_inconsistencias`.
   - Zero colaboradores inativos ou bloqueados com ponto apontado no mês.
   - Zero custos extras ou serviços extras pendentes de validação operacional.
2. **Geração dos 3 Lotes Financeiros:**
   Ao executar `approveCompetencia`, são gerados ou atualizados em `rh_financeiro_lotes`:
   - **`FOLHA_BASE`**: Salários-base dos colaboradores ativos elegíveis (`modelo_calculo = CLT_MENSAL`, `gera_faturamento = true`, `valor_base > 0`).
   - **`FOLHA_VARIAVEL`**: Eventos analíticos monetizados derivados dos pontos (`hora_extra` com acréscimo legal, descontos de `atraso` e `falta`).
   - **`BANCO_HORAS`**: Pagamentos e reflexos acumulados com `reflexo_financeiro_pendente = true`.
3. **Idempotência e Segurança contra Duplicidade:**
   - A consulta verifica se já existe lote para a chave `(tenant_id, empresa_id, competencia, origem, tipo)`.
   - Se o lote existente estiver em `AGUARDANDO_FINANCEIRO` ou `DEVOLVIDO_RH`, os itens em `rh_financeiro_lote_itens` são deletados e reinseridos atomicamente, mantendo o ID do lote e atualizando os totais.
   - Se o lote já avançou para `EM_PROCESSAMENTO`, `AGUARDANDO_PAGAMENTO` ou `CONCLUIDO`, o fechamento operacional é bloqueado para impedir corrupção do ciclo financeiro.
4. **Delimitação de Responsabilidade:**
   - O módulo de Fechamento Mensal CLT **NÃO gera remessa bancária CNAB nem transmite arquivos bancários**.
   - A responsabilidade deste módulo encerra-se na entrega dos lotes ao Financeiro com status `AGUARDANDO_FINANCEIRO` (e posterior aprovação financeira para `AGUARDANDO_PAGAMENTO`).

---

## 6. LOCALIZAÇÃO DA UX HOMOLOGADA

### 6.1 Implementação no UX Lab
No diretório `src/pages/UxLab/`, a experiência visual de fechamento está implementada em:
- **Página Hub:** [`UxLabFechamentoCiclos.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/UxLab/UxLabFechamentoCiclos.tsx)
- **Drawer de Fechamento:** [`UxLabFechamentoDrawer.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ux-lab/UxLabFechamentoDrawer.tsx)
- **Dataset Homologado:** [`fechamentoCiclosMockData.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/UxLab/fechamentoCiclosMockData.ts) (onde o ciclo CLT está definido nas linhas 310–368: `id: "ciclo-clt-mensal"`, `dominio: "CLT"`).

### 6.2 Elementos Visuais e Interativos Homologados
1. **Filtros de Topo Padronizados:**
   - Seletor de Competência (Mês/Ano formatado, ex.: `Outubro / 2026`).
   - Seletor de Unidade / Empresa com opção de Consolidado Geral.
2. **Quatro Cards de Síntese Superior (KPIs):**
   - Total de Ciclos/Unidades em Apuração.
   - Prontos para Fechar (Azul `#2563EB`).
   - Bloqueados por Impedimentos (Vermelho/Rosa `rose-600`).
   - Fechados / Consolidados (Verde `emerald-600`).
3. **Card de Ciclo com Estados Canônicos:**
   - `PRONTO_PARA_FECHAR`: Botão azul *"Revisar e Fechar"*.
   - `BLOQUEADO`: Botão vermelho *"Ver X impedimentos"* (com navegação direta para `/inconsistencias`).
   - `AGUARDANDO_APROVACAO`: Botão âmbar *"Abrir Aprovações"* (navega para `/rh/aprovacoes`).
   - `FECHADO`: Badge verde com cadeado *"Ver Fechamento (Modo Leitura)"*.
4. **Drawer Especializado (`UxLabFechamentoDrawer`):**
   - Bloco *"O que será consolidado?"*: Exibe a composição analítica dos lotes (`FOLHA_BASE`, `FOLHA_VARIAVEL`, `BANCO_HORAS`).
   - Bloco *"Checklist de Prontidão"*: Apresenta os itens com ícones de sucesso, bloqueio e aviso.
   - Bloco *"Efeito do Fechamento"*: Texto explicativo sobre o impacto fiscal e financeiro.
   - Bloco *"Rastreabilidade & Governança"*: Empresa, responsável, data/hora da revisão e fechamento.
   - Box de Confirmação em 2 Etapas com confirmação explícita antes do envio.

---

## 7. ISOLAMENTO E PERMISSÕES

### 7.1 Isolamento Multitenant
- Toda consulta em `FechamentoMensalCLT.tsx` e `RHFinanceiroService` obtém o `tenant_id` da sessão ativa (`profiles`) e aplica filtro explícito `.eq('tenant_id', tenantId)`.
- Recomenda-se adicionar `.eq('tenant_id', tenantId)` na query de `rh_financeiro_lotes` em `FechamentoMensalCLT.tsx` (linha 100) para garantir conformidade estrita com o princípio *fail-closed*.

### 7.2 Matriz de Perfis (RBAC)
De acordo com [`src/lib/access-control.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/lib/access-control.ts):
- **Admin:** Acesso total (`ver`, `processar`, `fechar`, `reabrir`).
- **RH:** Acesso operacional completo (`ver`, `processar`, `fechar`, `reabrir`). É o ator responsável por resolver bloqueios e liberar a competência.
- **Financeiro:** Acesso de conferência e homologação (`ver`, `aprovar`, `fechar`, `reabrir`).
- **Encarregado:** **Estritamente Bloqueado**. O perfil `encarregado` não possui o módulo `fechamento_mensal` atribuído e é impedido de acessar dados consolidados de folha, salários e contas bancárias.

---

## 8. MATRIZ DE CONVERGÊNCIA

| Elemento | Implementação Oficial Atual | UX Homologada (UX Lab) | Fonte Real (Supabase) | Divergência | Classificação | Ação Recomendada |
|---|---|---|---|---|:---:|---|
| **Seletor de Competência** | Hardcoded para mês atual (`currentMonth = new Date().toISOString().substring(0, 7)`) | Seletor dropdown padronizado com meses formatados | Parâmetro dinâmico de competência `YYYY-MM` | Não permite navegar entre meses anteriores | **B — Adapter** | Adicionar seletor de competência com meses retroativos e ativos. |
| **Seletor de Empresa** | Lista todas as empresas em pilha vertical sem filtro | Dropdown com filtro por empresa + opção consolidada | Tabela `empresas` com `tenant_id` | Falta filtro unitário de empresa | **A — Visual** | Incorporar filtro de empresa no topo da página. |
| **KPIs Superiores** | 4 caixas simples (Unidades, Bloqueios, Folha Variável, Lotes) | 4 `OrbeKpiCard` padronizados com tokens de cor (Total, Prontos, Bloqueados, Fechados) | `validations` e `lotesAtuais` | Layout e hierarquia visual desatualizados | **A — Visual** | Convergir para `OrbeKpiCard` com escala cromática oficial. |
| **Cards de Empresa / Ciclo** | Elemento `<article>` com borda simples e botões sem padronização | Card estruturado com Badges de Estado (`PRONTO_PARA_FECHAR`, `BLOQUEADO`, etc.) e resumo analítico | `RHFinanceiroService.validateCompetenciaApproval` | Falta hierarquia visual e estados semânticos | **A — Visual** | Adicionar estados semânticos homologados e ações contextuais. |
| **Consulta Regras Banco Horas** | `.select("...ativo...")` em `banco_horas_regras` gerando HTTP 400 | Não executa query direta no Lab (dataset mockado) | Tabela `banco_horas_regras` (coluna correta: `bh_ativo`) | Coluna inexistente causando 10 erros 400 | **B — Adapter** | Corrigir query para `bh_ativo` (ou `status`) no service. |
| **Detalhes do Lote (Drawer)** | Inexistente. Apenas exibe impedimentos em lista básica | `UxLabFechamentoDrawer` completo com checklist e detalhamento | `rh_financeiro_lote_itens` e `validateCompetenciaApproval` | Ausência de visão aprofundada antes de fechar | **A — Visual** | Criar `FechamentoMensalDrawerOficial` acionado pelo card. |
| **Ações de Desbloqueio** | Botão desabilitado com texto *"Bloqueado por pendências"* | Botão *"Ver X impedimentos"* com navegação direta para `/inconsistencias` | Rotas de resolução (`/cadastros`, `/inconsistencias`) | Usuário fica sem ação clara de resolução | **B — Adapter** | Encaminhar usuário para a tela correta de resolução. |
| **Confirmação de Fechamento** | Clique direto no botão sem confirmação de impacto | Box de confirmação em duas etapas detalhando o lote | `RHFinanceiroService.approveCompetencia` | Falta prevenção contra cliques acidentais | **A — Visual** | Adicionar modal/box de confirmação formal no drawer. |
| **Motor de Apuração** | `RHFinanceiroService.validateCompetenciaApproval` | Simulado em `fechamentoCiclosMockData.ts` | Banco oficial Supabase | Regras de cálculo estão preservadas | **C — Funcional** | Preservar 100% da lógica e regras existentes. |
| **Isolamento e Segurança** | AuthGuard + Tenant Filter | Não se aplica (Lab isolado) | `profiles.tenant_id` e RLS | Totalmente aderente | **E — Segurança** | Adicionar `tenant_id` explícito em `rh_financeiro_lotes`. |

### Legenda de Classificação:
- **A — Visual:** Resolvida pela convergência da interface oficial com os padrões do Design System e UX Lab.
- **B — Adapter:** Conexão ou transformação de dados existentes sem alterar regras de negócio.
- **C — Funcional:** Regra homologada a ser estritamente preservada.
- **D — Bloqueio:** Impede convergência segura (Nenhum bloqueio identificado).
- **E — Segurança:** Registro preventivo para Security Hardening.

---

## 9. RISCOS DE REGRESSÃO E PREVENÇÃO

1. **Risco de Alteração nas Regras do Motor RH:**  
   - *Prevenção:* O motor de apuração de ponto ([`rhProcessing.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/rhProcessing.service.ts)) e o módulo Ponto & Jornadas CLT ([`PontoJornadasClt.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Clt/PontoJornadasClt.tsx)) já estão homologados e permanecem **congelados**. Nenhuma linha destes módulos será alterada.
2. **Risco de Geração de Lotes Financeiros Duplicados:**  
   - *Prevenção:* O método `approveCompetencia` em `RHFinanceiroService` já possui mecanismo de idempotência que reutiliza o lote existente se estiver em `AGUARDANDO_FINANCEIRO` ou `DEVOLVIDO_RH`. A convergência visual não altera esta assinatura.
3. **Risco de Quebra no Fluxo de Despesas / Contas a Pagar:**  
   - *Prevenção:* Os lotes gerados mantêm o formato idêntico esperado pela Central Financeira (`rh_financeiro_lotes` com `origem = 'RH'`).
4. **Risco de Quebra na Base Oficial de Homologação:**  
   - *Prevenção:* A empresa *"Empresa Teste - Homologação"* deve continuar com 0 pendências cadastrais e status validado, servindo de benchmark de teste.

---

## 10. LISTA OBJETIVA DOS ARQUIVOS NECESSÁRIOS À ETAPA 02

Para a execução da convergência (ETAPA 02), serão envolvidos estritamente os seguintes arquivos:

### Arquivos Existentes a Ajustar (Cirúrgico e Incremental):
1. [`src/services/rhFinanceiro.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/rhFinanceiro.service.ts):  
   Ajuste pontual da linha 239 no select de `banco_horas_regras` (substituir o campo inexistente `ativo` por `bh_ativo` ou `status`), eliminando os 10 erros HTTP 400.
2. [`src/pages/BancoHoras/FechamentoMensalCLT.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/BancoHoras/FechamentoMensalCLT.tsx):  
   Convergência da UI para incorporar a identidade visual homologada (seletor de competência, seletor de empresas, KPIs `OrbeKpiCard`, cards com status canônicos e acionamento do Drawer).

### Novos Arquivos Desacoplados a Criar:
3. `src/components/banco-horas/FechamentoMensalDrawerOficial.tsx`:  
   Drawer oficial de fechamento CLT convergido a partir do `UxLabFechamentoDrawer`, exibindo checklist de prontidão, detalhamento dos lotes previstos e confirmação em duas etapas.
4. `src/services/adapters/fechamentoMensalCltAdapter.ts`:  
   Camada de adapter pura para converter os dados brutos de `validateCompetenciaApproval` para os modelos visuais da interface sem poluir o componente React.
5. `src/test/conv15_fechamento_mensal_clt.test.tsx`:  
   Suíte de testes de integração automatizada validando a renderização correta, o cálculo dos 89 bloqueios, a supressão dos erros 400 e a navegação contextual.

---

## CONCLUSÃO E PARECER TÉCNICO

### Parecer: **APTO PARA CONVERGÊNCIA**

**Justificativa:**  
1. A arquitetura de domínio do Fechamento Mensal CLT encontra-se íntegra e madura em `RHFinanceiroService`.
2. Os 89 bloqueios críticos foram identificados e comprovados como pendências cadastrais legítimas de colaboradores reais originados da importação inicial do RHID, confirmando a robustez da barreira de integridade fiscal.
3. Os erros HTTP 400 foram diagnosticados com precisão matemática (referência à coluna `ativo` em vez de `bh_ativo` em `banco_horas_regras`), com plano cirúrgico de correção sem impactos colaterais.
4. A experiência do UX Lab (`UxLabFechamentoCiclos` e `UxLabFechamentoDrawer`) mapeia perfeitamente os requisitos operacionais da ESC Logística.
5. O escopo da ETAPA 02 está estritamente delimitado e não apresenta riscos de regressão para os módulos de Ponto CLT, Financeiro, Despesas ou Central Bancária.

*Auditoria concluída. Nenhuma alteração foi realizada nesta etapa (Strictly Read-Only). Aguardando autorização expressa para o avanço à ETAPA 02.*
