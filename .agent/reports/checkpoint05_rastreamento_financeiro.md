# Rastreamento Financeiro - Checkpoint 05 (Intermitentes)
## Avaliação de Transição: ENVIADO FINANCEIRO -> FECHADO FINANCEIRO

### Etapa 01: Validar Situação Atual
O status `ENVIADO_FINANCEIRO` no Histórico dos Intermitentes Recebidos confirma que:
1. O período foi fechado pelo administrativo.
2. O RH realizou a aprovação do grupo.
3. **O Financeiro atestou seu consentimento** utilizando a aba da `Central Financeira` originando então a conversão de status. Na arquitetura atual, ENVIADO_FINANCEIRO reflete o status de um item e é atrelado apenas quando o Lote Principal é atualizado para `FECHADO_FINANCEIRO`.

### Etapa 02: Rastrear o Fluxo
O Lote mapeado trilha o roteiro exato sem paradas brutas:
Intermitentes Recebidos -> Lotes -> RH -> Financeiro -> (Finalizou Financeiro, logo, AGUARDANDO Central Bancária).
* Ele está na ante-sala do envio Bancário.

### Etapa 03: Financeiro
- Lote financeiro foi Criado? **SIM**
- Aprovação do financeiro ocorreu? **SIM** (Evidência: `ENVIADO_FINANCEIRO`)
- As amarras ocorreram corretamente no componente de `CentralFinanceira.tsx` durante a chamada ao `IntermitentesLoteService.aprovarFinanceiro()`. Nenhuma Regra impediu.

### Etapa 04: Central Bancária
Ele aparece na Central Bancária? **SIM**, ele deve comparecer desde que os preceitos de UI sejam preenchidos.
**Porque parece não aparecer na prática automatizada/rápida?**
Enquanto o `RHFinanceiroLotes` carrega em modo "Overview Global" quando `empresaId = null/undefined`, os Serviços `IntermitentesLoteService` explicitamente condicionaram em `CentralBancaria.tsx`: 
`queryFn: () => (empresaId ? IntermitentesLoteService.getByEmpresaParaFinanceiro(empresaId) : Promise.resolve([]))`
Logo, se a `Empresa` ou `Competência` não divergirem estritamente do registro salvo, eles permanecem invisíveis para o Frontend.

### Etapa 05/06: Diagnóstico Final
O pipeline Financeiro em si NENHUM MOMENTO quebrou. 
Se deseja dar prosseguimento ao **Checkpoint 05 — Geração do CNAB e Febraban**, instruo a navegação manual para acessar `<ERP_URL>/bancario` e inserir intencionalmente e fixamente um filtro de uma **competência e empresa atrelada a este intermitente específico** testando que a UI acionará corretamente as tabelas ocultas e poderá permitir a Geração normal do Arquivo CNAB. 
