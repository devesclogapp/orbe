# UX04 — RELATÓRIOS V2: HOTFIX 02.1
## Integridade Semântica e Alinhamento aos Domínios Reais do ORBE

---

## 1. RESUMO DO HOTFIX

O presente hotfix teve como objetivo único e prioritário garantir que **todo valor categórico apresentado no Protótipo 1 (UX Lab) corresponda com fidelidade matemática e semântica ao schema real do ORBE**, eliminando suposições ou "valores plausíveis" que não existem na base de dados.

### Diretrizes Cumpridas:
- **Zero alterações visuais ou estruturais na Central**: A Central de Relatórios V2 e o template canônico continuam visualmente idênticos;
- **Zero impacto em Produção/Backend**: Nenhuma migration, tabela, RPC, RLS, service oficial ou sidebar de produção foi alterada;
- **R05 Intacto**: Permanece estritamente em Horas/Minutos (sem R$, sem Passivo);
- **R02/R04/R07 em Espera**: Permanecem no estado canônico de preparação no UX Lab.

---

## 2. MATRIZ DE DE-PARA DA AUDITORIA SEMÂNTICA

| Conceito | Antes (Plausível) | Fonte Real (Schema / Migrations) | Depois (Real Homologado) | Tipo |
| :--- | :--- | :--- | :--- | :--- |
| **Modalidade de Receita (R03)** | `Mensal`, `À Vista`, `Boleto 15d`, `Boleto 30d` | `receitas_operacionais.modalidade`<br>`20260701100000_receitas_operacionais.sql`<br>`src/types/receitas.types.ts` | `FATURAMENTO_MENSAL`<br>`DUPLICATA`<br>`CAIXA_IMEDIATO` | **Persistido** |
| **Status Financeiro (R03)** | `A Faturar`, `Faturado`, `Liquidado`, `Em Atraso` | `receitas_operacionais.status`<br>`20260706000000_add_conciliado_status.sql`<br>`20260701140500_update_status_receitas.sql` | `pendente_recebimento`<br>`pendente_cobranca`<br>`aguardando_fechamento`<br>`cobranca_enviada`<br>`recebido`<br>`conciliado`<br>`cancelado` | **Persistido** |
| **Situação de Atraso (R03)** | Misturado como status persistido | Regra de negócio financeira:<br>`status NOT IN ('recebido','conciliado','cancelado') AND vencimento < hoje` | Tag/Badge contextual:<br>`Em Atraso (Derivado)` | **Derivado** |
| **Nota Fiscal (R01)** | `NF → Badge Sim/Não` | `operacoes_producao.nf_numero TEXT`<br>`20260429110000_operacoes_producao_colunas_excel.sql` | Número real da NF (ex: `89211`, `10492`) ou travessão `—` | **Persistido** |
| **Status Operacional (R01)** | `CONCLUIDO`, `VALIDADO_RH`, `EM_ANDAMENTO`, `PENDENTE_RH` | `operacoes_producao.status`<br>`20260701000000_split_operacoes_status_rh.sql` | `CONCLUIDO`<br>`FATURADO`<br>`AGUARDANDO_FATURAMENTO`<br>`EM_VALIDACAO`<br>`RECEBIDO`<br>`EM_RESTRICAO` | **Persistido** |
| **Tipo de Serviço (R01)** | `Descarga Paletizada`, `Carregamento Noturno (CN5C)`, `Movimentação Interna` | `tipos_servico_operacional.nome`<br>`20260428173000_producao_in_loco_operacional.sql` | `Descarga`<br>`Carga`<br>`Transbordo`<br>`Movimentação`<br>`Separação`<br>`Apoio Operacional` | **Persistido** |
| **Origem de Faturamento (R03)** | `Operação por Volume`, `Serviço Extra` | `receitas_operacionais_itens`<br>(`operacao_id` vs `servico_extra_id`) | `Operação por Volume`<br>`Serviço Extra`<br>(*Custos Extras 100% excluídos*) | **Persistido** |

---

## 3. EVIDÊNCIAS TÉCNICAS NO CÓDIGO FONTE

### 3.1 `receitas_operacionais.modalidade` (Persistido)
- **Migration**: `supabase/migrations/20260701100000_receitas_operacionais.sql` (Linha 9):
  ```sql
  modalidade VARCHAR(50) NOT NULL CHECK (modalidade IN ('CAIXA_IMEDIATO', 'DUPLICATA', 'FATURAMENTO_MENSAL'))
  ```
- **Trigger**: `supabase/migrations/20260705000001_fix_receita_trigger_modalidade.sql` (Linha 13):
  ```sql
  v_modalidade TEXT := 'DUPLICATA';
  -- Mapeamento automático por forma de pagamento:
  -- CARTAO / DEBITO / PIX / DINHEIRO -> 'CAIXA_IMEDIATO'
  -- FATURAMENTO / MENSAL -> 'FATURAMENTO_MENSAL'
  -- Padrão comercial -> 'DUPLICATA'
  ```
- **Type**: `src/types/receitas.types.ts` (Linha 1):
  ```typescript
  export type ModalidadeReceita = 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL';
  ```

### 3.2 `receitas_operacionais.status` (Persistido vs Derivado)
- **Migration**: `supabase/migrations/20260706000000_add_conciliado_status.sql` (Linhas 23-24):
  ```sql
  ALTER TABLE public.receitas_operacionais 
  ADD CONSTRAINT receitas_operacionais_status_check 
  CHECK (status IN ('pendente_recebimento', 'pendente_cobranca', 'aguardando_fechamento', 'cobranca_enviada', 'recebido', 'conciliado', 'cancelado'));
  ```
- **Componente**: `src/pages/Financeiro/ReceitasPipeline.tsx` (Linhas 26-42):
  O Kanban oficial do financeiro organiza colunas estritamente com base nesses identificadores (`pendente_recebimento`, `pendente_cobranca`, `aguardando_fechamento`, `cobranca_enviada`, `recebido`).
- **Estado Derivado (`Em Atraso`)**:
  Na arquitetura do ORBE, "Em Atraso" **não existe como coluna persistida**. Trata-se de uma derivação temporal inequívoca:
  ```typescript
  if (!row.dataRecebimento && row.vencimento < hoje && row.status !== 'cancelado') {
    // Estado Derivado
  }
  ```
  No protótipo, a coluna de status agora apresenta o **Status Persistido Real** (ex: `Cobrança Enviada`, `Pendente Cobrança`) e, caso a data de vencimento esteja expirada, acopla a badge auxiliar semântica `Em Atraso (Derivado)`.

### 3.3 `operacoes_producao.nf_numero` (Persistido)
- **Migration**: `supabase/migrations/20260429110000_operacoes_producao_colunas_excel.sql` (Linha 5):
  ```sql
  ALTER TABLE public.operacoes_producao
    ADD COLUMN IF NOT EXISTS nf_numero TEXT,
    ADD COLUMN IF NOT EXISTS ctrc TEXT,
  ```
- **Domínio**:
  - Tipo: `TEXT` (armazena números de notas fiscais emitidas, ex: `"89211"`, `"10492"`);
  - Nulabilidade: pode ser `NULL` quando a operação não possui nota fiscal atrelada;
  - Apresentação: exibido como valor numérico formatado ou travessão `—` quando nulo, eliminando o antigo badge genérico `Sim/Não`.

### 3.4 `operacoes_producao.status` e `tipos_servico_operacional`
- **Migration de Status Operacional**: `supabase/migrations/20260701000000_split_operacoes_status_rh.sql` (Linhas 36-37):
  ```sql
  ALTER TABLE public.operacoes_producao ADD CONSTRAINT operacoes_producao_status_check 
    CHECK (status IN ('RECEBIDO', 'EM_VALIDACAO', 'EM_RESTRICAO', 'AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'CONCLUIDO'));
  ```
- **Seed de Serviços**: `supabase/migrations/20260428173000_producao_in_loco_operacional.sql` (Linhas 368-375):
  Serviços cadastrados: `Descarga`, `Carga`, `Transbordo`, `Movimentação`, `Separação`, `Apoio Operacional`.

---

## 4. ARQUIVOS ATUALIZADOS NO UX LAB

1. [`src/pages/UxLab/relatoriosMockData.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/UxLab/relatoriosMockData.ts):
   - `OperacaoVolumeRow`: tipado com `TipoServicoReal`, `StatusOperacaoReal`, e `nfNumero: string | null`;
   - Mock do R01: NFs agora são números reais (`"89211"`, `"10492"`) e `null` para operações sem NF; serviços alinhados ao catálogo e status operacional real (`CONCLUIDO`, `FATURADO`, `AGUARDANDO_FATURAMENTO`, `EM_VALIDACAO`);
   - `FaturamentoReceitaRow`: tipado com `ModalidadeReceitaReal` (`FATURAMENTO_MENSAL`, `DUPLICATA`, `CAIXA_IMEDIATO`) e `StatusReceitaPersistido` (`conciliado`, `recebido`, `cobranca_enviada`, `pendente_cobranca`, `aguardando_fechamento`);
   - Adicionadas funções auxiliares documentadas: `getModalidadeLabel`, `getStatusReceitaLabel`, e `getSituacaoDerivadaReceita`.
2. [`src/pages/UxLab/UxLabRelatorioView.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/UxLab/UxLabRelatorioView.tsx):
   - Adicionado filtro de `Serviço` real no R01;
   - Atualizado filtro de `Status` no R01 com enums reais do banco;
   - Coluna `NF` do R01 exibe número da NF ou travessão `—`;
   - Filtro de `Modalidade` e `Status Financeiro (Persistido)` no R03 alinhados aos dados reais;
   - `FinanceiroStatusBadge` exibe o status persistido e, quando aplicável, o badge derivado `Em Atraso (Derivado)`;
   - Exportação CSV atualizada com colunas ricas e rótulos oficiais.
3. [`src/test/ux_relatorios_v2_proto1.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/ux_relatorios_v2_proto1.test.tsx):
   - Adicionados Testes 8 e 9 validando a integridade semântica do Hotfix 02.1.

---

## 5. VALIDAÇÃO TÉCNICA E TESTES

```bash
# 1. Vitest — Suíte Completa de Relatórios V2
$ npx vitest run src/test/ux_relatorios_v2_proto1.test.tsx
 ✓ 1. Central de Relatórios exibe os 3 domínios corretos e lista os 6 relatórios autorizados
 ✓ 2. Busca rápida filtra relatórios por código, título ou descrição
 ✓ 3. R01 — Operações por Volume renderiza colunas homologadas e totalizadores
 ✓ 4. R05 — Banco de Horas opera ESTRITAMENTE em Horas/Minutos (sem R$, sem Passivo)
 ✓ 5. R03 — Faturamento e Receitas exibe faturamento correto e NÃO inclui Custos Extras
 ✓ 6. Relatórios em preparação exibem estado explicativo digno
 ✓ 7. Filtro de Empresa é obrigatório e segrega dados entre filiais sem rateio
 ✓ 8. Hotfix 02.1: R03 não contém modalidades ou status inventados e diferencia estado derivado
 ✓ 9. Hotfix 02.1: R01 apresenta número de NF real ou travessão e status operacional real
Test Files  1 passed (1)
Tests       9 passed (9)

# 2. Type-Check TypeScript
$ npx tsc --noEmit
Exit code: 0 (Zero erros)

# 3. Build Vite
$ npm run build:dev
✓ 4266 modules transformed.
dist/index.html 1.07 kB │ dist/assets/index.js 5,065 kB
✓ built in 19.08s (Exit code: 0)
```

---

## 6. CONCLUSÃO

O Protótipo 1 no UX Lab continua visualmente com a mesma elegância, hierarquia e densidade aprovadas na Fase 02, porém **toda a sua linguagem de dados e categorias foi purificada contra o schema real do ORBE**. Nenhum enum ou status fictício subsiste no mock.
