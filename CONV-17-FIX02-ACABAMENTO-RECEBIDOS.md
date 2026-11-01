# ERP ORBE — CONV-17 / FIX 02
## Relatório de Acabamento Visual — Intermitentes Recebidos

**Projeto:** ERP ESC Logística 2026  
**Módulo:** Pessoas & RH → Intermitentes  
**Tela:** `/operacional/intermitentes` (`src/pages/Operacional/IntermitentesRecebidos.tsx`)  
**Data:** 09/10/2026  
**Status:** ✅ IMPLEMENTADO & VALIDADO (TESTES 100% VERDES / TSC 0 ERROS) — AGUARDANDO HOMOLOGAÇÃO VISUAL

---

## 1. RESUMO EXECUTIVO DO FIX 02

O presente FIX 02 atendeu pontualmente a todas as demandas de acabamento e polimento visual levantadas na validação da ETAPA 03:
1. **Refinamento do Card "Horas Extras & Noturna":** O título foi mantido com precisão semântica. O valor principal foi ajustado para demonstrar a soma real das horas extras (`totalHorasExtras` = `he_50 + he_100` em formato `HH:MM`), eliminando o equívoco anterior em que apenas as horas de 50% ficavam em destaque. O subtítulo discrimina com clareza matemática e visual: `50%: ${he50} • 100%: ${he100} • Noturna: ${horaNoturna}`.
2. **Ritmo Visual da Fita Secundária:** Reestruturada sob o rótulo `"Detalhamento da Jornada:"`, agora organizada com chips semânticos e marcadores coloridos (`Normais` em azul, `HE 50%` em âmbar, `HE 100%` em laranja e `Noturna` em violeta), preservando 100% dos dados remuneratórios e adicionando totalizadores operacionais limpos à direita.
3. **Tabela Operacional (`IntermitentesTableBlock.tsx`):**
   - Tooltip dinâmico para cargos truncados (`TooltipProvider`, `TooltipTrigger`, `TooltipContent`), garantindo leitura sem deformar a largura das colunas.
   - Tooltip descritivo e acessível para o botão de ação de edição: `"Corrigir horas ou atribuir empresa a este colaborador"`.
4. **Diagnóstico do Campo Empresa (`Operacional,Castanhal`):** Rastreamento completo da causa raiz no pipeline de ingestão e banco de dados, sem alteração de cadastros ou importadores nesta etapa.
5. **Paginação Avançada:** Homologada com seletores de 15, 25, 50 e 100 registros, contagem precisa, navegação protegida e reset automático de página ao filtrar/buscar.

---

## 2. REFINAMENTO DOS INDICADORES E DETALHAMENTO

### 2.1 Card "Horas Extras & Noturna"
* **Problema anterior:** O valor de exibição do card trazia `${kpis.he50} (50%)`, ocultando as horas de 100% do valor principal e gerando a percepção incorreta de que apenas o adicional de 50% havia sido apurado.
* **Solução implementada:**
  - **Valor Principal:** Calculado via `decimalParaHora(sumHours("he_50") + sumHours("he_100"))`. Exibe o montante consolidado de horas extraordinárias apuradas no período em formato canônico `HH:MM`.
  - **Subtítulo:** Apresenta detalhadamente a discriminação `50%: ${kpis.he50} • 100%: ${kpis.he100} • Noturna: ${kpis.horaNoturna}`.
  - **Badge Semântico:** Destaca a existência de jornada noturna (`Noturna: ${kpis.horaNoturna}`) em variante `info` quando presente.
  - **Zero perda de informação:** Todos os fatores remuneratórios foram mantidos íntegros.

### 2.2 Fita Secundária Contextual
* **Estrutura Visual:**
  - Título padronizado: `Detalhamento da Jornada:`
  - Pílulas com micro-indicadores em cores do Design System:
    - 🔵 **Normais:** Fundo sutil, indicador azul (`bg-blue-500`), valor em destaque.
    - 🟡 **HE 50%:** Fundo âmbar (`bg-amber-500/10`), indicador âmbar, valor em negrito.
    - 🟠 **HE 100%:** Fundo laranja (`bg-orange-500/10`), indicador laranja, valor em negrito.
    - 🟣 **Noturna:** Fundo violeta (`bg-violet-500/10`), indicador violeta, valor em negrito.
  - Bloco à direita com divisores discretos:
    - `Total Apontamentos: ${kpis.totalRegistros}`
    - `Pendentes de Fechamento: ${kpis.pendentesEnvio}`

---

## 3. ACABAMENTO NA TABELA OPERACIONAL

### 3.1 Tooltip para Cargos Truncados
* A coluna `CARGO` possui largura controlada (`min-w-[110px] max-w-[140px]`) para não quebrar a densidade da tabela em telas menores.
* Textos extensos (ex: *"OPERADOR DE EMPILHADEIRA RETRÁTIL ELÉTRICA"*) recebem corte elíptico suave (`truncate`).
* Ao passar o mouse, o componente `TooltipContent` (Radix UI) exibe o nome integral do cargo com fundo escurecido e tipografia nítida.

### 3.2 Tooltip Descritivo na Ação de Edição
* O botão de edição (ícone `Pencil`) agora possui:
  - `TooltipContent`: `"Corrigir horas ou atribuir empresa a este colaborador"`.
  - Atributos de acessibilidade `title` e `aria-label` idênticos, garantindo compatibilidade e navegação por teclado / leitores de tela.

---

## 4. DIAGNÓSTICO DO CAMPO EMPRESA (`Operacional,Castanhal`)

### 4.1 Rastreamento da Causa Raiz
Ao auditar a base de dados e os serviços de importação, foi constatado o seguinte:

1. **Origem do Dado:** O relatório ou webhook recebido do **Tio Digital / RHID** possui uma coluna chamada `departamento` ou `unidade`.
2. **Formatação no Payload Externo:** O sistema de ponto original envia cadeias concatenadas por vírgula para identificar a lotação operacional, como:
   - `"Operacional,Castanhal"`
   - `"Castanhal,Operacional"`
   - `"Castanhal"`
   - `"Operacional,Benevides"`
3. **Mecanismo de Resolução Automática:**
   - Durante as migrações e rotinas de pré-cadastro (`preCadastroColaborador.service.ts` e `EmpresaResolver.ts`), o método `resolveOrCreate(departamento)` busca uma empresa pelo nome exato.
   - Como nenhuma empresa do cadastro oficial chamava-se `"Operacional,Castanhal"`, o resolvedor provisionou automaticamente registros na tabela `empresas` com `cadastro_provisorio: true` e `origem: "ponto"`:
     - `ID: 2d67a910-c329-45df-8330-e8bce09a8ee4` → Nome: `"Operacional,Castanhal"`
     - `ID: 32e359fc-743a-4fdf-a5c9-dc3be5f7d482` → Nome: `"Castanhal,Operacional"`
4. **Exibição no Frontend:**
   - `IntermitentesTableBlock.tsx` renderiza `{item.empresas?.nome || item.departamento || "—"}`.
   - Uma vez que o apontamento foi vinculado a essa empresa provisória (ou manteve o campo `departamento` preenchido dessa forma), o valor exibido reflete diretamente o nome cadastrado.

### 4.2 Diretriz de Preservação & Proposta de Saneamento
* **Ação nesta etapa:** Nenhuma alteração foi realizada em cadastros, importadores ou registros do banco de dados (estrita observância da diretriz: *"Não modificar registros, importadores ou cadastros nesta etapa"*).
* **Proposta para etapa futura de saneamento de dados (Workflows de Homologação / Saneamento Cadastral):**
  1. No importador/parser, criar regra de normalização de lotação: se o departamento contiver vírgula (ex: `"Operacional,Castanhal"`), separar o departamento funcional (`"Operacional"`) da unidade/empresa de destino (`"Castanhal"`).
  2. Executar script de migração/desduplicação para reatribuir os apontamentos e colaboradores vinculados a `"Operacional,Castanhal"` para a empresa oficial correspondente (ex: `"ESC Castanhal"` ou `"Unidade Castanhal"`), desativando as empresas provisórias criadas por ruído.

---

## 5. AUDITORIA DA PAGINAÇÃO

A paginação do `IntermitentesTableBlock.tsx` foi verificada nos seguintes critérios:

| Critério | Comportamento Verificado | Status |
| :--- | :--- | :---: |
| **Opções de Tamanho** | Suporta alternância fluida entre `15`, `25`, `50` e `100` registros via `<select>` compacto | ✅ Aprovado |
| **Contagem Precisa** | Texto *"Mostrando X a Y de Z registros"* calcula índices corretos baseados na página atual e total | ✅ Aprovado |
| **Navegação** | Botões `<` e `>` habilitados apenas quando há páginas anterior/próxima disponíveis (`1 / N`) | ✅ Aprovado |
| **Preservação de Filtros** | Ao filtrar por texto ou empresa, a paginação recalcula sobre os dados filtrados | ✅ Aprovado |
| **Reset Automático** | Ao pesquisar ou alterar a empresa, a página corrente reseta automaticamente para `1` (`useEffect` em `data.length`) | ✅ Aprovado |
| **Ação de Edição** | Disparar edição em qualquer página passa exatamente o registro correspondente para o modal | ✅ Aprovado |

---

## 6. RESULTADOS DOS TESTES E QUALIDADE DE CÓDIGO

### 6.1 Testes Vitest (CONV-17 Completo)
Comando executado: `npx vitest run src/test/conv17`

```
Test Files  4 passed (4)
     Tests  26 passed (26)
  Duration  5.41s

Suites validadas:
  ✓ src/test/conv17_etapa02_saneamento_contratos.test.ts (11 tests)
  ✓ src/test/conv17_fix01_cnab_rotas.test.tsx (6 tests)
  ✓ src/test/conv17_etapa03_intermitentes_recebidos.test.tsx (5 tests)
  ✓ src/test/conv17_fix02_acabamento_recebidos.test.tsx (4 tests)
```

### 6.2 Validação TypeScript
Comando executado: `npx tsc --noEmit`
- Resultado: **0 erros** (código de saída 0).

---

## 7. ARQUIVOS MODIFICADOS

1. `src/pages/Operacional/IntermitentesRecebidos.tsx`:
   - Cálculo e exibição de `totalHorasExtras` no Card 3.
   - Refinamento visual da fita secundária com marcadores coloridos e rótulo canônico `Detalhamento da Jornada:`.
2. `src/components/operacoes/IntermitentesTableBlock.tsx`:
   - Tooltips em cargos truncados e botão de edição.
   - Atributos `aria-label` e `title` no botão de edição.
   - Reset de página em `data.length`.
3. `src/test/conv17_fix02_acabamento_recebidos.test.tsx`:
   - Nova suíte de testes unitários e comportamentais cobrindo o FIX 02.
4. `CONV-17-FIX02-ACABAMENTO-RECEBIDOS.md`:
   - Relatório técnico completo de acabamento e diagnóstico cadastral.

---

## 8. NOTA SOBRE CAPTURA DE TELA AUTOMATIZADA

Durante a execução da ferramenta `browser_subagent` para captura visual do navegador, o serviço do driver Playwright retornou erro 404 de download externo (`playwright-1.57.0-win32_x64.zip` na CDN da Microsoft/Azure). O servidor Vite do projeto permanece ativo localmente em `http://localhost:5173/operacional/intermitentes`, pronto para homologação visual direta pelo usuário.

---

## 9. PRÓXIMO PASSO

Interrompemos a execução conforme solicitado:
- **Nenhum commit foi criado.**
- **Nenhuma alteração foi feita em Lotes de Intermitentes, Central Bancária ou backend.**
- **Aguardando homologação visual do usuário.**
