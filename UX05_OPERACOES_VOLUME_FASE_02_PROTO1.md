# UX05 — OPERAÇÕES POR VOLUME V2
# FASE 02 — PROTÓTIPO 1: WORKSPACE ESPECIALISTA OPERACIONAL

**Documento:** `UX05_OPERACOES_VOLUME_FASE_02_PROTO1.md`  
**Status:** Concluído & Homologado no UX Lab  
**Rota:** `/ux-lab/operacoes-volume`  
**Data:** Outubro de 2026  

---

## 1. OBJETIVO & PERGUNTA CENTRAL DA TELA

O Protótipo 1 da tela especialista de Operações por Volume foi concebido para responder em menos de 5 segundos à pergunta central do operador e encarregado:

> **“Quais operações estão acontecendo, quais precisam da minha ação e em que ponto do processo cada uma está?”**

### Fronteiras de Responsabilidade no ERP ORBE
- **Dashboard Executivo:** Síntese executiva transversal C-Level.
- **Torre Operacional:** Saúde transversal e monitoramento de gargalos globais (sem CRUD ou gestão analítica).
- **Operações por Volume (UX05):** **Workspace de execução, acompanhamento in loco, resolução de restrições de horários e aprovação operacional.**
- **R01 — Analítico de Operações:** Relatório passivo para consulta histórica, filtros multicritério e exportação CSV/PDF.
- **Financeiro:** Emissão de duplicatas, faturamento mensal, remessa bancária e conciliação de recebíveis.

---

## 2. ARQUITETURA DA PÁGINA & HIERARQUIA VISUAL

A página prioriza **alta densidade de informação** e **silêncio visual**, eliminando "card walls" e caixas aninhadas desnecessárias:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ HEADER: Operações por Volume | [Contexto: Empresa] | [+ Nova Operação] │
├────────────────────────────────────────────────────────────────────────┤
│ SÍNTESE OPERACIONAL (4 KPIs Compactos - Estado do Trabalho):          │
│ [Operações no Período] [Aguardando Validação] [Com Restrição] [Prontas Faturar] │
├────────────────────────────────────────────────────────────────────────┤
│ BARRA DE TRABALHO:                                                     │
│ [🔍 Busca Rápida...] [Período] [Status Operação] [Serviço] [Mais filtros] │
├────────────────────────────────────────────────────────────────────────┤
│ TABELA OPERACIONAL DE ALTA DENSIDADE (PROTAGONISTA):                  │
│ Operação | Data | Unidade | Fornecedor/Transp | Serviço/Vol | Equipe  │
│ Status Operacional | Status RH | Pendência | Ação (Clique abre Drawer) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. SÍNTESE OPERACIONAL (ESTADO DO TRABALHO)

Em estrito cumprimento às diretrizes de design, foram eliminadas todas as métricas financeiras (Receita, Margem, Lucro, Ticket Médio) da síntese de cabeçalho:

1. **Operações no Período:** Total de operações filtradas sob a competência/data selecionada.
2. **Aguardando Validação:** Operações com apontamento realizado aguardando conferência (`RECEBIDO` ou `EM_VALIDACAO`).
3. **Com Restrição:** Operações com irregularidades in loco (`EM_RESTRICAO` por horário ausente ou `DEVOLVIDO_RH`).
4. **Prontas p/ Faturar:** Operações aprovadas operacionalmente prontas para ingresso no pipeline de faturamento (`AGUARDANDO_FATURAMENTO`).

---

## 4. DOIS PIPELINES DE STATUS DESACOPLADOS

A auditoria comprovou que Operações e RH possuem máquinas de estado distintas. A UI comunica ambos sem fundi-los em badges artificiais:

- **Status Operacional (`status`):**
  - `RECEBIDO` (Azul neutro / Aberto)
  - `EM_VALIDACAO` (Âmbar)
  - `EM_RESTRICAO` (Vermelho semântico)
  - `AGUARDANDO_FATURAMENTO` (Índigo)
  - `FATURADO` (Roxo / Documento emitido)
  - `RECEBIDO_FINANCEIRO` (Verde esmeralda / Baixa realizada)
  - `CONCLUIDO` (Verde solido / Ciclo completo)
- **Status RH (`status_rh`):**
  - `PENDENTE_RH` (Cinza neutro)
  - `EM_ANALISE_RH` (Âmbar)
  - `VALIDADO_RH` (Verde esmeralda)
  - `DEVOLVIDO_RH` (Vermelho)

---

## 5. TABELA OPERACIONAL & DIAGNÓSTICO LOCALIZADO

- **Densidade:** Desktop operacional otimizado para resoluções de 1024px a 1440px+, com rolagem horizontal controlada quando necessário.
- **Identificação da Linha:** Código em destaque font-mono Royal Blue (`OP-8821`).
- **Headcount vs Equipe:** Indicador compacto exibindo o headcount declarado e a contagem de colaboradores vinculados nominalmente (ex: `4 pess. (4 nom.)` ou `4 pess. (2 nom.)`).
- **Sinalização de Restrição:** Na coluna "Pendência", uma operação restrita exibe ícone de alerta vermelho com o motivo condensado (ex: `Horário de término in l...`), direcionando o foco do operador sem manchar a linha inteira.

---

## 6. DRAWER LATERAL DE DETALHE & AÇÕES

Ao clicar em qualquer linha da tabela, abre-se o Drawer lateral sem abandonar o contexto da lista:

### 6.1 Seções do Drawer
1. **Cabeçalho:** Código (`OP-8821`), data de execução, empresa/filial, e os dois badges de status em destaque.
2. **Contexto Operacional:** Fornecedor/Cliente, Transportadora, Placa do veículo, Produto transportado, CTRC, Volume e Horários in loco (Início/Término).
3. **Equipe Alocada:**
   - Headcount declarado exibido separadamente dos colaboradores nominais.
   - Nota explicativa neutra em caso de divergência numérica (comprovado que não representa erro cadastral automático).
   - Lista individual dos colaboradores com horários de ponto e indicador de infração.
4. **Composição do Valor:**
   - Detalhamento transparente: Descarga + Materiais/Insumos + ISS = Valor Total.
   - Exibição da regra comercial aplicada e valor unitário do contrato.
   - **Sem rótulo incorreto de "valor imutável".**
5. **Pipeline Financeiro & Modalidade:**
   - Modalidade da forma de pagamento (`FATURAMENTO_MENSAL`, `DUPLICATA`, `CAIXA_IMEDIATO`).
   - Relação financeira explícita: Agregação N:1 (mensal) vs Individual 1:1 (duplicata/caixa).
   - Status de liquidação e botão de despacho "Ver Fatura no Financeiro".
6. **Diagnóstico de Restrição (Quando aplicável):**
   - Bloco visual de alerta com motivo da restrição, motivo de devolução do RH (se houver), responsável atual e botão de ação contextual ("Regularizar Horários").
7. **Assimetria RH $\times$ Financeiro:**
   - Alerta explicativo quando o pagamento foi recebido mas o RH ainda está pendente de validação.

### 6.2 Governança de Ações (Aberto vs Fechado)
- **Operações Abertas (`RECEBIDO`, `EM_VALIDACAO`, `EM_RESTRICAO`):**
  - Botão "Editar Operação" **ativo**.
  - Botão "Excluir" **visível e ativo**.
- **Operações Faturadas / Fechadas (`AGUARDANDO_FATURAMENTO`, `FATURADO`, `RECEBIDO_FINANCEIRO`, `CONCLUIDO`):**
  - Botão "Editar Operação" **desabilitado** com tooltip explicativo da regra `ESTADO_FECHADO`.
  - Botão "Excluir" **oculto**, impedindo ações destrutivas pós-faturamento.

---

## 7. CENÁRIOS MOCK OBRIGATÓRIOS IMPLEMENTADOS

| Cenário | Código | Status Operacional | Status RH | Modalidade | Característica Chave |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **A** | `OP-8821` | `RECEBIDO` | `PENDENTE_RH` | Faturamento Mensal | Operação recém-lançada; edição e exclusão habilitadas. |
| **B** | `OP-8820` | `EM_VALIDACAO` | `PENDENTE_RH` | Faturamento Mensal | Sob conferência do supervisor in loco. |
| **C** | `OP-8819` | `EM_RESTRICAO` | `DEVOLVIDO_RH` | Duplicata | Horário de término ausente; ação "Regularizar Horários". |
| **D** | `OP-8818` | `AGUARDANDO_FATURAMENTO` | `VALIDADO_RH` | Faturamento Mensal | Pronta para faturar; edição bloqueada por `ESTADO_FECHADO`. |
| **E** | `OP-8815` | `FATURADO` | `PENDENTE_RH` | Faturamento Mensal | Fatura consolidada em Setembro; RH ainda em apuração. |
| **F** | `OP-8810` | `RECEBIDO_FINANCEIRO` | `PENDENTE_RH` | Caixa Imediato | Recebida via PIX; banner de assimetria aguardando RH; headcount divergente com nota neutra. |
| **G** | `OP-8801` | `CONCLUIDO` | `VALIDADO_RH` | Faturamento Mensal | Ciclo integralmente finalizado e arquivado. |

---

## 8. REFINAMENTOS DO HOTFIX 02.2 (LARGURA, NAVEGAÇÃO INTERATIVA & DRAWER)

1. **Grade Estrutural Padronizada:** A área útil foi alinhada com o padrão canônico das telas homologadas (Dashboard Executivo e Torre Operacional), utilizando `max-w-[1560px]` no container principal.
2. **Cards de Síntese como Atalhos Operacionais:**
   - Deixaram de ser leitura passiva para se tornarem gatilhos de navegação.
   - **Operações no Período:** Limpa a navegação rápida e faz scroll suave para o topo da tabela.
   - **Aguardando Validação:** Localiza a primeira operação em triagem (`RECEBIDO` ou `EM_VALIDACAO`), rola a lista suavemente e aplica ring de destaque temporário.
   - **Com Restrição:** Localiza imediatamente a primeira operação irregular (`EM_RESTRICAO` ou `DEVOLVIDO_RH`), rola até a visualização e aplica ring temporário vermelho/rose.
   - **Prontas p/ Faturar:** Localiza a primeira ocorrência pronta para faturamento (`AGUARDANDO_FATURAMENTO`).
   - **Preservação de Filtros Manuais:** A navegação rápida pelos cards nunca limpa a empresa, período ou serviço escolhidos pelo usuário.
   - **Feedback de Resultado Zero:** Se não houver ocorrência nos filtros atuais, comunica discretamente via toast sem disparar scroll sem destino.
   - **Comunicação de Card Ativo:** Aplica contorno Royal Blue (`ring-royal-blue`) e superfície sutil no card ativo.
3. **Refinamento do Drawer:**
   - Remoção do botão `X` superior (evitando colisão visual com o badge de status RH no canto direito).
   - O fechamento do Drawer permanece garantido pelo botão `[Fechar]` no rodapé e pela tecla `ESC` (acessibilidade).
   - Ação de restrição atualizada para `[Resolver inconsistência]`, seguindo o padrão de despacho da Torre.
4. **Decisão sobre Impressão:**
   - Não implementada nesta fase. Registrado como: `BACKLOG — avaliar documento imprimível da operação` (romaneio / ficha operacional).

---

## 9. REFINAMENTOS DO HOTFIX FINAL 02.3 (FILTRO TEMPORAL HÍBRIDO ORBE)

1. **Correção de Largura & Eliminação de Truncamento:**
   - O seletor foi redimensionado com largura mínima confortável (`min-w-[165px]`), eliminando o truncamento de "Todo o...".
   - Rótulos exibidos integralmente: `Todo o Período`, `Hoje (03/10)`, `Outubro/2026`, `Setembro/2026`, `03/10/2026`, `01/10 – 15/10`.
2. **Padrão de Design System Híbrido (`UxLabFiltroTemporal`):**
   - Extraído como componente reutilizável em `src/components/ux-lab/UxLabFiltroTemporal.tsx`.
   - Combina **Atalhos Rápidos** + **Dia Específico (Calendário single)** + **Intervalo Personalizado (Calendário range)**.
   - Navegação interna no Popover permitindo alternar facilmente entre atalhos e seleção de datas via calendário sem fechar o menu.
3. **Integração Plena com o Pipeline Operacional:**
   - Funciona em conjunto com os filtros manuais de Empresa, Status Operacional, Status RH, Tipo de Serviço, busca rápida e cards interativos.
   - Clicar nos cards superiores respeita rigorosamente o universo temporal ativo.
   - Caso não haja ocorrência no período filtrado, exibe feedback discreto e não altera o filtro arbitrariamente.

---

## 10. TESTES AUTOMATIZADOS & HOMOLOGAÇÃO TÉCNICA

A suíte dedicada `src/test/ux_operacoes_volume_v2_proto1.test.tsx` e a suíte de navegação `src/test/ux_lab_navigation_e2e.test.tsx` foram executadas:

```bash
✓ src/test/ux_operacoes_volume_v2_proto1.test.tsx (17 tests)
✓ src/test/ux_lab_navigation_e2e.test.tsx (3 tests)

Test Files  2 passed (2)
Tests       20 passed (20)
TypeScript  tsc --noEmit (0 errors)
```

### Limitações Deliberadas desta Versão
1. **Formulário de Novo Lançamento V2:** Conforme briefing, o botão `+ Nova Operação` atua como CTA estrutural com toast informativo. O redesenho completo do formulário será abordado após a família especialista de campo.
2. **Integração Real com Supabase:** O protótipo utiliza mocks fiéis isolados no UX Lab, preservando 100% os contratos de produção.
3. **Impressão:** Adiamento deliberado para definição de romaneio/ficha formal.

---
🛑 *CHECKPOINT: UX05 — TELA PRINCIPAL OPERAÇÕES POR VOLUME V2 HOMOLOGADA E CONGELADA.*
