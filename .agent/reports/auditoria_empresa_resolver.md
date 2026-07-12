# Auditoria Arquitetural — Resolução de Empresas no ORBE

## 1. Mapeamento de Entradas (ETAPA 01 e 02)

O módulo de entrada de dados no ORBE consome a entidade `empresa_id` sob naturezas diferentes dependendo do canal:

| Fluxo | Natureza | Estratégia de Resolução | Ação Falha (Não Encontrado) |
| --- | --- | --- | --- |
| **Operacionais (Manual UI)** <br/> _Operações, Diaristas, Serviços Extras_ | Combobox Seletor | O usuário seleciona o ID primário visível na lista (Select). | N/A (impossível não achar) |
| **RHID (Automação)** | Webhook (Payload) | Normalização → Consulta Nome | **Cria empresa On-The-Fly** (Provisória c/ CNPJ fake) |
| **Tio Digital (Automação)** | Webhook (Payload) | Normalização → Fuzzy Scan | **Retorna null** (Permite lançamento nascer flácido) |
| **Planilha Ponto (Upload)** | Arquivo Excel CSV | Normalização → Consulta Cache | **Cria empresa On-The-Fly** (semelhante ao RHID) |

Esta colcha de retalhos revela a inexistência de um *Domain Controller Universal* atuando como funil estrutural único. A regra de negócio está espalhada nas Edge Functions.

## 2. Diagnóstico de Riscos (ETAPA 03)
Dado o cenário, o sistema caminha para grave fragmentação técnica (`Data Pollution`). Os maiores riscos documentados são:

* **Duplicação Ilimitada:** Um departamento vindo do TIO como "Matriz", e do RHID como "MATRIZ-ESC" formariam no ORBE duas matrizes independentes se caíssem no importador errado.
* **Quebra de Integração CNAB:** Empresas "On-The-Fly" (provisórias) nascem sem Conta Bancária, CNPJ e Convênio formatados. Se um Lote Financeiro atrelar a elas, o Pipeline Bancário sofrerá falha estrutural.
* **DRE e Despesas Fragmentadas:** Em casos de dupla empresa, o demonstrativo financeiro acusará prejuízo cruzado por pulverizar resultados reais.

## 3. Arquitetura Definitiva Sugerida (ETAPA 04)

### Padrão Proposto: `Alias-Based Gatekeeper`

A melhor estratégia, focada no B2B rigoroso do ORBE, proíbe expressamente **(1)** criação algorítmica de empresas e **(2)** aceitação silenciosa de campos nulos. O pipeline de domínio recomendado deverá atuar por RPC do Postgres:

```
resolve_empresa(raw_name)
│
├── 1. Normalização profunda (remoção acentos, espaços)
├── 2. Busca exata na Tabela 'empresas'
│   └── Achou? -> Retorna empresa_id
│
├── 3. Busca exata na auxiliar 'empresas_aliases' (ex: "castanhal" -> UUID Empresa C)
│   └── Achou? -> Retorna empresa_id da tabela real
│
└── 4. NÃO ACHOU?
    └── Lança Exceção Controlada (Inconsistência)
        ├── O Webhook isola a linha no 'historico_importacoes'
        └── O ERP bloqueia propagação para domínios centrais sem poluir o BD.
```

A intervenção humana via interface UI (Notificações / Central Cadastros) permitirá ao RH "Linkar e Aprender": ao mapear que a string rejeitada do arquivo significa X empresa, o alias é formado para todas as futuras automações de todos os canais simultaneamente.

## 4. Avaliação de Impactos (ETAPA 05)
Centralizar sob essa filosofia afetará intensamente os Edge Functions de importação. Eles deixarão de atuar como "resolvedores" criadores/mutantes, agindo estritamente como repassadores de lotes.
* **Impacto Positivo em Custeio/Faturamento:** Garantirá bloqueio absoluto de "empresas zumbis", mantendo relatórios operacionais consolidados a uma única referência, tornando o fluxo de CNAB inquebrável.

## 5. Teste de Compatibilidade (ETAPA 06)
Sim, existem débitos técnicos herdados dessa cisão que obrigatoriamente forçarão:
1. **Consolidação e Merge:** Script DML de unificação das empresas provisórias que já nasceram no banco, transferindo seus UUIDs e cascateando para 1 única oficial.
2. Criação da tabela `empresas_aliases`.
3. Repadronização de Edge Functions. Sem estas medidas a mudança será parcial e causará dependência relacional órfã.
