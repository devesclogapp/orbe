# 📊 Plano de Correções - Central de Relatórios (Orbe ERP)

Após uma análise profunda da interface de **Central de Relatórios** (`RelatoriosHub.tsx`) e da sua visualização detalhada (`RelatorioDetalhe.tsx`), foram encontradas diversas quebras de experiência do usuário (UX), erros arquiteturais, dados _hardcoded_ simulando funcionamento de backend e vulnerabilidades que comprometem a confiabilidade da plataforma.

Abaixo está o mapeamento detalhado dos problemas listados e o plano de ação sugerido para cada um.

---

## 1. Mapeamento de Incoerências e Erros

### 🔍 Central de Relatórios (`/relatorios` - `RelatoriosHub.tsx`)

1. **Estado de Busca vs Filtro de Categoria**: Ao clicar num filtro de Categoria (ex: "Operacional") no menu lateral, em vez de aplicar um filtro ativo coerente, o sistema escreve o texto "Operacional" no campo de busca (`search input`). Isso confunde o usuário e não permite combinar categorias com buscas em texto.
2. **Ações "Fantasmas" e Hardcoded**: O botão "Play" presente no card apenas aciona um `toast.success` estático sem gerar nada real. A etiqueta _"Última geração: Hoje"_ é totalmente hardcoded no JSX.
3. **Tratamento de Estado Vazio (Empty State)**: Se não houver relatórios na API, a tela exibe "_Nenhum relatório encontrado para ""_" porque avalia o valor vazio do *input* antes de considerar que o banco de dados simplesmente pode estar vazio.
4. **Desleixo no Layout Base**: Múltiplos botões de configurações secundárias agrupados e tomando primeira visão, enquanto dashboards/relatórios chaves ficam perdidos em um mar de cards homogêneos.
5. **Componentes Importados e Não Utilizados**: Vários ícones e o `DropdownMenu` foram importados, mas nunca utilizados no arquivo, gerando um código sujo (_dead code_).

### 📄 Detalhamento e Tela do Relatório (`id` - `RelatorioDetalhe.tsx`)

1. **Acoplamento Frágil e Perigos (Antipattern de Código)**: A lógica que busca os dados para exibir nas tabelas está condicionada com `if (report.nome === "Log de Auditoria")`. Se qualquer gestor alterar o banco de dados ou renomear o relatório, o código *silenciosamente falhará* e não retornará mais os dados, gerando suporte desnecessário.
2. **Exportação Enganosa (Fake Excel)**: O botão vermelho de destaque na tela detalha a ação de **"Exportar EXCEL"**, mas a rotina por trás converte um modelo simplista em texto bruto, salvando um `.csv` e entregando uma experiência pobre ao invés de um `.xlsx` nativo.
3. **Deadlock Visual em Erro na API**: Ao tentar acessar um relatório, se a requisição falhar (`catalogError`), a variável que armazena os dados fica nula (`!report`). O frontend foi programado para varrer como loading: `if (loadingCatalog || !report) return (Loading)`. Conclusão: O usuário fica preso na tela de `Carregando...` para sempre.
4. **Filtro de Datas e UI Desalinhadas**: As caixas de seleção de Mês e Ano dentro do Popover usam a tag `<select>` HTML bruta e antiga, o que destoa totalmente de outros módulos do ERP Orbe (que utiliza o *Design System* padrão como Radix UI/Shadcn).
5. **Falha de Consolidado (Riscos de NaN e Cálculos Falsos)**: Nos cards de Snapshot Financeiro, ele processa a função reduzida: `(Number(curr.quantidade) * Number(curr.valor_unitario))`. Isso sem sanitizar previamente e validar _fallbacks_ consistentes e falhando ao misturar diferentes tipos de dataset operacionais.

---

## 2. Plano de Correções Padrão

Para estabilizar (como definido nas diretrizes *ProjectStabilizerSkill*) as operações visuais do controle de relatórios, devemos seguir as diretrizes abaixo:

### Fase 1: Arquitetura Frontend (`RelatoriosHub.tsx`)
- [ ] **Desacoplar Filtros:** Criar um estado `categoryFilter` (`useState<string | null>(null)`) separado da barra de busca de texto.
- [ ] **Limpar Falsos Gatilhos:** O botão de "Play" deve ter um link de navegação para a geração em tempo real daquele relatório (`navigate`) ou pelo menos emitir a query necessária ao backend e baixar o dado.
- [ ] **Realidade dos Indicadores Ocultos:** Remover o texto hardcoded _"Última geração: Hoje"_ até que um dado auditado em banco substitua-o ou criar o mecanismo da última data no `report.service.ts`.
- [ ] **Limpeza de UI (Empty States):** Reformular para mostrar "Nenhum resultado para a sua pesquisa" condicionado, e "Não existem relatórios para a empresa / perfil logado" com fallback limpo de UI.

### Fase 2: Correção Crítica dos Relatórios Diários (`RelatorioDetalhe.tsx`)
- [ ] **Blindar Código de Resposta DB:** Trocar os condicionais `if (report.nome === '...')` por `if (report.slug === 'log-auditoria')` para que a tela não quebre se o nome display (`nome`) for alterado administrativamente no banco (Supabase).
- [ ] **Corrigir Exportação de Fatos Excel:** Modifique o rótulo do botão de EXCEL para **CSV**, ou traga de fato a lib `xlsx` e exporte um blob XLSX nativo; a congruência com as expectativas do cliente e UX é primordial.
- [ ] **Resolver Deadlocks Visual de Loading:** Adicionar a condição de saída clara: `if (catalogError || (!loadingCatalog && !report)) return (Tela de Erro Bonita)`.
- [ ] **Sanitização de Cálculos:** Garantir que todos os somatórios no `<Métrica ... />` processem em `try/catch` e tragam zeros formatados ao invés de cálculos diretos sem formatação `pt-BR` ou erro em cascata `NaN`.
- [ ] **Uniformizar Inputs:** Trocar todos os `<select>` puros no filtro de Competência pelo componente Select e Popover do *Orbe UI* com estado reativo correto.

---

### Conclusão e Recomendação

O atual status da tela está em nível: **⚠️ Parcial/Instável**. Ela precisa sofrer essas adequações estruturais citadas acima a critério de que o faturamento que extraímos dependem puramente desses relatórios para demonstrar credibilidade nas empresas operadas e no ERP como um todo.

Aplicar imediatamente a Fase 2 (Detalhamento) para evitar erros silenciosos, e repaginar o `RelatoriosHub.tsx` logo em seguida, conforme as diretrizes do sistema design atual.
