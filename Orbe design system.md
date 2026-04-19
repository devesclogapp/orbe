# 📄 ESC LOG ERP — DESIGN SYSTEM + LAYOUT (MVP)

---

## 🎯 DIREÇÃO GERAL

Criar um ERP moderno estilo SaaS com foco em clareza operacional, leitura de dados, eficiência e interface limpa e objetiva. Baseado em layout com **3 colunas (sidebar + conteúdo + painel direito)**, uso de **tabelas como elemento central** e design minimalista com alta legibilidade.

---

# 🎨 PALETA DE CORES

## Cores de Identidade (ESC LOG)

| Token | Hex | Uso |
|---|---|---|
| `--color-brand` | `#FD4C00` | CTA principal, ações primárias, destaques de marca |
| `--color-foreground` | `#171717` | Texto principal, títulos, headings |
| `--color-text-secondary` | `#4D4D4D` | Texto secundário, labels, descrições |
| `--color-border` | `#DEDEDE` | Bordas, divisores, separadores |
| `--color-surface` | `#FFFFFF` | Cards, modais, superfícies elevadas |

## Tons de Cinza (Interface)

| Token | Hex | Uso |
|---|---|---|
| `--color-bg` | `#F7F7F7` | Fundo geral da aplicação |
| `--color-bg-subtle` | `#F0F0F0` | Fundo de áreas sutis, hover de linhas |
| `--color-gray-100` | `#EBEBEB` | Fundo de header de tabela, badges neutros |
| `--color-gray-200` | `#DEDEDE` | Bordas padrão (alias de `--color-border`) |
| `--color-gray-300` | `#C4C4C4` | Bordas de inputs, separadores internos |
| `--color-gray-400` | `#A3A3A3` | Placeholders, ícones inativos |
| `--color-gray-500` | `#737373` | Texto de apoio, metadados |
| `--color-gray-600` | `#4D4D4D` | Texto secundário (alias de `--color-text-secondary`) |
| `--color-gray-900` | `#171717` | Texto principal (alias de `--color-foreground`) |

## Estados do Sistema

| Token | Hex | Uso |
|---|---|---|
| `--color-success` | `#22C55E` | Registros OK, confirmações |
| `--color-error` | `#EF4444` | Erros, inconsistências |
| `--color-warning` | `#F59E0B` | Atenção, alertas |
| `--color-info` | `#2563EB` | Interações, links, foco |

> **Regra de uso:** `#FD4C00` é exclusivo para CTAs e identidade de marca. Azul `#2563EB` é reservado para interações secundárias (foco, links, estado ativo de menu). Cinzas são a base da interface.

---

# 🔤 TIPOGRAFIA

## Fontes

| Função | Família | Importação |
|---|---|---|
| **Main Font** | `Manrope` | `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap')` |
| **Body Font** | `Inter` | `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap')` |

## Hierarquia Tipográfica

| Elemento | Fonte | Peso | Tamanho | Cor |
|---|---|---|---|---|
| Título de página (H1) | Manrope | `700` | `24px` | `#171717` |
| Título de seção (H2) | Manrope | `600` | `18px` | `#171717` |
| Subtítulo / Label de card | Manrope | `500` | `14px` | `#4D4D4D` |
| Texto padrão (body) | Inter | `400` | `14px` | `#171717` |
| Texto secundário | Inter | `400` | `13px` | `#4D4D4D` |
| Label de input / coluna | Inter | `500` | `12px` | `#4D4D4D` |
| Caption / metadado | Inter | `400` | `12px` | `#737373` |
| Valor grande (métrica) | Manrope | `700` | `28px` | `#171717` |

> **Regra:** Manrope para qualquer coisa que seja título, destaque ou número de métrica. Inter para todo o restante do conteúdo operacional.

---

# 🧱 ESTRUTURA GLOBAL (LAYOUT)

## Estrutura Principal — 3 Colunas

```
[ Sidebar 240px ] | [ Conteúdo flex ] | [ Painel Direito 320px ]
```

---

## 1. SIDEBAR (ESQUERDA)

- **Largura:** `240px` fixo
- **Fundo:** `#FFFFFF`
- **Borda direita:** `1px solid #DEDEDE`
- **Posição:** fixa

### Conteúdo
1. Logo ESC LOG (topo, padding `20px 16px`)
2. Usuário — avatar + nome + cargo (fundo `#F7F7F7`, border-radius `8px`)
3. Menu de navegação principal

### Menu de Navegação

- Dashboard
- Processamento de Ponto ⭐
- Colaboradores
- Empresas
- Coletores REP
- Importações
- Inconsistências
- Fechamento Mensal
- Relatórios
- Configurações

### Estados do Item de Menu

| Estado | Fundo | Texto | Detalhe |
|---|---|---|---|
| Normal | — | `#4D4D4D` | — |
| Hover | `#F0F0F0` | `#171717` | border-radius `6px` |
| Ativo | `#FFF1EC` | `#FD4C00` | borda esquerda `3px solid #FD4C00` |

---

## 2. TOPBAR

- **Altura:** `64px`
- **Fundo:** `#FFFFFF`
- **Borda inferior:** `1px solid #DEDEDE`
- **Conteúdo esquerda:** título da página (Manrope `600`, `18px`, `#171717`)
- **Conteúdo direita:** ícone de notificações + avatar do usuário

---

## 3. CONTEÚDO PRINCIPAL

- **Padding:** `24px`
- **Grid:** 12 colunas, gap `16px`
- **Fundo:** `#F7F7F7`

---

## 4. PAINEL LATERAL DIREITO

- **Largura:** `320px`
- **Posição:** sticky / fixa
- **Fundo:** `#FFFFFF`
- **Borda esquerda:** `1px solid #DEDEDE`
- **Padding:** `16px`

---

# 🧠 FUNÇÃO DO PAINEL DIREITO

Área contextual, dinâmica e acionável. Não compete com o conteúdo principal.

### Dashboard
- Status da última sincronização
- Alertas recentes
- Resumo rápido

### Painel de Ponto
- Colaborador selecionado
- Inconsistências detectadas
- Sugestão da IA
- Ações rápidas: **Corrigir** / **Aprovar**

### Inconsistências
- Detalhe do erro
- Motivo da inconsistência
- Sugestão automática de correção
- Botão: **"Corrigir agora"** (CTA laranja)

---

# 🧩 COMPONENTES

---

## Cards de Métricas

- **Fundo:** `#FFFFFF`
- **Border-radius:** `12px`
- **Padding:** `20px`
- **Borda:** `1px solid #DEDEDE`
- **Sombra:** `0 1px 3px rgba(0,0,0,0.06)`

### Estrutura interna
- Label: Inter `500`, `12px`, `#737373`, uppercase
- Valor: Manrope `700`, `28px`, `#171717`
- Variação positiva: `#22C55E` com seta ↑
- Variação negativa: `#EF4444` com seta ↓

---

## Tabela (Core do Sistema)

- **Fundo:** `#FFFFFF`
- **Border-radius:** `12px`
- **Borda:** `1px solid #DEDEDE`
- **Overflow:** hidden

### Header da tabela
- **Fundo:** `#EBEBEB`
- **Texto:** Inter `500`, `12px`, `#4D4D4D`, uppercase
- **Altura da linha:** `44px`
- **Padding horizontal:** `16px`

### Linhas de dados
- **Fundo padrão:** `#FFFFFF`
- **Hover:** `#F7F7F7`
- **Altura:** `52px`
- **Separador:** `1px solid #EBEBEB`
- **Texto:** Inter `400`, `14px`, `#171717`

### Colunas Padrão (ESC LOG)

| Coluna | Alinhamento |
|---|---|
| Colaborador | Esquerda |
| Data | Centro |
| Entrada | Centro |
| Saída | Centro |
| Horas | Centro |
| Extras | Centro |
| Status | Centro |
| Ação | Centro |

### Status Chips (badges)

| Status | Fundo | Texto | Borda |
|---|---|---|---|
| OK | `#DCFCE7` | `#15803D` | — |
| Inconsistência | `#FEE2E2` | `#B91C1C` | — |
| Ajustado | `#DBEAFE` | `#1D4ED8` | — |
| Pendente | `#FEF9C3` | `#A16207` | — |

Estilo base dos chips: `border-radius: 6px`, `padding: 2px 8px`, Inter `500`, `12px`.

### Linha com Inconsistência (highlight)

- **Fundo:** `#FFF5F3`
- **Borda esquerda:** `3px solid #FD4C00`
- **Texto de erro:** `#B91C1C`

---

## Botões

### Primário (CTA)
- **Fundo:** `#FD4C00`
- **Texto:** `#FFFFFF`, Manrope `600`, `14px`
- **Border-radius:** `8px`
- **Padding:** `10px 20px`
- **Hover:** `#E54300` (escurecido 8%)
- **Active:** `#CC3D00`

### Secundário
- **Fundo:** `#FFFFFF`
- **Texto:** `#171717`
- **Borda:** `1px solid #DEDEDE`
- **Hover:** fundo `#F0F0F0`

### Ghost / Destrutivo
- **Fundo:** transparente
- **Texto:** `#EF4444`
- **Hover:** fundo `#FEE2E2`

---

## Inputs

- **Altura:** `40px`
- **Fundo:** `#FFFFFF`
- **Borda:** `1px solid #C4C4C4`
- **Border-radius:** `8px`
- **Padding:** `0 12px`
- **Fonte:** Inter `400`, `14px`, `#171717`
- **Placeholder:** `#A3A3A3`

### Estado de Foco
- **Borda:** `2px solid #2563EB`
- **Sombra:** `0 0 0 3px rgba(37,99,235,0.12)`

### Estado de Erro
- **Borda:** `2px solid #EF4444`
- **Sombra:** `0 0 0 3px rgba(239,68,68,0.12)`

---

## Modais e Overlays

- **Overlay:** `rgba(23,23,23,0.5)` (usa `--color-foreground`)
- **Modal container:** `#FFFFFF`, border-radius `16px`, padding `24px`
- **Sombra:** `0 20px 60px rgba(0,0,0,0.15)`

---

# 📐 GRID E BREAKPOINTS

```
Sidebar fixo:       240px
Conteúdo:           flex (ocupa o restante)
Painel direito:     320px
Total mínimo:       1280px de largura recomendada
```

### Espaçamento (escala de 4px)

| Token | Valor | Uso |
|---|---|---|
| `--space-1` | `4px` | Micro espaçamento |
| `--space-2` | `8px` | Interno de badges, chips |
| `--space-3` | `12px` | Padding de célula |
| `--space-4` | `16px` | Padding padrão |
| `--space-5` | `20px` | Padding de card |
| `--space-6` | `24px` | Padding de seção |
| `--space-8` | `32px` | Gap entre seções |

---

# 🧠 REGRAS DE UX

- Foco em dados e leitura rápida
- Zero poluição visual
- Consistência de espaçamento em escala de 4px
- Contraste suave com uso predominante de cinzas
- Laranja `#FD4C00` reservado apenas para CTAs e identidade — nunca como cor decorativa
- Painel direito **não compete com o conteúdo principal** — apenas reforça o contexto
- Tipografia: Manrope para títulos e destaques, Inter para tudo operacional

---

# 🚫 NÃO INCLUIR (MVP)

- ❌ Gráficos complexos
- ❌ Animações pesadas
- ❌ Dashboards decorativos
- ❌ Dark mode
- ❌ Personalização de tema
- ❌ Múltiplos estilos misturados
- ❌ Excesso de cores fora da paleta definida
- ❌ Widgets irrelevantes para o fluxo operacional

---

# 🎯 DIRETRIZ FINAL

Criar interface de ERP moderno com layout de 3 colunas (sidebar + conteúdo + painel direito), foco em tabelas e dados operacionais, visual clean com base em tons de cinza (`#F7F7F7` a `#171717`), laranja `#FD4C00` como CTA principal, azul `#2563EB` como cor de interação e feedback, Manrope como fonte de identidade e Inter como fonte operacional. A interface deve transmitir **controle, clareza e confiabilidade operacional**.
