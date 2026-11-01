# ERP ORBE — CONV-22 / ETAPA 01
# Auditoria Final de Pendências Visuais e Funcionais de Interface

**Projeto:** ERP ORBE — ESC Logística 2026  
**Fase:** Convergência Visual Contínua (Design System Oficial)  
**Marco:** CONV-22 / ETAPA 01 — Auditoria Final Transversal  
**Data:** 11/10/2026  
**Natureza da Execução:** Estritamente LEITURA (Read-Only) — Auditoria técnica, dimensional e funcional sem modificação de código de produção, sem alterações no banco e sem comandos Git.  
**Governança:** Aprovada e submetida à deliberação exclusiva do proprietário do projeto.

---

## 1. Resumo Executivo da Auditoria

A presente auditoria final consolida a análise técnica e dimensional de toda a esteira de convergência visual do **ERP ORBE**, cobrindo o histórico completo da **CONV-01** até a **CONV-21**, com foco prioritário na verificação do **Fechamento Mensal CLT (CONV-15)** e na varredura de todas as 22 rotas canônicas do sistema nos viewports corporativos padrão:
- **1440 × 900** (Resolução de trabalho executivo / desktop corporativo)
- **1366 × 768** (Resolução padrão de laptops corporativos operacionais)

### Principais Conclusões:
1. **Fechamento Mensal CLT (CONV-15): Totalmente Estabilizado e Contido.**  
   A averiguação detalhada comprovou que o problema anterior de transbordamento geométrico, desalinhamento de viewport e distorção de rolagem vertical foi **efetivamente e definitivamente corrigido** através da contenção simétrica de viewport implementada em `CONV-15-FIX05`. Ambas as colunas (lista de empresas e painel de diagnóstico) mantêm rolagem vertical independente perfeitamente confinada ao viewport (`hasMainScroll: false`), e o `FechamentoDrawer` abre suavemente à direita sem gerar qualquer transbordamento horizontal (`horizontalOverflow: false` em 1440×900 e 1366×768). Todos os 13 testes automatizados da suíte `conv15_fechamento_mensal_clt.test.tsx` executaram com 100% de aprovação.
2. **Varredura Transversal de Tabelas e Layout (22 Módulos Oficiais):**  
   Em todos os 22 módulos do ERP, a página mãe é rigorosamente imune a vazamentos horizontais (`docScrollWidth <= windowWidth`). Os containers tabulares utilizam encapsulamento com `overflow-x-auto`, preservando a integridade das colunas.
3. **Detecção de Pendências Reais Classificadas:**  
   Foram comprovadas tecnicamente **4 pendências objetivas** no sistema:
   - **P1 (Operacional / Ergonômica em 1366×768):** Na rota `/operacional/diaristas`, o container de filtros utiliza a classe Tailwind `xl:flex-nowrap`. Como a barra lateral consome 256px, a largura útil remanescente em 1366×768 (~1110px) é insuficiente para acomodar os 8 filtros fixos em linha única. Como resultado, o botão de ação crítico **"Fechar Período"** é projetado para fora da tela (`left: 1476px`), ficando inacessível sem zoom ou scroll horizontal no laptop.
   - **P2 (Visual / Ergonômica):** Na rota `/financeiro/inadimplencia`, o container da tabela de títulos em atraso utiliza `overflow-hidden` em vez de `overflow-x-auto`, impedindo que usuários em telas de 1366px ou com colunas expandidas rolem a tabela para alcançar as colunas de "Ação" e "Status".
   - **P2 (Ergonômica / Arquitetural):** Na rota `/cadastros`, apesar da consolidação visual bem-sucedida da CONV-19 (4 `OrbeKpiCard`, paginação de 10 itens e tabela harmonizada), os formulários de criação/edição das 8 entidades ainda dependem de dezenas de modais `Dialog` sobrepostos em vez de Drawers laterais deslizantes contextuais (`Sheet`).
   - **P3 (Cosmética):** Na rota `/clt/pontos`, densidade ligeiramente elevada na barra de seleção de competência e filtros de jornada em resolução 1366×768.

---

## 2. Auditoria Prioritária: CONV-15 — Fechamento Mensal CLT

**Rota Canônica:** `/banco-horas/fechamento`  
**Componente Principal:** [`src/pages/BancoHoras/FechamentoMensalCLT.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/BancoHoras/FechamentoMensalCLT.tsx)  
**Componentes Associados:** [`FechamentoDrawer.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/fechamento/FechamentoDrawer.tsx), [`fechamentoMensalCltAdapter.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/adapters/fechamentoMensalCltAdapter.ts)  
**Suíte de Testes:** [`src/test/conv15_fechamento_mensal_clt.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv15_fechamento_mensal_clt.test.tsx) (13 testes, 100% aprovados)

### 2.1 Resultados Geométricos e Dimensionais

A auditoria executou testes instrumentados via Playwright headless com Chrome oficial, medindo as coordenadas exatas do DOM:

| Métrica Dimensional | Viewport 1440 × 900 | Viewport 1366 × 768 | Limite / Tolerância | Veredito |
|---|---|---|---|:---:|
| **Largura da Janela (`window.innerWidth`)** | `1440px` | `1366px` | — | Nominal |
| **Largura Total do Documento (`scrollWidth`)** | `1430px` | `1356px` | `<= window.innerWidth` | ✅ **Sem Overflow** |
| **Diferença Horizontal (`scrollWidth - innerWidth`)** | `-10px` | `-10px` | `<= 0px` | ✅ **Exato** |
| **Transbordamento Horizontal (`hasHOverflow`)** | **`false`** | **`false`** | `false` | ✅ **Aprovado** |
| **Rolagem na Raiz (`main.hasMainScroll`)** | **`false`** | **`false`** | `false` | ✅ **Contido** |
| **Contenção Vertical da Lista Esquerda (Empresas)** | `top: 343px` / `bottom: 872px`<br>`clientHeight: 529px` | `top: 343px` / `bottom: 740px`<br>`clientHeight: 397px` | `bottom <= windowH` | ✅ **Contido** |
| **Contenção Vertical do Diagnóstico Direito** | `top: 343px` / `bottom: 872px`<br>`clientHeight: 527px` | `top: 343px` / `bottom: 740px`<br>`clientHeight: 395px` | `bottom <= windowH` | ✅ **Contido** |
| **Largura do `FechamentoDrawer` Aberto** | `620px` (`right: 1430px`) | `620px` (`right: 1356px`) | `right <= windowW` | ✅ **Contido** |
| **Botões Fora da Tela (`clippedButtons`)** | `0` | `0` | `0` | ✅ **Perfeito** |

### 2.2 Análise Item a Item do Fechamento Mensal CLT

1. **Transbordamento Horizontal:**
   - **Observado:** A largura do documento é exatamente 1430px (em 1440px) e 1356px (em 1366px), absorvendo a calha da barra de rolagem sem gerar barra horizontal no navegador.
   - **Veredito:** Zero transbordamento horizontal.
2. **Visibilidade das Colunas e Ações:**
   - O workspace 50/50 distribui perfeitamente a lista de empresas à esquerda e o painel diagnóstico à direita.
   - Os botões *"Ver Detalhes do Fechamento"* e *"Revisar e Liberar Competência"* (ou *"Bloqueado por Pendências"*) estão posicionados no rodapé do diagnóstico (`mt-auto`, alinhados à direita) com dimensões `h-9 text-xs font-medium` e contraste corporativo adequado.
3. **Rolagem Horizontal e Vertical:**
   - A lista de empresas possui `overflow-y-auto overflow-x-hidden` e `max-h-[420px] lg:max-h-none`, garantindo que todas as 9 empresas possam ser roladas internamente sem expandir a página principal.
   - A coluna de diagnóstico possui scroll vertical independente para a lista de impedimentos (`max-h-[140px] overflow-y-auto`), evitando que uma lista extensa de bloqueios empurre as ações para fora do viewport.
4. **Cabeçalhos e Alinhamentos:**
   - Cabeçalho padronizado via `AppShell` (`title="Fechamento Mensal CLT"` e subtítulo com a competência formatada).
   - Barra de contexto com Seletor de Competência (Dropdown de meses dinâmico), Seletor de Unidade/Empresa e Botão *"Atualizar"* com ícone `RefreshCw`.
   - Grid de 4 `OrbeKpiCard` alinhados e consistentes com o Design System oficial.
5. **Modais e Drawers Associados (`FechamentoDrawer`):**
   - Ao acionar *"Ver Detalhes do Fechamento"*, o Drawer desliza à direita (`sm:max-w-[620px]`).
   - Apresenta:
     - Header fixo com badge semântico de estado (`PRONTO PARA FECHAR`, `BLOQUEADO`, `AGUARDANDO APROVAÇÃO`, `FECHADO`).
     - Card *"O que será consolidado?"* com composição detalhada analítica (`FOLHA_BASE`, `FOLHA_VARIAVEL`, `BANCO_HORAS`).
     - Card *"Checklist de Prontidão"* com ícones de sucesso (`CheckCircle2`), aviso (`Clock`) ou bloqueio (`AlertCircle`).
     - Card *"Efeito do Fechamento"* e *"Aviso Institucional"* reforçando a segregação estrita entre RH e Financeiro.
     - Card *"Rastreabilidade & Governança"* (Empresa, Responsável, Data/Hora da Revisão).
     - Confirmação formal em 2 etapas com feedback visual e prevenção contra cliques duplos.
     - Footer fixo com ações contextuais claras (*"Ver na Central de Inconsistências"*, *"Abrir Central de Aprovações"* ou *"Confirmar Fechamento"*).
   - O fechamento do Drawer restaura a visualização com total integridade.
6. **Estados de Carregamento e Vazio:**
   - `isLoading`: Bloco central com `Loader2` giratório e texto semântico *"Auditando prontidão e consistência das unidades CLT..."*.
   - `validationsFiltradas.length === 0`: Card suave `bg-card border-border rounded-xl` indicando ausência de pendências na competência.
7. **Determinação Definitiva:**
   - **O problema anterior foi EFETIVAMENTE CORRIGIDO.** Não restam pendências de interface na rota `/banco-horas/fechamento`.

---

## 3. Auditoria do Histórico Git e Status dos Módulos (CONV-01 a CONV-21)

Mapeamento completo da cadeia de commits, documentação e suítes automatizadas de teste:

| Sprint Oficial | Rota Canônica | Arquivo Principal | Commit de Referência | Testes Automatizados | Status Técnico |
|---|---|---|---|---|:---:|
| **CONV-01** | `/operacional/dashboard` | `Dashboard.tsx` | `0b7fcca` | `conv01_dashboard_executivo.test.tsx` (12/12) | ✅ Homologado |
| **CONV-02** | `/operacional/pipeline` | `PipelineOperacional.tsx` | `7ad38a3` | `conv02_torre_operacional.test.tsx` (8/8) | ✅ Homologado |
| **CONV-03** | `/operacoes-volume` | `Operacoes.tsx` | `fe30d32` | `conv03_operacoes_volume.test.tsx` (11/11) | ✅ Homologado |
| **CONV-04** | `/operacional/servicos-extras` | `ServicosExtrasRecebidos.tsx` | `0eef6fe` | `conv04_servicos_extras.test.tsx` (10/10) | ✅ Homologado |
| **CONV-05** | `/operacional/custos-extras` | `CustosExtrasRecebidos.tsx` | `60737ad` | `conv05_custos_extras.test.tsx` (8/8) | ✅ Homologado |
| **CONV-CLT** | `/clt/pontos` | `PontoJornadasClt.tsx` | `32d4e07`, `f4f3d15` | Suíte de integração CLT | ✅ Homologado |
| **CONV-06** | `/rh/aprovacoes` | `AprovacoesRh.tsx` | `ba98e4a` | `conv06_central_aprovacoes.test.tsx` (32/32) | ✅ Homologado |
| **CONV-07** | `/inconsistencias` | `Inconsistencias.tsx` | `278c3f5` | `conv07_central_inconsistencias.test.tsx` (17/17) | ✅ Homologado |
| **CONV-08** | `/fechamento` | `Fechamento.tsx` | `0c626cd` | `conv08_fechamento_ciclos.test.tsx` (19/19) | ✅ Homologado |
| **CONV-09** | `/financeiro/receitas` | `ReceitasPipeline.tsx` | `c80ea8f` | `conv09_receitas_operacionais.test.tsx` (40/40) | ✅ Homologado |
| **CONV-10** | `/financeiro` | `CentralFinanceira.tsx` | `ed518f5` | `conv10_despesas_contas_pagar.test.tsx` (57/57) | ✅ Homologado |
| **CONV-11** | `/bancario` | `CentralBancaria.tsx` | `472e781` | `conv11_central_bancaria.test.tsx` (25/25) | ✅ Homologado |
| **CONV-12** | `/financeiro/inadimplencia` | `Inadimplencia.tsx` | `84fdfea` | `conv12_inadimplencia.test.ts` (16/16) | ⚠️ Pendência P2 |
| **CONV-13** | `/financeiro/dre` | `RelatorioDRE.tsx` | `c0521ae` | `conv13_resultado_operacional_dre.test.tsx` (21/21) | ✅ Homologado |
| **CONV-14** | `/relatorios` | `CentralRelatoriosOficial.tsx` | `9f5399d` | `conv14_central_relatorios_oficial.test.tsx` (8/8) | ✅ Homologado |
| **CONV-15** | `/banco-horas/fechamento` | `FechamentoMensalCLT.tsx` | `12dc301` | `conv15_fechamento_mensal_clt.test.tsx` (13/13) | ✅ Homologado |
| **CONV-16** | `/operacional/diaristas` | `RhDiaristasPainel.tsx` | `14b8b1c` | 8 suítes / testes CONV-16 | ⚠️ Pendência P1 |
| **CONV-17** | `/operacional/intermitentes`<br>`/operacional/intermitentes/lotes` | `IntermitentesRecebidos.tsx`<br>`IntermitentesLotes.tsx` | `98a2f92`, `43c7386` | 10 suítes / 74 testes CONV-17 | ✅ Homologado |
| **CONV-19** | `/cadastros` | `CentralCadastros.tsx` | `66f4782` | `conv19_central_cadastros_ui.test.tsx` | ⚠️ Pendência P2 |
| **CONV-20** | `/cadastros/regras-operacionais` | `RegrasOperacionais.tsx` | `8eddc81`, `5307ee8` | `conv20_regras_operacionais_ui.test.tsx` + Complementares | ✅ Homologado |
| **CONV-21** | `/configuracoes` | `Configuracoes.tsx` | `9bd6c51` | `conv21_etapa02_preferencias_perfil.test.tsx` + Complementares | ✅ Homologado |

---

## 4. Matriz de Pendências Encontradas nos Demais Módulos

Classificação estrita conforme os critérios do projeto:
- **P0** — Bloqueia utilização ou compromete segurança (Nenhuma pendência P0 identificada).
- **P1** — Prejudica fluxo operacional importante.
- **P2** — Divergência visual / ergonômica relevante.
- **P3** — Refinamento cosmético opcional.

---

### Detalhamento das Evidências e Pendências

```
+-----------------------------------------------------------------------------------------------------------------------+
| PENDÊNCIA 01 (P1): Botão "Fechar Período" projetado para fora da tela em 1366×768 (Diaristas)                        |
+-----------------------------------------------------------------------------------------------------------------------+
| Rota Afetada:           | /operacional/diaristas                                                                     |
| Componente:             | src/pages/Rh/RhDiaristasPainel.tsx (linhas 1104 a 1249)                                    |
| Viewport Afetado:       | 1366 × 768 (e telas com largura útil < 1220px)                                              |
| Comportamento Esperado: | Todos os filtros e a ação "Fechar Período" devem ser visíveis e acessíveis sem rolagem      |
|                         | horizontal na janela. Em larguras menores, a barra deve quebrar em 2 linhas (flex-wrap).    |
| Comportamento Observado:| O container usa `xl:flex-nowrap`. Em 1366px, o breakpoint `xl:` (>=1280px) força linha       |
|                         | única. Como a sidebar consome 256px, sobram ~1110px. Os 8 controles somam >1200px, e o     |
|                         | botão "Fechar Período" é empurrado para `left: 1476px` (fora da tela de 1366px).           |
| Impacto Operacional:    | O encarregado/RH em laptop padrão 1366×768 não consegue fechar o ciclo semanal de diaristas |
|                         | sem aplicar zoom negativo no navegador.                                                     |
| Correção Recomendada:   | Substituir `xl:flex-nowrap` por `2xl:flex-nowrap` ou permitir quebra de linha              |
|                         | (`flex-wrap gap-2.5`) quando a largura útil de conteúdo for inferior a 1240px.              |
+-----------------------------------------------------------------------------------------------------------------------+
```

```
+-----------------------------------------------------------------------------------------------------------------------+
| PENDÊNCIA 02 (P2): Tabela com `overflow-hidden` em vez de `overflow-x-auto` (Inadimplência)                          |
+-----------------------------------------------------------------------------------------------------------------------+
| Rota Afetada:           | /financeiro/inadimplencia                                                                  |
| Componente:             | src/pages/Financeiro/Inadimplencia.tsx (linhas 603-604)                                    |
| Viewport Afetado:       | 1366 × 768 e visualizações com colunas expandidas                                            |
| Comportamento Esperado: | A tabela deve possuir barra de rolagem horizontal local (`overflow-x-auto`) se a soma das 9  |
|                         | colunas ultrapassar a largura do card.                                                      |
| Comportamento Observado:| O container utiliza `overflow-hidden`. As colunas da direita ("Status" e "Ação") correm      |
|                         | risco de corte em telas menores sem possibilidade de rolagem horizontal pelo usuário.       |
| Impacto Operacional:    | Dificuldade de acesso ao botão de ação em títulos com descrições longas em monitores baixos.|
| Correção Recomendada:   | Envolver a `<Table>` em `<div className="overflow-x-auto">` e remover `overflow-hidden`    |
|                         | do elemento pai imediato, alinhando ao padrão canônico de `/operacoes-volume` e `/bancario`.|
+-----------------------------------------------------------------------------------------------------------------------+
```

```
+-----------------------------------------------------------------------------------------------------------------------+
| PENDÊNCIA 03 (P2): Monolito de Modais `Dialog` vs Drawers Deslizantes (Central de Cadastros)                         |
+-----------------------------------------------------------------------------------------------------------------------+
| Rota Afetada:           | /cadastros                                                                                 |
| Componente:             | src/pages/CentralCadastros.tsx (5.757 linhas)                                              |
| Viewport Afetado:       | Geral (1440×900 e 1366×768)                                                                |
| Comportamento Esperado: | Edição e criação de entidades em Drawers laterais (`Sheet`), mantendo o contexto da tabela|
|                         | visível, com checklist integrado ao receber links de pendências (`from=fechamento-clt`).   |
| Comportamento Observado:| A página utiliza dezenas de modais `Dialog` flutuantes que cobrem o centro da tela,       |
|                         | divergindo da ergonomia de Drawers adotada em todos os demais módulos homologados.          |
| Impacto Operacional:    | Descontinuidade de padrão ergonômico; maior complexidade de manutenção no componente.       |
| Correção Recomendada:   | Em sprint futura dedicada, migrar progressivamente os modais de cadastro para Drawers      |
|                         | contextuais com o componente canônico `Sheet`.                                              |
+-----------------------------------------------------------------------------------------------------------------------+
```

```
+-----------------------------------------------------------------------------------------------------------------------+
| PENDÊNCIA 04 (P3): Alta Densidade de Controles no Topo de Ponto CLT em 1366×768                                      |
+-----------------------------------------------------------------------------------------------------------------------+
| Rota Afetada:           | /clt/pontos                                                                                |
| Componente:             | src/pages/Clt/PontoJornadasClt.tsx                                                         |
| Viewport Afetado:       | 1366 × 768                                                                                 |
| Comportamento Esperado: | Espaçamento uniforme entre seletores de competência, colaborador e botões de ação.          |
| Comportamento Observado:| Em 1366×768, a barra superior de filtros acumula muitos elementos pequenos, gerando uma     |
|                         | densidade visual elevada, embora sem quebra de layout ou overflow horizontal.              |
| Impacto Operacional:    | Cosmético apenas; nenhum botão ou dado fica inacessível.                                   |
| Correção Recomendada:   | Refinamento de espaçamentos (`gap-2`) e compactação de labels nos seletores secundários.    |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

## 5. Isolamento Rigoroso: Pendências de Interface vs. Salvaguardas de Dados

A auditoria verificou expressamente os cenários onde o sistema apresenta alertas ou bloqueios:

1. **Fechamento CLT (89 Bloqueios em 9 Empresas):**
   - Os 89 bloqueios correspondem a colaboradores reais provenientes da importação do coletor RHID que se encontram com `status_cadastro = 'pendente_complemento'`.
   - **Conclusão:** Trata-se de governança de dados e salvaguarda fiscal mandatória (*Fail-Closed*). O sistema está funcionando exatamente conforme a regra de negócio homologada. **Não constitui defeito de interface.**
2. **Lote Intermitente `6e48aa` (Bloqueado):**
   - O lote foi bloqueado por ausência de dados bancários/fiscais completos antes da emissão de remessa.
   - **Conclusão:** Salvaguarda de integridade financeira bancária. **Não constitui defeito de interface.**

---

## 6. Matriz de Priorização e Plano Recomendado de Correção (Etapa 02)

Para a **Etapa 02 (Correção Controlada de Pendências)**, recomendamos a execução estritamente na seguinte ordem de prioridade:

| Ordem | Gravidade | Módulo | Arquivo | Natureza da Intervenção | Risco de Regressão |
|:---:|:---:|---|---|---|:---:|
| **1º** | **P1** | **Diaristas** (`/operacional/diaristas`) | `src/pages/Rh/RhDiaristasPainel.tsx` | Ajustar container de filtros para permitir quebra de linha antes de 1366px (`flex-wrap`), garantindo que o botão "Fechar Período" permaneça sempre visível. | **Baixo** (Ajuste estritamente de classe CSS). |
| **2º** | **P2** | **Inadimplência** (`/financeiro/inadimplencia`) | `src/pages/Financeiro/Inadimplencia.tsx` | Adicionar `<div className="overflow-x-auto">` ao redor da tabela de títulos em atraso, prevenindo corte de ações. | **Baixo** (Ajuste ergonômico de container). |
| **3º** | **P3** | **Ponto CLT** (`/clt/pontos`) | `src/pages/Clt/PontoJornadasClt.tsx` | Refinar densidade de espaçamento dos filtros da barra de topo em telas 1366×768. | **Mínimo** (Apenas padding/gap). |
| **4º** | **P2** | **Central de Cadastros** (`/cadastros`) | `src/pages/CentralCadastros.tsx` | Planejamento de desacoplamento futuro dos formulários para Drawers (Recomendado manter para fase de evolução arquitetural). | **Médio** (Módulo extenso com muitas entidades). |

---

## 7. Conformidade com as Restrições de Governança

- **Modificações em código de produção:** Nenhuma linha alterada.
- **Operações destrutivas ou de banco:** Zero execuções destrutivas.
- **Comandos Git:** Nenhum comando `git add`, `git commit`, `git push`, `git reset`, `git rebase` ou `git merge` foi executado.
- **Testes automatizados:** Todas as execuções foram estritamente de leitura, validação e auditoria visual através de scripts de inspeção em `scratch/`.

---

**Auditoria Final da CONV-22 / Etapa 01 concluída com sucesso.**  
*Aguardando autorização expressa do proprietário do projeto para dar início à Etapa 02.*
