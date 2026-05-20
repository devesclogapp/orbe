# Plano de Implementação — Fluxo Operação por Volume

## 🎯 Objetivo Central
Implementar o pipeline tático e visual do fluxo operacional de volume do ERP Orbe. Este plano consolida rigorosamente as regras da **Arquitetura Operacional Mestre** (`orbe-flow-master.md`), as características de interação descritas pela skill **Operação por Volume** (`skill-fluxo-operacao-por-volume.md`) e os atributos estéticos do **Orbe Design System** (`Orbe design system.md`).

---

## 1. 🧱 Estrutura Mestre (Pipeline Único)

A regra arquitetural central estabelece que **Operação por Volume é um único fluxo**. Não existirão módulos, telas ou lógicas separadas dividindo a operação em "À vista", "Boleto" ou "Faturamento Mensal". A distinção é puramente um atributo comercial/financeiro gerido no mesmo pipeline. 

### Etapas do Pipeline (Sequência Obrigatória)
1. Lançamento Operacional
2. Validação Operacional
3. Consolidação Financeira
4. Faturamento
5. Recebimento

---

## 2. 🧩 UX e Design System (MVP)

A implementação deve seguir os princípios estruturais do ERP:

### Layout de 3 Colunas
O fluxo acontecerá dentro do esqueleto oficial:
- **[ Sidebar 240px ]**: Navegação global.
- **[ Conteúdo Flex ]**: Local de exibição da Tabela principal (com base na listagem consolidada de operações) e Dashboard de KPIs em background.
- **[ Painel Direito 320px ]**: Utilizado dinamicamente para contexto. Durante a validação, atuará como a área de inserção de justificativas, histórico e status de aprovação.

### Componentes Chave
- **Tabela de Operações**:
    - Fundo do cabeçalho da tabela: `--color-gray-100` (`#EBEBEB`), fontes da coluna em `Inter 500`.
    - Elementos interativos secundários usarão a cor azul de informação: `--color-info` (`#2563EB`).
- **OperationalPipelineModal**: Todo avanço de etapa deve explicitamente abrir o modal de progressão do pipeline. A navegação autônoma em busca da "próxima etapa" é proibida.
- **Status Badges**:
    - **Pendente**: fundo `#FEF9C3` (warning-soft), texto `#A16207` (warning-strong).
    - **Em Validação**: fundo `#DBEAFE` (info-soft), texto `#1D4ED8` (info-strong).
    - **Aprovado / Fechado**: fundo `#DCFCE7` (success-soft), texto `#15803D` (success-strong).
    - **Bloqueado / Recusado**: fundo `#FEE2E2` (error-soft), texto `#B91C1C` (error-strong).
- **Ações Primárias**: Aprovações e submissões cruciais do pipeline usarão exclusivamente o laranja da marca `--color-brand` (`#FD4C00`).

---

## 3. 🚀 Implementação por Etapa

### Etapa 1: Lançamento Operacional
- **Ação**: O usuário (Encarregado) registra empresa, cliente, operação, volume, valor unitário e modalidade de cobrança. (A competência temporal `YYYY-MM` é registrada sistematicamente).
- **Frontend**: O modal ou área de input requerirá uma validação do form (volume != 0, dados integrais preenchidos). Inputs seguirão altura `40px`, borda cinza `1px solid #C4C4C4` e foco ativo azul com sombra branda.
- **UX Final**: Ao clicar para lançar, ativa a próxima etapa visualizando o avanço para Validação.

### Etapa 2: Validação Operacional
- **Ação**: O revisor aprova (libera ao financeiro) ou devolve com restrição.
- **Frontend**: Operação realocada visualmente na tabela usando `FilterPill` de status. A ação de validação abre pelo painel lateral direito de conteúdo contextual com informações como Justificativa em caso de recusa.
- **Backend/Service**: Nenhuma geração de custo ou geração de recebimentos é disparada aqui. Apenas atualização da `flag` e logs do sistema no schema do Supabase.

### Etapa 3: Consolidação e Faturamento (O Financeiro)
- **Ação**: Financeiro recebe aprovados e converte valores por modalidade.
    - Se "À vista": prepara recebimento direto sem vencimento residual (caixa).
    - Se "Boleto" ou "Mensal": prepara um agendamento / boleto com data correspondente agrupada pela competência oficial (`YYYY-MM`).
- **UX**: Navegação conduzida para gerar faturas agrupadas. Nenhuma alteração operacional do volume pode ser feita na etapa do financeiro (Se precisar, "Devolver" para Validação).
- **Geração de Logs**: Toda consolidação deixa um Snapshot (com regra, data, e usuário consolidante).

### Etapa 4: Recebimento e Dashboard
- **Ação**: Reflete as mudanças em `DashboardConsolidadoService`. Apenas os valores que passaram pela camada de faturamento alimentam o serviço.
- **KPIs (Cards de Métricas)**:
    - Uso estrutural: Textos e Rótulos em `Inter`, enquanto Métrica principal de valores usa `Manrope 700 28px`.
    - Os cards evitarão realizar contas arbitrárias via front-end - eles mapearão do serviço que por sua vez consolida via API relacional. Adiciona métricas base de **Ticket Médio** ou **Variação Mês-a-Mês**.

---

## 4. 🔗 Trilha de Auditoria e Governança

Ao efetivar qualquer movimento (Aprovar, Devolver, Faturar):
- Toda operação crítica, caso alterada fora do regime comum (ex: override de Admin sobre um registro "Fechado"), obrigará a abertura do **Modal de Justificativa**.
- A persistência deste documento será blindada `append-only`, sem updates (Conforme diretriz base de banco multi-tenant seguro na regra global).

---

## 5. ✅ Checklist Final de Entrega

- [ ] Lançamento e interface central padronizada sob fonte (Manrope e Inter) e tokens CSS de MVP.
- [ ] Remoção de qualquer módulo isolado "Faturamento à vista" ou "Dashboard Boleto". Uma única visão.
- [ ] Integração do estado e hook `OperationalPipelineModal` ativo entre todas etapas ativando e empurrando a navegação.
- [ ] O componente dinâmico de `Dashboard` isolado do processamento puro - recebendo apenas estado persistido da nuvem.
- [ ] Restrição de campos de RH/banco de horas sendo contaminada pelas métricas de volumes lançadas.
