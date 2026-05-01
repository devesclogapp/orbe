# Documentação Arquitetural: Operações, Custos Extras e Regras Operacionais

## 1. Visão Geral
Este documento apresenta uma análise técnica da implementação e da arquitetura das telas de **Operações**, **Custos Extras** e do gerador de **Regras Operacionais**. O objetivo é guiar as próximas implementações para manter o código estável, prevísivel e preparado para receber crescimentos de escopo.

## 2. Complemento Arquitetural — Entrada de Dados Operacionais
A tela **Operações** deve ser tratada não como um mero exibidor de planilhas, mas sim como um módulo central de entrada, processamento e validação de dados operacionais.

Atualmente, os dados entram majoritariamente por importação de planilhas, porém essa importação é uma etapa temporária/assistida. A estrutura deve estar e permanecer preparada para receber futuramente novos dados oriundos de formulários operacionais (encarregados) e integrações externas (APIs).

### Fontes de dados previstas

1. **Planilha Operacional**
   - Caixa e Caixa Imediato
   - Duplicatas
   - Duplicatas a Volume
   - Custos Extras
   - Diaristas
   - Outras abas futuras

2. **Formulário do Encarregado**
   - Rota atual/base: `/login/operacional`
   - O formulário deve permitir o lançamento manual de operações.
   - Deve consumir estritamente as **mesmas regras de cálculo** da importação, sem que exista duplicidade na lógica de negócios.

3. **API de Coletores de Ponto**
   - Fonte futura de implantação.
   - Será voltada especialmente aos colaboradores CLT.
   - **Regra:** Não deve ser misturada inicialmente com as operações por demanda (para manter os escopos isolados onde for conveniente).

### A Regra Arquitetural (Pipeline Abstrato)
Toda e qualquer nova fonte de dados, não importa a origem, deve passar por uma pipeline padronizada e unificada:

`Entrada` → `Normalização` → `Validação` → `Processamento (Regras & Valores)` → `Persistência` → `KPIs/Dashboard`

> **Importante:** A importação de planilhas **não deve** ser tratada como a estrutura definitiva ou o "core" do ERP, mas sim como apenas mais uma fonte de dados entre várias permitidas na abstração da aplicação. O código deve estar preparado para crescer de forma agnóstica por origem, centralizando a lógica.

---

## 3. Configurações de Regras Operacionais (`RegrasOperacionais.tsx`)
A tela de Regras Operacionais atua como o motor primário dos cálculos das operações dentro do pipeline de processamento.

### Estrutura e Comportamento
- **Fluxo Guiado:** O formulário trabalha com perfis de contexto (`RuleContextProfile`). Dependendo do tipo de cálculo ou serviço, os requisitos operacionais se ajustam.
- **Regras Globais e de ISS:** O sistema identifica regras de ISS lexicalmente (`isIssRuleDefinition`). Quando aplicável globalmente, ela abdica de IDs restritivos (`empresa_id`, `fornecedor_id` etc.) facilitando a difusão na pipeline de processamento para qualquer origem.
- **Prevenção de Duplicatas:** Função interna encarregada de mascarar IDs contextuais para simplificar a view do usuário (`buildRuleDedupKey`), protegendo regras globais de sobreposições em views locais.

---

## 4. Tela Central de Operações (`OperacoesTableBlock.tsx`)
Nesta tela a pipeline ganha corpo de visualização, onde a etapa atual do processo fica mais próxima do Dashboard / Persistência.

### Arquitetura Dinâmica
- **Processamento Acoplado e Desacoplado:** Regras do negócio aplicadas sobre a UI (`applyBusinessRulesToForm`) são engatilhadas de modo interativo. Totalizações de filmes, aplicação de ISS, valores de descarga rodam ativamente no formulário, devendo no futuro utilizar a pipeline para prever as mesmas contas para o Encarregado de ponto sem reescrever nada.
- **Transações Dinâmicas (Massa e Singular):** Formulários recriam fluxogramas com base nos UUIDs em memória simulando edição em cadeia (`bulk actions`), cruzados ao dado original persistido e isolado da simulação atual (`linha_original`).
- **Modos de Pagamento:** Avaliações como a **Modalidade Financeira** ocorrem preferencialmente através da utilidade partilhada `classificarFinanceiro`, garantindo a integridade dos KPIs.

---

## 5. Custos Extras (`CustosExtrasTableBlock.tsx`)
Mantém similaridade com Operações mas exime-se das dependências verticais de cálculos encadeados por regras (ISS/Filme/Descarga). 

- Acesso rápido a alteração de estados (`Status de Pagamento`).
- Sistema de manipulações em lote (`bulk edit`) desacoplado de regras externas, baseado puramente na alteração das chaves originais.

---

## 6. Relação com Banco de Dados e Migrations
A segmentação na base é preparada para auditar a entrada da Pipeline:

- **Origem de Dado (`origem_dado`):** Um reflexo perfeito para a entrada assinalada (ex: `importacao`, `ajuste`, etc.). Identifica precisamente a gênese do dado em uma fila onde futuras APIs poderão preencher via `coletor_api`.
- **Trilha de Auditoria via JSON (`avaliacao_json`):** Campos críticos não processados em formato analítico puro (logs raw de uma planilha ou payloads estranhos) entram como JSON, preservando logs limpos sem contaminar o Schema.
- **Tenant Rigoroso (`empresa_id`):** O ERP preserva uma postura defensiva Multi-tenant. 

---

## 7. Checklist Global de Boas Práticas (Guia para Próximos Recursos)

Sempre que a aplicação tracionar novas fontes ou pipelines de dados, considere:

1. **Nunca mascare erros ou dependa de Mocks:**
   A skill de estabilização do projeto (`ProjectStabilizerSkill`) prescreve o tratamento da ausência de dados nativamente. Interfaces preparam-se pro forma real no *fallback*.
   
2. **Reuso da Pipeline (Uma Regra, Muitas Entradas):**
   A integração do Encarregado e do Backend de API CLT devem fatalmente usar os módulos como `applyBusinessRulesToForm` (via utilitários comuns) ou migrar a lógica pra uma interface compartilhada. O cálculo nunca se recria, apenas se referencia.
   
3. **Escopo Operacional Rígido (RLS / Roles):**
   Garanta nas API Layers e Políticas do Supabase que a origem dos dados (Encarregado, API) não vaze registros (`empresa_id` isolado por token).
   
4. **Histórico Seguro de Cálculos (Imutabilidade do Passado):**
   Com o acoplamento do Financeiro e Dashboards definitivos (`Atrasado`, `Caixa Imediato`), fechamentos operacionais **não devem recalcular o passado sob novas regras**. A estrutura deve ser capaz de criar *"Snapshots"* do evento assim que ele atinge a esteira final da pipeline, preservando sua integridade temporal.
