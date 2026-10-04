# ORBE DESIGN SYSTEM (DS-01) — ESPECIFICAÇÃO TÉCNICA E CANÔNICA

> **Status:** CONGELADO / HOMOLOGADO (DS-01)  
> **Filosofia Central:** *"Neutro por padrão. Cor por significado."*  
> **Identidade Institucional:** ROYAL BLUE (`#2563EB`) + NEUTROS ESTRUTURAIS  
> **Base Dark:** Dark V4 (Luminância Pura, sem neon / glow)  
> **Workspace Global:** `1560px` (`--orbe-workspace-max`)  

---

## 1. PRINCÍPIOS FUNDAMENTAIS DE ARQUITETURA VISUAL

1. **Nenhuma tela define sua própria linguagem visual:** As telas do ORBE ERP consomem estritamente os componentes e tokens do Design System transversal.
2. **Superfícies e Tipografia antes de Bordas:** A hierarquia visual é construída pela profundidade de superfícies e escala tipográfica, eliminando a poluição visual de "grades e planilhas".
3. **Monocromático Institucional para Categorias:** Categorias, tipos e rótulos contextuais devem utilizar azul institucional ou neutros. É expressamente proibido colorir elementos apenas para diferenciação estética.
4. **Semântico Estrito para Estados:** Verde, Âmbar e Vermelho/Rose possuem significado operacional unívoco (Sucesso, Atenção, Bloqueio).
5. **Dark Mode por Luminância:** O modo escuro utiliza a base `#0B0D10` com elevação luminosa de superfícies (`#111419` → `#15191F` → `#1A1F27`) e o Royal Blue como luz funcional.

---

## 2. MATRIZ TRANSVERSAL DE TOKENS

| TOKEN | LIGHT | DARK V4 | USO RECOMENDADO | NÃO USAR PARA |
|---|---|---|---|---|
| `--orbe-workspace-max` | `1560px` | `1560px` | Largura máxima transversal de todas as telas | Larguras arbitrárias por tela (`max-w-7xl`, etc.) |
| `--orbe-page-padding-x` | `1.5rem` (`24px`) | `1.5rem` (`24px`) | Padding horizontal padrão da viewport (`p-4 md:p-6`) | Paddings locais desalinhados |
| `--orbe-section-gap` | `1.5rem` (`24px`) | `1.5rem` (`24px`) | Separação entre seções analíticas (`space-y-6`) | Espaçamentos verticais aleatórios |
| `canvas` | `#F8FAFC` | `#0B0D10` | Fundo principal da aplicação (Background) | Superfície de cards |
| `sidebar` / `topbar` | `#FFFFFF` | `#0D1014` | Navegação global e cabeçalho de controle | Fundo de tabelas |
| `surface` (Nível 1) | `#FFFFFF` | `#111419` | Containers de seções, trilhas e fundos de tabelas | Botões interativos |
| `card` (Nível 2) | `#FFFFFF` | `#15191F` | Cards padrão, blocos analíticos e métricas | Fundo global da tela |
| `elevated` / `hover` (Nível 3) | `#F1F5F9` | `#1A1F27` | Hover de linhas, modais, drawers e popovers | Fundo estático de página |
| `border-subtle` | `#F1F5F9` | `rgba(255,255,255,0.04)` | Divisores internos muito discretos | Contorno externo de destaque |
| `border-default` | `#E2E8F0` | `rgba(255,255,255,0.06)` | Bordas estruturais de cards e tabelas | Efeito neon / luminoso |
| `border-strong` | `#CBD5E1` | `rgba(255,255,255,0.12)` | Bordas de inputs em hover e cards ativos | Bordas decorativas |
| `text-primary` | `#0F172A` | `#F1F3F5` | Títulos H1/H2, métricas dominantes, valores fortes | Metadados e rodapés |
| `text-secondary` | `#475569` | `#A0A7B2` | Textos correntes, descrições, rótulos de colunas | Textos secundários ilegíveis |
| `text-tertiary` | `#94A3B8` | `#69717D` | Metadados, timestamps, hashes e legendas | Textos primários |
| `primary` (Royal Blue) | `#2563EB` | `#2563EB` | CTA Principal, seleção, foco, identidade ORBE | Cor semântica de erro ou sucesso |
| `primary-soft` | `#DBEAFE` | `rgba(37,99,235,0.14)` | Fundo de itens selecionados e tags institucionais | Fundo de cards inteiros |
| `success` | `#10B981` / `#059669` | `#34D399` / `#059669` | Concluído, Pago, Regular, Conciliado | Elementos decorativos |
| `warning` | `#F59E0B` / `#D97706` | `#FBBF24` / `#D97706` | Pendência RH, Atenção, Aguardando Validação | Identidade visual institucional |
| `danger` | `#E11D48` / `#BE123C` | `#FB7185` / `#BE123C` | Bloqueio, Em Restrição, Devolvido, Inconsistência | Botões de ação comum |

---

## 3. ESCALAS DO DESIGN SYSTEM

### 3.1 Escala de Border Radius
- `radius-xs` (`4px`): Micro-elementos técnicos, células de heatmap, tags compactas.
- `radius-sm` (`6px`): Badges institucionais, chips de filtro.
- `radius-md` (`8px`): Inputs, selects, botões e sub-cards internos.
- `radius-lg` (`12px`): Cards principais, blocos analíticos, tabelas densas, containers.
- `radius-xl` (`16px`): Superfícies de grande porte e modais destacados.
- `radius-full` (`9999px`): Status pills com dot indicador, avatares, toggles.

### 3.2 Escala de Espaçamento (Base 4px)
- `4px` (`space-1`): Micro-gaps entre ícone e texto.
- `8px` (`space-2`): Padding de badges, gap entre botões.
- `12px` (`space-3`): Gap entre filtros, padding de cards compactos.
- `16px` (`space-4`): Padding padrão de cards e células de tabela.
- `20px` (`space-5`): Padding de cabeçalhos de seção e drawers.
- `24px` (`space-6`): Gaps entre seções (`section-gap`) e padding de página (`page-padding`).
- `32px` (`space-8`): Separação de grandes blocos contextuais.

### 3.3 Escala de Sombras
- `shadow-none`: Superfícies planas integradas.
- `shadow-2xs`: Cards compactos e inputs.
- `shadow-xs`: Cards analíticos padrão e botões primários.
- `shadow-sm`: Cards elevados ou em hover.
- `shadow-md`: Popovers, dropdowns e menus de contexto.
- `shadow-overlay`: Drawers e modais com backdrop blur.

---

## 4. COMPONENTES PRIMITIVOS TRANSVERSAIS

Todos os componentes oficiais estão disponíveis em `@/components/ux-lab/design-system`:

1. `<OrbePageContainer />`: Container oficial que impõe a largura de 1560px e espaçamentos padrão.
2. `<OrbePageHeader />`: Cabeçalho de página padronizado com H1, badge de versão e ações contextuais.
3. `<OrbeSection />`: Seção analítica estruturada com título H2, descrição, badge e ações.
4. `<OrbeCard />`: Card com variantes `surface`, `kpi`, `analytical`, `compact`, `interactive`, `document`.
5. `<OrbeKpiCard />`: Card de métrica dominante (valor em fonte monospace, sub-rótulo, status dot).
6. `<OrbeButton />`: Botões padronizados nas variantes `primary`, `secondary`, `ghost`, `destructive` e tamanhos `sm`, `md`, `lg`.
7. `<OrbeBadge />`: Badge institucional monocromático (Royal Blue ou Neutro).
8. `<OrbeStatusBadge />`: Badge semântico com dot indicador e cores estritas de estado.
9. `<OrbeInput />`, `<OrbeSearchInput />`, `<OrbeSelect />`: Controles de formulário de alta densidade.
10. `<OrbeFilterBar />`: Barra transversal de filtros com contador de filtros ativos e reset rápido.
11. `<OrbeTable />`: Tabela densa ERP com cabeçalho fixo, suporte a alinhamentos técnicos, estado de seleção e paginação.
12. `<OrbeDrawer />`: Shell de gaveta especialista de 4 fases (Diagnóstico, Pipeline, Contexto, Despacho).
13. `<OrbeDocumentHeader />`: Cabeçalho formal para relatórios analíticos (padrão R01).
14. `<OrbeControleDocumental />`: Rodapé de rastreabilidade e assinatura digital de documentos (padrão R01).

---

## 5. REGRAS DE GOVERNANÇA PARA NOVAS TELAS

Ao desenvolver novas telas ou relatórios (R02, R03, R04, R05, R07), **é estritamente proibido:**

- ❌ Declarar `max-w-[...]` arbitrário na raiz da página. Consumir `<OrbePageContainer />`.
- ❌ Utilizar botões com cores fora da paleta (ex: laranja ou roxo).
- ❌ Criar cards aninhados sem necessidade (máximo 1 nível interno).
- ❌ Utilizar cores semânticas (verde, vermelho, âmbar) sem correspondência com estado real.
- ❌ Criar estilos de tabela ou paginação próprios por tela.
- ❌ Aplicar `cursor-pointer` em cards meramente informativos.

---

## 6. SHOWCASE VISUAL

A referência visual ao vivo de todos os tokens e componentes está disponível na rota:
**`/ux-lab/design-system`**
