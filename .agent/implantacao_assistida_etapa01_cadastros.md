# ERP ORBE — IMPLANTAÇÃO ASSISTIDA | ETAPA 1
## RELATÓRIO DE AUDITORIA DOS CADASTROS ESSENCIAIS

**Ambiente:** Supabase de Produção + ERP ORBE (`https://orbe-nu.vercel.app`)  
**Modo:** Somente Leitura (READ-ONLY) — Nenhuma alteração foi realizada no banco de dados  
**Data da Auditoria:** 03/11/2026  
**Veredito Final:** **APTO COM RESSALVAS**

---

## 1. RESUMO EXECUTIVO E QUANTITATIVO POR CATEGORIA

A auditoria direta e em modo somente leitura no banco de dados de produção do ERP ORBE identificou a seguinte volumetria cadastral:

| Categoria Cadastral | Total Cadastrado | Ativos | Inativos | Registros de Teste / Sintéticos | Status de Prontidão Operacional |
|---|:---:|:---:|:---:|:---:|---|
| **Empresas** | 10 | 10 | 0 | 1 (`Empresa Teste - Homologação`) | ⚠️ **Parcial** (9 departamentos sem CNPJ) |
| **Colaboradores** | 105 | 105 | 0 | 5 (base de homologação / onboarding) | ⚠️ **Ressalvas** (25 intermitentes sem CPF) |
| **Tipos de Serviço** | 4 | 3 | 1 | 0 | ✅ **Apto** (Descarga, Lavar Pátio, Conserto Palete) |
| **Transportadoras** | 1 | 1 | 0 | 0 | ⚠️ **Insuficiente** (apenas TransAraguaia) |
| **Fornecedores** | 1 | 1 | 0 | 1 (`Fornecedor Genérico Fictício`) | ⚠️ **Insuficiente** (nenhum fornecedor real) |
| **Produtos de Carga** | 2 | 2 | 0 | 1 (`Produto Genérico Fictício`) | ⚠️ **Insuficiente** (apenas "Rolon" real) |
| **Unidades Operacionais** | 0 | 0 | 0 | 0 | ⚠️ **Vazio** (tabela sem registros) |
| **Formas de Pagamento** | 5 | 5 | 0 | 0 | ✅ **Apto** (Mensal, PIX, Dinheiro, Débito, Boleto) |
| **Regras de Preço** | 1 | 1 | 0 | 0 | ⚠️ **Mínimo** (1 regra: Descarga TransAraguaia R$ 0,42) |
| **Jornadas de Trabalho** | 1 | 1 | 0 | 0 | ✅ **Apto** |

---

## 2. AUDITORIA DETALHADA POR CATEGORIA

### 2.1 Empresas

- **Total:** 10 empresas cadastradas no tenant.
- **Empresas Formais com CNPJ:** Apenas **1** empresa possui CNPJ (`Empresa Teste - Homologação`, CNPJ: `00000000000100`, marcada como `is_teste: true`).
- **Empresas Provenientes de Integrações (Sem CNPJ):** As outras **9 empresas** foram importadas automaticamente pelo TIO Digital (4) e RHID API (5). Seus nomes correspondem, na verdade, a **departamentos, turnos ou postos operacionais**, e não a pessoas jurídicas com CNPJ:
  1. `BENEVIDES` (19 colaboradores, origem: `tio_digital`, CNPJ: ausente)
  2. `Castanhal,Operacional` (2 colaboradores, origem: `tio_digital`, CNPJ: ausente)
  3. `DISMELO CASTANHAL` (17 colaboradores, origem: `rhid_api`, CNPJ: ausente)
  4. `Encarregado GARRA` (8 colaboradores, origem: `rhid_api`, CNPJ: ausente)
  5. `Escritório RH` (4 colaboradores, origem: `rhid_api`, CNPJ: ausente)
  6. `Evidencia Noite` (10 colaboradores, origem: `rhid_api`, CNPJ: ausente)
  7. `Evidencia Operacional` (26 colaboradores, origem: `rhid_api`, CNPJ: ausente)
  8. `Operacional Noturno` (3 colaboradores, origem: `rhid_api`, CNPJ: ausente)
  9. `Operacional,Castanhal` (1 colaborador, origem: `tio_digital`, CNPJ: ausente)
- **Duplicidade / Inversão Nominal:** Foi detectada duplicidade entre `Castanhal,Operacional` (id `32e359fc...`) e `Operacional,Castanhal` (id `2d67a910...`), geradas por inversão de vírgula na importação original.
- **Impacto:** Para o lançamento físico de carga pelo encarregado, selecionar "BENEVIDES" ou "DISMELO CASTANHAL" funciona perfeitamente. No entanto, para o faturamento financeiro (emissão de boleto, nota fiscal e DRE por CNPJ), a ausência de dados fiscais impedirá a cobrança formal.

---

### 2.2 Colaboradores

- **Total:** 105 colaboradores ativos.
- **Distribuição por Regime de Trabalho:**
  - **CLT:** 68 colaboradores (64,8%)
  - **Intermitentes:** 33 colaboradores (31,4%)
  - **Diaristas:** 3 colaboradores (2,9%)
  - **Outros:** 1 colaborador (`Ponto Dismelo`)
- **Distribuição por Empresa / Posto:**
  - `Evidencia Operacional`: 26
  - `BENEVIDES`: 19
  - `DISMELO CASTANHAL`: 17
  - `Empresa Teste - Homologação`: 10
  - `Evidencia Noite`: 10
  - `Encarregado GARRA`: 8
  - `Escritório RH`: 4
  - `Operacional Noturno`: 3
  - `Castanhal,Operacional`: 2
  - `Operacional,Castanhal`: 1
- **Inconsistências Identificadas:**
  1. **25 Colaboradores Intermitentes SEM CPF:** Dos 33 intermitentes, **25 não possuem CPF cadastrado** (ex: Anderson Othon, Carlos Henrique, Lucas Lopes, Luciano Sodre, Marcos Salomão, etc.).  
     *Aviso: CPFs ausentes impedem a geração de remessa bancária CNAB 240 e pagamentos eletrônicos no fechamento financeiro.*
  2. **3 Colaboradores SEM Empresa Vinculada (`empresa_id: null`):**
     - `Igor Braga de Melo` (CLT)
     - `Leonardo Sousa Da Silva` (CLT)
     - `Ponto Dismelo` (CLT)
  3. **2 Colaboradores com Empresa Órfã (Chave Estrangeira Inválida):**
     - `Diarista (Fictícia - Onboarding)` e `Encarregado Operacional (Fictício - Onboarding)` possuem `empresa_id = "9fcdb716-1ce5-4edc-a64a-6d1fc48ac169"`, que não existe na tabela `empresas`.
  4. **16 Colaboradores sem Matrícula:** Concentrados em intermitentes e usuários de teste.
  5. **1 Diarista sem Valor de Diária:** `Diarista (Fictícia - Onboarding)` sem `valor_diaria` ou `valor_base`.

---

### 2.3 Serviços e Parâmetros Operacionais

- **Tipos de Serviço Operacional (`tipos_servico_operacional`):**
  - `Descarga` (Ativo) — Código/Referência operacional para descarregamento.
  - `Lavar o Pátio` (Ativo) — Serviço operacional de pátio.
  - `Consertar palete` (Ativo) — Serviço operacional de manutenção.
  - `Descarga (Renomeado 4e79)` (Inativo) — Registro legado desativado.
- **Transportadoras Clientes (`transportadoras_clientes`):**
  - Apenas **1 transportadora** cadastrada: `TransAraguaia Logística Ltda` (id: `c688674b-d90f-42f7-ba58-705aecdb5c03`).
  - *Alerta:* Se a operação real for receber cargas de outras transportadoras, o encarregado não terá a transportadora disponível para seleção.
- **Fornecedores (`fornecedores`):**
  - Apenas **1 fornecedor** cadastrado: `Fornecedor Genérico (Fictício - Onboarding)`.
  - *Alerta:* Nenhum fornecedor industrial/comercial real (ex: Ambev, Mondelez, etc.) está cadastrado.
- **Produtos de Carga (`produtos_carga`):**
  - Cadastrados: `Rolon` (real) e `Produto Genérico (Fictício - Onboarding)`.
- **Unidades Operacionais (`unidades`):**
  - **0 unidades cadastradas** no banco de dados. A tabela encontra-se vazia.
- **Formas de Pagamento (`formas_pagamento_operacional`):**
  - 5 modalidades ativas: `Faturamento Mensal`, `Pix`, `Dinheiro`, `Débito`, `Boleto`.
- **Regras de Preço Operacional (`fornecedor_valores_servico`):**
  - Apenas **1 regra** cadastrada:
    - Serviço: `Descarga`
    - Transportadora: `TransAraguaia Logística Ltda`
    - Valor unitário: **R$ 0,42** por operação
    - Vigência ativa, abrangência global.
  - Para quaisquer outras combinações, o valor unitário precisará ser preenchido manualmente no ato do lançamento.

---

## 3. INTEGRIDADE DOS VÍNCULOS E RELACIONAMENTOS

| Relacionamento | Condição Auditada | Situação | Impacto Operacional |
|---|---|:---:|---|
| **Empresa → Colaborador** | 100 colaboradores vinculados a empresas válidas; 3 sem empresa; 2 com empresa órfã. | ⚠️ Ressalva | Os 3 sem empresa não aparecerão nos filtros por empresa do RH nem nas listas do encarregado. |
| **Operação → Empresa** | 15 operações existentes no banco; todas vinculadas a empresas válidas (`BENEVIDES` e `Empresa Teste`). | ✅ Consistente | Histórico preservado sem inconsistência de FK. |
| **Operação → Transportadora** | 15 operações utilizam a transportadora `TransAraguaia`. | ✅ Consistente | Nenhuma operação órfã de transportadora. |
| **Serviço → Regra de Cálculo** | 1 regra de preço amarrada ao serviço Descarga e TransAraguaia. | ⚠️ Parcial | Outros serviços e transportadoras não possuem precificação automática cadastrada. |
| **Lançamento → Reflexo Financeiro** | 15 operações avaliadas; status distribuídos entre `CONCLUIDO`, `AGUARDANDO_FATURAMENTO` e `RECEBIDO`. | ✅ Consistente | Fluxo financeiro integra com a tabela de contas a receber. |

---

## 4. VALIDAÇÃO DAS TELAS NO NAVEGADOR (CHROME E2E)

A auditoria visual foi executada em produção (`https://orbe-nu.vercel.app`) com Google Chrome real:

1. **Central de Cadastros (`/cadastros`):**
   - Carregamento instantâneo das abas: Empresas (10), Colaboradores (105), Coletores (0), Transportadoras (1), Fornecedores (1), Serviços (4) e Parâmetros.
   - Pesquisa textual e paginação funcionais.
   - Capturas de evidência salvas em `scratch/e2e_cadastros_captures/` (`cad_01` a `cad_06`).
2. **Regras Operacionais (`/regras-operacionais`):**
   - Listagem exibe a regra da TransAraguaia (R$ 0,42).
   - Abas dinâmicas de Diaristas, Meios de Pagamento e Taxas/Impostos operacionais.
   - Captura de evidência salva em `cad_07_regras_operacionais.png`.
3. **Barreiras de Segurança (RBAC):**
   - Usuário RH tentou acessar `/cadastros` -> Redirecionado para `/rh/aprovacoes`.
   - Usuário Encarregado tentou acessar `/cadastros` -> Redirecionado para `/producao`.
   - Capturas salvas em `cad_08_rh_cadastros_bloqueado.png` e `cad_09_encarregado_cadastros_bloqueado.png`.

---

## 5. CLASSIFICAÇÃO DAS INCONSISTÊNCIAS POR GRAVIDADE

### 🔴 Gravidade Alta (Impede Processamento Financeiro e Pagamentos)
1. **25 Intermitentes sem CPF:** Impossibilita o processamento de remessa bancária CNAB 240 para pagamento.
2. **Ausência de Transportadoras e Fornecedores Reais:** Se a primeira carga real for de transportadora diferente da `TransAraguaia`, o encarregado não conseguirá selecioná-la no formulário operacional.

### 🟡 Gravidade Média (Não Impede Lançamento, mas Gera Gargalo Administrativo)
3. **Empresas sem CNPJ e com Nomes de Departamentos:** Lançamentos operacionais serão registrados sob nomes como `BENEVIDES` ou `DISMELO CASTANHAL`. O faturamento externo precisará de dados fiscais formais.
4. **Duplicidade Nominal:** `Castanhal,Operacional` vs `Operacional,Castanhal`.
5. **3 Colaboradores sem Empresa:** Não serão filtrados por base operacional.
6. **2 Colaboradores Órfãos de Onboarding:** Apontando para empresa inexistente.
7. **Tabela de Unidades Vazia (0 registros):** Não há unidades operacionais específicas vinculadas.

### 🟢 Gravidade Baixa (Ajustes Evolutivos / Higienização)
8. **Registros Fictícios de Onboarding:** Empresa Teste, Diarista Fictícia, Fornecedor Genérico e Produto Genérico podem ser inativados/arquivados no decorrer da operação.
9. **Precificação Manual:** Por haver apenas 1 regra tabelada, o encarregado precisará conferir o valor unitário digitado.

---

## 6. PENDÊNCIAS QUE REALMENTE IMPEDEM LANÇAMENTOS REAIS

| Pendência | Bloqueia o Quê? | Como Destravar |
|---|---|---|
| **Falta de Transportadoras Reais** | O Encarregado registrar operação por volume se a carga for de transportadora não cadastrada. | O Administrador cadastrar as transportadoras ativas na Central de Cadastros antes do primeiro lançamento. |
| **Falta de Fornecedores Reais** | O Encarregado vincular o fornecedor de origem da mercadoria. | O Administrador cadastrar os fornecedores principais na Central de Cadastros. |
| **Falta de CPF dos Intermitentes** | O RH fechar lote e o Financeiro gerar CNAB para pagamento dos intermitentes. | O RH preencher os CPFs dos intermitentes que forem convocados para a escala da semana. |

---

## 7. PENDÊNCIAS RESOLVÍVEIS DURANTE A OPERAÇÃO ASSISTIDA

1. **Complemento Cadastral de Empresas:** Adicionar CNPJ, Razão Social e Inscrição Estadual nas empresas operacionais conforme as notas fiscais de serviço forem emitidas.
2. **Unificação de `Castanhal,Operacional` e `Operacional,Castanhal`:** Mover o colaborador da empresa invertida para a empresa principal e desativar o registro duplicado.
3. **Associação dos 3 Colaboradores sem Empresa:** Definir a empresa correta para Igor, Leonardo e Ponto Dismelo.
4. **Cadastramento Gradual da Tabela de Preços:** Inserir novas regras de preço conforme as negociações operacionais por cliente/transportadora forem formalizadas.

---

## 8. RECOMENDAÇÕES OBJETIVAS PARA A GESTÃO

1. **Ação Pré-Operação 1 (Admin):** Cadastrar na Central de Cadastros (`/cadastros`) as **Transportadoras** e os **Fornecedores** que operam nas bases Benevides e Castanhal.
2. **Ação Pré-Operação 2 (RH):** Para os colaboradores **Intermitentes** que forem trabalhar nesta primeira semana assistida, inserir o CPF no cadastro do colaborador.
3. **Ação Operacional (Encarregado):** O encarregado pode utilizar imediatamente o formulário de **Operação por Volume** selecionando as bases `BENEVIDES` ou `DISMELO CASTANHAL` e o serviço `Descarga`.

---

## 9. VEREDITO FINAL

> ### **STATUS: APTO COM RESSALVAS**
> O ERP ORBE está tecnicamente pronto e estável para receber o primeiro lançamento real da operação ESC LOG.  
> As ressalvas não impedem a abertura do sistema, mas exigem que o Administrador cadastre a Transportadora e o Fornecedor da carga antes do registro operacional do Encarregado, e que o RH complete os CPFs dos colaboradores escalados antes da geração do primeiro lote financeiro.

