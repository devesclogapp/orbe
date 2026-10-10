# ERP ORBE — CONV-17 / ETAPA 01
# Auditoria Funcional, Mapeamento de Telas e Diagnóstico UI/UX — Módulo Intermitentes

**Data da Auditoria:** 09 de Outubro de 2026  
**Projeto:** ERP ESC Logística 2026  
**Módulo:** Pessoas & RH → Intermitentes  
**Agente Executor:** Antigravity (Arquiteto Técnico & Auditor de Sistemas)  
**Modalidade:** READ-ONLY (Auditoria estática, mapeamento de contratos e testes sem mutação)  
**Documento:** `CONV-17-ETAPA01-AUDITORIA-INTERMITENTES.md`  
**Status da Etapa:** Concluída — Aguardando Autorização para ETAPA 02  

---

## 1. RESUMO EXECUTIVO

O módulo de **Trabalhadores Intermitentes** do ERP ORBE é responsável por gerenciar a cadeia de remuneração de colaboradores sob regime de contrato intermitente (Lei 13.467/2017), cuja remuneração é estritamente vinculada às convocações, jornadas efetivamente cumpridas e componentes de adicionais legais (horas normais, horas extras 50%, horas extras 100% e adicional noturno).

### 1.1 Premissa Fundamental Homologada
O módulo **NÃO É UMA CÓPIA DE DIARISTAS**:
- **Diaristas:** Remuneração diária por presença/tabela de diárias em grade semanal operacional, com fechamento de ciclo semanal e rateio/apropriação direta por centro de custo ou operação.
- **Intermitentes:** Remuneração horária apurada individualmente a partir do espelho de ponto/convocação, sem divisor mensal CLT (220) e sem rateio do valor global da operação. O valor a pagar é a somatória exata das horas cumpridas multiplicadas pelas taxas pactuadas, acrescidas dos adicionais legais.

### 1.2 Síntese do Diagnóstico
1. **Mecanismo Funcional e Backend:** O fluxo de ponta a ponta encontra-se funcionalmente construído no banco e na camada de domínio: ingestão via Edge Function (`importar-intermitentes-tio`), fechamento quinzenal/mensal em lotes (`intermitentes_lotes_fechamento`), validação com Fail-Closed cadastral pelo RH (`AprovacoesRh` e `intermitentes.service.ts`), transição financeira para contas a pagar (`rh_financeiro_lotes`), geração de arquivo CNAB 240 multibanco (`MotorCNAB240`) e quitação na conciliação via retorno bancário (`cnabConciliacao.service.ts` e RPC `processar_baixa_retorno_bancario_item`).
2. **Diagnóstico UI/UX:** As telas operacionais (`IntermitentesRecebidos.tsx` e `IntermitentesLotes.tsx`) foram implementadas com estilo visual legado/provisório:
   - Uso de cores e bordas arbitrárias (`#DEDEDE`, `#737373`, `#171717`).
   - Card de KPIs definido inline com 8 micro-cards sobrecarregados (`grid-cols-8`), sem aderência ao padrão `ExecutiveMetricCard` (CONV-01 a CONV-16).
   - Tipografia sem padronização nos tokens oficiais do Design System (Manrope/Syne para display e Inter para texto).
   - Inconsistências de navegação e botões com links desatualizados (ex.: link direto para `/bancario?tab=intermitentes&origem=INTERMITENTE` sem validação de permissão de operador).
3. **Lacuna de Contrato / Interface Identificada:** O componente `CentralBancariaDrawerOficial.tsx` invoca o método inexistente `IntermitentesLoteService.gerarRemessaCNAB(...)`, enquanto o serviço canônico disponibiliza `IntermitentesLoteService.gerarCNABParaLote(...)` com parâmetros distintos. O componente `CentralBancariaIntermitentes.tsx` foi criado de forma isolada mas não foi conectado nas rotas principais do `App.tsx`.

---

## 2. INVENTÁRIO DE ROTAS E TELAS

O mapeamento exaustivo identificou **7 superfícies de interface** diretamente envolvidas no ciclo dos Intermitentes, além de rotas de integração e serviços transversais:

| # | Rota | Componente TSX | Perfil de Acesso | Finalidade | Origem dos Dados (Entrada) | Próxima Etapa (Saída) | Estado Funcional | Diagnóstico UX Atual |
|---|---|---|---|---|---|---|---|---|
| **01** | `/operacional/intermitentes` | `IntermitentesRecebidos.tsx` | Encarregado / RH / Admin | Recepção, visualização e conferência das jornadas vindas do Tio Digital; fechamento do período em lote. | Tabela `lancamentos_intermitentes` via Supabase | Fechamento de Lote → `/operacional/intermitentes/lotes` | Funcional (Ativo) | **Divergente:** 8 micro-cards hardcoded, bordas `#DEDEDE`, tipografia arbitrária, tabela compacta sem design system oficial. |
| **02** | `/operacional/intermitentes/lotes` ou `/intermitentes/lotes` | `IntermitentesLotes.tsx` | RH / Financeiro / Admin | Painel de controle de lotes fechados, auditoria das convocações, timeline e aprovação financeira. | Tabela `intermitentes_lotes_fechamento` + joins | Validação RH / Aprovação Financeira / CNAB | Funcional (Ativo) | **Divergente:** Header customizado em vez de AppShell padrão; botões de navegação lateral sem tokens; cards com classes `#DEDEDE`. Possui Drawer Primário e Secundário, porém com estilos divergentes do CONV-08/CONV-16. |
| **03** | `/intermitentes/aprovacoes` ou `/rh/aprovacoes?flowType=INTERMITENTE` | `AprovacoesRh.tsx` | RH / Gestor / Admin | Central unificada de aprovação com pílula `INTERMITENTE` travada; análise detalhada via `AprovacaoDecisaoDrawer`. | View `vw_aprovacoes_rh` | Aprovação → `rh_financeiro_lotes` / Devolução | Homologado (CONV-06) | **Preservar:** Padrão oficial CONV-06 com drawer de decisão e travas Fail-Closed. |
| **04** | `/intermitentes/inconsistencias` ou `/inconsistencias?flowType=INTERMITENTE` | `Inconsistencias.tsx` | Encarregado / RH / Admin | Torre de resolução de pendências cadastrais (falta de CPF, sem empresa vinculada ou lote devolvido). | `InconsistenciasTransversaisService` | Resolução → Edição / Cadastros | Homologado (CONV-07) | **Preservar:** Padrão oficial CONV-07 com gaveta de diagnóstico profundo e rota de reparo direto. |
| **05** | `/bancario?tab=intermitentes&origem=INTERMITENTES` | `CentralBancaria.tsx` + `CentralBancariaDrawerOficial.tsx` | Financeiro / Admin | Central Bancária Oficial; monitoramento das obrigações bancárias, geração da remessa CNAB e liquidação. | `BancarioOficialAdapter` (FONTE 3: `intermitentes_lotes_fechamento`) | Download TXT CNAB / Upload RET | Homologado (CONV-11) | **Preservar na casca:** Apresenta inconsistência na chamada de geração de remessa dentro de `CentralBancariaDrawerOficial`. |
| **06** | *(Sem rota direta no App.tsx)* | `CentralBancariaIntermitentes.tsx` | Financeiro | Componente especialista bancário de intermitentes com drawer e timeline própria. | `intermitentes_lotes_fechamento` | Remessa CNAB / Conciliação | Órfão / Testes | **Investigar Contrato:** Código completo de esteira bancária isolado na pasta Financeiro, referenciado apenas em testes E2E (`intermitentes_central_bancaria_drawer.test.ts`). |
| **07** | `/fechamento` | `Fechamento.tsx` + `FechamentoCiclosOficialService` | RH / Financeiro / Admin | Visão macro de Fechamento de Ciclos da competência (Motor 3: Intermitentes). | `intermitentes_lotes_fechamento` | Conclusão do ciclo mensal | Homologado (CONV-08) | **Preservar:** Adaptador canônico `adaptarMotorIntermitentes` já integrado no padrão 4-cards. |

---

## 3. MAPA DO PIPELINE FUNCIONAL REAL

O percurso implementado e comprovado no código-fonte segue 7 macroetapas sequenciais:

```
[1. Coletor / Tio Digital]
          │
          ▼
   Edge Function: importar-intermitentes-tio
   (Registro em historico_importacoes / EmpresaResolver)
          │
          ▼
   Tabela: lancamentos_intermitentes (status_pipeline: 'RECEBIDO' ou 'DEVOLVIDO')
          │
          ▼
[2. Recepção Operacional: /operacional/intermitentes]
   - Visualização das jornadas diárias, convocações e horas (normais, HE, noturna)
   - Correção manual de inconsistências (vinculação de empresa / ajuste de valor)
          │
          ▼  Ação: Fechar Período Intermitente (IntermitentesLoteService.fecharPeriodo)
[3. Geração do Lote Fechado]
   - Tabela: intermitentes_lotes_fechamento (status: 'AGUARDANDO_VALIDACAO_RH')
   - Itens em lancamentos_intermitentes atualizados para status_pipeline: 'EM_ANALISE_RH'
          │
          ▼
[4. Validação pelo RH: /intermitentes/aprovacoes ou /operacional/intermitentes/lotes]
   - Verificação de completude cadastral (Fail-Closed: CPF, banco, agência, conta)
   - Decisão:
        ├─ DEVOLVER: status -> 'DEVOLVIDO' (alimenta Central de Inconsistências)
        └─ APROVAR: IntermitentesLoteService.validarLote
                 - intermitentes_lotes_fechamento -> status: 'VALIDADO_RH'
                 - lancamentos_intermitentes -> status_pipeline: 'APROVADO_RH'
                 - syncToRHFinanceiro -> cria/atualiza em rh_financeiro_lotes ('AGUARDANDO_FINANCEIRO')
          │
          ▼
[5. Aprovação Financeira: IntermitentesLotes.tsx / Central Financeira]
   - Ação: IntermitentesLoteService.aprovarFinanceiro
   - intermitentes_lotes_fechamento -> status: 'FECHADO_FINANCEIRO'
   - lancamentos_intermitentes -> status_pipeline: 'ENVIADO_FINANCEIRO'
   - rh_financeiro_lotes -> status: 'AGUARDANDO_PAGAMENTO'
          │
          ▼
[6. Central Bancária & Geração CNAB 240: /bancario]
   - BancarioOficialAdapter mapeia como PRONTO_BANCO
   - Validação de conta bancária pagadora ativa da empresa
   - IntermitentesLoteService.gerarCNABParaLote -> MotorCNAB240.gerar (segmentos A/B)
   - cnab_remessas_arquivos registrado com intermitentes_lote_id
   - intermitentes_lotes_fechamento -> status: 'CNAB_GERADO'
          │
          ▼
[7. Retorno Bancário & Conciliação / Quitação]
   - Upload de arquivo .RET na Central Bancária
   - RPC processar_baixa_retorno_bancario_item ou cnabConciliacao.service.ts
   - Conciliação integral de cada lançamento:
        - lancamentos_intermitentes -> status_pipeline: 'PAGO'
        - intermitentes_lotes_fechamento -> status: 'PAGO'
        - rh_financeiro_lotes -> status: 'PAGO'
```

---

## 4. APURAÇÃO DE JORNADA E CONTRATO DE REMUNERAÇÃO

### 4.1 Campos de Jornada e Remuneração
Diferente dos pontos CLT (que gravam batidas brutas em `registros_ponto`) e de Diaristas (que gravam dias inteiros ou meias diárias em `lancamentos_diaristas`), o módulo de Intermitentes recebe de forma pré-processada do Tio Digital o seguinte payload diário:
- `data_referencia`: data de prestação da jornada.
- `convocacao`: identificador/código da convocação formal do trabalhador.
- `cargo`: função desempenhada na convocação.
- `departamento`: setor/centro operacional da empresa.
- `horas_trabalhadas`: somatório total da jornada diária.
- `horas_normais`: horas contratuais da jornada.
- `he_50`: horas extraordinárias a 50%.
- `he_100`: horas extraordinárias a 100%.
- `hora_noturna`: horas prestadas em horário noturno (computada com a redução legal e adicional).
- `total`: valor monetário líquido/bruto a pagar ao colaborador pela jornada apurada.

### 4.2 Desacoplamento Trabalhista em `RemuneracaoResolver.ts`
A regra de remuneração operacional em `src/services/operationalEngine/RemuneracaoResolver.ts` (linhas 223–261) foi expressamente blindada:
- **Não aplica divisor CLT de 220 horas**.
- **Não calcula salário fixo mensal**.
- **Não rateia montante bruto de operações logísticas**.
- Utiliza como base:
  1. `valor_hora_direto` (se pactuado individualmente);
  2. Ou `valor_diaria / jornadaDiariaHoras`;
  3. Ou `valor_base` direto por hora.
- Retorna `modeloAplicado: 'INTERMITENTE'` e `origemDivisor: 'NAO_APLICAVEL'`.

### 4.3 Segregação e Auditoria de Ajustes
- **Dado Importado vs. Dado Ajustado:** A tabela `lancamentos_intermitentes` mantém os campos originais `origem: 'tio_digital'` e `arquivo_origem`.
- **Lacuna Detectada:** Quando o operador realiza um ajuste em `IntermitentesRecebidos.tsx` (modal "Corrigir Registro Intermitente"), os campos `horas_trabalhadas` e `total` são atualizados diretamente *in-place*. Não há tabela de auditoria de versões de jornada (como um `lancamentos_intermitentes_historico`), gerando uma oportunidade de auditoria formal na evolução futura.

---

## 5. SEGREGAÇÃO DE PERFIS E CONTROLE DE ACESSO

### 5.1 Matriz de Perfis no Domínio de Intermitentes

| Perfil | Ver Jornadas Recebidas | Editar Horas/Valores | Fechar Período (Lote) | Validar no RH | Aprovar no Financeiro | Gerar Remessa CNAB | Importar Retorno / Baixa |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Admin** | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| **RH** | Sim | Sim (Correção) | Sim | Sim | Não | Não | Não |
| **Financeiro** | Sim (Consulta) | Não | Não | Não | Sim | Sim | Sim |
| **Encarregado** | Sim (Recepção) | Apenas Empresa | Não | Não | Não | Não | Não |
| **Gestor** | Sim (Consulta) | Não | Não | Consulta | Consulta | Não | Não |

### 5.2 Lacuna no `access-control.ts`
Na auditoria de `src/lib/access-control.ts`:
1. `ACCESS_MODULES` possui módulos específicos para `diaristas_recebidos` e `pontos_recebidos`, mas **não possui** `intermitentes_recebidos`.
2. A rota `/operacional/intermitentes` está associada ao módulo genérico `operacoes_recebidas`.
3. A rota `/operacional/intermitentes/lotes` herda permissão de `/operacional/intermitentes`.
4. A rota alternativa `/intermitentes/lotes` (usada pelo breadcrumb e navegação direta) **não possui entrada em `ROUTE_ACCESS_RULES`**, caindo na regra permissiva do `AuthGuard` para rotas não mapeadas.

---

## 6. MAPA DE TABELAS, VIEWS, RPCS E SERVIÇOS

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BANCO DE DADOS (SUPABASE)                      │
├────────────────────────────────────────────────────────────────────────┤
│ Tabelas Canônicas:                                                     │
│  • public.lancamentos_intermitentes (RLS isolado por current_tenant_id)│
│  • public.intermitentes_lotes_fechamento (RLS por current_tenant_id)   │
│  • public.rh_financeiro_lotes (tipo = 'INTERMITENTES')                 │
│  • public.rh_financeiro_lote_itens (origem_evento = 'lancamentos_...') │
│  • public.cnab_remessas_arquivos (intermitentes_lote_id)               │
│  • public.cnab_retorno_itens (intermitentes_lote_id)                   │
│                                                                        │
│ Views:                                                                 │
│  • public.vw_aprovacoes_rh (bloco 6: UNION ALL com tipo 'INTERMITENTE')│
│                                                                        │
│ RPCs:                                                                  │
│  • public.processar_baixa_retorno_bancario_item                        │
│  • public.auto_set_tenant_id / public.update_updated_at_column         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                          SERVIÇOS DE DOMÍNIO                           │
├────────────────────────────────────────────────────────────────────────┤
│ • IntermitentesLoteService (src/services/domain/intermitentes.service) │
│ • BancarioOficialAdapter (src/services/bancarioOficialAdapter.ts)      │
│ • AprovacoesService (src/services/domain/aprovacoes.service.ts)        │
│ • InconsistenciasTransversaisService (src/services/inconsistencias...) │
│ • FechamentoCiclosOficialService (src/services/fechamentoCiclos...)    │
│ • RemuneracaoResolver (src/services/operationalEngine/...)             │
│ • MotorCNAB240 & CnabRemessaArquivoService (src/services/cnab/...)     │
│ • CnabConciliacaoService (src/services/cnab/cnabConciliacao.service.ts)│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                         EDGE FUNCTIONS (DENO)                          │
├────────────────────────────────────────────────────────────────────────┤
│ • supabase/functions/importar-intermitentes-tio/index.ts                │
│   (Bypass RLS com Service Role, EmpresaResolver, idempotência)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. MÁQUINA DE ESTADOS E TRANSIÇÕES

### 7.1 Estados de `lancamentos_intermitentes` (`status_pipeline`)
Constraint CHECK auditada em migration `20260710000001_intermitentes_correcoes_criticas.sql`:
1. `RECEBIDO`: Ingerido do Tio Digital, em aberto para conferência operacional.
2. `EM_ANALISE_RH`: Vinculado a um lote fechado, aguardando parecer do RH.
3. `APROVADO_RH`: Homologado pelo RH, liberado para tramitação financeira.
4. `DEVOLVIDO`: Apontamento com inconsistência (empresa não vinculada ou rejeição formal pelo RH).
5. `ENVIADO_FINANCEIRO`: Aprovado financeiramente, liberado para preparação de CNAB.
6. `PAGO`: Conciliado e liquidado via processamento de arquivo de retorno bancário.

### 7.2 Estados de `intermitentes_lotes_fechamento` (`status`)
Constraint CHECK auditada em migration `20260617000000_intermitentes_lotes_fechamento.sql`:
1. `AGUARDANDO_VALIDACAO_RH`: Lote criado pelo encarregado/operador na recepção.
2. `VALIDADO_RH`: Aprovado pelo RH via Central de Aprovações ou painel de lotes.
3. `DEVOLVIDO`: Rejeitado com justificativa obrigatória, retornando os itens para a fila operacional.
4. `CANCELADO`: Lote cancelado via reabertura de período.
5. `FECHADO_FINANCEIRO`: Obrigação homologada pelo setor financeiro para geração de remessa.
6. `CNAB_GERADO`: Arquivo posicional CNAB 240 emitido e registrado no banco.
7. `PAGO`: Lote 100% quitado e conciliado com as ocorrências de liquidação bancária.

---

## 8. DIAGNÓSTICO UI/UX POR TELA

Comparação direta entre as telas de Intermitentes e o Design System oficial do ORBE (referência Dashboard Executivo, CONV-01 a CONV-16):

### 8.1 Tela: `IntermitentesRecebidos.tsx` (Recepção Operacional)
- **Classificação:** **A — Migrar visualmente**
- **Diagnóstico Estético:**
  - **KPIs Desproporcionais:** Possui 8 cards em linha (`grid-cols-8`) com o componente caseiro `TopKpiCard`, poluindo a leitura visual e quebrando a hierarquia em resoluções menores. Deve convergir para 4 cards semânticos de alta relevância (ex.: Total Colaboradores, Jornadas Convocadas, Horas Efetivas Consolidadas, Montante a Homologar) utilizando `ExecutiveMetricCard`.
  - **Cores Hardcoded:** Uso explícito de `#DEDEDE` em bordas, `#737373` para textos secundários e `#171717` para valores numéricos, desrespeitando o padrão de tokens CSS do Tailwind (`border-border`, `text-muted-foreground`, `text-foreground`).
  - **Filtros e Toolbar:** Seletor de empresa e filtros de Mês/Ano com espaçamentos desiguais.
  - **Tabela:** O componente `IntermitentesTableBlock.tsx` utiliza estilo próprio (`esc-table-row`, `text-[11px]`, badge de status customizado) em vez da estrutura canônica de tabelas do ORBE.
- **Continuidade Operacional:**
  - O fluxo de "Fechar Período" exige empresa selecionada, mas o botão apenas desabilita ou alerta em toast. Deve ter feedback contextual claro ("Selecione uma empresa para fechar o lote").
  - O modal de correção pontual funciona, mas possui visual cru, sem o padrão dos drawers laterais do ORBE.

### 8.2 Tela: `IntermitentesLotes.tsx` (Painel de Lotes de Intermitentes)
- **Classificação:** **A — Migrar visualmente** + **C — Corrigir navegação**
- **Diagnóstico Estético:**
  - **Header Não Padrão:** Não utiliza as propriedades canônicas do `<AppShell title="..." subtitle="..." badge="...">`, inserindo um `<h1>` manual e botões de atalho diretamente no corpo.
  - **Cards de Métricas:** Contém 4 cards estruturados, mas estilizados com classes caseiras (`bg-emerald-50/30`, `border-[#DEDEDE]`), devendo adotar `ExecutiveMetricCard`.
  - **Drawer Primário & Secundário:** Já importa `DrawerPrimarioShell` e `DrawerSecundarioShell`, o que é um avanço arquitetural. No entanto, o preenchimento interno, tipografia e badge de cabeçalho não estão perfeitamente alinhados ao drawer canônico de CONV-08 e CONV-16.
- **Navegação & Continuidade:**
  - O botão "Pagamentos e Remessas" no topo da tela navega para `/bancario?tab=intermitentes&origem=INTERMITENTE`. Porém, na Central Bancária o filtro de origem espera `origem=INTERMITENTES` (com "S"). Essa discrepância de parâmetro faz a Central Bancária abrir em "Todas as origens" ao invés de filtrar exclusivamente Intermitentes.
  - O botão "Aprovação Financeira" dentro do drawer operacional não valida formalmente se o usuário logado possui a role `financeiro` ou `admin` antes de disparar a ação, dependendo apenas do backend.

### 8.3 Central Bancária: `CentralBancariaDrawerOficial.tsx` (Trecho Intermitentes)
- **Classificação:** **D — Investigar contrato**
- **Diagnóstico Funcional/Contrato:**
  - No método `handleGerarRemessa` (linha 199), o componente executa:
    ```typescript
    await IntermitentesLoteService.gerarRemessaCNAB(item.loteId, {
      bancoRemessa: item.contaPagadora.bancoCodigo,
      contaBancariaId: contaIdLimpo,
    });
    ```
  - **Causa Raiz:** O método `gerarRemessaCNAB` **não existe** no serviço `IntermitentesLoteService` (ele só existe na assinatura mockada de testes). O método real em `intermitentes.service.ts` é `gerarCNABParaLote(params: { loteId, empresaId, geradoPor, geradoPorNome, empresaRemetente: { ... } })`.
  - **Impacto:** Se um operador tentar gerar remessa CNAB de intermitentes através do drawer oficial da Central Bancária (`CentralBancaria.tsx`), ocorrerá um erro de runtime (`IntermitentesLoteService.gerarRemessaCNAB is not a function`).

### 8.4 Componente: `CentralBancariaIntermitentes.tsx`
- **Classificação:** **D — Investigar contrato** + **E — Fora de rota direta**
- **Diagnóstico:**
  - Componente completo de 919 linhas com drawer primário, drawer secundário, pipeline horizontal e timeline vertical exclusivos para intermitentes bancários.
  - Não possui rota no `App.tsx` e não é importado por nenhuma página de produção.
  - Deve ser avaliado na Etapa 02 se seu comportamento deve ser unificado na `CentralBancaria.tsx` oficial ou se deve ser ativado como sub-rota especialista.

---

## 9. REFERÊNCIAS DO UX LAB

Na inspeção do UX Lab (`src/pages/UxLab/`), verificou-se:
1. **Dashboard do UX Lab (`UxLabDashboard.tsx`, linhas 796–859):**
   - Possui o card oficial **"Motor 4: Intermitentes (MÓDULO INDEPENDENTE COM VISUAL IRMÃO)"**, contendo:
     - Badge de total de cadastrados.
     - Métricas de Convocações ativas e horas cumpridas.
     - Valor acumulado no mês e na semana.
     - Indicador de Status do Lote e Status da Remessa CNAB.
     - Botão "Ver Lotes" direcionando para o fluxo de intermitentes.
2. **Fechamento de Ciclos do UX Lab (`UxLabFechamentoCiclos.tsx`):**
   - Possui o domínio `INTERMITENTES` com ícone `Calendar`, estado visual semântico (`PRONTO_PARA_FECHAR`, `BLOQUEADO`, `AGUARDANDO_APROVACAO`, `FECHADO`) e integração perfeitamente espelhada no serviço `FechamentoCiclosOficialService`.
3. **Inconsistências do UX Lab (`UxLabInconsistencias.tsx`):**
   - Possui a pílula de filtro e tratamento de inconsistências de Intermitentes homologada.
4. **Relatórios Hub (`UxLabRelatoriosHub.tsx`):**
   - Registra explicitamente `hasDataset: false, backlogRef: 'UX04-FLOW-INTERMITENTES-01'`, indicando que relatórios analíticos de intermitentes estão previstos como caderno de expansão posterior.

---

## 10. RISCOS, BLOQUEIOS E DEPENDÊNCIAS FINANCEIRAS

| Risco / Ponto Crítico | Severidade | Impacto | Proteção Existente / Ação Necessária |
|---|:---:|---|---|
| **Discrepância de chamada CNAB no Drawer Bancário** | 🔴 Crítico | Erro de execução ao tentar emitir remessa CNAB de Intermitentes via Central Bancária. | Alinhar a interface de `CentralBancariaDrawerOficial` com o contrato real `IntermitentesLoteService.gerarCNABParaLote`. |
| **Isolamento de Ambiente (Homologação × Produção)** | 🔴 Crítico | Contaminação de lotes de teste em contas reais e vice-versa. | O serviço já implementa `EnvironmentQueryFilter.applyEmpresaScope` e `assertEmpresaAllowed` com Fail-Closed ativo. |
| **Parâmetro de Link Quebrado no Topo de Lotes** | 🟡 Médio | O botão "Pagamentos e Remessas" abre a Central Bancária sem o filtro de Intermitentes selecionado. | Ajustar querystring de `/bancario?tab=intermitentes&origem=INTERMITENTE` para `origem=INTERMITENTES`. |
| **Falta de Módulo Específico em `access-control.ts`** | 🟡 Médio | Permissões de intermitentes atreladas ao módulo amplo `operacoes_recebidas`, impedindo RBAC granular. | Definir regra canônica de acesso para `/intermitentes/lotes` e associar permissão sem regressão. |
| **Edição in-place de Horas e Valores sem Auditoria** | 🟢 Baixo | Falta de histórico de valores prévios e motivo de alteração na tabela de lançamentos. | Manter contrato funcional inalterado nesta fase e mapear para auditoria posterior. |

---

## 11. TABELA EXECUTIVA DE TELAS E AÇÕES RECOMENDADAS

| Tela / Componente | Rota Atual | Estado Funcional | Estado UX | Ação Recomendada | Prioridade |
|---|---|---|---|---|:---:|
| **Intermitentes Recebidos** | `/operacional/intermitentes` | ✅ Funcional | ❌ Desatualizado | **Migrar Visualmente (A):** Aplicar tokens oficiais, substituir os 8 cards por 4 `ExecutiveMetricCard`, padronizar toolbar e tabela. | Alta |
| **Lotes de Intermitentes** | `/operacional/intermitentes/lotes`<br>`/intermitentes/lotes` | ✅ Funcional | ⚠️ Parcial | **Migrar Visualmente (A) + Corrigir Navegação (C):** Alinhar header ao AppShell padrão, corrigir link para Central Bancária, padronizar cards e Drawers. | Alta |
| **Central Bancária Drawer** | `/bancario` (Drawer) | ⚠️ Falha no disparo | ✅ Conforme | **Investigar Contrato (D):** Corrigir chamada do método de geração de remessa CNAB de intermitentes. | Crítica |
| **Aprovações RH (Intermitente)** | `/intermitentes/aprovacoes` | ✅ Homologado | ✅ Conforme | **Preservar (B):** Manter comportamento e visual oficial CONV-06. | Baixa |
| **Inconsistências (Intermitente)** | `/intermitentes/inconsistencias` | ✅ Homologado | ✅ Conforme | **Preservar (B):** Manter gaveta de diagnóstico e fluxo CONV-07. | Baixa |
| **Fechamento de Ciclos** | `/fechamento` | ✅ Homologado | ✅ Conforme | **Preservar (B):** Manter adaptador oficial CONV-08. | Baixa |
| **Central Bancária Intermitentes** | *(Componente sem rota)* | ⚠️ Isolado | ⚠️ Não roteado | **Investigar Contrato (D/E):** Avaliar necessidade de rota própria ou consolidação definitiva na Central Bancária. | Média |

---

## 12. PROPOSTA DE DIVISÃO EM ETAPAS DE CONVERGÊNCIA (CONV-17)

Com base nas evidências coletadas nesta auditoria READ-ONLY, a execução da convergência visual e de contratos deve ser fatiada em subetapas seguras:

- **ETAPA 01 (Esta Etapa — Concluída):** Auditoria Funcional, Mapeamento Arquitetural e Diagnóstico UI/UX.
- **ETAPA 02:** Alinhamento de Contrato & Correção de Navegação (Resolução da chamada CNAB no drawer bancário, ajuste do parâmetro `origem=INTERMITENTES`, mapeamento de rotas no `access-control.ts`).
- **ETAPA 03:** Convergência Visual da Tela de Entrada (`IntermitentesRecebidos.tsx` e `IntermitentesTableBlock.tsx`): 4 cards semânticos `ExecutiveMetricCard`, toolbar H-9, tokens oficiais e tabela responsiva padrão ORBE.
- **ETAPA 04:** Convergência Visual da Tela de Lotes (`IntermitentesLotes.tsx`): AppShell padrão, cards métricos, tabela com badges semânticos e refinamento dos Drawers Primário e Secundário.
- **ETAPA 05:** Varredura E2E e Auditoria Final de Não-Regressão (execução de toda a suíte de testes de RH, Financeiro, CNAB e Intermitentes).

---

## 13. CRITÉRIOS DE HOMOLOGAÇÃO PARA AS PRÓXIMAS ETAPAS

Para considerar o módulo de Intermitentes totalmente convergido e homologado ao final do ciclo:
1. **Preservação Integral de RH e CLT:** Zero alterações nas regras de apuração de horas, banco de horas CLT e folha mensal.
2. **Preservação do Módulo de Diaristas:** Nenhuma linha compartilhada de regras de negócio entre Diaristas e Intermitentes.
3. **Identidade Visual ORBE Conforme:** Nenhuma cor arbitrária `#DEDEDE` ou classes hardcoded remanescentes; 100% aderente ao Design System (Azul `#2563EB`, cards executivos, tipografia Syne/Manrope/Inter).
4. **Continuidade Operacional Íntegra:** Todo registro devolvido pelo RH navega corretamente para resolução em Inconsistências; todo lote aprovado flui para a Central Bancária sem erro de assinatura de método.
5. **Suíte Vitest 100% Verde:** Todos os testes unitários, de segregação e de integração passam sem quebras.

---

> **DIRETRIZ DE CONCLUSÃO DA ETAPA 01:**  
> A auditoria READ-ONLY está integralmente concluída. Nenhum código de produção ou backend foi modificado nesta fase.  
> O projeto aguarda a autorização expressa do usuário para iniciar a **ETAPA 02**.
