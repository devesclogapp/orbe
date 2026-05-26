# Gran Finale - Plano de Auditoria e Estabilização Orbe

## 1. 🔍 Diagnóstico Técnico Inicial (Auditoria Digital)

### ✅ Pontos Estáveis (Aprovados)
- **Estrutura de Rotas**: `App.tsx` bem estruturado com guards (`AuthGuard`, `PortalGuard`).
- **Pipeline RH -> Financeiro**: Lógica de `rhFinanceiro.service.ts` robusta, tratando bloqueios críticos e avisos operacionais.
- **Motor de Regras**: `rhProcessing.service.ts` já implementa segregação मास्टर (CLT vs Diarista) e validação de aptidão cadastral.
- **Segurança**: Contextos de `Auth`, `Tenant` e `AccessControl` centralizados.

### ⚠️ Pontos de Atenção (Médio Risco)
- **Serviços Extras**: Vários serviços (ex: `servicos_extras_operacionais`) possuem tratamento de erro para tabelas ausentes, indicando migrations pendentes ou migração faseada.
- **Diaristas**: Fluxo segregado mas precisa de validação de ponta a ponta no Portal do Encarregado (UI).
- **Consistência de Status**: Necessidade de padronizar labels e cores de status (PENDENTE, RECEBIDO, ATRASADO) conforme definido nos docs de memória.

### ❌ Pontos Críticos (Alto Risco)
- **Integração Financeira**: A transição de "Aprovado RH" para "Lote Financeiro" depende de tabelas que podem estar sob RLS restritiva.
- **CNAB**: O serviço de validação (`cnabBBValidator.service.ts`) e geração precisa de teste real com dados de produção mockados.

## 2. 🛠️ Plano de Ação (Matriz de Validação)

### Fase 1: Blindagem de Dados e RLS
- [ ] Validar todas as Policies RLS das tabelas de `rh_financeiro_lotes` e `itens`.
- [ ] Garantir que `deleted_at` (soft delete) está implementado nas tabelas operacionais críticas.

### Fase 2: Validar Fluxo Diaristas (Pipeline Mobile -> RH)
- [ ] Testar lançamento manual vs lote.
- [ ] Validar transição para "Aguardando RH".

### Fase 3: Validar Fluxo Produção/Volume
- [ ] Testar aplicação de Regras Operacionais na coluna "Valor Unitário".
- [ ] Validar cálculo de ISS conforme as mudanças recentes no `OperacoesTableBlock.tsx`.

### Fase 4: Financeiro e Saída (CNAB)
- [ ] Gerar lote de teste completo a partir de uma competência fechada.
- [ ] Validar layout do arquivo de remessa.

## 📊 Classificação de Saúde do Sistema
- **RH/CLT**: ✅ Estável
- **Diaristas**: ⚠️ Parcial (Ajustes de UX/UI pendentes)
- **Financeiro**: ⚠️ Parcial (Aguardando teste de CNAB)
- **Operacional/Volume**: ✅ Estável (ISS corrigido)

## 🧪 Próximos Passos de Verificação
1. Executar auditoria de schema via MCP para verificar migrations de `servicos_extras_operacionais`.
2. Validar permissões do perfil 'Encarregado' no Portal.
