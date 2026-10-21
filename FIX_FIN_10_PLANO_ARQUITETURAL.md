# ERP ORBE — FIX FIN-10 | PLANO ARQUITETURAL & CONTRATO DE DADOS
**Documento de Engenharia & Diagnóstico Pré-Implementação (Fase 1 / Gate 1)**  
**Data:** 21/10/2026 | **Status:** Aguardando Aprovação (GATE 1)  
**Escopo:** Exclusivamente Leitura / Análise Arquitetural (Nenhuma linha de código ou banco alterada)

---

## 1. RESUMO EXECUTIVO DO PLANO

A auditoria AUD-FIN-09 comprovou que a integridade financeira, bancária (CNAB) e contábil (DRE) do ERP ORBE está perfeitamente preservada e sem duplicidade física ou monetária.  
O objetivo deste FIX FIN-10 é sanear a **camada de apresentação federada e os contratos de dados** na tela:
**Financeiro & Controladoria → Despesas & Contas a Pagar**

O plano resolve dois problemas específicos:
1. **Problema A (Diaristas):** Diferenciação formal entre *lançamentos de diárias* (total de eventos) e *diaristas distintos* (total de pessoas), eliminando a contagem espúria de `0 colaboradores (0 diárias)` no lote `LT-DIA-1012`.
2. **Problema B (Intermitentes):** Deduplicação canônica e determinística entre a tabela de fechamento operacional (`intermitentes_lotes_fechamento`) e a tabela espelho de RH (`rh_financeiro_lotes`), eliminando a exibição duplicada de duas linhas de R$ 570,00 na grade de despesas, sem risco de ocultar lotes órfãos ou históricos.

---

## 2. DIAGRAMA DE RELACIONAMENTO ENTRE AS FONTES

```
                    ┌────────────────────────────────────────────────────────┐
                    │               LANÇAMENTOS OPERACIONAIS                 │
                    └────────────────────────────────────────────────────────┘
                            │                                        │
                            ▼ (diarista_id)                          ▼ (colaborador_id)
        ┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
        │        lancamentos_diaristas         │  │      lancamentos_intermitentes       │
        │  id (PK)                             │  │  id (PK)                             │
        │  lote_fechamento_id (FK lógica)      │  │  lote_fechamento_id (FK direta)      │
        │  diarista_id (FK public.diaristas)   │  │  colaborador_id (FK colaboradores)   │
        │  valor_calculado                     │  │  total                               │
        └──────────────────────────────────────┘  └──────────────────────────────────────┘
                            │                                        │
                            ▼ (1:N)                                  ▼ (1:N)
        ┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
        │      diaristas_lotes_fechamento      │  │   intermitentes_lotes_fechamento     │
        │  id (PK)                             │  │  id (PK)                             │
        │  total_registros (qtd diárias)       │  │  quantidade_registros (qtd convocaç.)│
        │  valor_total (ex: 350.00)            │  │  valor_total (ex: 570.00)            │
        │  status (ex: 'PAGO')                 │  │  status (ex: 'PAGO')                 │
        └──────────────────────────────────────┘  └──────────────────────────────────────┘
                            │                                        ▲
                            │                                        │ (Vínculo Canônico Nível 1:
                            │                                        │  referencia_evento_id)
                            │                     ┌──────────────────────────────────────┐
                            │                     │       rh_financeiro_lote_itens       │
                            │                     │  lote_id (FK rh_financeiro_lotes)    │
                            │                     │  origem_evento = 'lancamentos_...'   │
                            │                     │  referencia_evento_id (FK lançam.)   │
                            │                     └──────────────────────────────────────┘
                            │                                        ▲
                            │                                        │ (1:N)
                            │                     ┌──────────────────────────────────────┐
                            │                     │         rh_financeiro_lotes          │
                            │                     │  (Espelho Financeiro para DRE)       │
                            │                     │  id (PK)                             │
                            │                     │  tipo = 'INTERMITENTES'              │
                            │                     │  origem = 'OPERACIONAL'              │
                            │                     │  total_colaboradores: 2              │
                            │                     │  valor_total: 570.00                 │
                            │                     └──────────────────────────────────────┘
                            │                                        │
                            ▼                                        ▼
    ══════════════════════════════════════════════════════════════════════════════════════
    [CAMADA DE PROJEÇÃO FEDERADA: DespesasContasPagarOficialService.fetchDespesasFederadas]
    ══════════════════════════════════════════════════════════════════════════════════════
                            │                                        │
           (Resolução Lote + Itens Distintos)             (Deduplicação Canônica 1:1)
                            ▼                                        ▼
    ┌──────────────────────────────────────────┐  ┌──────────────────────────────────────────┐
    │          OBRIGAÇÃO LT-DIA-1012           │  │          OBRIGAÇÃO LT-INT-1026           │
    │  Beneficiário: Equipe Diaristas          │  │  Beneficiário: Equipe Intermitentes      │
    │  Quantidade: 3 diárias • 1 diarista      │  │  Quantidade: 2 convocações • 2 pessoas   │
    │  Valor: R$ 350,00                        │  │  Valor: R$ 570,00                        │
    │  Situação: PAGA                          │  │  Situação: PAGA                          │
    │  Linhas geradas: 1 ÚNICA LINHA           │  │  Linhas geradas: 1 ÚNICA LINHA           │
    └──────────────────────────────────────────┘  └──────────────────────────────────────────┘
```

---

## 3. INVESTIGAÇÃO DETALHADA E CONTRATO DE DADOS

### A. Diaristas

#### 1. Origem e Semântica de `total_registros`
- **Tabela:** `public.diaristas_lotes_fechamento`
- **Definição DDL:** [`supabase/migrations/20260533_create_diaristas_lotes_fechamento.sql:11`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260533_create_diaristas_lotes_fechamento.sql#L11)
  ```sql
  total_registros INTEGER NOT NULL DEFAULT 0,
  valor_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  ```
- **Semântica Comprovada:** O campo `total_registros` armazena a quantidade de linhas de apontamentos (`lancamentos_diaristas`) consolidadas no lote. Se um mesmo diarista trabalhou na segunda, quarta e sexta-feira, ele possui 3 registros em `lancamentos_diaristas`, logo `total_registros = 3`.
- **Conclusão:** `total_registros` representa **quantidade de diárias/lançamentos**, e **jamais pessoas distintas**.

#### 2. Chave de Relacionamento
- A tabela `public.lancamentos_diaristas` possui a coluna `lote_fechamento_id UUID` que referencia diretamente `public.diaristas_lotes_fechamento.id`.
- A coluna `diarista_id UUID` referencia `public.diaristas.id`.

#### 3. Como Obter Diaristas Distintos Sem Consultas N+1
- Na função `fetchDespesasFederadas` em [`src/services/despesasOficial.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/despesasOficial.service.ts), os lotes de diaristas são obtidos em lote (`resDiaristas`).
- Para evitar N+1, executamos uma **única consulta agregadora em lote (1 batch query)** para todos os `loteIds`:
  ```typescript
  const loteIds = (resDiaristas || []).map((l: any) => l.id);
  const diaristasPorLoteMap = new Map<string, { totalLancamentos: number; diaristasDistintos: number }>();
  
  if (loteIds.length > 0) {
    const { data: itensDb } = await supabase
      .from("lancamentos_diaristas")
      .select("lote_fechamento_id, diarista_id")
      .in("lote_fechamento_id", loteIds);
      
    // Agrupamento O(N) em memória
    const grupos = new Map<string, Set<string>>();
    const contagens = new Map<string, number>();
    
    (itensDb || []).forEach((it: any) => {
      const lid = it.lote_fechamento_id;
      if (!grupos.has(lid)) {
        grupos.set(lid, new Set());
        contagens.set(lid, 0);
      }
      if (it.diarista_id) grupos.get(lid)!.add(it.diarista_id);
      contagens.set(lid, (contagens.get(lid) || 0) + 1);
    });
    
    loteIds.forEach((lid: string) => {
      diaristasPorLoteMap.set(lid, {
        totalLancamentos: contagens.get(lid) || 0,
        diaristasDistintos: grupos.get(lid)?.size || 0,
      });
    });
  }
  ```
- **Fallback para registros históricos legados:** Se um lote antigo não possuir mais registros na tabela `lancamentos_diaristas` (ex: expurgo de dados antigos), o fallback seguro é:
  - `quantidadeLancamentos = Number(item.total_registros || 0)`
  - `quantidadePessoas = Number(item.total_registros > 0 ? 1 : 0)` (para não exibir 0 quando há valor financeiro).

#### 4. Contrato de Apresentação Proposto para Diaristas
- **Contrato Atual (`DespesaFederadaItem`):**
  - `quantidadePessoas?: number` (lia `total_colaboradores`, gerava 0)
  - `quantidadeUnidades?: string` (gerava "0 diárias")
- **Novo Contrato Estendido (`DespesaFederadaItem`):**
  ```typescript
  quantidadePessoas: number;       // Pessoas físicas distintas (ex: 1)
  quantidadeLancamentos: number;   // Lançamentos / diárias apuradas (ex: 3)
  quantidadeUnidades: string;      // Formatação UX explícita: "3 diárias"
  ```
- **Resultado Garantido para o Lote Homologado `LT-DIA-1012`:**
  - Código: `LT-DIA-1012`
  - Valor: **R$ 350,00**
  - Situação: **PAGA**
  - Quantidade de Lançamentos: **3 diárias**
  - Quantidade de Pessoas: **1 diarista**
  - Descrição no Drawer: `"1 colaborador (3 diárias)"`
  - Título / Beneficiário na Grade: `"Equipe Diaristas (3 diárias)"`

---

### B. Intermitentes

#### 1. Mapeamento das Duas Fontes
1. **Fechamento Operacional (`public.intermitentes_lotes_fechamento`):**
   - Criado pelo encarregado na grade de intermitentes.
   - Colunas: `id`, `tenant_id`, `empresa_id`, `competencia`, `periodo_inicio`, `periodo_fim`, `quantidade_registros`, `valor_total`, `status`.
   - Representa o **evento operacional de campo**.
2. **Espelho Financeiro RH (`public.rh_financeiro_lotes`):**
   - Criado e sincronizado por [`IntermitentesLoteService.syncToRHFinanceiro`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/intermitentes.service.ts#L544-L655).
   - Colunas: `id`, `tenant_id`, `empresa_id`, `competencia`, `origem = 'OPERACIONAL'`, `tipo = 'INTERMITENTES'`, `total_colaboradores`, `valor_total`, `status`.
   - Representa o **espelho contábil para a DRE e relatórios de RH**.

#### 2. Evidência do Vínculo Canônico Bidirecional
A prova de identidade entre o espelho RH e o fechamento operacional repousa sobre **três âncoras relacionais estritas**:

1. **Âncora Relacional Transacional (Nível 1 - Itens de Evento):**
   - Em `public.rh_financeiro_lote_itens`:
     `lote_id = rh_financeiro_lotes.id`  
     `origem_evento = 'lancamentos_intermitentes'`  
     `referencia_evento_id = lancamentos_intermitentes.id`
   - Em `public.lancamentos_intermitentes`:
     `id = referencia_evento_id`  
     `lote_fechamento_id = intermitentes_lotes_fechamento.id`
   - Essa correlação é comprovada pelo próprio código existente de aprovação em [`IntermitentesLoteService.aprovarFinanceiro:665-680`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/intermitentes.service.ts#L665-L680), que já navega bidirecionalmente entre esses IDs.
2. **Âncora de Unicidade Estrutural (Nível 2 - Constraint de Banco):**
   - A tabela `public.rh_financeiro_lotes` possui a constraint:
     `CONSTRAINT rh_financeiro_lotes_competencia_origem_unq UNIQUE (tenant_id, empresa_id, competencia, origem, tipo)`
   - Para `origem = 'OPERACIONAL'` e `tipo = 'INTERMITENTES'`, **é fisicamente impossível existir mais de um lote espelho para a mesma empresa/competência**.
3. **Âncora Bancária CNAB (Nível 3):**
   - `cnab_remessas_arquivos.intermitentes_lote_id` aponta para `intermitentes_lotes_fechamento.id`.
   - `cnab_remessas_arquivos.lote_id` ou `observacoes.rh_lote_id` aponta para `rh_financeiro_lotes.id`.

#### 3. Estratégia Determinística de Deduplicação e Preservação de Órfãos
Para que a tela de *Despesas & Contas a Pagar* represente cada obrigação exatamente uma vez, aplicamos o princípio: **"Operacional Canônico com Fallback Seguro para Espelho Órfão"**:

1. **Quando ambos existem e estão vinculados (Caso Padrão / Cenário Outubro-2026):**
   - A obrigação é projetada a partir de `intermitentes_lotes_fechamento` (que contém o período início/fim real, observações operacionais e vínculo direto com os lançamentos).
   - O registro espelho em `rh_financeiro_lotes` (`tipo = 'INTERMITENTES'`) é reconhecido como espelho do mesmo fato gerador e **suprimido da listagem de obrigações a pagar**.
   - O ID federado canônico mantém-se `INTERMITENTES:${loteOperacional.id}`.
   - O link para detalhes e drawer continua apontando perfeitamente para as ações de intermitente.
2. **Quando existe fechamento operacional, mas AINDA NÃO há espelho RH:**
   - O registro de `intermitentes_lotes_fechamento` é **preservado e exibido normalmente**.
3. **Quando existe lote espelho em `rh_financeiro_lotes`, mas NÃO HÁ fechamento operacional (Lote Histórico Órfão):**
   - O registro de `rh_financeiro_lotes` é **preservado e exibido normalmente** como obrigação financeira legítima.
   - A contagem de pessoas lê corretamente `item.total_colaboradores` (evitando o bug de 0 convocados).
4. **Quando existem dois fechamentos de períodos diferentes no mesmo mês (ex: quinzenal):**
   - Como cada fechamento operacional possui seu próprio `id`, eles geram obrigações distintas e legítimas.

---

## 4. VALIDAÇÃO DE SCHEMA E NOMES REAIS DE COLUNAS

Conferência estrita das tabelas e colunas envolvidas nas consultas:

| Tabela | Coluna Real | Tipo | Descrição / Restrição |
| :--- | :--- | :--- | :--- |
| `diaristas_lotes_fechamento` | `id` | UUID | Chave primária |
| `diaristas_lotes_fechamento` | `total_registros` | INTEGER | Quantidade de lançamentos/diárias (NÃO pessoas) |
| `diaristas_lotes_fechamento` | `valor_total` | NUMERIC(12,2) | Valor total da folha semanal de diárias |
| `diaristas_lotes_fechamento` | `status` | TEXT | 'fechado_para_pagamento', 'PAGO', etc. |
| `lancamentos_diaristas` | `lote_fechamento_id` | UUID | Chave estrangeira lógica para o lote |
| `lancamentos_diaristas` | `diarista_id` | UUID | Chave estrangeira para `public.diaristas` (contagem distinta) |
| `intermitentes_lotes_fechamento` | `id` | UUID | Chave primária |
| `intermitentes_lotes_fechamento` | `quantidade_registros`| INTEGER | Quantidade de convocações |
| `intermitentes_lotes_fechamento` | `valor_total` | NUMERIC(14,2) | Valor consolidado das convocações |
| `rh_financeiro_lotes` | `id` | UUID | Chave primária |
| `rh_financeiro_lotes` | `origem` | TEXT | 'RH' (CLT) ou 'OPERACIONAL' (Intermitentes) |
| `rh_financeiro_lotes` | `tipo` | TEXT | 'BANCO_HORAS', 'FOLHA_VARIAVEL' ou 'INTERMITENTES' |
| `rh_financeiro_lotes` | `total_colaboradores`| INTEGER | Quantidade de colaboradores distintos |
| `rh_financeiro_lote_itens` | `referencia_evento_id`| UUID | FK lógica para `lancamentos_intermitentes.id` |
| `cnab_remessa_itens` | `remessa_id` | UUID | **Atenção:** coluna chama-se `remessa_id`, NÃO `remessa_arquivo_id` |
| `cnab_retorno_itens` | `remessa_arquivo_id` | UUID | Coluna para o arquivo de remessa |
| `cnab_retorno_itens` | `intermitentes_lote_id`| UUID | FK para `intermitentes_lotes_fechamento.id` |
| `cnab_retorno_itens` | `diaristas_lote_id` | UUID | FK para `diaristas_lotes_fechamento.id` |

---

## 5. LISTA EXATA DE ARQUIVOS A SEREM ALTERADOS (FASE 2)

A intervenção requer alteração em apenas **dois arquivos da camada de apresentação/serviço frontend**, sem nenhuma alteração no banco de dados:

1. [`src/services/despesasOficial.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/despesasOficial.service.ts):
   - Atualizar interface `DespesaFederadaItem` para incluir `quantidadeLancamentos?: number`.
   - No normalizador `normalizarLoteDiarista`:
     - Ler `total_registros` para diárias e usar a contagem agregada de `diaristasDistintos` para pessoas.
     - Formatar `beneficiarioNome` e `quantidadeUnidades`.
   - No normalizador `normalizarLoteIntermitente`:
     - Suportar `item.total_colaboradores || item.quantidade_registros || item.total_registros`.
   - No método `fetchDespesasFederadas`:
     - Executar a consulta única em lote de `lancamentos_diaristas` para resolver `diaristasDistintos` sem N+1.
     - Implementar a deduplicação canônica inteligente entre `resLotesRh` (tipo INTERMITENTES) e `resIntermitentes`.
2. [`src/pages/Financeiro/components/DespesaDrawerOficial.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx):
   - Ajustar a exibição da linha "Pessoas Envolvidas" para demonstrar claramente:
     `{despesa.quantidadePessoas} colaboradores ({despesa.quantidadeLancamentos ? `${despesa.quantidadeLancamentos} diárias` : despesa.quantidadeUnidades})`

---

## 6. MATRIZ DE RISCO E PREVENÇÃO DE REGRESSÕES

| Módulo / Funcionalidade | Risco Mapeado | Estratégia de Mitigação |
| :--- | :--- | :--- |
| **DRE (Resultado Operacional)** | Risco de alteração em valores | **Risco Zero:** DRE consulta serviços próprios ([`dashboard.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/dashboard.service.ts)). `despesasOficial.service.ts` não é fonte da DRE. |
| **Central Bancária / CNAB** | Risco de quebra de remessa/retorno | **Risco Zero:** Central Bancária consome [`bancarioOficialAdapter.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/bancarioOficialAdapter.ts). Nenhuma query bancária será alterada. |
| **Lotes Históricos / Órfãos** | Risco de ocultar obrigações antigas | **Mitigado:** Se um lote de `rh_financeiro_lotes` não encontrar par operacional, ele é preservado e exibido normalmente. |
| **Performance (N+1)** | Risco de lentidão ao contar diaristas | **Mitigado:** Agrupamento executado via 1 única consulta em lote com operador `.in('lote_fechamento_id', loteIds)`. |
| **Ações do Drawer (Aprovar/Devolver)** | Risco de ID inválido na mutação | **Mitigado:** O `canonicalId` do lote operacional é preservado, mantendo 100% de compatibilidade com os services de ação. |

---

## 7. PARECER TÉCNICO DO GATE 1

### Parecer: **GO**

**Justificativa Técnica:**
- O vínculo canônico entre o espelho RH e o fechamento operacional de intermitentes foi formalmente comprovado em três níveis independentes (itens de evento `referencia_evento_id`, unicidade de schema e âncoras CNAB).
- A origem de `total_registros` foi categoricamente definida como contagem de diárias/lançamentos, e o método para obtenção de diaristas distintos sem consulta N+1 foi estabelecido e validado.
- Os nomes reais de colunas foram rigorosamente verificados contra as migrations ativas.
- A correção é estritamente de extensão e normalização na camada de serviço de apresentação, sem riscos para CNAB, DRE, RH ou banco oficial.

---
*Fim do documento. Execução pausada no Gate 1. Aguardando autorização expressa do operador para iniciar a Fase 2.*
