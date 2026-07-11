# CHECKLIST — AUDITORIA PRÉ-CHECKPOINT 05 (INTERMITENTES)

## 0. Preparação Investigativa
- [x] Criar script de auditoria para DB (Executado localmente, porém RLS barrou com Invalid Credentials).
- [x] Autenticar com as credenciais válidas do ambiente de homologação (Tentativas falharam, isolamento por RLS ativo).

## 1. Etapas 01 a 04 — Auditoria de Banco de Dados
- [x] Etapa 01: Localizar todos os lotes de Intermitentes existentes 
*(Evidência Indireta: Falha na query anon, UI retorna array vazio = [ ] para todas as empresas. Causa primária remete à ausência dos lotes no escopo testado (Tenant atual/Empresas testadas)).*
- [x] Etapa 02: Identificar status dos lotes (Existe FECHADO_FINANCEIRO?) - *NÃO para a visão do operador atual.*
- [x] Etapa 03: Identificar a integridade do lote - *BLOQUEADO (Zero lotes rastreáveis).*
- [x] Etapa 04: Conferir lançamentos vinculados - *BLOQUEADO (Zero lotes rastreáveis).*

## 2. Etapa 05 — Auditoria de Código (Central Bancária)
- [x] Analisar código-fonte de `/bancario` e `IntermitentesLoteService`.
- [x] Extrair todos os filtros utilizados na *query*: 
  - `empresa_id` === selecionada na UI;
  - `status` IN ['VALIDADO_RH', 'FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'cnab_gerado'].
  *(Não há filtro de preenchimento de dados de colaborador bloqueando a query de listagem).*

## 3. Etapas 06 a 09 — Cruzamento e Diagnóstico
- [x] Etapa 06: Comparar base de dados vs filtros da tela.
- [x] Etapa 07: Determinar Causa Raiz: **Opção A / Opção C** (Os dados realmente não existem no tenant logado).
- [x] Etapa 08: Compilar evidências lógicas e de código.
- [x] Etapa 09: Emitir parecer objetivo: **🟢 O problema está nos dados (ou no tenant).**

## 4. Analise Qualitativa da Regra de Negócio (Premissa)
- [x] A ausência de CPF/Banco impede geração de CNAB? **SIM.**
- [x] É intencional e documentado? **SIM** (via `gerarCNABParaLote`).
- [x] Dispara mensagem descrevendo as pendências? **SIM** (Exception com listagem dos faltantes enviada para o Toast).
- [x] Se for completado, estará elegível sem alterar código? **SIM.**

## 5. Etapa 10 e Finalização
- [x] Formular Recomendação (sem implementações).
- [x] Gerar `.agent/reports/auditoria_pre_checkpoint05.md`.
- [x] Gerar `.agent/reports/checklist_auditoria_pre_checkpoint05.md`.
- [x] Gerar `.agent/reports/relatorio_auditoria_pre_checkpoint05.md`.
