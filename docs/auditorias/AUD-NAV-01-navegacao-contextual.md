# AUDITORIA TÉCNICA — AUD-NAV-01
## Auditoria Transversal de Navegação Contextual

---

### 1. IDENTIFICAÇÃO E METADADOS

- **Identificador Único:** `AUD-NAV-01`
- **Título:** Auditoria Transversal de Perda de Contexto em Navegações Internas
- **Módulo:** Transversal (Dashboard Executivo, DRE, Torre Operacional, Central de Aprovações, Fechamentos)
- **Origem da Demanda:** Caso piloto reportado na homologação do Dashboard Executivo.
  - *Cenário:* Origem no Dashboard Executivo (Empresa: Consolidado Geral, Competência: Setembro/2026). Usuário clica no KPI "Resultado Operacional" (R$ 1.877,62), abre o Drawer e aciona "Abrir DRE Gerencial".
  - *Comportamento Observado:* O DRE abriu exibindo a competência padrão Outubro/2026, ignorando o mês Setembro/2026 selecionado na origem.
- **Data da Auditoria:** 10/11/2026
- **Status Funcional:** **AUDITORIA CONCLUÍDA / CORREÇÕES PENDENTES** (Documentada aguardando início da demanda de implementação `NAV-02`)
- **Status Git:** **DOCUMENTADO**
- **Status de Deploy:** **NÃO PUBLICADO**

---

### 2. ESCOPO E DIAGNÓSTICO DO CASO PILOTO

1. **Origem:** `src/components/dashboard/ExecutiveKpiDrawer.tsx`
   - O botão de ação acionava:
     ```tsx
     onNavigate("/financeiro/dre");
     ```
   - Nenhum parâmetro de URL (`searchParams`) ou estado de rota (`location.state`) era enviado contendo `mes`, `ano`, `competencia`, `empresaId` ou `ambiente`.
2. **Destino:** `src/pages/Financeiro/RelatorioDRE.tsx`
   - O componente inicializava seus filtros de estado com base em `new Date()` (mês 10 / outubro) ou `localStorage` legado:
     ```tsx
     const [mesSelecionado, setMesSelecionado] = useState("10");
     ```
   - O DRE não possuía suporte a leitura de `useSearchParams()` ou `location.state`.
3. **Conclusão do Caso Piloto:** Defeito funcional de navegação contextual confirmado. O usuário é obrigado a selecionar novamente os filtros na tela de destino, induzindo a erros de interpretação gerencial.

---

### 3. MAPA INICIAL DE NAVEGAÇÕES AUDITADAS

A varredura transversal no código-fonte localizou todas as chamadas a `navigate(...)` e callbacks `onNavigate(...)`.

**Total de pontos de navegação auditados:** 58 navegações.
- **40 pontos** apresentaram indícios de perda de contexto operacional ou temporal ao transitar entre módulos.
- **18 pontos** preservam contexto via rotas parametrizadas (ex: `/rh/fechamento/:id`) ou constituem navegações sem contexto requerido (ex: logout, menu principal estático).

---

### 4. PRINCIPAIS GARGALOS IDENTIFICADOS

| Origem | Ação / Gatilho | Destino | Contexto Perdido | Severidade |
| :--- | :--- | :--- | :--- | :---: |
| `ExecutiveKpiDrawer.tsx` | Ação "Abrir DRE Gerencial" | `/financeiro/dre` | Competência (`2026-09`), Empresa e Ambiente | **ALTA** |
| `Dashboard.tsx` | Ação "Ver Detalhes do Faturamento" | `/financeiro/receitas` | Competência, Empresa e Filtro de Status | **ALTA** |
| `PipelineOperacional.tsx` | Redirecionamento por Alerta | `/producao/operacoes` | ID da Operação (`highlight`/`opId`), Empresa | **MÉDIA** |
| `CentralAprovacoes.tsx` | "Auditar Lote de Origem" | `/rh/diaristas` | Ciclo Semanal, ID do Lote | **ALTA** |
| `RelatorioDRE.tsx` | Detalhamento de Linha Contábil | `/financeiro/contas-pagar` | Competência, Categoria de Despesa | **ALTA** |

---

### 5. DIRETRIZES TÉCNICAS PARA CORREÇÃO (DEMANDA NAV-02)

1. **Padronização de Contratos de URL (Search Params):**
   - Utilizar parâmetros de consulta universais: `?empresaId=...&competencia=YYYY-MM&ambiente=...`.
2. **Inicialização Reativa nos Destinos:**
   - As telas de destino devem verificar a presença de query params e inicializar os hooks de filtro com prioridade sobre o padrão de data atual.
3. **Tratamento de Competência Anual (`YYYY-all`):**
   - Caso a origem esteja no modo anual (`YYYY-all`), o destino deve reconhecer o modo anual ou, se suportar apenas competências mensais, converter de forma transparente para o mês corrente ou abrir diálogo de confirmação.

---

### 6. PRÓXIMOS PASSOS

- Elaboração detalhada dos contratos em `AUD-NAV-01.1-revisao-contratos.md`.
- Execução controlada das correções na demanda **NAV-02**.

