# Avaliação de Refatoração do ERP Orbe

Este documento contém a classificação estrutural dos módulos auditados e as diretrizes recomendadas de refatoração para garantir maior manutenção, velocidade e segurança ao ecossistema do ERP Orbe.

---

## 🟢 Sem Refatoração
**Componentes funcionais, seguros e bem resolvidos estruturalmente.**

* `src/contexts/AuthContext.tsx`
* `src/contexts/TenantContext.tsx`
* `Edge Functions Supabase` (ex: `process-day`, `importar-pontos-manual`)
* Rota de `RetornoBancario` / `CNAB240BBWriter`

---

## 🟡 Refatoração Leve
**Componentes que demandam ajustes pontuais (nomes, organizações visuais ou pequenas duplicações).**

### 1. Contextos Auxiliares e UI
* **Arquivo:** `src/contexts/SelectionContext.tsx` e `src/hooks/use-toast.ts`
* **Problema:** Fragmentação ou código legado visual.
* **Risco:** Baixo.
* **Impacto:** Melhoria de developer experience (DX).
* **Prioridade:** Baixa.
* **Plano Seguro:** Manter interface e consolidar num `UIProvider`.

---

## 🟠 Refatoração Média
**Componentes com hooks redundantes, queries duplicadas ou services com responsabilidade inflada.**

### 1. Pipeline Operacional e Dashboard Service
* **Arquivo:** `src/contexts/OperationalPipelineContext.tsx` e `src/services/dashboard.service.ts`
* **Problema:** Contexto excessivamente grande (43KB). O estado carrega informações de 4 abas e 5 tipos de visualizações distintas.
* **Risco:** Médio (pode engatilhar renderizações desnecessárias em telas distintas).
* **Impacto:** Alta melhora em lentidão do React na aba `PipelineOperacional`.
* **Prioridade:** Média/Alta.
* **Plano Seguro:** Quebrar o contexto em Sub-Providers (ex: `PipelineFiltersContext`, `PipelineKpisContext`). Assegurar que os testes paralelos funcionem sem delay.

### 2. Painel de Diaristas (Visão RH)
* **Arquivo:** `src/pages/Rh/RhDiaristasPainel.tsx`
* **Problema:** Lógica de RH para aprovações inflada no mesmo arquivo de tabela e modals.
* **Risco:** Médio. 
* **Impacto:** Melhoria de manutenção caso regras de Diaristas mudem.
* **Prioridade:** Média.
* **Plano Seguro:** Extrair a tabela para `RhDiaristasTableBlock.tsx` (semelhante ao módulo de operações) e refinar `useQuery` bindings no container.

---

## 🔴 Refatoração Crítica
**Componentes e serviços com regras de negócio altamente acopladas, lógicas misturadas, sobrecarga estrutural e alto risco nas instabilidades reportadas.**

### 1. O Monolito de Serviços (Base Service)
* **Arquivo:** `src/services/base.service.ts` (5000+ linhas)
* **Problema:** O arquivo concentra mais de 30 classes de manipulação do banco (CRUD). Acoplamento extremo onde Operações, Diaristas, Resultados, Configurações e Logs residem no mesmo namespace. O fallback e mapeamento condicional de colunas (ex: método de pagamento salvando Label original das planilhas) tem provocado as invisibilidades de itens no dashboard.
* **Risco:** Muito Alto (qualquer esbarrão ou Find & Replace compromete APIs inteiras).
* **Impacto:** Extremamente vital para a estabilidade e previsibilidade de retornos.
* **Prioridade:** Altíssima.
* **Plano Seguro:** Dividir as 30+ classes em arquivos separados sob a pasta `src/services/domain/` (Ex: `/domain/custosExtras.service.ts`, `/domain/diaristas.service.ts`). Cada arquivo focaria atômica e inteiramente em seu próprio payload.

### 2. O Lançamento Central de Produção (Encarregado)
* **Arquivo:** `src/pages/Producao/LancamentoProducao.tsx` (143KB+)
* **Problema:** Maior interface de input de campo (Encarregado mobile). Concentra a view inteira, a obtenção dos labels legados contra labels novos de forma procedural e os inserts, engolindo lógicas de frete e NF em React States em vez de Stores ou Form Contexts controlados.
* **Risco:** Alto.
* **Impacto:** Crucial para os 400 Bad Request reportados e overrides de dados.
* **Prioridade:** Altíssima.
* **Plano Seguro:** Adotar `react-hook-form` com `zod` estrito. Quebrar o formulário em subcomponentes por passos (Wizard Form) validando que os UUIDs atracam precisamente aos selects da view antes do Insert mutacional.

### 3. A Central de Cadastros (Admin/Gestor)
* **Arquivo:** `src/pages/CentralCadastros.tsx` (275KB+)
* **Problema:** Concentra edição, listagem e requisições para colaboradores, transportadoras, unidades, taxas e impostos tudo num único arquivo TSX monumental de 275KB.
* **Risco:** Alto (componente massivo no bundle frontend + memory heap overload aos dev tools).
* **Impacto:** Performance de carregamento.
* **Prioridade:** Alta.
* **Plano Seguro:** Utilizar a tag de React Router `<Outlet>` e dividir a central em subpastas em `/pages/Cadastros/` (Colaboradores.tsx, Transportadoras.tsx, etc.).
