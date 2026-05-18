# ✅ CHECKLIST DE ESTABILIZAÇÃO — ERP ORBE
> Data início: 2026-05-18
> Status: 🔄 Em andamento (Etapa 1 concluída)

---

## ETAPA 1: DASHBOARD — ✅ CONCLUÍDA

### Problemas encontrados e corrigidos:

| # | Problema | Severidade | Status |
|---|---------|-----------|--------|
| 1 | **Ícone `X` não importado** — Se `activeFilter` fosse ativado, crasharia (JSX referencia `<X />` sem import) | 🔴 Crítico | ✅ Corrigido |
| 2 | **Tipo de alerta inconsistente** — `tipo: 'error'` no alerta de "atrasado" mas render testa `'destructive'` → estilo errado (primary em vez de destructive) | 🟡 Médio | ✅ Corrigido |
| 3 | **Custos pendentes exibidos como contagem** — `custosPendentes` é SUM monetária mas era exibido como `"5230 custo(s) pendente(s)"` → agora mostra `"R$ 5.230,00 em custos pendentes"` | 🟡 Médio | ✅ Corrigido |
| 4 | **Código morto `activeKpis`** — useMemo que retorna `dashboardKpis` sem transformação = complexidade desnecessária | 🟢 Baixo | ✅ Removido |
| 5 | **Typo na UI** — "Relatórios rápido" → "Relatórios rápidos" | 🟢 Baixo | ✅ Corrigido |
| 6 | **Alertas tipo `'info'` sem estilo dedicado** — não tinham branch CSS específico, caiam em else genérico | 🟢 Baixo | ✅ Corrigido |

### Validações positivas (OK):
- ✅ Estado de Loading com spinner e mensagem clara
- ✅ Estado de Error com botão de retry e mensagem explicativa
- ✅ Estado vazio nos gráficos com EmptyChartState
- ✅ KPIs calculados corretamente (receita - custos = lucro)
- ✅ Filtros de período (ano/mês) funcionais
- ✅ Gráficos com alternância linha/barra
- ✅ PieCharts com fallback vazio
- ✅ Tabela com filtro de tipo e status
- ✅ Formatação de moeda brasileira (R$)
- ✅ Navegação para operações via KPIs
- ✅ Relatórios rápidos com stats dinâmicas
- ✅ Seção de consolidado com leitura do período

---

## ETAPA 2: SIDEBAR/NAVEGAÇÃO — ✅ VALIDADA

### Validações positivas (OK):
- ✅ Grupos colapsáveis com persistência de scroll (sessionStorage)
- ✅ Controle de acesso por módulo (canAccess + isAdmin)
- ✅ Pulse operacional com badges coloridos
- ✅ Drawer de detalhes operacionais
- ✅ Portal do cliente com PortalGuard separado
- ✅ Logout funcional
- ✅ Perfil do usuário no footer com initials ou avatar

---

## ETAPA 3: CENTRAL BANCÁRIA — ✅ VALIDADA (1 correção)

| # | Problema | Severidade | Status |
|---|---------|-----------|--------|
| 1 | **Import duplicado de React** — `useMemo, useState` e `useEffect` em linhas separadas | 🟢 Baixo | ✅ Corrigido |

### Validações positivas (OK):
- ✅ 4 KPIs dinâmicos que reagem à aba ativa (remessa vs diaristas)
- ✅ Fila RH → Bancário com ações "Usar na remessa" e "Ver no financeiro"
- ✅ Formulário de preparar lote com validação obrigatória
- ✅ Auto-seleção de conta quando empresa tem apenas 1
- ✅ Validação de remessa antes da geração CNAB
- ✅ Resumo com mascaramento de conta bancária
- ✅ Geração CNAB com download automático
- ✅ Histórico com busca e badges de status
- ✅ Marcação de envio manual com observação
- ✅ Re-download funcional
- ✅ Toast feedback em todas as ações
- ✅ Persistência de filtros via searchParams
- ✅ Estado de loading em botões durante ações

---

## ETAPA 4: RH DIARISTAS — ✅ VALIDADA

### Validações positivas (OK):
- ✅ Status map cobre todos os valores (DB lowercase + governança uppercase + legado)
- ✅ StatusDiaristaBadge com fallback para status desconhecido
- ✅ Filtros: empresa, nome, função, status, período rápido
- ✅ 3 visões: diarista, data, grade semanal
- ✅ Período bloqueado quando há lote ativo
- ✅ Reabertura operacional vs administrativa
- ✅ Auditoria com snapshot pré-mutação capturado do DB
- ✅ Recálculo de lote via RPC com fallback direto
- ✅ Exportação de auditoria em XLSX
- ✅ Fechamento de período com confirmação
- ✅ Validação RH → Financeiro → Pago
- ✅ Auto-encerramento configurável
- ✅ KPIs calculados dos dados filtrados
- ✅ Alerta de lançamentos possivelmente incompletos

### Pontos de atenção (não bloqueantes):
- ⚠️ Muitos `console.log` de debug no admin edit (14 ocorrências)
- ⚠️ Arquivo tem 2180 linhas — candidato a componentização futura

---

## ETAPA 5: UTILS FINANCEIRO — ✅ VALIDADA

### Validações positivas (OK):
- ✅ `classificarFinanceiroSync` funciona offline sem API
- ✅ `classificarFinanceiro` assíncrono com fallback para sync
- ✅ `processarOperacao` normaliza modalidades legado
- ✅ Status de pagamento automático (ATRASADO se data > vencimento)
- ✅ Override manual de vencimento e modalidade suportados
- ✅ Cálculo de ISS condicional a NF
- ✅ Proteções contra NaN e undefined em todos os cálculos

---

## ETAPA 6: CENTRAL FINANCEIRA & PROCESSAMENTO RH — ✅ VALIDADA

### Validações positivas (OK):
- ✅ Integração do fluxo de aprovação RH → Financeiro testada e consistente.
- ✅ Tratamento de erros de `FINANCIAL_INELIGIBILITY` extraindo payload JSON para feedback UI.
- ✅ Modal de aprovação na Central Financeira processa itens com validação de status correto.
- ✅ Histórico de lotes anexado com acurácia (`appendLoteHistorico`).
- ✅ Lotes sem ocorrências operacionais monetizadas recebem tratamento amigável, sem crash.
- ✅ `invalidateQueries` do react-query operando adequadamente após ações de aprovação.

### Pontos de atenção (não bloqueantes):
- ⚠️ Necessidade de mockup visual temporário na UI para a reabertura de períodos (`ResultadosService.reabrir`), atualmente apenas mostra um Toast informativo.

---

## ETAPA 7: BANCO DE HORAS — ✅ VALIDADA

### Validações positivas (OK):
- ✅ `PainelGeral.tsx` validado e limpo.
- ✅ Cálculos de totais de saldo robustos, prevenindo `NaN` (exemplo: `Number(saldo.estimativa_valor || 0)`).
- ✅ Ordenação de prioridade tratada corretamente, identificando vencimento e débitos críticos.
- ✅ Timeline operacional formatada e encapsulada corretamente.

### Pontos de atenção (não bloqueantes):
- ⚠️ Ações em massa (`Compensar múltiplos`, `Aprovar pagamentos`) estão com mock-up front-end, alertando "Fluxo operacional habilitado na interface. Integração final fica para o próximo passo."

---

## 📋 MÓDULOS AINDA PENDENTES DE VALIDAÇÃO

| Módulo | Arquivo | Prioridade |
|--------|---------|-----------|
| Item | Quantidade | Status |
|------|-----------|--------|
| console.log em pages | ~23 ocorrências | ✅ Resolvido |
| console.log em services | ~32 ocorrências | ✅ Resolvido |
| Verificar try/catch sem feedback | ~24 arquivos | ✅ Resolvido (Confirmados fallbacks UI nas mutations) |

---

## ETAPA 8: CENTRAL CADASTROS — ✅ VALIDADA

### Validações positivas (OK):
- ✅ Validações explícitas de preenchimento (ex.: bloqueia sumbit vazio de CNPJ/nome).
- ✅ Fallbacks nas importações previnem crashes em formatações erradas da planilha de excel.
- ✅ Try/catch devidamente instrumentado para mostrar feedback nos toasters.
- ✅ Inativação lógica implementada nas mutations (soft-delete seguro).

---

## ETAPA 9: OPERAÇÕES E PONTOS — ✅ VALIDADA

### Validações positivas (OK):
- ✅ Validação nas importações de planilhas (`isTimeRangeValid`, `parseExcelTime` etc.) impede crashs e inputs irreais.
- ✅ KPIs (`caixaReal`, `faturamento`) protegidos por `Number.isFinite`.
- ✅ Funções de Clear e Processamento RH encapsuladas em Try/Catchs com Fallbacks Toast claros.
- ✅ Componentes de Tabelas isolados (`PontoTableBlock`, `OperacoesTableBlock`).

---

## 📋 MÓDULOS AINDA PENDENTES DE VALIDAÇÃO

| Módulo | Arquivo | Prioridade |
|--------|---------|-----------|
| Fechamento | Fechamento.tsx | 🟡 Média |
| Governança | CentralGovernanca.tsx | 🟢 Baixa |
| Configurações | Configuracoes.tsx | 🟢 Baixa |
| Relatórios | CentralRelatoriosIntegracoes.tsx | � Baixa |

---

## 📊 STATUS GERAL DO PROJETO

- **Módulos validados**: 11/15 
- **Bugs corrigidos**: 7
- **Status**: ⚠️ **PARCIAL — em progresso**
- **Bloqueios de entrega**: Nenhum crítico identificado até agora

---

## 🧠 REGRAS DE VALIDAÇÃO SEGUIDAS

1. ✅ Nenhuma feature nova criada
2. ✅ Nenhuma refatoração agressiva
3. ✅ Governança preservada
4. ✅ Arquitetura funcional mantida
5. ✅ Correções cirúrgicas apenas
6. ✅ Foco em coerência e estabilidade
