# 🔍 Auditoria Completa — ERP Orbe
### Fluxos · UX · Governança · Setorização

---

## 1. Mapa Geral dos Fluxos

### Fluxo A — Lançamento de Diaristas (Operacional)
```
Encarregado → /producao/diaristas (DiaristasLancamento)
  → Seleciona empresa / diarista / marcação / operação
  → Registra diária (status: em_aberto)
  → Lançamento salvo em lancamentos_diaristas
```
**Perfil executor:** Encarregado  
**Ponto de entrada:** Menu "Produção → Diaristas"  
**Ponto de saída:** Dado fica em aberto aguardando RH

---

### Fluxo B — Fechamento de Período (RH)
```
RH → /rh/diaristas (RhDiaristasPainel)
  → Visualiza lançamentos em_aberto do período
  → Filtra por semana / status / diarista
  → Clica "Fechar período" → Modal de confirmação (digita CONFIRMAR)
  → Sistema cria lote com status: fechado_para_pagamento
  → Todos os registros mudam de em_aberto → fechado_para_pagamento
```
**Perfil executor:** RH, Admin  
**Ponto de entrada:** Menu "RH → Diaristas Painel"  
**Ponto de saída:** Lote criado aguarda Financeiro

---

### Fluxo C — Pagamento de Diaristas (Financeiro)
```
Financeiro → /bancario (CentralBancaria) → aba Diaristas (CentralBancariaDiaristas)
  → Visualiza lotes com status: fechado_para_pagamento
  → Clica "Detalhes" → modal com lista de diaristas + valores + ajustes
  → [Opcional] Clica "CNAB" → modal de configuração bancária → gera arquivo .rem
  → Clica "Marcar como Pago" → confirm() nativo → lote vira pago
```
**Perfil executor:** Financeiro, Admin  
**Ponto de entrada:** Menu "Bancário → aba Diaristas"  
**Ponto de saída:** Lote marcado como pago

---

### Fluxo D — Faturamento de Clientes (Financeiro)
```
Admin/Financeiro → /financeiro (CentralFinanceira)
  → Seleciona empresa + competência (mês)
  → Consolida faturamento (AI processamento)
  → Tab "Faturamento" → aprova lote por cliente
  → Tab "Fechamento" → fecha período
  → → /bancario → gera remessa CNAB de colaboradores CLT
```
**Perfil executor:** Admin, Financeiro  
**Ponto de entrada:** Menu "Financeiro"  
**Ponto de saída:** CNAB gerado / período fechado

---

### Fluxo E — Cadastros (Admin/RH)
```
Admin → /cadastros (CentralCadastros)
  → Colaboradores / Empresas / Coletores
  → /rh/diaristas/cadastros (RhDiaristasGestao) → cadastra diaristas
  → /cadastros/regras-operacionais → configura regras financeiras + regras de diaristas
```

---

## 2. Problemas Encontrados

### 🔴 Redundâncias

#### R1 — Dois módulos bancários sem distinção clara
O sistema tem **duas "Centrais Bancárias"** visualmente distintas mas sem hierarquia:
- `/bancario` → `CentralBancaria.tsx` (remessa CNAB de CLT / colaboradores)
- `/bancario` → tab interna `CentralBancariaDiaristas.tsx` (pagamento de diaristas)

**Problema:** O usuário entra em "Bancário" mas não sabe imediatamente que se refere a dois universos financeiros completamente separados (colaboradores CLT vs. diaristas). O `CentralBancaria.tsx` renderiza um painel hub com abas, mas `CentralBancariaDiaristas` é um componente interno. Ambos usam nome semelhante e dividem a mesma URL (`/bancario`).

#### R2 — Dupla mutação idêntica em CentralFinanceira
`reprocessMutation` e `consolidarMutation` chamam **exatamente a mesma função** (`AIService.processDay`), apenas com labels diferentes ("Reprocessar" vs "Consolidar faturamento"). Isso gera confusão operacional: o usuário não sabe a diferença prática entre "reprocessar" e "consolidar".

#### R3 — Histórico de lotes no painel RH e no Financeiro
`RhDiaristasPainel` exibe um "Histórico de fechamentos" (lotes) **na mesma tela** onde o RH lança e fecha períodos. Mas `CentralBancariaDiaristas` também lista todos os lotes. Há redundância de visualização: o RH vê dados que são responsabilidade do Financeiro.

#### R4 — Exportação XLSX duplicada
Ambos `RhDiaristasPainel` (exportarXlsx) e `CentralBancariaDiaristas` (exportarXlsx) têm implementações independentes do mesmo XLSX. Código duplicado com estruturas diferentes para o mesmo conjunto de dados.

---

### 🟠 Ambiguidades

#### A1 — "Fechar período" vs "Fechado para pagamento" vs "Fechamento mensal"
O sistema tem três conceitos de "fechamento" sem nomenclatura unificada:
- **RH fecha período:** ação de congelar diaristas → status `fechado_para_pagamento`
- **Financeiro fecha competência:** fechamento mensal de colaboradores → status `fechado`
- **Histórico de lotes:** exibe `"Aguardando Pgto"` para status `fechado_para_pagamento`

O usuário financeiro vê status `fechado_para_pagamento` e na lista de lotes aparece "Aguardando Pgto". O RH chama de "Fechar período". São o mesmo conceito com 3 nomes.

#### A2 — Status "Reaberto" = em_aberto
No `statusBadge` de `CentralBancariaDiaristas`, o status `em_aberto` está mapeado como **"Reaberto"**. Mas no painel RH, `em_aberto` é "Em aberto" (lançamento normal). O mesmo valor de status tem dois significados dependendo do contexto (lote vs. lançamento).

#### A3 — Botão "CNAB" disponível para lotes já pagos
No `CentralBancariaDiaristas`, o botão "CNAB" aparece para **todos os lotes** independente do status — inclusive lotes já `pago`. Não há bloqueio. O usuário pode gerar um CNAB de um lote já pago, gerando potencial de duplo pagamento.

#### A4 — "Produção in-loco" vs "Diaristas"
No `navigationMeta.ts`, a rota `/producao` está listada como "Producao in-loco". Mas o menu de diaristas é `/producao/diaristas`. O Encarregado não sabe que para lançar diaristas deve ir em "Produção" — o link semântico entre "produção" e "diaristas" não é óbvio para usuários sem treinamento.

#### A5 — Confirmação via `window.confirm()` nativo
Em `CentralBancariaDiaristas`, o botão "Pago" usa `confirm("Confirmar pagamento deste lote?")` — diálogo nativo do browser, sem estilo, sem informações do lote, sem valor financeiro confirmado. É inconsistente com o padrão do sistema (que usa dialogs customizados com validação por texto).

---

### 🟡 Dificuldades de Uso

#### U1 — "Fechar período" bloqueado quando há filtro de status ativo
Em `RhDiaristasPainel`, o botão "Fechar período" é desabilitado quando `totalGeral.emAberto === 0`. Mas `totalGeral` é calculado sobre `dadosAgrupados`, que já aplica filtros de nome/função. Se o RH filtra por nome e vê apenas 1 diarista, `emAberto` pode ser 0 mesmo havendo lançamentos abertos de outros diaristas. O botão some sem explicação.

#### U2 — Nenhum link entre RH → Financeiro
Ao fechar um período, o RH recebe um toast "Período fechado. X registros · R$". Não há nenhum link, botão ou orientação de "agora vá para o Financeiro > Bancário > Diaristas para processar o pagamento". O RH fica sem saber o próximo passo da operação.

#### U3 — Modal de detalhes do lote sem scroll evidenciado
O `DialogContent` de detalhes tem `max-h-[90vh] overflow-y-auto`. Para lotes grandes (muitos diaristas), o conteúdo escapa do modal. Não há indicador visual claro de scroll, o usuário pode não perceber que há mais conteúdo abaixo.

#### U4 — Configuração CNAB repetida toda vez
A cada geração de CNAB, o usuário precisa preencher banco/agência/conta da empresa. Esses dados deveriam vir pré-preenchidos dos dados cadastrais da Empresa e só exigir confirmação. O preenchimento manual a cada lote é redundante e arriscado (erro de digitação).

#### U5 — Três modos de visão no painel RH sem contexto de quando usar cada um
`RhDiaristasPainel` tem "Agrupar por Diarista", "Agrupar por Data" e "Grade Semanal" sem qualquer orientação sobre qual usar em qual situação. Para usuário RH sem treinamento, a Grade Semanal parece ser a visão mais "natural" mas é a terceira opção.

---

### 🔵 Quebras de Fluxo

#### Q1 — O RH vê os lotes mas não pode agir sobre eles
No painel RH (`RhDiaristasPainel`), a seção "Histórico de fechamentos" mostra lotes com status "Aguardando Pgto". O RH está vendo dados que são de responsabilidade do Financeiro mas não tem nenhuma ação disponível sobre eles — nem link para ir ao Financeiro. Cria frustração: "já fechei, por que ainda está pendente?"

#### Q2 — Encarregado não tem visibilidade do ciclo completo
O Encarregado lança em `/producao/diaristas` e não sabe o que acontece depois. Não há tela de histórico para o Encarregado ver seus lançamentos passados, nem status dos lotes. O ciclo de feedback está quebrado.

#### Q3 — RH Gestão e RH Painel são rotas separadas sem vínculo visual
- `/rh/diaristas` = Painel (fechamento + visualização)  
- `/rh/diaristas/cadastros` = Gestão (cadastrar novos diaristas)

Ambos são apresentados como itens separados no menu. Mas conceitualmente, o RH que faz cadastro deveria ter acesso rápido ao painel e vice-versa. Não há breadcrumb entre eles.

#### Q4 — CentralFinanceira vs CentralBancaria sem fluxo claro entre elas
**Financeiro:** `/financeiro` → consolida + aprova faturamento de clientes CLT  
**Bancário:** `/bancario` → gera remessa CNAB + processa pagamento de diaristas

O usuário que aprovou faturamento em "Financeiro" precisa ir para "Bancário" para gerar a remessa. Mas em `CentralFinanceira`, o botão "Remessa CNAB" leva diretamente para `/financeiro/remessa` (uma sub-rota do Financeiro), não para `/bancario`. Os links são inconsistentes.

---

### ⚠️ Riscos Operacionais

#### O1 — Botão "Pago" sem valor confirmado (risco financeiro alto)
O confirm nativo ao marcar um lote como pago não mostra o valor do lote. O financeiro pode confirmar o pagamento errado clicando em "OK" por descuido. A ação deve exigir confirmação com o valor visível.

#### O2 — CNAB pode ser gerado múltiplas vezes para o mesmo lote
Não há bloqueio de geração repetida de CNAB. Um lote `fechado_para_pagamento` pode ter CNAB gerado N vezes. Embora o status mude para `cnab_gerado`, o botão continua disponível. Risco de duplicação de pagamentos via banco.

#### O3 — Fechamento sem validação de completude
O RH pode fechar um período que contém lançamentos de apenas 1 dos 5 dias da semana. Não há alerta de "existem diaristas sem lançamento neste período" antes do fechamento.

#### O4 — Reprocessamento e Consolidação são a mesma operação (CentralFinanceira)
`reprocessMutation` e `consolidarMutation` chamam `AIService.processDay` — a mesma função. Se o consolidado já foi aprovado, "Reprocessar" pode sobrescrever dados aprovados sem aviso.

---

## 3. Falhas de Setorização

### O que está correto
- RH fecha o período (não acessa dados financeiros de CLT)
- Financeiro é o único que pode marcar como pago
- Admin tem bypass para reabrir períodos (com justificativa)
- CNAB é exclusivo do Financeiro

### O que ainda está problemático

#### S1 — RH ainda vê dados do Financeiro (histórico de lotes)
O painel RH exibe a tabela de lotes com status financeiro ("Aguardando Pgto", "Pago"). Para o RH, o correto seria ver apenas "fechado (enviado ao financeiro)" sem detalhar o status bancário.

#### S2 — RH pode tecnicamente acionar o fechamento sem restrição por empresa
Em `RhDiaristasPainel`, `empresaId` é derivado de `perfil?.empresa_id ?? ((empresas as any[])[0]?.id ?? "")`. Se o RH não tem `empresa_id` no perfil, ele herda automaticamente a primeira empresa do sistema. Risco de RH fechar período da empresa errada.

#### S3 — Ajuste financeiro de lote é do Admin, não do Financeiro
Em `CentralBancariaDiaristas`, o botão "Ajuste" é exclusivo de `isAdmin`. Um usuário financeiro (papel Financeiro) não pode criar ajustes. Isso pode forçar o Financeiro a solicitar ao Admin operações triviais de correção.

#### S4 — Ausência de segregação Encarregado / RH no lançamento
O Encarregado lança em `/producao/diaristas`. O RH revisa em `/rh/diaristas`. Mas não há nenhuma tela de "revisão individual" onde o RH possa aprovar/rejeitar um lançamento antes de fechar o lote. O fechamento é "tudo ou nada".

---

## 4. Problemas de Navegação

### N1 — "Central Financeira" vs "Central Bancária" — confusão conceitual
Para o usuário final:
- **Central Financeira** = faturamento por cliente, competências, CLT
- **Central Bancária** = pagamentos bancários (CLT + diaristas)

O usuário pensa "quero pagar os diaristas" → vai para "Financeiro" → não encontra → vai para "Bancário" → encontra. A lógica não é intuitiva. "Bancário" parece sub-item de "Financeiro" mas são entradas de menu independentes.

### N2 — Rota `/processamento/legado` com redirect
`/processamento` redireciona para `/operacional/operacoes`. `/processamento/legado` ainda existe e renderiza a tela antiga. Isso é lixo de navegação — usuário pode chegar em telas legadas por caminhos antigos.

### N3 — Módulo RH sem entrada direta no menu principal
As rotas `/rh/diaristas` e `/rh/diaristas/cadastros` existem mas não estão definidas no `navigationMeta.ts`. Isso significa que não aparecem nos breadcrumbs e não têm seção de menu definida. O RH pode estar chegando via links diretos sem contexto de onde está.

### N4 — Produção sem seção de menu
`/producao` e `/producao/diaristas` estão no `navigationMeta.ts` como "Produção in-loco" na seção "Operacional", mas a URL pai é tratada como link independente do dashboard operacional. O Encarregado acessa via login operacional separado (`/login/operacional`), mas o fluxo de navegação não deixa isso explícito.

### N5 — Rotas de financeiro com prefixo inconsistente
- Remessa CNAB: `/financeiro/remessa` (sub-rota do financeiro)
- Central Bancária: `/bancario` (raiz separada)
- Histórico de remessas: `/financeiro/remessa/historico` (pertence ao `/bancario` no breadcrumb)

No `navigationMeta.ts` linha 16: `{ pattern: "/financeiro/remessa/historico", parentPath: "/bancario" }` — a rota está em `/financeiro/` mas o breadcrumb aponta para `/bancario`. Confusão arquitetural.

---

## 5. Problemas de UX por Tela

### Tela: RhDiaristasPainel (`/rh/diaristas`)

| Problema | Impacto |
|----------|---------|
| KPIs estáticos não reagem ao filtro de status | RH filtra "fechado" mas KPI continua mostrando total geral |
| Botão "Fechar período" azul igual ao primário do sistema (sem diferenciação de ação crítica) | Cliques acidentais |
| Sem indicação visual de "empresa atual" que está sendo visualizada | RH não sabe se está vendo os dados certos |
| Histórico de lotes aparece abaixo da tabela sem separação visual clara | Esconde que o lote já foi criado anteriormente e está aguardando pagamento |
| Filtro de "Próxima semana" sem utilidade prática para RH (o RH fecha o passado, não o futuro) | Poluição visual |

### Tela: CentralBancariaDiaristas (aba `/bancario`)

| Problema | Impacto |
|----------|---------|
| Botão "CNAB" sem tooltip explicativo sobre o que é CNAB240 | Usuário financeiro leigo não sabe o que fará |
| "Marcar como Pago" com confirm() nativo sem valor/lote exibido | Risco de confirmação errada |
| Modal de detalhes sem ações de "ir para próximo lote" | Financeiro precisa fechar, clicar em outro lote, abrir — fluxo lento |
| Status "Reaberto" confundível com "Em aberto" (cores diferentes mas nomes parecidos) | Confusão operacional |
| Nenhuma paginação na lista de lotes | Com muitos lotes, performance e visibilidade degradam |

### Tela: CentralFinanceira (`/financeiro`)

| Problema | Impacto |
|----------|---------|
| Dois botões "Reprocessar" e "Consolidar faturamento" com mesma função | O usuário não sabe qual usar |
| Botão "Reabrir" em fechamentos passados sem modal de confirmação ou justificativa | Reabertura silenciosa de período fechado |
| Tab "Fechamento" lista competências sem ação integrada (redireciona para outra tela) | Fluxo incompleto dentro da mesma tela |
| Filtro de empresa e mês isolados (sem "aplicar") — reage ao change direto | Pode gerar múltiplas requisições simultâneas |

### Tela: DiaristasLancamento (`/producao/diaristas`)

| Problema | Impacto |
|----------|---------|
| Encarregado não vê lançamentos anteriores do mesmo diarista na mesma view | Duplicação de registros involuntária |
| Sem contador de lançamentos do período atual por diarista | Encarregado não sabe quantos dias já lançou |

---

## 6. Recomendações Práticas

### R-01: Renomear e reorganizar os módulos bancários
**Problema:** "Central Financeira" + "Central Bancária" geram confusão.  
**Solução:**
- Renomear "Central Bancária" para **"Pagamentos"** ou **"Remessas e Pagamentos"**
- Sub-menu claro: "Diaristas", "Colaboradores CLT", "Histórico"
- CentralFinanceira deve ser renomeada para **"Faturamento"** ou **"Controladoria"**

### R-02: Unificar o confirm() de pagamento em modal próprio
Substituir `confirm("Confirmar pagamento deste lote?")` por um `Dialog` que exibe:
- Nome da empresa
- Período do lote
- Valor total
- Campo de confirmação textual ou checkbox

### R-03: Bloquear CNAB para lotes já pagos
Adicionar verificação: `l.status !== "pago"` antes de exibir o botão "CNAB". Status `pago` não deve permitir nova geração.

### R-04: Remover histórico de lotes do painel RH
O "Histórico de fechamentos" em `RhDiaristasPainel` deve ser removido ou substituído por um banner simples: "X lotes aguardando pagamento no Financeiro → [Ver no Bancário]". O RH não precisa gestionar dados do Financeiro.

### R-05: Separar "Reprocessar" de "Consolidar" ou unificar
Se as duas ações são iguais: remover um dos botões. Se são diferentes: documentar a diferença no código e exibir tooltips explicativos para o usuário. Botões ambíguos em telas financeiras são risco operacional.

### R-06: Pré-preencher dados bancários no modal CNAB
Usar os dados bancários já cadastrados na `Empresa` (banco, agência, conta) para pré-preencher o modal de CNAB. Exigir apenas confirmação, não re-digitação.

### R-07: Adicionar rotas RH ao navigationMeta
As rotas `/rh/diaristas` e `/rh/diaristas/cadastros` não estão no `navigationMeta.ts`. Adicionar para que breadcrumbs e seções de menu funcionem corretamente.

### R-08: Toast pós-fechamento com CTA para Financeiro
Após fechar período com sucesso, o toast deve incluir um link/botão: **"Ver no Bancário →"** que leva o RH para `/bancario` com o lote novo visível.

### R-09: KPIs do painel RH devem reagir aos filtros ativos
`totalGeral` atualmente acumula todos os dados agrupados, mas o `statusFiltro` pode estar em "Em aberto". Se o usuário está vendo apenas "Em aberto", os KPIs deveriam refletir apenas o filtro atual.

### R-10: Restringir "Criar Ajuste" ao perfil Financeiro além de Admin
Revisar se o papel `Financeiro` deveria ter acesso ao ajuste de lotes em `CentralBancariaDiaristas`. Atualmente só Admin pode. Isso pode gerar gargalo operacional com Admin acumulando tarefas triviais.

---

## 7. Lista Priorizada de Melhorias

### 🔥 Crítico — Impacta operação ou financeiro

| ID | Problema | Impacto |
|----|----------|---------|
| C1 | CNAB pode ser gerado para lotes já pagos (duplo pagamento) | 🔴 Risco financeiro real |
| C2 | Confirmação de "Marcar como Pago" sem valor exibido | 🔴 Erro humano provável |
| C3 | Reprocessar = Consolidar na CentralFinanceira (ação duplicada) | 🔴 Dados podem ser sobrescritos |
| C4 | Empresa padrão aplicada automaticamente se RH não tem empresa_id | 🔴 RH fecha período da empresa errada |
| C5 | Botão "Fechar período" some com filtro ativo sem explicação | 🔴 RH perde a ação crítica |

---

### ⚠️ Médio — Afeta experiência e setorização

| ID | Problema | Impacto |
|----|----------|---------|
| M1 | Histórico de lotes no painel RH (invasão de responsabilidade financeira) | 🟠 Confusão de papéis |
| M2 | Nenhum link RH → Financeiro após fechamento de período | 🟠 Quebra de fluxo cross-setor |
| M3 | navigationMeta sem rotas RH (sem breadcrumb e seção de menu) | 🟠 Navegação quebrada |
| M4 | "Central Financeira" vs "Central Bancária" — nomes confusos | 🟠 Usuário não sabe onde ir |
| M5 | CNAB exige re-digitação de dados bancários a cada geração | 🟠 Redundância + erro humano |
| M6 | Status "em_aberto" = "Reaberto" em lotes (nome incorreto) | 🟠 Confusão com lançamentos normais |
| M7 | Encarregado sem visibilidade do histórico de seus lançamentos | 🟠 Ciclo de feedback quebrado |

---

### 💡 Baixo — Melhoria estética ou refinamento

| ID | Problema | Impacto |
|----|----------|---------|
| L1 | KPIs do painel RH não reagem ao filtro de status | 🟡 Dados enganosos porém não críticos |
| L2 | Filtro "Próxima semana" sem utilidade para o RH | 🟡 Ruído de interface |
| L3 | Três visões de tabela sem guia contextual de qual usar | 🟡 Curva de aprendizado maior |
| L4 | Rotas legadas (`/processamento/legado`) ainda acessíveis | 🟡 Confusão para usuários antigos |
| L5 | Modal de detalhes sem navegação entre lotes | 🟡 Fluxo lento mas funcional |
| L6 | `window.confirm()` nativo inconsistente com o design system | 🟡 Estética e branding |

---

## Status Geral do Sistema

| Dimensão | Status |
|----------|--------|
| Fluxo Encarregado → RH | ⚠️ Parcial (falta feedback pós-lançamento) |
| Fluxo RH → Financeiro | ⚠️ Parcial (falta CTA de transição) |
| Fluxo Financeiro → Banco | ✅ Funcional (requere fix CNAB pago) |
| Setorização RH / Financeiro | ⚠️ Parcial (dados financeiros vazam para RH) |
| Governança Admin | ✅ Implementada (justificativa, audit trail) |
| Nomenclaturas e Navegação | 🔴 Confusa (renomeação necessária) |
| Riscos operacionais | 🔴 Presentes (CNAB duplicado, confirm sem valor) |
