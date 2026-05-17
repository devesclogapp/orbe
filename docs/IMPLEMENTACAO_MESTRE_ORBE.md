# Documentação de Implementação — Mestre ORBE

## 1. Objetivo
Este documento traduz a visão do arquivo mestre para um plano técnico executável no projeto ORBE, preservando o fluxo oficial:

Entradas → Cadastros → RH → Fechamento → Financeiro → CNAB → Pagamento → Governança.

## 2. Escopo Funcional
- Entradas operacionais: pontos, diaristas, operações por volume, custos e serviços extras.
- Central de Cadastros com foco operacional (não apenas CRUD).
- Processamento RH com bloqueios críticos e aprovação de competência.
- Repasse RH → Financeiro via lotes.
- Fechamento mensal/semanal.
- Bancário/CNAB com rastreio completo de remessas.
- Governança com auditoria e trilha de eventos.

## 3. Módulos e Responsabilidades
### 3.1 Entradas
- Importar e validar planilhas operacionais.
- Registrar inconsistências com feedback claro ao usuário.
- Gerar dados normalizados para RH e Operação.

### 3.2 Central de Cadastros
- Exibir pendências por criticidade (Crítico, Atenção, OK).
- Medir completude cadastral por colaborador.
- Permitir saneamento rápido de dados que bloqueiam fluxo.

### 3.3 RH
- Validar ponto, horas, faltas, vínculo e dados bancários.
- Aplicar regras por regime/modelo de cálculo.
- Aprovar competência e gerar lote financeiro.

### 3.4 Financeiro
- Receber lotes do RH.
- Conferir valores, colaboradores e inconsistências.
- Aprovar lote para etapa de pagamento ou devolver ao RH com motivo obrigatório.

### 3.5 Bancário (CNAB)
- Preparar lote, validar remessa, gerar arquivo, acompanhar envio e retorno.
- Controlar status de pagamento até PAGO/ERRO.

### 3.6 Governança
- Registrar logs auditáveis (quem, quando, ação, origem, antes/depois).
- Garantir rastreabilidade de decisões RH, Financeiro e CNAB.

## 4. Modelo de Dados (mínimo obrigatório)
### 4.1 Tabela de lotes RH-Financeiro
- Tabela: `rh_financeiro_lotes`
- Chave única obrigatória: `(tenant_id, empresa_id, competencia, origem, tipo)`

### 4.2 Status de fluxo (domínio único)
- `PENDENTE`
- `AGUARDANDO_RH`
- `APROVADO_RH`
- `AGUARDANDO_FINANCEIRO`
- `EM_ANALISE_FINANCEIRA`
- `APROVADO_FINANCEIRO`
- `DEVOLVIDO_RH`
- `AGUARDANDO_PAGAMENTO`
- `REMESSA_GERADA`
- `ENVIADO`
- `PROCESSADO`
- `PAGO`
- `FECHADO`
- `ERRO`

### 4.3 Entidades complementares
- `colaboradores` (regime, modelo de cálculo, dados bancários, completude)
- `inconsistencias_operacionais` (tipo, severidade, origem, status)
- `auditoria_eventos` (ator, ação, entidade, before/after, timestamp)
- `cnab_remessas` (lote, competência, valor, status, retorno)

## 5. Regras de Negócio Críticas
### 5.1 Bloqueios RH (impedem aprovação)
- Sem banco
- Sem contrato
- Ausência crítica
- Inconsistência grave
- Vínculo inválido

### 5.2 Avisos operacionais (não bloqueantes)
- Empresa criada automaticamente
- Colaborador criado automaticamente
- Regra automática aplicada
- Logs do motor

### 5.3 Modelos de cálculo
- Mensal: `valor_final = salario_base`
- Horista: `valor_final = horas_trabalhadas * valor_hora`
- Diária: `valor_final = dias_trabalhados * valor_diaria`
- Produção: `valor_final = volume * regra_operacional`

## 6. UX e Interface
### 6.1 Sidebar (seções obrigatórias)
- Entradas
- RH
- Operação
- Financeiro
- Governança
- Configurações

### 6.2 Princípios de UX
- Não deixar telas vazias.
- Explicar bloqueios de forma acionável.
- Destacar pendências críticas.
- Guiar usuário por próximo passo.

### 6.3 Central RH (topo da tela)
- Cards de pendências, bloqueios RH/Financeiro e completude.
- Filtros: pendentes, bloqueiam aprovação, sem banco, sem contrato, sem PIX, críticos.

## 7. Rotas Funcionais
- RH Processamento: `/banco-horas/processamento`
- Financeiro: `/financeiro`
- Bancário/CNAB: `/bancario`

## 8. Plano de Implementação por Fase
### Fase 1 — Estabilização do núcleo
- Consolidar fluxo Entradas → RH → Financeiro.
- Finalizar sidebar e navegação obrigatória.
- Implantar bloqueios críticos e geração de lotes RH.
- Fechamento mensal/semanal funcional.

Entregáveis:
- Lote RH gerado após aprovação.
- Financeiro recebendo e analisando lotes.
- Status de fluxo padronizado em todas as telas.

### Fase 2 — Bancário/CNAB
- Preparação, validação e geração de remessas.
- Controle de envio/retorno bancário.
- Atualização automática de status de pagamento.

Entregáveis:
- Ciclo completo até `PAGO` ou `ERRO`.
- Rastreio por lote e competência.

### Fase 3 — Automação e Governança avançada
- Motor operacional de detecção/sugestão automática.
- Logs enriquecidos e auditoria consolidada.
- Dashboard de KPIs unificado (RH, financeiro, produção, margem).

Entregáveis:
- Alertas inteligentes operacionais.
- Trilhas de auditoria completas ponta a ponta.

## 9. Critérios de Aceite
- Aprovação RH bloqueada em qualquer pendência crítica.
- Devolução Financeiro → RH exige motivo obrigatório.
- Lote único por `(tenant_id, empresa_id, competencia, origem, tipo)`.
- Status coerente e auditável em todo o ciclo.
- Rotas principais estáveis sem regressão.

## 10. Qualidade e Testes
### 10.1 Testes de regra
- Cálculo por modelo (mensal/horista/diária/produção).
- Bloqueios RH e avisos não bloqueantes.
- Validação de campos bancários obrigatórios.

### 10.2 Testes de fluxo
- RH aprova → lote criado → Financeiro analisa.
- Financeiro devolve com motivo → status `DEVOLVIDO_RH`.
- Lote aprovado financeiro → CNAB → retorno → `PAGO`.

### 10.3 Testes de governança
- Registro de before/after nas alterações críticas.
- Rastreabilidade por usuário, data e origem.

## 11. Riscos e Mitigações
- Divergência de status entre módulos: centralizar enum e transições.
- Dados legados incompletos: rotina de saneamento assistido.
- Falhas de importação: validação antecipada de layout e mensagens claras.
- Reprocessamentos indevidos: idempotência por chave de lote.

## 12. Itens que não podem quebrar
- Rotas existentes.
- Serviços de processamento RH.
- Fechamento e financeiro.
- Banco de horas.

## 13. Resultado Esperado
- ERP operacional estável de ponta a ponta.
- RH, Financeiro e CNAB funcionando em fluxo contínuo.
- Governança com rastreabilidade completa.
- Arquitetura preparada para escalar automações.

## 14. Checkpoint de Execução (Status Atual)
### 14.1 Prioridade 1 — RH → Financeiro
- Concluído: aprovação RH com validação de bloqueios críticos e separação de avisos.
- Concluído: geração de lote `rh_financeiro_lotes` por competência/origem/tipo com prevenção de duplicidade.
- Concluído: Central Financeira com status `AGUARDANDO_FINANCEIRO`, `EM_ANALISE_FINANCEIRA`, `APROVADO_FINANCEIRO`, `DEVOLVIDO_RH`, `AGUARDANDO_PAGAMENTO`.
- Concluído: ações Financeiro (iniciar análise, aprovar, devolver com motivo obrigatório).
- Concluído: logs de governança por transição (RH, criação de lote, análise, aprovação, devolução, preparo CNAB).

### 14.2 Prioridade 2 — Modelo de Cálculo do Colaborador
- Concluído: inclusão e uso de `regime_trabalho` e `modelo_calculo`.
- Concluído: campos dinâmicos por modelo (Mensal/Horista/Diária/Produção) no cadastro.
- Concluído: compatibilidade com legado (CLT→Mensal, Diarista→Diária).

### 14.3 Prioridade 3 — Fechamento
- Concluído: bloqueio de fechamento operacional com inconsistências críticas.
- Concluído: bloqueio quando automação não está pronta para fechamento.
- Concluído: visibilidade de bloqueios e status por competência na tela de fechamento.
- Concluído: guarda de validação financeira no backend (exige ciclo fechado, RH validado e sem inconsistências).

### 14.4 Prioridade 4 — Preparação CNAB
- Concluído: lote aprovado em Financeiro transita para `AGUARDANDO_PAGAMENTO`.
- Concluído: encaminhamento para fluxo bancário/CNAB com rastreabilidade.
- Pendente: validação final integrada ponta a ponta em ambiente com dados reais/homologação.
