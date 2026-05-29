# Raio-X de Reorganização Semântica do ERP Orbe

Este documento detalha o plano para a reorganização do sidebar e arquitetura visual do ERP Orbe, garantindo clareza no pipeline operacional sem quebrar fluxos existentes.

## 1. Mapeamento da Nova Estrutura

### VISÃO GERAL
- **Dashboard**: `/operacional/dashboard` (Existente)

### ENTRADAS / CAPTURA (Seção renomeada de "Entradas")
- **Operações Recebidas**: `/operacional/operacoes` (Existente)
- **Pontos Recebidos**: `/operacional/pontos` (Existente)
- **Diaristas Recebidos**: `/operacional/diaristas` (Existente)
- **Custos Extras**: `/producao/custos-extras` (Existente)
- **Serviços Extras**: `/producao/servicos-extras` (Existente)

### PROCESSAMENTO / PIPELINE (Seção renomeada de "RH")
- **Pipeline Operacional**: `/operacional/pipeline` (**NOVA ROTA**, baseada na Central Operacional)
- **Aprovações RH**: `/rh/diaristas` (Existente, focado em validação de lotes)
- **Pendências**: `/inconsistencias` (Existente, detecção de erros)
- **Lotes e Fechamentos**: `/fechamento` (Existente)
- **Reprocessamentos**: `/processamento/reprocessamentos` (**NOVA PÁGINA/ROTA**)
- **Processamento de Ponto**: `/banco-horas/processamento` (Existente, renomeado de "Processamento RH")

### FINANCEIRO
- **Central Financeira**: `/financeiro` (Existente)
- **Bancário / Remessas**: `/bancario` (Existente)
- **Contas Bancárias**: `/financeiro/contas-bancarias` (Existente)
- **Conciliação**: `/financeiro/retorno` (Existente, renomeado de "Retorno Bancário")

### GOVERNANÇA
- **Relatórios**: `/relatorios` (Existente)
- **Usuários**: `/admin/usuarios-acessos` (Existente)
- **Automação**: `/governanca/automacao` (Existente)
- **Auditoria**: `/governanca/auditoria` (Existente)

---

## 2. Mudanças Técnicas Previstas

### Sidebar & Navegação
- **navigationMeta.ts**: Atualizar metadados, labels e seções.
- **Sidebar.tsx**: Reorganizar `groups` e adicionar novos itens.

### Rotas e Páginas
- **App.tsx**: Adicionar rotas para `/operacional/pipeline` e `/processamento/reprocessamentos`.
- **PipelineOperacional.tsx**: Nova tela agregadora (evolução da Central Operacional).
- **Reprocessamentos.tsx**: Nova tela para logs e ações de reprocessamento.

---

## 3. Estratégia de Implementação
1. **Fase 1**: Atualizar `navigationMeta.ts` e `Sidebar.tsx` com a nova estrutura (usando as telas atuais).
2. **Fase 2**: Criar as novas telas (`PipelineOperacional` e `Reprocessamentos`) e registrar no `App.tsx`.
3. **Fase 3**: Renomear e ajustar telas existentes (`Processamento de Ponto`, `Aprovações RH`, etc.).
4. **Fase 4**: Validação final e limpeza.
