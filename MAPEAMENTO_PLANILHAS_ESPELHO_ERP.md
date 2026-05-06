# MAPEAMENTO DE TELAS, TABELAS E COLUNAS PARA PLANILHAS ESPELHO

## ERP ESC LOG - Mapeamento Completo para Importação de Dados

---

## Visão Geral

Este documento mapeia todas as telas do ERP ESC LOG que permitem cadastro ou recebem dados, identificando:

- Tabelas do Supabase utilizadas
- Colunas reais de cada tabela
- Campos exibidos na interface
- Campos importáveis via planilha
- Campos técnicos que DEVEM ser ignorados
- Relacionamentos entre tabelas
- Regras de validação

---

## Tabela Resumo

| Tela | Rota | Componente | Tabela Principal | Tipo de Dado | Importação | Nome do Modelo |
|------|-----|-----------|--------------|-------------|-----------|----------|-------------|
| Operações Recebidas | /operacional/operacoes | Operacoes.tsx | operacoes_producao | Operações/logísticas | ✅ Recomendado | modelo_operacoes_recebidas.xlsx |
| Pontos Recebidos | /operacional/pontos | Pontos.tsx | registros_ponto | Ponto/jornada | ✅ Recomendado | modelo_pontos_recebidos.xlsx |
| Diaristas Recebidos | /rh/diaristas | RhDiaristasPainel.tsx | lancamentos_diaristas | Diaristas | ✅ Recomendado | modelo_diaristas_recebidos.xlsx |
| Banco de Horas | /banco-horas | PainelGeral.tsx | banco_horas_eventos | SaldoBH | ✅ Recomendado | modelo_banco_horas.xlsx |
| Regras de Banco | /banco-horas/regras | Regras.tsx | banco_horas_regras | RegrasBH | ✅ Recomendado | modelo_banco_horas_regras.xlsx |
| Regras Operacionais | /cadastros/regras-operacionais | RegrasOperacionais.tsx | fornecedor_valores_servico | RegrasValor | ✅ Recomendado | modelo_regras_operacionais.xlsx |
| Fechamentos | /fechamento | Fechamento.tsx | ciclos_diaristas | Fechamento | Parcial | modelo_fechamentos.xlsx |
| Colaboradores | /colaboradores | Colaboradores.tsx | colaboradores | Cadastro | ✅ Recomendado | modelo_colaboradores.xlsx |
| Empresas | /empresas | Empresas.tsx | empresas | Cadastro | ⚠️ Restrito | modelo_empresas.xlsx |
| Coletores | /coletores | Coletores.tsx | coletores | Cadastro | ⚠️ Restrito | modelo_coletores.xlsx |
| Transportadoras | /transportadoras | Transportadoras.tsx | transportadoras_clientes | Cadastro | ✅ Recomendado | modelo_transportadoras.xlsx |
| Fornecedores | /fornecedores | Fornecedores.tsx | fornecedores | Cadastro | ✅ Recomendado | modelo_fornecedores.xlsx |
| Serviços | /servicos | Servicos.tsx | tipos_servico_operacional | Cadastro | ⚠️ Restrito | modelo_servicos.xlsx |
| Central Cadastros | /cadastros | CentralCadastros.tsx | múltiplas | Misto | N/A | - |

---

## Detalhamento por Tela

---

### 1. Operações Recebidas

**Rota:** `/operacional/operacoes`
**Componente:** `src/pages/Operacoes.tsx`
**Serviço:** `OperacaoProducaoService` (via base.service.ts)
**Tabela Principal:** `operacoes_producao`
**Tabela Legada:** `operacoes` (para compatibilidade)

#### Tabela: operacoes_producao

| Coluna Banco | Tipo | Obrigatório | Importável | Calculado | Descrição |
|-------------|------|------------|-----------|----------|----------|----------|
| id | UUID | SIM | NÃO | NÃO | Chave primária automática |
| tenant_id | UUID | SIM | NÃO | NÃO | Preenchido pelo sistema (RLS) |
| empresa_id | UUID | SIM | NÃO* | NÃO | ID da empresa (lookup por nome) |
| unidade_id | UUID | NÃO | NÃO* | NÃO | ID da unidade |
| data_operacao | DATE | SIM | SIM | NÃO | Data da operação (YYYY-MM-DD) |
| tipo_servico_id | UUID | SIM | NÃO* | NÃO | ID tipo serviço (lookup por nome) |
| colaborador_id | UUID | SIM | NÃO* | NÃO | ID colaborador (encarregado) |
| entrada_ponto | TIME | NÃO | SIM | NÃO | Horário entrada ponto |
| saida_ponto | TIME | NÃO | SIM | NÃO | Horário saída ponto |
| transportadora_id | UUID | SIM | NÃO* | NÃO | ID transportadora (lookup por nome) |
| fornecedor_id | UUID | SIM | NÃO* | NÃO | ID fornecedores (lookup por nome) |
| produto_carga_id | UUID | NÃO | NÃO* | NÃO | ID produto carga |
| quantidade | NUMERIC(15,2) | SIM | SIM | NÃO | Quantidade volumes |
| valor_unitario_snapshot | NUMERIC(15,4) | SIM | SIM | NÃO | Valor unitário (snapshot) |
| tipo_calculo_snapshot | TEXT | SIM | NÃO | NÃO | Tipo: volume/fixo/colaborador |
| valor_total | NUMERIC(15,2) | SIM | NÃO | SIM | Quantidade × Valor unitário |
| forma_pagamento_id | UUID | NÃO | NÃO* | NÃO | ID forma pagamento |
| placa | TEXT | NÃO | SIM | NÃO | Placa veículo |
| status | TEXT | SIM | NÃO | NÃO | pendente/processado/fechado |
| nf_numero | TEXT | NÃO | SIM | NÃO | Número NF |
| ctrc | TEXT | NÃO | SIM | NÃO | Número CTRC |
| percentual_iss | NUMERIC | NÃO | SIM | NÃO | Percentual ISS |
| valor_descarga | NUMERIC | NÃO | SIM | NÃO | Valor descarga |
| custo_com_iss | NUMERIC | NÃO | SIM | NÃO | Custo com ISS |
| avaliacao_json | JSONB | NÃO | NÃO | NÃO | Contexto operacional |
| origem_dado | TEXT | SIM | NÃO | NÃO | manual/api/importacao |
| criado_por | UUID | NÃO | NÃO | NÃO | auth.uid() automático |
| criado_em | TIMESTAMPTZ | NÃO | NÃO | NÃO | now() automático |
| atualizado_em | TIMESTAMPTZ | NÃO | NÃO | NÃO | Trigger automático |

#### Campos Técnicas (IGNORAR na Planilha):

- id, tenant_id, empresa_id (usar nome), unidade_id, tipo_servico_id
- colaborador_id, transportadora_id, fornecedor_id, produto_carga_id, forma_pagamento_id
- valor_total, status, origem_dado, criado_por, criado_em, atualizado_em, avaliacao_json

#### Modelo de Planilha Sugerido:

**Arquivo:** `modelo_operacoes_recebidas.xlsx`

| Campo na Planilha | Tipo | Obrigatório | Observação |
|-----------------|------|------------|------------|
| data_operacao | DATA | SIM | Formato: DD/MM/AAAA ou YYYY-MM-DD |
| empresa | TEXTO | SIM | Nome exato do cadastro |
| tipo_servico | TEXTO | SIM | Descarga/Carga/Transbordo/etc |
| fornecedor | TEXTO | SIM | Nome do fornecedor |
| transportadora | TEXTO | SIM | Nome da transportadora |
| entrada_ponto | HORA | NÃO | Formato: HH:mm |
| saida_ponto | HORA | NÃO | Formato: HH:mm |
| quantidade | NÚMERO | SIM | Quantidade volumes |
| valor_unitario | MOEDA | SIM | R$ 0,00 |
| placa | TEXTO | NÃO | Placa veículo |
| nf_numero | TEXTO | NÃO | Número NF |
| ctrc | TEXTO | NÃO | Número CTRC |
| observacao | TEXTO | NÃO | Campo livre |

#### Relacionamentos:

- empresa_id → empresas(id)
- unidade_id → unidades(id)
- tipo_servico_id → tipos_servico_operacional(id)
- transportadora_id → transportadoras_clientes(id)
- fornecedor_id → fornecedores(id)
- produto_carga_id → produtos_carga(id)
- Forma pagamento → formas_pagamento_operacional(id)

#### Regras de Validação:

-Data não pode ser futura
- Quantidade > 0
- Se entrada_ponto informada, saida_ponto deve ser >= entrada_po
- Empresa, fornecedor e transportadora devem existir no cadstro
- Valor total calculado automaticamente (quantidade × valor_unitario)

---

### 2. Pontos Recebidos

**Rota:** `/operacional/pontos`
**Componente:** `src/pages/Pontos.tsx`
**Serviço:** `PontoService` (base.service.ts)
**Tabela Principal:** `registros_ponto`

#### Tabela: registros_ponto

| Coluna Banco | Tipo | Obrigatório | Importável | Calculado | Descrição |
|-------------|------|------------|-----------|----------|----------|
| id | UUID | SIM | NÃO | NÃO | Chave primária |
| tenant_id | UUID | SIM | NÃO | NÃO | Preenchido automático |
| colaborador_id | UUID | SIM | NÃO* | NÃO | ID colaborador (lookup) |
| empresa_id | UUID | SIM | NÃO* | NÃO | ID empresa |
| data | DATE | SIM | SIM | NÃO | Data registro |
| entrada | TIME | NÃO | SIM | NÃO | Entrada trabalho |
| saida_almoco | TIME | NÃO | SIM | NÃO | Saída almoço |
| retorno_almoco | TIME | NÃO | SIM | NÃO | Retorno almoço |
| saida | TIME | N��O | SIM | NÃO | Saída final |
| periodo | TEXT | NÃO | SIM | NÃO | Diurno/Noturno |
| tipo_dia | TEXT | NÃO | SIM | NÃO | Normal/Domingo/Feriado |
| horas_trabalhadas | NUMERIC | NÃO | NÃO | SIM | Calculado pelo sistema |
| horas_extras | NUMERIC | NÃO | NÃO | SIM | Calculado pelo sistema |
| falta | BOOLEAN | NÃO | NÃO | NÃO | Indicador falta |
| justificativa | TEXT | NÃO | SIM | NÃO | Motivo falta/ajuste |
| status | TEXT | NÃO | NÃO | ok/pendente/inconsistente |
| created_at | TIMESTAMPTZ | NÃO | NÃO | NOW() automático |
| updated_at | TIMESTAMPTZ | NÃO | NÃO | Trigger automático |

#### Campos Técnicos (IGNORAR):

- id, tenant_id, empresa_id (usar nome), colaborador_id (usar nome)
- horas_trabalhadas, horas_extras, falta, status, created_at, updated_at

#### Modelo de Planilha:

**Arquivo:** `modelo_pontos_recebidos.xlsx`

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| data | DATA | SIM |
| colaborador | TEXTO | SIM |
| empresa | TEXTO | SIM |
| entrada | HORA | NÃO |
| saida_almoco | HORA | NÃO |
| retorno_almoco | HORA | NÃO |
| saida | HORA | NÃO |
| periodo | TEXTO | NÃO |
| tipo_dia | TEXTO | NÃO |
| justificativa | TEXTO | NÃO |

#### Cálculos Automáticos:

- horas_trabalhadas = (saida - entrada) - (retorno_almoco - saida_almoco)
- horas_extras = horas_trabalhadas - 8h (jornada padrão)
- falta = true se entrada não registrada

---

### 3. Diaristas Recebidos

**Rota:** `/rh/diaristas`
**Componente:** `src/pages/Rh/RhDiaristasPainel.tsx`
**Serviço:** `LancamentoDiaristaService`, `DiaristaService`
**Tabela Principal:** `lancamentos_diaristas`

#### Tabela: lancamentos_diaristas

| Coluna Banco | Tipo | Obrigatório | Importável | Descrição |
|-------------|------|------------|-----------|------------|
| id | UUID | SIM | NÃO | Chave primária |
| tenant_id | UUID | SIM | NÃO | automático |
| diarista_id | UUID | SIM | NÃO* | ID diarista |
| empresa_id | UUID | SIM | NÃO* | ID empresa |
| data | DATE | SIM | SIM | Data trabalho |
| status | TEXT | SIM | NÃO | pendente/aprovado/pago |
| valor_diaria | NUMERIC | SIM | SIM | Valor diária |
| observacao | TEXT | NÃO | SIM | Campo livre |
| criado_em | TIMESTAMPTZ | NÃO | NÃO | automático |
| atualizado_em | TIMESTAMPTZ | NÃO | NÃO | trigger |

#### Modelo de Planilha:

**Arquivo:** `modelo_diaristas_recebidos.xlsx`

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| data | DATA | SIM |
| diarista | TEXTO | SIM |
| CPF | TEXTO | SIM |
| empresa | TEXTO | SIM |
| valor_diaria | MOEDA | SIM |
| observacao | TEXTO | NÃO |

---

### 4. Banco de Horas

**Rota:** `/banco-horas`
**Componente:** `src/pages/BancoHoras/PainelGeral.tsx`
**Serviço:** `BHEventoService` (v4.service.ts)
**Tabela Principal:** `banco_horas_eventos`

#### Tabela: banco_horas_eventos

| Coluna Banco | Tipo | Obrigatório | Importável |
|-------------|------|------------|-----------|
| id | UUID | SIM | NÃO |
| tenant_id | UUID | SIM | NÃO |
| colaborador_id | UUID | SIM | NÃO* |
| data_evento | DATE | SIM | SIM |
| tipo_evento | TEXT | SIM | SIM |
| horas | NUMERIC | SIM | SIM |
| justificativa | TEXT | NÃO | SIM |
| created_at | TIMESTAMPTZ | NÃO | NÃO |

#### Modelo de Planilha:

**Arquivo:** `modelo_banco_horas.xlsx`

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| data_evento | DATA | SIM |
| colaborador | TEXTO | SIM |
| tipo_evento | TEXTO | SIM |
| horas | NÚMERO | SIM |
| justificativa | TEXTO | NÃO |

---

### 5. Regras de Banco de Horas

**Rota:** `/banco-horas/regras`
**Componente:** `src/pages/BancoHoras/Regras.tsx`
**Serviço:** `BHRegraService` (v4.service.ts)
**Tabela Principal:** `banco_horas_regras`

#### Tabela: banco_horas_regras

| Coluna Banco | Tipo | Obrigatório |
|-------------|------|-------------|
| id | UUID | SIM |
| tenant_id | UUID | SIM |
| nome | TEXT | SIM |
| tipo | TEXT | SIM |
| jornada_padrao_minutos | INTEGER | SIM |
| limite_horas_extras | INTEGER | NÃO |
| permite_compensacao | BOOLEAN | NÃO |
| ativo | BOOLEAN | NÃO |
| created_at | TIMESTAMPTZ | NÃO |

####Modelo de Planilha:

**Arquivo:** `modelo_banco_horas_regras.xlsx`

| Campo | Tipo |
|-------|------|
| nome | TEXTO |
| tipo | TEXTO |
| jornada_padrao_minutos | NÚMERO |
| limite_horas_extras | NÚMERO |
| permite_compensacao | SIM/NÃO |

---

### 6. Regras Operacionais

**Rota:** `/cadastros/regras-operacionais`
**Componente:** `src/pages/RegrasOperacionais.tsx`
**Serviço:** `FornecedorValorServicoService` (base.service.ts)
**Tabela Principal:** `fornecedor_valores_servico`

#### Tabela: fornecedor_valores_servico

| Coluna Banco | Tipo | Obrigatório |
|-------------|------|-------------|
| id | UUID | SIM |
| fornecedor_id | UUID | SIM |
| tipo_servico_id | UUID | SIM |
| empresa_id | UUID | SIM |
| unidade_id | UUID | NÃO |
| transportadora_id | UUID | NÃO |
| produto_carga_id | UUID | NÃO |
| valor_unitario | NUMERIC | SIM |
| tipo_calculo | TEXT | SIM |
| ativo | BOOLEAN | NÃO |
| vigencia_inicio | DATE | SIM |
| vigencia_fim | DATE | NÃO |
| observacoes | TEXT | NÃO |

#### Modelo de Planilha:

**Arquivo:** `modelo_regras_operacionais.xlsx`

| Campo | Tipo |
|-------|------|
| fornecedor | TEXTO |
| tipo_servico | TEXTO |
| empresa | TEXTO |
| unidade | TEXTO |
| transportadora | TEXTO |
| produto | TEXTO |
| valor_unitario | MOEDA |
| tipo_calculo | TEXTO |
| vigencia_inicio | DATA |
| vigencia_fim | DATA |

---

### 7. Fechamentos

**Rota:** `/fechamento`
**Componente:** `src/pages/Fechamento.tsx`
**Serviço:** `LoteFechamentoDiaristaService`
**Tabela Principal:** `ciclos_diaristas`, `lote_pagamento_diaristas`

#### Tabela: ciclos_diaristas

| Coluna Banco | Tipo | Obrigatório |
|-------------|------|-------------|
| id | UUID | SIM |
| tenant_id | UUID | SIM |
| empresa_id | UUID | SIM |
| data_inicio | DATE | SIM |
| data_fim | DATE | SIM |
| status | TEXT | SIM |
| total_diaristas | INTEGER | NÃO |
| valor_total | NUMERIC | NÃO |
| criado_em | TIMESTAMPTZ | NÃO |

---

### 8. Colaboradores

**Rota:** `/colaboradores`
**Componente:** `src/pages/Colaboradores.tsx`
**Serviço:** `ColaboradorService`
**Tabela Principal:** `colaboradores`

#### Tabela: colaboradores

| Coluna Banco | Tipo | Obrigatório | Importável |
|-------------|------|------------|-----------|
| id | UUID | SIM | NÃO |
| tenant_id | UUID | SIM | NÃO |
| nome | TEXT | SIM | SIM |
| cpf | TEXT | SIM | SIM |
| cargo | TEXT | SIM | SIM |
| empresa_id | UUID | SIM | NÃO* |
| tipo_contrato | TEXT | SIM | SIM |
| valor_base | NUMERIC | NÃO | SIM |
| telefone | TEXT | NÃO | SIM |
| email | TEXT | NÃO | SIM |
| dados_bancarios_json | JSONB | NÃO | NÃO |
| matricula | TEXT | NÃO | SIM |
| data_admissao | DATE | NÃO | SIM |
| status | TEXT | NÃO | NÃO |
| created_at | TIMESTAMPTZ | NÃO | NÃO |
| updated_at | TIMESTAMPTZ | NÃO | NÃO |

#### Modelo de Planilha:

**Arquivo:** `modelo_colaboradores.xlsx`

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| nome | TEXTO | SIM |
| cpf | TEXTO | SIM |
| cargo | TEXTO | SIM |
| empresa | TEXTO | SIM |
| tipo_contrato | TEXTO | SIM |
| valor_base | MOEDA | NÃO |
| telefone | TEXTO | NÃO |
| email | TEXTO | NÃO |
| matricula | TEXTO | NÃO |
| data_admissao | DATA | NÃO |

---

### 9. Empresas

**Rota:** `/empresas`
**Componente:** `src/pages/Empresas.tsx`
**Serviço:** `EmpresaService`
**Tabela Principal:** `empresas`

#### Tabela: empresas

| Coluna Banco | Tipo | Obrigatório |
|-------------|------|-------------|
| id | UUID | SIM |
| tenant_id | UUID | SIM |
| nome | TEXT | SIM |
| cnpj | TEXT | SIM |
| unidade | TEXT | NÃO |
| cidade | TEXT | NÃO |
| estado | TEXT | NÃO |
| contato | TEXT | NÃO |
| telefone | TEXT | NÃO |
| email | TEXT | NÃO |
| endereco | TEXT | NÃO |
| ativo | BOOLEAN | NÃO |

#### Modelo de Planilha:

**Arquivo:** `modelo_empresas.xlsx`

⚠️ **RESTRIÇÃO**: Apenas Admin pode importar empresas. Campo tenant_id IGNORADO.

| Campo | Tipo |
|-------|------|
| nome | TEXTO |
| cnpj | TEXTO |
| unidade | TEXTO |
| cidade | TEXTO |
| estado | TEXTO |
| contato | TEXTO |
| telefone | TEXTO |
| email | TEXTO |

---

### 10. Transportadoras

**Rota:** `/transportadoras`
**Componente:** `src/pages/Transportadoras.tsx`
**Serviço:** `TransportadoraClienteService`
**Tabela Principal:** `transportadoras_clientes`

#### Tabela: transportadoras_clientes

| Coluna Banco | Tipo | Obrigatório |
|-------------|------|-------------|
| id | UUID | SIM |
| tenant_id | UUID | SIM |
| empresa_id | UUID | NÃO |
| nome | TEXT | SIM |
| documento | TEXT | NÃO |
| tipo_cadastro | TEXT | SIM |
| ativo | BOOLEAN | NÃO |

####Modelo de Planilha:

**Arquivo:** `modelo_transportadoras.xlsx`

| Campo | Tipo |
|-------|------|
| nome | TEXTO |
| documento | TEXTO |
| tipo_cadastro | TEXTO |

---

### 11. Fornecedores

**Rota:** `/fornecedores`
**Componente:** `src/pages/Fornecedores.tsx`
**Serviço:** `FornecedorService`
**Tabela Principal:** `fornecedores`

#### Tabela: fornecedores

| Coluna Banco | Tipo | Obrigatório |
|-------------|------|-------------|
| id | UUID | SIM |
| tenant_id | UUID | SIM |
| empresa_id | UUID | NÃO |
| nome | TEXT | SIM |
| documento | TEXT | NÃO |
| ativo | BOOLEAN | NÃO |

#### Modelo de Planilha:

**Arquivo:** `modelo_fornecedores.xlsx`

| Campo | Tipo |
|-------|------|
| nome | TEXTO |
| documento | TEXTO |
| empresa | TEXTO |

---

### 12. Serviços

**Rota:** `/servicos`
**Componente:** `src/pages/Servicos.tsx`
**Serviço:** `TipoServicoOperacionalService`
**Tabela Principal:** `tipos_servico_operacional`

#### Tabela: tipos_servico_operacional

| Coluna Banco | Tipo |
|-------------|------|
| id | UUID |
| nome | TEXT |
| descricao | TEXT |
| ativo | BOOLEAN |

#### Modelo de Planilha:

⚠️ **RESTRIÇÃO**: ApenasAdmin pode cadastrar tipos de serviço.

**Arquivo:** `modelo_servicos.xlsx`

---

### 13. Coletores

**Rota:** `/coletores`
**Componente:** `src/pages/Coletores.tsx`
**Serviço:** `ColetorService`
**Tabela Principal:** `coletores`

#### Tabela: coletores

| Coluna Banco | Tipo |
|-------------|------|
| id | UUID |
| tenant_id | UUID |
| modelo | TEXT |
| serie | TEXT |
| empresa_id | UUID |
| status | TEXT |
| ultima_sync | TIMESTAMPTZ |

---

### 14. Custos Extras Operacionais

**Componente:** `CustoExtraOperacionalService`
**Tabela:** `custos_extras_operacionais`

| Coluna Banco | Tipo |
|-------------|------|
| id | UUID |
| tenant_id | UUID |
| empresa_id | UUID |
| operacao_id | UUID |
| data | DATE |
| categoria_custo | TEXT |
| descricao | TEXT |
| valor_unitario | NUMERIC |
| quantidade | NUMERIC |
| total | NUMERIC |
| forma_pagamento | TEXT |
| data_vencimento | DATE |
| status_pagamento | TEXT |

---

## Regras很重要

### Campos Técnicos Obrigatórios (IGNORAR):

1. **IDs primários**: id (UUID) - sempre automático
2. **Tenant**: tenant_id - sempre do usuário logado
3. **Timestamps**: created_at, updated_at, criado_em, atualizado_em
4. **Usuários**: created_by, user_id, criado_por
5. **Valores calculados**: valor_total, horas_trabalhadas, horas_extras, falta
6. **Status automático**: calculado pelo sistema

### Campos com Lookup Obrigatório:

Na importação, usar NOME em vez de ID:
- empresa_id → "empresa" (nome)
- fornecedor_id → "fornecedor" (nome)
- transportadora_id → "transportadora" (nome)
- tipo_servico_id → "tipo_servico" (nome)
- colaborador_id → "colaborador" (nome)
- diarista_id → "diarista" (nome)

### Regras de Validação por Tabela:

#### operacoes_producao:
- Quantidade > 0
- Valor unitário ≥ 0
- Se entrada_ponto, saida_ponto >= entrada_ponto

#### registros_ponto:
- Data não pode ser futura (> hoje)
- Se período noturno, validar hora

#### lancamentos_diaristas:
- Data deve estar em ciclo aberto
- Valor diária > 0

---

## Fluxo de Importação Seguro

### Passo a Passo:

1. **Upload planilha** → Parser Excel/CSV
2. **Normalização campos** → Converter nomes em IDs
3. **Validação linha a linha** → Verificar existência
4. **Validação regras** → Verificar permissões
5. **Simulação** → Mostrar preview
6. **Confirmação** → Usuário confirma
7. **Importação** → Inserção em batch
8. **Retorno** → Sucesso/erros por linha

### Segurança:

-✅ tenant_id sempre do contexto
-❌ Nunca aceitar tenant_id externo
-❌ Nunca aceitar IDs de foreign keys
-❌ Nunca aceitar created_at/updated_at
-❌ Nunca aceitar created_by
-✅ Validar existência de registros referenciados
-✅ Log de auditoria por importação

---

## Mapeamento de Códigos

### Tipos de Status:

| Status | Significado |
|--------|------------|
| pendente | Aguardando processamento |
| processado | Processado automaticamente |
| com_alerta | Processado comwarning |
| aprovado | Aprovado pelo RH |
| pago | Já pagopara diarista |
| fechado | Fechamento concluído |
| inconsistente | Dados incorretos |
| incompleto | Dados faltantes |

### Tipos de Cálculo:

| Tipo | Descrição |
|------|----------|
| volume | Por quantidade de volumes |
| fixo | Valor fixo ( não variável) |
| colaborador | Por colaborador |
| diaria | Por diária |

### Períodos:

| Período | Descrição |
|--------|----------|
| Diurno | Turno dia |
| Noturno | Turno noite |

### Tipos de Dia:

| Tipo | Descrição |
|------|----------|
| Normal | Dia útil normal |
| Domingo | Domigo |
| Feriado | Feriado |

---

## Próximos Passos

1. Gerar templates `.xlsx` com headers corretos
2. Implementar componente de upload genérico
3. Implementar parsing com normalização
4. Implementar validação por tabela
5. Implementar log de importação
6. Implementar retry em caso de erro

---

*Documento gerado em: 2026-05-06*
*Versão: 1.0*