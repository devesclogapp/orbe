# Diagnóstico Técnico - Interrupção do Pipeline de Intermitentes

## 1. O(s) Lote(s) chegou(garam) ao Financeiro? E gerou o Lote Bancário?
**SIM.** O status `ENVIADO_FINANCEIRO` nos itens ("lançamentos_intermitentes" no Histórico Fechados) indica inequivocamente que a função `aprovarFinanceiro()` foi executada com sucesso pela **Central Financeira**.
O ERP trabalha em cascata: quando o lote é aprovado no Financeiro, o Lote pai (`intermitentes_lotes_fechamento`) recebe o status `FECHADO_FINANCEIRO`, e todos os registros atrelados a ele (`lancamentos_intermitentes`) recebem `ENVIADO_FINANCEIRO`. Logo, o processo passou no fluxo e chegou com sucesso à Central Bancária.

## 2. Por que ele não aparece na Central Bancária ao abri-la pela primeira vez?
Existem dois bloqueios arquiteturais que causam essa "invisibilidade/interrupção visual":

**1. A `CentralBancaria.tsx` omite ativamente Intermitentes (e Diaristas) se a Empresa não estiver selecionada:**
No código-fonte da tela de Central Bancária:
```typescript
const { data: lotesIntermitentes = [] } = useQuery({
  queryKey: ["lotes-intermitentes-financeiro-bancario", empresaId],
  queryFn: () => (empresaId ? IntermitentesLoteService.getByEmpresaParaFinanceiro(empresaId) : Promise.resolve([])),
  // Só executa o fetch SE empresaId for passado. 
});
```
Isso significa que enquanto a listagem original CLT (`rawLotesRh`) retorna os dados globais pendentes, as abas de Intermitentes exigem filtro cego (a tela exige filtrar a Empresa, mas não diz que sem empresa a lista será zero).

**2. A verificação falhou na busca automatizada por causa da Competência:**
O lote foi gerado aglutinando registros em "2026-07" (`params.periodoInicio.substring(0, 7) = yyyy-MM`), mas as checagens foram realizadas em competências anteriores (`2026-06`). Ao unir isso com o silenciamento automático pelo `empresaId`, temos a falsa sensação de que a tela Central Bancária interrompeu o pipeline.

## 3. Identificação do componente
* **Tela:** `src/pages/CentralBancaria.tsx`
* **Vulnerabilidade:** Design lógico de `useQuery` de Intermitentes em condicional com `empresaId`.

## 4. A partir de qual tela podemos continuar a homologação?
Podemos prosseguir as validações **direto da tela Central Bancária (`/bancario`)**. Basta garantir via Interface e navegador preenchimento concomitante da:
- Competência `2026-07` (competência atual geradora da importação);
- Seleção precisa da Empresa correta (cujo `empresa_id` está atrelado ao Lote).
Com isso o componente destravará a flag da useQuery da UI e retornará o lote FECHADO_FINANCEIRO perfeitamente habilitado.
