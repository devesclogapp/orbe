# UX06 — SERVIÇOS EXTRAS
## FASE 01 — AUDITORIA FUNCIONAL E ARQUITETURAL

> **Status:** AUDITORIA CONCLUÍDA — MODO READ-ONLY  
> **Data:** 03/10/2026  
> **Escopo:** Mapeamento integral e desvendamento técnico do ciclo de vida dos **Serviços Extras Operacionais** no ERP ORBE.

---

## 1. REGRA PRINCIPAL: MODO READ-ONLY
Durante toda a execução desta auditoria, nenhuma alteração em código de produção, schema de banco de dados, políticas RLS, migrations, RPCs, rotas da aplicação ou mockups do UX Lab foi realizada. Nenhuma rota `/ux-lab/servicos-extras` foi criada prematuramente.

---

## 2. PERGUNTA CENTRAL
### O que é um Serviço Extra dentro do ORBE, desde seu lançamento até sua conclusão financeira?

No ERP ORBE, um **Serviço Extra Operacional** é uma atividade de valor agregado realizada pela equipe logística de campo fora do escopo do contrato padrão de movimentação volumétrica (ex.: conserto ou reforma de pallets PBR, transbordo emergencial de carga avariada, enlonamento de carretas graneleiras, pintura e identificação técnica de pallets, apoio operacional noturno extraordinário).

Diferente de um *Custo Extra* (que é uma **despesa/saída financeira** — ex.: compra de EPIs, lanche, diesel), o **Serviço Extra é uma RECEITA / FATURAMENTO (entrada financeira)** cobrada do cliente tomador do serviço.

### Macro-fluxo comprovado no código:
```
1. LANÇAMENTO (Encarregado no Portal Mobile ou Admin no Modal)
   ↓
   Grava em `servicos_extras_operacionais`
   Status inicial: pipeline_status = 'PENDENTE' | status_pagamento = 'PENDENTE'
   
2. VALIDAÇÃO OPERACIONAL & RH (Painel de Aprovações / Operação)
   ↓
   Item listado em `vw_aprovacoes_rh` (tipo 'SERVIÇO EXTRA', situação 'Em análise')
   RH / Gestor de Operações confere a execução física, headcount (quantidade_colaboradores), materiais consumidos e período
   Transição: pipeline_status → 'APROVADO_OPERACAO'

3. DISPARO AUTOMÁTICO DE RECEITA (Trigger Postgres Autônoma)
   ↓
   Trigger `trg_gerar_receita_servico_extra_automatica` dispara em `servicos_extras_operacionais`
   - Se FATURAMENTO_MENSAL: Agrupa no lote mensal aberto da empresa (`receitas_operacionais`, status 'aguardando_fechamento')
   - Se DUPLICATA: Cria receita avulsa (`receitas_operacionais`, status 'pendente_cobranca', vencimento via regras_financeiras)
   - Se CAIXA_IMEDIATO: Cria receita avulsa (`receitas_operacionais`, status 'pendente_recebimento', vencimento na data)
   Gera item em `receitas_operacionais_itens` com vínculo estrito `servico_extra_id` (índice UNIQUE parcial anti-duplicidade)

4. FATURAMENTO & COBRANÇA (Central de Receitas / Financeiro)
   ↓
   Financeiro emite NF/Boleto e envia cobrança
   Transição operacional: pipeline_status → 'FATURADO' (ou mantido em 'APROVADO_FINANCEIRO')
   Trigger `check_imutabilidade_servico_extra` blinda valores e entidades contra edições retroativas

5. RECEBIMENTO & LIQUIDAÇÃO (Bancário / Conciliação)
   ↓
   Financeiro confirma recebimento via `rpc_receita_confirmar_recebimento(p_receita_id)`
   - `receitas_operacionais.status` → 'recebido'
   - Sincronização automática em `servicos_extras_operacionais`:
     status_pagamento → 'RECEBIDO'
     pipeline_status → 'CONCLUIDO'
```

---

## 3. LOCALIZAÇÃO DA IMPLEMENTAÇÃO REAL (ARTEFATOS)

| Tipo de Artefato | Arquivos / Identificadores | Responsabilidade / Descrição |
| :--- | :--- | :--- |
| **Página de Entrada (Mobile)** | `src/pages/Producao/ServicosExtrasLancamento.tsx` | Tela de lançamento de campo utilizada pelo encarregado, com cálculo de materiais, períodos operacionais e impostos. |
| **Página de Recepção (Desktop)** | `src/pages/Operacional/ServicosExtrasRecebidos.tsx` | Tela de gestão interna com KPIs de faturamento, filtros de competência/empresa e tabela de lançamentos. |
| **Formulário Modal** | `src/components/operacoes/NovoServicoExtraDialog.tsx` | Modal administrativo de cadastro/edição de serviços extras no ERP. |
| **Componentes de Tabela** | `src/components/operacoes/ServicosExtrasTableBlock.tsx` | Tabela especialista operacional com filtros de pipeline, ordenação e ações de avanço/devolução. |
| **Drawers Especialistas** | `src/components/operacoes/ServicoExtraDetalhesDrawer.tsx`<br>`src/components/operacoes/ServicosExtrasContinuityDrawer.tsx` | Drawer Primário (diagnóstico, composição financeira, resumo de etapas) e Drawer Secundário (stepper vertical da esteira). |
| **Services** | `src/services/receitas/receitas.service.ts` (`ServicosExtrasOperacionaisServiceClass`) | CRUD, consultas por competência (`getWithEmpresas`), sanitização de payloads e queries de histórico. |
| **Validação / RH** | `src/pages/Rh/AprovacoesRh.tsx`<br>`supabase/migrations/20260922180000_fix_vw_aprovacoes_rh_em_validacao.sql` | Exibição unificada em `vw_aprovacoes_rh` e mutação para `APROVADO_OPERACAO`. |
| **Pipeline Financeiro** | `src/pages/Financeiro/ReceitasPipeline.tsx`<br>`src/pages/Financeiro/components/ReceitaDetalhesDrawer.tsx` | Gestão de contas a receber e faturamento agrupado ou avulso. |
| **Fechamento Mensal** | `src/pages/Fechamento.tsx` | Trava de fechamento de ciclo caso haja serviços extras pendentes de validação. |
| **Tabelas do Banco** | `public.servicos_extras_operacionais`<br>`public.receitas_operacionais`<br>`public.receitas_operacionais_itens`<br>`public.tipos_servico_operacional` | Entidades relacionais de persistência. |
| **Triggers do Banco** | `trg_calcular_total_servico_extra`<br>`trg_check_imutabilidade_servico_extra`<br>`trg_check_pipeline_transition`<br>`trg_gerar_receita_servico_extra_automatica` | Cálculos, bloqueios de segurança e automação da esteira de receita. |
| **RPCs Financeiras** | `public.rpc_receita_confirmar_recebimento` | Liquidação financeira que finaliza o serviço extra como `CONCLUIDO`. |
| **Relatório Oficial** | R07 — Analítico de Serviços Extras (`src/pages/UxLab/UxLabRelatorioView.tsx`) | Visão analítica histórica para auditoria e exportação CSV/PDF. |

---

## 4. ANÁLISE CRÍTICA DA TELA ATUAL (`ServicosExtrasRecebidos.tsx`)

| Elemento da Tela Atual | Descrição / Comportamento Hoje | Classificação | Parecer Técnico |
| :--- | :--- | :--- | :--- |
| **Cabeçalho AppShell** | Título "Serviços Extras Recebidos", Badge "ENTRADAS / CAPTURA" | **ESSENCIAL** | Rótulo claro, mas na UX06 deve seguir a hierarquia canônica de workspace operacional. |
| **Filtros Globais (Barra Topo)** | Empresa, Mês, Ano e botão Refresh | **ÚTIL** | Funcional, porém o filtro mês/ano fragmentado destoa do padrão transversal `UxLabFiltroTemporal`. |
| **Top KPIs (3 Cards)** | Faturamento Total, Total de Serviços, Média por Serviço | **ÚTIL / REDUNDANTE** | Mostra totais contábeis agregados, mas **não responde a perguntas operacionais** (quantos precisam de validação? quanto está travado?). |
| **Tabela Principal (13 colunas)** | Data, Empresa, Tipo, Descrição, Qtd, Vlr. Unit., Total, Modalidade, Status Pgto, Pipeline, Responsável, Obs, Ações | **ESSENCIAL** | Contém dados completos, mas a largura de 13 colunas causa scroll desnecessário e mistura dois status sem hierarquia. |
| **Dois Status em Colunas Separadas** | Coluna `Status Pgto` (dropdown editável direto) + Coluna `Pipeline` (Badge) | **FORA DE CONTEXTO** | Permitir alterar o `status_pagamento` direto na linha via dropdown quebra a integridade financeira e contorna a esteira de receitas! |
| **Filtros na Barra da Tabela** | Busca textual, Select Tipo de Serviço, Select Pipeline Status, Pílulas de macro-etapas | **ESSENCIAL** | Padrão excelente de segmentação da fila, alinhado à filosofia operacional. |
| **Botão de Avançar na Linha (Play)** | Dispara transição para a próxima etapa direto na tabela | **ÚTIL** | Útil para agilidade, mas deve exigir confirmação/diagnóstico para etapas críticas. |
| **Botão Devolver na Linha (Undo)** | Abre modal de justificativa de devolução | **ESSENCIAL** | Governança preservada com registro de `justificativa_devolucao`. |
| **Drawers Duplos (Primário + Secundário)** | Clique abre Detalhes; botão secundário abre Linha do Tempo | **ESSENCIAL** | Padrão homologado na Fase UX-2B; deve ser preservado e harmonizado com o layout da UX05. |
| **Modal de Criação / Edição** | Dialog com campos operacionais e financeiros | **ESSENCIAL** | Cadastro completo; deve ser preservado como o ponto de entrada da modalidade de captura. |

---

## 5. MAPA DO FORMULÁRIO DE LANÇAMENTO
Auditoria comparada entre o formulário do Encarregado (`ServicosExtrasLancamento.tsx`) e o Modal Administrativo (`NovoServicoExtraDialog.tsx`):

| Campo | Origem | Obrigatório? | Persistência (Coluna) | Regra de Negócio | Perfil de Acesso |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Empresa** | MANUAL | Sim | `empresa_id` (UUID) | Seleciona o cliente/empresa tomadora cadastrada no ORBE. | Encarregado / Admin |
| **Data do Serviço** | MANUAL | Sim | `data` (DATE) | Data efetiva da realização do serviço de campo (fato gerador). | Encarregado / Admin |
| **Tipo de Serviço** | MANUAL | Sim | `tipo_servico_id` (UUID)<br>`tipo_servico` (TEXT) | Filtra apenas registros ativos onde `is_extra_service = true`. Grava nome snapshot. | Encarregado / Admin |
| **Descrição do Serviço** | MANUAL | Sim | `descricao_servico` (TEXT)<br>`descricao` (TEXT) | Texto detalhando o escopo do serviço (ex.: "Reforma de 85 pallets PBR avariados"). | Encarregado / Admin |
| **Quantidade** | MANUAL | Sim | `quantidade` (NUMERIC) | Quantidade física executada. Deve ser > 0. | Encarregado / Admin |
| **Unidade de Cobrança** | SNAPSHOT | Não | `unidade_cobranca_snapshot` | Herdado de `tipos_servico_operacional.unidade_cobranca` (ex.: "un", "pallet", "hora"). | Automático |
| **Período Operacional** | MANUAL | Não | `regra_id` (UUID) | Tabela `servicos_especificos_regras`. Aplica peso multiplicador (ex.: N1 1.25x, Noturno 1.50x). | Encarregado / Admin |
| **Qtd. Colaboradores** | MANUAL | Não | `quantidade_colaboradores` (INT) | Headcount alocado para o serviço extra. Relevante para dimensionamento pelo RH. | Encarregado / Admin |
| **Valor Unitário Base** | SNAPSHOT / MANUAL | Sim | `valor_unitario_snapshot`<br>`valor_unitario` | Herdado do cadastro do serviço; se `tipo_calculo == 'manual'`, permite digitação livre. | Encarregado / Admin |
| **Valor Unitário Efetivo** | DERIVADA | Sim | `valor_unitario` (NUMERIC) | Fórmula: `valor_unitario_base * multiplicador_periodo`. | Sistema |
| **Forma de Pagamento** | MANUAL | Sim | `forma_pagamento_id` (UUID) | Selecionada de `formas_pagamento_operacional`. Define a modalidade financeira. | Encarregado / Admin |
| **Modalidade Financeira** | DERIVADA | Sim | `modalidade_financeira` (TEXT) | Classificada automaticamente: `CAIXA_IMEDIATO`, `DUPLICATA`, `FATURAMENTO_MENSAL`. | Sistema |
| **Emitir NF?** | MANUAL | Não | `emite_nf` (BOOLEAN) | Se marcado, ativa apuração de ISS e exige faturamento fiscal. | Encarregado / Admin |
| **Alíquota ISS (%)** | DERIVADA | Condicional | `iss_percentual` (NUMERIC) | Resolvida via `FornecedorValorServicoService.resolverIss` ou fallback legal de 5%. | Sistema |
| **Valor do ISS** | DERIVADA | Condicional | `valor_iss` (NUMERIC) | Dedução calculada: `valor_total_servico * (iss_percentual / 100)`. | Sistema |
| **Número da NF** | MANUAL | Não | `nf_numero` (TEXT) | Preenchimento opcional no lançamento ou a posteriori pelo faturamento. | Encarregado / Financeiro |
| **Materiais Extras** | MANUAL | Não | `materiais_snapshot` (JSONB)<br>`custo_materiais` (NUMERIC) | Array de materiais consumidos (parafusos, madeira, filme stretch). Soma ao total bruto. | Encarregado (Portal) |
| **Transportadora** | MANUAL | Não | `transportadora_id` (UUID) | Vínculo opcional se o serviço extra foi gerado em função de uma carga transportada. | Encarregado / Admin |
| **Responsável** | SNAPSHOT | Não | `responsavel_nome` (TEXT) | Nome do usuário logado capturado automaticamente. | Sistema |
| **Observações** | MANUAL | Não | `observacao` (TEXT) | Anotações adicionais de campo ou justificativas operacionais. | Encarregado / Admin |
| **Valor Total Geral** | DERIVADA | Sim | `total` (NUMERIC) | Fórmula canônica: `(quantidade * valor_unitario_efetivo) + custo_materiais`. | Trigger / Sistema |

---

## 6. MATRIZ DE PERFIS E PERMISSÕES

| Ação | Encarregado (Portal) | Admin (Geral) | RH (Validador) | Financeiro |
| :--- | :---: | :---: | :---: | :---: |
| **Criar Lançamento** | Sim (seu turno/base) | Sim | Não | Não |
| **Visualizar Lançamentos** | Apenas os próprios/turno | Sim (todos) | Sim (na fila RH) | Sim (aprovados / faturáveis) |
| **Editar Dados Operacionais** | Sim (apenas `PENDENTE` ou `DEVOLVIDO`) | Sim (até `APROVADO_OPERACAO`) | Não | Não |
| **Editar Dados Fiscais/NF** | Não | Sim | Não | Sim |
| **Excluir / Deletar** | Não | Sim (se `PENDENTE` e sem receita vinculada) | Não | Não |
| **Devolver Etapa** | Não | Sim (qualquer etapa aberta) | Sim (com justificativa) | Sim (com justificativa) |
| **Aprovação Operacional (RH)** | Não | Sim | Sim (`vw_aprovacoes_rh`) | Não |
| **Aprovação Financeira / Faturar** | Não | Sim | Não | Sim |
| **Confirmar Recebimento / Concluir**| Não | Sim (via RPC) | Não | Sim (`rpc_receita_confirmar_recebimento`) |

*Nota:* O Encarregado possui canal de entrada segregado no Portal Mobile (`/producao/servicos-extras/novo`), sem acesso à Sidebar ou menus administrativos.

---

## 7. ESTRUTURA REAL DO BANCO: `public.servicos_extras_operacionais`

```sql
-- DDL Real Auditado (Consolidado de Migrations 20260520 a 20260917)
CREATE TABLE public.servicos_extras_operacionais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
    empresa_nome TEXT,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_servico_id UUID REFERENCES public.tipos_servico_operacional(id) ON DELETE SET NULL,
    tipo_servico TEXT,
    descricao_servico TEXT NOT NULL,
    descricao TEXT,
    quantidade NUMERIC(15, 2) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    quantidade_colaboradores INTEGER,
    valor_unitario NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
    valor_unitario_snapshot NUMERIC(15, 2),
    total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    regra_id UUID REFERENCES public.servicos_especificos_regras(id) ON DELETE SET NULL,
    materiais_snapshot JSONB,
    custo_materiais NUMERIC(15, 2) DEFAULT 0,
    emite_nf BOOLEAN DEFAULT false,
    nf_numero TEXT,
    iss_percentual NUMERIC(5, 4) DEFAULT 0,
    valor_iss NUMERIC(15, 2) DEFAULT 0,
    transportadora_id UUID REFERENCES public.transportadoras_clientes(id) ON DELETE SET NULL,
    forma_pagamento TEXT,
    forma_pagamento_id UUID REFERENCES public.formas_pagamento_operacional(id) ON DELETE SET NULL,
    modalidade_financeira TEXT DEFAULT 'CAIXA_IMEDIATO'
        CHECK (modalidade_financeira IN (
            'CAIXA_IMEDIATO', 'DEPOSITO_IMEDIATO', 'CAIXA_ADMINISTRATIVO',
            'DUPLICATA_FORNECEDOR', 'FECHAMENTO_MENSAL_EMPRESA',
            'DUPLICATA', 'FATURAMENTO_MENSAL'
        )),
    data_vencimento DATE,
    status_pagamento TEXT DEFAULT 'PENDENTE'
        CHECK (status_pagamento IN ('PENDENTE', 'RECEBIDO', 'ATRASADO')),
    pipeline_status TEXT DEFAULT 'PENDENTE'
        CHECK (pipeline_status IN (
            'PENDENTE', 'EM_VALIDACAO', 'APROVADO_OPERACAO',
            'APROVADO_FINANCEIRO', 'FATURADO', 'CONCLUIDO', 'DEVOLVIDO'
        )),
    justificativa_devolucao TEXT,
    aprovacao_json JSONB,
    responsavel_nome TEXT,
    observacao TEXT,
    operacao_id UUID REFERENCES public.operacoes_producao(id) ON DELETE SET NULL,
    origem_dado TEXT NOT NULL DEFAULT 'manual' CHECK (origem_dado IN ('manual', 'importacao', 'ajuste')),
    criado_por UUID DEFAULT auth.uid(),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 8. CATÁLOGO E TIPOS DE SERVIÇO
Os tipos de serviço **NÃO são enums estáticos** e **NÃO são hardcoded no frontend**.
- **Origem:** Tabela relacional dinâmica `public.tipos_servico_operacional`.
- **Filtro de Domínio:** O campo booleano `tipos_servico_operacional.is_extra_service = true` segrega serviços que podem ser lançados como Serviços Extras daqueles que são Operações por Volume comuns.
- **Tipos comumente cadastrados e homologados nos dados reais:**
  1. Conserto de Pallets (PBR / Descartável)
  2. Transbordo de Carga
  3. Pintura e Identificação de Pallets
  4. Enlonamento de Carga
  5. Montagem de Estruturas / Estrados
  6. Apoio Operacional Noturno
  7. Lavagem e Higienização de Baús
  8. Etiquetagem e Separação Extraordinária

---

## 9. MÁQUINA DE ESTADOS COMPROVADA (PIPELINE)

| Status Persistido (`pipeline_status`) | Quem Grava? | Significado Operacional / Negócio | Próxima Transição Permitida |
| :--- | :--- | :--- | :--- |
| **`PENDENTE`** | Encarregado / Admin | Serviço extra registrado no sistema. Aguarda conferência técnica. | `EM_VALIDACAO`, `DEVOLVIDO` |
| **`EM_VALIDACAO`** | Gestor Operacional / RH | Em processo de verificação documental, headcount e insumos. | `APROVADO_OPERACAO`, `DEVOLVIDO` |
| **`APROVADO_OPERACAO`** | RH / Gestor Operacional | **Validação concluída.** Dispara trigger que gera a Receita Operacional no Financeiro. | `APROVADO_FINANCEIRO`, `FATURADO`, `DEVOLVIDO` |
| **`APROVADO_FINANCEIRO`** | Financeiro | Receita revisada pelo financeiro, pronta para emissão fiscal/faturamento. | `FATURADO`, `CONCLUIDO`, `DEVOLVIDO` |
| **`FATURADO`** | Financeiro | Nota Fiscal e/ou Duplicata emitida e encaminhada ao cliente tomador. | `CONCLUIDO` |
| **`CONCLUIDO`** | Trigger RPC Financeira | Receita liquidada financeiramente no caixa ou banco. Fato concluído. | *Estado Final Imutável* |
| **`DEVOLVIDO`** | RH / Financeiro / Gestor | Registro apontado com erro/inconsistência. Exige correção e justificativa. | `EM_VALIDACAO`, `PENDENTE` |

*Garantia de Transição:* A trigger Postgres `trg_check_pipeline_transition` impede saltos ilegais diretos (ex.: pular de `PENDENTE` diretamente para `FATURADO` ou `CONCLUIDO` sem passar pelas etapas de validação e aprovação).

---

## 10. O PAPEL DO RH / OPERAÇÃO EM `APROVADO_OPERACAO`
Por que o Serviço Extra passa por aprovação operacional / RH (`vw_aprovacoes_rh`)?
1. **Conferência de Headcount e Mão de Obra:** O campo `quantidade_colaboradores` indica quantos operadores participaram da atividade extra. O RH precisa atestar se a equipe estava em jornada regular, diária ou hora extraordinária para garantir que não haja pagamento em duplicidade ou desvio de função.
2. **Atestação de Execução Física:** Ao contrário de contratos mensais recorrentes, o Serviço Extra é spot/emergencial. A aprovação operacional atesta que o serviço de fato existiu no armazém/pátio antes de cobrar o cliente.
3. **Consumo de Insumos:** Avaliação de materiais extraordinários consumidos (`materiais_snapshot`).
*Importante:* A aprovação do RH **libera o faturamento comercial**, mas não calcula folha de pagamento de colaborador diretamente dentro deste módulo.

---

## 11. O PAPEL DO FINANCEIRO EM `APROVADO_FINANCEIRO`
1. **Validação de Cadastro e Tomador:** Confirma se o tomador do serviço possui cadastro ativo e crédito para duplicata ou se exigirá pagamento à vista via PIX/Caixa.
2. **Definição de Vencimento e Emissão Fiscal:** Confere a retenção de ISS (`emite_nf`, `valor_iss`) e confirma a emissão da NF.
3. **Efeito no Pipeline:** Desencadeia o envio da fatura/boleto para cobrança bancária.

---

## 12. VALOR E PRECIFICAÇÃO
A fórmula matemática de precificação é calculada e persistida pelo sistema com três componentes:

$$\text{Valor Unitário Efetivo} = \text{Valor Unitário Base} \times \text{Multiplicador de Período}$$

$$\text{Valor Total Bruto} = (\text{Quantidade} \times \text{Valor Unitário Efetivo}) + \text{Custo Materiais}$$

$$\text{Valor ISS} = \begin{cases} \text{Valor Total Bruto} \times \left(\frac{\text{ISS Percentual}}{100}\right), & \text{se } \text{emite\_nf} = \text{true} \\ 0, & \text{se } \text{emite\_nf} = \text{false} \end{cases}$$

$$\text{Valor Líquido Apurado} = \text{Valor Total Bruto} - \text{Valor ISS}$$

- **Origem do Preço Base:** Cadastro do serviço (`tipos_servico_operacional.valor_unitario`).
- **Override Manual:** Permitido quando `tipo_calculo_snapshot == 'manual'`.
- **Multiplicador de Período:** Tabela `servicos_especificos_regras` (pesos de turno: diurno 1.0x, noturno N1 1.25x, madrugada N2 1.50x).
- **Snapshot Comercial:** Gravado nas colunas `valor_unitario_snapshot`, `tipo_calculo_snapshot` e `unidade_cobranca_snapshot`. Alterações futuras no catálogo de serviços não alteram lançamentos passados.

---

## 13. MODALIDADES FINANCEIRAS E INTEGRAÇÃO

| Modalidade Canônica | Vencimento Resolvido | Regra de Agrupamento | Cardinalidade |
| :--- | :--- | :--- | :--- |
| **`FATURAMENTO_MENSAL`** | Último dia civil da competência (`YYYY-MM`) | **Agrupamento Automático:** Anexa à fatura mensal aberta da empresa tomadora. | $N$ Serviços Extras : 1 Receita Operacional |
| **`DUPLICATA`** | Data da operação + prazo comercial (`regras_financeiras`) ou data informada | **Individual (Avulsa):** Cada serviço extra gera sua própria fatura/duplicata. | 1 Serviço Extra : 1 Receita Operacional |
| **`CAIXA_IMEDIATO`** | Data da realização do serviço | **Individual (Spot):** Nasce com status `pendente_recebimento` para liquidação imediata no ato. | 1 Serviço Extra : 1 Receita Operacional |

---

## 14. PROVA TÉCNICA: SERVIÇO EXTRA → RECEITAS OPERACIONAIS
A integração entre o domínio operacional e o financeiro é garantida a nível de banco de dados via migration `20260917110000_fix_servicos_extras_pipeline_financeiro.sql`:

1. **Foreign Key com Política Estrita:**  
   `receitas_operacionais_itens.servico_extra_id REFERENCES public.servicos_extras_operacionais(id) ON DELETE RESTRICT`.  
   Impede a deleção de qualquer serviço extra que já possua item de receita financeira registrado!
2. **Índice UNIQUE Parcial (Idempotência Estrutural Absoluta):**  
   `CREATE UNIQUE INDEX uk_receitas_itens_servico_extra ON public.receitas_operacionais_itens (servico_extra_id) WHERE servico_extra_id IS NOT NULL`.  
   Garante matematicamente que nenhum serviço extra pode gerar mais de uma receita ou item faturado, sob qualquer circunstância de concorrência ou reexecução de triggers!
3. **Lock Transacional (`FOR UPDATE`):**  
   A trigger busca faturas abertas com lock explícito para evitar condições de corrida em faturamentos mensais complementares multiorigem.

---

## 15. COMPETÊNCIA E FATO GERADOR ECONÔMICO
- **Fato Gerador Econômico:** Definido exclusivamente pela coluna `servicos_extras_operacionais.data` (data em que o serviço foi executado no armazém/campo).
- **Competência Contábil:** Formatada canonicamente como `YYYY-MM` a partir de `data`.
- **Relação com DRE:** A receita do serviço extra compõe a Receita Bruta da competência do fato gerador, respeitando o princípio contábil da competência (e não de caixa).
- **Datas Auditadas:**
  - `data`: Execução física (Fato Gerador / DRE).
  - `criado_em`: Timestamp do insert no sistema.
  - `data_vencimento`: Prazo limite para pagamento do cliente.
  - `data_recebimento`: Data da liquidação financeira efetiva via `rpc_receita_confirmar_recebimento`.

---

## 16. EQUIPE / COLABORADORES
- **Persistência Real:** O sistema armazena unicamente `quantidade_colaboradores INTEGER` (headcount total).
- **Constatação Crítica:** **NÃO existe tabela relacional associativa** (`servicos_extras_colaboradores` não existe no schema do Postgres).
- **Conclusão:** O Serviço Extra não vincula CPFs ou matrículas nominais individuais na tabela principal de lançamento de campo. A informação de equipe é estritamente quantitativa para auditoria operacional.

---

## 17. RELAÇÃO COM CUSTOS (RECEITA vs DESPESA)
- **Serviço Extra = 100% RECEITA / ENTRADA:** O valor cobrado do cliente é faturamento para a ESC LOG.
- **Materiais Consumidos:** Os materiais adicionados (`materiais_snapshot`) compõem o valor faturado ao cliente (`total`). O custo interno de reposição desses materiais pertence ao módulo de suprimentos/almoxarifado e não é lançado como despesa nesta tela.
- **Fronteira com Custo Extra:**
  - `servicos_extras_operacionais`: Serviço faturado ao cliente (**Receita**).
  - `custos_extras_operacionais`: Despesa operacional/administrativa da empresa (**Despesa**).

---

## 18. REGRAS DE EDIÇÃO E MUTABILIDADE

| Estágio do Registro | Pode Editar? | Quem Pode? | Campos Permitidos |
| :--- | :---: | :--- | :--- |
| **`PENDENTE` / `DEVOLVIDO`** | Sim | Encarregado, Admin | Todos os campos operacionais e financeiros. |
| **`EM_VALIDACAO`** | Sim | Gestor Operacional, Admin | Descrição, observação, regra de período, quantidade. |
| **`APROVADO_OPERACAO`** | Restrita | Admin | Apenas observação ou dados fiscais (NF). |
| **`APROVADO_FINANCEIRO`** | Blindada | Apenas Superuser | **Trigger `check_imutabilidade_servico_extra` bloqueia alterações** em `valor_unitario`, `quantidade`, `empresa_id` e `tipo_servico_id`. |
| **`FATURADO`** | Blindada | Apenas Superuser | Bloqueio total de valores e vínculos. |
| **`CONCLUIDO`** | Imutável | Ninguém | Totalmente congelado no banco. |

---

## 19. EXCLUSÃO E CANCELAMENTO
- **DELETE Físico:** Permitido via UI apenas para usuários Admin e estritamente no estágio `PENDENTE`.
- **Proteção do Banco:** Se o serviço extra já gerou item em `receitas_operacionais_itens`, o banco aborta a tentativa de exclusão com `violacao_foreign_key (ON DELETE RESTRICT)`.
- **Cancelamento Lógico:** Registros que não puderem ser executados ou que forem recusados pelo cliente devem ser transicionados para `DEVOLVIDO` com justificativa registrada, preservando o histórico de auditoria.

---

## 20. SEGURANÇA, RLS E MULTITENANT
- **Tenant Isolation:** A trigger `set_tenant_id_servicos_extras` garante o preenchimento automático do `tenant_id` no insert a partir do JWT do usuário autenticado.
- **Validação Fail-Closed na Trigger Financeira:**
  - Aborta se `tenant_id` ou `empresa_id` forem nulos.
  - Aborta se o tenant do token JWT autenticado divergir do `tenant_id` do registro (`VIOLACAO_SEGURANCA_MULTITENANT`).
- **Políticas RLS:** Políticas autenticadas ativas para SELECT e INSERT.

---

## 21. RELAÇÃO COM A TORRE OPERACIONAL
Na **Torre Operacional V2** (`Trilha A · Operações & Receitas`), os Serviços Extras aparecem integrados com código canônico `SX-YYYY-NNN`:
1. **Estágio 1 (Entrada em Campo):** Itens com status `PENDENTE` (alerta de registros recém-capturados aguardando triagem). Rota sugerida: `/servicos-extras/lancamentos`.
2. **Estágio 2 (Validação Operacional):** Itens em `EM_VALIDACAO` ou `DEVOLVIDO` retidos na esteira. Rota sugerida: `/servicos-extras/aprovacoes`.

---

## 22. RELAÇÃO COM R07 (CENTRAL DE RELATÓRIOS)
A fronteira arquitetural entre a tela especialista e o relatório é rígida:
- **UX06 — Workspace Especialista de Serviços Extras (`/ux-lab/servicos-extras`):**
  - Foco: **Execução, acompanhamento da esteira, tratamento de desvios e despacho de ações.**
  - Ações ativas: Criar, Editar, Avançar etapa, Devolver com justificativa, Diagnosticar no Drawer.
  - Visão: Fila viva de trabalho operacional.
- **R07 — Analítico de Serviços Extras (`/ux-lab/relatorios/r07-servicos-extras`):**
  - Foco: **Consulta histórica, análise gerencial, fechamento de períodos consolidados e exportação CSV/PDF.**
  - Sem ações de mutação ou transição de esteira.

---

## 23. RELAÇÃO COM A DRE OPERACIONAL
- Todo Serviço Extra que atinge a esteira de `receitas_operacionais` compõe a linha **Receita Operacional Bruta** da DRE.
- O mês contábil da DRE é indexado pela competência `YYYY-MM` derivada de `servicos_extras_operacionais.data`.
- Deduções de ISS (`valor_iss`) entram na linha de deduções fiscais operacionais quando a NF é emitida.

---

## 24. MATRIZ DE HERANÇA DA UX05 PARA A UX06

| Elemento da UX05 | Herança na UX06 | Justificativa Arquitetural & Adaptação |
| :--- | :---: | :--- |
| **Container `max-w-[1560px]`** | **HERDAR** | Padrão estrutural horizontal idêntico ao Dashboard Executivo, Torre e Operações por Volume. |
| **Cabeçalho Operacional** | **HERDAR** | Título + Badge de domínio + Descrição de governança. |
| **Quatro Indicadores Operacionais** | **ADAPTAR** | A UX05 usou 4 cards (Volume, Ops, Restrições, Média). Na UX06, os cards devem refletir a **esteira de receita**: Faturamento Total, Em Validação, Aprovados/A Receber, Concluídos. |
| **Cards Clicáveis (Filtro Rápido)**| **HERDAR** | Clicar no indicador filtra a listagem imediatamente pelo grupo correspondente. |
| **Componente `UxLabFiltroTemporal`** | **HERDAR** | Padrão transversal oficial (Todo o Período, Hoje, Mês Atual, Selecionar Data, Selecionar Período). Mapeia para a coluna `data`. |
| **Barra de Ferramentas / Busca** | **HERDAR** | Input de busca debounce + Seletor de Empresa + Seletor de Tipo de Serviço + Pílulas de macro-etapas. |
| **Dois Badges de Status (Operação / RH)**| **ADAPTAR** | Na UX05 há Status Operação + Status RH. Na UX06, a coluna deve exibir o **Pipeline Status** (esteira de 5 estágios: Recebido, Em validação, Aprovado, Faturamento, Recebido/Concluído) e a **Modalidade Financeira**. Eliminar o dropdown destrutivo da tabela atual! |
| **Coluna Pendência / Alerta** | **HERDAR** | Identifica visualmente devoluções com justificativa ou pendências de validação. |
| **Drawer Primário (Diagnóstico/Despacho)**| **HERDAR** | Drawer lateral com resumo executivo, dados do serviço, composição financeira (bruto, ISS, materiais) e ações de transição. |
| **Drawer Secundário (Linha do Tempo)** | **HERDAR** | Visualização da esteira vertical completa de continuidade operacional. |
| **Tema Light / Dark** | **HERDAR** | Compatibilidade total com Tailwind CSS e tokens do design system ORBE. |

---

## 25. MAPEAMENTO DO FILTRO TEMPORAL (`UxLabFiltroTemporal`)
- **Campo Alvo:** Coluna `data` de `public.servicos_extras_operacionais`.
- **Racional:** A data do serviço representa o fato gerador econômico da prestação da atividade. Não utilizar `criado_em` (que é apenas o timestamp do sistema) nem `data_vencimento` (que é uma projeção financeira).

---

## 26. INDICADORES ACIONÁVEIS PROPOSTOS PARA A UX06
Em vez dos KPIs meramente contábeis da tela antiga, a UX06 deve apresentar 4 indicadores que orientam a tomada de decisão operacional:

1. **Card 1: Faturamento Previsto (Total do Período)**  
   *Pergunta:* Quanto de receita extraordinária foi gerada pelas bases neste período?  
   *Ação:* Exibe valor monetário total (R$) e quantidade de serviços.
2. **Card 2: Em Validação Operacional / Pendentes (Atenção)**  
   *Pergunta:* Quais serviços estão retidos aguardando conferência do RH/Operação?  
   *Ação:* Filtra registros com `pipeline_status IN ('PENDENTE', 'EM_VALIDACAO', 'DEVOLVIDO')`.
3. **Card 3: Faturamento / A Receber (Financeiro)**  
   *Pergunta:* Quanto já foi aprovado e está aguardando cobrança ou liquidação no financeiro?  
   *Ação:* Filtra registros com `pipeline_status IN ('APROVADO_OPERACAO', 'APROVADO_FINANCEIRO', 'FATURADO')`.
4. **Card 4: Recebidos / Concluídos (Liquidados)**  
   *Pergunta:* Qual volume de serviços extras já teve o ciclo 100% encerrado com dinheiro em caixa?  
   *Ação:* Filtra registros com `pipeline_status = 'CONCLUIDO'`.

---

## 27. MATRIZ DE RISCOS E GAPS AUDITADOS

| Código | Nível | Descrição do Risco / Gap Encontrado | Mitigação / Diretriz de UX |
| :--- | :---: | :--- | :--- |
| **RISK-01** | **P0** | **Edição de Status de Pagamento Direto na Linha da Tabela Antiga:** A tela atual permite alterar `status_pagamento` via dropdown isolado, burlando o faturamento e a trigger de liquidação. | **Eliminar o dropdown na tabela.** Na UX06, o status é visualizado como badge e a liquidação só pode ocorrer pelo fluxo financeiro ou ações governadas no Drawer. |
| **RISK-02** | **P1** | **Tentativa de Deleção com Receita Vinculada:** Se um usuário tentar excluir um serviço extra que já possui item em `receitas_operacionais_itens`, o banco dispara erro `ON DELETE RESTRICT`. | Desabilitar botão de exclusão na UI para qualquer item que não esteja no estágio `PENDENTE`. |
| **RISK-03** | **P1** | **Inconsistência de Headcount vs Equipe Nominal:** A tela de detalhes antiga sugeria buscar `servicos_extras_colaboradores`, que não existe no banco. | Manter a UI alinhada estritamente com `quantidade_colaboradores` (headcount numérico). |
| **RISK-04** | **P2** | **Descompasso Temporal entre Data do Serviço e Fechamento:** Se um serviço extra for aprovado em um mês cuja fatura mensal já foi fechada no financeiro, o faturamento não pode anexar silenciosamente. | O backend grava alerta em `aprovacao_json->alerta_faturamento`; a UX06 deve exibir esse aviso no Drawer. |
| **RISK-05** | **P3** | **Truncamento de Descrições Longas:** Descrições operacionais ricas ficavam truncadas sem tooltip na tabela legada. | Implementar layout resiliente com badges compactos e Drawer com visualização íntegra do escopo. |

---

## 28. RESPOSTAS SINTÉTICAS ÀS 17 PERGUNTAS DA ENTREGA FINAL

1. **O que Serviços Extras realmente faz:**  
   Captura, valida e precifica serviços operacionais logísticos extraordinários prestados a clientes fora do contrato volumétrico padrão, convertendo-os em faturamento comercial (Receita Operacional).
2. **Fluxo ponta a ponta:**  
   Lançamento (Campo) → Validação (RH/Operação) → Geração de Receita (Trigger) → Cobrança/Faturamento (Financeiro) → Liquidação/Conciliação (RPC Bancária) → Conclusão.
3. **Entidade principal:**  
   `public.servicos_extras_operacionais`.
4. **Campos principais:**  
   `id`, `empresa_id`, `data`, `tipo_servico_id`, `descricao_servico`, `quantidade`, `valor_unitario`, `total`, `forma_pagamento_id`, `modalidade_financeira`, `emite_nf`, `valor_iss`, `custo_materiais`, `quantidade_colaboradores`, `pipeline_status`, `status_pagamento`.
5. **Status e transições:**  
   `PENDENTE` → `EM_VALIDACAO` → `APROVADO_OPERACAO` → `APROVADO_FINANCEIRO` → `FATURADO` → `CONCLUIDO` (com retorno possível via `DEVOLVIDO`).
6. **Perfis:**  
   Encarregado lança; RH/Gestor Operacional valida e atesta; Financeiro fatura e liquida; Admin audita e governa.
7. **Precificação:**  
   $(\text{Quantidade} \times \text{Valor Unitário Base} \times \text{Multiplicador de Período}) + \text{Custo de Materiais}$.
8. **Modalidades financeiras:**  
   `CAIXA_IMEDIATO` (spot), `DUPLICATA` (a prazo avulsa), `FATURAMENTO_MENSAL` (agrupada no fechamento da empresa).
9. **Receita / Faturamento:**  
   Automatizada via trigger `trg_gerar_receita_servico_extra_automatica` ao atingir `APROVADO_OPERACAO`. Gravada em `receitas_operacionais` e `receitas_operacionais_itens` com índice UNIQUE parcial anti-duplicidade.
10. **Competência:**  
    Definida pela coluna `data` do serviço (`YYYY-MM`). Representa o fato gerador econômico que alimenta a DRE.
11. **Equipe / RH:**  
    O RH valida a execução física e o headcount (`quantidade_colaboradores`). Não existe relacionamento nominal com colaboradores nesta tabela.
12. **Edição e Cancelamento:**  
    Edição liberada apenas enquanto pendente; após aprovação financeira, trigger de imutabilidade bloqueia valores e entidades. Exclusão restrita a registros pendentes sem vínculo financeiro.
13. **Segurança:**  
    Isolamento estrito de tenant via RLS, trigger `set_tenant_id_servicos_extras` e validação fail-closed contra cross-tenant leak na trigger financeira.
14. **Relação Torre / R07 / DRE:**  
    Torre monitora gargalos transversais da Trilha A; R07 emite relatórios analíticos históricos; DRE consolida o faturamento bruto na competência da prestação.
15. **O que herdar da UX05:**  
    Container `max-w-[1560px]`, cabeçalho operacional, 4 cards clicáveis acionáveis, componente `UxLabFiltroTemporal`, padrão de busca/filtros, Drawer com Diagnóstico/Despacho e tema Light/Dark.
16. **Riscos e gaps:**  
    Eliminar dropdowns de mutação direta de status na tabela; proteger exclusões; ajustar expectativas de headcount nominal.
17. **Se existe FIX bloqueante antes da UX:**  
    **NÃO existe FIX bloqueante de backend.** O backend, as migrations, as triggers de imutabilidade e a integração financeira já estão 100% implementados e homologados. O trabalho a ser realizado na Fase 02 é estritamente de concepção da interface especialista no UX Lab.

---

🛑 **CHECKPOINT**  
*Auditoria formalmente concluída em modo READ-ONLY. Nenhuma alteração foi realizada em arquivos de produção e a nova tela ainda não foi criada. Aguardando comando para avanço para a Fase 02 (Concepção).*
