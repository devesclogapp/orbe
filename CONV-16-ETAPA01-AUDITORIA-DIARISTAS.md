# CONV-16 — DIARISTAS
## ETAPA 01 — Relatório de Auditoria Read-Only e Mapeamento da Convergência UX Lab → ORBE Oficial

**Projeto:** ERP ORBE — ESC Logística  
**Módulo:** Pessoas & RH → Diaristas  
**Classificação:** Convergência de interface sobre domínio funcional homologado  
**Etapa executada:** 01 — Auditoria técnica e funcional, estritamente Read-Only (sem alterações de código)  
**Data da auditoria:** 08/10/2026  
**Documento emitido:** `CONV-16-ETAPA01-AUDITORIA-DIARISTAS.md`  

---

## 1. RESUMO EXECUTIVO DO ESTADO ATUAL

O módulo de **Diaristas** do ERP ORBE possui um domínio funcional **robusto, maduro e já homologado ponta a ponta**. O fluxo cobre desde o lançamento operacional pelo Encarregado até a liquidação bancária via retorno CNAB240, possuindo validação de concorrência, imutabilidade após quitação e trilha de auditoria formal.

Entretanto, do ponto de vista de **experiência do usuário (UX)** e **convergência arquitetural**, o módulo apresentava uma assimetria:
1. **No UX Lab:** O item de menu `Diaristas (Grade & Lotes)` na barra lateral (`UxLabSidebar.tsx`) apontava para um estado de planejamento (`toast.info("Módulo em planejamento")`), enquanto a presença de Diaristas já havia sido homologada visualmente em todos os módulos transversais do UX Lab:
   - **Fechamento de Ciclos** (`UxLabFechamentoCiclos.tsx` e `fechamentoCiclosMockData.ts`), onde Diaristas é o Motor 02 canônico com lotes semanais (ex.: Semana 40 pronta para fechar e Semana 39 consolidada);
   - **Central de Aprovações** (`UxLabAprovacoes.tsx` e `UxLabAprovacaoDrawer.tsx`), onde o tipo `DIARISTA` possui fila própria e drawer homologado;
   - **Contas a Pagar / Despesas** (`UxLabDespesas.tsx`), onde lotes de diaristas são federados como Mão de Obra via `DespesasContasPagarOficialService`;
   - **Central Bancária** (`UxLabCentralBancaria.tsx` e `CentralBancariaDiaristas.tsx`), onde o fluxo de remessa posicional CNAB240 e conciliação por retorno possui drawers de continuidade (`DrawerPrimarioShell` e `DrawerSecundarioShell`);
   - **Relatório R02** (`UxLabRelatorioView.tsx` e `RelatorioVisualizadorOficial.tsx`), com colunas e totais homologados.
2. **No ERP Oficial:** A funcionalidade está plenamente viva e operacional, distribuída em três telas principais:
   - **Lançamento Operacional do Encarregado:** `/producao/diaristas` (`DiaristasLancamento.tsx`), estruturada em grade semanal com ciclo de marcação por toque (P, MP, F);
   - **Gestão & Painel do RH:** `/operacional/diaristas` (`RhDiaristasPainel.tsx`), tela rica em regras e mutações de governança (2.333 linhas), mas com densidade visual heterogênea, modais `Dialog` pesados e sobreposição de abas;
   - **Central Bancária Contextual:** `/bancario?tab=diaristas&origem=DIARISTA` (`CentralBancariaDiaristas.tsx`), já alinhada com drawers e pipeline de continuidade.

**Conclusão do diagnóstico:** Não há necessidade de criar novas tabelas, RPCs, regras de cálculo ou fluxos financeiros. O objetivo da CONV-16 é exclusivamente **convergência visual e de apresentação do painel RH/Operacional de Diaristas**, adotando o Design System oficial do ORBE, os drawers de decisão e o alinhamento com a identidade do Dashboard Executivo.

---

## 2. INVENTÁRIO DA ESTRUTURA EXISTENTE

### 2.1. Tabela Síntese de Inventário (Entrega A)

| Elemento | Arquivo/Rota Real | Responsabilidade | Situação |
|---|---|---|---|
| **Tela Oficial — Lançamento Encarregado** | `src/pages/Producao/DiaristasLancamento.tsx`<br>`Rota: /producao/diaristas` | Entrada de diárias em grade semanal (Seg–Dom), cálculo automático, fechamento semanal | **Existente e Homologada** |
| **Tela Oficial — Painel RH / Governança** | `src/pages/Rh/RhDiaristasPainel.tsx`<br>`Rota: /operacional/diaristas` | Visão semanal/diarista/data, validação RH, reabertura (operacional/administrativa), edição admin com recálculo | **Existente e Funcional** (Alvo da convergência visual) |
| **Tela Oficial — Aprovações RH** | `src/pages/Rh/AprovacoesRh.tsx`<br>`Rotas: /diaristas/aprovacoes`, `/rh/diaristas` | Central unificada de aprovação com drawer de decisão para lotes de diaristas | **Existente e Homologada** |
| **Tela Oficial — Cadastros Diaristas** | `src/pages/Rh/RhDiaristasGestao.tsx`<br>`Rota: /rh/diaristas/cadastros` | Cadastro/edição de colaboradores diaristas, dados bancários e chave PIX | **Existente e Homologada** |
| **Tela Oficial — Regras de Marcação** | `src/pages/Rh/TabRegrasDiaristas.tsx`<br>`Rota: /cadastros/regras-operacionais` | CRUD de códigos de marcação (P, MP, F) e seus multiplicadores | **Existente e Homologada** |
| **Tela Oficial — Financeiro (Lotes RH)** | `src/pages/CentralFinanceira.tsx`<br>`Rota: /financeiro?tab=lotes-rh` | Aprovação do lote financeiro de diaristas via RPC `aprovar_financeiro_diaristas` | **Existente e Homologada** |
| **Tela Oficial — Central Bancária** | `src/pages/Financeiro/CentralBancariaDiaristas.tsx`<br>`Rota: /bancario?tab=diaristas&origem=DIARISTA` | Geração de CNAB240 posicional, rastreio de lote, pipeline vertical/horizontal | **Existente e Homologada** (Fases 10/11) |
| **Tela Oficial — Retorno Bancário** | `src/pages/Financeiro/RetornoBancario.tsx`<br>`Rota: /bancario?tab=retorno&origem=DIARISTA` | Leitura de `.RET` (BB 001 e Itaú 341), conciliação e quitação definitiva | **Existente e Homologada** |
| **Tela Oficial — Relatório R02** | `src/pages/Relatorios/RelatorioVisualizadorOficial.tsx`<br>`Rota: /relatorios/r02-fechamento-diaristas` | Visualizador oficial do relatório R02 de Fechamento de Diaristas | **Existente e Homologada** |
| **UX Lab — Referência Lateral** | `src/components/ux-lab/UxLabSidebar.tsx` | Item `diaristas` ("Diaristas (Grade & Lotes)") com badge `Sem 43` | **Localizado** (Rota não mapeada em `UX_LAB_ROUTES`) |
| **UX Lab — Fechamento de Ciclos** | `src/pages/UxLab/UxLabFechamentoCiclos.tsx`<br>`src/pages/UxLab/fechamentoCiclosMockData.ts` | Fechamento Motor 02 com checklist de 4 itens, consolidação por função e rastreabilidade | **Localizado e Congelado** |
| **UX Lab — Central de Aprovações** | `src/pages/UxLab/UxLabAprovacoes.tsx`<br>`src/components/ux-lab/UxLabAprovacaoDrawer.tsx` | Fila com filtro `DIARISTAS` e drawer de aprovação contextual | **Localizado e Congelado** |
| **UX Lab — Despesas Federadas** | `src/pages/UxLab/UxLabDespesas.tsx` | Integração federada como Mão de Obra | **Localizado e Congelado** |
| **UX Lab — Relatórios Hub** | `src/pages/UxLab/UxLabRelatorioView.tsx` | Relatório R02 demonstrativo | **Localizado e Congelado** |
| **Serviço de Domínio Canônico** | `src/services/domain/diaristas.service.ts` | Classes `LancamentoDiaristaService`, `LoteFechamentoDiaristaService`, `DiaristaCicloService` | **Existente e Homologado** |
| **Serviço Federado de Despesas** | `src/services/despesasOficial.service.ts` | Normalização canônica `normalizarLoteDiarista` com chave `DIARISTAS:UUID` | **Existente e Homologado** |
| **Serviço Federado Bancário** | `src/services/bancarioOficialAdapter.ts` | Ingestão e normalização de obrigações bancárias de diaristas | **Existente e Homologado** |
| **Motor CNAB240 FEBRABAN** | `src/services/cnab/motorCNAB240.service.ts`<br>`src/services/cnab/cnab240-posicional.ts` | Geração posicional Windows-1252 com segmentos Header, Lote, A, B, Trailer | **Existente e Homologado** |
| **Suíte de Testes Automatizados** | `src/test/cnab_fechamento_lote_diaristas_fail_closed.test.ts`<br>`src/test/ux_diaristas_drawers_navigation.test.ts`<br>`src/test/diaristas_segregation.test.ts` | 570+ linhas de testes unitários e de integração para o domínio | **Existente (100% Passing)** |

---

## 3. RECONSTRUÇÃO DO FLUXO FUNCIONAL HOMOLOGADO

O ciclo de vida real de um lançamento de Diarista no ERP ORBE é estritamente encadeado e auditado:

```
Encarregado (Grade Semanal)
  │ [Lançamento & Marcação P / MP / F]
  ▼
Salvar Rascunho (EM_ABERTO em lancamentos_diaristas)
  │
  ▼
Fechar Período Semanal (LoteFechamentoDiaristaService.fecharPeriodo)
  │ ├─ Detecta órfãos sem empresa (marca DEVOLVIDO)
  │ ├─ Cria lote único em diaristas_lotes_fechamento (AGUARDANDO_VALIDACAO_RH)
  │ └─ Vincula e atualiza lançamentos para AGUARDANDO_VALIDACAO_RH
  ▼
Validação RH (RhDiaristasPainel.tsx / AprovacoesRh.tsx)
  │ ├─ Se inconsistente: reabrirPeriodo (modo operacional ou administrativo)
  │ ├─ Se ajuste necessário: editarAdmin com recálculo via RPC recalcular_valor_lote
  │ └─ Se aprovado: RPC validar_periodo_diaristas ➔ VALIDADO_RH
  ▼
Aprovação Financeira (CentralFinanceira.tsx - Aba Lotes RH)
  │ ├─ RPC aprovar_financeiro_diaristas
  │ ├─ Cria títulos a pagar em faturas
  │ ├─ Atualiza financeiro_consolidados_colaborador
  │ └─ Transiciona lote para AGUARDANDO_PAGAMENTO / FECHADO_FINANCEIRO
  ▼
Remessa Bancária CNAB240 (CentralBancariaDiaristas.tsx)
  │ ├─ Valida pré-requisitos bancários de cada diarista (CPF, banco, agência, conta)
  │ ├─ Valida conta pagadora e convênio da empresa
  │ ├─ MotorCNAB240 gera arquivo posicional (Tipo serviço 20 - Fornecedores)
  │ ├─ Registra remessa em cnab_remessas_arquivos
  │ └─ Transiciona lote para status: cnab_gerado, status_conciliacao: aguardando_conciliacao
  ▼
Retorno Bancário & Conciliação (RetornoBancario.tsx / CentralBancaria.tsx)
  │ ├─ Upload e leitura do arquivo .RET (Itaú 341 / Banco do Brasil 001)
  │ ├─ Registra conciliações em cnab_retorno_itens
  │ ├─ RPC sync_diaristas_lote_conciliacao_context avalia quitação
  │ ├─ [SE PARCIAL]: Lote permanece cnab_gerado (NÃO vira PAGO, sem paid_at)
  │ └─ [SE INTEGRAL]: Transiciona lote e lançamentos para PAGO, gravando paid_at e paid_by
  ▼
Imutabilidade & Auditoria
  │ [Lote PAGO não permite reabertura nem mutações manuais]
```

### 3.1. Origem dos Lançamentos (Operacional / Encarregado)
- **Quem lança:** Encarregado da unidade operacional ou supervisor de campo via `/producao/diaristas` (`DiaristasLancamento.tsx`).
- **Campos obrigatórios:**
  - `empresa_id` (resolvida pelo contexto operacional ou seletor);
  - `diarista_id` (selecionado do catálogo de colaboradores diaristas ativos da empresa);
  - `data_lancamento` (dia específico de segunda a domingo dentro da semana ISO selecionada);
  - `codigo_marcacao` (código de marcação cadastrado na tabela `regras_marcacao_diaristas`, ex.: P, MP, F);
  - `quantidade_diaria` (derivada automaticamente do multiplicador da regra: 1.0 para P, 0.5 para MP, 0.0 para F);
  - `valor_diaria_base` (obtido do cadastro do diarista na tabela `colaboradores.valor_diaria`);
  - `valor_calculado` (calculado via `quantidade_diaria * valor_diaria_base`).
- **Campos contextuais opcionais:** `cliente_unidade`, `unidade_id`, `local_id`, `observacao`, `encarregado_id`, `encarregado_nome`.
- **Prevenção de duplicidades (Idempotência):** Em `LancamentoDiaristaService.createBatch` (linhas 276–312 de `diaristas.service.ts`), antes do `insert`, o serviço executa um `delete` cirúrgico de quaisquer registros com status `EM_ABERTO` existentes para a mesma tupla `(empresa_id, diarista_id, data_lancamento)`.
- **Auditoria de Edições:** Mutações no estado aberto são sobrescritas de forma idempotente. Edições após envio são restritas ao RH/Admin via `updateAdminWithRecalculate` com log em `diaristas_logs_fechamento`.

### 3.2. Apuração e Regras de Negócio
- **Catálogo de Funções Homologadas:** O catálogo oficial de funções de diaristas registradas em `RhDiaristasGestao.tsx` (linha 23) e no banco de dados compreende:
  - `Diarista`
  - `Auxiliar de carga`
  - `Ajudante`
  - `Conferente`
  - `Operador eventual`
  - `Serviço extra`
  *(No mock do Fechamento de Ciclos do UX Lab também constam referências a "Ajudante de Carga Diarista" e "Conferente Diarista")*.
- **Diárias integrais e parciais:** Controladas pela tabela `regras_marcacao_diaristas`:
  - `P` (Presença Integral) ➔ Multiplicador = `1.0`
  - `MP` (Meio Período) ➔ Multiplicador = `0.5`
  - `F` (Falta) ➔ Multiplicador = `0.0`
  - `AUSENTE` ➔ Multiplicador = `0.0` (código neutro)
- **Ajustes operacionais:** O serviço possui o método `criarAjuste` (`diaristas.service.ts`, linha 153), permitindo lançar acréscimos/decréscimos com `tipo_registro = 'ajuste'`, preservando o lançamento original (`referencia_lancamento_id`).

### 3.3. Aprovação e Fechamento
- **Fechamento do Período:** Executado via `LoteFechamentoDiaristaService.fecharPeriodo` (`diaristas.service.ts`, linha 538):
  - Delimitação: Período semanal de 7 dias (`periodo_inicio` e `periodo_fim`).
  - Proteção contra órfãos: Lançamentos com `empresa_id` nula são automaticamente marcados como `DEVOLVIDO` e registrados em log.
  - Agrupamento em Lote: Cria registro único em `diaristas_lotes_fechamento` com status inicial `AGUARDANDO_VALIDACAO_RH`.
  - Concorrência (OCC / Unique constraint 23505): Bloqueia geração de lote concorrente ativo para o mesmo período/empresa.
- **Validação pelo RH:**
  - Realizada via `validarPeriodo` (RPC `validar_periodo_diaristas`) em `RhDiaristasPainel.tsx` ou pelo botão Aprovar em `AprovacoesRh.tsx`.
  - Promove lote e lançamentos para `VALIDADO_RH`.
- **Reabertura pelo RH/Admin:**
  - Método `reabrirPeriodo` (RPC `reabrir_periodo_diaristas`):
    - **Reabertura Operacional:** Devolve todos os lançamentos para `EM_ABERTO`, permitindo que o Encarregado altere as marcações e reenvie.
    - **Reabertura Administrativa:** Mantém o lote em `AGUARDANDO_VALIDACAO_RH` com `tipo_reabertura = 'administrativa'`. Bloqueia o Encarregado na ponta e restringe as correções ao painel do RH/Admin.

### 3.4. Integração Financeira e Central Bancária
- **Aprovação Financeira:**
  - Realizada em `CentralFinanceira.tsx` (aba `lotes-rh`) chamando a RPC `aprovar_financeiro_diaristas`.
  - Transiciona lote para `AGUARDANDO_PAGAMENTO` (ou `FECHADO_FINANCEIRO`).
  - Cria títulos a pagar na tabela `public.faturas` para cada diarista e consolida em `financeiro_consolidados_colaborador`.
- **Geração de Remessa CNAB240:**
  - Realizada em `CentralBancariaDiaristas.tsx` (`diaristas.service.ts`, linha 806).
  - Validação fail-closed de pré-requisitos cadastrais:
    - Diarista: exige `cpf` (11 dígitos), `banco_codigo`, `agencia`, `conta`, `digito_conta`. Se algum dado faltar, a geração é abortada com lista detalhada de pendências.
    - Empresa: valida CNPJ ativo na conta da empresa (`contas_bancarias_empresa`).
  - Geração via `MotorCNAB240.gerar`: formato FEBRABAN posicional multibanco (BB 001 e Itaú 341).
  - Registra arquivo em `cnab_remessas_arquivos` e atualiza status do lote para `cnab_gerado`.
- **Liquidação Bancária e Conciliação:**
  - Proibição de baixa manual: o método `marcarComoPago` em `diaristas.service.ts` (linha 782) lança explicitamente uma exceção fail-closed (`Pagamento manual desabilitado: o lote de diaristas só pode virar PAGO após retorno bancário conciliado`).
  - Baixa automática: O processamento do arquivo de retorno `.RET` em `CnabConciliacaoService` dispara a função `sync_diaristas_lote_conciliacao_context`.
  - **Regra de Quitação Integral vs. Parcial:**
    - Se houver qualquer divergência ou item pendente, o lote permanece em `cnab_gerado` com status de conciliação parcial.
    - O status `PAGO` e o preenchimento de `paid_at` e `paid_by` só ocorrem quando 100% dos beneficiários do lote forem confirmados como liquidados pelo banco.

---

## 4. AUDITORIA DAS FONTES DE DADOS

### 4.1. Mapeamento das Entidades do Banco de Dados

| Fonte | Finalidade | Leitura/Escrita | Tenant/Empresa | Consumidores Principais |
|---|---|---|---|---|
| `public.lancamentos_diaristas` | Registros analíticos diários de apontamento de diárias | Leitura / Escrita (Insert, Update, Delete) | `tenant_id`<br>`empresa_id` | `DiaristasLancamento.tsx`<br>`RhDiaristasPainel.tsx`<br>`diaristas.service.ts`<br>`vw_aprovacoes_rh` |
| `public.diaristas_lotes_fechamento` | Lotes semanais consolidados de diaristas | Leitura / Escrita (Insert, Update via RPC/Service) | `tenant_id`<br>`empresa_id` | `RhDiaristasPainel.tsx`<br>`CentralFinanceira.tsx`<br>`CentralBancariaDiaristas.tsx`<br>`FechamentoCiclosOficialService` |
| `public.diaristas_logs_fechamento` | Trilha de auditoria formal de mutações, validações, edições e CNAB | Leitura / Escrita (Insert de log) | `tenant_id`<br>`empresa_id` | `RhDiaristasPainel.tsx`<br>`CentralBancariaDiaristas.tsx`<br>RPCs de governança |
| `public.regras_marcacao_diaristas` | Parâmetros de códigos de marcação (P, MP, F) e multiplicadores | Leitura / Escrita (via Admin) | `tenant_id`<br>`empresa_id` (nullable = global) | `DiaristasLancamento.tsx`<br>`TabRegrasDiaristas.tsx` |
| `public.colaboradores` | Cadastro de colaboradores (filtro `tipo IN ('diarista', 'EVENTUAL')`) | Leitura (e escrita via RH) | `tenant_id`<br>`empresa_id` | `ColaboradorService`<br>`RhDiaristasGestao.tsx`<br>`CNAB240` |
| `public.faturas` | Títulos a pagar gerados após aprovação financeira do lote | Leitura / Escrita (gerada por RPC) | `tenant_id`<br>`empresa_id` | `CentralFinanceira.tsx`<br>`aprovar_financeiro_diaristas` |
| `public.cnab_remessas_arquivos` | Arquivos de remessa CNAB240 gerados pelo Financeiro | Leitura / Escrita | `tenant_id`<br>`empresa_id` | `CnabRemessaArquivoService`<br>`CentralBancariaDiaristas.tsx` |
| `public.cnab_retorno_itens` | Ocorrências processadas a partir de arquivos de retorno bancário | Leitura / Escrita | `tenant_id`<br>`diaristas_lote_id` | `CnabConciliacaoService`<br>`CentralBancaria.tsx` |
| `public.vw_aprovacoes_rh` | View unificada que consolida Diaristas na fila global de aprovações | Leitura (SELECT) | `empresa_id` | `AprovacoesRh.tsx`<br>`AprovacoesService` |

### 4.2. Mapeamento das Funções e RPCs do Supabase

| Função / RPC | Assinatura | Responsabilidade | Contexto de Segurança |
|---|---|---|---|
| `validar_periodo_diaristas` | `(p_lote_id UUID, p_usuario_id UUID, p_usuario_nome TEXT, p_usuario_role TEXT)` | Valida o lote semanal no RH, atualiza status para `VALIDADO_RH` e grava log | `SECURITY DEFINER` |
| `validar_e_encerrar_diaristas` | `(p_lote_id UUID, p_usuario_id UUID, p_usuario_nome TEXT, p_usuario_role TEXT, p_target_status TEXT)` | Valida e encerra antecipadamente caso o fluxo financeiro seja dispensado na regra | `SECURITY DEFINER` |
| `reabrir_periodo_diaristas` | `(p_lote_id UUID, p_usuario_id UUID, p_usuario_nome TEXT, p_usuario_role TEXT, p_motivo TEXT, p_tipo_reabertura TEXT)` | Reabre lote no modo operacional (volta para encarregado) ou administrativo (restringe ao RH/Admin) | `SECURITY DEFINER` |
| `aprovar_financeiro_diaristas` | `(p_lote_id UUID, p_usuario_id UUID, p_usuario_nome TEXT, p_usuario_role TEXT)` | Aprova lote no Financeiro, gera faturas a pagar e consolida valores | `SECURITY DEFINER` |
| `recalcular_valor_lote` | `(p_lote_id UUID)` | Recalcula atomicamente a soma de todos os lançamentos do lote após edição administrativa | `SECURITY DEFINER` |
| `sync_diaristas_lote_conciliacao_context` | `(p_diaristas_lote_id UUID)` | Avalia conciliação bancária a partir de `cnab_retorno_itens`; promove a `PAGO` se 100% quitado | Executada por trigger/service |

---

## 5. ESTADOS E TRANSIÇÕES IDENTIFICADOS

O ciclo de estados do lote e dos lançamentos obedece à seguinte máquina de estados finita:

| Estado Lote | Estado Lançamento | Gatilho / Ação | Ator Responsável | Próximo Estado Permitido |
|---|---|---|---|---|
| *(Inexistente)* | `EM_ABERTO` | Lançamento e salvamento na grade semanal | Encarregado | `AGUARDANDO_VALIDACAO_RH` |
| `AGUARDANDO_VALIDACAO_RH` | `AGUARDANDO_VALIDACAO_RH` | Ação "Fechar Período Semanal" | Encarregado | `VALIDADO_RH` ou `EM_ABERTO` (reabertura) |
| `VALIDADO_RH` | `VALIDADO_RH` | Validação pelo RH no Painel ou na Central de Aprovações | RH | `FECHADO_FINANCEIRO` / `AGUARDANDO_PAGAMENTO` ou `AGUARDANDO_VALIDACAO_RH` (devolução) |
| `FECHADO_FINANCEIRO` / `AGUARDANDO_PAGAMENTO` | `FECHADO_FINANCEIRO` / `AGUARDANDO_PAGAMENTO` | Aprovação na Central Financeira (RPC `aprovar_financeiro_diaristas`) | Financeiro | `cnab_gerado` |
| `cnab_gerado` (`status_conciliacao: aguardando_conciliacao`) | `AGUARDANDO_PAGAMENTO` | Geração da remessa CNAB240 no internet banking | Financeiro | `PAGO` (se retorno total) ou `cnab_gerado` (se retorno parcial) |
| `PAGO` (`status_conciliacao: conciliado`) | `PAGO` | Processamento do arquivo `.RET` bancário com quitação 100% confirmada | Retorno Bancário / Sistema | **Estado Final Imutável** |
| `CANCELADO` | `CANCELADO` | Cancelamento formal de lote/lançamento com justificativa | Admin | **Estado Final** |

---

## 6. COMPARATIVO UX LAB × INTERFACE OFICIAL

| Dimensão | UX Lab Congelado | Interface Oficial Atual | Adaptação Necessária para Convergência |
|---|---|---|---|
| **Cabeçalho & Contexto** | Padrão unificado: título claro em font display, subtítulo descritivo, seletor de empresa e período em badges discretos no topbar | Em `RhDiaristasPainel.tsx`, filtros ocupam cards densos com múltiplos selects concorrentes e botões de filtro rápido despadronizados | **A — Apresentação:** Adotar o topbar contextual homologado com breadcrumb e seletor limpo de período semanal. |
| **KPIs do Módulo** | Cards executivos padrão (`ExecutiveMetricCard` / `MetricCard`) com tipografia `#0F172A`, rótulos discretos e sem caixas vermelhas agressivas | KPIs em `RhDiaristasPainel` usam cards customizados com contadores mesclados e cores semânticas saturadas | **A — Apresentação:** Migrar KPIs para a escala visual do Dashboard Executivo (Total Diárias, Diaristas Únicos, Valor Apurado, Em Aberto/Validados). |
| **Filtros e Visualização** | Tabs horizontais elegantes em padrão retangular (`Grade Semanal`, `Por Diarista`, `Por Data`, `Lotes & Ciclos`) | Tabs implementados com estado local fragmentado e sub-abas adicionais que causam perda de contexto | **A — Apresentação:** Reestruturar as visualizações mantendo as 4 visões homologadas sob Tabs padronizados do Design System. |
| **Grade Semanal (Matriz)** | Grade limpa com destaque de dias úteis, células compactas com indicação de código (P, MP, F), totalizadores na lateral | Em `DiaristasLancamento.tsx` funciona bem funcionalmente, mas em `RhDiaristasPainel.tsx` a grade é densa, com scrollbar lateral concorrente | **A — Apresentação:** Reutilizar o componente de grade semanal com espaçamento e tokens de cor suaves (verde discreto para P, âmbar para MP). |
| **Drawers vs. Modais Dialog** | Drawers laterais deslizantes (`DrawerPrimarioShell` 480px e `DrawerSecundarioShell` 560px) com sobreposição controlada | Uso extensivo de `Dialog` centralizados que bloqueiam a tela para reabertura, edição admin e confirmação de fechamento | **A — Apresentação:** Substituir os diálogos centrais invasivos por drawers laterais contextuais, seguindo o padrão de `CentralBancariaDiaristas.tsx`. |
| **Linha do Tempo / Timeline** | Stepper vertical claro (`TimelineVerticalStepper`) com responsáveis identificados por setor e etapa | Histórico de auditoria renderizado em tabela textual com 10 colunas comprimidas ou agrupamento manual de logs | **A — Apresentação:** Exibir a timeline do lote no drawer secundário com stepper vertical e manter a tabela de auditoria completa na aba de governança. |
| **Ações de Decisão (Aprovação / Devolução)** | Barra de ações inferior flutuante ou botões discretos no cabeçalho do drawer com justificativa obrigatória | Botões espalhados nas linhas da tabela ou dentro de cards | **A — Apresentação:** Centralizar as ações de validação no drawer de detalhes do lote. |
| **Integração com Fechamento de Ciclos** | Fechamento Motor 02 com checklist formal de 4 itens, consolidação de valores e rastreabilidade | Fechamento ocorre via modal que pede digitação de texto "FECHAR" sem checklist prévio | **B — Adapter:** Conectar a visualização do lote semanal ao checklist de integridade cadastral e volumétrica já definido no Fechamento Oficial. |
| **Central Bancária & CNAB** | Totalmente convergida com `DrawerPrimarioShell` e `DrawerSecundarioShell` | Já homologada em `CentralBancariaDiaristas.tsx` | **Preservar integralmente.** |

---

## 7. CLASSIFICAÇÃO DAS DIFERENÇAS IDENTIFICADAS

As diferenças detectadas entre o UX Lab e a interface oficial foram categorizadas conforme a régua de governança:

### Categoria A — Apresentação (Ajustes exclusivamente visuais)
1. **Paleta de cores e Superfícies:** Substituir fundos cinza saturados por superfícies brancas com canvas `#F8FAFC`, bordas discretas `#E2E8F0` e tipografia principal `#0F172A`.
2. **Escala de KPIs:** Reorganizar os cards do topo de `RhDiaristasPainel.tsx` para seguir o padrão `ExecutiveMetricCard`.
3. **Substituição de Modais Dialog por Drawers:** Converter os modais de edição administrativa, detalhes do lote e reabertura em drawers laterais deslizantes.
4. **Badges de Status:** Unificar os badges para utilizar o padrão `OrbeStatusBadge` do Design System, eliminando badges excessivamente coloridos.

### Categoria B — Adapter (Conexão entre UI convergida e contratos existentes)
1. **Adapter de Grade Semanal:** Estruturar um view-model limpo para a grade de diaristas que alimente tanto a visualização em leitura no RH quanto a edição operacional no Encarregado, consumindo os mesmos contratos de `LancamentoDiaristaService`.
2. **Adapter de Checklist de Validação:** Integrar o checklist de 4 pontos (Grade preenchida, Cadastros bancários íntegros, Zero inconsistências e Validação RH) para exibição no drawer de detalhes do lote antes da aprovação.

### Categoria C — Contratos Funcionais Existentes (Estritamente preservados)
1. **Regras de Idempotência e Bloqueio de Edição:** Preservar intacta a lógica de `LancamentoDiaristaService.createBatch` e a imutabilidade do lote com status `PAGO`.
2. **RPCs de Transição e Recálculo:** Preservar as chamadas às RPCs `validar_periodo_diaristas`, `reabrir_periodo_diaristas`, `aprovar_financeiro_diaristas` e `recalcular_valor_lote`.
3. **Mecanismo Fail-Closed de Pagamento:** Preservar a proibição de liquidação manual; o lote só atinge `PAGO` via conciliação do arquivo de retorno bancário.

### Categoria D — Bloqueios Reais
- **Nenhum bloqueio real identificado.** O domínio de backend e os serviços existentes fornecem 100% dos dados, estados e operações necessários para sustentar a interface convergida.

### Categoria E — Segurança Posterior (Para a etapa de Security Hardening)
1. **Políticas de RLS em `diaristas_lotes_fechamento`:** A migration `20260533` aplicou uma política `FOR ALL TO authenticated USING (true)`, delegando o isolamento de tenant/empresa à camada de aplicação (`EnvironmentQueryFilter`). Deve ser formalizada uma policy estrita por `tenant_id` no hardening geral de segurança.
2. **Auditoria de Tenant em Ajustes Retroativos:** Reforçar constraints de isolamento ao inserir ajustes manuais vinculados a lançamentos passados.

---

## 8. GOVERNANÇA VISUAL E REGRAS DE LAYOUT

Seguindo as diretrizes homologadas no Dashboard Executivo e na resolução de CONV-15:
- **Cor Primária:** Royal Blue `#2563EB` para identidade e ações primárias (ex.: "Validar Lote", "Salvar Grade").
- **Superfície & Fundo:** Canvas neutro `#F8FAFC`, cards em `#FFFFFF` com bordas suaves `#E2E8F0`.
- **Tipografia:** Inter / Outfit com hierarchy clara: título em `text-xl font-bold tracking-tight text-slate-900`, métricas em `font-display font-semibold`.
- **Prevenção de Sobrecarga Visual (Erros evitados de CONV-15):**
  - Não criar cards verticais repetitivos para cada diarista;
  - Não utilizar painéis vermelhos ou alertas de erro para pendências rotineiras de preenchimento;
  - Utilizar scroll interno fixo na matriz da grade, mantendo cabeçalho dos dias da semana sticky;
  - Não transformar badges de status em botões de filtro.

---

## 9. MATRIZ DE PERMISSÕES POR PERFIL

Com base nas evidências coletadas em `access-control.ts` (linhas 75–115, 183–186), no `AuthGuard` e nas RPCs de governança:

| Ação | Encarregado | RH | Admin | Financeiro |
|---|---|---|---|---|
| **Consultar lançamentos rascunho** | Sim (Sua empresa/unidade) | Sim (Todas da empresa) | Sim | Não (Apenas após fechamento) |
| **Lançar / Marcar diárias na grade** | Sim (Enquanto em aberto) | Sim (Modo administrativo) | Sim | Não |
| **Fechar semana (Criar lote)** | Sim | Sim | Sim | Não |
| **Validar Lote RH** | **Não** (Bloqueado) | **Sim** | **Sim** | Não |
| **Reabrir Lote** | **Não** (Bloqueado) | **Sim** | **Sim** | Não |
| **Editar lançamento fechado** | **Não** (Bloqueado) | **Sim** (Com justificativa) | **Sim** (Com justificativa) | Não |
| **Aprovar Financeiro** | **Não** (Bloqueado) | Não | **Sim** | **Sim** |
| **Gerar Remessa CNAB240** | **Não** (Bloqueado) | Não | **Sim** | **Sim** |
| **Importar Retorno / Conciliar** | **Não** (Bloqueado) | Não | **Sim** | **Sim** |
| **Liquidar Manualmente** | **Não** (Bloqueado) | **Não** (Bloqueado) | **Não** (Bloqueado) | **Não** (Desabilitado fail-closed) |

---

## 10. TESTES EXISTENTES E RISCOS DE REGRESSÃO

### 10.1. Suítes de Testes Disponíveis que Devem Ser Executadas
Durante a futura implementação da convergência (Etapa 02), as seguintes suítes de teste Vitest devem ser mantidas 100% verdes:

1. **`src/test/cnab_fechamento_lote_diaristas_fail_closed.test.ts`**
   - Testa conciliação parcial (lote permanece não pago) vs. integral (lote vira pago).
   - Testa inexistência de CTA manual de liquidação.
2. **`src/test/ux_diaristas_drawers_navigation.test.ts`**
   - Testa os 23 critérios de navegação: abertura de `DrawerPrimarioShell` e `DrawerSecundarioShell`, query params contextuais (`/bancario?tab=diaristas&origem=DIARISTA`), cabeçalho de coluna em Aprovações RH ("Valor / Diárias"), seletor de banco homologado (BB 001 e Itaú 341).
3. **`src/test/diaristas_segregation.test.ts`**
   - Testa o isolamento bidirecional estrito entre Produção e Homologação (`EnvironmentService`).
4. **`src/test/ux_fechamento_ciclos_v2_proto1.test.tsx`**
   - Testa a coexistência de Diaristas como 1 dos 4 motores canônicos no Fechamento de Ciclos.
5. **`src/test/ux_relatorios_familia_oficial_r02_r03_r04_r05_r07.test.tsx`**
   - Testa o relatório R02 de Fechamento de Diaristas.

### 10.2. Riscos de Regressão Mapeados
- **Risco 1 (Regressão de Idempotência):** Se a grade semanal alterar o formato do payload de `createBatch`, pode provocar duplicação de diárias.  
  *Mitigação:* Preservar exatamente a assinatura e a chamada de `LancamentoDiaristaService.createBatch`.
- **Risco 2 (Quebra de Recálculo em Edição):** Se o modal/drawer de edição administrativa não chamar a RPC `recalcular_valor_lote`, o valor do lote ficará descasado da soma das diárias.  
  *Mitigação:* Preservar a chamada de recálculo existente em `editarMutation`.
- **Risco 3 (Desalinhamento da Central Bancária):** Alterar nomes de status nos lotes (`VALIDADO_RH`, `FECHADO_FINANCEIRO`, `cnab_gerado`, `PAGO`) quebrará o pipeline de remessas e retorno bancário.  
  *Mitigação:* Status de banco de dados são imutáveis; adaptar apenas os labels visuais de apresentação.

---

## 11. PROPOSTA OBJETIVA PARA A ETAPA 02 (PLANO DE MIGRAÇÃO)

A Etapa 02 deverá focar **exclusivamente na convergência de frontend** da página oficial de Diaristas:

1. **Estrutura da Rota `/operacional/diaristas`:**
   - Adotar layout padronizado com `AppShell`, topbar com seletor de competência/semana e empresa.
   - Substituir o cabeçalho heterogêneo por um header com 4 KPIs executivos discretos:
     - *Total de Diárias Apuradas*
     - *Diaristas Ativos no Período*
     - *Valor Total da Folha Semanal*
     - *Status de Fechamento / Homologação RH*
2. **Abas de Visualização (Tabs):**
   - **Aba 1: Grade Semanal** (Matriz interativa de marcação Segunda–Domingo para conferência visual rápida);
   - **Aba 2: Por Colaborador** (Listagem agregada por diarista com função, dias trabalhados, valor e ações);
   - **Aba 3: Ciclos & Lotes** (Histórico dos lotes semanais da empresa, status de aprovação e acesso ao detalhe);
   - **Aba 4: Trilha de Auditoria** (Logs consolidados de governança com filtro e exportação XLSX já existente).
3. **Drawers de Detalhe e Edição:**
   - Implementar `DiaristaLoteDetalheDrawer` substituindo os múltiplos modais `Dialog`.
   - Implementar `DiaristaEdicaoAdminDrawer` para correções pontuais com justificativa obrigatória.
4. **Mapeamento de Rotas no UX Lab:**
   - Adicionar a rota `/operacional/diaristas` em `UX_LAB_ROUTES["diaristas"]` no `UxLabSidebar.tsx`, eliminando o toast provisório de planejamento.

---

## 12. PENDÊNCIAS QUE EXIGEM DECISÃO

Antes da execução da Etapa 02, solicitamos confirmação para as seguintes definições de escopo:

1. **Unificação da Tela do Encarregado (`/producao/diaristas`) vs. RH (`/operacional/diaristas`):**
   - Recomendamos **manter as duas rotas separadas por perfil**, conforme o princípio do negócio: o Encarregado acessa apenas a interface simplificada de toque móvel `/producao/diaristas`, enquanto o RH/Admin acessa a torre de controle analítica `/operacional/diaristas`. Confirmar essa manutenção?
2. **Exibição do Fechamento Automático:**
   - O serviço possui suporte a fechamento automático programado por dia da semana (`verificarFechamentoAutomatico`). Devemos manter essa configuração acessível apenas para perfis Admin em aba de configurações da tela?

---

## 13. DECLARAÇÃO DE ENCERRAMENTO DA ETAPA 01

A auditoria da Etapa 01 foi concluída com sucesso em regime **estritamente READ-ONLY**. Nenhuma linha de código funcional, teste, contrato ou banco de dados foi alterada.

O sistema está apto para receber a convergência visual na **ETAPA 02**, preservando 100% da estabilidade e robustez do módulo de Diaristas do ERP ORBE.
