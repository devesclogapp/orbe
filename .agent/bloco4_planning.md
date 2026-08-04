# Bloco 4: Planejamento de Hardening — CNAB, Retorno e Conciliação

O pipeline financeiro de geração e baixa de remessas/retornos (CNAB240) é o último estágio crítico do ORBE. Atualmente, os controllers baseiam as segregações em `localStorage.getItem('esc-log-environment')` e processam IDs cruzados cegamente. O objetivo desta etapa é aplicar a mesma arquitetura "fail-closed" e estrita já testada nos módulos operacionais (Operações, Diaristas e Intermitentes).

## Objetivos (Conforme demandado)
- **Bloqueios Essenciais:** Impedir que CNAB PROD receba beneficiários HML (e vice-versa).
- **Tenant Isolation:** Impedir geração de arquivos misturando tenants.
- **Isolamento de Retorno:** Impedir que o arquivo `.ret` subido na aba PROD baixe um lote criado na aba HML.
- **UUID Cruzado:** Invalidar que UUIDs órfãos num Retorno forcem conciliação de faturas do ambiente oposto.

## Arquitetura de Correção (Service a Service)

### 1. `CNABBase.ts` (Coletor Base)
- **Riscos atuais:** `fetchLoteData` coleta `faturas` ou itens `rh_financeiro_lote_itens` com base solta na passagem de IDs, sem filtrar se os colaboradores ou faturas respeitam o `is_teste` ativo.
- **Ações:**
  - Integrar o `EnvironmentQueryFilter.applyEmpresaScope` para blindar a coleta de faturas.
  - O `contaBancariaId` deve ter o seu `empresa_id` validado rigorosamente via `EnvironmentService.assertEmpresaAllowed()`. Se tentar emitir CNAB PROD usando conta HML, abortar `ENVIRONMENT_MISMATCH`.

### 2. `cnabRemessaArquivo.service.ts` (Gerador de Arquivos)
- **Riscos atuais:** Usa `localStorage` de forma direta e estática para listar ou registrar remessas. Um lote HML poderia teoricamente ser validado visualmente e registrado como modo PRODUÇÃO porque o switch de UI injetou ou leu dados incorretos no payload.
- **Ações:**
  - Extrair a identificação do `modo` baseada na Empresa do lote a partir de uma consulta de segurança backend no momento de `registrar()`.
  - Refatorar `listar()` e `listarHistorico()`: ao invés de buscar a string `is_teste` em Javascript, encapsular todo o filtro de remessas com `EnvironmentQueryFilter`, cruzando as `contas_bancarias_empresa`. 
  - Antes do `INSERT` em `cnab_remessas_arquivos`, validar todos os `empresa_id` originários do lote vinculado.

### 3. `cnabRetorno.service.ts` (Importador .ret)
- **Riscos atuais:** `localizarRemessaRelacionada()` vasculha qualquer remessa com o mesmo Sequencial e Código do Banco. Se os sequenciais zeram na virada de implantação, um arquivo de teste poderia se conectar a um arquivo real de mesmo Sequencial e Agência.
- **Ações:**
  - Injetar o check de `tenant_id` via Supabase RLS ou explicitamente na query de localização de Remessas.
  - A query de busca da Remessa original precisa estar acoplada ao ambiente do Orbe atual. Se o usuário está em PROD, tentar baixar um arquivo HML vai resultar em "Arquivo Original não localizado na hierarquia produtiva".
  - Reforçar o `carregarFaturasRelacionadas()` para que, mesmo diante de Documentos CPF compatíveis, rejeite links com Faturas que pertençam a uma `empresa_id` invalidada pelo current environment.

### 4. `cnabConciliacao.service.ts` (Motor de Baixas)
- **Riscos atuais:** Executa `update` na API usando arrays de IDs (`itemPagoIds`) agrupados pelo crawler sem validar o `empresa_id` de origem das transações.
- **Ações:**
  - Adicionar restrições nas queries `.in('id', itemPagoIds)` para exigir que seus `empresa_id`s respeitem o ambiente ativo (ou falhem silently em vez de comprometer outros dados).

## Suite de Regressão Requerida
Será necessário adaptar ou estender `financial_segregation.test.ts` e `cnab_segregation.test.ts` com os seguintes cenários:
- `CNAB_GEN_01`: Reject CNAB creation for PROD instances when requested with an HML `conta_bancaria_id`.
- `CNAB_GEN_02`: Exclude HML workers from PROD `.rem` files natively.
- `CNAB_RET_01`: Reject applying HML `.ret` files during PROD session, maintaining original batch unbroken.
- `CNAB_RET_02`: Validate missing/null `banco_codigo` sanitation checks.

## Gate de Execução
Após a validação visual (Smoke Test) aprovar o Bloco 3, esse documento atuará como matriz de execução cirúrgica. 
Nenhuma refatoração geral desnecessária será efetuada — priorizamos injeção de segurança através do `EnvironmentService` sem quebrar assinaturas ativas de UI.
