# RELATÓRIO EXECUTIVO - HOMOLOGAÇÃO E2E (INTERMITENTES)
## CHECKPOINT 05 — GERAÇÃO DA REMESSA BANCÁRIA (CNAB240)

**Status Final:** 🔴 NÃO HOMOLOGADO
**Data da Auditoria:** 11/07/2026

---

### Resumo Executivo
Durante a homologação operacional assistida para geração da remessa bancária (CNAB240), foi constatado que os lotes provenientes dos checkpoints anteriores (especificamente em status `FECHADO_FINANCEIRO`) **não estão disponíveis** ou **foram perdidos** no banco de dados para a organização atual (`admin@orbelogistica.com.br`). Todas as empresas testadas no filtro da Central Bancária (`BENEVIDES`, `Norte LOG`, `DISMELO`, `Escritório RH`, etc.) retornaram `0 lote(s) pronto(s)`.

Além disso, durante a navegação exploratória para rastrear os lotes no Pipeline Operacional, o sistema apresentou um **crash** causado por um erro crítico de banco de dados: a coluna `custos_extras_operacionais.deleted_at` não existe (reflexo de uma migration incompleta de *soft-delete* no módulo de custos).

### Inconsistências Encontradas

#### 1. Inexistência de Lotes FECHADO_FINANCEIRO (🔴 CRÍTICO)
- **Local:** `/bancario` e consultas DB isoladas.
- **Problema:** A tabela `intermitentes_lotes_fechamento` e `rh_financeiro_lotes` retornam 0 registros no status adequado para gerar o CNAB.
- **Impacto:** Bloqueia todo o Checkpoint 05, sendo impossível gerar qualquer arquivo CNAB para validação estrutural, persistência e idempotência. 

#### 2. Ausência de Conta Bancária Padrão nas Empresas (🟡 MÉDIA)
- **Local:** `/bancario` - Dropdown Conta bancária (CNAB)
- **Problema:** A grande maioria das empresas cadastradas exige configuração manual para CNAB, exibindo *"Nenhuma conta bancária habilitada para CNAB nesta empresa"*. Apenas a "Norte LOG Cliente Teste Ltda" estava pré-configurada corretamente (Banco do Brasil).

#### 3. Quebra do Pipeline Operacional por Erro de Schema (🔴 CRÍTICO)
- **Local:** `/receitas/pipeline` (Pipeline Operacional)
- **Problema:** O cliente da aplicação crasha com `[object Object]` devido a um erro de banco repassado pela API: `column custos_extras_operacionais.deleted_at does not exist`.
- **Impacto:** Impede a auditoria operacional e o rastreamento da vida útil dos lotes, quebrando a tela inteira.

---

### Parecer do QA

A etapa atual falhou instantaneamente nas pré-condições. O sistema foi testado a nível de UI utilizando *headless browsing* da mesma maneira que o Operador Financeiro faria, seguindo o rigor impeditório das regras de negócio. 

**Próximos Passos Obrigatórios antes de Re-homologar:**
1. Rodar *migration* do banco de dados adicionando a coluna de soft-delete (`deleted_at`) na tabela de Custos Extras.
2. Re-executar o **Checkpoint 04** ou criar um *Seed* programático com massa de dados para inserir pelo menos 1 lote de intermitente validado financeiramente para `Norte Log` ou `BENEVIDES`.
3. Informar à auditoria quando a massa de dados estiver fisicamente presente no ambiente para nova rodada do Checkpoint 05.
