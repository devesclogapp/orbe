# Relatório Oficial de Resolução — Bug Crítico 001
## Domínio: Intermitentes
## Título: Agrupamento Ilegal de Lotes Multiempresa

### 1. Contexto do Problema
Durante o *Checkpoint 04* da homologação operacional do módulo de Intermitentes, foi detectado um bug arquitetural estrutural (Bug Crítico 001). A Central Financeira estava impedida de exibir lotes recém-criados. 

**Causa Raiz 1:** O painel "Intermitentes Recebidos" enviava um parâmetro global (`filterEmpresaId = 'all'`). Ao longo de todo o ciclo do ERP ORBE, nenhum lote pode existir flutuando no *tenant* sem pertencimento à uma Empresa, devido pautas como DRE e contas CNAB. A criação criava um lote com `empresa_id = null`. 

**Causa Raiz 2:** A Edge Function `importar-intermitentes-tio`, correspondente ao *Workflow A*, fazia verificação condicional exigindo CAPS LOCK estrito, impedindo que departamentos formatados do Tio Digital como "Castanhal,Operacional" herdassem corretamente o identificador da empresa. 

### 2. Ações Tomadas e Arquitetura Refatorada

Conforme planejamento aprovado via `implementation_plan.md`:

- **Edge Function (`importar-intermitentes-tio/index.ts`):** 
  Implementada a função `normalizeCompanyText` para aplicar remoção de sufixos LTDA, ME e sanitizar acentos e caixotes. Implementada a função `findEmpresaFuzzy` permitindo match exato e match de inclusão (`includes`). Assim, dados importados automaticamente receberão `empresa_id` robusto.

- **Serviço de Domínio (`IntermitentesLoteService.fecharPeriodo`):** 
  Eliminado o Anti-Pattern de "lote aglutinador". Refatorada a assinatura para `Promise<IntermitenteLoteFechamento[]>`. O Backend agora agrupa (`Map<string, lancamentos>`) os registros pela empresa. Caso encontre registros nulos, bloqueia a operação informando o gestor para corrigir a importação. Em seguida gera *um lote autônomo individual* para cada filial encontrada no período daquela apuração.

- **Interface Frontend (`IntermitentesRecebidos.tsx`):**
  Desacoplado o estado de um array singleton (`loteFechado`) para array `lotesFechados`. O Modal de notificação de Sucesso mapeia todos os lotes gerados nativamente pelo serviço, garantindo coerência visual transparente para o operador que efetuou a fechada global.

### 3. Impacto Relacionado e Regressão Operacional (DRE, RH e CNAB)
O Bug 001 mascarou seu impacto nos *Checkpoints* 02 e 03, pois a Tabela Geral de RH não utiliza filtro compulsório estrito por `empresa_id`.
Com a presente arquitetura, foi atestado:
- **Concílio do DRE:** Agora cada pacote financeiro cairá no DR da Empresa raiz que o absorveu (por lote individual iterado). Resumindo o processo orçamentário. 
- **Geração de CNAB:** As chaves de remessa agora são totalmente desacopladas, evitando mesclagem e rejeição pelo Banco (cada lote corresponderá à sua chave privada bancária via `empresaRemetente`).
- **RLS Preservado:** Como a chave de tenant é iterada pelo service do Node ou pelo Edge function, não há colisão cruzada.

### 4. Status Final de Resolução
O **Bug 001** (Agrupamento Multiempresa com empresa_id Null) está oficialmente classificado como **RESOLVIDO**.
Os próximos fechamentos seguirão os trilhos padronizados de Finanças por Unidades de Negócios (CNPJ único).

_Fim do Documento._
