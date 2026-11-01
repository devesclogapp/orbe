# ERP ORBE — CONV-21 / ETAPA 03
## Convergência Visual das Abas Complementares de Configurações
### Relatório Técnico de Homologação e Validação Visual

---

## 1. Contexto & Escopo da Etapa 03

Na **CONV-21 / Etapa 02**, foram homologadas a estrutura mestra do cabeçalho executivo, a trilha horizontal de 5 abas e as abas **Preferências Gerais** e **Meu Perfil**.

Nesta **Etapa 03**, realizamos a convergência visual das 3 abas complementares da rota `/configuracoes`:

1. **Configurações Operacionais** (`tab=config_operacional`)
2. **Modelos de Importação** (`tab=modelos`)
3. **Manutenção do Ambiente** (`tab=manutencao`)

Todas as implementações seguiram rigorosamente o **Design System oficial do ERP ORBE**, espelhando os padrões estabelecidos nas convergências homologadas **CONV-19**, **CONV-20** e **CONV-21 / Etapa 02**, sem adição de KPIs decorativos e com estrita preservação das regras de negócio, cálculos, persistência e salvaguardas de governança.

---

## 2. Detalhamento das Implementações por Aba

### 2.1 Aba 1 — Configurações Operacionais

* **Bloco Motor Operacional**:
  - Cartão mestre padronizado com superfície canônica `rounded-xl border border-border/80 bg-card p-6 shadow-xs`.
  - Cabeçalho com ícone `Settings2` em azul institucional (`#2563EB`), título `Motor Operacional` e descrição conceitual.
  - Botão de ação alternável ("Editar Parâmetros" / "Salvar Alterações") padronizado (`h-9 px-4 rounded-lg text-xs font-medium`).
  - Divisão em subcards de superfície suave `bg-muted/20 border-border/70 rounded-xl p-5`:
    - **Parâmetros Gerais**: Moeda Padrão (`BRL`), Fuso Horário (`GMT-3 Brasília`), Limite de Escopo (`31 dias`).
    - **Regras de Apuração**: Tolerância de Ponto (`10 min`), Arredondamento Financeiro (`Duas casas`), Notificação de Inconsistência (`Switch` controlado).
* **Seção Jornadas de Trabalho (`JornadasTrabalhoSection`)**:
  - Container atualizado para `rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-5`.
  - Bloco informativo da **Referência Geral CLT Vigente** (Gate 2 de Jornada) preservado integralmente com badges canônicos.
  - Cartões de jornada com tipografia padronizada, badges de status (`Ativo` / `Inativo`) e botões de ação estruturados.
* **Seção Regras de Banco de Horas (`RegrasBancoHorasSection`)**:
  - Container padronizado com design tokens canônicos.
  - Tabela corporativa harmonizada com cabeçalho `bg-muted/40 border-b border-border/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`.
  - Preservação estrita da hierarquia do **Gate 3 — Banco de Horas** (Específica > Compartilhada > Geral).
* **Seção Filtros de Colaboradores por Tela do Encarregado**:
  - Container canônico com ação "Salvar filtros" em botão primário `#2563EB`.
  - Grid responsivo de presets operacionais (Volume, Custos/Despesas, Serviços Extras, Diaristas) estilizados em cartões individuais `bg-muted/20 border-border/70 rounded-xl p-4`.

### 2.2 Aba 2 — Modelos de Importação

* **Barra de Ações e Cabeçalho**:
  - Cartão de cabeçalho `rounded-xl border border-border/80 bg-card p-5 shadow-xs` com ícone `Database`.
  - Botão primário "+ Novo Modelo" estilizado com `bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium h-9 shadow-xs`.
* **Tabela Corporativa de Modelos**:
  - Container encapsulado `rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs`.
  - Cabeçalho padronizado com tracking e tipografia `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40`.
  - Status Badge Canônico:
    - **Ativo**: microindicador verde suave (`bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20` com ponto `h-1.5 w-1.5 rounded-full bg-emerald-500`).
    - **Inativo**: neutro suave (`bg-muted/60 text-muted-foreground border-border/60` com ponto neutro).
  - Link de Abertura: `inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium` ("Abrir Planilha").
  - Botões de Ação na Linha: botões de ícone unificados `h-8 w-8 rounded-lg` para visualização, edição (`Pencil`) e exclusão segura (`Trash2`).
* **Modal / Dialog de Cadastro e Edição (`Dialog`)**:
  - Diálogo estilizado no padrão canônico `sm:max-w-[520px] rounded-xl border border-border/80 bg-card p-6 shadow-lg`.
  - Inclusão de `DialogDescription` para conformidade semântica e acessibilidade Radix UI.
  - Campos de formulário com altura uniforme `h-9 text-xs rounded-lg`.
  - Switch de modelo ativo com container de superfície `bg-muted/20 rounded-lg p-3`.

### 2.3 Aba 3 — Manutenção do Ambiente (`ResetOperacional`)

* **Interface Institucional e Sóbria**:
  - Cartão de cabeçalho corporativo `rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-4`.
  - Badge institucional discreto: `Área Restrita — Operações Críticas` (`bg-amber-500/10 text-amber-700 border-amber-500/20`).
  - Alerta de **Dupla Proteção Obrigatória** refinado com container `bg-muted/30 border-border/70 rounded-xl p-4`.
* **Grid de 4 Níveis de Reset Transacional**:
  - Níveis disponíveis: **Reset Operacional**, **Reset Financeiro**, **Reset Completo do Tenant** e **Reset Ambiente Demo**.
  - Cartões modulares `rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between`.
  - Badges de severidade sóbrios (`Reset seletivo`, `Destrutivo controlado`, `RISCO EXTREMO`).
  - Bloco de registros afetados `rounded-lg border border-border/70 bg-muted/20 p-3.5` com tipografia `font-display text-2xl font-semibold`.
  - Listagem de principais tabelas afetadas com badges de contagem e indicação ordenada por impacto.
  - Bloco de escopo estritamente preservado.
* **Salvaguardas Críticas Rigorosamente Preservadas**:
  - **Zero execuções destrutivas** realizadas durante testes e homologações.
  - Preservação integral do modal com dupla confirmação textual obrigatória, justificativa mandatória, checkbox de ciência e checagem de role `admin` / `super_admin`.

---

## 3. Matriz de Invariância Funcional

| Módulo / Regra | Estado | Validação |
| :--- | :---: | :--- |
| **Tolerância de Ponto** | Intacta | Parâmetro persistido e consumido pelo Motor RH sem alterações. |
| **Jornadas de Trabalho** | Intacta | Referência Geral CLT (44h/220) e Gate 2 100% operacionais. |
| **Banco de Horas** | Intacta | Hierarquia Gate 3 (Específica > Compartilhada > Geral) preservada. |
| **Filtros Encarregado** | Intacta | Presets de colaboradores por tela mantidos com mutations ativas. |
| **Modelos de Importação** | Intacta | Métodos `listAll`, `upsert` e `remove` do `ImportacaoModelosService` preservados. |
| **Salvaguardas de Reset** | Intacta | Confirmação dupla, justificativa, frase textual e auditoria intactas. |
| **Segurança & Permissões** | Intacta | Validação via `useAccessControl` e `useTenant` (role admin/super_admin). |

---

## 4. Evidências de Qualidade e Testes Automatizados

### 4.1 Compilação TypeScript
```bash
npx tsc --noEmit
# Saída: Exit code 0 (Zero erros em toda a codebase)
```

### 4.2 Testes Automatizados CONV-21 (Etapa 02 & Etapa 03)
```bash
npx vitest run src/test/conv21_etapa02_preferencias_perfil.test.tsx src/test/conv21_etapa03_abas_complementares.test.tsx
```
**Resultado:**
```text
 ✓ src/test/conv21_etapa02_preferencias_perfil.test.tsx (9 tests)
 ✓ src/test/conv21_etapa03_abas_complementares.test.tsx (6 tests)
 Test Files  2 passed (2)
      Tests  15 passed (15)
   Duration  7.38s
```

### 4.3 Análise de Regressão CONV-19 e CONV-20
```bash
npx vitest run src/test/conv19_central_cadastros_ui.test.tsx src/test/conv20_regras_operacionais_ui.test.tsx src/test/conv20_etapa03_abas_complementares.test.tsx
```
**Resultado:**
```text
 ✓ src/test/conv20_etapa03_abas_complementares.test.tsx (4 tests)
 ✓ src/test/conv20_regras_operacionais_ui.test.tsx (5 tests)
 ✓ src/test/conv19_central_cadastros_ui.test.tsx (27 tests)
 Test Files  3 passed (3)
      Tests  36 passed (36)
   Duration  13.78s
```

---

## 5. Auditoria de Arquivos e Git Status

### 5.1 Arquivos Modificados
1. `src/pages/Configuracoes.tsx` — Convergência das abas `config_operacional` e `modelos`, dialog de novo modelo e inclusão de `DialogDescription`.
2. `src/pages/Configuracoes/JornadasTrabalhoSection.tsx` — Substituição de `.esc-card` por container de superfície canônica `rounded-xl border border-border/80 bg-card p-6 shadow-xs`.
3. `src/pages/Configuracoes/RegrasBancoHorasSection.tsx` — Substituição de `.esc-card` e cabeçalho de tabela por tokens canônicos.
4. `src/pages/Configuracoes/ResetOperacional.tsx` — Substituição de `.esc-card` pelo padrão institucional com badge de área restrita e caixa de dupla proteção.

### 5.2 Novos Arquivos Criados
1. `src/test/conv21_etapa03_abas_complementares.test.tsx` — Suíte de testes unitários e de integração das 3 abas complementares.
2. `scratch/apply_conv21_etapa03.mjs` — Script determinístico de atualização e alinhamento de tokens.
3. `scratch/capture_conv21_etapa03.mjs` — Script de capturas E2E via Playwright autenticado.
4. `CONV-21-ETAPA03-ABAS-COMPLEMENTARES.md` — Documento oficial de entrega da Etapa 03.

### 5.3 Git Diff Stat
```text
 src/pages/Configuracoes.tsx                        | 1036 ++++++++++++--------
 .../Configuracoes/JornadasTrabalhoSection.tsx      |    2 +-
 .../Configuracoes/RegrasBancoHorasSection.tsx      |    4 +-
 src/pages/Configuracoes/ResetOperacional.tsx       |   44 +-
 4 files changed, 685 insertions(+), 401 deletions(-)
```

---

## 6. Evidências Visuais E2E (Playwright)

As capturas de alta resolução foram geradas nas resoluções oficiais de referência (1440×900 e 1366×768) com autenticação real do ERP ORBE:

### 6.1 Viewport 1440×900

* **Configurações Operacionais**:
  ![Configurações Operacionais 1440x900](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/01_etapa03_config_operacional_1440x900.png)

* **Modelos de Importação**:
  ![Modelos de Importação 1440x900](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/02_etapa03_modelos_1440x900.png)

* **Modal Novo Modelo de Importação**:
  ![Modal Novo Modelo 1440x900](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/03_etapa03_modal_novo_modelo_1440x900.png)

* **Manutenção do Ambiente**:
  ![Manutenção do Ambiente 1440x900](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/04_etapa03_manutencao_1440x900.png)

### 6.2 Viewport 1366×768

* **Configurações Operacionais (1366×768)**:
  ![Configurações Operacionais 1366x768](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/05_etapa03_config_operacional_1366x768.png)

* **Modelos de Importação (1366×768)**:
  ![Modelos de Importação 1366x768](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/06_etapa03_modelos_1366x768.png)

* **Manutenção do Ambiente (1366×768)**:
  ![Manutenção do Ambiente 1366x768](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/07_etapa03_manutencao_1366x768.png)

---

## 7. Conclusão & Estado Atual

A **CONV-21 / Etapa 03** conclui integralmente a convergência visual das 5 abas da rota `/configuracoes`:
1. `Preferências Gerais` (Homologado na Etapa 02)
2. `Configurações Operacionais` (Concluído na Etapa 03)
3. `Manutenção do Ambiente` (Concluído na Etapa 03)
4. `Modelos de Importação` (Concluído na Etapa 03)
5. `Meu Perfil` (Homologado na Etapa 02)

**Status:** Concluído com 100% de integridade técnica, compilação limpa, zero regressão e documentação completa.
**Aguardando homologação visual do usuário.** Nenhuma alteração foi commitada, enviada ao Git ou aplicada em banco de dados.
