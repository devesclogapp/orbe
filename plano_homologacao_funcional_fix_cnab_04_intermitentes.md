# ERP ORBE — FIX-CNAB-04
# PLANO DE HOMOLOGAÇÃO FUNCIONAL END-TO-END — INTERMITENTES
## Documento Oficial de Diagnóstico, Planejamento e Roteiro de Execução

**Data de Elaboração:** 15 de Outubro de 2026  
**Ambiente Alvo:** Projeto Supabase Oficial `lifgjtcflzmspilhryap` (Homologação Isolada)  
**Tenant Oficial:** `09ccafb6-2cf2-4c83-ac3d-a2913947693c`  
**Empresa de Teste:** `Empresa Teste - Homologação` (`28a560b5-37ef-403d-ae4f-b28a608b6a68` | `is_teste = true`)  
**Status do Documento:** DIAGNÓSTICO E PLANEJAMENTO CONCLUÍDOS — NENHUMA ALTERAÇÃO OU ESCRITA EXECUTADA

---

## 1. DIAGNÓSTICO DO FLUXO ATUAL

A auditoria do código-fonte e do banco de dados revelou a arquitetura completa do ciclo de vida dos intermitentes e a blindagem introduzida pelo **FIX-CNAB-04**.

### 1.1 Ciclo de Vida Operacional e Financeiro de Intermitentes

```text
Entrada Operacional (lancamentos_intermitentes)
  [status_pipeline = 'RECEBIDO' | lote_fechamento_id IS NULL]
       │
       ▼
Fechamento do Período (IntermitentesRecebidos.tsx -> IntermitentesLoteService.fecharPeriodo)
  [Cria intermitentes_lotes_fechamento: status = 'AGUARDANDO_VALIDACAO_RH']
  [Atualiza lancamentos_intermitentes: status_pipeline = 'EM_ANALISE_RH']
       │
       ▼
Validação de Governança RH (AprovacoesRh.tsx -> IntermitentesLoteService.validarLote)
  [Checagem estrita de completude cadastral/bancária: verificarCompletudeLote]
  [Atualiza intermitentes_lotes_fechamento: status = 'VALIDADO_RH']
  [Atualiza lancamentos_intermitentes: status_pipeline = 'APROVADO_RH']
  [Espelha em rh_financeiro_lotes: status = 'AGUARDANDO_FINANCEIRO']
       │
       ▼
Aprovação Financeira (CentralFinanceira.tsx / IntermitentesLotes.tsx -> IntermitentesLoteService.aprovarFinanceiro)
  [Atualiza intermitentes_lotes_fechamento: status = 'FECHADO_FINANCEIRO']
  [Atualiza lancamentos_intermitentes: status_pipeline = 'ENVIADO_FINANCEIRO']
  [Atualiza rh_financeiro_lotes: status = 'AGUARDANDO_PAGAMENTO']
       │
       ▼
Central Bancária (CentralBancariaIntermitentes.tsx)
  [Filtro por status: canGenerateCnabForStatus aceita 'FECHADO_FINANCEIRO' e 'AGUARDANDO_PAGAMENTO']
  [Botão "Gerar CNAB" habilitado]
       │
       ▼
Geração de Remessa CNAB Blindada (IntermitentesLoteService.gerarCNABParaLote)
  [Validação de ambiente: empresas.is_teste = true -> modo 'homologacao']
  [Geração do Relatório Canônico: ORBE_SIMULACAO_CNAB_V1 (não bancário)]
  [Chamada RPC Atômica com 14 parâmetros: rpc_registrar_cnab_remessa]
  [Persistência: cnab_remessas_arquivos + cnab_remessa_itens + cnab_auditoria_bancaria]
  [Transição de Lote: intermitentes_lotes_fechamento.status = 'CNAB_GERADO']
  [Download automático do arquivo de simulação não-bancário]
```

### 1.2 Mecanismos de Proteção e Blindagem do FIX-CNAB-04

1. **Assinatura Canônica da RPC com 14 Parâmetros:**
   - A função `public.rpc_registrar_cnab_remessa` substituiu todas as sobrecargas ambíguas anteriores, erradicando o erro `PGRST202`.
   - Permissão estrita: `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated;`.
2. **Autoridade Intrínseca de Ambiente (`is_teste`):**
   - O modo da remessa não depende da escolha do operador: é determinado exclusivamente por `empresas.is_teste`. Como a empresa de homologação possui `is_teste = true`, a remessa é forçada para `modo = 'homologacao'`.
   - Rejeição fail-closed se `p_modo` informado pelo cliente for incompatível.
3. **Bloqueio Total contra Arquivos FEBRABAN em Homologação:**
   - Varredura posicional linha a linha rejeita qualquer linha física de 240 caracteres iniciada por código de banco (`^[0-9]{3}`).
   - Em homologação, o arquivo deve conter exatamente a estrutura do relatório `ORBE_SIMULACAO_CNAB_V1`, com identificação na linha 1, declaração expressa de arquivo não-bancário e bloqueio de transmissão na linha 6, e trailer explícito `FIM_RELATORIO_SIMULACAO`.
4. **Sincronização Atômica de NSA e Integridade Criptográfica de Hash:**
   - O NSA é atribuído no banco pela função transacional `get_next_cnab_sequencial(...)`.
   - Caso o sequencial simulado divirja concorrentemente do sequencial oficial, a RPC reescreve atômica e internamente a linha 13 (`SEQUENCIAL_SIMULADO: <seq>`) e recalcula o hash oficial `SHA-256` sobre o texto final persistido em `conteudo_arquivo`.
5. **Anti-Duplicidade em 3 Níveis:**
   - *Nível 1 (Aplicação):* `checkDuplicate(hash)` e `checkIntermitentesLoteJaRemessado(loteId)`.
   - *Nível 2 (Transacional/RPC):* `SELECT ... FOR UPDATE` no lote pai, rejeição de hash repetido e verificação de lançamentos já vinculados em `cnab_remessa_itens`.
   - *Nível 3 (PostgreSQL DDL):* Três índices únicos parciais (`uq_cnab_remessas_intermitentes_ativo`, `uq_cnab_remessas_diaristas_ativo`, `uq_cnab_remessas_lote_clt_ativo`) e a trigger de imutabilidade `enforce_cnab_remessa_imutabilidade`.

---

## 2. TABELAS, SERVIÇOS, FUNÇÕES E TELAS ENVOLVIDOS

| Componente / Artefato | Tipo | Responsabilidade no Fluxo |
| :--- | :--- | :--- |
| `public.lancamentos_intermitentes` | Tabela | Armazena apurações de jornada e remuneração diária de intermitentes. |
| `public.intermitentes_lotes_fechamento` | Tabela | Lote agregador de intermitentes para ciclo de validação, aprovação e remessa. |
| `public.cnab_remessas_arquivos` | Tabela | Cabeçalho canônico das remessas geradas com hash, NSA, modo e conteúdo. |
| `public.cnab_remessa_itens` | Tabela | Vínculo individual de cada lançamento à remessa (`origem_tipo = 'INTERMITENTE'`). |
| `public.cnab_sequencial_controle` | Tabela | Controle de incremento atômico de sequencial NSA por conta bancária. |
| `public.cnab_auditoria_bancaria` | Tabela | Trilha de auditoria imutável dos eventos de geração bancária. |
| `public.contas_bancarias_empresa` | Tabela | Cadastro de contas pagadoras ativas vinculadas à empresa e ao tenant. |
| `public.colaboradores` | Tabela | Cadastro dos favorecidos (dados bancários, CPF, valor base e flag `is_teste`). |
| `rpc_registrar_cnab_remessa` | Função SQL (RPC) | Motor transacional com 14 parâmetros que orquestra a validação e persistência atômica. |
| `get_next_cnab_sequencial` | Função SQL | Gerador de sequencial atômico sem race condition. |
| `fn_guard_lancamentos_intermitentes_update` | Trigger SQL | Impede mutação direta de valores e desvios de status via client API. |
| `enforce_cnab_remessa_imutabilidade` | Trigger SQL | Garante a imutabilidade estrita dos registros de remessa gravados. |
| `IntermitentesLoteService` | Serviço TS | Regras de negócio de fechamento, aprovação RH, aprovação financeira e CNAB. |
| `CnabRemessaArquivoService` | Serviço TS | Wrapper do motor CNAB e integrador com a RPC `rpc_registrar_cnab_remessa`. |
| `simulacaoHomologacao.service.ts` | Serviço TS | Gerador do relatório canônico `ORBE_SIMULACAO_CNAB_V1`. |
| `IntermitentesRecebidos.tsx` | Tela Frontend | Interface operacional onde são filtrados os lançamentos e executado o fechamento. |
| `AprovacoesRh.tsx` | Tela Frontend | Interface de governança de RH para validação cadastral e aprovação do lote. |
| `CentralFinanceira.tsx` | Tela Frontend | Interface financeira para autorização de pagamento e liberação para CNAB. |
| `CentralBancariaIntermitentes.tsx` | Tela Frontend | Interface bancária para seleção da conta pagadora e disparo da geração CNAB. |

---

## 3. PRÉ-REQUISITOS CONFIRMADOS E PENDÊNCIAS

### 3.1 Pré-Requisitos Confirmados
1. Migração `20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql` aplicada com sucesso no Supabase oficial.
2. RPC canônica de 14 parâmetros ativa e com permissão concedida a `authenticated`.
3. Índices únicos parciais ativos contra concorrência e duplicidade.
4. Trigger de imutabilidade de remessas habilitada.
5. Remessas históricas NSA 8 (`b0ff6ec2-d99c-4089-8878-6732971bec44`) e NSA 9 (`8aebd6bc-d9d5-4a42-8ffa-1e2f4ef42543`) preservadas e intactas.
6. Lote pago histórico `INT-2026-10-9309` preservado e intacto.

### 3.2 Pendências Cadastrais a Verificar (Estritamente via Leitura)
Antes de cadastrar ou lançar os dados do teste, deve-se rodar consultas de conferência para assegurar:
1. **Conta Bancária Pagadora:** Confirmar a existência e o ID exato da conta bancária Itaú (341) vinculada à `Empresa Teste - Homologação` (`28a560b5-37ef-403d-ae4f-b28a608b6a68`) com `ativo = true`.
2. **Colaboradores de Teste:** Verificar se já existem 2 colaboradores fictícios de homologação com `is_teste = true`, vinculados à `Empresa Teste - Homologação`, com dados bancários completos incluindo `digito_conta` e `agencia_digito`.  
   *Nota Técnica Crítica:* Se o colaborador não possuir `digito_conta` ou `agencia_digito` preenchidos, o validador `IntermitentesLoteService.gerarCNABParaLote` bloqueia a geração com erro de dados bancários incompletos.
3. **Parâmetro de Conta na UI:** Observou-se no código de `CentralBancariaIntermitentes.tsx` (linhas 377–392) que a mutação `cnabMutation` passa os dados da conta em `empresaRemetente`, enquanto `contaBancariaId` é resolvido internamente por correspondência de dígitos ou fallback para `is_padrao`. A conta Itaú de homologação deve estar marcada como `is_padrao = true` ou ter seus dados correspondentes no cadastro para resolução determinística.

---

## 4. DADOS EXATOS PROPOSTOS PARA O CENÁRIO DE TESTE

O cenário foi desenhado para atender rigorosamente às diretrizes do usuário:
- **Respeito às regras reais de apuração de jornada e remuneração:** Os valores não são números arbitrários; derivam de horas trabalhadas e taxa horária configurada no colaborador (`RemuneracaoResolver.ts`).
- **Valores exatos solicitados:** Lançamento 1 = R$ 150,00 | Lançamento 2 = R$ 200,00 | Total = R$ 350,00.
- **Competência Segura:** Proposta a competência **`2026-11`** (período de 01/11/2026 a 07/11/2026), que não conflita com `2026-07` (NSA 9) nem com `2026-10` (lote pago histórico).

### 4.1 Identificação dos Favorecidos (Colaboradores de Teste)

| Campo | Colaborador Homologação 1 | Colaborador Homologação 2 |
| :--- | :--- | :--- |
| **Identificação** | `INT-HML-001` | `INT-HML-002` |
| **Nome** | Colaborador Intermitente HML Um | Colaborador Intermitente HML Dois |
| **Nome Completo** | Colaborador Intermitente HML Um | Colaborador Intermitente HML Dois |
| **CPF (fictício válido)** | `111.444.777-35` (apenas dígitos) | `222.555.888-46` (apenas dígitos) |
| **Matrícula** | `INT-HML-001` | `INT-HML-002` |
| **Empresa Vinculada** | Empresa Teste - Homologação (`28a560b5-...`) | Empresa Teste - Homologação (`28a560b5-...`) |
| **Tipo Colaborador** | `INTERMITENTE` | `INTERMITENTE` |
| **Modelo de Cálculo** | `INTERMITENTE` | `INTERMITENTE` |
| **Cargo** | Operador Logístico Intermitente | Operador Logístico Intermitente |
| **Taxa Horária (valor_hora)**| **R$ 25,00 / hora** | **R$ 25,00 / hora** |
| **Banco Favorecido** | `341` (Itaú Unibanco S.A.) | `341` (Itaú Unibanco S.A.) |
| **Agência / Dígito** | `0001` / `0` | `0001` / `0` |
| **Conta / Dígito** | `12345` / `6` | `67890` / `1` |
| **Tipo de Conta** | `corrente` | `corrente` |
| **Classificação de Teste** | `is_teste = true` | `is_teste = true` |

### 4.2 Lançamentos Operacionais de Jornada

| Campo | Lançamento 1 | Lançamento 2 |
| :--- | :--- | :--- |
| **Empresa** | Empresa Teste - Homologação | Empresa Teste - Homologação |
| **Colaborador** | INT-HML-001 | INT-HML-002 |
| **Data de Referência** | `2026-11-03` | `2026-11-04` |
| **Competência** | `2026-11` | `2026-11` |
| **Convocação** | `CONV-202611-01` | `CONV-202611-02` |
| **Horas Trabalhadas** | **6,00 horas** (08:00 às 14:00) | **8,00 horas** (08:00 às 17:00, 1h intervalo) |
| **Horas Normais** | 6,00 horas | 8,00 horas |
| **Horas Extras (50% / 100%)**| 0,00 | 0,00 |
| **Hora Noturna** | 0,00 | 0,00 |
| **Fórmula de Cálculo** | 6h × R$ 25,00/h | 8h × R$ 25,00/h |
| **Valor Total Calculado** | **R$ 150,00** | **R$ 200,00** |
| **Status Pipeline Inicial** | `RECEBIDO` | `RECEBIDO` |
| **Vínculo Inicial com Lote** | `NULL` | `NULL` |

### 4.3 Totalizadores do Lote Proposto
- **Quantidade de Lançamentos:** 2
- **Quantidade de Colaboradores:** 2
- **Total de Horas Apuradas:** 14,00 horas
- **Valor Total Bruto e Líquido:** **R$ 350,00**
- **Modalidade:** Intermitentes
- **Competência Oficial:** `2026-11`
- **Conta Pagadora de Homologação:** Itaú Unibanco (341), Agência `0000`, Conta `00000-0`, vinculada à empresa `28a560b5-37ef-403d-ae4f-b28a608b6a68`.

---

## 5. SEQUÊNCIA OPERACIONAL PELA INTERFACE DO ORBE

Uma vez autorizado o cadastro da massa de teste, o operador executará o fluxo estritamente visual pelas telas do ERP ORBE, sem intervenção direta no banco:

```text
[Passo 1: Seleção de Ambiente]
  Topo da aplicação -> Seletor de Ambiente -> Selecionar "Homologação (Testes)".
       │
[Passo 2: Recepção Operacional e Fechamento]
  Navegar para: Operacional -> Intermitentes Recebidos (/operacional/intermitentes-recebidos).
  Filtros: Empresa = "Empresa Teste - Homologação", Mês = "Novembro", Ano = "2026".
  Conferência: Localizar os 2 lançamentos (R$ 150,00 e R$ 200,00 | Total R$ 350,00).
  Ação: Clicar no botão "Fechar Período".
  Resultado: Criação do lote com status "Aguardando Validação RH".
       │
[Passo 3: Validação de Governança RH]
  Navegar para: RH -> Aprovações RH (/rh/aprovacoes).
  Filtros: Aba "Intermitentes".
  Conferência: Lote de 2 registros e R$ 350,00 em análise.
  Ação: Clicar em "Validar Lote".
  Resultado: Status avança para "Validado RH"; espelho financeiro criado em rh_financeiro_lotes.
       │
[Passo 4: Aprovação Financeira]
  Navegar para: Financeiro -> Central Financeira (/financeiro/central-financeira) ou Detalhes do Lote.
  Conferência: Lote de Intermitentes liberado para conferência de despesa.
  Ação: Clicar em "Aprovar Financeiro".
  Resultado: Status operacional avança para "FECHADO_FINANCEIRO" (liberado para CNAB).
       │
[Passo 5: Central Bancária e Disparo CNAB]
  Navegar para: Financeiro -> Central Bancária -> Intermitentes (/financeiro/central-bancaria).
  Filtros: Empresa = "Empresa Teste - Homologação", Competência = "2026-11".
  Conferência: O lote aparece na tabela com badge "Pronto para CNAB" e botão "Gerar CNAB" visível.
  Ação: Clicar em "Gerar CNAB".
  No Modal:
    - Selecionar a Conta Bancária Cadastrada: Itaú (341).
    - Verificar que o motor multibanco reconhece: "Itaú (341) — SISPAG".
    - Clicar em "Gerar e Baixar CNAB".
       │
[Passo 6: Verificação de Download e Transição de Tela]
  Resultado Imediato:
    - Toast de sucesso: "CNAB240 gerado com sucesso! Arquivo: SIMULACAO_HOMOLOGACAO_ITAU_..._SEQ000010.txt".
    - Download automático do arquivo de simulação (.txt).
    - Status do lote na Central Bancária transita imediatamente para "CNAB Gerado" (azul).
    - O botão "Gerar CNAB" desaparece da linha do lote.
       │
[Passo 7: Teste de Anti-Duplicidade Visual]
  Tentar reabrir o modal ou submeter nova remessa para o mesmo lote.
  Resultado Esperado: Ação bloqueada pelo frontend ou rejeição transacional pela RPC com mensagem de duplicidade.
```

---

## 6. CONSULTAS SQL DE LEITURA (VERIFICAÇÃO E AUDITORIA)

As consultas abaixo são **estritamente de leitura (`SELECT`)** e podem ser executadas imediatamente no SQL Editor do Supabase para diagnosticar o ambiente atual e validar os resultados após o teste:

### Consulta 1: Verificação da Integridade Histórica Protegida (NSA 8, NSA 9 e Lote 9309)
```sql
-- 1. Verificar Remessas Históricas Preservadas (NSA 8 CLT e NSA 9 Intermitentes)
SELECT 
    id AS remessa_id,
    sequencial_arquivo AS nsa,
    modo,
    status,
    total_registros,
    total_valor,
    banco_codigo,
    nome_arquivo,
    hash_arquivo,
    intermitentes_lote_id,
    lote_id,
    data_geracao
FROM public.cnab_remessas_arquivos
WHERE id IN (
    'b0ff6ec2-d99c-4089-8878-6732971bec44', -- NSA 8 CLT
    '8aebd6bc-d9d5-4a42-8ffa-1e2f4ef42543'  -- NSA 9 Intermitentes
)
ORDER BY sequencial_arquivo ASC;

-- 2. Verificar Lote Pago Histórico INT-2026-10-9309
SELECT 
    id,
    tenant_id,
    empresa_id,
    competencia,
    quantidade_registros,
    valor_total,
    status,
    paid_at
FROM public.intermitentes_lotes_fechamento
WHERE id = '930915d6-cb8f-4739-8001-7fa49d3009e4'
   OR competencia = '2026-10';
```

### Consulta 2: Verificação da Empresa e Conta Bancária Pagadora de Homologação
```sql
-- 1. Dados e Classificação da Empresa de Teste
SELECT 
    id,
    tenant_id,
    nome,
    cnpj,
    status,
    is_teste
FROM public.empresas
WHERE id = '28a560b5-37ef-403d-ae4f-b28a608b6a68';

-- 2. Contas Bancárias Ativas da Empresa de Homologação
SELECT 
    id AS conta_bancaria_id,
    empresa_id,
    banco_codigo,
    banco_nome,
    agencia,
    agencia_digito,
    conta,
    conta_digito,
    convenio,
    ativo,
    is_padrao,
    cedente_cnpj,
    cedente_nome
FROM public.contas_bancarias_empresa
WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND tenant_id = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';

-- 3. Sequencial Atual de Remessa da Conta
SELECT 
    conta_bancaria_id,
    banco_codigo,
    ultimo_sequencial,
    updated_at
FROM public.cnab_sequencial_controle
WHERE conta_bancaria_id IN (
    SELECT id FROM public.contas_bancarias_empresa 
    WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
);
```

### Consulta 3: Verificação de Colaboradores Fictícios Aptos
```sql
-- Verificar existência e completude de colaboradores vinculados à empresa de homologação
SELECT 
    id,
    matricula,
    nome,
    cpf,
    tipo_colaborador,
    tipo_contrato,
    cargo,
    valor_hora,
    valor_base,
    banco_codigo,
    agencia,
    agencia_digito,
    conta,
    digito_conta,
    tipo_conta,
    status,
    is_teste
FROM public.colaboradores
WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND tenant_id = '09ccafb6-2cf2-4c83-ac3d-a2913947693c'
ORDER BY created_at DESC;
```

### Consulta 4: Verificação de Inexistência de Conflito na Competência `2026-11`
```sql
-- Garantir que a competência 2026-11 está totalmente limpa antes do teste
SELECT 'lancamentos_intermitentes' AS tabela, count(*) AS registros
FROM public.lancamentos_intermitentes
WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND competencia = '2026-11'
UNION ALL
SELECT 'intermitentes_lotes_fechamento', count(*)
FROM public.intermitentes_lotes_fechamento
WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND competencia = '2026-11'
UNION ALL
SELECT 'cnab_remessas_arquivos', count(*)
FROM public.cnab_remessas_arquivos
WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND competencia = '2026-11';
```

### Consulta 5: Verificação Pós-Execução da Remessa (Validação do FIX-CNAB-04)
```sql
-- 1. Conferência da Remessa Gerada (Modo, NSA, Hash e Conteúdo)
SELECT 
    r.id AS remessa_id,
    r.sequencial_arquivo AS nsa_gerado,
    r.modo,
    r.status,
    r.total_registros,
    r.total_valor,
    r.banco_codigo,
    r.nome_arquivo,
    r.hash_arquivo,
    r.intermitentes_lote_id,
    r.competencia,
    r.data_geracao,
    left(r.conteudo_arquivo, 120) AS cabecalho_arquivo,
    right(r.conteudo_arquivo, 140) AS rodape_arquivo
FROM public.cnab_remessas_arquivos r
WHERE r.empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND r.intermitentes_lote_id IS NOT NULL
ORDER BY r.data_geracao DESC
LIMIT 1;

-- 2. Conferência dos Itens da Remessa (Rastreabilidade aos Lançamentos)
SELECT 
    cri.id AS item_remessa_id,
    cri.remessa_id,
    cri.origem_tipo,
    cri.origem_id AS lancamento_intermitente_id,
    cri.valor,
    cri.status,
    li.nome_colaborador,
    li.cpf_colaborador,
    li.data_referencia,
    li.horas_trabalhadas,
    li.total AS valor_lancamento
FROM public.cnab_remessa_itens cri
JOIN public.lancamentos_intermitentes li ON li.id = cri.origem_id
WHERE cri.remessa_id = (
    SELECT id FROM public.cnab_remessas_arquivos 
    WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
      AND intermitentes_lote_id IS NOT NULL
    ORDER BY data_geracao DESC LIMIT 1
);

-- 3. Conferência da Atualização do Lote Pai
SELECT 
    id AS lote_id,
    status AS lote_status,
    quantidade_registros,
    valor_total,
    updated_at
FROM public.intermitentes_lotes_fechamento
WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND competencia = '2026-11';

-- 4. Conferência do Log de Auditoria Bancária Imutável
SELECT 
    id,
    arquivo_id,
    acao,
    usuario_nome,
    detalhes,
    created_at
FROM public.cnab_auditoria_bancaria
WHERE arquivo_id = (
    SELECT id FROM public.cnab_remessas_arquivos 
    WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
      AND intermitentes_lote_id IS NOT NULL
    ORDER BY data_geracao DESC LIMIT 1
);
```

---

## 7. RISCOS E MEDIDAS DE ISOLAMENTO

| Risco Mapeado | Impacto Potencial | Medida Técnica de Mitigação Implementada |
| :--- | :--- | :--- |
| **Geração inadvertida de arquivo bancário CNAB240 transmissível** | Envio acidental de remessa de homologação ao banco real | **Bloqueio Estrutural:** Em `is_teste = true`, o gerador produz exclusivamente `ORBE_SIMULACAO_CNAB_V1`. A RPC valida linha a linha e aborta se encontrar linhas de 240 chars com prefixo numérico de banco. Funções de download bancário real bloqueiam modo `homologacao`. |
| **Contaminação de dados de produção** | Misturar registros de homologação em relatórios ou pagamentos de produção | **Segregação Canônica:** `EnvironmentQueryFilter.applyEmpresaScope` segrega consultas por ambiente. A RPC exige correspondência estrita `c.is_teste = v_is_teste` para cada item (Fail-Closed). |
| **Avanço indevido do sequencial NSA da conta bancária de produção** | Rompimento da sequência de arquivos bancários reais | **Isolamento de Conta:** A homologação utiliza exclusivamente a conta bancária da `Empresa Teste - Homologação`. O controle sequencial em `cnab_sequencial_controle` é particionado por `(tenant_id, conta_bancaria_id)`. |
| **Alteração ou corrupção de remessas históricas (NSA 8 e 9)** | Quebra de governança e histórico de auditoria | **Imutabilidade e Índices Parciais:** A trigger `enforce_cnab_remessa_imutabilidade` impede qualquer modificação nos registros já inseridos. O novo lote terá seu próprio UUID e competência independente. |
| **Impacto em integrações externas (Tio Digital, n8n)** | Execuções externas interferirem no teste ou receberem webhooks indevidos | **Isolamento de Origem:** Os lançamentos de homologação não dependem de disparo do coletor físico nem do n8n; serão lançamentos identificados para a empresa de teste sem acionar edge functions externas de produção. |

---

## 8. ESTRATÉGIA DE LIMPEZA CIRÚRGICA (SEM EXECUÇÃO)

Caso seja necessário remover os dados criados especificamente para este teste após a homologação, a limpeza deverá ser cirúrgica, estrita e respeitar a ordem de dependências relacionais, **sem jamais tocar nas remessas históricas NSA 8, NSA 9 ou lote 9309**:

```sql
-- RASCUNHO DE LIMPEZA CIRÚRGICA — NÃO EXECUTAR NESTA ETAPA
-- Escopo exclusivo: registros de competência '2026-11' da Empresa Teste - Homologação
BEGIN;

-- 1. Excluir itens da remessa de teste (2026-11)
DELETE FROM public.cnab_remessa_itens
WHERE remessa_id IN (
    SELECT id FROM public.cnab_remessas_arquivos
    WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
      AND competencia = '2026-11'
);

-- 2. Excluir auditoria bancária da remessa de teste (2026-11)
DELETE FROM public.cnab_auditoria_bancaria
WHERE arquivo_id IN (
    SELECT id FROM public.cnab_remessas_arquivos
    WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
      AND competencia = '2026-11'
);

-- 3. Excluir a remessa de teste (2026-11)
DELETE FROM public.cnab_remessas_arquivos
WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND competencia = '2026-11';

-- 4. Excluir lançamentos intermitentes de teste (2026-11)
DELETE FROM public.lancamentos_intermitentes
WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND competencia = '2026-11';

-- 5. Excluir lote de fechamento de teste (2026-11)
DELETE FROM public.intermitentes_lotes_fechamento
WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND competencia = '2026-11';

-- 6. Excluir espelho financeiro em rh_financeiro_lotes se gerado (2026-11)
DELETE FROM public.rh_financeiro_lote_itens
WHERE lote_id IN (
    SELECT id FROM public.rh_financeiro_lotes
    WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
      AND competencia = '2026-11'
      AND tipo = 'INTERMITENTES'
);

DELETE FROM public.rh_financeiro_lotes
WHERE empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND competencia = '2026-11'
  AND tipo = 'INTERMITENTES';

COMMIT;
```

---

## 9. CRITÉRIOS OBJETIVOS DE APROVAÇÃO E REPROVAÇÃO

### Teste A — Elegibilidade e Visibilidade na Central Bancária
- **Critério de Aprovação:** O lote de intermitentes avança pelo pipeline (`AGUARDANDO_VALIDACAO_RH` -> `VALIDADO_RH` -> `FECHADO_FINANCEIRO`), passa a figurar na Central Bancária de Intermitentes com os dados de favorecidos (2 colaboradores), totalizadores (14h, R$ 350,00), badge "Pronto para CNAB" e botão "Gerar CNAB" funcional.
- **Critério de Reprovação:** Lote ausente, status divergente, botão desabilitado ou valores discordantes.

### Teste B — Simulação Segura e Bloqueio Bancário
- **Critério de Aprovação:** Ao disparar a geração, o sistema gera o arquivo no formato canônico `ORBE_SIMULACAO_CNAB_V1`, sem linhas posicionais FEBRABAN de 240 caracteres. O download local do arquivo de texto corresponde exatamente ao texto gravado no banco de dados.
- **Critério de Reprovação:** Geração de arquivo bancário CNAB240 real em homologação ou divergência entre o arquivo baixado e o banco.

### Teste C — Persistência Atômica e Rastreabilidade
- **Critério de Aprovação:** A execução grava 1 registro em `cnab_remessas_arquivos` com `modo = 'homologacao'`, `intermitentes_lote_id` preenchido, `sequencial_arquivo` sequencial e correto, hash `SHA-256` idêntico ao conteúdo, 2 registros vinculados em `cnab_remessa_itens`, transição atômica do lote pai para `CNAB_GERADO`, e gravação do log em `cnab_auditoria_bancaria`.
- **Critério de Reprovação:** Falha de RPC, gravação parcial, valores nulos em chaves relacionais ou status do lote inalterado.

### Teste D — Anti-Duplicidade e Concorrência
- **Critério de Aprovação:** Uma nova tentativa de gerar remessa para o mesmo lote é sumariamente bloqueada pelo sistema (frontend e backend), sem consumir novo sequencial NSA e sem criar registros órfãos.
- **Critério de Reprovação:** Consumo de segundo NSA para o mesmo lote ou geração de remessa concorrente.

### Teste E — Integridade Histórica Estrita
- **Critério de Aprovação:** As remessas históricas NSA 8 (`b0ff6ec2-d99c-4089-8878-6732971bec44`) e NSA 9 (`8aebd6bc-d9d5-4a42-8ffa-1e2f4ef42543`) permanecem 100% inalteradas em seus valores, itens e hashes. O lote pago `INT-2026-10-9309` permanece intacto.
- **Critério de Reprovação:** Qualquer mutação em registros históricos anteriores.

---

## 10. PARECER CONCLUSIVO

### **PARECER: APTO PARA CRIAR O CENÁRIO DE TESTE (MEDIANTE AUTORIZAÇÃO)**

**Justificativa Técnica:**
1. A arquitetura do FIX-CNAB-04 está completamente consolidada e blindada no banco de dados Supabase e no frontend React.
2. A migração oficial garante prevenção contra concorrência por índices parciais únicos e imutabilidade por trigger ativa.
3. O fluxo funcional de ponta a ponta (Operacional -> RH -> Financeiro -> Central Bancária) foi 100% mapeado e as condições de status (`FECHADO_FINANCEIRO` / `canGenerateCnabForStatus`) estão alinhadas entre backend e frontend.
4. O isolamento de ambiente (`is_teste = true`), a integridade dos totalizadores e o cálculo realista de jornada por taxa horária (14h / R$ 350,00) garantem que nenhum dado de produção, sequencial bancário real ou histórico anterior (NSA 8, NSA 9, Lote 9309) sofrerá qualquer interferência.
5. As consultas de diagnóstico e checagem prévia foram formalizadas e estão prontas para execução.

**Aguardando autorização expressa do usuário antes de realizar qualquer inserção na base oficial.**
