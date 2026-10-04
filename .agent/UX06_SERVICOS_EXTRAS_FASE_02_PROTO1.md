# UX06 — SERVIÇOS EXTRAS V2
## FASE 02 — PROTÓTIPO 1 NO UX LAB

---

### 1. Resumo Executivo da Entrega

Em conformidade com as diretrizes da **Fase 02**, foi concebido e implementado no **UX Lab** o primeiro protótipo da tela especialista de **Serviços Extras V2**:

- **Rota:** `/ux-lab/servicos-extras`
- **Isolamento Total:** Implementação 100% restrita ao UX Lab, sem alterações em tabelas, schemas Supabase, migrations, RPCs, RLS ou na tela oficial de produção.
- **Pergunta Central Atendida:** *"Quais serviços extras foram realizados, quais precisam de ação e em que ponto do processo estão?"*
- **Status do Backend:** *Não foi identificado FIX backend bloqueante para iniciar o protótipo UX.*

---

### 2. O que foi herdado da fundação UX05 e o que foi adaptado

| Pilar Arquitetural | Herança UX05 (Operações por Volume) | Adaptação Específica para UX06 (Serviços Extras) |
| :--- | :--- | :--- |
| **Grid e Layout** | `max-w-[1560px] mx-auto`, gutters e paddings idênticos. | Mantido com rigor absoluto para harmonia com Dashboard e Torre. |
| **Cabeçalho Operacional** | Título, subtítulo técnico, badges de contexto e botão de Ação Primária. | Título "Serviços Extras", badge "Catálogo e Faturamento", botão primário "Novo Serviço Extra". |
| **Síntese Operacional (KPIs)** | 4 Cards acionáveis com contagem, valor monetário e scroll/highlight de 2.5s. | **Cards de Processo Logístico/Financeiro**: <br>1. *Serviços no Período* (Totalizador)<br>2. *Em Validação* (`PENDENTE`, `EM_VALIDACAO`, `DEVOLVIDO`)<br>3. *Aguardando Financeiro* (`APROVADO_OPERACAO`, `APROVADO_FINANCEIRO`)<br>4. *Prontos / Faturados* (`FATURADO`, `CONCLUIDO`).<br>❌ Sem indicadores contábeis/DRE. |
| **Filtro Temporal** | `UxLabFiltroTemporal` com atalhos ("Todo o Período", "Hoje", "Outubro/2026", "Setembro/2026") + Seleção Híbrida de Data/Range. | Integrado filtrando pelo campo canônico `data` do serviço extra. |
| **Barra de Ferramentas** | Busca textual combinada com filtros dropdown e alternância de densidade. | Filtros especializados: Status do Processo, Tipo de Cobrança (`FATURAVEL`, `INTERNO`, `REPASSE`), Unidade Operacional e Encarregado. |
| **Tabela Especialista** | Alta densidade, alinhamento numérico à direita, badges semânticos de status. | **11 Colunas Específicas:** Identificador, Data/Hora, Empresa/Cliente, Descrição do Escopo, Tipo/Categoria, Equipe/Headcount, Qtd × Valor, Materiais, Valor Total, Faturamento & Modalidade, Status do Processo. |
| **Headcount (Equipe)** | Em UX05 envolvia múltiplos colaboradores vinculados. | Em UX06 é estritamente numérico (`quantidade_colaboradores INTEGER`). **Representação padronizada:** `"{N} pessoas"` (ex: `4 pessoas`), sem inventar nomes, vínculos nominais ou CPFs. |
| **Fórmula de Valor** | Baseada em volume e snapshots contratuais. | Exibição matemática explícita: `(quantidade × valor_efetivo) + valor_materiais = valor_total`. |
| **Eliminação de Risco P0** | — | **Removido definitivamente o dropdown inline de pagamento na tabela.** Modalidade e status de pagamento são badges de leitura. Qualquer alteração deve ocorrer via fluxo auditado no Drawer. |
| **Drawer Especialista** | Linha clicável → abertura lateral com Diagnóstico, Dados, Ações e Auditoria. | Adaptado para o fluxo: <br>- Banner de Diagnóstico do Estado Atual<br>- Alerta de Devolução quando `DEVOLVIDO` (exibindo motivo e autor)<br>- Decomposição de materiais e suprimentos<br>- Classificação Financeira (Centro de Custo, Conta Contábil, Modalidade)<br>- Ações contextuais de despacho ("Diagnosticar & Despachar")<br>- Bloco de Imutabilidade e Governança pós-aprovação. |

---

### 3. Matriz de Cenários Mock (servicosExtrasMockData.ts)

Foram construídos 8 cenários realistas cobrindo integralmente o pipeline operacional e financeiro:

1. **SE-2026-0891 (Devolvido com Divergência):** `DEVOLVIDO` — Retrabalho de paletização com horas contestadas pelo cliente. Exibe alerta âmbar e motivo de devolução no Drawer.
2. **SE-2026-0892 (Em Análise Operacional):** `EM_VALIDACAO` — Strechamento manual de carga fracionada aguardando aceite de encarregado sênior.
3. **SE-2026-0893 (Faturado com Suprimentos):** `FATURADO` — Enlonamento de carreta com uso de fitas e lonas (R$ 380 materiais), pronto para cobrança mensal.
4. **SE-2026-0894 (Concluído e Baixado):** `CONCLUIDO` — Desova emergencial de container noturno (5 pessoas), faturado e liquidado via TED.
5. **SE-2026-0895 (Recém Lançado pelo Encarregado):** `PENDENTE` — Triagem de caixas avariadas aguardando primeira triagem do supervisor.
6. **SE-2026-0896 (Aprovado Operação → Fila Financeira):** `APROVADO_OPERACAO` — Limpeza pesada pós-vazamento, validado operacionalmente, aguardando financeiro emitir faturamento.
7. **SE-2026-0897 (Aprovado Financeiro → Faturamento):** `APROVADO_FINANCEIRO` — Montagem de kits promocionais (1.200 un), gerando duplicata com vencimento programado.
8. **SE-2026-0898 (Custo Interno sem Cobrança ao Cliente):** `APROVADO_OPERACAO` — Tipo `INTERNO` (reorganização de doca interna da ESC Log), não faturável a terceiros.

---

### 4. Validação e Qualidade Técnica

- **TypeScript:** Compilação estrita limpa (`npx tsc --noEmit` retornou 0 erros).
- **Testes Automatizados:** Suíte dedicada `src/test/ux_servicos_extras_v2_proto1.test.tsx` com 12 testes passando:
  - Renderização da rota `/ux-lab/servicos-extras`
  - Cabeçalho operacional com botão primário e badges
  - 4 cards de processos com contagens e valores
  - Estrutura completa de 11 colunas da tabela especialista
  - Headcount estritamente numérico (`{N} pessoas`)
  - **Eliminação de Risco P0:** Ausência de dropdowns de pagamento mutáveis na tabela
  - Filtro e busca textual em tempo real
  - Interação de scroll e destaque visual de 2.5s ao clicar nos cards de KPI
  - Abertura fluida do Drawer especialista ao clicar na linha
  - Exibição de alerta de devolução e motivo no cenário `DEVOLVIDO`
  - Nota de governança e imutabilidade no Drawer
  - Largura útil padrão de `max-w-[1560px]`
- **Navegação Integrada E2E:** `src/test/ux_lab_navigation_e2e.test.tsx` atualizado e passando (3/3 testes).

---

### 5. Status e Próximos Passos (CHECKPOINT)

> 🛑 **CHECKPOINT VISUAL:**  
> A entrega da Fase 02 está implementada, testada e em execução no dev server.  
> Conforme diretrizes da governança, o protótipo aguarda **inspeção visual e funcional humana no navegador** antes de qualquer homologação definitiva ou transição para a próxima fase.
