# Auditoria Arquitetural — Empresa Resolver V2

## 1. Mapeamento das Edge Functions Reais

A origem e responsabilidades divergem na manipulação de cadastros provisórios. Constatou-se uma diferença primordial no design das automações CLT vs Intermitentes: o Tio Digital segrega a injeção em "Cadastro" e "Operação", enquanto o RHID unifica ambos em um evento de Self-Healing em tempo real.

### Tabela Definitiva de Responsabilidades e Fluxos

| Função | Domínio / Fase | Origem Dados | Cria empresa provisória? | Cria Colaborador provisório? | Atualiza colab. existente? | Comportamento se não achar empresa (Ordem de Resolução) | Pode persistir `empresa_id = null`? |
|---|---|---|:---:|:---:|:---:|---|:---:|
| `importar-colaboradores-tio` | **INTERMITENTES**<br/>Pré-cadastro (Tio A) | Webhook A | **SIM** | **SIM** | **SIM** (upsert `matricula` + `tenant`) | RPC Search → Fallback Select `ilike` → Insert Fallback `empresas`. | **SIM** *(Raro, apenas se RPC e Fallback Insert Database falharem silenciosamente)* |
| `importar-intermitentes-tio` | **INTERMITENTES**<br/>Lançamento/Ponto (Tio B) | Webhook B | **NÃO** | **NÃO** | **NÃO** | Search Exact `nome` → Search Substring `includes`. | **SIM** *(Deixa null caso o Workflow A não tenha ocorrido a tempo, ou não encontre via fuzzy text).* |
| `importar-pontos-rhid` | **CLT**<br/>Cadastro + Ponto (Misto) | API | **SIM** | **SIM** | **SIM** (upsert `registros_ponto`) | Search Exact Map (Cached) → Insert `empresas` com `CNPJ: 00000{random}` | **NÃO** *(Força a criação na hora e atrela).* |
| `importar-pontos-manual` | **CLT**<br/>Cadastro + Ponto (Misto) | Upload UI | **SIM** | **SIM** | **SIM** (upsert `registros_ponto`) | Idêntico ao RHID, incluindo inserção de Empresa no vazio. | **NÃO** *(Força a criação).* |

## 2. Cadastro vs Lançamento: O Core do Problema
O Tio Digital quebra no momento financeiro pois depende agressivamente de sincronia perfeita (O Lançamento B precisa que o Cadastro A tenha rodado e não falhado). Se o nome na Empresa não for perfeito, a busca Substring falha, gerando um Lote sem empresa sem auto-cura. O RHID está homologado exatamente por ser auto-curativo: ao importar o lançamento operacional, se faltar dado mestre, ele gera os nós relacionais na hora e trava eles juntos com o dado bruto de negócio.

## 3. O Fluxo CLT Homologado
O fluxo CLT encontra sua principal lógica de Self-healing dentro do **looping iterador de `importar-pontos-rhid`**. Ali o sistema atinge o ápice funcional esperado pela ESC LOG:
- Procura Empresa (`uniqueEmpresasMap`).
- **NÃO ACHA:** Executa Insert `cadastro_provisorio: true` e a cadastra em cache para as próximas linhas iteradas do batch.
- Procura Colaborador.
- **NÃO ACHA:** Executa Insert atrelando-o à empresa nova ou àquela encontrada do mapa.
- Desce o Lancamento amarrado.
