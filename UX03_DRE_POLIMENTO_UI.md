# UX03 — AUDITORIA DE POLIMENTO UX/UI | LIMPEZA DO LEGADO LARANJA, REDUNDÂNCIAS E FRICÇÕES
**Projeto:** ERP ESC LOG (ORBE)  
**Domínio:** Resultado Operacional (DRE) V2 — UX Lab (`/ux-lab/dre`)  
**Fase:** FASE 02.3 — Polimento UX/UI e Limpeza de Resíduos  
**Data:** Outubro / 2026  
**Status:** Auditado e Corrigido  

---

## 1. OBJETIVO DO POLIMENTO

Eliminar resíduos do design anterior (em especial o legado da cor laranja e tokens de `--primary` do tema claro), erradicar controles redundantes de expansão/drill-down, harmonizar a hierarquia de ações com a linguagem institucional **Azul ORBE** e refinar textos contextuais para precisão semântica.

---

## 2. MATRIZ DE AUDITORIA E DECISÕES DE POLIMENTO

| Elemento | Problema Encontrado | Tipo | Decisão | Arquivo Alterado |
| :--- | :--- | :---: | :--- | :--- |
| **Botão "Fechar" no rodapé do Drawer** | Renderizava como botão sólido laranja brilhante no tema claro devido ao uso de `variant="default"` (que herda `--primary: 18 100% 50%`). Além disso, duplicava o `X` de fechar já presente no cabeçalho do `Sheet`. | **LEGADO CROMÁTICO** / **REDUNDÂNCIA** | Remover o botão duplicado do rodapé. O fechamento é garantido com excelência pelo `X` do cabeçalho, tecla `ESC` e clique no backdrop. O rodapé passa a ser uma barra de contexto limpa com instrução acessível (*"Pressione ESC para fechar"*). | `src/components/ux-lab/UxLabDREDrawer.tsx` |
| **Destaque de competência no Drawer** | O cabeçalho continha `text-primary`, fazendo com que `Outubro / 2026` ficasse laranja no tema claro. | **LEGADO CROMÁTICO** / **CONSISTÊNCIA** | Substituir `text-primary` por neutro estrutural (`text-muted-foreground font-semibold`). Contexto e breadcrumb não competem visualmente com o conteúdo principal. | `src/components/ux-lab/UxLabDREDrawer.tsx` |
| **Controles de Expansão no Demonstrativo** | Existiam 3 formas conflitantes para a mesma intenção: 1) linha inteira clicável, 2) chevron de expansão inline, 3) botão quadrado adicional com ícone `Maximize2` e hover laranja (`hover:text-primary`). Isso criava uma tabela aninhada duplicada antes do Drawer. | **REDUNDÂNCIA** / **FRICÇÃO** / **LEGADO CROMÁTICO** | Aplicar o princípio: *"Uma intenção → um affordance principal claro"*. A linha inteira agora é o card interativo de drill-down com hover e focus neutros/Azul ORBE, sinalizada por um `ChevronRight` discreto à direita. O botão quadrado redundante e a tabela aninhada intermediária foram eliminados. | `src/pages/UxLab/UxLabDRE.tsx` |
| **Texto de Descrição no Drawer de Receita** | O subtítulo do Drawer exibia texto genérico: *"Visão expandida completa da formação de custos e subcontas associadas"*, o que era semanticamente falso para o grupo de Receita Operacional. | **SEMÂNTICA** | Criar descrição contextual dinâmica por tipo de item. Para Receita: *"Composição analítica das receitas operacionais reconhecidas na competência."* Para Folha CLT: *"Composição dos lotes financeiros de remuneração CLT reconhecidos na competência."* | `src/components/ux-lab/UxLabDREDrawer.tsx` |
| **Identificação de Simulação no Drawer de Receita** | As subcontas de receita (Faturamento Mensal, Duplicatas, Caixa Imediato) são hipóteses de layout ainda não comprovadas pela auditoria de backend. | **CONSISTÊNCIA** / **SEMÂNTICA** | Adicionar etiqueta discreta `Simulação UX Lab` na tabela do Drawer quando exibida a decomposição de receita, garantindo que o gestor nunca confunda protótipo com estrutura contábil homologada. | `src/components/ux-lab/UxLabDREDrawer.tsx` |
| **Affordance de Aritmética vs Expansão (+ / −)** | Os badges redondos exibem `+` e `−` como sinais aritméticos da DRE (Receita somada, Custos deduzidos), mas podiam ser interpretados erroneamente como botões de sanfona (accordion). | **SEMÂNTICA** / **ACESSIBILIDADE** | Preservar os badges como identificadores aritméticos estáticos e transferir todo o affordance de navegação/drill-down para a extremidade direita da linha via `ChevronRight` e estados de foco explícitos (`focus-visible:ring-1 focus-visible:ring-blue-500`). | `src/pages/UxLab/UxLabDRE.tsx` |
| **Hierarquia de Botões (Design System)** | Evitar a proliferação de botões com superfícies de destaque arbitrário. | **CONSISTÊNCIA** | Formalizar regra: Azul Royal exclusivamente para ações primárias inequívocas; neutros/outline para ações secundárias; ghost para terciárias; vermelho apenas para destrutivas. Laranja banido de todas as ações. | Global UX Lab |

---

## 3. VALIDAÇÃO CROMÁTICA: LIGHT E DARK MODE

- **Light Mode:**
  - Resíduos de `--primary` (laranja HSL 18) eliminados do Drawer e das linhas do Demonstrativo.
  - O rodapé do Drawer agora utiliza superfície neutra (`bg-muted/20 border-border/80 text-muted-foreground`).
  - As linhas interativas utilizam hover sutil (`hover:bg-muted/40`).
- **Dark Mode:**
  - Superfícies profundas `#0D1014` e `#151921` com bordas sutis `white/[0.04]`.
  - Chevron e rótulos com transição para Azul Royal suave (`dark:group-hover:text-blue-400`).
  - Sem discrepâncias cromáticas entre os temas.

---

## 4. IMPACTO ARQUITETURAL E DE DEPENDÊNCIAS

- Nenhuma alteração no backend, banco de dados ou RPCs.
- Rota oficial `/financeiro/dre` mantida 100% intacta.
- Código limpo, eliminando estados e nós JSX redundantes em `UxLabDRE.tsx`.
