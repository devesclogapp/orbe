# FIX 01 — Relatório de Investigação Inicial

## 1. Origem da Lista
A lista provém de `TipoServicoOperacionalService.getAllActive()`, que busca todos os registros válidos da tabela `tipos_servico_operacional`. O hook `useQuery` armazena esses dados.

## 2. Estrutura Existente
Na tabela `tipos_servico_operacional` já existe uma classificação estrutural: a flag booleana `is_extra_service`.
- Para Serviços Extras: O `ServicosExtrasLancamento.tsx` e o `NovoServicoExtraDialog.tsx` utilizam um `.filter(t => t.is_extra_service === true)`.
- Para Operações por Volume: Atualmente o componente `OperacaoForm.tsx` (que atende o Encarregado e o Admin) passa a lista não filtrada ao formulário.

## 3. Fluxos Afetados
- Operação por Volume (Portal do Encarregado)
- Operação por Volume (Novo Lançamento - Administrativo)
Custos Extras e Serviços Extras não estão sendo corrompidos por tipos indevidos porque possuem restrições consistentes.

## 4. Causa Raiz
A falta de um filtro complementar (simétrico) em `OperacaoForm.tsx`, permitindo que cadastros que são essencialmente `is_extra_service` continuassem aparecendo para o escopo de Operações por Volume.

## 5. Impacto
- **UX e Classificação**: O usuário do Portal do Encarregado tem acesso a opções sobrepostas nas duas rotas, mascarando a natureza dos registros.
- **Processamento/Financeiro**: Pode causar impactos não intencionais se Serviços Extras forem processados como Operações por Volume. Sem DB Migration, o impacto é unicamente o preenchimento sem semântica exata. 

## 6. Solução Recomendada (Plano)
**Classificação "A — somente filtro usando classificação já existente" e "C — pequena adaptação de frontend":**

Visto que a flag `is_extra_service` já existe, a correção consiste em apenas:
1. Filtrar no Frontend (`OperacaoForm.tsx`) para exibir estritamente `t => !t.is_extra_service`.
2. Alterar a label visual em `FormStepContext.tsx` de "Tipo de Serviço / Operação" para "Tipo de Operação".
3. Validar a build e manter testes. Sem nenhuma alteração de migração, RPC, schema ou regra base, atendendo aos princípios de segregação.
